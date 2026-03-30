// ============================================================
// LOTA AUTO CHESS — Server with Rooms (WebSocket)
// ============================================================
// Usage:
//   node server.js              → http://localhost:8080
//   Then:  ngrok http 8080 / cloudflared tunnel --url http://localhost:8080
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.wav':  'audio/wav',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.glb':  'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin':  'application/octet-stream',
    '.fbx':  'application/octet-stream',
};

const ROOT = __dirname;

// ── Config ──
const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT  = 10000;
const DISCONNECT_GRACE   = 8000;
const ROOM_CLEANUP_DELAY = 60000; // remove empty rooms after 60s

// ── HTTP static file server ──
const server = http.createServer(function(req, res) {
    var urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    var safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
    var filePath = path.join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, function(err, stats) {
        if (err || !stats.isFile()) {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
        }
        var ext = path.extname(filePath).toLowerCase();
        var contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=3600',
            'ngrok-skip-browser-warning': 'true',
            'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
    });
});

// ══════════════════════════════════════════════
// ROOM SYSTEM
// ══════════════════════════════════════════════

var rooms = {};     // roomCode -> room object
var nextPlayerId = 1;

function generateRoomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    var code;
    do {
        code = '';
        for (var i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]); // ensure unique
    return code;
}

function createRoom(hostWs, hostId, hostName) {
    var code = generateRoomCode();
    var room = {
        code: code,
        players: [],
        nextSlotId: 0,
        gameStarted: false,
        gameState: null,
        combatStarting: false,
        cleanupTimer: null,
        dungeonBossKills: { NW: 0, NE: 0, SW: 0, SE: 0 }
    };
    rooms[code] = room;
    console.log('  [Room] Created room ' + code);
    return room;
}

function findRoomByPlayer(playerId) {
    for (var code in rooms) {
        var room = rooms[code];
        for (var i = 0; i < room.players.length; i++) {
            if (room.players[i].id === playerId) return room;
        }
    }
    return null;
}

function cleanupRoom(code) {
    var room = rooms[code];
    if (!room) return;
    var connected = room.players.filter(function(p) { return p.ws.readyState === WebSocket.OPEN; });
    if (connected.length === 0) {
        delete rooms[code];
        console.log('  [Room] Cleaned up empty room ' + code);
    }
}

// ── Safe send helper ──
function safeSend(ws, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
        } catch(e) {
            console.error('  [WS] Send error:', e.message);
        }
    }
}

// ── Room broadcast helpers ──
function broadcastToRoom(room, payload) {
    var data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    room.players.forEach(function(p) {
        safeSend(p.ws, data);
    });
}

function broadcastLobby(room) {
    broadcastToRoom(room, {
        type: 'lobby_update',
        roomCode: room.code,
        players: room.players.map(function(p) {
            return { id: p.id, name: p.name, ready: p.ready, isHost: p.isHost, disconnected: !!p.disconnected };
        }),
        gameStarted: room.gameStarted
    });
}

function broadcastGameState(room) {
    broadcastToRoom(room, {
        type: 'game_state',
        players: room.players.map(function(p) {
            return {
                slotId: p.slotId,
                name: p.name,
                avatar: p.avatar,
                units: p.units || [],
                placement: p.placement || null,
                disconnected: !!p.disconnected
            };
        })
    });
}

function removePlayerFromRoom(room, playerId) {
    var player = room.players.find(function(p) { return p.id === playerId; });

    // During game: mark as disconnected
    if (room.gameStarted && player) {
        player.disconnected = true;
        player.alive = false;
        console.log('  [Room ' + room.code + '] ' + player.name + ' disconnesso durante la partita');

        if (!player.roundReady && room.gameState) {
            player.disconnectTimer = setTimeout(function() {
                if (!player.roundReady) {
                    console.log('  [Room ' + room.code + '] Force-ready per ' + player.name);
                    player.roundReady = true;
                    checkAllPlayersReady(room);
                }
            }, DISCONNECT_GRACE);
        }

        broadcastLobby(room);
        return;
    }

    // Not in game: remove entirely
    room.players = room.players.filter(function(p) { return p.id !== playerId; });

    // Reassign host
    if (room.players.length > 0 && !room.players.some(function(p) { return p.isHost; })) {
        room.players[0].isHost = true;
    }

    broadcastLobby(room);

    // Schedule cleanup if room is empty
    if (room.players.filter(function(p) { return !p.disconnected; }).length === 0) {
        if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
        room.cleanupTimer = setTimeout(function() {
            cleanupRoom(room.code);
        }, ROOM_CLEANUP_DELAY);
    }
}

