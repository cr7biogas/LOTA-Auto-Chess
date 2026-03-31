// ============================================================
// LOTA AUTO CHESS — militia.js — Support troops system
// ============================================================

// --- Create a militia unit from type definition ---
function createMilitiaUnit(typeId, owner, row, col) {
    var def = MILITIA_TYPES[typeId];
    if (!def) return null;

    var zone = getDeployZone(owner);
    var unit = {
        id: genUnitId(),
        charId: 'militia_' + typeId,
        militiaType: typeId,
        isMilitia: true,
        owner: owner,
        star: 1,

        // Stats
        maxHp: def.hp,
        hp: def.hp,
        atk: def.atk,
        baseAtk: def.atk,
        atkSpeed: def.atkSpeed,
        baseAtkSpeed: def.atkSpeed,
        armor: def.armor,
        baseArmor: def.armor,
        range: def.range,
        unitClass: 'Milizia',
        race: 'Neutrale',
        behavior: def.behavior,

        // Combat modifiers
        critChance: CRIT_CHANCE_BASE,
        dodgeChance: 0,
        atkSpeedMultiplier: 1.0,
        dmgMultiplier: 1.0,
        magicResist: 0,

        // Position
        row: row,
        col: col,
        px: 0, py: 0,
        targetRow: -1, targetCol: -1,

        // Combat state
        alive: true,
        atkTimer: def.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false,
        isStopped: false,

        // No items/skills for militia
        items: [],
        learnedSkills: {},
        equippedSkills: [],
        skillCooldowns: {},

        // Militia order (simpler than tactical orders)
        militiaOrder: 'posizione',
        militiaEscortTarget: null, // hero unit id for 'scorta'

        // Tactical order mapped from militia order
        tacticalOrder: ORDER_HOLD,
        tacticalTarget: null,
        tacticalMoveRow: -1,
        tacticalMoveCol: -1,

        // Persistence (militia-specific)
        survivalCount: 0,
        _needsRespawn: false,
        _consumableBuff: {},
        _curseDebuffs: [],

        // Status effects
        effects: [],

        // Character-specific state (minimal for militia)
        coins: 0,
        hasTeleported: false,
        abilityCooldown: 999,
        enhancedRegenUsed: false,
        enhancedRegenTicks: 0,
        furiaActive: false,
        furiaTicks: 0,
        noHealDuringFuria: false,
        copiedClass: null,
        copiedRace: null,
        lastAllyAbility: null,
        deathPreventionUsed: false,
        nucleoUsed: false,
        reviving: false,
        reviveTicks: 0,
        killStacks: 0,
        velenoCharges: 0,
        cristalloApplied: false,
        amiciStacks: 0,

        // Guaritore special
        healPerTick: def.healPerTick || 0,
        healRadius: def.healRadius || 0,

        // Esploratore special
        moveSpeed: def.moveSpeed || 1,

        // Animation
        atkAnim: 0,
        hitAnim: 0,
        deathAnim: 0,
        facing: zone ? zone.facing : 1,
    };
    // Scale militia stats with round
    var currentRound = (typeof round !== 'undefined') ? round : ((typeof gameRound !== 'undefined') ? gameRound : 1);
    var scale = getMilitiaRoundScale(currentRound);
    if (scale > 1.0) {
        unit.maxHp = Math.round(unit.maxHp * scale);
        unit.hp = unit.maxHp;
        unit.atk = Math.round(unit.atk * scale);
        unit.baseAtk = unit.atk;
    }
    return unit;
}

