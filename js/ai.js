// ============================================================
// LOTA AUTO CHESS — ai.js — AI opponents (players 1, 2, 3)
// ============================================================

var AI_SKILL = 0.6;

function aiDraftChoice(player, cards) {
    var numCards = cards.length || 2;
    if (Math.random() > AI_SKILL) {
        return randInt(0, numCards - 1);
    }

    var scores = [];
    for (var si = 0; si < numCards; si++) scores.push(0);

    // Build set of owned char IDs for synergy check
    var ownedChars = {};
    for (var cid in player.ownedCopies) {
        if (player.ownedCopies[cid] > 0) ownedChars[cid] = true;
    }

    for (var i = 0; i < cards.length; i++) {
        var charId = cards[i];
        var charDef = CHARACTERS[charId];
        if (!charDef) continue;

        var ownedCopies = player.ownedCopies[charId] || 0;

        var currentStar = 0;
        var totalAfter = ownedCopies + 1;
        for (var s = STAR_COPIES_NEEDED.length - 1; s >= 0; s--) {
            if (totalAfter >= STAR_COPIES_NEEDED[s]) {
                currentStar = s + 1;
                break;
            }
        }
        var currentStarBefore = 0;
        for (var s2 = STAR_COPIES_NEEDED.length - 1; s2 >= 0; s2--) {
            if (ownedCopies >= STAR_COPIES_NEEDED[s2]) {
                currentStarBefore = s2 + 1;
                break;
            }
        }

        if (currentStar > currentStarBefore) {
            scores[i] += 50 + currentStar * 20;
        }

        var nextStarIdx = currentStarBefore;
        if (nextStarIdx < STAR_COPIES_NEEDED.length) {
            var needed = STAR_COPIES_NEEDED[nextStarIdx];
            var remaining = needed - ownedCopies;
            if (remaining === 2) scores[i] += 15;
            else if (remaining === 1) scores[i] += 30;
        }

        var baseAtk = charDef.stats[0].atk;
        scores[i] += baseAtk * 0.3;

        if (ownedCopies > 0) scores[i] += 10;
        if (charId === 'WMS') scores[i] += 20;

        // Synergy awareness: bonus if picking this char completes a pair/trio
        if (typeof SYNERGIES !== 'undefined') {
            for (var sid in SYNERGIES) {
                var syn = SYNERGIES[sid];
                var chars = syn.chars;
                if (chars.indexOf(charId) < 0) continue;
                // Count how many of this synergy's chars we already own (excluding this pick)
                var have = 0;
                for (var sc = 0; sc < chars.length; sc++) {
                    if (chars[sc] !== charId && ownedChars[chars[sc]]) have++;
                    else if (chars[sc] === charId && ownedCopies > 0) have++;
                }
                // Completing a pair
                if (syn.type === 'pair' && have === 1) scores[i] += 25;
                // One away from trio
                if (syn.type === 'trio' && have === 2) scores[i] += 35;
                // Getting closer to a synergy
                if (have >= 1) scores[i] += 5;
            }
        }
    }

    return scores[0] >= scores[1] ? 0 : 1;
}

