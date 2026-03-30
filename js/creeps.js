// ============================================================
// LOTA AUTO CHESS — creeps.js — PvE creeps + neutral camps
// ============================================================

function getCreepForRound(round) {
    for (var i = 0; i < CREEPS.length; i++) {
        if (CREEPS[i].round === round) return CREEPS[i];
    }
    return null;
}

function spawnCreepUnits(round) {
    var creepDef = getCreepForRound(round);
    if (!creepDef) return [];
    var center = getBoardCenter();
    var unit = createCreepUnit(creepDef, center.r, center.c);
    var pos = cellToPixel(center.r, center.c);
    unit.px = pos.x; unit.py = pos.y;
    return [unit];
}

// --- Camp Creep Tier for current round ---
function getCampTierForRound(round) {
    var tiers = Object.values(CAMP_CREEP_TIERS);
    for (var i = tiers.length - 1; i >= 0; i--) {
        if (round >= tiers[i].minRound && round <= tiers[i].maxRound) return tiers[i];
    }
    return tiers[0];
}

// --- Progressive scaling: stats grow within each tier ---
function getScaledCampStats(round) {
    var tier = getCampTierForRound(round);
    var progress = (round - tier.minRound) / Math.max(1, tier.maxRound - tier.minRound);
    var scale = 1.0 + progress * 0.6; // +0% to +60% within tier
    return {
        name: tier.name,
        hp: Math.round(tier.hp * scale),
        atk: Math.round(tier.atk * scale),
        armor: Math.round(tier.armor * (1 + progress * 0.3)),
        atkSpeed: Math.max(0.8, tier.atkSpeed - progress * 0.2),
        range: tier.range || 1,
        goldReward: Math.round((tier.goldReward + progress * 1.0) * 10) / 10,
        itemTier: tier.itemTier || null,
        consumableTier: tier.consumableTier || null,
        mobCount: tier.mobCount || 1,
        ability: tier.ability,
    };
}

// --- Create a camp creep unit ---
function createCampCreepUnit(campId, stats, row, col, isMini) {
    var hpMult = isMini ? 0.5 : 1.0;
    var atkMult = isMini ? 0.6 : 1.0;
    return {
        id: genUnitId(),
        charId: 'camp_' + campId,
        owner: 'camp_' + campId,
        star: 1,
        maxHp: Math.round(stats.hp * hpMult),
        hp: Math.round(stats.hp * hpMult),
        atk: Math.round(stats.atk * atkMult),
        baseAtk: Math.round(stats.atk * atkMult),
        atkSpeed: isMini ? stats.atkSpeed * 0.85 : stats.atkSpeed,
        baseAtkSpeed: isMini ? stats.atkSpeed * 0.85 : stats.atkSpeed,
        armor: isMini ? Math.max(0, stats.armor - 2) : stats.armor,
        baseArmor: isMini ? Math.max(0, stats.armor - 2) : stats.armor,
        range: stats.range,
        unitClass: 'Camp',
        race: 'Neutrale',
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
        atkTimer: stats.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false, isStopped: true,
        items: [], effects: [],
        coins: 0, hasTeleported: false, abilityCooldown: 999,
        enhancedRegenUsed: false, enhancedRegenTicks: 0,
        furiaActive: false, furiaTicks: 0, noHealDuringFuria: false,
        copiedClass: null, copiedRace: null, lastAllyAbility: null,
        deathPreventionUsed: false, nucleoUsed: false, reviving: false, reviveTicks: 0,
        killStacks: 0, velenoCharges: 0, cristalloApplied: false, amiciStacks: 0,
        atkAnim: 0, hitAnim: 0, deathAnim: 0, facing: 0,
        creepAbility: stats.ability,
        creepName: (isMini ? 'Mini ' : '') + stats.name + ' (' + campId + ')',
        creepTier: 0,
        campId: campId,
        isMiniCreep: !!isMini,
        campReward: isMini
            ? { gold: Math.round(stats.goldReward * 0.4 * 10) / 10 }
            : { gold: stats.goldReward, itemTier: stats.itemTier, consumableTier: stats.consumableTier },
    };
}

