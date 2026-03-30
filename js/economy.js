// ============================================================
// LOTA AUTO CHESS — economy.js — Player state & gold economy
// ============================================================

// --- Create a player state object ---
// Get the fixed server slot for deploy zone + team color (consistent across all clients)
function getPlayerSlot(player) {
    return (player.serverSlot !== undefined) ? player.serverSlot : player.index;
}

function createPlayerState(index, isHuman) {
    return {
        index: index,
        serverSlot: index, // overridden in multiplayer by game.js
        name: isHuman ? 'Tu' : 'Giocatore ' + (index + 1),
        isHuman: isHuman,
        hp: PLAYER_START_HP,   // 30
        maxHp: PLAYER_MAX_HP,  // 30
        gold: STARTING_GOLD,   // 0
        totalGoldEarned: 0,    // tiebreaker, never decremented
        consecutiveWins: 0,
        eliminated: false,

        // Slots
        unlockedFieldSlots: 1,  // max 4, costs: [0, 8, 18, 45]
        unlockedBenchSlots: 1,  // max 3, costs: [0, 4, 8]

        // Units
        fieldUnits: [],    // units on board (max = unlockedFieldSlots)
        benchUnits: [],    // units on bench (max = unlockedBenchSlots)

        // Items
        inventory: [],     // unequipped items

        // Consumables & Traps
        consumables: [],   // consumable inventory
        activeTraps: [],   // placed traps on board

        // Copies owned per character (for star tracking)
        ownedCopies: { Babidi: 0, Caronte: 0, Valerio: 0, Yujin: 0, WMS: 0 },
        starLevels:  { Babidi: 0, Caronte: 0, Valerio: 0, Yujin: 0, WMS: 0 },

        // Elimination tracking
        eliminationRound: null,
        placement: 0,

        // Nucleo Immortale tracking (once per match)
        nucleoUsedThisMatch: false,

        // Militia
        militiaUnits: [],  // persistent militia on field

        // Structures (turrets)
        structures: [],    // persistent defensive structures

        // Avatar
        avatar: null,      // player avatar unit
    };
}

// --- Add gold (with tiebreaker tracking) ---
function addGold(player, amount, countsForTiebreaker) {
    if (!player) return;
    if (countsForTiebreaker === undefined) countsForTiebreaker = true;
    if (amount <= 0) return;
    player.gold += amount;
    if (countsForTiebreaker) {
        player.totalGoldEarned += amount;
    }
}

// --- Spend gold (does NOT affect totalGoldEarned) ---
// Returns true if affordable and spent; false otherwise.
function spendGold(player, amount) {
    if (player.gold < amount) return false;
    player.gold -= amount;
    return true;
}

// --- Apply bench maintenance costs (called FIRST each planning phase) ---
// Bench maintenance per occupied bench slot beyond the first free one.
// BENCH_MAINTENANCE = [0, 0.3, 0.5] indexed by benchUnit count (0,1,2+).
// Returns true if the player can still play (not eliminated from negative gold).
function applyMaintenanceCost(player) {
    var benchCount = player.benchUnits.length;
    // Index directly: 0 units=0g, 1 unit=0.3g, 2+ units=0.5g
    var cost = BENCH_MAINTENANCE[Math.min(benchCount, BENCH_MAINTENANCE.length - 1)] || 0;
    if (cost > 0) {
        player.gold = Math.max(0, player.gold - cost);
    }
    return true;
}

// --- Apply base income (+1 gold per turn) ---
function applyBaseIncome(player) {
    addGold(player, BASE_INCOME, true);
}

// --- Apply Babidi income if Babidi is on field ---
// Gold per turn depends on Babidi's star level.
// BABIDI_GOLD_PER_STAR = [0.4, 0.8, 1.2, 1.5, 1.8] for star 1-5.
function applyBabidiIncome(player) {
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        if (unit.charId === 'Babidi') {
            var starIdx = clamp(unit.star - 1, 0, BABIDI_GOLD_PER_STAR.length - 1);
            var income = BABIDI_GOLD_PER_STAR[starIdx];
            addGold(player, income, true);
            return; // only one Babidi matters
        }
    }
}

// --- Apply center control gold (+1 per unit in center) ---
function applyCenterControlIncome(player) {
    if (!player || !player.fieldUnits) return;
    var midR = (BOARD_ROWS - 1) / 2;
    var midC = (BOARD_COLS - 1) / 2;
    var radius = typeof CENTER_CONTROL_RADIUS !== 'undefined' ? CENTER_CONTROL_RADIUS : 3;
    var goldPer = typeof CENTER_CONTROL_GOLD !== 'undefined' ? CENTER_CONTROL_GOLD : 1;
    var count = 0;
    // Count field units + militia in center
    var allUnits = player.fieldUnits.concat(player.militiaUnits || []);
    for (var i = 0; i < allUnits.length; i++) {
        var u = allUnits[i];
        if (u._needsRespawn) continue;
        var dr = u.row - midR;
        var dc = u.col - midC;
        if (Math.sqrt(dr * dr + dc * dc) <= radius) {
            count++;
        }
    }
    if (count > 0) {
        addGold(player, count * goldPer, true);
    }
    return count;
}

