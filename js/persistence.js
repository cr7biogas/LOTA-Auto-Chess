// ============================================================
// LOTA AUTO CHESS — persistence.js — Persistent positions,
// respawn, survival bonuses, consumables & traps
// ============================================================

// =============================================
// SURVIVAL BONUSES (cumulative per character)
// =============================================
const SURVIVAL_BONUSES = {
    Babidi: {
        perSurvival:  { goldIncome: 0.2 },
        per3Survivals: { poisonDmgBonus: 0.05 },
        icon: '💰', desc: '+0.2g income | ogni 3: +5% veleno',
    },
    Caronte: {
        perSurvival:  { tesiDmgBonus: 0.02 },
        per3Survivals: { tesiCdReduction: 1 },
        icon: '📜', desc: '+2% Tesi | ogni 3: -1 CD Tesi',
    },
    Valerio: {
        perSurvival:  { maxHpPercent: 0.02 },
        per3Survivals: { armorFlat: 1 },
        icon: '🛡', desc: '+2% maxHP | ogni 3: +1 armor',
    },
    Yujin: {
        perSurvival:  { atkPercent: 0.03 },
        per3Survivals: { lifestealFlat: 0.005 },
        icon: '⚔', desc: '+3% ATK | ogni 3: +0.5% lifesteal',
    },
    WMS: {
        perSurvival:  { allStatPercent: 0.02 },
        per3Survivals: { ecoCdReduction: 1 },
        icon: '✨', desc: '+2% stats | ogni 3: -1 CD Eco',
    },
};

// =============================================
// CONSUMABLES
// =============================================
const CONSUMABLES = {
    // --- Pozioni ---
    pozione_vita:     { id: 'pozione_vita',     name: 'Pozione di Vita',     icon: '🧪', tier: 1, cost: 2, type: 'heal',       value: 0.30, target: 'ally',  desc: 'Cura 30% maxHP' },
    pozione_forza:    { id: 'pozione_forza',    name: 'Pozione di Forza',    icon: '💪', tier: 1, cost: 3, type: 'buff_atk',   value: 0.15, target: 'ally',  desc: '+15% ATK per 1 combat' },
    pozione_velocita: { id: 'pozione_velocita', name: 'Pozione Velocita',    icon: '⚡', tier: 1, cost: 3, type: 'buff_speed', value: 0.20, target: 'ally',  desc: '+20% vel. attacco 1 combat' },
    pozione_mana:     { id: 'pozione_mana',     name: 'Pozione Arcana',      icon: '🔮', tier: 2, cost: 5, type: 'cd_reset',   value: 0,    target: 'ally',  desc: 'Resetta tutti i CD skill' },
    // --- Pergamene ---
    pergamena_scudo:    { id: 'pergamena_scudo',    name: 'Pergamena Scudo',    icon: '🛡', tier: 1, cost: 3, type: 'buff_shield', value: 0.20, target: 'ally',         desc: 'Scudo 20% maxHP al prossimo combat' },
    pergamena_teleporto:{ id: 'pergamena_teleporto',name: 'Pergamena Teleporto',icon: '📜', tier: 2, cost: 4, type: 'teleport',    value: 0,    target: 'ally_to_cell', desc: 'Teletrasporta a qualsiasi cella' },
    pergamena_visione:  { id: 'pergamena_visione',  name: 'Pergamena Visione',  icon: '👁', tier: 2, cost: 3, type: 'reveal',      value: 0,    target: 'global',       desc: 'Rivela posizione trappole nemiche' },
    // --- Trappole ---
    trappola_veleno:    { id: 'trappola_veleno',    name: 'Trappola Veleno',    icon: '🪤', tier: 1, cost: 2, type: 'trap', effect: 'poison',         value: 0.03, duration: 3, target: 'cell', desc: 'Avvelena (3% maxHP/t, 3t)' },
    trappola_gelo:      { id: 'trappola_gelo',      name: 'Trappola Gelo',      icon: '❄',  tier: 2, cost: 4, type: 'trap', effect: 'freeze',         value: 0,    duration: 2, target: 'cell', desc: 'Congela 2 tick' },
    trappola_esplosiva: { id: 'trappola_esplosiva', name: 'Trappola Esplosiva', icon: '💣', tier: 2, cost: 5, type: 'trap', effect: 'damage',         value: 0.15, duration: 0, target: 'cell', desc: '15% maxHP danno' },
    trappola_rallentante:{ id: 'trappola_rallentante',name:'Trappola Rallentante',icon:'🕸',tier: 1, cost: 2, type: 'trap', effect: 'speed_reduction', value: 0.30, duration: 3, target: 'cell', desc: 'Slow 30% per 3 tick' },
    // --- Maledizioni ---
    maledizione_debolezza:{ id: 'maledizione_debolezza', name: 'Maledizione Debolezza', icon: '💀', tier: 2, cost: 4, type: 'curse', effect: 'atk_reduction',   value: 0.20, duration: 5, target: 'enemy', desc: '-20% ATK nemico 5 tick' },
    maledizione_lentezza: { id: 'maledizione_lentezza',  name: 'Maledizione Lentezza',  icon: '🐌', tier: 2, cost: 4, type: 'curse', effect: 'speed_reduction', value: 0.25, duration: 4, target: 'enemy', desc: '-25% speed nemico 4 tick' },
    maledizione_silenzio: { id: 'maledizione_silenzio',  name: 'Maledizione Silenzio',  icon: '🤐', tier: 3, cost: 6, type: 'curse', effect: 'silence',         value: 0,    duration: 3, target: 'enemy', desc: 'Silence nemico 3 tick' },
};

