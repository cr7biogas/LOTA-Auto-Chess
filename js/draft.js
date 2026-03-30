// ============================================================
// LOTA AUTO CHESS — draft.js — Draft & star merge system
// ============================================================

var cardPool = {};

function initPool() {
    cardPool = createInitialPool();
}

function drawCards(n) {
    var drawn = [];
    for (var i = 0; i < n; i++) {
        var totalWeight = 0;
        var entries = [];
        for (var charId in cardPool) {
            if (cardPool.hasOwnProperty(charId) && cardPool[charId] > 0) {
                entries.push({ charId: charId, weight: cardPool[charId] });
                totalWeight += cardPool[charId];
            }
        }
        if (totalWeight <= 0) break;

        var roll = Math.random() * totalWeight;
        var cumulative = 0;
        var picked = null;
        for (var j = 0; j < entries.length; j++) {
            cumulative += entries[j].weight;
            if (roll < cumulative) {
                picked = entries[j].charId;
                break;
            }
        }
        if (!picked) picked = entries[entries.length - 1].charId;

        cardPool[picked]--;
        drawn.push(picked);
    }
    return drawn;
}

function returnCardToPool(charId) {
    if (cardPool.hasOwnProperty(charId)) {
        cardPool[charId]++;
    }
}

function removeFromPool(charId, count) {
    if (cardPool.hasOwnProperty(charId)) {
        cardPool[charId] = Math.max(0, cardPool[charId] - count);
    }
}

function getStarLevel(copies, maxStar) {
    var star = 0;
    for (var i = 0; i < STAR_COPIES_NEEDED.length; i++) {
        if (copies >= STAR_COPIES_NEEDED[i] && (i + 1) <= maxStar) {
            star = i + 1;
        }
    }
    return star;
}

function checkStarMerge(player, charId) {
    var charDef = CHARACTERS[charId];
    if (!charDef) return null;

    var copies = player.ownedCopies[charId];
    var maxStar = charDef.maxStar;
    var oldStar = player.starLevels[charId];
    var newStar = getStarLevel(copies, maxStar);

    if (newStar > oldStar) {
        player.starLevels[charId] = newStar;

        var allUnits = player.fieldUnits.concat(player.benchUnits);
        for (var i = 0; i < allUnits.length; i++) {
            if (allUnits[i].charId === charId) {
                allUnits[i].star = newStar;
                recalcUnitStats(allUnits[i]);
            }
        }

        if (newStar === 5) {
            handleStar5(player, charId);
        }

        return newStar;
    }
    return null;
}

function handleStar5(player, charId) {
    removeFromPool(charId, STAR5_POOL_REMOVAL);
    if (typeof addGold === 'function') {
        addGold(player, STAR5_GOLD_BONUS, true);
    } else {
        player.gold += STAR5_GOLD_BONUS;
        player.totalGoldEarned += STAR5_GOLD_BONUS;
    }
}

function performDraft(player) {
    return drawCards(DRAFT_CARDS_SHOWN);
}

function processDraftChoice(player, drawnCards, chosenIndex) {
    if (!drawnCards || drawnCards.length === 0) { console.warn('[Draft] No cards!'); return; }

    chosenIndex = clamp(chosenIndex, 0, drawnCards.length - 1);

    for (var i = 0; i < drawnCards.length; i++) {
        if (i === chosenIndex) {
            var charId = drawnCards[i];
            player.ownedCopies[charId] = (player.ownedCopies[charId] || 0) + 1;

            var oldStar = player.starLevels[charId] || 0;
            if (oldStar === 0) {
                player.starLevels[charId] = 1;

                var _pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index;
                var zone = getDeployZone(_pSlot);
                var startRow = (zone && zone.cells.length > 0) ? zone.cells[0].r : 0;
                var startCol = (zone && zone.cells.length > 0) ? zone.cells[0].c : 0;

                var newUnit = createUnit(charId, 1, _pSlot, startRow, startCol);

                if (player.benchUnits.length < player.unlockedBenchSlots) {
                    player.benchUnits.push(newUnit);
                } else if (player.fieldUnits.length < player.unlockedFieldSlots) {
                    var placed = false;
                    if (zone && zone.cells) {
                        for (var ci = 0; ci < zone.cells.length && !placed; ci++) {
                            var cellR = zone.cells[ci].r;
                            var cellC = zone.cells[ci].c;
                            // Check if cell is already occupied by another field unit
                            var occupied = false;
                            for (var fi = 0; fi < player.fieldUnits.length; fi++) {
                                if (player.fieldUnits[fi].row === cellR && player.fieldUnits[fi].col === cellC) {
                                    occupied = true;
                                    break;
                                }
                            }
                            if (!occupied) {
                                newUnit.row = cellR;
                                newUnit.col = cellC;
                                placed = true;
                            }
                        }
                    }
                    player.fieldUnits.push(newUnit);
                } else if (player.benchUnits.length < player.unlockedBenchSlots) {
                    player.benchUnits.push(newUnit);
                } else {
                    // Both bench and field full — unit is lost, refund partial gold
                    if (typeof addGold === 'function') addGold(player, 1, true);
                    else { player.gold += 1; player.totalGoldEarned += 1; }
                }
            }

            checkStarMerge(player, charId);
        } else {
            returnCardToPool(drawnCards[i]);
        }
    }
}