// --- Apply PvP win bonus (+2 gold) ---
function applyPvpWinBonus(player) {
    addGold(player, PVP_WIN_GOLD, true);
}

// --- Apply win streak bonus ---
// Every 5th consecutive win awards a bonus: +1 at 5, +2 at 10, +3 at 15, etc.
function applyWinStreakBonus(player) {
    if (player.consecutiveWins > 0 && player.consecutiveWins % 5 === 0) {
        var tier = Math.floor(player.consecutiveWins / 5);
        addGold(player, tier, true);
    }
}

// --- Unlock field slot ---
// FIELD_SLOT_COSTS = [0, 8, 18, 45] — cost for slot 1,2,3,4.
// Player starts with 1 unlocked; max 4.
// Returns true if successfully unlocked.
function unlockFieldSlot(player) {
    if (player.unlockedFieldSlots >= FIELD_SLOT_COSTS.length) return false;
    var cost = FIELD_SLOT_COSTS[player.unlockedFieldSlots];
    if (!spendGold(player, cost)) return false;
    player.unlockedFieldSlots++;
    return true;
}

// --- Unlock bench slot ---
// BENCH_SLOT_COSTS = [0, 4, 8] — cost for slot 1,2,3.
// Player starts with 1 unlocked; max 3.
// Returns true if successfully unlocked.
function unlockBenchSlot(player) {
    if (player.unlockedBenchSlots >= BENCH_SLOT_COSTS.length) return false;
    var cost = BENCH_SLOT_COSTS[player.unlockedBenchSlots];
    if (!spendGold(player, cost)) return false;
    player.unlockedBenchSlots++;
    return true;
}

// --- Buy HP: 4 gold per +1 HP, max PLAYER_MAX_HP (30) ---
// Returns true if successfully purchased.
function buyHp(player) {
    if (player.hp >= player.maxHp) return false;
    if (!spendGold(player, HP_PURCHASE_COST)) return false;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    return true;
}

// --- Calculate combat damage to player after a loss ---
// Formula: enemySurvivors * roll(min, max) based on round tier.
// COMBAT_DAMAGE_TABLE defines tiers: early, mid, late, endgame.
function calculateCombatDamage(round, enemySurvivors) {
    if (enemySurvivors <= 0) return 0;

    var tier = null;
    var tiers = Object.values(COMBAT_DAMAGE_TABLE);
    for (var i = 0; i < tiers.length; i++) {
        var t = tiers[i];
        if (round >= t.minRound && round <= t.maxRound) {
            tier = t;
            break;
        }
    }
    // Fallback to endgame if round exceeds all tiers
    if (!tier) tier = COMBAT_DAMAGE_TABLE.endgame;

    var perSurvivor = randInt(tier.min, tier.max);
    return enemySurvivors * perSurvivor;
}

// --- Apply combat damage to player HP ---
function applyCombatDamage(player, damage) {
    if (damage <= 0) return;
    player.hp = Math.max(0, player.hp - damage);
}

// --- Check and handle elimination (HP <= 0) ---
// Returns true if the player is eliminated (newly or already).
function checkElimination(player) {
    if (player.eliminated) return true;
    if (player.hp <= 0) {
        player.hp = 0;
        player.eliminated = true;
        return true;
    }
    return false;
}

// --- WMS Elisir: heal player HP during planning ---
// WMS.abilities.elisir.healPerTurn = [1, [1,2], [2,4]] for star 1,2,3.
// Star 1: heal 1 HP. Star 2: heal randInt(1,2). Star 3: heal randInt(2,4).
function applyElisir(player) {
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        if (unit.charId === 'WMS') {
            var wmsChar = CHARACTERS.WMS;
            var starIdx = clamp(unit.star - 1, 0, wmsChar.abilities.elisir.healPerTurn.length - 1);
            var healDef = wmsChar.abilities.elisir.healPerTurn[starIdx];
            var heal = 0;
            if (typeof healDef === 'number') {
                heal = healDef;
            } else if (Array.isArray(healDef)) {
                heal = randInt(healDef[0], healDef[1]);
            }

            // Check if WMS has Codice dell'Oracolo (overrides Elisir at star 3)
            if (unit.items && unit.items.includes('codiceOracolo') && unit.star >= 3) {
                var override = ITEMS.codiceOracolo.elisirOverride;
                heal = randInt(override[0], override[1]);
            }

            if (heal > 0) {
                player.hp = Math.min(player.maxHp, player.hp + heal);
            }
            return; // only one WMS per player
        }
    }
}
