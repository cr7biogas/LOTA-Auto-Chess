// ============================================================
// LOTA AUTO CHESS — buildings.js — Building System
// Purchasable structures, placed on board, permanent effects
// ============================================================

// ---- Building definitions ----
var BUILDINGS = {
    zecca: {
        id: 'zecca', name: 'Zecca del Re',
        desc: '+1 Oro ogni turno (passiva).',
        lore: 'Conia monete d\'oro puro per il tuo tesoro reale.',
        cost: 3, effect: 'gold_per_round', value: 1,
        color: '#f59e0b', icon: '🏛', maxOwned: 3,
    },
    caserma: {
        id: 'caserma', name: 'Caserma',
        desc: 'A inizio combattimento: +20% ATK a tutte le unità alleate.',
        lore: 'Guerrieri allenati qui colpiscono con più forza.',
        cost: 5, effect: 'ally_atk_bonus', value: 0.20,
        color: '#ef4444', icon: '⚔️', maxOwned: 2,
    },
    altare: {
        id: 'altare', name: 'Altare della Forza',
        desc: 'A inizio combattimento: scudo 10% MaxHP per tutte le unità.',
        lore: 'La pietra sacra protegge i tuoi campioni.',
        cost: 5, effect: 'ally_shield_start', value: 0.10,
        color: '#a855f7', icon: '⛩️', maxOwned: 2,
    },
    torreArcana: {
        id: 'torreArcana', name: 'Torre Arcana',
        desc: 'A inizio combattimento: -5% HP correnti a ogni nemico (magia pura).',
        lore: 'Raggi arcani decimano le file nemiche prima dell\'assalto.',
        cost: 6, effect: 'enemy_hp_damage', value: 0.05,
        color: '#3b82f6', icon: '🗼', maxOwned: 1,
    },
    fucina: {
        id: 'fucina', name: 'Fucina',
        desc: 'A inizio combattimento: +6 Armatura a tutte le unità alleate.',
        lore: 'Ogni unità riceve un\'armatura rinforzata prima della battaglia.',
        cost: 4, effect: 'ally_armor_bonus', value: 6,
        color: '#f97316', icon: '⚒️', maxOwned: 2,
    },
    biblioteca: {
        id: 'biblioteca', name: 'Biblioteca Arcana',
        desc: 'A inizio combattimento: cooldown abilità -1 per tutte le unità.',
        lore: 'La conoscenza accelera l\'uso dei poteri mistici.',
        cost: 4, effect: 'ally_cd_reduction', value: 1,
        color: '#8b5cf6', icon: '📚', maxOwned: 1,
    },
    oracolo: {
        id: 'oracolo', name: 'Occhio dell\'Oracolo',
        desc: 'A inizio combattimento: +15% Crit chance per tutte le unità.',
        lore: 'Prevede i punti deboli nemici con visione mistica.',
        cost: 5, effect: 'ally_crit_bonus', value: 0.15,
        color: '#06b6d4', icon: '👁️', maxOwned: 1,
    },
    tempio: {
        id: 'tempio', name: 'Tempio della Vita',
        desc: 'A inizio combattimento: +20% MaxHP temporaneo per tutte le unità.',
        lore: 'Le acque sacre del tempio rafforzano la vitalità dei combattenti.',
        cost: 5, effect: 'ally_maxhp_bonus', value: 0.20,
        color: '#22c55e', icon: '🌿', maxOwned: 1,
    },
};

// ---- Building shop triggers every 5 rounds ----
function isBuildingRound(round) {
    return round > 0 && round % 5 === 0;
}

// ---- Player state lazy init ----
function initPlayerBuildings(player) {
    if (!player) return;
    if (!player.buildings)           player.buildings = [];
    if (!player._buildingInventory)  player._buildingInventory = [];
    if (!player._buildingIdCounter)  player._buildingIdCounter = 0;
}

function _nextBuildingId(player) {
    player._buildingIdCounter = (player._buildingIdCounter || 0) + 1;
    return 'p' + player.index + '_b' + player._buildingIdCounter;
}