// --- Buy militia unit (places on bench-like holding, then player places it) ---
function buyMilitia(player, typeId) {
    if (!player || player.eliminated) return false;
    var def = MILITIA_TYPES[typeId];
    if (!def) return false;

    // Check limit
    if (player.militiaUnits.length >= MAX_MILITIA) return false;

    // Check gold
    if (!spendGold(player, def.cost)) return false;

    // Find empty cell in deploy zone
    var zone = getDeployZone(typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index);
    if (!zone || !zone.cells) return false;

    var allOccupied = _getMilitiaOccupiedCells(player);
    var cell = null;
    for (var i = 0; i < zone.cells.length; i++) {
        var c = zone.cells[i];
        var key = c.r + ',' + c.c;
        if (!allOccupied[key]) {
            cell = c;
            break;
        }
    }
    if (!cell) return false; // no room

    var unit = createMilitiaUnit(typeId, player.index, cell.r, cell.c);
    if (!unit) return false;

    player.militiaUnits.push(unit);
    return true;
}

// --- Get all occupied cells (field units + militia) ---
function _getMilitiaOccupiedCells(player) {
    var occupied = {};
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var u = player.fieldUnits[i];
        occupied[u.row + ',' + u.col] = true;
    }
    for (var i = 0; i < player.militiaUnits.length; i++) {
        var m = player.militiaUnits[i];
        occupied[m.row + ',' + m.col] = true;
    }
    return occupied;
}

// --- Remove a militia unit ---
function removeMilitia(player, unitId) {
    for (var i = 0; i < player.militiaUnits.length; i++) {
        if (player.militiaUnits[i].id === unitId) {
            player.militiaUnits.splice(i, 1);
            return true;
        }
    }
    return false;
}

// --- Set militia order ---
function setMilitiaOrder(unit, orderId, escortTargetId) {
    if (!unit || !unit.isMilitia) return;
    var orderDef = MILITIA_ORDERS[orderId];
    if (!orderDef) return;

    unit.militiaOrder = orderId;

    // Map militia orders to tactical system
    if (orderId === 'posizione') {
        unit.tacticalOrder = ORDER_HOLD;
        unit.tacticalTarget = null;
    } else if (orderId === 'scorta') {
        unit.tacticalOrder = ORDER_FOLLOW;
        unit.tacticalTarget = escortTargetId || null;
        unit.militiaEscortTarget = escortTargetId || null;
    } else if (orderId === 'avanzata') {
        // Move towards center
        var center = getBoardCenter();
        unit.tacticalOrder = ORDER_MOVE;
        unit.tacticalMoveRow = center.r;
        unit.tacticalMoveCol = center.c;
        unit.tacticalTarget = null;
    }
}

// --- Process Guaritore healing during combat tick ---
function processMilitiaGuaritoreHeal(allUnits) {
    for (var i = 0; i < allUnits.length; i++) {
        var unit = allUnits[i];
        if (!unit.alive || !unit.isMilitia || unit.militiaType !== 'guaritore') continue;
        if (!unit.healPerTick || unit.healPerTick <= 0) continue;

        // Heal nearby allies within healRadius
        for (var j = 0; j < allUnits.length; j++) {
            var ally = allUnits[j];
            if (!ally.alive || ally.owner !== unit.owner || ally.id === unit.id) continue;
            var dist = chebyshevDist(unit.row, unit.col, ally.row, ally.col);
            if (dist <= unit.healRadius) {
                var healAmount = Math.round(ally.maxHp * unit.healPerTick);
                if (healAmount > 0 && ally.hp < ally.maxHp) {
                    ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
                    // VFX
                    if (typeof vfxHeal === 'function') vfxHeal(ally);
                }
            }
        }
    }
}