function aiPlaceUnits(player) {
    if (!player || !player.fieldUnits) return;

    var zone = getDeployZone(typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index);
    if (!zone || !zone.cells || zone.cells.length === 0) return;

    var maxFieldSlots = player.unlockedFieldSlots || 1;

    // Collect all units
    var allUnits = [];
    for (var i = 0; i < player.fieldUnits.length; i++) allUnits.push(player.fieldUnits[i]);
    if (player.benchUnits) {
        for (var i = 0; i < player.benchUnits.length; i++) {
            if (player.benchUnits[i]) allUnits.push(player.benchUnits[i]);
        }
    }

    allUnits.sort(function(a, b) {
        if (b.star !== a.star) return b.star - a.star;
        return b.atk - a.atk;
    });

    var toPlace = allUnits.slice(0, maxFieldSlots);
    var toBench = allUnits.slice(maxFieldSlots);

    // Sort zone cells: front (closer to center) vs back (farther)
    var center = getBoardCenter();
    var frontCells = zone.cells.slice().sort(function(a, b) {
        return chebyshevDist(a.r, a.c, center.r, center.c) - chebyshevDist(b.r, b.c, center.r, center.c);
    });
    var backCells = frontCells.slice().reverse();

    player.fieldUnits = [];
    var usedCells = {};
    // Pre-mark militia cells as occupied
    if (player.militiaUnits) {
        for (var mi = 0; mi < player.militiaUnits.length; mi++) {
            usedCells[player.militiaUnits[mi].row + ',' + player.militiaUnits[mi].col] = true;
        }
    }

    for (var j = 0; j < toPlace.length; j++) {
        var unit = toPlace[j];
        var charDef = CHARACTERS[unit.charId];
        var isFront = true;
        if (charDef) {
            isFront = charDef.deployZone !== 'back';
        }
        if (unit.charId === 'WMS') {
            isFront = !(unit.copiedClass === 'Incantatore' || unit.copiedClass === 'Sciamano');
        }

        var cells = isFront ? frontCells : backCells;
        var placed = false;
        for (var ci = 0; ci < cells.length && !placed; ci++) {
            var key = cells[ci].r + ',' + cells[ci].c;
            if (!usedCells[key]) {
                unit.row = cells[ci].r;
                unit.col = cells[ci].c;
                usedCells[key] = true;
                placed = true;
            }
        }
        if (placed) player.fieldUnits.push(unit);
    }

    player.benchUnits = [];
    for (var k = 0; k < toBench.length; k++) player.benchUnits.push(toBench[k]);
}

function aiEconomyDecision(player) {
    if (!player) return;

    var gold = player.gold || 0;
    var round = (typeof currentRound !== 'undefined') ? currentRound : 1;

    if (player.unlockedFieldSlots === undefined) player.unlockedFieldSlots = 1;
    if (player.unlockedBenchSlots === undefined) player.unlockedBenchSlots = 1;

    // Gold reserve: keep some gold unless HP is critical or it's late game
    var reserve = 0;
    if (player.hp >= 20 && round < 30) reserve = 4;   // save for purchases
    else if (player.hp >= 10) reserve = 2;             // small buffer
    // No reserve if HP < 10 — spend aggressively

    // Field slot upgrades — high priority
    if (player.unlockedFieldSlots < 2 && gold >= FIELD_SLOT_COSTS[1] + reserve) {
        player.gold -= FIELD_SLOT_COSTS[1];
        player.unlockedFieldSlots = 2;
        gold = player.gold;
    }

    if (player.unlockedFieldSlots < 3 && gold >= FIELD_SLOT_COSTS[2] + reserve) {
        player.gold -= FIELD_SLOT_COSTS[2];
        player.unlockedFieldSlots = 3;
        gold = player.gold;
    }

    // Bench slot — medium priority
    if (player.unlockedBenchSlots < 2 && gold >= BENCH_SLOT_COSTS[1] + reserve) {
        player.gold -= BENCH_SLOT_COSTS[1];
        player.unlockedBenchSlots = 2;
        gold = player.gold;
    }

    // Buy HP when low
    if (player.hp < 15 && gold >= HP_PURCHASE_COST + reserve) {
        player.gold -= HP_PURCHASE_COST;
        player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
        gold = player.gold;
    }
    // Emergency: buy more HP if critical
    if (player.hp < 8 && gold >= HP_PURCHASE_COST) {
        player.gold -= HP_PURCHASE_COST;
        player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
        gold = player.gold;
    }
}