// ---- Placement validity check (without actually placing) ----
function _isValidBldPlacement(player, row, col) {
    if (typeof isValidCell === 'function' && !isValidCell(row, col)) return false;
    // No building on cell (from any player)
    if (typeof players !== 'undefined') {
        for (var pi = 0; pi < players.length; pi++) {
            var p = players[pi];
            if (!p.buildings) continue;
            for (var bi = 0; bi < p.buildings.length; bi++) {
                if (p.buildings[bi].row === row && p.buildings[bi].col === col) return false;
            }
        }
    }
    // No unit on cell
    var fu = player.fieldUnits || [];
    for (var i = 0; i < fu.length; i++) {
        if (fu[i].row === row && fu[i].col === col) return false;
    }
    // Must be within Chebyshev ≤ 2 of at least one allied unit
    for (var i = 0; i < fu.length; i++) {
        if (Math.max(Math.abs(fu[i].row - row), Math.abs(fu[i].col - col)) <= 2) return true;
    }
    return false;
}

// ---- Cell helpers ----
function isCellOccupiedByBuilding(player, row, col) {
    if (!player || !player.buildings) return false;
    for (var i = 0; i < player.buildings.length; i++) {
        if (player.buildings[i].row === row && player.buildings[i].col === col) return true;
    }
    // Check all players' buildings (any player's building blocks the cell)
    if (typeof players !== 'undefined') {
        for (var pi = 0; pi < players.length; pi++) {
            var p = players[pi];
            if (!p.buildings) continue;
            for (var bi = 0; bi < p.buildings.length; bi++) {
                if (p.buildings[bi].row === row && p.buildings[bi].col === col) return true;
            }
        }
    }
    return false;
}

// ---- Buy a building ----
function buyBuilding(player, defId) {
    var def = BUILDINGS[defId];
    if (!def) return false;
    initPlayerBuildings(player);

    // Count total owned (placed + inventory)
    var owned = 0;
    for (var i = 0; i < player.buildings.length; i++) {
        if (player.buildings[i].defId === defId) owned++;
    }
    for (var i = 0; i < player._buildingInventory.length; i++) {
        if (player._buildingInventory[i].defId === defId) owned++;
    }
    if (owned >= def.maxOwned) return false;

    if (!spendGold(player, def.cost)) return false;

    var id = _nextBuildingId(player);
    player._buildingInventory.push({ defId: defId, id: id });
    return true;
}

// ---- Place a building on the board ----
function placeBuilding(player, instanceId, row, col) {
    if (!isValidCell(row, col)) return false;

    // Check cell not occupied by any building
    if (typeof players !== 'undefined') {
        for (var pi = 0; pi < players.length; pi++) {
            var p = players[pi];
            if (!p.buildings) continue;
            for (var bi = 0; bi < p.buildings.length; bi++) {
                if (p.buildings[bi].row === row && p.buildings[bi].col === col) return false;
            }
        }
    }

    // Check cell not occupied by a unit
    for (var i = 0; i < player.fieldUnits.length; i++) {
        if (player.fieldUnits[i].row === row && player.fieldUnits[i].col === col) return false;
    }

    // Must be within Chebyshev distance 2 of at least one allied unit
    var nearUnit = false;
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var u = player.fieldUnits[i];
        if (Math.max(Math.abs(u.row - row), Math.abs(u.col - col)) <= 2) {
            nearUnit = true;
            break;
        }
    }
    if (!nearUnit) return false;

    // Find in inventory
    var idx = -1;
    for (var i = 0; i < player._buildingInventory.length; i++) {
        if (player._buildingInventory[i].id === instanceId) { idx = i; break; }
    }
    if (idx === -1) return false;

    var bld = player._buildingInventory.splice(idx, 1)[0];
    bld.row = row;
    bld.col = col;
    player.buildings.push(bld);

    if (typeof spawnBuilding3D === 'function') {
        spawnBuilding3D(bld.defId, row, col, player.index, bld.id);
    }
    return true;
}

// ---- Apply passive effects every round (gold income etc.) ----
function applyBuildingPassives(player) {
    initPlayerBuildings(player);
    for (var i = 0; i < player.buildings.length; i++) {
        var def = BUILDINGS[player.buildings[i].defId];
        if (def && def.effect === 'gold_per_round') {
            addGold(player, def.value, false);
        }
    }
}

// ---- Override initCombat — inject building effects on CLONES ----
var _origInitCombat_bld = typeof initCombat === 'function' ? initCombat : null;
initCombat = function(playersList, creepUnits, campCreeps) {
    var state = _origInitCombat_bld(playersList, creepUnits, campCreeps);
    _applyBuildingsToCombatClones(playersList, state);
    return state;
};