// --- Save militia positions after combat ---
function saveMilitiaAfterCombat(playersList, teams) {
    for (var p = 0; p < playersList.length; p++) {
        var player = playersList[p];
        if (player.eliminated) continue;
        var teamKey = String(player.index);
        var combatTeam = teams[teamKey];
        if (!combatTeam) continue;

        var deadMilitiaIds = [];

        for (var m = 0; m < player.militiaUnits.length; m++) {
            var militia = player.militiaUnits[m];
            var found = false;

            for (var c = 0; c < combatTeam.length; c++) {
                var clone = combatTeam[c];
                if (clone.id === militia.id) {
                    found = true;
                    if (clone.alive) {
                        // Save position and HP
                        militia.row = clone.row;
                        militia.col = clone.col;
                        if (typeof initUnitWorldPos === 'function') initUnitWorldPos(militia);
                        militia.px = 0;
                        militia.py = 0;
                        var hpRatio = clone.hp / clone.maxHp;
                        militia.hp = Math.max(1, Math.round(militia.maxHp * hpRatio));
                    } else {
                        // Dead militia — mark for removal
                        deadMilitiaIds.push(militia.id);
                    }
                    break;
                }
            }
        }

        // Remove dead militia (no respawn)
        if (deadMilitiaIds.length > 0) {
            player.militiaUnits = player.militiaUnits.filter(function(m) {
                return deadMilitiaIds.indexOf(m.id) === -1;
            });
        }
    }
}

// --- Scale militia stats with round (gradual scaling so they stay relevant) ---
function getMilitiaRoundScale(round) {
    // +5% stats per 5 rounds after round 10
    if (round <= 10) return 1.0;
    return 1.0 + Math.floor((round - 10) / 5) * 0.05;
}

