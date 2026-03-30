// ============================================================
// LOTA AUTO CHESS — Lobby Client (WebSocket + Rooms)
// ============================================================

var lobbySocket = null;
var lobbyPlayerId = null;
var lobbyIsHost = false;
var lobbyActive = true;
var lobbyRoomCode = null;

// ── Reconnection state ──
var _lobReconnectAttempts = 0;
var _lobReconnectMax = 10;
var _lobReconnectTimer = null;
var _lobIntentionalClose = false;
var _lobPendingAction = null; // { type: 'create_room'|'join_room', ... } to replay after reconnect

function _lobReconnectDelay() {
    return Math.min(1000 * Math.pow(2, _lobReconnectAttempts), 15000);
}

// ── Called from menu buttons ──
function hostRoom() {
    var nameInput = document.getElementById('lobby-name-input');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) name = 'Host';

    _lobPendingAction = { type: 'create_room', name: name };

    if (lobbySocket && lobbySocket.readyState === 1) {
        lobbySocket.send(JSON.stringify(_lobPendingAction));
    } else {
        _lobConnect();
    }
}

function joinRoom(code) {
    if (!code || code.trim().length === 0) return;
    code = code.toUpperCase().trim();

    var nameInput = document.getElementById('lobby-name-input');
    var name = nameInput ? nameInput.value.trim() : '';
    if (!name) name = 'Giocatore';

    _lobPendingAction = { type: 'join_room', roomCode: code, name: name };

    if (lobbySocket && lobbySocket.readyState === 1) {
        lobbySocket.send(JSON.stringify(_lobPendingAction));
    } else {
        _lobConnect();
    }
}

function initLobby() {
    // ── Menu buttons ──
    var hostBtn = document.getElementById('btn-host-room');
    if (hostBtn) {
        hostBtn.addEventListener('click', function() {
            // Show lobby overlay for name input, then connect
            var overlay = document.getElementById('lobby-overlay');
            var menuOverlay = document.getElementById('menu-overlay');
            if (overlay) overlay.classList.add('active');
            if (menuOverlay) menuOverlay.classList.remove('active');

            // Set default name
            var nameInput = document.getElementById('lobby-name-input');
            if (nameInput && !nameInput.value.trim()) nameInput.value = 'Host';

            // Connect and create room
            _lobConnect(function() {
                var nameVal = nameInput ? nameInput.value.trim() : 'Host';
                _lobPendingAction = { type: 'create_room', name: nameVal };
                lobbySocket.send(JSON.stringify(_lobPendingAction));
            });
        });
    }

    var joinBtn = document.getElementById('btn-join-room');
    if (joinBtn) {
        joinBtn.addEventListener('click', function() {
            var codeInput = document.getElementById('join-room-code');
            var code = codeInput ? codeInput.value.toUpperCase().trim() : '';
            if (!code) {
                if (codeInput) { codeInput.style.borderColor = '#ef4444'; setTimeout(function() { codeInput.style.borderColor = ''; }, 1500); }
                return;
            }

            var overlay = document.getElementById('lobby-overlay');
            var menuOverlay = document.getElementById('menu-overlay');
            if (overlay) overlay.classList.add('active');
            if (menuOverlay) menuOverlay.classList.remove('active');

            var nameInput = document.getElementById('lobby-name-input');
            if (nameInput && !nameInput.value.trim()) nameInput.value = 'Giocatore';

            _lobConnect(function() {
                var nameVal = nameInput ? nameInput.value.trim() : 'Giocatore';
                _lobPendingAction = { type: 'join_room', roomCode: code, name: nameVal };
                lobbySocket.send(JSON.stringify(_lobPendingAction));
            });
        });
    }

    // Allow Enter on code input to join
    var codeInput = document.getElementById('join-room-code');
    if (codeInput) {
        codeInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter' && joinBtn) joinBtn.click();
        });
    }

    // ── Lobby UI buttons ──
    var nameInput = document.getElementById('lobby-name-input');
    if (nameInput) {
        nameInput.addEventListener('change', _lobSendName);
        nameInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') _lobSendName();
        });
    }

    var readyBtn = document.getElementById('lobby-ready-btn');
    if (readyBtn) {
        readyBtn.addEventListener('click', function() {
            if (lobbySocket && lobbySocket.readyState === 1) {
                lobbySocket.send(JSON.stringify({ type: 'toggle_ready' }));
            }
        });
    }

    var startBtn = document.getElementById('lobby-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            if (lobbySocket && lobbySocket.readyState === 1) {
                lobbySocket.send(JSON.stringify({ type: 'start_game' }));
            }
        });
    }

    // Room code copy on click
    var codeValueEl = document.getElementById('lobby-room-code-value');
    if (codeValueEl) {
        codeValueEl.addEventListener('click', function() {
            if (lobbyRoomCode && navigator.clipboard) {
                navigator.clipboard.writeText(lobbyRoomCode).then(function() {
                    codeValueEl.textContent = 'COPIATO!';
                    setTimeout(function() { codeValueEl.textContent = lobbyRoomCode; }, 1200);
                });
            }
        });
    }
}