const CONSUMABLE_TIERS = {
    1: { items: ['pozione_vita','pozione_forza','pozione_velocita','pergamena_scudo','trappola_veleno','trappola_rallentante'] },
    2: { items: ['pozione_mana','pergamena_teleporto','pergamena_visione','trappola_gelo','trappola_esplosiva','maledizione_debolezza','maledizione_lentezza'] },
    3: { items: ['maledizione_silenzio'] },
};

// =============================================
// PERSISTENT POSITIONS — after combat, save unit positions
// =============================================
function savePositionsAfterCombat(playersList, teams) {
    for (var p = 0; p < playersList.length; p++) {
        var player = playersList[p];
        if (player.eliminated) continue;
        var teamKey = String(typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index);
        var combatTeam = teams[teamKey];
        if (!combatTeam) continue;

        for (var c = 0; c < combatTeam.length; c++) {
            var clone = combatTeam[c];
            for (var u = 0; u < player.fieldUnits.length; u++) {
                if (player.fieldUnits[u].id === clone.id) {
                    if (clone.alive) {
                        player.fieldUnits[u].row = clone.row;
                        player.fieldUnits[u].col = clone.col;
                        player.fieldUnits[u].px = 0;
                        player.fieldUnits[u].py = 0;
                        // Update HP to remaining (not full)
                        var hpRatio = clone.hp / clone.maxHp;
                        player.fieldUnits[u].hp = Math.max(1, Math.round(player.fieldUnits[u].maxHp * hpRatio));
                    } else {
                        player.fieldUnits[u]._needsRespawn = true;
                        player.fieldUnits[u]._respawnRound = (typeof currentRound !== 'undefined' ? currentRound : 0) + 1;
                    }
                    break;
                }
            }
        }
    }
}

// =============================================
// RESPAWN — dead units respawn at base next round at 70% HP
// =============================================
function respawnDeadUnits(player) {
    if (!player || player.eliminated) return;
    var zone = getDeployZone(typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index);
    if (!zone || !zone.cells) return;

    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        if (!unit._needsRespawn) continue;

        unit._needsRespawn = false;
        unit.hp = Math.round(unit.maxHp * 0.70);
        unit.alive = true;
        unit.effects = [];

        // Find empty cell in deploy zone (check heroes + militia)
        for (var c = 0; c < zone.cells.length; c++) {
            var cell = zone.cells[c];
            var occupant = findPlayerUnitAtCell(player, cell.r, cell.c);
            var occupied = occupant && occupant.id !== unit.id;
            if (!occupied) {
                unit.row = cell.r;
                unit.col = cell.c;
                unit.px = 0; unit.py = 0;
                break;
            }
        }

        combatLog.push(unit.charId + ' respawna alla base!');
    }
}

