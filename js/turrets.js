// ============================================================
// LOTA AUTO CHESS — turrets.js — Fixed defensive structures
// ============================================================

// --- Get player's main hero (highest star) ---
function getMainHero(player) {
    var best = null;
    var allUnits = (player.fieldUnits || []).concat(player.benchUnits || []);
    for (var i = 0; i < allUnits.length; i++) {
        var u = allUnits[i];
        if (u.isMilitia || u.isStructure) continue;
        if (!best || u.star > best.star || (u.star === best.star && u.atk > best.atk)) {
            best = u;
        }
    }
    return best;
}

// --- Get themed structure definition ---
function getStructureDef(charId, baseType) {
    var base = STRUCTURE_BASE_TYPES[baseType];
    if (!base) return null;
    var theme = STRUCTURE_THEMES[charId] ? STRUCTURE_THEMES[charId][baseType] : null;
    if (!theme) {
        // Fallback for unknown charId
        theme = { name: baseType, icon: '?', color: { fill: '#888', stroke: '#555' } };
    }
    return {
        baseType: baseType,
        charId: charId,
        name: theme.name,
        icon: theme.icon,
        color: theme.color,
        role: base.role,
        hp: base.hp,
        atk: base.atk,
        range: base.range,
        atkSpeed: base.atkSpeed,
        armor: base.armor,
        cost: base.cost,
        desc: base.desc,
    };
}

// --- Create a structure unit ---
function createStructureUnit(charId, baseType, owner, row, col) {
    var def = getStructureDef(charId, baseType);
    if (!def) return null;
    var zone = getDeployZone(owner);

    return {
        id: genUnitId(),
        charId: 'struct_' + charId + '_' + baseType,
        structureType: baseType,
        structureCharId: charId,
        isStructure: true,
        isMilitia: false,
        owner: owner,
        star: 1,

        maxHp: def.hp,
        hp: def.hp,
        atk: def.atk,
        baseAtk: def.atk,
        atkSpeed: def.atkSpeed,
        baseAtkSpeed: def.atkSpeed,
        armor: def.armor,
        baseArmor: def.armor,
        range: def.range,
        unitClass: 'Struttura',
        race: 'Macchina',
        behavior: 'stationary',

        critChance: CRIT_CHANCE_BASE,
        dodgeChance: 0,
        atkSpeedMultiplier: 1.0,
        dmgMultiplier: 1.0,
        magicResist: 0,

        row: row, col: col,
        px: 0, py: 0,
        targetRow: -1, targetCol: -1,

        alive: true,
        atkTimer: def.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false,
        isStopped: true, // never moves

        items: [],
        learnedSkills: {},
        equippedSkills: [],
        skillCooldowns: {},

        tacticalOrder: ORDER_HOLD,
        tacticalTarget: null,
        tacticalMoveRow: -1,
        tacticalMoveCol: -1,

        survivalCount: 0,
        _needsRespawn: false,
        _consumableBuff: {},
        _curseDebuffs: [],
        effects: [],

        // Minimal character state
        coins: 0, hasTeleported: false, abilityCooldown: 999,
        enhancedRegenUsed: false, enhancedRegenTicks: 0,
        furiaActive: false, furiaTicks: 0, noHealDuringFuria: false,
        copiedClass: null, copiedRace: null, lastAllyAbility: null,
        deathPreventionUsed: false, nucleoUsed: false,
        reviving: false, reviveTicks: 0,
        killStacks: 0, velenoCharges: 0, cristalloApplied: false, amiciStacks: 0,

        // Structure special
        healPerTick: def.role === 'support' ? 0.02 : 0,
        healRadius: def.role === 'support' ? 3 : 0,
        debuffRadius: def.role === 'defense' ? 3 : 0,

        atkAnim: 0, hitAnim: 0, deathAnim: 0,
        facing: zone ? zone.facing : 1,
    };
}