// --- Render militia shop (called from updateSidePanel) ---
function renderMilitiaShop(player) {
    var section = document.getElementById('militia-section');
    if (!section) return;

    var listEl = document.getElementById('militia-list');
    if (!listEl) return;

    // Only show during planning
    if (gamePhase !== PHASE_PLANNING) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    var html = '';
    var count = player.militiaUnits ? player.militiaUnits.length : 0;
    html += '<div class="militia-header">';
    html += '<span class="militia-count">Truppe: ' + count + '/' + MAX_MILITIA + '</span>';
    html += '</div>';

    // Buy buttons
    html += '<div class="militia-shop">';
    for (var typeId in MILITIA_TYPES) {
        var def = MILITIA_TYPES[typeId];
        var canBuy = count < MAX_MILITIA && player.gold >= def.cost;
        var cls = 'militia-buy-btn' + (canBuy ? '' : ' disabled');
        html += '<button class="' + cls + '" data-militia-type="' + typeId + '" title="' + def.desc + '">';
        html += '<span class="militia-icon">' + def.icon + '</span>';
        html += '<span class="militia-name">' + def.name + '</span>';
        html += '<span class="militia-cost">' + def.cost + 'g</span>';
        html += '</button>';
    }
    html += '</div>';

    // Active militia roster
    if (count > 0) {
        html += '<div class="militia-roster">';
        for (var i = 0; i < player.militiaUnits.length; i++) {
            var m = player.militiaUnits[i];
            var mDef = MILITIA_TYPES[m.militiaType];
            if (!mDef) continue;
            var hpPct = Math.round((m.hp / m.maxHp) * 100);
            var hpColor = hpPct > 60 ? '#34d399' : (hpPct > 30 ? '#fbbf24' : '#ef4444');
            var orderDef = MILITIA_ORDERS[m.militiaOrder] || MILITIA_ORDERS.posizione;

            html += '<div class="militia-card" data-militia-id="' + m.id + '">';
            html += '<div class="militia-card-top">';
            html += '<span class="militia-card-icon">' + mDef.icon + '</span>';
            html += '<span class="militia-card-name">' + mDef.name + '</span>';
            html += '<span class="militia-card-hp" style="color:' + hpColor + '">' + m.hp + '/' + m.maxHp + '</span>';
            html += '<button class="militia-dismiss-btn" data-militia-id="' + m.id + '" title="Congeda">✕</button>';
            html += '</div>';
            // HP bar
            html += '<div class="militia-hp-bar"><div class="militia-hp-fill" style="width:' + hpPct + '%;background:' + hpColor + '"></div></div>';
            // Order buttons
            html += '<div class="militia-orders">';
            for (var oid in MILITIA_ORDERS) {
                var od = MILITIA_ORDERS[oid];
                var active = m.militiaOrder === oid ? ' active' : '';
                html += '<button class="militia-order-btn' + active + '" data-militia-id="' + m.id + '" data-order="' + oid + '" title="' + od.desc + '">';
                html += od.icon + ' ' + od.name;
                html += '</button>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
    }

    listEl.innerHTML = html;

    // Use event delegation — single listener that survives innerHTML rebuilds
    if (!listEl._militiaDelegated) {
        listEl._militiaDelegated = true;
        listEl.addEventListener('click', function(e) {
            var target = e.target;

            // Walk up to find the actual button (emoji spans inside buttons)
            var btn = target.closest ? target.closest('button') : null;
            if (!btn && target.parentElement && target.parentElement.tagName === 'BUTTON') btn = target.parentElement;
            if (!btn) return;

            // --- Buy button ---
            if (btn.classList.contains('militia-buy-btn') && !btn.classList.contains('disabled')) {
                e.stopPropagation();
                var typeId = btn.getAttribute('data-militia-type');
                if (!typeId) return;
                if (buyMilitia(getHumanPlayer(), typeId)) {
                    if (typeof playGoldSound === 'function') playGoldSound();
                    var def = MILITIA_TYPES[typeId];
                    if (typeof showToast === 'function' && def) {
                        showToast(def.icon + ' ' + def.name + ' reclutato!', 'gold', def.icon);
                    }
                    updateHUD(getHumanPlayer(), currentRound);
                    renderMilitiaShop(getHumanPlayer());
                    if (typeof updateUnitRoster === 'function') updateUnitRoster(getHumanPlayer());
                } else {
                    if (typeof showToast === 'function') showToast('Non puoi reclutare!', 'danger', '!');
                }
                return;
            }

            // --- Dismiss button ---
            if (btn.classList.contains('militia-dismiss-btn')) {
                e.stopPropagation();
                var mid = parseInt(btn.getAttribute('data-militia-id'));
                if (isNaN(mid)) return;
                removeMilitia(getHumanPlayer(), mid);
                renderMilitiaShop(getHumanPlayer());
                if (typeof updateUnitRoster === 'function') updateUnitRoster(getHumanPlayer());
                if (typeof showToast === 'function') showToast('Truppa congedata', 'info', '!');
                return;
            }

            // --- Order button ---
            if (btn.classList.contains('militia-order-btn')) {
                e.stopPropagation();
                var mid = parseInt(btn.getAttribute('data-militia-id'));
                var orderId = btn.getAttribute('data-order');
                if (isNaN(mid) || !orderId) return;

                var unit = null;
                for (var i = 0; i < getHumanPlayer().militiaUnits.length; i++) {
                    if (getHumanPlayer().militiaUnits[i].id === mid) { unit = getHumanPlayer().militiaUnits[i]; break; }
                }
                if (!unit) return;

                if (orderId === 'scorta') {
                    _militiaEscortPending = { unitId: mid, orderId: orderId };
                    var prompt = document.getElementById('order-select-prompt');
                    if (prompt) { prompt.textContent = '🤝 Clicca su un eroe da scortare'; prompt.classList.add('active'); }
                    if (typeof showToast === 'function') showToast('Clicca su un eroe da scortare', 'info', '🤝');
                } else {
                    setMilitiaOrder(unit, orderId);
                    renderMilitiaShop(getHumanPlayer());
                    if (typeof showToast === 'function') {
                        var od = MILITIA_ORDERS[orderId];
                        showToast((od ? od.icon + ' ' : '') + 'Ordine: ' + (od ? od.name : orderId), 'success', '!');
                    }
                }
                return;
            }
        });
    }
}

// Pending escort assignment
var _militiaEscortPending = null;

function cancelMilitiaEscortPending() {
    _militiaEscortPending = null;
    var prompt = document.getElementById('order-select-prompt');
    if (prompt) prompt.classList.remove('active');
}

// Called when a field unit is clicked while escort is pending
function tryAssignMilitiaEscort(heroUnitId) {
    if (!_militiaEscortPending) return false;

    var player = getHumanPlayer();
    var militia = null;
    for (var i = 0; i < player.militiaUnits.length; i++) {
        if (player.militiaUnits[i].id === _militiaEscortPending.unitId) {
            militia = player.militiaUnits[i];
            break;
        }
    }

    if (!militia) { cancelMilitiaEscortPending(); return false; }

    setMilitiaOrder(militia, 'scorta', heroUnitId);
    cancelMilitiaEscortPending();
    renderMilitiaShop(player);
    if (typeof showToast === 'function') showToast('Scorta assegnata!', 'success', '🤝');
    return true;
}

// --- AI militia logic ---
function aiMilitiaBuy(player) {
    if (!player || player.eliminated) return;
    var count = player.militiaUnits ? player.militiaUnits.length : 0;

    // AI buys militia if gold > 8 and has fewer than 3, or gold > 15 and fewer than max
    var goldThreshold = count < 3 ? 8 : 15;
    if (player.gold < goldThreshold) return;
    if (count >= MAX_MILITIA) return;

    // Pick type based on needs
    var hasGuaritore = false;
    var soldatoCount = 0;
    for (var i = 0; i < player.militiaUnits.length; i++) {
        if (player.militiaUnits[i].militiaType === 'guaritore') hasGuaritore = true;
        if (player.militiaUnits[i].militiaType === 'soldato') soldatoCount++;
    }

    var typeId;
    if (!hasGuaritore && player.gold >= MILITIA_TYPES.guaritore.cost + 4) {
        typeId = 'guaritore';
    } else if (soldatoCount < 2 && player.gold >= MILITIA_TYPES.soldato.cost + 4) {
        typeId = 'soldato';
    } else if (Math.random() < 0.5 && player.gold >= MILITIA_TYPES.arciere.cost + 4) {
        typeId = 'arciere';
    } else if (player.gold >= MILITIA_TYPES.esploratore.cost + 4) {
        typeId = 'esploratore';
    } else {
        return;
    }

    buyMilitia(player, typeId);
}

function aiMilitiaOrders(player) {
    if (!player || !player.militiaUnits) return;

    for (var i = 0; i < player.militiaUnits.length; i++) {
        var m = player.militiaUnits[i];
        var mDef = MILITIA_TYPES[m.militiaType];
        if (!mDef) continue;

        if (m.militiaType === 'soldato') {
            // Soldato: escort the strongest hero
            var bestHero = null;
            for (var j = 0; j < player.fieldUnits.length; j++) {
                var h = player.fieldUnits[j];
                if (!bestHero || h.star > bestHero.star || (h.star === bestHero.star && h.atk > bestHero.atk)) {
                    bestHero = h;
                }
            }
            if (bestHero) {
                setMilitiaOrder(m, 'scorta', bestHero.id);
            } else {
                setMilitiaOrder(m, 'posizione');
            }
        } else if (m.militiaType === 'arciere') {
            // Arciere: advance to center for control
            setMilitiaOrder(m, 'avanzata');
        } else if (m.militiaType === 'guaritore') {
            // Guaritore: escort lowest-HP hero
            var weakest = null;
            for (var j = 0; j < player.fieldUnits.length; j++) {
                var h = player.fieldUnits[j];
                if (!weakest || (h.hp / h.maxHp) < (weakest.hp / weakest.maxHp)) {
                    weakest = h;
                }
            }
            if (weakest) {
                setMilitiaOrder(m, 'scorta', weakest.id);
            } else {
                setMilitiaOrder(m, 'posizione');
            }
        } else if (m.militiaType === 'esploratore') {
            // Esploratore: advance to center for gold control
            setMilitiaOrder(m, 'avanzata');
        }
    }
}