function _applyBuildingsToCombatClones(playersList, combatState) {
    var teams = combatState.teams;
    for (var pi = 0; pi < playersList.length; pi++) {
        var player = playersList[pi];
        if (player.eliminated) continue;
        initPlayerBuildings(player);
        if (!player.buildings || player.buildings.length === 0) continue;

        var myTeam = teams[String(player.index)];
        if (!myTeam || myTeam.length === 0) continue;

        // Gather enemies
        var allEnemies = [];
        for (var k in teams) {
            if (k !== String(player.index)) allEnemies = allEnemies.concat(teams[k]);
        }

        for (var bi = 0; bi < player.buildings.length; bi++) {
            var def = BUILDINGS[player.buildings[bi].defId];
            if (!def) continue;
            switch (def.effect) {
                case 'ally_atk_bonus':
                    for (var ui = 0; ui < myTeam.length; ui++) {
                        myTeam[ui].atk = Math.round(myTeam[ui].atk * (1 + def.value));
                    }
                    break;
                case 'ally_armor_bonus':
                    for (var ui = 0; ui < myTeam.length; ui++) myTeam[ui].armor += def.value;
                    break;
                case 'ally_shield_start':
                    for (var ui = 0; ui < myTeam.length; ui++) {
                        myTeam[ui].shield = (myTeam[ui].shield || 0) +
                            Math.round(myTeam[ui].maxHp * def.value);
                    }
                    break;
                case 'ally_crit_bonus':
                    for (var ui = 0; ui < myTeam.length; ui++) {
                        myTeam[ui].critChance = Math.min(0.95, myTeam[ui].critChance + def.value);
                    }
                    break;
                case 'ally_cd_reduction':
                    for (var ui = 0; ui < myTeam.length; ui++) {
                        var u = myTeam[ui];
                        if (u.abilityCooldown !== undefined)
                            u.abilityCooldown = Math.max(0, u.abilityCooldown - def.value);
                    }
                    break;
                case 'ally_maxhp_bonus':
                    for (var ui = 0; ui < myTeam.length; ui++) {
                        var bonus = Math.round(myTeam[ui].maxHp * def.value);
                        myTeam[ui].maxHp += bonus;
                        myTeam[ui].hp = Math.min(myTeam[ui].hp + bonus, myTeam[ui].maxHp);
                    }
                    break;
                case 'enemy_hp_damage':
                    for (var ei = 0; ei < allEnemies.length; ei++) {
                        var dmg = Math.max(1, Math.round(allEnemies[ei].hp * def.value));
                        allEnemies[ei].hp = Math.max(1, allEnemies[ei].hp - dmg);
                    }
                    break;
            }
        }
    }
}

// ---- AI: auto buy + auto place building ----
function aiAutoBuyBuilding(player) {
    initPlayerBuildings(player);
    var ids = Object.keys(BUILDINGS);
    // Shuffle
    for (var i = ids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }
    for (var i = 0; i < ids.length; i++) {
        var def = BUILDINGS[ids[i]];
        if (player.gold < def.cost) continue;

        // Check max owned
        var owned = 0;
        for (var bi = 0; bi < player.buildings.length; bi++) {
            if (player.buildings[bi].defId === ids[i]) owned++;
        }
        for (var bi = 0; bi < player._buildingInventory.length; bi++) {
            if (player._buildingInventory[bi].defId === ids[i]) owned++;
        }
        if (owned >= def.maxOwned) continue;

        buyBuilding(player, ids[i]);

        // Auto-place in deploy zone
        var inv = player._buildingInventory;
        if (inv.length > 0) {
            var inst = inv[inv.length - 1];
            var zone = getDeployZone(typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index);
            if (zone && zone.cells) {
                var cells = zone.cells.slice().sort(function() { return Math.random() - 0.5; });
                for (var ci = 0; ci < cells.length; ci++) {
                    var cell = cells[ci];
                    if (placeBuilding(player, inst.id, cell.r, cell.c)) break;
                }
            }
        }
        break; // one building per shop visit
    }
}

// ======================================================================
//  BUILDING SHOP OVERLAY
// ======================================================================
var _bshopCallback = null;
var _bshopCards   = [];