// --- Check if cell is within range of any owned hero ---
function isWithinHeroRange(player, row, col, range) {
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var u = player.fieldUnits[i];
        if (u.isMilitia || u.isStructure) continue;
        if (chebyshevDist(u.row, u.col, row, col) <= range) return true;
    }
    return false;
}

// --- Buy and place a structure ---
function buyStructure(player, baseType, row, col) {
    if (!player || player.eliminated) return false;
    if ((player.structures || []).length >= MAX_STRUCTURES) return false;

    var mainHero = getMainHero(player);
    if (!mainHero) return false;

    var def = getStructureDef(mainHero.charId, baseType);
    if (!def) return false;

    if (!spendGold(player, def.cost)) return false;

    // Verify placement: valid cell, not occupied, within range of a hero
    if (!isValidCell(row, col)) { player.gold += def.cost; return false; }
    if (findPlayerUnitAtCell(player, row, col)) { player.gold += def.cost; return false; }
    if (!isWithinHeroRange(player, row, col, STRUCTURE_PLACE_RANGE)) { player.gold += def.cost; return false; }

    var unit = createStructureUnit(mainHero.charId, baseType, player.index, row, col);
    if (!unit) { player.gold += def.cost; return false; }

    if (!player.structures) player.structures = [];
    player.structures.push(unit);
    return true;
}

// --- Remove a structure ---
function removeStructure(player, unitId) {
    if (!player.structures) return false;
    for (var i = 0; i < player.structures.length; i++) {
        if (player.structures[i].id === unitId) {
            player.structures.splice(i, 1);
            return true;
        }
    }
    return false;
}

// --- Process santuario healing in combat ---
function processStructureHealing(allUnits) {
    for (var i = 0; i < allUnits.length; i++) {
        var s = allUnits[i];
        if (!s.alive || !s.isStructure) continue;
        if (!s.healPerTick || s.healPerTick <= 0) continue;
        for (var j = 0; j < allUnits.length; j++) {
            var ally = allUnits[j];
            if (!ally.alive || ally.owner !== s.owner || ally.id === s.id) continue;
            if (chebyshevDist(s.row, s.col, ally.row, ally.col) <= s.healRadius) {
                var heal = Math.round(ally.maxHp * s.healPerTick);
                if (heal > 0 && ally.hp < ally.maxHp) {
                    ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                }
            }
        }
    }
}

// --- Process bastione debuff in combat ---
function processStructureDebuff(allUnits, teams) {
    for (var i = 0; i < allUnits.length; i++) {
        var s = allUnits[i];
        if (!s.alive || !s.isStructure || !s.debuffRadius) continue;
        // Apply slow to nearby enemies
        for (var key in teams) {
            if (key === String(s.owner)) continue;
            var enemies = teams[key];
            for (var j = 0; j < enemies.length; j++) {
                var enemy = enemies[j];
                if (!enemy.alive) continue;
                if (chebyshevDist(s.row, s.col, enemy.row, enemy.col) <= s.debuffRadius) {
                    // Check if already has bastion slow
                    var hasDebuff = false;
                    for (var e = 0; e < enemy.effects.length; e++) {
                        if (enemy.effects[e].type === 'bastion_slow') { hasDebuff = true; break; }
                    }
                    if (!hasDebuff) {
                        enemy.effects.push({ type: 'bastion_slow', value: 0.15, ticksLeft: 2, stacking: 'refresh' });
                        // speed_reduction is now handled via effects in processAttack — no direct atkSpeed modification
                        if (typeof applyEffect === 'function') {
                            applyEffect(enemy, { type: 'speed_reduction', value: 0.15, ticksLeft: 2, stacking: 'refresh', sourceType: 'bastion' });
                        }
                    }
                }
            }
        }
    }
}