// --- Spawn all 4 camp creeps for a round (with minions at higher tiers) ---
function spawnCampCreeps(round) {
    var stats = getScaledCampStats(round);
    var units = {};
    for (var campId in CREEP_CAMP_POSITIONS) {
        var cells = CREEP_CAMP_POSITIONS[campId];
        var cellIdx = Math.min(1, cells.length - 1);
        var cell = cells[cellIdx];
        // Main creep
        var main = createCampCreepUnit(campId, stats, cell.r, cell.c, false);
        var pos = cellToPixel(cell.r, cell.c);
        main.px = pos.x; main.py = pos.y;
        units[campId] = main;
        // Extra minions at late/endgame
        if (stats.mobCount >= 2 && cells.length >= 2) {
            var mCell = cells[0]; // use first cell of cluster
            var mini = createCampCreepUnit(campId, stats, mCell.r, mCell.c, true);
            var mPos = cellToPixel(mCell.r, mCell.c);
            mini.px = mPos.x; mini.py = mPos.y;
            units[campId + '_mini'] = mini;
        }
    }
    return units;
}

// --- Award reward when a camp creep is killed ---
function awardCampReward(killerOwner, campUnit, round) {
    if (typeof killerOwner !== 'number' || killerOwner < 0 || killerOwner >= players.length) return;
    var player = players[killerOwner];
    if (!player || player.eliminated) return;

    var reward = campUnit.campReward;
    if (!reward) return;

    // Gold reward
    if (reward.gold > 0) {
        addGold(player, reward.gold, true);
    }

    // Item reward
    var droppedItem = null;
    if (reward.itemTier) {
        droppedItem = rollItemFromTier(reward.itemTier, player);
        if (droppedItem) {
            if (!player.inventory) player.inventory = [];
            player.inventory.push(droppedItem);
        }
    }

    // Consumable reward
    var droppedConsumable = null;
    if (reward.consumableTier && typeof rollConsumableDrop === 'function') {
        droppedConsumable = rollConsumableDrop(reward.consumableTier);
        if (droppedConsumable) {
            if (!player.consumables) player.consumables = [];
            player.consumables.push(droppedConsumable);
        }
    }

    // Boss skill drop — teach to a random field unit of the killer
    var droppedSkill = null;
    if (reward.skillDrop && typeof SKILLS !== 'undefined' && SKILLS[reward.skillDrop]) {
        droppedSkill = reward.skillDrop;
        // Find field units that don't already know this skill
        var candidates = [];
        if (player.fieldUnits) {
            for (var si = 0; si < player.fieldUnits.length; si++) {
                var su = player.fieldUnits[si];
                if (su && su.alive !== false && (!su.learnedSkills || !su.learnedSkills[droppedSkill])) {
                    candidates.push(su);
                }
            }
        }
        if (candidates.length > 0) {
            var luckyUnit = candidates[Math.floor(Math.random() * candidates.length)];
            if (!luckyUnit.learnedSkills) luckyUnit.learnedSkills = {};
            luckyUnit.learnedSkills[droppedSkill] = 1;
            if (!luckyUnit.equippedSkills) luckyUnit.equippedSkills = [];
            // Auto-equip if slot available
            if (luckyUnit.equippedSkills.length < MAX_EQUIPPED_SKILLS) {
                luckyUnit.equippedSkills.push(droppedSkill);
            }
        }
    }

    campRewardsThisRound.push({
        campId: campUnit.campId || campUnit.dungeonId,
        playerIdx: killerOwner,
        gold: reward.gold,
        itemId: droppedItem,
        consumableId: droppedConsumable,
        skillDrop: droppedSkill,
    });

    var msg = player.name + ' sconfigge ' + campUnit.creepName + '! +' + reward.gold + 'g';
    if (droppedItem) {
        var item = ITEMS[droppedItem];
        msg += ' + ' + (item ? item.name : droppedItem);
    }
    if (droppedConsumable) {
        var cDef = typeof CONSUMABLES !== 'undefined' ? CONSUMABLES[droppedConsumable] : null;
        msg += ' + ' + (cDef ? cDef.icon + ' ' + cDef.name : droppedConsumable);
    }
    if (droppedSkill && SKILLS[droppedSkill]) {
        msg += ' + ' + SKILLS[droppedSkill].icon + ' ' + SKILLS[droppedSkill].name;
    }
    combatLog.push(msg);
}

// --- Item drop utilities ---
function calculateItemDrops(ticksUsed, tierRound) {
    var speedScore = clamp(1 - (ticksUsed / MAX_TICKS), 0, 1);
    var p3 = 0.03 + speedScore * 0.10;
    var p2 = 0.17 + speedScore * 0.20;
    var roll = Math.random();
    var count = roll < p3 ? 3 : (roll < p3 + p2 ? 2 : 1);

    var tier = 1;
    for (var t = 1; t <= 3; t++) {
        if (ITEM_TIERS[t].rounds.indexOf(tierRound) !== -1) { tier = t; break; }
    }

    var drops = [];
    for (var i = 0; i < count; i++) {
        var itemId = rollItemFromTier(tier, null);
        if (itemId) drops.push(itemId);
    }
    return drops;
}