function _lobConnect(onOpenCallback) {
    // Don't create duplicate connections
    if (lobbySocket && (lobbySocket.readyState === WebSocket.CONNECTING || lobbySocket.readyState === WebSocket.OPEN)) {
        if (onOpenCallback && lobbySocket.readyState === WebSocket.OPEN) onOpenCallback();
        return;
    }

    try {
        var protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
        var wsUrl = protocol + location.host;
        lobbySocket = new WebSocket(wsUrl);

        lobbySocket.onopen = function() {
            _lobReconnectAttempts = 0;
            var el = document.getElementById('lobby-status');
            if (el) { el.textContent = 'Connesso!'; el.style.color = '#34d399'; }

            if (onOpenCallback) {
                onOpenCallback();
                onOpenCallback = null; // only call once
            }
        };

        lobbySocket.onerror = function() {
            var el = document.getElementById('lobby-status');
            if (el) { el.textContent = 'Errore connessione...'; el.style.color = '#ef4444'; }
        };

        lobbySocket.onclose = function() {
            var el = document.getElementById('lobby-status');

            if (_lobIntentionalClose) {
                if (el) { el.textContent = 'Disconnesso'; el.style.color = '#ef4444'; }
                return;
            }

            if (_lobReconnectAttempts < _lobReconnectMax) {
                var delay = _lobReconnectDelay();
                _lobReconnectAttempts++;
                if (el) {
                    el.textContent = 'Riconnessione in ' + Math.ceil(delay / 1000) + 's... (' + _lobReconnectAttempts + '/' + _lobReconnectMax + ')';
                    el.style.color = '#f59e0b';
                }
                _lobReconnectTimer = setTimeout(function() {
                    _lobConnect(function() {
                        // Re-send pending action on reconnect (rejoin room)
                        if (_lobPendingAction && lobbySocket.readyState === 1) {
                            lobbySocket.send(JSON.stringify(_lobPendingAction));
                        }
                    });
                }, delay);
            } else {
                if (el) { el.textContent = 'Connessione persa — ricarica la pagina'; el.style.color = '#ef4444'; }
                setTimeout(showMenuIfNoLobby, 1000);
            }
        };

        lobbySocket.onmessage = function(evt) {
            var msg;
            try { msg = JSON.parse(evt.data); } catch(e) { return; }

            // Connection ack (not in room yet)
            if (msg.type === 'connected') {
                lobbyPlayerId = msg.playerId;
                window.lobbyPlayerId = msg.playerId;
            }

            // Room joined successfully
            if (msg.type === 'room_joined') {
                lobbyPlayerId = msg.playerId;
                window.lobbyPlayerId = msg.playerId;
                lobbyIsHost = msg.isHost;
                lobbyRoomCode = msg.roomCode;

                // Show room code in lobby
                var codeEl = document.getElementById('lobby-room-code');
                var codeValueEl = document.getElementById('lobby-room-code-value');
                if (codeEl) codeEl.style.display = '';
                if (codeValueEl) codeValueEl.textContent = msg.roomCode;

                // Send name
                _lobSendName();
            }

            // Error from server
            if (msg.type === 'error') {
                var el = document.getElementById('lobby-status');
                if (el) { el.textContent = msg.message || 'Errore'; el.style.color = '#ef4444'; }
                // Go back to menu on room join error
                if (!lobbyRoomCode) {
                    setTimeout(showMenuIfNoLobby, 2000);
                }
            }

            if (msg.type === 'lobby_update') {
                _lobRenderPlayers(msg);
            }

            if (msg.type === 'game_start') {
                _lobStartGame(msg);
            }

            if (msg.type === 'game_state') {
                window.lobbyGameState = msg;
                if (typeof updatePlayersFromServer === 'function') {
                    updatePlayersFromServer(msg);
                }
            }

            if (msg.type === 'start_combat') {
                console.log('[Game] start_combat ricevuto, round ' + msg.round);
                // Sync dungeon boss kills from server
                if (msg.dungeonBossKills && typeof globalDungeonBossKills !== 'undefined') {
                    globalDungeonBossKills = msg.dungeonBossKills;
                }
                if (lobbySocket && lobbySocket.readyState === 1) {
                    lobbySocket.send(JSON.stringify({ type: 'combat_ack', round: msg.round }));
                }
                if (typeof applyServerUnitsAndStartCombat === 'function') {
                    applyServerUnitsAndStartCombat(msg.allUnits);
                }
            }

            // Dungeon boss kill sync from server
            if (msg.type === 'boss_kill_sync' && msg.dungeonBossKills) {
                if (typeof globalDungeonBossKills !== 'undefined') {
                    globalDungeonBossKills = msg.dungeonBossKills;
                }
            }

            if (msg.type === 'advance_round') {
                if (typeof advanceRound === 'function') {
                    advanceRound();
                }
            }
        };
    } catch(e) {
        console.error('[Lobby] WebSocket init error:', e);
        var el = document.getElementById('lobby-status');
        if (el) { el.textContent = 'WebSocket non supportato'; el.style.color = '#ef4444'; }
    }
}