// --- Save structures after combat ---
function saveStructuresAfterCombat(playersList, teams) {
    for (var p = 0; p < playersList.length; p++) {
        var player = playersList[p];
        if (player.eliminated || !player.structures) continue;
        var teamKey = String(player.index);
        var combatTeam = teams[teamKey];
        if (!combatTeam) continue;

        var deadIds = [];
        for (var m = 0; m < player.structures.length; m++) {
            var struct = player.structures[m];
            for (var c = 0; c < combatTeam.length; c++) {
                if (combatTeam[c].id === struct.id) {
                    if (combatTeam[c].alive) {
                        var hpRatio = combatTeam[c].hp / combatTeam[c].maxHp;
                        struct.hp = Math.max(1, Math.round(struct.maxHp * hpRatio));
                    } else {
                        deadIds.push(struct.id);
                    }
                    break;
                }
            }
        }
        if (deadIds.length > 0) {
            player.structures = player.structures.filter(function(s) {
                return deadIds.indexOf(s.id) === -1;
            });
        }
    }
}

// --- Structure placement mode ---
var _structurePlaceMode = null; // { baseType }

function enterStructurePlaceMode(baseType) {
    _structurePlaceMode = { baseType: baseType };
    if (typeof showToast === 'function') showToast('Clicca su una cella vicino a un eroe per piazzare', 'info', '!');
}

function cancelStructurePlaceMode() {
    _structurePlaceMode = null;
}

// Called from board click handler
function tryPlaceStructure(player, row, col) {
    if (!_structurePlaceMode) return false;
    var ok = buyStructure(player, _structurePlaceMode.baseType, row, col);
    if (ok) {
        if (typeof playGoldSound === 'function') playGoldSound();
        var mainHero = getMainHero(player);
        var def = mainHero ? getStructureDef(mainHero.charId, _structurePlaceMode.baseType) : null;
        if (typeof showToast === 'function' && def) {
            showToast(def.icon + ' ' + def.name + ' piazzata!', 'gold', def.icon);
        }
        _structurePlaceMode = null;
        updateHUD(player, currentRound);
        if (typeof updateUnitRoster === 'function') updateUnitRoster(player);
        if (typeof renderStructureShop === 'function') renderStructureShop(player);
        return true;
    } else {
        if (typeof showToast === 'function') showToast('Posizione non valida! (entro 2 celle da un eroe)', 'danger', '!');
    }
    return false;
}

