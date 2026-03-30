// ============================================================
// LOTA AUTO CHESS — synergies.js — Synergy detection & buffs
// ============================================================

// --- Check if a set of character IDs contains all required chars for a synergy ---
// charIds is an array of charId strings (may contain duplicates).
// synergyDef is an entry from SYNERGIES (has .chars array).
// Returns true if every character in synergyDef.chars is present in charIds.
function matchesSynergy(charIds, synergyDef) {
    for (var i = 0; i < synergyDef.chars.length; i++) {
        if (charIds.indexOf(synergyDef.chars[i]) === -1) {
            return false;
        }
    }
    return true;
}

// --- Count effective synergy characters on field ---
// Corona delle Sinergie makes the holder count as 2 for synergy thresholds.
// Returns an array of charIds with duplicates to reflect Corona bonus.
function getEffectiveSynergyCharIds(player) {
    var charIds = [];
    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        charIds.push(unit.charId);

        // Corona delle Sinergie: this unit counts as 2 for synergy thresholds
        if (unit.items && unit.items.indexOf('coronaSinergie') !== -1) {
            charIds.push(unit.charId);
        }
    }
    return charIds;
}

// --- Detect active synergies for a player based on their field units ---
// Returns an array of active synergy objects (references to SYNERGIES entries).
function detectSynergies(player) {
    var charIds = getEffectiveSynergyCharIds(player);
    var active = [];

    // Build a unique char set for matching
    var uniqueChars = [];
    for (var i = 0; i < charIds.length; i++) {
        if (uniqueChars.indexOf(charIds[i]) === -1) {
            uniqueChars.push(charIds[i]);
        }
    }

    // Check each synergy definition
    for (var synId in SYNERGIES) {
        if (!SYNERGIES.hasOwnProperty(synId)) continue;
        var synDef = SYNERGIES[synId];

        // Quartet "Gli Amici" has alternate activation via WMS star3 + Codice
        if (synDef.type === 'quartet' && synDef.altActivation === 'WMS_star3_codice') {
            // Normal activation: all 4 chars on field
            if (matchesSynergy(uniqueChars, synDef)) {
                active.push(synDef);
                continue;
            }
            // Alternate: WMS star 3 with Codice dell'Oracolo equipped,
            // plus all other 3 chars on field
            var hasWmsStar3Codice = false;
            for (var w = 0; w < player.fieldUnits.length; w++) {
                var u = player.fieldUnits[w];
                if (u.charId === 'WMS' && u.star >= 3 &&
                    u.items && u.items.indexOf('codiceOracolo') !== -1) {
                    hasWmsStar3Codice = true;
                    break;
                }
            }
            if (hasWmsStar3Codice) {
                // Check that all 4 original chars (Babidi, Caronte, Valerio, Yujin)
                // are present on field (WMS with Codice counts as the missing one)
                var needed = synDef.chars; // ['Babidi','Caronte','Valerio','Yujin']
                var present = 0;
                for (var n = 0; n < needed.length; n++) {
                    if (uniqueChars.indexOf(needed[n]) !== -1) {
                        present++;
                    }
                }
                // With WMS star3+Codice, you need at least 3 of the 4 core chars
                // (WMS fulfills the 4th slot)
                if (present >= 3) {
                    active.push(synDef);
                    continue;
                }
            }
            continue;
        }

        // Standard synergy matching: pair, trio, or quartet
        // For synergy threshold with Corona, we use charIds count
        var requiredCount = synDef.chars.length;

        // Count how many of the required chars appear in the effective charIds
        // (including Corona duplicates)
        var matchCount = 0;
        for (var m = 0; m < synDef.chars.length; m++) {
            if (uniqueChars.indexOf(synDef.chars[m]) !== -1) {
                matchCount++;
            }
        }

        // With Corona, a unit counts double. So if we need e.g. a pair (2 chars)
        // and we only have 1 unique char but Corona duplicates it, check the
        // effective total. For pairs/trios/quartets, we need ALL specified chars
        // to be present, not just a count. Corona helps reach the field-slot
        // threshold (you can have fewer physical units) but each synergy requires
        // specific named characters.
        if (matchCount >= requiredCount) {
            active.push(synDef);
        }
    }

    return active;
}