// =============================================
// SURVIVAL BONUSES — apply after combat for survivors
// =============================================
function applySurvivalBonuses(player, teams) {
    if (!player || player.eliminated) return;
    var teamKey = String(typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index);
    var combatTeam = teams[teamKey];
    if (!combatTeam) return;

    for (var c = 0; c < combatTeam.length; c++) {
        var clone = combatTeam[c];
        if (!clone.alive) continue;

        // Find original
        for (var u = 0; u < player.fieldUnits.length; u++) {
            var orig = player.fieldUnits[u];
            if (orig.id !== clone.id) continue;

            orig.survivalCount = (orig.survivalCount || 0) + 1;
            var bonusDef = SURVIVAL_BONUSES[orig.charId];
            if (!bonusDef) break;

            // Per-survival bonus
            var ps = bonusDef.perSurvival;
            if (ps.goldIncome) {
                orig._survivalGoldIncome = (orig._survivalGoldIncome || 0) + ps.goldIncome;
            }
            if (ps.tesiDmgBonus) {
                orig._survivalTesiBonus = (orig._survivalTesiBonus || 0) + ps.tesiDmgBonus;
            }
            if (ps.maxHpPercent) {
                var bonus = Math.round(orig.maxHp * ps.maxHpPercent);
                orig.maxHp += bonus;
                orig.hp += bonus;
            }
            if (ps.atkPercent) {
                var bonus = Math.round(orig.atk * ps.atkPercent);
                orig.atk += bonus;
                orig.baseAtk += bonus;
            }
            if (ps.allStatPercent) {
                var hpB = Math.round(orig.maxHp * ps.allStatPercent);
                var atkB = Math.round(orig.atk * ps.allStatPercent);
                orig.maxHp += hpB; orig.hp += hpB;
                orig.atk += atkB; orig.baseAtk += atkB;
            }

            // Per-3-survivals bonus
            if (orig.survivalCount % 3 === 0) {
                var p3 = bonusDef.per3Survivals;
                if (p3.poisonDmgBonus) {
                    orig._survivalPoisonBonus = (orig._survivalPoisonBonus || 0) + p3.poisonDmgBonus;
                }
                if (p3.tesiCdReduction) {
                    orig._survivalTesiCdReduction = (orig._survivalTesiCdReduction || 0) + p3.tesiCdReduction;
                }
                if (p3.armorFlat) {
                    orig.armor += p3.armorFlat;
                    orig.baseArmor += p3.armorFlat;
                }
                if (p3.lifestealFlat) {
                    orig._survivalLifesteal = (orig._survivalLifesteal || 0) + p3.lifestealFlat;
                }
                if (p3.ecoCdReduction) {
                    orig._survivalEcoCdReduction = (orig._survivalEcoCdReduction || 0) + p3.ecoCdReduction;
                }
            }

            break;
        }
    }
}

// Apply survival gold income during economy phase
function applySurvivalIncome(player) {
    if (!player) return;
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        if (unit._survivalGoldIncome && unit._survivalGoldIncome > 0) {
            addGold(player, unit._survivalGoldIncome, true);
        }
    }
}

// =============================================
// CONSUMABLE SYSTEM
// =============================================

// Consumable drop weights (higher = more common)
var CONSUMABLE_WEIGHTS = {
    pozione_vita: 20, pozione_forza: 15, pozione_velocita: 15,
    pergamena_scudo: 15, trappola_veleno: 18, trappola_rallentante: 17,
    pozione_mana: 10, pergamena_teleporto: 8, pergamena_visione: 12,
    trappola_gelo: 12, trappola_esplosiva: 10,
    maledizione_debolezza: 14, maledizione_lentezza: 14,
    maledizione_silenzio: 10,
};

// Roll a random consumable drop (weighted by rarity)
function rollConsumableDrop(tier) {
    var tierDef = CONSUMABLE_TIERS[tier];
    if (!tierDef || !tierDef.items.length) tierDef = CONSUMABLE_TIERS[1];
    var items = tierDef.items;
    var totalWeight = 0;
    for (var i = 0; i < items.length; i++) {
        totalWeight += CONSUMABLE_WEIGHTS[items[i]] || 10;
    }
    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < items.length; i++) {
        cumulative += CONSUMABLE_WEIGHTS[items[i]] || 10;
        if (roll <= cumulative) return items[i];
    }
    return items[items.length - 1];
}