function aiAssignItems(player) {
    if (!player || !player.inventory || player.inventory.length === 0) return;
    if (!player.fieldUnits || player.fieldUnits.length === 0) return;

    var offensiveItems = [
        'frammentoAureo', 'accusaFormale', 'scimitarraDeserto', 'asciaFjord',
        'lamaAffilata', 'cristalloRisonante', 'cinturaBerserker', 'velenoAccademico',
        'ragnarok', 'sigilloDellUsuraio', 'pietraDellEternita', 'dottoratoMaledetto'
    ];
    var defensiveItems = [
        'amuletoProtezione', 'esoscheletroSeg', 'mutaCoriacea', 'nucleoImmortale', 'elmoCondiviso'
    ];
    var rangedItems = ['bilanciaDelMercato'];
    var wmsOnlyItems = ['codiceOracolo'];
    var synergyItems = ['coronaSinergie'];

    function findHighestAtkUnit(units) {
        var best = null; var bestAtk = -1;
        for (var i = 0; i < units.length; i++) {
            if (units[i].items.length >= MAX_ITEMS_PER_UNIT) continue;
            if (units[i].atk > bestAtk) { bestAtk = units[i].atk; best = units[i]; }
        }
        return best;
    }

    function findTankUnit(units) {
        var valerio = null; var bestTank = null; var bestHp = -1;
        for (var i = 0; i < units.length; i++) {
            if (units[i].items.length >= MAX_ITEMS_PER_UNIT) continue;
            if (units[i].charId === 'Valerio') valerio = units[i];
            var charDef = CHARACTERS[units[i].charId];
            var isFront = charDef && (charDef.deployZone === 'front' || charDef.deployZone === 'any');
            if (isFront && units[i].maxHp > bestHp) { bestHp = units[i].maxHp; bestTank = units[i]; }
        }
        if (valerio && valerio.items.length < MAX_ITEMS_PER_UNIT) return valerio;
        return bestTank;
    }

    function findRangedUnit(units) {
        var babidi = null; var ranged = null;
        for (var i = 0; i < units.length; i++) {
            if (units[i].items.length >= MAX_ITEMS_PER_UNIT) continue;
            if (units[i].charId === 'Babidi') babidi = units[i];
            if (units[i].range >= 2 && !ranged) ranged = units[i];
        }
        if (babidi && babidi.items.length < MAX_ITEMS_PER_UNIT) return babidi;
        return ranged;
    }

    function findWmsUnit(units) {
        for (var i = 0; i < units.length; i++) {
            if (units[i].charId === 'WMS' && units[i].star >= 3 && units[i].items.length < MAX_ITEMS_PER_UNIT) return units[i];
        }
        return null;
    }

    function findHighestStarUnit(units) {
        var best = null; var bestStar = -1;
        for (var i = 0; i < units.length; i++) {
            if (units[i].items.length >= MAX_ITEMS_PER_UNIT) continue;
            if (units[i].star > bestStar) { bestStar = units[i].star; best = units[i]; }
        }
        return best;
    }

    var remainingInventory = [];
    for (var idx = 0; idx < player.inventory.length; idx++) {
        var itemId = player.inventory[idx];
        var targetUnit = null;

        if (wmsOnlyItems.indexOf(itemId) !== -1) targetUnit = findWmsUnit(player.fieldUnits);
        else if (rangedItems.indexOf(itemId) !== -1) targetUnit = findRangedUnit(player.fieldUnits);
        else if (defensiveItems.indexOf(itemId) !== -1) targetUnit = findTankUnit(player.fieldUnits);
        else if (synergyItems.indexOf(itemId) !== -1) targetUnit = findHighestStarUnit(player.fieldUnits);
        else if (offensiveItems.indexOf(itemId) !== -1) targetUnit = findHighestAtkUnit(player.fieldUnits);
        else targetUnit = findHighestAtkUnit(player.fieldUnits);

        if (targetUnit && targetUnit.items.length < MAX_ITEMS_PER_UNIT) {
            targetUnit.items.push(itemId);
            recalcUnitStats(targetUnit);
        } else {
            remainingInventory.push(itemId);
        }
    }

    player.inventory = remainingInventory;
}