function beginBuildingShopPhase(onDone) {
    _bshopCallback = onDone;
    _ensureBshopOverlay();
    _bshopCards = _pickBshopCards(getHumanPlayer());
    _renderBshop();
    showOverlay('building-shop-overlay');
    if (typeof showPhaseBannerForPhase === 'function') showPhaseBannerForPhase('building');

    // AI auto-buy
    if (typeof players !== 'undefined') {
        for (var i = 1; i < players.length; i++) {
            if (!players[i].eliminated) aiAutoBuyBuilding(players[i]);
        }
    }
}

function _pickBshopCards(player) {
    initPlayerBuildings(player);
    var all = Object.keys(BUILDINGS);
    var available = [];
    for (var i = 0; i < all.length; i++) {
        var id = all[i];
        var def = BUILDINGS[id];
        var owned = 0;
        for (var bi = 0; bi < player.buildings.length; bi++) {
            if (player.buildings[bi].defId === id) owned++;
        }
        for (var bi = 0; bi < player._buildingInventory.length; bi++) {
            if (player._buildingInventory[bi].defId === id) owned++;
        }
        if (owned < def.maxOwned) available.push(id);
    }
    // Shuffle
    for (var i = available.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = available[i]; available[i] = available[j]; available[j] = t;
    }
    return available.slice(0, 3);
}

function _ensureBshopOverlay() {
    if (document.getElementById('building-shop-overlay')) return;

    // Inject CSS once
    if (!document.getElementById('building-shop-css')) {
        var st = document.createElement('style');
        st.id = 'building-shop-css';
        st.textContent = [
            '#building-shop-overlay{flex-direction:column;align-items:center;justify-content:flex-start;gap:16px;padding:20px 24px;background:rgba(15,17,23,0.96);z-index:500;overflow-y:auto;}',
            '#building-shop-overlay.active{display:flex;}',
            '.bshop-title{font-size:2.2rem;font-weight:700;color:#fbbf24;letter-spacing:2px;text-shadow:0 0 20px #fbbf2470;margin-top:16px;}',
            '.bshop-sub{font-size:1rem;color:#94a3b8;margin-top:-8px;}',
            '.bshop-gold{font-size:1.1rem;color:#fbbf24;font-weight:600;}',
            '.bshop-cards{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:800px;}',
            '.bshop-card{background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #334155;border-radius:14px;padding:20px 18px;width:200px;cursor:pointer;transition:border-color .2s,transform .2s,box-shadow .2s;display:flex;flex-direction:column;gap:10px;}',
            '.bshop-card:hover{border-color:#fbbf24;transform:translateY(-4px);box-shadow:0 8px 24px #fbbf2440;}',
            '.bshop-card.unaffordable{opacity:.5;cursor:not-allowed;}',
            '.bshop-card.unaffordable:hover{transform:none;border-color:#334155;box-shadow:none;}',
            '.bshop-icon{font-size:2.6rem;text-align:center;}',
            '.bshop-name{font-size:1.1rem;font-weight:700;color:#f1f5f9;}',
            '.bshop-cost{font-size:.95rem;color:#fbbf24;font-weight:600;}',
            '.bshop-desc{font-size:.85rem;color:#94a3b8;line-height:1.4;}',
            '.bshop-max{font-size:.8rem;color:#475569;}',
            '.building-inv-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;margin-bottom:3px;border:1px solid transparent;font-size:.9rem;color:#e2e8f0;transition:background .12s;}',
            '.building-inv-item:hover{background:#1e293b;}',
            '.building-inv-item.placing{background:#1e3a2e;border-color:#22c55e !important;}',
            '.bshop-inventory-label{font-size:.8rem;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px;}',
            '#bshop-close-btn{font-size:1rem;padding:10px 32px;margin-top:8px;margin-bottom:16px;}',
        ].join('');
        document.head.appendChild(st);
    }

    var ov = document.createElement('div');
    ov.id   = 'building-shop-overlay';
    ov.className = 'overlay';
    ov.innerHTML =
        '<div class="bshop-title">NEGOZIO EDIFICI</div>' +
        '<div class="bshop-sub">Turno costruzione — acquista strutture permanenti</div>' +
        '<div class="bshop-gold" id="bshop-gold-display"></div>' +
        '<div class="bshop-cards" id="bshop-cards-container"></div>' +
        '<div id="bshop-owned-list" style="width:100%;max-width:560px;"></div>' +
        '<button class="btn" id="bshop-close-btn" style="margin-top:4px;">Chiudi Negozio</button>';
    document.body.appendChild(ov);

    document.getElementById('bshop-close-btn').addEventListener('click', function() {
        hideOverlay('building-shop-overlay');
        var cb = _bshopCallback;
        _bshopCallback = null;
        if (cb) cb();
    });
}

