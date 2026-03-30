// ============================================================
// LOTA AUTO CHESS — items.js — Item equipping & stat system
// ============================================================

// --- Equip an item from player inventory to a unit on the field ---
// Returns true if successful.
function equipItem(player, itemId, unitIndex) {
    if (!player || unitIndex < 0 || unitIndex >= player.fieldUnits.length) return false;

    var unit = player.fieldUnits[unitIndex];
    if (!unit) return false;

    // Max 3 items per unit
    if (unit.items.length >= MAX_ITEMS_PER_UNIT) return false;

    // Check item exists in inventory
    var invIdx = player.inventory.indexOf(itemId);
    if (invIdx < 0) return false;

    // Special restriction: Codice dell'Oracolo requires WMS star 3
    var item = ITEMS[itemId];
    if (!item) return false;
    if (item.restriction === 'WMS_star3') {
        if (unit.charId !== 'WMS' || unit.star < 3) return false;
    }

    // Remove from inventory
    player.inventory.splice(invIdx, 1);

    // Add to unit
    unit.items.push(itemId);

    // Recalculate unit stats
    recalcUnitStats(unit);

    return true;
}

// --- Unequip an item from a unit back to player inventory ---
// Returns true if successful.
function unequipItem(player, unitIndex, itemSlotIndex) {
    if (!player) return false;

    // Unit can be on field or bench
    var unit = null;
    if (unitIndex >= 0 && unitIndex < player.fieldUnits.length) {
        unit = player.fieldUnits[unitIndex];
    }
    // If not found on field, try bench
    if (!unit && unitIndex >= player.fieldUnits.length) {
        var benchIdx = unitIndex - player.fieldUnits.length;
        if (benchIdx >= 0 && benchIdx < player.benchUnits.length) {
            unit = player.benchUnits[benchIdx];
        }
    }
    if (!unit) return false;

    if (itemSlotIndex < 0 || itemSlotIndex >= unit.items.length) return false;

    var itemId = unit.items[itemSlotIndex];

    // Remove from unit
    unit.items.splice(itemSlotIndex, 1);

    // Add back to inventory
    player.inventory.push(itemId);

    // Recalculate unit stats
    recalcUnitStats(unit);

    return true;
}

// --- Get computed stats for a unit including all item bonuses ---
// Returns an object with final stat values. Does NOT modify the unit.
function getComputedStats(unit) {
    if (!unit) return { hp: 0, atk: 0, armor: 0, atkSpeed: 1.0, critChance: 0, range: 0 };

    var charDef = CHARACTERS[unit.charId];
    var hp, atk, armor, atkSpeed, critChance, range;

    if (charDef) {
        var starIdx = Math.min(unit.star - 1, charDef.stats.length - 1);
        var base = charDef.stats[starIdx];
        hp = base.hp;
        atk = base.atk;
        armor = charDef.armor;
        atkSpeed = charDef.atkSpeed;
        critChance = CRIT_CHANCE_BASE;
        range = charDef.range;
    } else {
        // Creep or unknown
        hp = unit.maxHp;
        atk = unit.baseAtk;
        armor = unit.baseArmor;
        atkSpeed = unit.baseAtkSpeed;
        critChance = unit.critChance || CRIT_CHANCE_BASE;
        range = unit.range || 1;
    }

    var atkSpeedMultiplier = 1.0;

    // Apply item bonuses
    if (unit.items) {
        for (var i = 0; i < unit.items.length; i++) {
            var item = ITEMS[unit.items[i]];
            if (!item) continue;
            if (item.bonusHp) hp += item.bonusHp;
            if (item.bonusAtk) atk += item.bonusAtk;
            if (item.bonusArmor) armor += item.bonusArmor;
            if (item.bonusCrit) critChance += item.bonusCrit;
            if (item.bonusAtkSpeed) atkSpeedMultiplier += item.bonusAtkSpeed;
            if (item.atkSpeedPenalty) atkSpeedMultiplier += item.atkSpeedPenalty;
        }
    }

    // Effective attack speed (lower = faster attacks)
    var effectiveAtkSpeed = atkSpeed / atkSpeedMultiplier;

    return {
        hp: hp,
        atk: atk,
        armor: armor,
        atkSpeed: effectiveAtkSpeed,
        critChance: critChance,
        range: range,
    };
}

// --- Check if Codice dell'Oracolo can drop for this player ---
// True only if the player has a WMS at star 3 on field or bench.
function canDropCodiceOracolo(player) {
    if (!player) return false;

    var allUnits = player.fieldUnits.concat(player.benchUnits);
    for (var i = 0; i < allUnits.length; i++) {
        if (allUnits[i].charId === 'WMS' && allUnits[i].star >= 3) {
            return true;
        }
    }
    return false;
}