function rollItemFromTier(tier, player) {
    var tierData = ITEM_TIERS[tier];
    if (!tierData) return null;

    var hasWmsStar3 = false;
    if (player) {
        var allUnits = (player.fieldUnits || []).concat(player.benchUnits || []);
        for (var i = 0; i < allUnits.length; i++) {
            if (allUnits[i] && allUnits[i].charId === 'WMS' && allUnits[i].star >= 3) {
                hasWmsStar3 = true; break;
            }
        }
    }

    var eligibleItems = [];
    var totalWeight = 0;
    for (var j = 0; j < tierData.items.length; j++) {
        var itemId = tierData.items[j];
        var item = ITEMS[itemId];
        if (!item) continue;
        if (item.restriction === 'WMS_star3' && !hasWmsStar3) continue;
        eligibleItems.push({ id: itemId, weight: item.weight });
        totalWeight += item.weight;
    }

    if (eligibleItems.length === 0 || totalWeight <= 0) return null;

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var k = 0; k < eligibleItems.length; k++) {
        cumulative += eligibleItems[k].weight;
        if (roll <= cumulative) return eligibleItems[k].id;
    }
    return eligibleItems[eligibleItems.length - 1].id;
}

// ============================================================
// DUNGEON BOSSES (corner zones)
// ============================================================

function spawnDungeonBosses(globalBossKills) {
    var bosses = {};
    var corners = ['NW', 'NE', 'SW', 'SE'];

    corners.forEach(function(corner) {
        var kills = globalBossKills[corner] || 0;

        // Each kill advances to the next tier (0 kills = tier 1, 4 kills = tier 5)
        var tierIdx = Math.min(kills, MAX_DUNGEON_TIER - 1);
        var tierDef = DUNGEON_BOSS_TIERS[tierIdx];

        // All 5 bosses defeated — dungeon cleared, no more spawns
        if (kills >= MAX_DUNGEON_TIER) return;

        var pos = DUNGEON_BOSS_POSITIONS[corner];

        var boss = {
            id: genUnitId(),
            charId: 'boss_' + corner,
            owner: 'boss_' + corner,
            star: 1,
            maxHp: tierDef.hp,
            hp: tierDef.hp,
            atk: tierDef.atk,
            baseAtk: tierDef.atk,
            atkSpeed: tierDef.atkSpeed,
            baseAtkSpeed: tierDef.atkSpeed,
            armor: tierDef.armor,
            baseArmor: tierDef.armor,
            range: tierDef.range,
            unitClass: 'DungeonBoss',
            race: 'Boss',
            behavior: 'aggressive',
            critChance: CRIT_CHANCE_BASE * 0.8,
            dodgeChance: 0,
            atkSpeedMultiplier: 1.0,
            dmgMultiplier: 1.0,
            magicResist: 0.1 + tierIdx * 0.05,
            row: pos.r, col: pos.c,
            px: 0, py: 0,
            targetRow: -1, targetCol: -1,
            alive: true,
            atkTimer: tierDef.atkSpeed,
            shield: 0,
            targetUnitId: null,
            hasMoved: false, isStopped: true,
            items: [], effects: [],
            coins: 0, hasTeleported: false, abilityCooldown: 999,
            enhancedRegenUsed: false, enhancedRegenTicks: 0,
            furiaActive: false, furiaTicks: 0, noHealDuringFuria: false,
            copiedClass: null, copiedRace: null, lastAllyAbility: null,
            deathPreventionUsed: false, nucleoUsed: false, reviving: false, reviveTicks: 0,
            killStacks: 0, velenoCharges: 0, cristalloApplied: false, amiciStacks: 0,
            atkAnim: 0, hitAnim: 0, deathAnim: 0, facing: 0,
            creepName: tierDef.name + ' (' + corner + ')',
            creepTier: tierIdx,
            isDungeonBoss: true,
            dungeonId: corner,
            dungeonTier: tierIdx + 1,
            killCount: kills,
            spawnRow: pos.r,
            spawnCol: pos.c,
            campReward: { gold: tierDef.gold, itemTier: tierDef.itemTier, skillDrop: tierDef.skillDrop, consumableTier: null },
        };

        var pos3d = cellToPixel(pos.r, pos.c);
        boss.px = pos3d.x;
        boss.py = pos3d.y;

        bosses['boss_' + corner] = boss;
    });

    return bosses;
}