function _renderBshop() {
    var cards    = document.getElementById('bshop-cards-container');
    var goldDisp = document.getElementById('bshop-gold-display');
    var ownedEl  = document.getElementById('bshop-owned-list');
    if (!cards) return;

    var human = getHumanPlayer();
    initPlayerBuildings(human);

    if (goldDisp) goldDisp.innerHTML = 'Oro disponibile: <b>' + Math.floor(human.gold) + '</b>';

    // ── Shop cards ──
    cards.innerHTML = '';
    for (var ci = 0; ci < _bshopCards.length; ci++) {
        (function(defId) {
            var def = BUILDINGS[defId];
            if (!def) return;
            var card = document.createElement('div');
            card.className = 'bshop-card' + (human.gold >= def.cost ? '' : ' unaffordable');
            card.innerHTML =
                '<div class="bshop-icon">' + def.icon + '</div>' +
                '<div class="bshop-name">' + def.name + '</div>' +
                '<div class="bshop-cost">Costo: ' + def.cost + ' Oro</div>' +
                '<div class="bshop-desc">' + def.desc + '</div>' +
                '<div class="bshop-max">Max: ' + def.maxOwned + '</div>';

            if (human.gold >= def.cost) {
                card.addEventListener('click', function() {
                    if (buyBuilding(human, defId)) {
                        if (typeof updateHUD === 'function') updateHUD(human, currentRound);
                        if (typeof showToast === 'function')
                            showToast(def.name + ' acquistato! Piazzalo in pianificazione.', 'success', '🏗');
                        _renderBshop();
                    }
                });
            }
            cards.appendChild(card);
        })(_bshopCards[ci]);
    }

    // ── Owned inventory ──
    if (ownedEl) {
        var inv = human._buildingInventory || [];
        if (inv.length > 0) {
            var html = '<div class="bshop-inventory-label" style="color:#94a3b8;margin-top:4px;">In inventario (da piazzare):</div><div style="display:flex;gap:8px;flex-wrap:wrap;">';
            for (var i = 0; i < inv.length; i++) {
                var d = BUILDINGS[inv[i].defId];
                if (d) html += '<span style="background:#1e293b;border:1px solid ' + d.color + '60;border-radius:6px;padding:4px 10px;font-size:.78rem;color:#e2e8f0;">' + d.icon + ' ' + d.name + '</span>';
            }
            html += '</div>';
            ownedEl.innerHTML = html;
        } else {
            ownedEl.innerHTML = '';
        }
    }
}

// ======================================================================
//  BUILDING INVENTORY UI — shown in side panel during planning
// ======================================================================
var _buildingPlacementMode          = false;
var _placingBuildingInstanceId      = null;
var _bldPlacementMouseMoveHandler   = null;

function updateBuildingInventoryUI(player) {
    if (!player) return;
    initPlayerBuildings(player);

    var section = document.getElementById('building-section');
    var listEl  = document.getElementById('building-list');
    if (!section || !listEl) return;

    var inv    = player._buildingInventory || [];
    var placed = player.buildings || [];

    // Hide section if not in planning or no buildings at all
    if (typeof gamePhase !== 'undefined' && gamePhase !== PHASE_PLANNING) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    if (inv.length === 0 && placed.length === 0) {
        listEl.innerHTML = '<div class="empty-message" style="font-size:11px;color:#475569;padding:4px 0;">Nessun edificio — acquista al prossimo turno 5</div>';
        return;
    }

    var html = '';

    if (inv.length > 0) {
        html += '<div class="bshop-inventory-label">Da piazzare (clicca poi cella)</div>';
        for (var i = 0; i < inv.length; i++) {
            var def = BUILDINGS[inv[i].defId];
            if (!def) continue;
            var isPlacing = _buildingPlacementMode && _placingBuildingInstanceId === inv[i].id;
            html += '<div class="building-inv-item' + (isPlacing ? ' placing' : '') +
                '" data-bldid="' + inv[i].id + '" style="border-color:' + def.color + (isPlacing ? '' : '50') + '">' +
                '<span>' + def.icon + '</span><span>' + def.name + '</span>' +
                (isPlacing ? '<span style="margin-left:auto;font-size:10px;color:#22c55e">Scegli cella</span>' : '') +
                '</div>';
        }
    }

    if (placed.length > 0) {
        html += '<div class="bshop-inventory-label" style="margin-top:6px;">Sul campo</div>';
        for (var i = 0; i < placed.length; i++) {
            var def = BUILDINGS[placed[i].defId];
            if (!def) continue;
            html += '<div class="building-inv-item" style="opacity:.65;cursor:default;border-color:' + def.color + '30">' +
                '<span>' + def.icon + '</span><span>' + def.name + '</span>' +
                '<span style="margin-left:auto;font-size:10px;color:#64748b">(' + placed[i].row + ',' + placed[i].col + ')</span>' +
                '</div>';
        }
    }

    listEl.innerHTML = html;

    // Event delegation (one-time bind)
    if (!listEl._delegated) {
        listEl._delegated = true;
        listEl.addEventListener('click', function(e) {
            var item = e.target.closest ? e.target.closest('.building-inv-item[data-bldid]') : null;
            if (!item) return;
            var instId = item.getAttribute('data-bldid');
            if (!instId) return;
            if (_buildingPlacementMode && _placingBuildingInstanceId === instId) {
                _exitBldPlacement();
            } else {
                _enterBldPlacement(instId);
            }
            updateBuildingInventoryUI(getHumanPlayer());
        });
    }
}