function checkAllPlayersReady(room) {
    if (room.combatStarting) return;

    var activePlayers = room.players.filter(function(p) {
        return !p.disconnected || p.roundReady;
    });

    var allHumansReady = activePlayers.every(function(p) { return p.roundReady; });

    if (allHumansReady && activePlayers.length > 0) {
        room.combatStarting = true;

        console.log('  [Room ' + room.code + '] Tutti pronti! Invio start_combat...');
        room.players.forEach(function(p) { p.roundReady = false; });
        room.gameState.round++;

        var allUnits = {};
        for (var i = 0; i < room.players.length; i++) {
            var p = room.players[i];
            if (p.slotId !== null && p.slotId !== undefined) {
                allUnits[p.slotId] = p.units || [];
            }
        }

        broadcastToRoom(room, {
            type: 'start_combat',
            round: room.gameState.round,
            allUnits: allUnits,
            dungeonBossKills: room.dungeonBossKills
        });

        console.log('  [Room ' + room.code + '] start_combat round ' + room.gameState.round);

        setTimeout(function() {
            room.combatStarting = false;
        }, 500);
    }
}

// ── Message validation ──
function validateMessage(msg) {
    if (!msg || typeof msg !== 'object') return false;
    if (typeof msg.type !== 'string') return false;
    if (msg.type === 'set_name' && typeof msg.name !== 'string') return false;
    if (msg.type === 'player_avatar' && !msg.avatar) return false;
    if (msg.type === 'player_placement' && !Array.isArray(msg.units)) return false;
    if (msg.type === 'player_ready' && msg.units && !Array.isArray(msg.units)) return false;
    if (msg.type === 'join_room' && typeof msg.roomCode !== 'string') return false;
    return true;
}

// ══════════════════════════════════════════════
// WebSocket server
// ══════════════════════════════════════════════

var wss = new WebSocket.Server({ server: server });