// Use a consumable on a target (during planning)
function useConsumable(player, consumableId, targetUnit, targetRow, targetCol) {
    if (!player) return false;
    var idx = player.consumables.indexOf(consumableId);
    if (idx < 0) return false;

    var def = CONSUMABLES[consumableId];
    if (!def) return false;

    switch (def.type) {
        case 'heal':
            if (!targetUnit) return false;
            var heal = Math.round(targetUnit.maxHp * def.value);
            targetUnit.hp = Math.min(targetUnit.maxHp, targetUnit.hp + heal);
            break;

        case 'buff_atk':
            if (!targetUnit) return false;
            targetUnit._consumableBuff = targetUnit._consumableBuff || {};
            targetUnit._consumableBuff.atkMult = (targetUnit._consumableBuff.atkMult || 1) + def.value;
            break;

        case 'buff_speed':
            if (!targetUnit) return false;
            targetUnit._consumableBuff = targetUnit._consumableBuff || {};
            targetUnit._consumableBuff.atkSpeedMult = (targetUnit._consumableBuff.atkSpeedMult || 1) + def.value;
            break;

        case 'buff_shield':
            if (!targetUnit) return false;
            targetUnit._consumableBuff = targetUnit._consumableBuff || {};
            targetUnit._consumableBuff.shield = (targetUnit._consumableBuff.shield || 0) + Math.round(targetUnit.maxHp * def.value);
            break;

        case 'cd_reset':
            if (!targetUnit) return false;
            if (targetUnit.skillCooldowns) {
                for (var key in targetUnit.skillCooldowns) {
                    targetUnit.skillCooldowns[key] = 0;
                }
            }
            break;

        case 'teleport':
            if (!targetUnit || targetRow === undefined) return false;
            if (!isValidCell(targetRow, targetCol)) return false;
            targetUnit.row = targetRow;
            targetUnit.col = targetCol;
            targetUnit.px = 0; targetUnit.py = 0;
            break;

        case 'reveal':
            // Reveal all enemy traps (mark as visible)
            for (var p = 0; p < players.length; p++) {
                if (players[p].index === player.index) continue;
                if (players[p].activeTraps) {
                    for (var t = 0; t < players[p].activeTraps.length; t++) {
                        players[p].activeTraps[t].revealed = true;
                    }
                }
            }
            break;

        case 'trap':
            if (targetRow === undefined || !isValidCell(targetRow, targetCol)) return false;
            if (!player.activeTraps) player.activeTraps = [];
            player.activeTraps.push({
                row: targetRow, col: targetCol,
                effect: def.effect, value: def.value, duration: def.duration,
                ownerId: typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index, consumableId: consumableId,
                revealed: false, triggered: false,
            });
            break;

        case 'curse':
            if (!targetUnit) return false;
            targetUnit._curseDebuffs = targetUnit._curseDebuffs || [];
            targetUnit._curseDebuffs.push({
                type: def.effect, value: def.value, duration: def.duration,
            });
            break;

        default:
            return false;
    }

    // Consume it
    player.consumables.splice(idx, 1);
    return true;
}

// =============================================
// TRAPS — trigger during combat movement
// =============================================
function processTraps(unit, grid, allPlayers) {
    if (!unit || !unit.alive) return;
    for (var p = 0; p < allPlayers.length; p++) {
        var player = allPlayers[p];
        var pSlot = (typeof getPlayerSlot === 'function') ? getPlayerSlot(player) : player.index;
        if (pSlot === unit.owner) continue; // Don't trigger own traps
        if (!player.activeTraps) continue;

        for (var t = player.activeTraps.length - 1; t >= 0; t--) {
            var trap = player.activeTraps[t];
            if (trap.triggered) continue;
            if (trap.row !== unit.row || trap.col !== unit.col) continue;

            // TRIGGERED!
            trap.triggered = true;

            switch (trap.effect) {
                case 'poison':
                    applyEffect(unit, { type: 'poison', value: Math.round(unit.maxHp * trap.value), ticksLeft: trap.duration, stacking: 'refresh', sourceType: 'trap' });
                    break;
                case 'freeze':
                    applyEffect(unit, { type: 'freeze', ticksLeft: trap.duration, sourceType: 'trap' });
                    break;
                case 'damage':
                    var dmg = Math.round(unit.maxHp * trap.value);
                    unit.hp -= dmg;
                    addDamageNumber(unit, dmg, 'normal');
                    if (unit.hp <= 0) { unit.hp = 0; unit.alive = false; }
                    break;
                case 'speed_reduction':
                    applyEffect(unit, { type: 'speed_reduction', value: trap.value, ticksLeft: trap.duration, sourceType: 'trap' });
                    break;
            }

            // VFX
            if (typeof vfxAOE === 'function') {
                var tp = cellToPixel(trap.row, trap.col);
                vfxAOE(tp.x, tp.y, 0.5, trap.effect === 'freeze' ? '#93c5fd' : '#ef4444');
            }

            combatLog.push('Trappola attivata su ' + unit.charId + '!');

            // Remove triggered trap
            player.activeTraps.splice(t, 1);
        }
    }
}