// Mousemove handler — updates ghost position + validity tint
function _onBldPlacementMouseMove(e) {
    if (!_buildingPlacementMode) return;
    var human = (typeof players !== 'undefined') ? getHumanPlayer() : null;
    if (!human) return;

    // Use same canvas target as the click handler
    var canvas = (typeof _getInteractionTarget === 'function')
        ? _getInteractionTarget()
        : document.getElementById('game-canvas');
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (typeof _screenToCell !== 'function') return;
    var cell = _screenToCell(mx, my);

    if (!cell || cell.r < 0 || cell.c < 0) {
        if (typeof updateBuildingGhost3D === 'function') updateBuildingGhost3D(-1, -1, false);
        return;
    }
    var valid = _isValidBldPlacement(human, cell.r, cell.c);
    if (typeof updateBuildingGhost3D === 'function') updateBuildingGhost3D(cell.r, cell.c, valid);
}

function _enterBldPlacement(instanceId) {
    _buildingPlacementMode     = true;
    _placingBuildingInstanceId = instanceId;

    // Show detailed 3D ghost model
    if (typeof showBuildingGhost3D === 'function') {
        var human = (typeof players !== 'undefined') ? getHumanPlayer() : null;
        if (human) {
            var inv = human._buildingInventory || [];
            for (var i = 0; i < inv.length; i++) {
                if (inv[i].id === instanceId) {
                    showBuildingGhost3D(inv[i].defId);
                    break;
                }
            }
        }
    }

    // Listen for mouse movement to move ghost
    _bldPlacementMouseMoveHandler = _onBldPlacementMouseMove;
    document.addEventListener('mousemove', _bldPlacementMouseMoveHandler);

    if (typeof showToast === 'function')
        showToast('Muovi il mouse sulla mappa — Verde = valido, Rosso = invalido', 'info', '🏗');
}

function _exitBldPlacement() {
    _buildingPlacementMode     = false;
    _placingBuildingInstanceId = null;

    // Remove ghost model
    if (typeof clearBuildingGhost3D === 'function') clearBuildingGhost3D();

    // Remove mousemove listener
    if (_bldPlacementMouseMoveHandler) {
        document.removeEventListener('mousemove', _bldPlacementMouseMoveHandler);
        _bldPlacementMouseMoveHandler = null;
    }
}

// Called from ui.js canvas click handler when in placement mode
function onBuildingCellClick(row, col) {
    var human = getHumanPlayer();
    if (!human || !_buildingPlacementMode || !_placingBuildingInstanceId) return false;

    var success = placeBuilding(human, _placingBuildingInstanceId, row, col);
    if (success) {
        if (typeof showToast === 'function') showToast('Edificio piazzato!', 'success', '✓');
        _exitBldPlacement();
        updateBuildingInventoryUI(human);
        if (typeof updateSidePanel === 'function') updateSidePanel(players);
    } else {
        if (typeof showToast === 'function') showToast('Troppo lontano! Piazza entro 2 caselle da un\'unità alleata.', 'warning', '⚠');
    }
    return success;
}

// Building cleanup on new game is handled directly inside startNewGame() in game.js