// --- Apply synergy buffs/debuffs to combat units at battle start ---
// units: array of combat unit clones for one team.
// activeSynergies: result of detectSynergies().
function applySynergyBuffs(units, activeSynergies) {
    for (var s = 0; s < activeSynergies.length; s++) {
        var syn = activeSynergies[s];

        switch (syn.id) {

            // === PAIRS ===

            case 'accademiaLosca':
                // Spell slow: Babidi and Caronte on-hit applies 10% slow for 2 ticks
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Babidi' || units[i].charId === 'Caronte') {
                        units[i]._synergySpellSlow = 0.10;
                    }
                }
                break;

            case 'pazienzaInfinita':
                // Valerio gains +1 armor every 3 ticks (max 5 stacks)
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Valerio') {
                        units[i]._synergyArmorStack = {
                            perStack: syn.armorPerStack,
                            maxStacks: syn.maxStacks,
                            interval: syn.interval,
                            currentStacks: 0,
                            tickCounter: 0,
                        };
                    }
                }
                break;

            case 'contrattoGuerra':
                // Babidi coins grant Yujin +15% dmg per coin (max 3 coins)
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Yujin') {
                        units[i]._synergyCoinDmg = {
                            dmgPerCoin: syn.dmgPerCoin,
                            maxCoins: syn.maxCoins,
                        };
                    }
                }
                break;

            case 'caviaLaboratorio':
                // Caronte's Tesi redirects 25% damage to Valerio;
                // Valerio gains 40% bonus regen
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Caronte') {
                        units[i]._synergyRedirect = syn.redirectPercent;
                    }
                    if (units[i].charId === 'Valerio') {
                        units[i]._synergyRegenBonus = syn.regenBonus;
                    }
                }
                break;

            case 'caosAccademico':
                // Yujin's Furia debuffs spread to all enemies on activation
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Yujin') {
                        units[i]._synergyFuriaSpread = true;
                    }
                }
                break;

            case 'corpoEForza':
                // Valerio's regen converted to 15% bonus ATK for Yujin
                for (var i = 0; i < units.length; i++) {
                    if (units[i].charId === 'Yujin') {
                        units[i]._synergyRegenToAtk = syn.conversion;
                    }
                }
                break;

            // === TRIOS ===

            case 'senzaIlMartello':
                // Buff: +30% magic resist, Caronte Tesi CD override to 4
                // Debuff: -20% physical ATK
                for (var i = 0; i < units.length; i++) {
                    var u = units[i];
                    // Buff applies to all team members in the synergy
                    if (syn.chars.indexOf(u.charId) !== -1 || u.charId === 'WMS') {
                        u.magicResist += syn.buff.magicResist;
                    }
                    if (u.charId === 'Caronte') {
                        u.abilityCooldown = Math.min(u.abilityCooldown, syn.buff.tesiCdOverride);
                    }
                    // Debuff: physical ATK reduction on all team units
                    if (syn.chars.indexOf(u.charId) !== -1) {
                        u.atk = Math.round(u.atk * (1 - syn.debuff.physAtkReduction));
                    }
                }
                break;

            case 'senzaIlMuro':
                // Buff: Babidi starts with 2 coins, Caronte Tesi at tick 0,
                //        Yujin Furia at tick 1
                // Debuff: -15% max HP, no regen
                for (var i = 0; i < units.length; i++) {
                    var u = units[i];
                    if (u.charId === 'Babidi') {
                        u.coins = syn.buff.startingCoins;
                    }
                    if (u.charId === 'Caronte' && syn.buff.tesiTick0) {
                        u.abilityCooldown = 0; // fires on first tick
                    }
                    if (u.charId === 'Yujin' && syn.buff.furiaTick1) {
                        u.abilityCooldown = 1; // fires on second tick
                    }
                    // Debuff: -15% max HP and no regen
                    if (syn.chars.indexOf(u.charId) !== -1) {
                        var hpLoss = Math.round(u.maxHp * syn.debuff.maxHpReduction);
                        u.maxHp -= hpLoss;
                        u.hp = Math.min(u.hp, u.maxHp);
                        u._synergyNoRegen = syn.debuff.noRegen;
                    }
                }
                break;

            case 'senzaLaMente':
                // Buff: Valerio heals allies 5% every 3 ticks,
                //        +70% magic damage reduction
                // Debuff: +2 ticks to all ability cooldowns
                for (var i = 0; i < units.length; i++) {
                    var u = units[i];
                    if (u.charId === 'Valerio') {
                        u._synergyHealAllies = {
                            percent: syn.buff.valerioHeals.percent,
                            interval: syn.buff.valerioHeals.interval,
                            tickCounter: 0,
                        };
                    }
                    // Magic damage reduction for all synergy chars
                    if (syn.chars.indexOf(u.charId) !== -1) {
                        u.magicResist += syn.buff.magicDmgReduction;
                    }
                    // Debuff: +2 to ability cooldowns
                    if (syn.chars.indexOf(u.charId) !== -1) {
                        u.abilityCooldown += syn.debuff.cdIncrease;
                    }
                }
                break;

            case 'senzaIlBanchiere':
                // Buff: Caronte Tesi lifesteal 10%, Yujin immune to slow
                // Debuff: negative effects last 1.5x longer
                for (var i = 0; i < units.length; i++) {
                    var u = units[i];
                    if (u.charId === 'Caronte') {
                        u._synergyTesiLifesteal = syn.buff.tesiLifesteal;
                    }
                    if (u.charId === 'Yujin') {
                        u._synergySlowImmune = syn.buff.yujinSlowImmune;
                    }
                    // Debuff: negative effects duration multiplier
                    if (syn.chars.indexOf(u.charId) !== -1) {
                        u._synergyNegEffDurMult = syn.debuff.negativeEffectDurMult;
                    }
                }
                break;

            // === QUARTET ===

            case 'gliAmici':
                // Buff: +20% ATK to all surviving allies on each ally death
                for (var i = 0; i < units.length; i++) {
                    units[i]._synergyAmici = true;
                    units[i]._synergyAmiciBonus = syn.buff.atkBonusPerDeath;
                }
                break;
        }
    }
}