// ── Heartbeat ──
var heartbeatTimer = setInterval(function() {
    wss.clients.forEach(function(ws) {
        if (ws._lotaAlive === false) {
            console.log('  [WS] Heartbeat timeout — terminating');
            ws.terminate();
            return;
        }
        ws._lotaAlive = false;
        try { ws.ping(); } catch(e) { /* ignore */ }
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', function() { clearInterval(heartbeatTimer); });

wss.on('connection', function(ws) {
    ws._lotaAlive = true;
    ws.on('pong', function() { ws._lotaAlive = true; });

    var playerId = nextPlayerId++;
    var playerEntry = null;
    var currentRoom = null;

    // Send connection ack — player is NOT in a room yet
    safeSend(ws, { type: 'connected', playerId: playerId });

    ws.on('message', function(raw) {
        var msg;
        try {
            msg = JSON.parse(raw);
        } catch(e) {
            console.warn('  [WS] JSON parse error:', e.message);
            return;
        }

        if (!validateMessage(msg)) {
            console.warn('  [WS] Invalid message:', JSON.stringify(msg).substring(0, 200));
            return;
        }

        // ── Create a new room (host) ──
        if (msg.type === 'create_room') {
            if (currentRoom) {
                safeSend(ws, { type: 'error', message: 'Sei gia in una stanza' });
                return;
            }

            var room = createRoom();
            currentRoom = room;

            playerEntry = {
                id: playerId,
                name: (msg.name || 'Host').substring(0, 20),
                ready: false,
                isHost: true,
                slotId: null,
                avatar: null,
                units: [],
                placement: null,
                roundReady: false,
                alive: true,
                disconnected: false,
                disconnectTimer: null,
                ws: ws
            };
            room.players.push(playerEntry);

            safeSend(ws, {
                type: 'room_joined',
                roomCode: room.code,
                playerId: playerId,
                isHost: true
            });

            console.log('  [Room ' + room.code + '] ' + playerEntry.name + ' ha creato la stanza (HOST)');
            broadcastLobby(room);
            return;
        }

        // ── Join an existing room ──
        if (msg.type === 'join_room') {
            if (currentRoom) {
                safeSend(ws, { type: 'error', message: 'Sei gia in una stanza' });
                return;
            }

            var code = (msg.roomCode || '').toUpperCase().trim();
            var room = rooms[code];

            if (!room) {
                safeSend(ws, { type: 'error', message: 'Stanza non trovata: ' + code });
                return;
            }

            if (room.gameStarted) {
                // Allow reconnect: check if a disconnected player has the same name
                var rejoinName = (msg.name || '').substring(0, 20);
                var disconnectedPlayer = null;
                for (var ri = 0; ri < room.players.length; ri++) {
                    if (room.players[ri].disconnected && room.players[ri].name === rejoinName) {
                        disconnectedPlayer = room.players[ri];
                        break;
                    }
                }
                if (disconnectedPlayer) {
                    // Reconnect: swap WS, cancel timer, restore state
                    disconnectedPlayer.ws = ws;
                    disconnectedPlayer.disconnected = false;
                    if (disconnectedPlayer.disconnectTimer) {
                        clearTimeout(disconnectedPlayer.disconnectTimer);
                        disconnectedPlayer.disconnectTimer = null;
                    }
                    currentRoom = room;
                    playerEntry = disconnectedPlayer;
                    safeSend(ws, {
                        type: 'room_joined',
                        roomCode: room.code,
                        playerId: disconnectedPlayer.id,
                        isHost: disconnectedPlayer.isHost,
                        reconnect: true,
                        slotId: disconnectedPlayer.slotId
                    });
                    broadcastLobby(room);
                    console.log('  [Room ' + code + '] ' + rejoinName + ' reconnected!');
                    return;
                }
                safeSend(ws, { type: 'error', message: 'La partita e gia iniziata' });
                return;
            }

            if (room.players.length >= 4) {
                safeSend(ws, { type: 'error', message: 'Stanza piena (max 4 giocatori)' });
                return;
            }

            currentRoom = room;
            if (room.cleanupTimer) { clearTimeout(room.cleanupTimer); room.cleanupTimer = null; }

            playerEntry = {
                id: playerId,
                name: (msg.name || 'Giocatore ' + playerId).substring(0, 20),
                ready: false,
                isHost: false,
                slotId: null,
                avatar: null,
                units: [],
                placement: null,
                roundReady: false,
                alive: true,
                disconnected: false,
                disconnectTimer: null,
                ws: ws
            };
            room.players.push(playerEntry);

            safeSend(ws, {
                type: 'room_joined',
                roomCode: room.code,
                playerId: playerId,
                isHost: false
            });

            console.log('  [Room ' + room.code + '] ' + playerEntry.name + ' si e unito — ' + room.players.length + ' giocatori');
            broadcastLobby(room);
            return;
        }

        // ── All messages below require being in a room ──
        if (!currentRoom || !playerEntry) {
            // Silently ignore messages from players not in a room
            return;
        }

        var room = currentRoom;

        if (msg.type === 'set_name') {
            playerEntry.name = (msg.name || 'Anonimo').substring(0, 20);
            console.log('  [Room ' + room.code + '] ' + playerId + ' → ' + playerEntry.name);
            broadcastLobby(room);
        }

        if (msg.type === 'toggle_ready') {
            playerEntry.ready = !playerEntry.ready;
            console.log('  [Room ' + room.code + '] ' + playerEntry.name + (playerEntry.ready ? ' PRONTO' : ' non pronto'));
            broadcastLobby(room);
        }

        if (msg.type === 'start_game' && playerEntry.isHost) {
            room.gameStarted = true;
            room.combatStarting = false;

            var sharedSeed = Math.floor(Math.random() * 1000000);
            room.gameState = {
                seed: sharedSeed,
                round: 0,
                placements: {},
                combatResults: {}
            };

            console.log('');
            console.log('  ======================================');
            console.log('  PARTITA AVVIATA in stanza ' + room.code + '!');
            console.log('  Seed: ' + sharedSeed + ' | Giocatori: ' + room.players.length);
            console.log('  ======================================');

            var playerAssignments = [];
            for (var i = 0; i < 4; i++) {
                if (i < room.players.length) {
                    room.players[i].slotId = i;
                    room.players[i].alive = true;
                    room.players[i].disconnected = false;
                    playerAssignments.push({
                        slotId: i,
                        type: 'human',
                        clientId: room.players[i].id,
                        name: room.players[i].name
                    });
                    console.log('    [Slot ' + i + '] Human: ' + room.players[i].name);
                } else {
                    playerAssignments.push({
                        slotId: i,
                        type: 'ai',
                        name: 'AI ' + (i + 1)
                    });
                    console.log('    [Slot ' + i + '] AI Player');
                }
            }

            broadcastToRoom(room, {
                type: 'game_start',
                playerCount: room.players.length,
                totalSlots: 4,
                sharedSeed: sharedSeed,
                playerAssignments: playerAssignments,
                players: room.players.map(function(p) {
                    return { id: p.id, name: p.name };
                })
            });
        }

        if (msg.type === 'player_avatar' && room.gameStarted) {
            playerEntry.avatar = msg.avatar;
            console.log('  [Room ' + room.code + '] ' + playerEntry.name + ' avatar: ' + msg.avatar);
            broadcastGameState(room);
        }

        if (msg.type === 'player_placement' && room.gameStarted && room.gameState) {
            playerEntry.units = msg.units || [];
            playerEntry.placement = msg.placement;
            broadcastGameState(room);
        }

        if (msg.type === 'player_ready' && room.gameStarted && room.gameState) {
            if (playerEntry.slotId === null || playerEntry.slotId === undefined) {
                console.warn('  [Room ' + room.code + '] player_ready but slotId null — ignoring');
                return;
            }
            if (playerEntry.roundReady) {
                console.warn('  [Room ' + room.code + '] Duplicate player_ready — ignoring');
                return;
            }

            playerEntry.roundReady = true;
            if (msg.units) {
                playerEntry.units = msg.units;
                room.gameState.placements[playerEntry.slotId] = msg.units;
            }
            console.log('  [Room ' + room.code + '] ' + playerEntry.name + ' pronto (slot ' + playerEntry.slotId + ')');
            checkAllPlayersReady(room);
        }

        if (msg.type === 'combat_ack' && room.gameStarted) {
            // ACK received
        }

        // Dungeon boss killed — sync kill count to all clients
        if (msg.type === 'boss_killed' && room.gameStarted && msg.dungeonId) {
            var did = msg.dungeonId;
            if (room.dungeonBossKills[did] !== undefined) {
                room.dungeonBossKills[did] = (room.dungeonBossKills[did] || 0) + 1;
                broadcastToRoom(room, {
                    type: 'boss_kill_sync',
                    dungeonBossKills: room.dungeonBossKills
                });
            }
        }

        if (msg.type === 'reset_lobby' && playerEntry.isHost) {
            room.gameStarted = false;
            room.combatStarting = false;
            room.players.forEach(function(p) {
                p.ready = false;
                p.roundReady = false;
                p.slotId = null;
                p.alive = true;
                p.disconnected = false;
                if (p.disconnectTimer) { clearTimeout(p.disconnectTimer); p.disconnectTimer = null; }
            });
            room.players = room.players.filter(function(p) { return p.ws.readyState === WebSocket.OPEN; });
            console.log('  [Room ' + room.code + '] Reset');
            broadcastLobby(room);
        }
    });

    ws.on('close', function() {
        if (currentRoom && playerEntry) {
            console.log('  [Room ' + currentRoom.code + '] ' + playerEntry.name + ' disconnesso');
            removePlayerFromRoom(currentRoom, playerId);
        }
    });

    ws.on('error', function(err) {
        console.error('  [WS] Error:', err.message);
    });
});

// ── Start ──
server.listen(PORT, function() {
    console.log('');
    console.log('  ==========================================');
    console.log('  LOTA AUTO CHESS — Server + Rooms');
    console.log('  ==========================================');
    console.log('  Locale:  http://localhost:' + PORT);
    console.log('');
    console.log('  Per condividere online:');
    console.log('    cloudflared tunnel --url http://localhost:' + PORT);
    console.log('    ngrok http ' + PORT);
    console.log('  ==========================================');
    console.log('');
});