function aiEquipSkills(player) {
    if (!player || !player.fieldUnits) return;
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        if (!unit.equippedSkills) unit.equippedSkills = [];
        if (!unit.learnedSkills) unit.learnedSkills = {};

        var available = typeof getAvailableSkills === 'function' ? getAvailableSkills(unit) : [];

        // Equip the first 3 available skills not already equipped
        for (var s = 0; s < available.length && unit.equippedSkills.length < MAX_EQUIPPED_SKILLS; s++) {
            if (unit.equippedSkills.indexOf(available[s]) < 0) {
                if (typeof learnSkill === 'function') learnSkill(unit, available[s]);
                unit.equippedSkills.push(available[s]);
            }
        }

        // AI upgrades skills — prioritize lowest level first (most value per gold)
        if (player.gold >= 8 && typeof upgradeSkill === 'function') {
            var skillsByLevel = unit.equippedSkills.slice().sort(function(a, b) {
                return (unit.learnedSkills[a] || 1) - (unit.learnedSkills[b] || 1);
            });
            for (var s = 0; s < skillsByLevel.length; s++) {
                var sid = skillsByLevel[s];
                var lv = unit.learnedSkills[sid] || 1;
                var cost = lv === 1 ? 3 : 6;
                if (lv < 3 && player.gold >= cost + 4) { // keep 4g buffer
                    upgradeSkill(player, unit, sid);
                }
            }
        }
    }
}

function aiAssignOrders(player) {
    if (!player || !player.fieldUnits || player.fieldUnits.length === 0) return;

    var units = player.fieldUnits;

    // Find key roles
    var valerio = null, yujin = null, babidi = null, caronte = null;
    for (var i = 0; i < units.length; i++) {
        if (units[i].charId === 'Valerio') valerio = units[i];
        if (units[i].charId === 'Yujin') yujin = units[i];
        if (units[i].charId === 'Babidi') babidi = units[i];
        if (units[i].charId === 'Caronte') caronte = units[i];
    }

    for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        var charDef = CHARACTERS[unit.charId];

        // Randomize to avoid predictability
        if (Math.random() > AI_SKILL) {
            unit.tacticalOrder = ORDER_FREE;
            unit.tacticalTarget = null;
            continue;
        }

        // Yujin: aggressive attack
        if (unit.charId === 'Yujin') {
            unit.tacticalOrder = ORDER_ATTACK;
            unit.tacticalTarget = null;
            continue;
        }

        // Babidi: cover/kite
        if (unit.charId === 'Babidi') {
            unit.tacticalOrder = ORDER_COVER;
            unit.tacticalTarget = null;
            continue;
        }

        // Valerio: hold position (tank stays in place if alone) or protect ranged
        if (unit.charId === 'Valerio') {
            if (babidi || caronte) {
                // Protect the squishiest ranged ally
                var protectTarget = babidi || caronte;
                unit.tacticalOrder = ORDER_PROTECT;
                unit.tacticalTarget = protectTarget.id;
            } else {
                unit.tacticalOrder = ORDER_FREE;
                unit.tacticalTarget = null;
            }
            continue;
        }

        // Caronte: hold position (he teleports anyway)
        if (unit.charId === 'Caronte') {
            unit.tacticalOrder = ORDER_HOLD;
            unit.tacticalTarget = null;
            continue;
        }

        // WMS: follow strongest ally
        if (unit.charId === 'WMS') {
            var strongest = null;
            var bestStar = -1;
            for (var j = 0; j < units.length; j++) {
                if (units[j].id === unit.id) continue;
                if (units[j].star > bestStar) {
                    bestStar = units[j].star;
                    strongest = units[j];
                }
            }
            if (strongest) {
                unit.tacticalOrder = ORDER_FOLLOW;
                unit.tacticalTarget = strongest.id;
            } else {
                unit.tacticalOrder = ORDER_FREE;
                unit.tacticalTarget = null;
            }
            continue;
        }

        // Default
        unit.tacticalOrder = ORDER_FREE;
        unit.tacticalTarget = null;
    }
}

function aiPlayTurn(player) {
    if (!player || player.eliminated) return;
    aiEconomyDecision(player);
    aiPlaceUnits(player);
    aiAssignItems(player);
    aiAssignOrders(player);
    aiEquipSkills(player);
    // Militia: buy and assign orders
    if (typeof aiMilitiaBuy === 'function') aiMilitiaBuy(player);
    if (typeof aiMilitiaOrders === 'function') aiMilitiaOrders(player);
    // Structures: buy and place
    if (typeof aiStructureBuy === 'function') aiStructureBuy(player);
}
