// ============================================================
// LOTA AUTO CHESS — game.js — Main game loop (4-player FFA)
// ============================================================

var combatAnimInterval = null;

// --- Dungeon Boss Tracking ---
var globalDungeonBossKills = { NW:0, NE:0, SW:0, SE:0 };

// --- Initialization ---
function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize Three.js 3D engine (if available)
    if (typeof THREE !== 'undefined' && typeof initThreeScene === 'function') {
        try {
            initThreeScene();
            if (typeof createBoard3D === 'function') createBoard3D();
            if (typeof initThreeEnvironment === 'function') initThreeEnvironment();
            if (typeof initScenery === 'function') initScenery();
            // Pre-compila tutti gli shader WebGL ora — elimina il lag iniziale
            // (WebGL compila GLSL lazily al primo frame senza questo)
            if (threeRenderer && threeScene && threeCamera) {
                threeRenderer.compile(threeScene, threeCamera);
                console.log('✓ Shader pre-compilati');
            }
        } catch(e) {
            console.warn('Three.js init failed, 2D fallback:', e);
        }
    }

    initAudio();
    // Browser blocks audio before first click — start music on first interaction
    function _startMusicOnClick() {
        document.removeEventListener('click', _startMusicOnClick);
        document.removeEventListener('keydown', _startMusicOnClick);
        if (typeof startMenuMusic === 'function') startMenuMusic();
    }
    document.addEventListener('click', _startMusicOnClick);
    document.addEventListener('keydown', _startMusicOnClick);
    if (typeof initSidePanelTabs === 'function') initSidePanelTabs();
    if (typeof initAvatarInput === 'function') initAvatarInput();
    if (typeof initCommandUI === 'function') initCommandUI();
    if (typeof initPauseMenu === 'function') initPauseMenu();
    if (typeof initSidePanelCollapse === 'function') initSidePanelCollapse();
    if (typeof initDragGhostFeedback === 'function') initDragGhostFeedback();

    document.getElementById('btn-start').addEventListener('click', function() {
        startNewGame();
    });

    document.getElementById('btn-continue').addEventListener('click', function() {
        hideOverlay('result-overlay');
        advanceRound();
    });

    document.getElementById('btn-restart').addEventListener('click', function() {
        hideOverlay('gameover-overlay');
        showOverlay('menu-overlay');
        // Hide in-game UI elements
        var hud = document.getElementById('hud');
        var bench = document.getElementById('bench-panel');
        var toolbar = document.getElementById('icon-toolbar');
        var sidePanel = document.getElementById('side-panel');
        if (hud) hud.classList.remove('active');
        if (bench) bench.classList.remove('active');
        if (toolbar) toolbar.classList.remove('active');
        if (sidePanel) sidePanel.classList.remove('active');
        var synBar = document.getElementById('hud-synergy-bar');
        if (synBar) synBar.classList.remove('active');
        if (typeof startMenuMusic === 'function') startMenuMusic();
    });

    document.getElementById('btn-ready').addEventListener('click', function() {
        onPlayerReady();
    });

    setupTooltip();
    setupBoardInteraction();
    setupCombatSpeedToggle();

    var lastTime = performance.now();
    function gameLoop(now) {
        var dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;
        renderFrame(dt);
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Seeded RNG initialization ---
function initSeededRng(seed) {
    // Linear Congruential Generator (deterministic, seeded RNG)
    var m = 2147483647; // 2^31 - 1
    var a = 16807;
    var rngState = seed ? (seed % m) : Math.floor(Math.random() * (m - 1)) + 1;

    window.globalRngState = rngState;
    window.globalRngSeed = seed;
    window._originalMathRandom = window._originalMathRandom || Math.random;

    Math.random = function() {
        rngState = (a * rngState) % m;
        return rngState / m;
    };

    console.log('[RNG] Initialized with seed:', seed);
}

function restoreOriginalRng() {
    if (window._originalMathRandom) {
        Math.random = window._originalMathRandom;
        console.log('[RNG] Restored original Math.random()');
    }
}

// --- Start a new game ---
// --- Loading screen with real preloading ---
function showLoadingScreen(onComplete) {
    hideAllOverlays();
    showOverlay('loading-overlay');
    var bar = document.getElementById('loading-bar');
    var txt = document.getElementById('loading-text');
    var progress = 0;

    function _set(pct, msg) {
        progress = pct;
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = msg;
    }

    _set(5, 'Inizializzazione...');

    setTimeout(function() {
        _set(15, 'Caricamento shader...');
        if (typeof preWarmCharacterShaders === 'function') preWarmCharacterShaders();

        setTimeout(function() {
            _set(35, 'Preparazione unita...');

            setTimeout(function() {
                _set(55, 'Caricamento modelli 3D...');
                if (typeof preWarmRound3D === 'function') preWarmRound3D();

                setTimeout(function() {
                    _set(75, 'Caricamento ambiente...');

                    setTimeout(function() {
                        _set(90, 'Quasi pronto...');

                        setTimeout(function() {
                            _set(100, 'Pronto!');
                            setTimeout(function() {
                                hideOverlay('loading-overlay');
                                if (onComplete) onComplete();
                            }, 400);
                        }, 300);
                    }, 400);
                }, 500);
            }, 400);
        }, 300);
    }, 200);
}

function startNewGame() {
    if (typeof stopMenuMusic === 'function') stopMenuMusic();
    hideAllOverlays();
    playPhaseSound();

    // Clear buildings from previous game (buildings.js hook can't override this function declaration)
    if (typeof clearAllBuildings3D === 'function') clearAllBuildings3D();
    if (typeof _exitBldPlacement === 'function') _exitBldPlacement();
    var _bl = document.getElementById('building-list');
    if (_bl) _bl.innerHTML = '';

    // Initialize seeded RNG if shared seed exists (multiplayer)
    var sharedSeed = window.lobbySharedSeed;
    if (sharedSeed) {
        console.log('[Game] Using shared seed:', sharedSeed);
        window._singlePlayerMode = false;
        initSeededRng(sharedSeed);
    } else {
        console.log('[Game] Single-player mode (no shared seed)');
        window._singlePlayerMode = true;
        restoreOriginalRng();
    }

    currentRound = 0;
    combatTick = 0;
    combatUnits = [];
    combatTeams = {};
    damageNumbers = [];
    combatEffects = [];
    combatLog = [];
    combatResult = null;
    combatEliminations = [];
    readyPlayers = new Set();
    nextUnitId = 1;
    globalDungeonBossKills = { NW: 0, NE: 0, SW: 0, SE: 0 };

    initPool();

    // Create 4 players
    // IMPORTANT: players[0] is ALWAYS the local human player (UI is hardcoded for slot 0)
    // In multiplayer, we remap server slots so MY slot always becomes local slot 0
    players = [];
    var assignments = window.lobbyPlayerAssignments;

    // Build slot order: [myServerSlot, ...others]
    // serverToLocal[serverSlot] = localSlot
    // localToServer[localSlot] = serverSlot
    window.serverToLocal = {};
    window.localToServer = {};

    if (assignments && window.lobbyPlayerId) {
        // Find my server slot
        var myServerSlot = null;
        for (var i = 0; i < assignments.length; i++) {
            if (assignments[i].type === 'human' && assignments[i].clientId === window.lobbyPlayerId) {
                myServerSlot = assignments[i].slotId;
                break;
            }
        }
        window.mySlotId = myServerSlot;

        // Build remapping: my server slot → local 0, rest in order
        if (myServerSlot !== null) {
            window.localToServer[0] = myServerSlot;
            window.serverToLocal[myServerSlot] = 0;
            var nextLocal = 1;
            for (var i = 0; i < 4; i++) {
                if (i !== myServerSlot) {
                    window.localToServer[nextLocal] = i;
                    window.serverToLocal[i] = nextLocal;
                    nextLocal++;
                }
            }
        }
    }

    console.log('[Game] mySlotId:', window.mySlotId, 'serverToLocal:', JSON.stringify(window.serverToLocal));

    // Rotate camera to face the board from this player's base perspective
    var myServerSlotForCamera = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
    if (typeof applyCameraRotationForSlot === 'function') {
        applyCameraRotationForSlot(myServerSlotForCamera);
    }

    // Create players in LOCAL slot order
    // CRITICAL: p.serverSlot = fixed slot for deploy zone + team color (same on all clients)
    for (var localSlot = 0; localSlot < 4; localSlot++) {
        var p = createPlayerState(localSlot, localSlot === 0);
        var serverSlot = (window.localToServer[localSlot] !== undefined) ? window.localToServer[localSlot] : localSlot;
        p.serverSlot = serverSlot; // FIXED slot — consistent across all clients

        if (assignments && assignments[serverSlot]) {
            var assignment = assignments[serverSlot];
            if (localSlot === 0) {
                p.name = 'Tu';
                p.isHuman = true;
            } else if (assignment.type === 'human') {
                p.name = assignment.name || ('Giocatore ' + (serverSlot + 1));
                p.isHuman = true;
            } else {
                p.name = assignment.name || ('AI ' + (serverSlot + 1));
                p.isHuman = false;
            }
        } else {
            // Single-player fallback
            if (localSlot === 0) p.name = 'Tu';
            else {
                var aiNames = { 1: 'Drago Rosso', 2: 'Lupo Verde', 3: 'Falco Arancio' };
                p.name = aiNames[localSlot] || ('AI ' + localSlot);
            }
            p.isHuman = (localSlot === 0);
            p.serverSlot = localSlot; // single-player: serverSlot = localSlot
        }

        console.log('[Game] Local ' + localSlot + ' (server ' + serverSlot + '): ' + p.name + ' [deploy zone ' + p.serverSlot + ']');
        players.push(p);
    }

    // AI avatars only for non-human slots
    for (var i = 1; i < players.length; i++) {
        if (!players[i].isHuman && typeof createAvatar === 'function' && typeof aiPickAvatarClass === 'function') {
            players[i].avatar = createAvatar(aiPickAvatarClass(), players[i].serverSlot);
        }
    }

    // Pre-compila gli shader 3D per tutti i personaggi prima che il giocatore piazzi unità
    if (typeof preWarmCharacterShaders === 'function') {
        setTimeout(preWarmCharacterShaders, 300); // lieve delay per lasciare caricare la scena
    }

    // Human class selection then loading screen then start
    if (typeof showClassSelection === 'function') {
        showClassSelection(function(classId) {
            var myLocalSlot = 0;
            var myServerSlotForAvatar = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
            players[myLocalSlot].avatar = createAvatar(classId, myServerSlotForAvatar);

            if (typeof lobbySocket !== 'undefined' && lobbySocket && lobbySocket.readyState === 1 && !window._singlePlayerMode) {
                lobbySocket.send(JSON.stringify({ type: 'player_avatar', avatar: classId }));
            }

            // Show loading screen — preload everything, then start
            showLoadingScreen(function() {
                if (typeof stopMenuMusic === 'function') stopMenuMusic();
                advanceRound();
            });
        });
    } else {
        showLoadingScreen(function() {
            if (typeof stopMenuMusic === 'function') stopMenuMusic();
            advanceRound();
        });
    }
}

// --- Advance to the next round ---
function advanceRound() {
    stopCombatAnimation();

    currentRound++;
    if (currentRound > TOTAL_PVP_ROUNDS) {
        endGame();
        return;
    }

    // Check eliminations
    for (var i = 0; i < players.length; i++) {
        checkElimination(players[i]);
    }

    // Game over: only 1 player left
    var alive = players.filter(function(p) { return !p.eliminated; });
    if (alive.length <= 1) {
        endGame();
        return;
    }

    // Economy phase
    for (var i = 0; i < players.length; i++) {
        if (players[i].eliminated) continue;
        applyMaintenanceCost(players[i]);
        applyBaseIncome(players[i]);
        applyBabidiIncome(players[i]);
        applyElisir(players[i]);
        // Center control income (+1g per unit in center)
        if (typeof applyCenterControlIncome === 'function') {
            var centerCount = applyCenterControlIncome(players[i]);
            if (centerCount > 0 && players[i].index === 0 && typeof showToast === 'function') {
                showToast('Controllo centro: +' + centerCount + 'g (' + centerCount + ' unita)', 'gold', '⭐');
            }
        }
        // Tick skill cooldowns
        if (typeof tickSkillCooldowns === 'function') tickSkillCooldowns(players[i]);
        // Survival income
        if (typeof applySurvivalIncome === 'function') applySurvivalIncome(players[i]);
        // Respawn dead units
        if (typeof respawnDeadUnits === 'function') respawnDeadUnits(players[i]);
        // Respawn avatar
        if (typeof respawnAvatar === 'function') respawnAvatar(players[i]);
        // Clear triggered traps
        if (players[i].activeTraps) {
            players[i].activeTraps = players[i].activeTraps.filter(function(t) { return !t.triggered; });
        }
        // Building passive income (gold per round, etc.)
        if (typeof applyBuildingPassives === 'function') applyBuildingPassives(players[i]);
    }

    // Building shop every 5 rounds — before draft/planning
    if (typeof isBuildingRound === 'function' && isBuildingRound(currentRound)) {
        beginBuildingShopPhase(function() {
            if (PVE_ROUNDS.indexOf(currentRound) >= 0) {
                beginPlanningPhase();
            } else {
                beginDraftPhase();
            }
        });
        return;
    }

    // Draft or straight to planning
    if (PVE_ROUNDS.indexOf(currentRound) >= 0) {
        beginPlanningPhase();
    } else {
        beginDraftPhase();
    }
}

// =============================================
// DRAFT PHASE
// =============================================
function beginDraftPhase() {
    gamePhase = PHASE_DRAFT;
    playDraftSound();
    if (typeof showPhaseBannerForPhase === 'function') showPhaseBannerForPhase('draft');

    var planningActions = document.getElementById('planning-actions');
    if (planningActions) planningActions.classList.remove('active');

    // AI draft (instant) — ONLY for AI players, skip remote humans
    for (var i = 1; i < players.length; i++) {
        if (players[i].eliminated) continue;
        if (players[i].isHuman) continue; // remote human — their client handles their draft
        var aiCards = performDraft(players[i]);
        if (aiCards && aiCards.length > 0) {
            var choice = aiDraftChoice(players[i], aiCards);
            processDraftChoice(players[i], aiCards, choice);
            aiPlayTurn(players[i]);
        }
    }

    // Human draft
    var humanPlayer = players[0];
    var humanCards = performDraft(humanPlayer);
    if (!humanCards || humanCards.length === 0) {
        beginPlanningPhase();
        return;
    }

    showDraftCards(humanCards, function(chosenIndex) {
        if (chosenIndex === -99) {
            // Already processed by sell+redraft system
            hideOverlay('draft-overlay');
            beginPlanningPhase();
            return;
        }
        hideOverlay('draft-overlay');
        playGoldSound();
        if (chosenIndex === -1) {
            // Refuse: return all cards to pool, gain 1 gold
            for (var ri = 0; ri < humanCards.length; ri++) {
                returnCardToPool(humanCards[ri]);
            }
            addGold(players[0], 1, true);
        } else {
            processDraftChoice(players[0], humanCards, chosenIndex);
        }
        beginPlanningPhase();
    });
}

// =============================================
// PLANNING PHASE — place units, then press "Pronto!"
// =============================================
function beginPlanningPhase() {
    gamePhase = PHASE_PLANNING;
    playPhaseSound();
    hideAllOverlays();
    if (typeof showPhaseBannerForPhase === 'function') showPhaseBannerForPhase('planning');
    if (typeof hideUnitInfoCard === 'function') hideUnitInfoCard();
    if (typeof clearFieldSelection === 'function') clearFieldSelection();
    if (typeof clearBenchSelection === 'function') clearBenchSelection();

    var hud = document.getElementById('hud');
    var bench = document.getElementById('bench-panel');
    var toolbar = document.getElementById('icon-toolbar');
    var planningActions = document.getElementById('planning-actions');
    var combatControls = document.getElementById('combat-controls');

    if (hud) hud.classList.add('active');
    if (bench) bench.classList.add('active');
    if (toolbar) toolbar.classList.add('active');
    if (planningActions) planningActions.classList.add('active');
    if (combatControls) combatControls.classList.remove('active');

    // Auto-place human units
    autoPlaceNewUnits(players[0]);

    updateHUD(players[0], currentRound);
    updateBench(players[0]);
    if (typeof updateUnitRoster === 'function') updateUnitRoster(players[0]);
    updateSidePanel(players, typeof detectSynergies === 'function' ? detectSynergies(players[0]) : []);

    // No timer — combat starts only when player presses "Pronto!"

    // Pan camera back to player's base (zoomed in on deploy zone)
    if (typeof panCameraToPlayerBase === 'function') {
        panCameraToPlayerBase();
    }
    // Force tactical view for planning (ortho camera)
    if (typeof _tacticalView !== 'undefined') {
        _tacticalView = true;
    }
}

// Auto-place bench units onto deploy zone (cell-array based)
function autoPlaceNewUnits(player) {
    var pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index;
    var zone = getDeployZone(pSlot);
    if (!zone || !zone.cells || zone.cells.length === 0) return;

    var center = getBoardCenter();
    var sortedCells = zone.cells.slice().sort(function(a, b) {
        var dA = chebyshevDist(a.r, a.c, center.r, center.c);
        var dB = chebyshevDist(b.r, b.c, center.r, center.c);
        return dA - dB;
    });

    while (player.benchUnits.length > 0 && player.fieldUnits.length < player.unlockedFieldSlots) {
        var unit = player.benchUnits.shift();
        var placed = false;

        var cells = (unit.range <= 1) ? sortedCells : sortedCells.slice().reverse();

        for (var i = 0; i < cells.length && !placed; i++) {
            var cell = cells[i];
            var occupied = !!findPlayerUnitAtCell(player, cell.r, cell.c);
            if (!occupied) {
                unit.row = cell.r;
                unit.col = cell.c;
                unit.px = 0; unit.py = 0;
                placed = true;
            }
        }
        if (placed) {
            player.fieldUnits.push(unit);
            // Spawn 3D model immediately
            if (typeof spawnUnitModel3D === 'function' && typeof threeUnitModels !== 'undefined' && !threeUnitModels[unit.id]) {
                spawnUnitModel3D(unit);
            }
            if (typeof showToast === 'function') {
                showToast(unit.charId + ' piazzato in campo!', 'success');
            }
        } else {
            player.benchUnits.unshift(unit);
            console.warn('[autoPlace] ✗ Could not place ' + unit.charId + '!');
            break;
        }
    }
}

// =============================================
// PLAYER READY — when human presses "Pronto!", start combat
// =============================================
function onPlayerReady() {
    stopPlanningTimer();

    var planningActions = document.getElementById('planning-actions');
    if (planningActions) planningActions.classList.remove('active');

    // AI places units — ONLY for AI players, skip remote humans
    for (var i = 1; i < players.length; i++) {
        if (players[i].eliminated) continue;
        if (players[i].isHuman) continue; // remote human — units come from server sync
        aiPlaceUnits(players[i]);
    }

    // MULTIPLAYER: Send units to server and wait for start_combat
    if (typeof lobbySocket !== 'undefined' && lobbySocket && lobbySocket.readyState === 1 && !window._singlePlayerMode) {
        var myPlayer = players[0]; // players[0] is always the local human

        // Serialize own field units + militia + structures + avatar
        var allMyUnits = (myPlayer.fieldUnits || []).concat(myPlayer.militiaUnits || []).concat(myPlayer.structures || []);
        if (myPlayer.avatar && myPlayer.avatar.alive && !myPlayer.avatar._needsRespawn) {
            allMyUnits.push(myPlayer.avatar);
        }
        var unitsToSend = allMyUnits.map(function(u) {
            return { charId: u.charId, star: u.star, row: u.row, col: u.col, items: u.items || [],
                     learnedSkills: u.learnedSkills || {}, equippedSkills: u.equippedSkills || [],
                     isAvatar: !!u.isAvatar, avatarClass: u.avatarClass || null,
                     militiaType: u.militiaType || null,
                     isStructure: !!u.isStructure, structureType: u.structureType || null,
                     structureCharId: u.structureCharId || null,
                     hp: u.hp, maxHp: u.maxHp, atk: u.atk, armor: u.armor,
                     range: u.range, atkSpeed: u.atkSpeed, level: u.level || 1 };
        });

        console.log('[Game] Sending ' + unitsToSend.length + ' units + player_ready to server');
        lobbySocket.send(JSON.stringify({
            type: 'player_ready',
            units: unitsToSend
        }));
        return;
    }

    // SINGLE-PLAYER: Advance immediately
    console.log('[Game] Single-player: advancing round immediately');
    _proceedToNextPhase();
}

function _proceedToNextPhase() {
    // Start combat (PvE or FFA PvP)
    if (PVE_ROUNDS.indexOf(currentRound) >= 0) {
        beginPvECombat();
    } else {
        beginCombatPhase();
    }
}

// Apply units from all players received from server, then start combat
function applyServerUnitsAndStartCombat(allUnits) {
    if (!allUnits) return;

    var myServerSlot = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
    var s2l = window.serverToLocal || {};
    console.log('[MP-DEBUG] applyServerUnits: mySlot=' + myServerSlot + ' s2l=' + JSON.stringify(s2l) + ' allUnits keys=' + Object.keys(allUnits) + ' round=' + currentRound);

    for (var serverSlotStr in allUnits) {
        var serverSlot = parseInt(serverSlotStr);
        if (serverSlot === myServerSlot) continue; // keep own units as-is (already in players[0])

        // Map server slot → local slot
        var localSlot = (s2l[serverSlot] !== undefined) ? s2l[serverSlot] : serverSlot;
        if (!players[localSlot] || players[localSlot].eliminated) continue;

        var serverUnits = allUnits[serverSlotStr] || [];
        var remoteFieldUnits = [];
        var remoteMilitia = [];
        var remoteStructures = [];
        var remoteAvatar = null;

        console.log('[MP-DEBUG] Processing slot ' + serverSlot + '→local' + localSlot + ', ' + serverUnits.length + ' units to process');
        for (var j = 0; j < serverUnits.length; j++) {
            var u = serverUnits[j];
            console.log('[MP-DEBUG]   unit[' + j + ']: charId=' + u.charId + ' isAvatar=' + u.isAvatar + ' militiaType=' + u.militiaType + ' star=' + u.star + ' row=' + u.row + ' col=' + u.col + ' inCHARACTERS=' + !!CHARACTERS[u.charId]);
            if (u.isAvatar && u.avatarClass) {
                // Rebuild avatar for remote player
                if (!players[localSlot].avatar) {
                    players[localSlot].avatar = createAvatar(u.avatarClass, serverSlot);
                }
                var av = players[localSlot].avatar;
                av.row = u.row; av.col = u.col;
                av.hp = u.hp || av.hp; av.maxHp = u.maxHp || av.maxHp;
                av.atk = u.atk || av.atk; av.level = u.level || av.level;
                var avPos = cellToPixel(u.row, u.col);
                av.px = avPos.x; av.py = avPos.y;
                remoteAvatar = av;
            } else if (u.isStructure && u.structureCharId && typeof createStructureUnit === 'function') {
                var sUnit = createStructureUnit(u.structureCharId, u.structureType, serverSlot, u.row, u.col);
                if (sUnit) {
                    sUnit.items = u.items || [];
                    sUnit.hp = u.hp || sUnit.hp;
                    var sPos = cellToPixel(u.row, u.col);
                    sUnit.px = sPos.x; sUnit.py = sPos.y;
                    remoteStructures.push(sUnit);
                }
            } else if (u.militiaType) {
                var mUnit = (typeof createMilitiaUnit === 'function')
                    ? createMilitiaUnit(u.militiaType, serverSlot, u.row, u.col)
                    : null;
                if (!mUnit) continue; // skip unknown militia type
                mUnit.items = u.items || [];
                var mPos = cellToPixel(u.row, u.col);
                mUnit.px = mPos.x; mUnit.py = mPos.y;
                remoteMilitia.push(mUnit);
            } else {
                if (!CHARACTERS[u.charId]) {
                    console.warn('[MP] Unknown charId: ' + u.charId + ', skipping');
                    continue;
                }
                var unit = createUnit(u.charId, u.star, serverSlot, u.row, u.col);
                unit.items = u.items || [];
                if (u.learnedSkills) unit.learnedSkills = u.learnedSkills;
                if (u.equippedSkills) unit.equippedSkills = u.equippedSkills;
                var pos = cellToPixel(u.row, u.col);
                unit.px = pos.x; unit.py = pos.y;
                remoteFieldUnits.push(unit);
            }
        }

        players[localSlot].fieldUnits = remoteFieldUnits;
        if (remoteMilitia.length > 0) players[localSlot].militiaUnits = remoteMilitia;
        if (remoteStructures.length > 0) players[localSlot].structures = remoteStructures;
        console.log('[MP-DEBUG] Slot ' + serverSlot + '→local' + localSlot + ': ' + serverUnits.length + ' raw, ' + remoteFieldUnits.length + ' field, ' + remoteMilitia.length + ' militia, avatar=' + (remoteAvatar ? remoteAvatar.avatarClass : 'NONE'));
        console.log('[MP-DEBUG] Raw units received:', JSON.stringify(serverUnits.map(function(u){return {charId:u.charId, isAvatar:u.isAvatar, militiaType:u.militiaType, row:u.row, col:u.col};})));
    }

    // AI slots with no data: place AI units
    for (var i = 1; i < players.length; i++) {
        var serverSlotForI = (window.localToServer && window.localToServer[i] !== undefined) ? window.localToServer[i] : i;
        if (!players[i].isHuman && !allUnits[serverSlotForI] && !players[i].eliminated) {
            aiPlaceUnits(players[i]);
        }
    }

    _proceedToNextPhase();
}

// Update player data from server (multiplayer sync)
function updatePlayersFromServer(gameState) {
    if (!gameState || !gameState.players) return;
    var s2l = window.serverToLocal || {};

    for (var i = 0; i < gameState.players.length; i++) {
        var serverData = gameState.players[i];
        var serverSlot = serverData.slotId;

        // Map server slot → local slot (accounts for remapping)
        var localSlot;
        if (serverSlot !== undefined && s2l[serverSlot] !== undefined) {
            localSlot = s2l[serverSlot];
        } else {
            localSlot = i; // fallback
        }

        if (!players[localSlot]) continue;

        // Skip own player — don't overwrite local data with server echo
        var myServerSlot = window.mySlotId;
        if (myServerSlot !== null && myServerSlot !== undefined && serverSlot === myServerSlot) continue;

        var localPlayer = players[localSlot];

        if (serverData.avatar && !localPlayer.avatar) {
            var avatarSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(localPlayer) : localSlot;
            localPlayer.avatar = createAvatar(serverData.avatar, avatarSlot);
            console.log('[Game] Received avatar for local ' + localSlot + ' (server ' + serverSlot + '): ' + serverData.avatar);
        }

        if (serverData.placement) {
            localPlayer.fieldUnits = serverData.units || [];
            console.log('[Game] Received ' + localPlayer.fieldUnits.length + ' units for local ' + localSlot + ' (server ' + serverSlot + ')');
        }
    }
}

// =============================================
// PvE COMBAT — all players vs shared creep
// =============================================
function beginPvECombat() {
    gamePhase = PHASE_COMBAT;
    if (typeof _fpvCamSnapped !== 'undefined') { _fpvCamSnapped = false; }
    if (typeof showPhaseBannerForPhase === 'function') showPhaseBannerForPhase('pve');
    if (typeof initCombatLog === 'function') initCombatLog();
    playPhaseSound();

    var planningActions = document.getElementById('planning-actions');
    var combatControls = document.getElementById('combat-controls');
    if (planningActions) planningActions.classList.remove('active');
    if (combatControls) combatControls.classList.add('active');

    updateHUD(players[0], currentRound);

    var creepDef = null;
    for (var i = 0; i < CREEPS.length; i++) {
        if (CREEPS[i].round === currentRound) {
            creepDef = CREEPS[i];
            break;
        }
    }

    if (!creepDef) {
        beginResultPhase({ winner: null, survivors: {}, teamHp: {}, eliminations: [] });
        return;
    }

    // Scale creep HP based on number of alive players
    var alivePlayers = players.filter(function(p) { return !p.eliminated; });
    var scaledDef = deepClone(creepDef);
    scaledDef.hp = Math.round(creepDef.hp * alivePlayers.length * 0.7); // 70% per player

    // Spawn creep(s) at center of board
    var center = getBoardCenter();
    var creepUnits = [];
    var c1 = createCreepUnit(scaledDef, center.r, center.c);
    var pos1 = cellToPixel(c1.row, c1.col);
    c1.px = pos1.x; c1.py = pos1.y;
    creepUnits.push(c1);

    // Spawn camp creeps on diagonals
    var campCreeps = spawnCampCreeps(currentRound);

    // Spawn dungeon bosses at corners
    var dungeonBosses = spawnDungeonBosses(globalDungeonBossKills);

    // Merge dungeon bosses with camp creeps
    for (var bKey in dungeonBosses) {
        campCreeps[bKey] = dungeonBosses[bKey];
    }

    // Init FFA combat: all alive players + creep + camps + bosses
    var combatState = initCombat(alivePlayers, creepUnits, campCreeps);
    if (typeof preWarmRound3D === 'function') preWarmRound3D();
    startCombatAnimation(combatState);
}

// =============================================
// PvP COMBAT — all 4 players FFA on same board
// =============================================
function beginCombatPhase() {
    gamePhase = PHASE_COMBAT;
    // Switch to avatar FPV camera for combat
    if (typeof _tacticalView !== 'undefined') { _tacticalView = false; }
    // Reset camera snap so it repositions behind avatar each combat
    if (typeof _fpvCamSnapped !== 'undefined') { _fpvCamSnapped = false; }
    playPhaseSound();
    if (typeof showPhaseBannerForPhase === 'function') showPhaseBannerForPhase('combat');
    if (typeof initCombatLog === 'function') initCombatLog();

    var planningActions = document.getElementById('planning-actions');
    var combatControls = document.getElementById('combat-controls');
    if (planningActions) planningActions.classList.remove('active');
    if (combatControls) combatControls.classList.add('active');

    updateHUD(players[0], currentRound);

    // All alive players fight on the same board
    var alivePlayers = players.filter(function(p) { return !p.eliminated; });

    if (alivePlayers.length < 2) {
        endGame();
        return;
    }

    // Spawn camp creeps on diagonals
    var campCreeps = spawnCampCreeps(currentRound);

    // Spawn dungeon bosses at corners
    var dungeonBosses = spawnDungeonBosses(globalDungeonBossKills);

    // Merge dungeon bosses with camp creeps
    for (var bKey in dungeonBosses) {
        campCreeps[bKey] = dungeonBosses[bKey];
    }

    // DEBUG: log all players' field units before initCombat
    for (var _dbg = 0; _dbg < alivePlayers.length; _dbg++) {
        var _dp = alivePlayers[_dbg];
        console.log('[MP-DEBUG] PRE-initCombat player[' + _dp.index + '] ' + _dp.name + ': fieldUnits=' + (_dp.fieldUnits||[]).length + ' → ' + (_dp.fieldUnits||[]).map(function(u){return u.charId;}).join(',') + ' | militia=' + (_dp.militiaUnits||[]).length + ' | avatar=' + (_dp.avatar ? _dp.avatar.avatarClass : 'NONE'));
    }

    var combatState = initCombat(alivePlayers, null, campCreeps);

    // DEBUG: log combatUnits count per team
    for (var _tk in combatState.teams) {
        console.log('[MP-DEBUG] POST-initCombat team ' + _tk + ': ' + combatState.teams[_tk].length + ' units');
    }

    if (typeof preWarmRound3D === 'function') preWarmRound3D();
    startCombatAnimation(combatState);
}

// --- Start combat animation ---
function startCombatAnimation(combatState) {
    var teams = combatState.teams;
    var grid = combatState.grid;

    combatTeams = teams;
    combatUnits = [];
    for (var key in teams) {
        for (var i = 0; i < teams[key].length; i++) {
            combatUnits.push(teams[key][i]);
        }
    }

    // Initialize pixel positions
    for (var i = 0; i < combatUnits.length; i++) {
        var u = combatUnits[i];
        var pos = cellToPixel(u.row, u.col);
        u.px = pos.x;
        u.py = pos.y;
    }

    // Determine if this client is the combat authority (host or single-player)
    var _isCombatHost = !!(window._singlePlayerMode || typeof lobbyIsHost === 'undefined' || lobbyIsHost);

    function _combatTickLoop() {
        if (!_isCombatHost) {
            // Non-host: don't run combat tick, just keep the loop alive for render
            combatAnimInterval = setTimeout(_combatTickLoop, COMBAT_ANIM_TICK_MS / combatSpeedMultiplier);
            return;
        }

        var result = runCombatTick(teams, grid);

        // HOST: broadcast combat snapshot to server for relay to other clients
        if (!window._singlePlayerMode && typeof lobbySocket !== 'undefined' && lobbySocket && lobbySocket.readyState === 1) {
            var snapshot = {
                type: 'combat_snapshot',
                tick: typeof combatTick !== 'undefined' ? combatTick : 0,
                units: combatUnits.map(function(u) {
                    return {
                        id: u.id, charId: u.charId, owner: u.owner,
                        row: u.row, col: u.col,
                        hp: u.hp, maxHp: u.maxHp,
                        alive: u.alive,
                        wx: u._smoothWX !== undefined ? u._smoothWX : u.wx,
                        wz: u._smoothWZ !== undefined ? u._smoothWZ : u.wz,
                        shield: u.shield || 0,
                        targetUnitId: u.targetUnitId || null,
                        facing: u.facing || 0,
                        isStopped: !!u.isStopped,
                        effects: (u.effects && u.effects.length > 0) ? u.effects.map(function(e) {
                            return { type: e.type, value: e.value || 0, ticksLeft: e.ticksLeft || 0 };
                        }) : []
                    };
                }),
                result: result || null
            };
            lobbySocket.send(JSON.stringify(snapshot));
        }

        if (result) {
            combatAnimInterval = null;
            combatResult = result;
            setTimeout(function() {
                beginResultPhase(result);
            }, 800);
        } else {
            combatAnimInterval = setTimeout(_combatTickLoop, COMBAT_ANIM_TICK_MS / combatSpeedMultiplier);
        }
    }
    combatAnimInterval = setTimeout(_combatTickLoop, COMBAT_ANIM_TICK_MS / combatSpeedMultiplier);
}

// --- Stop combat animation ---
function stopCombatAnimation() {
    if (combatAnimInterval) {
        clearTimeout(combatAnimInterval);
        combatAnimInterval = null;
    }
}

// =============================================
// RESULT PHASE — process FFA results
// =============================================
function beginResultPhase(result) {
    gamePhase = PHASE_RESULT;
    stopCombatAnimation();

    var human = players[0];
    var isPvE = PVE_ROUNDS.indexOf(currentRound) >= 0;
    var title = '';
    var details = '';
    var titleClass = '';

    if (isPvE) {
        // PvE: check if creep is dead
        var creepSurvived = result.survivors['creep'] > 0;

        if (!creepSurvived) {
            title = 'VITTORIA vs Creep!';
            titleClass = 'result-win';

            // Award item drops to all surviving players
            var creepDef = null;
            for (var i = 0; i < CREEPS.length; i++) {
                if (CREEPS[i].round === currentRound) { creepDef = CREEPS[i]; break; }
            }

            if (creepDef) {
                var itemLines = [];
                for (var p = 0; p < players.length; p++) {
                    if (players[p].eliminated) continue;
                    var teamAlive = result.survivors[String(typeof getPlayerSlot==='function'?getPlayerSlot(players[p]):players[p].index)] || 0;
                    if (teamAlive > 0) {
                        var droppedItem = rollItemDrop(players[p], creepDef.tier);
                        if (droppedItem) {
                            players[p].inventory.push(droppedItem);
                            var itemDef = ITEMS[droppedItem];
                            if (p === 0) {
                                itemLines.push('Item ottenuto: ' + (itemDef ? itemDef.name : droppedItem));
                                playGoldSound();
                                if (typeof _autoSwitchTab === 'function') _autoSwitchTab('zaino');
                            }
                        }
                    }
                }
                details = itemLines.join('<br>');
            }
        } else {
            // Creep won (some/all player teams eliminated)
            var humanAlive = result.survivors[String(typeof getPlayerSlot==='function'?getPlayerSlot(human):human.index)] || 0;
            if (humanAlive > 0) {
                title = 'TEMPO SCADUTO vs Creep';
                titleClass = 'result-draw';
            } else {
                title = 'SCONFITTA vs Creep';
                titleClass = 'result-lose';
            }
            details = 'Nessun item ottenuto.';
        }

        // Damage to eliminated players in PvE
        for (var i = 0; i < result.eliminations.length; i++) {
            var elim = result.eliminations[i];
            if (elim.playerIdx === 'creep') continue;
            var dmg = calculateCombatDamage(currentRound, 1);
            var _ep = null;
            for (var _ei = 0; _ei < players.length; _ei++) {
                var _es = typeof getPlayerSlot === 'function' ? getPlayerSlot(players[_ei]) : players[_ei].index;
                if (_es === elim.playerIdx) { _ep = players[_ei]; break; }
            }
            if (_ep) applyCombatDamage(_ep, dmg);
        }

    } else {
        // PvP FFA results
        var winnerIdx = result.winner;
        var humanSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(human) : human.index;
        var humanWon = (winnerIdx === humanSlot);

        if (humanWon) {
            title = 'VITTORIA!';
            titleClass = 'result-win';
            applyPvpWinBonus(human);
            human.consecutiveWins++;
            applyWinStreakBonus(human);
        } else if (winnerIdx !== null && winnerIdx !== humanSlot) {
            // Someone else won
            var humanAlive = result.survivors[String(typeof getPlayerSlot==='function'?getPlayerSlot(human):human.index)] || 0;
            if (humanAlive > 0) {
                title = 'SOPRAVVISSUTO';
                titleClass = 'result-draw';
            } else {
                title = 'SCONFITTA';
                titleClass = 'result-lose';
                human.consecutiveWins = 0;
            }
        } else {
            title = 'PAREGGIO';
            titleClass = 'result-draw';
            human.consecutiveWins = 0;
        }

        // Apply damage to eliminated teams
        for (var i = 0; i < result.eliminations.length; i++) {
            var elim = result.eliminations[i];
            if (elim.playerIdx === 'creep') continue;
            var survCount = elim.survivorsAtTime || 1;
            var dmg = calculateCombatDamage(currentRound, survCount);
            var _ep = null;
            for (var _ei = 0; _ei < players.length; _ei++) {
                var _es = typeof getPlayerSlot === 'function' ? getPlayerSlot(players[_ei]) : players[_ei].index;
                if (_es === elim.playerIdx) { _ep = players[_ei]; break; }
            }
            if (_ep) applyCombatDamage(_ep, dmg);
        }

        // Winner gets PvP bonus — find winner by serverSlot
        if (winnerIdx !== null && typeof winnerIdx === 'number') {
            var winner = null;
            for (var wi = 0; wi < players.length; wi++) {
                if ((typeof getPlayerSlot === 'function' ? getPlayerSlot(players[wi]) : players[wi].index) === winnerIdx) {
                    winner = players[wi]; break;
                }
            }
            if (winner && winnerIdx !== humanSlot) {
                applyPvpWinBonus(winner);
                winner.consecutiveWins++;
                applyWinStreakBonus(winner);
            }
            // All losers reset streak
            for (var i = 0; i < players.length; i++) {
                var iSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(players[i]) : players[i].index;
                if (iSlot !== winnerIdx) {
                    players[i].consecutiveWins = 0;
                }
            }
        }

        // Build details
        var detailLines = [];
        // Show elimination order
        if (result.eliminations.length > 0) {
            detailLines.push('<b>Ordine eliminazione:</b>');
            for (var i = 0; i < result.eliminations.length; i++) {
                var e = result.eliminations[i];
                if (e.playerIdx === 'creep') continue;
                // Find player by serverSlot
                var elimPlayer = null;
                for (var ei = 0; ei < players.length; ei++) {
                    var eiSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(players[ei]) : players[ei].index;
                    if (eiSlot === e.playerIdx) { elimPlayer = players[ei]; break; }
                }
                if (!elimPlayer) continue;
                var pName = elimPlayer.name;
                var color = TEAM_COLORS[e.playerIdx] ? TEAM_COLORS[e.playerIdx].primary : '#fff';
                detailLines.push('<span style="color:' + color + '">' + escapeHtml(pName) + '</span> (tick ' + e.tick + ')');
            }
        }
        if (winnerIdx !== null && typeof winnerIdx === 'number' && winner) {
            var winColor = TEAM_COLORS[winnerIdx] ? TEAM_COLORS[winnerIdx].primary : '#fff';
            detailLines.push('<br><b>Vincitore: <span style="color:' + winColor + '">' + escapeHtml(winner.name) + '</span></b>');
        }
        details = detailLines.join('<br>');
    }

    // --- Persistence: save positions, survival bonuses ---
    if (typeof savePositionsAfterCombat === 'function' && combatTeams) {
        savePositionsAfterCombat(players, combatTeams);
    }
    // Militia persistence: save alive, remove dead
    if (typeof saveMilitiaAfterCombat === 'function' && combatTeams) {
        saveMilitiaAfterCombat(players, combatTeams);
    }
    // Structure persistence: save alive, remove destroyed
    if (typeof saveStructuresAfterCombat === 'function' && combatTeams) {
        saveStructuresAfterCombat(players, combatTeams);
    }
    // Avatar persistence + XP
    if (combatTeams) {
        for (var av = 0; av < players.length; av++) {
            if (players[av].eliminated) continue;
            if (typeof saveAvatarAfterCombat === 'function') saveAvatarAfterCombat(players[av], combatTeams);
            if (typeof awardAvatarCombatXP === 'function') awardAvatarCombatXP(players[av], result);
        }
    }
    if (typeof applySurvivalBonuses === 'function' && combatTeams) {
        for (var sp = 0; sp < players.length; sp++) {
            if (!players[sp].eliminated) applySurvivalBonuses(players[sp], combatTeams);
        }
    }
    // Pietra dell'Eternita: +5 gold for surviving units with this item
    if (combatTeams) {
        for (var pe = 0; pe < players.length; pe++) {
            if (players[pe].eliminated) continue;
            var peTeam = combatTeams[String(typeof getPlayerSlot==='function'?getPlayerSlot(players[pe]):players[pe].index)];
            if (!peTeam) continue;
            for (var pu = 0; pu < peTeam.length; pu++) {
                if (peTeam[pu].alive && peTeam[pu].items && peTeam[pu].items.indexOf('pietraDellEternita') !== -1) {
                    addGold(players[pe], 5, true);
                    combatLog.push(peTeam[pu].charId + ': Pietra dell\'Eternita +5g!');
                }
            }
        }
    }

    // Drop consumables from PvE
    if (isPvE && typeof rollConsumableDrop === 'function') {
        for (var cp = 0; cp < players.length; cp++) {
            if (players[cp].eliminated) continue;
            var teamAlive = result.survivors[String(typeof getPlayerSlot==='function'?getPlayerSlot(players[cp]):players[cp].index)] || 0;
            if (teamAlive > 0) {
                var drop = rollConsumableDrop(currentRound <= 15 ? 1 : (currentRound <= 30 ? 2 : 3));
                players[cp].consumables.push(drop);
                if (cp === 0) details += '<br>Consumabile: ' + (CONSUMABLES[drop] ? CONSUMABLES[drop].name : drop);
            }
        }
    }

    // Check human elimination
    if (checkElimination(human)) {
        endGame();
        return;
    }

    updateHUD(human, currentRound);
    if (typeof updateUnitRoster === 'function') updateUnitRoster(human);
    updateSidePanel(players, typeof detectSynergies === 'function' ? detectSynergies(human) : []);

    showResult(title, details, titleClass);
}

// --- End the game ---
function endGame() {
    gamePhase = PHASE_GAME_OVER;
    stopCombatAnimation();
    stopPlanningTimer();

    var alive = players.filter(function(p) { return !p.eliminated; });
    var winner = null;

    if (alive.length === 1) {
        winner = alive[0];
    } else if (alive.length > 1) {
        alive.sort(function(a, b) { return b.totalGoldEarned - a.totalGoldEarned; });
        winner = alive[0];
    } else {
        var sorted = players.slice().sort(function(a, b) { return b.totalGoldEarned - a.totalGoldEarned; });
        winner = sorted[0];
    }

    playPhaseSound();
    showGameOver(winner, players);
}

// --- Fullscreen toggle ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function() {});
    } else {
        document.exitFullscreen().catch(function() {});
    }
}
document.addEventListener('fullscreenchange', function() {
    var btn = document.getElementById('btn-fullscreen');
    if (btn) btn.textContent = document.fullscreenElement ? '\u2716' : '\u26F6';
    if (typeof resizeCanvas === 'function') setTimeout(resizeCanvas, 100);
});

// --- Start on window load ---
window.addEventListener('load', function() {
    // Delay init to ensure all scripts are fully loaded (GLTFLoader, etc)
    setTimeout(init, 500);
});