// Apply curse debuffs at combat start
function applyCurseDebuffs(combatClone) {
    if (!combatClone._curseDebuffs) return;
    for (var i = 0; i < combatClone._curseDebuffs.length; i++) {
        var curse = combatClone._curseDebuffs[i];
        applyEffect(combatClone, { type: curse.type, value: curse.value || 0, ticksLeft: curse.duration, sourceType: 'curse' });
    }
    combatClone._curseDebuffs = [];
}

// Apply consumable buffs at combat start
function applyConsumableBuffs(combatClone) {
    if (!combatClone._consumableBuff) return;
    var buff = combatClone._consumableBuff;
    if (buff.atkMult && buff.atkMult > 1) {
        combatClone.dmgMultiplier *= buff.atkMult;
    }
    if (buff.atkSpeedMult && buff.atkSpeedMult > 1) {
        combatClone.atkSpeedMultiplier *= buff.atkSpeedMult;
    }
    if (buff.shield && buff.shield > 0) {
        combatClone.shield += buff.shield;
    }
    combatClone._consumableBuff = {};
}

// Apply survival combat bonuses (Tesi bonus, lifesteal, etc.)
function applySurvivalCombatBuffs(combatClone) {
    if (combatClone._survivalTesiBonus && combatClone.charId === 'Caronte') {
        combatClone._tesiDmgBonusFlat = combatClone._survivalTesiBonus;
    }
    if (combatClone._survivalTesiCdReduction && combatClone.charId === 'Caronte') {
        combatClone.abilityCooldown = Math.max(1, combatClone.abilityCooldown - combatClone._survivalTesiCdReduction);
    }
    if (combatClone._survivalLifesteal) {
        combatClone._lifestealPercent = (combatClone._lifestealPercent || 0) + combatClone._survivalLifesteal;
        combatClone._lifestealTicks = 999;
    }
    if (combatClone._survivalPoisonBonus && combatClone.charId === 'Babidi') {
        combatClone._survivalPoisonMult = 1 + combatClone._survivalPoisonBonus;
    }
    if (combatClone._survivalEcoCdReduction && combatClone.charId === 'WMS') {
        combatClone.abilityCooldown = Math.max(1, combatClone.abilityCooldown - combatClone._survivalEcoCdReduction);
    }
}

// Buy a consumable from the shop
function buyConsumable(player, consumableId) {
    if (!player) return false;
    var def = CONSUMABLES[consumableId];
    if (!def || !def.cost) return false;
    if (player.gold < def.cost) return false;
    player.gold -= def.cost;
    if (!player.consumables) player.consumables = [];
    player.consumables.push(consumableId);
    return true;
}

// Get list of consumables available in shop based on round
function getShopConsumables(round) {
    var available = [];
    for (var key in CONSUMABLES) {
        var def = CONSUMABLES[key];
        if (!def.cost) continue;
        // Tier 1: always available. Tier 2: round 10+. Tier 3: round 25+.
        if (def.tier === 1) available.push(key);
        else if (def.tier === 2 && round >= 10) available.push(key);
        else if (def.tier === 3 && round >= 25) available.push(key);
    }
    return available;
}

// Get consumable description for UI
function getConsumableDescription(consumableId) {
    var def = CONSUMABLES[consumableId];
    if (!def) return 'Sconosciuto';
    return def.name + ' — ' + def.desc;
}