// --- Get formatted synergy display info for UI ---
// Returns an array of { name, type, description } objects.
function getSynergyDisplayInfo(activeSynergies) {
    var info = [];
    for (var i = 0; i < activeSynergies.length; i++) {
        var syn = activeSynergies[i];
        var desc = '';

        switch (syn.id) {
            case 'accademiaLosca':
                desc = 'Babidi e Caronte: colpi applicano 10% slow.';
                break;
            case 'pazienzaInfinita':
                desc = 'Valerio: +1 armatura ogni 3 tick (max 5).';
                break;
            case 'contrattoGuerra':
                desc = 'Yujin: +15% danno per moneta di Babidi (max 3).';
                break;
            case 'caviaLaboratorio':
                desc = 'Caronte: 25% danno Tesi deviato a Valerio. Valerio: +40% regen.';
                break;
            case 'caosAccademico':
                desc = 'Yujin: attivazione Furia infligge debuff a tutti i nemici.';
                break;
            case 'corpoEForza':
                desc = 'Valerio regen convertita in +15% ATK per Yujin.';
                break;
            case 'senzaIlMartello':
                desc = '+30% res. magica, Tesi CD 4. Debuff: -20% ATK fisico.';
                break;
            case 'senzaIlMuro':
                desc = 'Babidi 2 monete, Tesi tick 0, Furia tick 1. Debuff: -15% HP max, no regen.';
                break;
            case 'senzaLaMente':
                desc = 'Valerio cura alleati 5%/3 tick, +70% res. magica. Debuff: +2 CD.';
                break;
            case 'senzaIlBanchiere':
                desc = 'Tesi lifesteal 10%, Yujin immune slow. Debuff: debuff +50% durata.';
                break;
            case 'gliAmici':
                desc = 'Ogni morte alleata: +20% ATK a tutti i sopravvissuti.';
                break;
            default:
                desc = syn.name;
                break;
        }

        info.push({
            name: syn.name,
            type: syn.type,
            description: desc,
        });
    }
    return info;
}