// --- Render structure shop ---
function renderStructureShop(player) {
    var section = document.getElementById('structure-section');
    if (!section) return;
    var listEl = document.getElementById('structure-list');
    if (!listEl) return;

    if (gamePhase !== PHASE_PLANNING) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';

    var mainHero = getMainHero(player);
    var mainCharId = mainHero ? mainHero.charId : null;
    var count = player.structures ? player.structures.length : 0;

    var html = '<div class="militia-header">';
    html += '<span class="militia-count">Strutture: ' + count + '/' + MAX_STRUCTURES;
    if (mainCharId) html += ' | Tema: ' + mainCharId;
    html += '</span></div>';

    if (!mainCharId) {
        html += '<div class="empty-message">Serve almeno un eroe per costruire</div>';
        listEl.innerHTML = html;
        return;
    }

    // Buy buttons
    html += '<div class="militia-shop">';
    for (var typeId in STRUCTURE_BASE_TYPES) {
        var def = getStructureDef(mainCharId, typeId);
        if (!def) continue;
        var canBuy = count < MAX_STRUCTURES && player.gold >= def.cost;
        var cls = 'militia-buy-btn' + (canBuy ? '' : ' disabled');
        html += '<button class="' + cls + '" data-struct-type="' + typeId + '" title="' + def.desc + '">';
        html += '<span class="militia-icon">' + def.icon + '</span>';
        html += '<span class="militia-name">' + def.name + '</span>';
        html += '<span class="militia-cost">' + def.cost + 'g</span>';
        html += '</button>';
    }
    html += '</div>';

    // Active structures
    if (count > 0) {
        html += '<div class="militia-roster">';
        for (var i = 0; i < player.structures.length; i++) {
            var s = player.structures[i];
            var sDef = getStructureDef(s.structureCharId, s.structureType);
            if (!sDef) continue;
            var hpPct = Math.round((s.hp / s.maxHp) * 100);
            var hpColor = hpPct > 60 ? '#34d399' : (hpPct > 30 ? '#fbbf24' : '#ef4444');

            html += '<div class="militia-card" data-struct-id="' + s.id + '">';
            html += '<div class="militia-card-top">';
            html += '<span class="militia-card-icon">' + sDef.icon + '</span>';
            html += '<span class="militia-card-name">' + sDef.name + '</span>';
            html += '<span class="militia-card-hp" style="color:' + hpColor + '">' + s.hp + '/' + s.maxHp + '</span>';
            html += '<button class="militia-dismiss-btn" data-struct-id="' + s.id + '" title="Demolisci">\u2717</button>';
            html += '</div>';
            html += '<div class="militia-hp-bar"><div class="militia-hp-fill" style="width:' + hpPct + '%;background:' + hpColor + '"></div></div>';
            html += '<div style="font-size:9px;color:#64748b;padding:2px 0">' + sDef.desc + ' | R:' + sDef.range + ' ATK:' + sDef.atk + '</div>';
            html += '</div>';
        }
        html += '</div>';
    }

    listEl.innerHTML = html;

    // Event delegation
    if (!listEl._structDelegated) {
        listEl._structDelegated = true;
        listEl.addEventListener('click', function(e) {
            var btn = e.target.closest ? e.target.closest('button') : null;
            if (!btn && e.target.parentElement && e.target.parentElement.tagName === 'BUTTON') btn = e.target.parentElement;
            if (!btn) return;

            if (btn.classList.contains('militia-buy-btn') && !btn.classList.contains('disabled')) {
                e.stopPropagation();
                var typeId = btn.getAttribute('data-struct-type');
                if (typeId) enterStructurePlaceMode(typeId);
                return;
            }

            if (btn.classList.contains('militia-dismiss-btn')) {
                e.stopPropagation();
                var sid = parseInt(btn.getAttribute('data-struct-id'));
                if (!isNaN(sid)) {
                    removeStructure(getHumanPlayer(), sid);
                    renderStructureShop(getHumanPlayer());
                    if (typeof updateUnitRoster === 'function') updateUnitRoster(getHumanPlayer());
                    if (typeof showToast === 'function') showToast('Struttura demolita', 'info', '!');
                }
                return;
            }
        });
    }
}

// --- AI structure logic ---
function aiStructureBuy(player) {
    if (!player || player.eliminated) return;
    var count = (player.structures || []).length;
    if (count >= MAX_STRUCTURES) return;
    if (player.gold < 8) return;

    var mainHero = getMainHero(player);
    if (!mainHero) return;

    // Pick type: prioritize santuario first, then torre, then bastione
    var types = ['santuario', 'torre', 'bastione', 'catapulta'];
    var has = {};
    for (var i = 0; i < (player.structures || []).length; i++) {
        has[player.structures[i].structureType] = true;
    }

    var typeId = null;
    for (var t = 0; t < types.length; t++) {
        if (!has[types[t]]) {
            var def = STRUCTURE_BASE_TYPES[types[t]];
            if (def && player.gold >= def.cost + 3) { typeId = types[t]; break; }
        }
    }
    if (!typeId) return;

    // Find valid placement cell near a hero
    for (var h = 0; h < player.fieldUnits.length; h++) {
        var hero = player.fieldUnits[h];
        if (hero.isMilitia || hero.isStructure) continue;
        for (var dr = -STRUCTURE_PLACE_RANGE; dr <= STRUCTURE_PLACE_RANGE; dr++) {
            for (var dc = -STRUCTURE_PLACE_RANGE; dc <= STRUCTURE_PLACE_RANGE; dc++) {
                var r = hero.row + dr;
                var c = hero.col + dc;
                if (!isValidCell(r, c)) continue;
                if (findPlayerUnitAtCell(player, r, c)) continue;
                if (buyStructure(player, typeId, r, c)) return;
            }
        }
    }
}