function _lobSendName() {
    var nameInput = document.getElementById('lobby-name-input');
    if (nameInput && lobbySocket && lobbySocket.readyState === 1) {
        lobbySocket.send(JSON.stringify({ type: 'set_name', name: nameInput.value.trim() }));
    }
}

function _lobRenderPlayers(msg) {
    var listEl = document.getElementById('lobby-player-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    var count = msg.players.length;

    for (var i = 0; i < msg.players.length; i++) {
        var p = msg.players[i];
        var div = document.createElement('div');
        div.className = 'lobby-player' + (p.id === lobbyPlayerId ? ' lobby-player-self' : '');
        if (p.disconnected) div.className += ' lobby-player-disconnected';

        var nameSpan = document.createElement('span');
        nameSpan.className = 'lobby-player-name';
        nameSpan.textContent = (p.isHost ? '\u2654 ' : '') + p.name + (p.disconnected ? ' (offline)' : '');

        var statusSpan = document.createElement('span');
        statusSpan.className = 'lobby-player-status ' + (p.disconnected ? 'disconnected' : (p.ready ? 'ready' : 'waiting'));
        statusSpan.textContent = p.disconnected ? 'OFFLINE' : (p.ready ? 'PRONTO' : 'In attesa...');

        div.appendChild(nameSpan);
        div.appendChild(statusSpan);
        listEl.appendChild(div);
    }

    var countEl = document.getElementById('lobby-player-count');
    if (countEl) countEl.textContent = count + ' giocator' + (count === 1 ? 'e' : 'i') + ' conness' + (count === 1 ? 'o' : 'i');

    var startBtn = document.getElementById('lobby-start-btn');
    if (startBtn) {
        startBtn.style.display = lobbyIsHost ? '' : 'none';
        startBtn.disabled = count < 1;
        startBtn.textContent = 'Avvia Partita (' + count + ' giocator' + (count === 1 ? 'e' : 'i') + ')';
    }

    var readyBtn = document.getElementById('lobby-ready-btn');
    if (readyBtn) {
        var meReady = false;
        for (var i = 0; i < msg.players.length; i++) {
            if (msg.players[i].id === lobbyPlayerId && msg.players[i].ready) { meReady = true; break; }
        }
        readyBtn.textContent = meReady ? 'Non Pronto' : 'Pronto!';
        if (meReady) readyBtn.classList.add('btn-ready-active');
        else readyBtn.classList.remove('btn-ready-active');
    }
}

function _lobStartGame(msg) {
    lobbyActive = false;
    if (_lobReconnectTimer) { clearTimeout(_lobReconnectTimer); _lobReconnectTimer = null; }

    var overlay = document.getElementById('lobby-overlay');
    if (overlay) overlay.classList.remove('active');

    window.lobbySharedSeed = msg.sharedSeed || null;
    window.lobbyPlayerAssignments = msg.playerAssignments || null;

    var assignments = msg.playerAssignments || [];
    var myAssignment = null;
    for (var i = 0; i < assignments.length; i++) {
        if (assignments[i].type === 'human' && assignments[i].clientId === window.lobbyPlayerId) {
            myAssignment = assignments[i];
            break;
        }
    }
    var names = assignments.map(function(a) { return (a.type === 'human' ? '\u{1F464}' : '\u{1F916}') + a.name; }).join(' | ');
    var existingBanner = document.getElementById('mp-debug-banner');
    if (existingBanner) existingBanner.remove();
    var banner = document.createElement('div');
    banner.id = 'mp-debug-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1a2e;color:#00ff88;font:bold 12px monospace;padding:4px 8px;z-index:99999;text-align:center;';
    banner.textContent = '\u{1F310} STANZA ' + (lobbyRoomCode || '?') + ' | Sei: ' + (myAssignment ? myAssignment.name + ' (slot ' + myAssignment.slotId + ')' : '???') + ' | ' + names;
    document.body.appendChild(banner);

    console.log('[Lobby] Game starting | room:', lobbyRoomCode, '| myId:', window.lobbyPlayerId, '| seed:', msg.sharedSeed);

    if (typeof players !== 'undefined' && players[0] && msg.players) {
        for (var i = 0; i < msg.players.length; i++) {
            if (msg.players[i].id === lobbyPlayerId) {
                players[0].name = msg.players[i].name;
                break;
            }
        }
    }

    var startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.click();
}

// Auto-init lobby on page load
window.addEventListener('DOMContentLoaded', function() {
    // On file:// — show menu, no multiplayer
    if (location.protocol === 'file:') {
        showMenuIfNoLobby();
        return;
    }

    try {
        initLobby();
        // DON'T auto-connect or auto-show lobby — wait for user to click Host/Join
    } catch(e) {
        console.error('[Lobby] Init failed:', e);
        showMenuIfNoLobby();
    }
});

function showMenuIfNoLobby() {
    var lobby = document.getElementById('lobby-overlay');
    if (lobby && lobby.classList.contains('active')) {
        lobby.classList.remove('active');
    }
    var menu = document.getElementById('menu-overlay');
    if (menu) {
        menu.classList.add('active');
    }
}