// --- Generate a weighted random item drop for a PvE round ---
// tier: 1, 2, or 3. Respects Codice restriction.
function rollItemDrop(player, tier) {
    var tierDef = ITEM_TIERS[tier];
    if (!tierDef) return null;

    var candidates = [];
    var totalWeight = 0;

    for (var i = 0; i < tierDef.items.length; i++) {
        var itemId = tierDef.items[i];
        var item = ITEMS[itemId];
        if (!item) continue;

        // Codice dell'Oracolo restriction
        if (item.restriction === 'WMS_star3' && !canDropCodiceOracolo(player)) {
            continue;
        }

        candidates.push({ id: itemId, weight: item.weight });
        totalWeight += item.weight;
    }

    if (totalWeight <= 0 || candidates.length === 0) return null;

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var i = 0; i < candidates.length; i++) {
        cumulative += candidates[i].weight;
        if (roll < cumulative) {
            return candidates[i].id;
        }
    }

    // Fallback
    return candidates[candidates.length - 1].id;
}

// --- Get a formatted item description for UI display ---
function getItemDescription(itemId) {
    var item = ITEMS[itemId];
    if (!item) return 'Item sconosciuto';

    var lines = [item.name + ' (Tier ' + item.tier + ')'];

    if (item.bonusHp) lines.push('+' + item.bonusHp + ' HP');
    if (item.bonusAtk) lines.push('+' + item.bonusAtk + ' ATK');
    if (item.bonusArmor) lines.push('+' + item.bonusArmor + ' Armatura');
    if (item.bonusCrit) lines.push('+' + Math.round(item.bonusCrit * 100) + '% Crit');
    if (item.bonusAtkSpeed) lines.push('+' + Math.round(item.bonusAtkSpeed * 100) + '% Velocita ATK');
    if (item.atkSpeedPenalty) lines.push(Math.round(item.atkSpeedPenalty * 100) + '% Velocita ATK');

    // Special effects
    if (item.onHit) {
        if (item.onHit.procChance) {
            lines.push('On Hit (' + Math.round(item.onHit.procChance * 100) + '%): ' + item.onHit.effect);
        }
        if (item.onHit.poison) {
            lines.push('On Hit: Veleno ' + Math.round(item.onHit.poisonPerTick * 100) + '%/tick x' + item.onHit.poisonTicks);
        }
    }
    if (item.onKill) {
        if (typeof item.onKill === 'object') {
            if (item.onKill.stacksGained) {
                lines.push('On Kill: +' + item.onKill.stacksGained + ' stack (max ' + item.onKill.maxStacks + ')');
            }
            if (item.onKill.goldBonus) {
                lines.push('On Kill: +' + item.onKill.goldBonus + ' Oro');
            }
        } else if (item.onKill === 'bonus_attack') {
            lines.push('On Kill: Attacco bonus');
        }
    }
    if (item.regenPerTick) {
        lines.push('Regen: ' + Math.round(item.regenPerTick * 100) + '% HP/tick');
    }
    if (item.atkPerAlly) {
        lines.push('+' + Math.round(item.atkPerAlly * 100) + '% ATK per alleato');
    }
    if (item.atkIfLastSurvivor) {
        lines.push('+' + Math.round(item.atkIfLastSurvivor * 100) + '% ATK se ultimo sopravvissuto');
    }
    if (item.deathPrevention) {
        lines.push('Previene morte 1 volta (sopravvive con 1 HP)');
    }
    if (item.belowHalf) {
        if (item.belowHalf.regen) {
            lines.push('Sotto 50% HP: +' + Math.round(item.belowHalf.regen * 100) + '% regen');
        }
    }
    if (item.onDeath) {
        if (item.onDeath.aoeDmgPercent) {
            lines.push('On Death: ' + Math.round(item.onDeath.aoeDmgPercent * 100) + '% MaxHP AOE');
        }
        if (item.onDeath.surviveAt) {
            lines.push('On Death: Sopravvive e rivive con ' + Math.round(item.onDeath.reviveHpPercent * 100) + '% HP');
        }
    }
    if (item.onSurvive) {
        lines.push('Se sopravvive: +' + item.onSurvive.goldBonus + ' Oro');
    }
    if (item.oncePerMatch) {
        lines.push('(Una volta per partita)');
    }
    if (item.debuffDurMult) {
        lines.push('Debuff durata x' + item.debuffDurMult);
    }
    if (item.onKillDebuffed) {
        lines.push('Kill su debuffato: Cura ' + Math.round(item.onKillDebuffed.healPercent * 100) + '% HP');
    }
    if (item.effect === 'counts_as_2_for_synergy') {
        lines.push('Conta come 2 per le sinergie');
    }
    if (item.effect === 'wms_gli_amici_solo') {
        lines.push('Attiva "Gli Amici" solo con WMS');
    }
    if (item.restriction === 'WMS_star3') {
        lines.push('(Solo WMS Stella 3)');
    }
    if (item.allyBelow30) {
        lines.push('Alleati sotto 30% HP: +' + Math.round(item.allyBelow30.atkBonus * 100) + '% ATK');
    }

    return lines.join('\n');
}
