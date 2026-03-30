// ============================================================
// LOTA AUTO CHESS — combat.js — Combat engine (4-player FFA)
// ============================================================

// --- Damage Pipeline ---
function calculateDamage(attacker, defender, damageType) {
    let raw = attacker.atk * attacker.dmgMultiplier;
    if (attacker._cristalloAtkMult) raw *= attacker._cristalloAtkMult;
    if (attacker._ragnarokAtkMult) raw *= attacker._ragnarokAtkMult;
    if (attacker._contrattoAtkMult) raw *= attacker._contrattoAtkMult;
    if (attacker._corpoEForzaAtkMult) raw *= attacker._corpoEForzaAtkMult;
    // biome ATK bonus removed
    // Apply atk_reduction effects
    for (var ari = 0; ari < attacker.effects.length; ari++) {
        if (attacker.effects[ari].type === 'atk_reduction' && attacker.effects[ari].ticksLeft > 0) {
            raw *= (1 - attacker.effects[ari].value);
        }
    }

    let reduced = raw;
    if (damageType === DMG_PHYSICAL) {
        reduced = raw * (ARMOR_K / (defender.armor + ARMOR_K));
    }

    const variance = 1 + randFloat(-DAMAGE_VARIANCE, DAMAGE_VARIANCE);
    let dmg = reduced * variance;

    // Skill: Valchiria — 600% next attack
    if (attacker._valkyrieNextAtk) {
        dmg *= 6.0;
        attacker._valkyrieNextAtk = false;
    }

    let isCrit = false;
    if (damageType !== DMG_MAGIC_PURE) {
        // Skill: Bocciatura — guaranteed crit
        if (defender._guaranteedCrit) {
            dmg *= CRIT_MULTIPLIER;
            isCrit = true;
            defender._guaranteedCrit = false;
        } else if (Math.random() < attacker.critChance) {
            dmg *= CRIT_MULTIPLIER;
            isCrit = true;
        }
    }

    let isMiss = false;
    if (damageType !== DMG_MAGIC_PURE) {
        if (Math.random() < MISS_CHANCE) {
            isMiss = true;
            dmg = 0;
        }
    }

    let isDodge = false;
    if (!isMiss && defender.dodgeChance > 0) {
        if (Math.random() < defender.dodgeChance) {
            isDodge = true;
            dmg = 0;
        }
    }

    return {
        damage: Math.max(0, Math.round(dmg)),
        isCrit, isMiss, isDodge,
        damageType,
    };
}

// --- Apply damage to a unit ---
function applyDamage(unit, dmgResult, source) {
    if (!unit.alive) return;

    // Skill: Invulnerability (Valchiria, Trascendenza)
    if (unit._invulnerable) {
        addDamageNumber(unit, 0, 'dodge');
        return;
    }

    // Skill: Untargetable (Tana Sotterranea)
    if (unit._untargetable) return;

    if (dmgResult.isMiss) {
        addDamageNumber(unit, 0, 'miss');
        return;
    }
    if (dmgResult.isDodge) {
        addDamageNumber(unit, 0, 'dodge');
        return;
    }

    var dmg = dmgResult.damage;

    // Skill: Damage reduction (Trascendenza)
    if (unit._dmgReduction && unit._dmgReduction > 0) {
        dmg = Math.round(dmg * (1 - unit._dmgReduction));
    }

    if (unit.shield > 0 && dmg > 0) {
        var absorbed = Math.min(unit.shield, dmg);
        unit.shield -= absorbed;
        dmg -= absorbed;
    }

    unit.hp -= dmg;
    if (dmg > 0 && source) unit._lastHitBy = source.id;

    var type = dmgResult.isCrit ? 'crit' : (dmgResult.damageType === DMG_MAGIC || dmgResult.damageType === DMG_MAGIC_PURE ? 'magic' : 'normal');
    if (dmg > 0) addDamageNumber(unit, dmg, type);

    // Skill: Reflect damage (Specchio Cosmico, Scudo di Ghiaccio)
    if (unit._reflectDmgPercent && unit._reflectDmgPercent > 0 && source && source.alive && dmg > 0) {
        var reflectDmg = Math.round(dmg * unit._reflectDmgPercent);
        if (reflectDmg > 0) {
            source.hp -= reflectDmg;
            addDamageNumber(source, reflectDmg, 'magic');
            if (source.hp <= 0) { source.hp = 0; source.alive = false; }
        }
    }

    // Skill: Counter damage (Muro di Lame)
    if (unit._counterDmgPercent && unit._counterDmgPercent > 0 && source && source.alive && dmg > 0) {
        var dist = chebyshevDist(unit.row, unit.col, source.row, source.col);
        if (dist <= 1) { // melee only
            var counterDmg = Math.round(unit.atk * unit._counterDmgPercent);
            source.hp -= counterDmg;
            addDamageNumber(source, counterDmg, 'crit');
            if (source.hp <= 0) { source.hp = 0; source.alive = false; }
        }
    }

    // Skill: Lifesteal (Giuramento di Sangue)
    if (source && source._lifestealPercent && source._lifestealPercent > 0 && dmg > 0) {
        var lifeHeal = Math.round(dmg * source._lifestealPercent);
        source.hp = Math.min(source.maxHp, source.hp + lifeHeal);
    }

    // Skill: Monopolio — damage generates gold
    if (source && source._monopolioTicks && source._monopolioTicks > 0 && dmg > 0 && typeof source.owner === 'number') {
        var goldGain = 0.5;
        if (typeof players !== 'undefined' && players[source.owner]) {
            if (typeof addGold === 'function') {
                addGold(players[source.owner], goldGain, true);
            } else {
                players[source.owner].gold += goldGain;
                players[source.owner].totalGoldEarned += goldGain;
            }
        }
    }

    // Valerio Thorns
    if (unit.charId === 'Valerio' && dmgResult.damageType === DMG_PHYSICAL && source && source.alive && dmg > 0) {
        var thornsDmg = Math.round(dmgResult.damage * 0.08);
        if (thornsDmg > 0) {
            source.hp -= thornsDmg;
            addDamageNumber(source, thornsDmg, 'magic');
            if (source.hp <= 0) {
                source.hp = 0;
                source.alive = false;
            }
        }
    }

    // Muta Coriacea death prevention
    if (unit.hp <= 0 && !unit.deathPreventionUsed && unit.items.includes('mutaCoriacea')) {
        unit.deathPreventionUsed = true;
        unit.hp = 1;
        if (unit.hp / unit.maxHp < 0.50) {
            unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.20));
        }
    }

    // Nucleo Immortale death prevention
    if (unit.hp <= 0 && !unit.nucleoUsed && unit.items.includes('nucleoImmortale')) {
        unit.nucleoUsed = true;
        unit.hp = 1;
        unit.reviving = true;
        unit.reviveTicks = 2;
    }

    if (unit.hp <= 0 && !unit.reviving) {
        unit.hp = 0;
        unit.alive = false;
    }
}

// --- Apply pure damage ---
function applyPureDamage(unit, amount, source) {
    if (!unit.alive) return;
    if (source && source.id === unit.id) {
        unit.hp -= amount;
    } else {
        let dmg = amount;
        if (unit.shield > 0) {
            const absorbed = Math.min(unit.shield, dmg);
            unit.shield -= absorbed;
            dmg -= absorbed;
        }
        unit.hp -= dmg;
    }
    // Muta Coriacea death prevention
    if (unit.hp <= 0 && !unit.deathPreventionUsed && unit.items && unit.items.includes('mutaCoriacea')) {
        unit.deathPreventionUsed = true;
        unit.hp = 1;
        if (unit.hp / unit.maxHp < 0.50) {
            unit.hp = Math.min(unit.maxHp, unit.hp + Math.floor(unit.maxHp * 0.20));
        }
    }
    // Nucleo Immortale death prevention
    if (unit.hp <= 0 && !unit.nucleoUsed && unit.items && unit.items.includes('nucleoImmortale')) {
        unit.nucleoUsed = true;
        unit.hp = 1;
        unit.reviving = true;
        unit.reviveTicks = 2;
    }
    if (unit.hp <= 0 && !unit.reviving) {
        unit.hp = 0;
        unit.alive = false;
    }
}

// --- Process status effects ---
function processStatusEffects(units) {
    for (const unit of units) {
        if (!unit.alive) continue;

        if (unit.reviving) {
            unit.reviveTicks--;
            if (unit.reviveTicks <= 0) {
                unit.reviving = false;
                unit.hp = Math.floor(unit.maxHp * 0.30);
                unit.alive = true;
            }
            continue;
        }

        const remainingEffects = [];
        for (const eff of unit.effects) {
            switch (eff.type) {
                case 'poison': {
                    var poisonMult = (unit._poisonDmgMult && unit._poisonDmgMult > 1) ? unit._poisonDmgMult : 1;
                    var dmg = Math.round(eff.value * poisonMult);
                    unit.hp -= dmg;
                    addDamageNumber(unit, dmg, 'magic');
                    if (unit.hp <= 0) { unit.hp = 0; unit.alive = false; }
                    break;
                }
            }
            eff.ticksLeft--;
            if (eff.ticksLeft > 0) {
                remainingEffects.push(eff);
            }
        }
        unit.effects = remainingEffects;
    }
}

function hasEffect(unit, effectType) {
    return unit.effects.some(e => e.type === effectType && e.ticksLeft > 0);
}

function isNegativeEffect(type) {
    return type === 'poison' || type === 'speed_reduction' || type === 'freeze' ||
           type === 'silence' || type === 'atk_reduction' || type === 'stun';
}

function applyEffect(unit, effect, source) {
    // Yujin slow immunity (senzaIlBanchiere synergy)
    if (unit._synergySlowImmune && effect.type === 'speed_reduction') return;

    var adjustedEffect = { ...effect };

    // Dottorato Maledetto: source doubles debuff duration
    if (source && source.items && source.items.indexOf('dottoratoMaledetto') !== -1 && isNegativeEffect(adjustedEffect.type)) {
        if (adjustedEffect.ticksLeft) adjustedEffect.ticksLeft = Math.round(adjustedEffect.ticksLeft * 2.0);
    }

    // Synergy debuff: negative effects on this unit last longer (senzaIlBanchiere)
    if (unit._synergyNegEffDurMult && isNegativeEffect(adjustedEffect.type)) {
        if (adjustedEffect.ticksLeft) adjustedEffect.ticksLeft = Math.round(adjustedEffect.ticksLeft * unit._synergyNegEffDurMult);
    }

    if (adjustedEffect.stacking === 'refresh') {
        var existing = unit.effects.find(function(e) { return e.type === adjustedEffect.type && e.sourceType === adjustedEffect.sourceType; });
        if (existing) {
            existing.ticksLeft = adjustedEffect.ticksLeft;
            return;
        }
    }
    unit.effects.push(adjustedEffect);
}

// --- Process attacks for a unit (FFA: enemies from all opposing teams) ---
function processAttack(unit, enemies, allUnits, grid) {
    if (!unit.alive || hasEffect(unit, 'freeze') || hasEffect(unit, 'stun')) return;

    var effectiveAtkSpeed = unit.atkSpeed / unit.atkSpeedMultiplier;
    // Apply speed_reduction effects (slow attack speed — higher timer = slower)
    for (var sri = 0; sri < unit.effects.length; sri++) {
        if (unit.effects[sri].type === 'speed_reduction' && unit.effects[sri].ticksLeft > 0) {
            effectiveAtkSpeed /= (1 - unit.effects[sri].value);
        }
    }
    unit.atkTimer -= TICK_DURATION_S;

    if (unit.atkTimer > 0) return;

    // Build allies list for order-aware targeting (proteggi/segui)
    var atkAllies = [];
    for (var ai = 0; ai < allUnits.length; ai++) {
        if (allUnits[ai].alive && String(allUnits[ai].owner) === String(unit.owner)) atkAllies.push(allUnits[ai]);
    }
    var target = selectTarget(unit, enemies, atkAllies);
    if (!target) return;

    var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
    if (dist > unit.range) return;

    unit.atkTimer = effectiveAtkSpeed;
    unit.atkAnim = 1.0;
    target.hitAnim = 1.0;

    // ORDER_ATTACK: +10% damage bonus
    if (unit.tacticalOrder === ORDER_ATTACK) unit.dmgMultiplier *= 1.10;
    var dmgResult = calculateDamage(unit, target, DMG_PHYSICAL);
    if (unit.tacticalOrder === ORDER_ATTACK) unit.dmgMultiplier /= 1.10;
    applyDamage(target, dmgResult, unit);

    // VFX: auto-attack animation
    if (typeof vfxMeleeAttack === 'function' && !dmgResult.isMiss && !dmgResult.isDodge) {
        var atkPos = cellToPixel(unit.row, unit.col);
        var tgtPos = cellToPixel(target.row, target.col);
        if (unit.range <= 1) {
            vfxMeleeAttack(atkPos.x, atkPos.y, tgtPos.x, tgtPos.y, unit.charId, dmgResult.isCrit);
        } else {
            vfxRangedAttack(atkPos.x, atkPos.y, tgtPos.x, tgtPos.y, unit.charId, dmgResult.isCrit);
        }
    }

    // Skill: Double Strike (Sdoppiamento)
    if (unit._doubleStrike && target.alive) {
        var dmg2 = calculateDamage(unit, target, DMG_PHYSICAL);
        applyDamage(target, dmg2, unit);
    }

    if (!dmgResult.isMiss && !dmgResult.isDodge) {
        // Babidi: Veleno del Mercante
        if (unit.charId === 'Babidi') {
            applyEffect(target, {
                type: 'poison',
                value: Math.round(target.maxHp * 0.01),
                ticksLeft: 3,
                stacking: 'refresh',
                sourceType: 'veleno_mercante',
            }, unit);
        }

        // Babidi: Mercato Nero
        if (unit.charId === 'Babidi' && unit.coins >= 2) {
            unit.coins = 0;
            applyEffect(target, { type: 'atk_reduction', value: 0.30, ticksLeft: 5, sourceType: 'maledizione' }, unit);
            applyEffect(target, { type: 'speed_reduction', value: 0.20, ticksLeft: 3, sourceType: 'maledizione' }, unit);
            combatLog.push('Babidi lancia Maledizione su ' + target.charId + '!');
            if (typeof vfxPoison === 'function') { var mp = cellToPixel(target.row, target.col); vfxPoison(mp.x, mp.y); }
        }

        // Item: Bilancia del Mercato poison
        if (unit.items.includes('bilanciaDelMercato')) {
            applyEffect(target, {
                type: 'poison',
                value: Math.round(target.maxHp * 0.02),
                ticksLeft: 3,
                stacking: 'refresh',
                sourceType: 'bilancia',
            }, unit);
        }

        // Item: Accusa Formale slow
        if (unit.items.includes('accusaFormale') && Math.random() < 0.25) {
            applyEffect(target, { type: 'speed_reduction', value: 0.20, ticksLeft: 2, sourceType: 'accusa' }, unit);
        }

        // Synergy: Academia Losca — Babidi/Caronte on-hit 10% slow
        if (unit._synergySpellSlow) {
            applyEffect(target, { type: 'speed_reduction', value: unit._synergySpellSlow, ticksLeft: 2, sourceType: 'accademiaLosca' }, unit);
        }

        // Item: Scimitarra del Deserto — at max kill stacks, apply ATK reduction
        if (unit.items.includes('scimitarraDeserto') && unit.killStacks >= 3) {
            applyEffect(target, { type: 'atk_reduction', value: 0.30, ticksLeft: 5, sourceType: 'scimitarra' }, unit);
        }

        // Item: Veleno Accademico — gain charge on hit, at 5 charges poison all enemies
        if (unit.items.includes('velenoAccademico')) {
            unit.velenoCharges = (unit.velenoCharges || 0) + 1;
            if (unit.velenoCharges >= 5) {
                unit.velenoCharges = 0;
                for (var ve = 0; ve < enemies.length; ve++) {
                    if (enemies[ve].alive) {
                        applyEffect(enemies[ve], {
                            type: 'poison',
                            value: Math.round(enemies[ve].maxHp * 0.02),
                            ticksLeft: 3, stacking: 'refresh', sourceType: 'velenoAccademico',
                        }, unit);
                    }
                }
                combatLog.push(unit.charId + ': Veleno Accademico avvelena tutti i nemici!');
            }
        }
    }
}

// --- Process abilities for a unit ---
function processAbility(unit, allies, enemies, allUnits, grid) {
    if (!unit.alive || hasEffect(unit, 'silence') || hasEffect(unit, 'freeze') || hasEffect(unit, 'stun')) return;

    // Caronte: Tesi Difettosa
    if (unit.charId === 'Caronte') {
        unit.abilityCooldown -= 1;
        if (unit.abilityCooldown <= 0) {
            var target = findHighestHpEnemy(unit, enemies);
            if (target) {
                var tesiPercent = 0.15;
                // Skill: Tesi Potenziata — next Tesi does 25%
                if (unit._tesiPotenziata) { tesiPercent = 0.25; unit._tesiPotenziata = false; }
                // Skill: Doppio Incarico — hits 2 targets at 10% each
                if (unit._doppioIncarico) {
                    tesiPercent = 0.10;
                    var target2 = null;
                    for (var ei = 0; ei < enemies.length; ei++) {
                        if (enemies[ei].alive && enemies[ei].id !== target.id) {
                            if (!target2 || enemies[ei].hp > target2.hp) target2 = enemies[ei];
                        }
                    }
                    if (target2) {
                        var dmg2 = Math.round(target2.maxHp * 0.10);
                        applyPureDamage(target2, dmg2, unit);
                        addDamageNumber(target2, dmg2, 'magic');
                    }
                    unit._doppioIncarico = false;
                }
                var tesiDmg = Math.round(target.maxHp * tesiPercent);

                // Cavia da Laboratorio: redirect 25% of Tesi damage to Valerio
                if (unit._synergyRedirect) {
                    var redirectDmg = Math.round(tesiDmg * unit._synergyRedirect);
                    tesiDmg -= redirectDmg;
                    for (var ra = 0; ra < allies.length; ra++) {
                        if (allies[ra].charId === 'Valerio' && allies[ra].alive) {
                            allies[ra].hp -= redirectDmg;
                            addDamageNumber(allies[ra], redirectDmg, 'magic');
                            if (allies[ra].hp <= 0) { allies[ra].hp = 0; allies[ra].alive = false; }
                            break;
                        }
                    }
                }

                applyPureDamage(target, tesiDmg, unit);
                addDamageNumber(target, tesiDmg, 'magic');
                combatLog.push('Caronte: Tesi Difettosa su ' + target.charId + ' (' + tesiDmg + ' dmg)');
                // VFX: Tesi bolt
                if (typeof vfxTesi === 'function') {
                    var cp = cellToPixel(unit.row, unit.col);
                    var tp = cellToPixel(target.row, target.col);
                    vfxTesi(cp.x, cp.y, tp.x, tp.y);
                }

                // Senza il Banchiere: Tesi lifesteal
                if (unit._synergyTesiLifesteal) {
                    var healAmt = Math.round(tesiDmg * unit._synergyTesiLifesteal);
                    unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
                }

                var recoil = Math.round(unit.maxHp * 0.05);
                applyPureDamage(unit, recoil, unit);
                addDamageNumber(unit, recoil, 'magic');

                unit.abilityCooldown = 6;
                unit.lastAllyAbility = 'tesiDifettosa';

                for (var ta = 0; ta < allies.length; ta++) {
                    if (allies[ta].charId === 'WMS' && allies[ta].alive) {
                        allies[ta].lastAllyAbility = 'tesiDifettosa';
                    }
                }
            }
        }
    }

    // Furia del Nord tick-down (works for both Yujin and WMS via Eco di Battaglia)
    if (unit.furiaActive) {
        unit.furiaTicks--;
        if (unit.furiaTicks <= 0) {
            unit.furiaActive = false;
            var furiaSpeedMult = (unit.charId === 'Yujin') ? (1 + 0.60) : (1 + 0.60 * (unit.star >= 3 ? 0.85 : 0.60));
            var furiaDmgMult = (unit.charId === 'Yujin') ? (1 + 0.20) : (1 + 0.20 * (unit.star >= 3 ? 0.85 : 0.60));
            unit.atkSpeedMultiplier /= furiaSpeedMult;
            unit.dmgMultiplier /= furiaDmgMult;
            unit.noHealDuringFuria = false;
        }
    }

    // Yujin: Furia del Nord
    if (unit.charId === 'Yujin') {
        unit.abilityCooldown -= 1;
        if (unit.abilityCooldown <= 0 && !unit.furiaActive) {
            unit.furiaActive = true;
            unit.furiaTicks = 3;
            // Ascia delle Fjord: extend Furia by 1 tick
            if (unit.items.indexOf('asciaFjord') !== -1) unit.furiaTicks += 1;
            unit.atkSpeedMultiplier *= (1 + 0.60);
            unit.dmgMultiplier *= (1 + 0.20);
            unit.noHealDuringFuria = true;
            unit.abilityCooldown = 8;
            combatLog.push('Yujin attiva Furia del Nord!');
            // VFX: Furia activation
            if (typeof vfxFuriaActivation === 'function') {
                var fp = cellToPixel(unit.row, unit.col);
                vfxFuriaActivation(fp.x, fp.y);
            }

            // Caos Accademico: Furia debuffs spread to all enemies
            if (unit._synergyFuriaSpread) {
                for (var fs = 0; fs < enemies.length; fs++) {
                    if (enemies[fs].alive) {
                        applyEffect(enemies[fs], { type: 'atk_reduction', value: 0.20, ticksLeft: 3, sourceType: 'caosAccademico' }, unit);
                        applyEffect(enemies[fs], { type: 'speed_reduction', value: 0.10, ticksLeft: 3, sourceType: 'caosAccademico' }, unit);
                    }
                }
                combatLog.push('Caos Accademico: debuff spread a tutti i nemici!');
            }

            unit.lastAllyAbility = 'furia';
            for (var fa = 0; fa < allies.length; fa++) {
                if (allies[fa].charId === 'WMS' && allies[fa].alive) {
                    allies[fa].lastAllyAbility = 'furia';
                }
            }
        }
    }

    // Valerio: Rigenerazione Segmentale
    if (unit.charId === 'Valerio') {
        if (!unit.noHealDuringFuria && !unit._synergyNoRegen) {
            var regenAmount = Math.round(unit.maxHp * 0.015);

            if (unit.hp / unit.maxHp < 0.30 && !unit.enhancedRegenUsed) {
                unit.enhancedRegenUsed = true;
                unit.enhancedRegenTicks = 4;
            }
            if (unit.enhancedRegenTicks > 0) {
                regenAmount *= 3;
                unit.enhancedRegenTicks--;
            }

            // Cavia da Laboratorio: +40% regen bonus
            if (unit._synergyRegenBonus) {
                regenAmount = Math.round(regenAmount * (1 + unit._synergyRegenBonus));
            }

            unit.hp = Math.min(unit.maxHp, unit.hp + regenAmount);
        }

        // Senza la Mente: Valerio heals allies 5% every 3 ticks
        if (unit._synergyHealAllies) {
            unit._synergyHealAllies.tickCounter++;
            if (unit._synergyHealAllies.tickCounter >= unit._synergyHealAllies.interval) {
                unit._synergyHealAllies.tickCounter = 0;
                for (var ha = 0; ha < allies.length; ha++) {
                    if (allies[ha].id !== unit.id && allies[ha].alive) {
                        var healAmt = Math.round(allies[ha].maxHp * unit._synergyHealAllies.percent);
                        allies[ha].hp = Math.min(allies[ha].maxHp, allies[ha].hp + healAmt);
                    }
                }
            }
        }
    }

    // WMS: Eco di Battaglia
    if (unit.charId === 'WMS') {
        unit.abilityCooldown -= 1;
        if (unit.abilityCooldown <= 0 && unit.lastAllyAbility) {
            const potency = unit.star >= 3 ? 0.85 : 0.60;
            if (unit.lastAllyAbility === 'tesiDifettosa') {
                const target = findHighestHpEnemy(unit, enemies);
                if (target) {
                    const dmg = Math.round(target.maxHp * 0.15 * potency);
                    applyPureDamage(target, dmg, unit);
                    addDamageNumber(target, dmg, 'magic');
                    combatLog.push('WMS: Eco di Battaglia ripete Tesi (' + dmg + ' dmg)');
                }
            } else if (unit.lastAllyAbility === 'furia') {
                if (!unit.furiaActive) {
                    unit.furiaActive = true;
                    unit.furiaTicks = 3;
                    if (unit.items.indexOf('asciaFjord') !== -1) unit.furiaTicks += 1;
                    unit.atkSpeedMultiplier *= (1 + 0.60 * potency);
                    unit.dmgMultiplier *= (1 + 0.20 * potency);
                    combatLog.push('WMS: Eco di Battaglia ripete Furia!');
                }
            }
            unit.abilityCooldown = 7;
        }
    }

    // Item: Esoscheletro Segmentale regen
    if (unit.items.includes('esoscheletroSeg')) {
        const regen = Math.round(unit.maxHp * 0.01);
        unit.hp = Math.min(unit.maxHp, unit.hp + regen);
    }

    // Creep abilities
    if (unit.creepAbility) {
        processCreepAbility(unit, enemies, allUnits);
    }
}

// --- Creep ability processing ---
function processCreepAbility(creep, enemies, allUnits) {
    const ab = creep.creepAbility;
    if (!ab) return;

    if (ab.trigger === 'every_8_ticks' && combatTick % 8 === 0) {
        const alive = enemies.filter(e => e.alive);
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (target) applyEffect(target, { type: 'speed_reduction', value: ab.value, ticksLeft: ab.duration, sourceType: 'creep' });
    }
    if (ab.trigger === 'every_10_ticks' && combatTick % 10 === 0) {
        for (const e of enemies) {
            if (e.alive) applyEffect(e, { type: 'atk_reduction', value: ab.value, ticksLeft: ab.duration, sourceType: 'creep' });
        }
    }
    if (ab.trigger === 'every_6_ticks' && combatTick % 6 === 0) {
        const alive = enemies.filter(e => e.alive);
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (target) applyEffect(target, { type: 'poison', value: Math.round(target.maxHp * ab.value), ticksLeft: ab.duration, stacking: 'refresh', sourceType: 'creep' });
    }
    if (ab.trigger === 'every_5_ticks' && combatTick % 5 === 0) {
        const alive = enemies.filter(e => e.alive);
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (target) applyEffect(target, { type: 'silence', ticksLeft: ab.duration, sourceType: 'creep' });
    }
    if (ab.trigger === 'every_7_ticks' && combatTick % 7 === 0) {
        const alive = enemies.filter(e => e.alive);
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (target) applyEffect(target, { type: 'freeze', ticksLeft: ab.duration, sourceType: 'creep' });
    }
    if (ab.trigger === 'hp_below_50' && creep.hp / creep.maxHp < 0.50) {
        creep.atkSpeedMultiplier = 1 + ab.value;
    }
    if (ab.trigger === 'hp_below_30' && creep.hp / creep.maxHp < 0.30) {
        creep.hp = Math.min(creep.maxHp, creep.hp + Math.round(creep.maxHp * ab.value));
    }
    if (ab.trigger === 'hp_phase') {
        if (creep.hp / creep.maxHp >= 0.50) {
            // target highest HP — default
        } else if (combatTick % 4 === 0) {
            for (const e of enemies) {
                if (e.alive) {
                    const dmg = Math.round(creep.atk * 0.5);
                    e.hp -= dmg;
                    addDamageNumber(e, dmg, 'normal');
                    if (e.hp <= 0) { e.hp = 0; e.alive = false; }
                }
            }
        }
    }
}

// --- On enemy death callbacks ---
function processDeathCallbacks(deadUnit, killer, teams) {
    // Babidi: gain coin on enemy death (for allies of the killer)
    if (killer) {
        var killerTeam = teams[String(killer.owner)];
        if (killerTeam) {
            for (var i = 0; i < killerTeam.length; i++) {
                if (killerTeam[i].charId === 'Babidi' && killerTeam[i].alive) {
                    killerTeam[i].coins = Math.min(killerTeam[i].coins + 1, 3);
                }
            }
        }
    }

    // Yujin: kill during Furia resets CD
    if (killer && killer.charId === 'Yujin' && killer.furiaActive) {
        killer.abilityCooldown = 0;
        combatLog.push('Yujin: kill durante Furia, CD reset!');
    }

    // PvP kill reward: +1 gold per enemy unit killed (not creeps)
    if (killer && typeof killer.owner === 'number' && typeof deadUnit.owner === 'number'
        && killer.owner !== deadUnit.owner && !deadUnit.campId) {
        if (typeof players !== 'undefined' && players[killer.owner] && !players[killer.owner].eliminated) {
            var killGold = (typeof PVP_KILL_GOLD !== 'undefined') ? PVP_KILL_GOLD : 1;
            if (typeof addGold === 'function') {
                addGold(players[killer.owner], killGold, true);
            } else {
                players[killer.owner].gold += killGold;
                players[killer.owner].totalGoldEarned += killGold;
            }
            combatLog.push(killer.charId + ' uccide ' + deadUnit.charId + '! +' + killGold + 'g');
        }
    }

    // Camp creep killed: award reward to killer's owner
    if (deadUnit.campId && killer && typeof killer.owner === 'number') {
        awardCampReward(killer.owner, deadUnit, currentRound);
    }

    // Dungeon boss killed: award reward and increment kill counter
    if (deadUnit.isDungeonBoss && killer && typeof killer.owner === 'number') {
        awardCampReward(killer.owner, deadUnit, currentRound);
        if (typeof globalDungeonBossKills !== 'undefined' && deadUnit.dungeonId) {
            globalDungeonBossKills[deadUnit.dungeonId] = (globalDungeonBossKills[deadUnit.dungeonId] || 0) + 1;
            // Sync to server in multiplayer
            if (typeof lobbySocket !== 'undefined' && lobbySocket && lobbySocket.readyState === 1 && !window._singlePlayerMode) {
                lobbySocket.send(JSON.stringify({ type: 'boss_killed', dungeonId: deadUnit.dungeonId }));
            }
        }
    }

    // Item: Cintura del Berserker — on kill, bonus attack
    if (killer && killer.items.includes('cinturaBerserker')) {
        killer.atkTimer = 0;
    }

    // Item: Scimitarra del Deserto stacks
    if (killer && killer.items.includes('scimitarraDeserto')) {
        killer.killStacks = Math.min((killer.killStacks || 0) + 1, 3);
    }

    // Synergy: Gli Amici — +20% ATK to surviving allies on ally death
    if (deadUnit._synergyAmici) {
        var amiciTeam = teams[String(deadUnit.owner)];
        if (amiciTeam) {
            for (var ai = 0; ai < amiciTeam.length; ai++) {
                if (amiciTeam[ai].alive && amiciTeam[ai]._synergyAmici) {
                    amiciTeam[ai].atk = Math.round(amiciTeam[ai].atk * (1 + (amiciTeam[ai]._synergyAmiciBonus || 0.20)));
                    amiciTeam[ai].amiciStacks++;
                    combatLog.push('Gli Amici: ' + amiciTeam[ai].charId + ' +ATK!');
                }
            }
        }
    }

    // Item: Sigillo dell'Usuraio — on kill +1 gold (double if all 4 chars on field)
    if (killer && killer.items.indexOf('sigilloDellUsuraio') !== -1 && typeof killer.owner === 'number') {
        var sigGold = 1;
        var sigTeam = teams[String(killer.owner)];
        if (sigTeam) {
            var sigChars = [];
            for (var sc = 0; sc < sigTeam.length; sc++) {
                if (sigTeam[sc].alive && sigChars.indexOf(sigTeam[sc].charId) === -1) {
                    sigChars.push(sigTeam[sc].charId);
                }
            }
            if (sigChars.length >= 4) sigGold = 2;
        }
        if (typeof players !== 'undefined' && players[killer.owner]) {
            if (typeof addGold === 'function') {
                addGold(players[killer.owner], sigGold, true);
            } else {
                players[killer.owner].gold += sigGold;
                players[killer.owner].totalGoldEarned += sigGold;
            }
            combatLog.push(killer.charId + ': Sigillo dell\'Usuraio +' + sigGold + 'g!');
        }
    }

    // Item: Dottorato Maledetto — on kill of debuffed enemy, heal 40%
    if (killer && killer.items.indexOf('dottoratoMaledetto') !== -1) {
        var wasDebuffed = deadUnit.effects && deadUnit.effects.some(function(e) {
            return isNegativeEffect(e.type);
        });
        if (wasDebuffed) {
            var dotHeal = Math.round(killer.maxHp * 0.40);
            killer.hp = Math.min(killer.maxHp, killer.hp + dotHeal);
            combatLog.push(killer.charId + ': Dottorato Maledetto cura ' + dotHeal + ' HP!');
        }
    }
}

// --- Main combat tick (4-player FFA) ---
// teams = { '0': [units], '1': [units], '2': [units], '3': [units], 'creep': [units] }
var _combatGrid = null; // Exposed for knockback/movement grid updates
function runCombatTick(teams, grid) {
    _combatGrid = grid;
    combatTick++;

    // Gather all living units
    var allUnits = [];
    for (var key in teams) {
        var team = teams[key];
        for (var i = 0; i < team.length; i++) {
            if (team[i].alive) allUnits.push(team[i]);
        }
    }

    // Step 0: Execute pending player skill
    if (typeof executePendingSkill === 'function') {
        executePendingSkill(teams, grid, allUnits);
    }

    // Step 1: Process status effects
    processStatusEffects(allUnits);

    // Step 1a: Process combat zones, skill buffs, and AI skill usage
    if (typeof processCombatZones === 'function') processCombatZones(teams, allUnits);
    if (typeof processSkillBuffs === 'function') processSkillBuffs(allUnits, grid);
    if (typeof aiUseSkills === 'function') aiUseSkills(teams, grid, allUnits);

    // Step 1b: Dynamic item & synergy bonuses
    for (var di = 0; di < allUnits.length; di++) {
        var dUnit = allUnits[di];
        if (!dUnit.alive) continue;

        // Cristallo Risonante: +5% ATK per alive ally, +30% if last survivor
        if (dUnit.items.indexOf('cristalloRisonante') !== -1) {
            var crAllies = getAlliesOf(dUnit, teams);
            var crAliveCount = 0;
            for (var ca = 0; ca < crAllies.length; ca++) {
                if (crAllies[ca].id !== dUnit.id && crAllies[ca].alive) crAliveCount++;
            }
            dUnit._cristalloAtkMult = crAliveCount === 0 ? 1.30 : 1 + crAliveCount * 0.05;
        }

        // Ragnarök: +15% ATK if any ally below 30% HP
        if (dUnit.items.indexOf('ragnarok') !== -1) {
            var rgAllies = getAlliesOf(dUnit, teams);
            var anyLow = false;
            for (var rga = 0; rga < rgAllies.length; rga++) {
                if (rgAllies[rga].id !== dUnit.id && rgAllies[rga].alive && rgAllies[rga].hp / rgAllies[rga].maxHp < 0.30) {
                    anyLow = true; break;
                }
            }
            dUnit._ragnarokAtkMult = anyLow ? 1.15 : 1.0;
        }

        // Contratto di Guerra: Yujin +15% dmg per Babidi coin
        if (dUnit._synergyCoinDmg) {
            var cgAllies = getAlliesOf(dUnit, teams);
            var bab = null;
            for (var ba = 0; ba < cgAllies.length; ba++) {
                if (cgAllies[ba].charId === 'Babidi' && cgAllies[ba].alive) { bab = cgAllies[ba]; break; }
            }
            dUnit._contrattoAtkMult = bab ? 1 + Math.min(bab.coins, dUnit._synergyCoinDmg.maxCoins) * dUnit._synergyCoinDmg.dmgPerCoin : 1.0;
        }

        // Corpo e Forza: Yujin +15% ATK while Valerio alive
        if (dUnit._synergyRegenToAtk) {
            var ceAllies = getAlliesOf(dUnit, teams);
            var valAlive = false;
            for (var va = 0; va < ceAllies.length; va++) {
                if (ceAllies[va].charId === 'Valerio' && ceAllies[va].alive) { valAlive = true; break; }
            }
            dUnit._corpoEForzaAtkMult = valAlive ? 1 + dUnit._synergyRegenToAtk : 1.0;
        }

        // Biome bonuses removed

        // Pazienza Infinita: Valerio armor stacking every 3 ticks
        if (dUnit._synergyArmorStack) {
            var armorStack = dUnit._synergyArmorStack;
            armorStack.tickCounter++;
            if (armorStack.tickCounter >= armorStack.interval && armorStack.currentStacks < armorStack.maxStacks) {
                armorStack.currentStacks++;
                dUnit.armor += armorStack.perStack;
                armorStack.tickCounter = 0;
            }
        }
    }

    // Step 2-4: Movement
    var pendingMoves = [];

    // Sync ALL human-controlled avatar grid positions from smooth world position
    // Local avatar: moved by WASD. Remote avatars: moved by network sync.
    // Both have _smoothWX/_smoothWZ set, so update grid for all of them.
    var _mySlot = (typeof window !== 'undefined' && window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
    for (var ai = 0; ai < allUnits.length; ai++) {
        var avu = allUnits[ai];
        if (avu.isAvatar && avu.alive && avu._smoothWX !== undefined) {
            var newCol = Math.floor(avu._smoothWX / (typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1));
            var newRow = Math.floor(avu._smoothWZ / (typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1));
            if (isValidCell(newRow, newCol) && (newRow !== avu.row || newCol !== avu.col)) {
                grid[avu.row][avu.col] = null;
                avu.row = newRow;
                avu.col = newCol;
                grid[newRow][newCol] = avu.id;
            }
        }
    }

    for (var i = 0; i < allUnits.length; i++) {
        var unit = allUnits[i];
        if (!unit.alive || hasEffect(unit, 'freeze') || hasEffect(unit, 'stun')) continue;

        // Human-controlled avatars (local + remote synced) — skip AI auto movement
        if (unit.isAvatar && unit._smoothWX !== undefined) continue;

        var enemies = getEnemiesOf(unit, teams);
        var allies = getAlliesOf(unit, teams);
        var target = selectTarget(unit, enemies, allies);

        // ORDER_MOVE: march toward destination even without an enemy target
        var order = unit.tacticalOrder || ORDER_FREE;
        if (!target && order === ORDER_MOVE && unit.tacticalMoveRow >= 0 && unit.tacticalMoveCol >= 0) {
            var distToDest = chebyshevDist(unit.row, unit.col, unit.tacticalMoveRow, unit.tacticalMoveCol);
            if (distToDest > 0) {
                var step = bestStepToward(unit.row, unit.col, unit.tacticalMoveRow, unit.tacticalMoveCol, grid, unit.id);
                if (step) pendingMoves.push({ unit: unit, r: step.r, c: step.c });
            }
            continue;
        }

        if (!target) continue;
        unit.targetUnitId = target.id;
        var moveTarget = calculateMoveTarget(unit, target, grid, allies);
        if (moveTarget) {
            pendingMoves.push({ unit: unit, r: moveTarget.r, c: moveTarget.c });
        }
    }

    // Resolve collisions
    var claimed = {};
    for (var i = 0; i < allUnits.length; i++) {
        if (allUnits[i].alive) claimed[allUnits[i].row + ',' + allUnits[i].col] = true;
    }
    for (var i = 0; i < pendingMoves.length; i++) {
        var move = pendingMoves[i];
        var key = move.r + ',' + move.c;
        if (!claimed[key]) {
            delete claimed[move.unit.row + ',' + move.unit.col];
            grid[move.unit.row][move.unit.col] = null;
            move.unit.row = move.r;
            move.unit.col = move.c;
            grid[move.r][move.c] = move.unit.id;
            claimed[key] = true;
        }
    }

    // Step 4b: Check traps after movement
    if (typeof processTraps === 'function') {
        for (var ti = 0; ti < allUnits.length; ti++) {
            if (allUnits[ti].alive) processTraps(allUnits[ti], grid, players);
        }
    }

    // Step 4c: Militia Guaritore passive healing
    if (typeof processMilitiaGuaritoreHeal === 'function') {
        processMilitiaGuaritoreHeal(allUnits);
    }
    // Step 4d: Structure healing (santuario) + debuff (bastione)
    if (typeof processStructureHealing === 'function') processStructureHealing(allUnits);
    if (typeof processStructureDebuff === 'function') processStructureDebuff(allUnits, teams);

    // Step 4f: Avatar passives + cooldowns
    if (typeof processAvatarPassives === 'function') processAvatarPassives(allUnits, teams);
    for (var avi = 0; avi < allUnits.length; avi++) {
        if (allUnits[avi].isAvatar && typeof tickAvatarCooldowns === 'function') tickAvatarCooldowns(allUnits[avi]);
    }

    // Step 4g: Special attack cooldown tick
    if (typeof tickSpecialCooldown === 'function') tickSpecialCooldown();

    // Step 4e: Camp creep abilities
    for (var ci = 0; ci < allUnits.length; ci++) {
        var cu = allUnits[ci];
        if (!cu.alive || !cu.campId || !cu.creepAbility) continue;
        var cEnemies = getEnemiesOf(cu, teams);
        if (cEnemies.length === 0) continue;
        if (cu.creepAbility === 'slow' && combatTick % 6 === 0) {
            // Slow nearest enemy
            var nearest = null, nd = 999;
            for (var ce = 0; ce < cEnemies.length; ce++) {
                if (!cEnemies[ce].alive) continue;
                var d = chebyshevDist(cu.row, cu.col, cEnemies[ce].row, cEnemies[ce].col);
                if (d < nd) { nd = d; nearest = cEnemies[ce]; }
            }
            if (nearest && nd <= 4) {
                nearest.effects.push({ type: 'speed_reduction', value: 0.20, ticksLeft: 3, stacking: 'refresh' });
                nearest.atkSpeed = Math.min(nearest.atkSpeed * 1.20, nearest.baseAtkSpeed * 2);
            }
        } else if (cu.creepAbility === 'poison' && combatTick % 5 === 0) {
            // Poison 2 nearest enemies — scansione lineare O(n) invece di filter().sort() O(n log n)
            var pn1 = null, pd1 = 999, pn2 = null, pd2 = 999;
            for (var pni = 0; pni < cEnemies.length; pni++) {
                var _pe = cEnemies[pni];
                if (!_pe.alive) continue;
                var _pd = chebyshevDist(cu.row, cu.col, _pe.row, _pe.col);
                if (_pd < pd1) { pn2 = pn1; pd2 = pd1; pn1 = _pe; pd1 = _pd; }
                else if (_pd < pd2) { pn2 = _pe; pd2 = _pd; }
            }
            if (pn1 && pd1 <= 5) pn1.effects.push({ type: 'poison', value: Math.max(1, Math.round(pn1.maxHp * 0.02)), ticksLeft: 4, stacking: 'refresh', sourceType: DMG_MAGIC });
            if (pn2 && pd2 <= 5) pn2.effects.push({ type: 'poison', value: Math.max(1, Math.round(pn2.maxHp * 0.02)), ticksLeft: 4, stacking: 'refresh', sourceType: DMG_MAGIC });
        } else if (cu.creepAbility === 'aoe' && combatTick % 4 === 0) {
            // AOE damage to all enemies within 3 cells
            for (var ae = 0; ae < cEnemies.length; ae++) {
                if (!cEnemies[ae].alive) continue;
                if (chebyshevDist(cu.row, cu.col, cEnemies[ae].row, cEnemies[ae].col) <= 3) {
                    var aoeDmg = Math.round(cu.atk * 0.4);
                    cEnemies[ae].hp -= aoeDmg;
                    if (typeof addDamageNumber === 'function') addDamageNumber(cEnemies[ae], aoeDmg, 'magic');
                    if (cEnemies[ae].hp <= 0) { cEnemies[ae].hp = 0; cEnemies[ae].alive = false; }
                }
            }
        }
    }

    // Step 5: Attacks
    for (var i = 0; i < allUnits.length; i++) {
        if (!allUnits[i].alive) continue;
        // Human avatar attacks only player-chosen target
        // Local player avatar: attacks only player-chosen target (combo system handles damage)
        if (allUnits[i].isAvatar && allUnits[i].owner === _mySlot) {
            if (allUnits[i].targetUnitId) {
                var avEnemies = getEnemiesOf(allUnits[i], teams);
                processAttack(allUnits[i], avEnemies, allUnits, grid);
            }
            continue;
        }
        // Remote human avatars: skip auto-attack (their damage comes via network sync)
        if (allUnits[i].isAvatar && allUnits[i]._smoothWX !== undefined) continue;
        var enemies = getEnemiesOf(allUnits[i], teams);
        processAttack(allUnits[i], enemies, allUnits, grid);
    }

    // Step 6: Abilities
    for (var i = 0; i < allUnits.length; i++) {
        if (!allUnits[i].alive) continue;
        var allies = getAlliesOf(allUnits[i], teams);
        var enemies = getEnemiesOf(allUnits[i], teams);
        processAbility(allUnits[i], allies, enemies, allUnits, grid);
    }

    // Step 7-8: Process deaths
    var newlyDead = allUnits.filter(function(u) { return !u.alive && u.deathAnim === 0; });
    for (var i = 0; i < newlyDead.length; i++) {
        var dead = newlyDead[i];
        dead.deathAnim = 1.0;
        // VFX: death explosion
        if (typeof vfxDeath === 'function') {
            var dp = cellToPixel(dead.row, dead.col);
            vfxDeath(dp.x, dp.y, dead.charId);
        }
        grid[dead.row][dead.col] = null;

        var killer = dead._lastHitBy ? allUnits.find(function(u) { return u.id === dead._lastHitBy; }) : null;
        if (!killer) killer = allUnits.find(function(u) { return u.alive && u.targetUnitId === dead.id; });
        processDeathCallbacks(dead, killer, teams);

        // Ragnarok item: AOE on death to all enemies
        if (dead.items.includes('ragnarok')) {
            var deadEnemies = getEnemiesOf(dead, teams);
            var aoeDmg = Math.round(dead.maxHp * 0.40);
            for (var j = 0; j < deadEnemies.length; j++) {
                if (deadEnemies[j].alive) {
                    deadEnemies[j].hp -= aoeDmg;
                    addDamageNumber(deadEnemies[j], aoeDmg, 'magic');
                    if (deadEnemies[j].hp <= 0) { deadEnemies[j].hp = 0; deadEnemies[j].alive = false; }
                }
            }
        }
    }

    // Step 9: Check team eliminations and win condition
    // Only player teams count for win/loss (not camp_ or creep)
    function isPlayerTeam(key) {
        return key !== 'creep' && !key.startsWith('camp_');
    }

    var playerTeamsAlive = [];
    var allTeamsAlive = [];
    for (var key in teams) {
        var teamAlive = teams[key].filter(function(u) { return u.alive; }).length;
        if (teamAlive > 0) {
            allTeamsAlive.push({ key: key, alive: teamAlive });
            if (isPlayerTeam(key)) playerTeamsAlive.push({ key: key, alive: teamAlive });
        } else {
            var justEliminated = newlyDead.some(function(u) { return String(u.owner) === key; });
            if (justEliminated && isPlayerTeam(key)) {
                var alreadyRecorded = combatEliminations.some(function(e) { return String(e.playerIdx) === key; });
                if (!alreadyRecorded) {
                    var totalSurvivors = 0;
                    for (var k2 in teams) {
                        if (k2 !== key && isPlayerTeam(k2)) {
                            totalSurvivors += teams[k2].filter(function(u) { return u.alive; }).length;
                        }
                    }
                    combatEliminations.push({
                        playerIdx: parseInt(key),
                        tick: combatTick,
                        survivorsAtTime: totalSurvivors,
                    });
                }
            }
        }
    }

    // Win conditions: based on PLAYER teams only
    if (playerTeamsAlive.length <= 1) {
        var winner = playerTeamsAlive.length === 1 ? playerTeamsAlive[0].key : null;
        return buildCombatResult(teams, winner);
    }

    if (combatTick >= MAX_TICKS) {
        var bestKey = null;
        var bestHp = -1;
        for (var i = 0; i < playerTeamsAlive.length; i++) {
            var totalHp = 0;
            var team = teams[playerTeamsAlive[i].key];
            for (var j = 0; j < team.length; j++) {
                if (team[j].alive) totalHp += team[j].hp;
            }
            if (totalHp > bestHp) {
                bestHp = totalHp;
                bestKey = playerTeamsAlive[i].key;
            }
        }
        return buildCombatResult(teams, bestKey);
    }

    return null; // combat continues
}

// --- Build result object ---
function buildCombatResult(teams, winnerKey) {
    var survivors = {};
    var teamHp = {};
    for (var key in teams) {
        var alive = teams[key].filter(function(u) { return u.alive; });
        survivors[key] = alive.length;
        var hp = 0;
        for (var i = 0; i < alive.length; i++) hp += alive[i].hp;
        teamHp[key] = hp;
    }
    return {
        winner: winnerKey !== null ? (winnerKey === 'creep' ? 'creep' : parseInt(winnerKey)) : null,
        survivors: survivors,
        teamHp: teamHp,
        eliminations: combatEliminations.slice(),
    };
}

// --- Initialize combat (4-player FFA) ---
function initCombat(playersList, creepUnits, campCreeps) {
    combatTick = 0;
    damageNumbers = [];
    combatEffects = [];
    combatLog = [];
    combatResult = null;
    if (typeof combatZones !== 'undefined') combatZones = [];
    if (typeof pendingSkillAction !== 'undefined') pendingSkillAction = null;
    combatEliminations = [];
    campRewardsThisRound = [];

    // Reset special attacks for new combat
    if (typeof resetSpecials === 'function') resetSpecials();

    var grid = createEmptyGrid();
    var teams = {};

    for (var p = 0; p < playersList.length; p++) {
        var player = playersList[p];
        if (player.eliminated) continue;
        var pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index;
        teams[String(pSlot)] = [];

        // Combine field units + militia + structures + avatar for combat
        var allPlayerUnits = player.fieldUnits.concat(player.militiaUnits || []).concat(player.structures || []);
        if (player.avatar && player.avatar.alive && !player.avatar._needsRespawn) allPlayerUnits.push(player.avatar);
        for (var u = 0; u < allPlayerUnits.length; u++) {
            var orig = allPlayerUnits[u];
            if (orig._needsRespawn) continue; // Skip units waiting to respawn
            var clone = deepClone(orig);
            // Persistent HP: use saved HP, fallback to full if not set
            clone.hp = (orig.hp > 0 && orig.hp <= clone.maxHp) ? orig.hp : clone.maxHp;
            clone.alive = true;
            clone.effects = [];
            clone.atkTimer = clone.atkSpeed;
            clone.furiaActive = false;
            clone.furiaTicks = 0;
            clone.noHealDuringFuria = false;
            clone.enhancedRegenUsed = false;
            clone.enhancedRegenTicks = 0;
            clone.coins = 0;
            clone.hasTeleported = false;
            clone.isStopped = false;
            clone.deathPreventionUsed = false;
            clone.reviving = false;
            clone.killStacks = 0;
            clone.velenoCharges = 0;
            clone.amiciStacks = 0;
            clone.deathAnim = 0;
            clone.atkAnim = 0;
            clone.hitAnim = 0;
            clone.shield = 0;
            clone.lastAllyAbility = null;
            clone.tacticalOrder = orig.tacticalOrder || ORDER_FREE;
            clone.tacticalTarget = orig.tacticalTarget || null;
            clone.tacticalMoveRow = orig.tacticalMoveRow !== undefined ? orig.tacticalMoveRow : -1;
            clone.tacticalMoveCol = orig.tacticalMoveCol !== undefined ? orig.tacticalMoveCol : -1;
            clone.equippedSkills = orig.equippedSkills ? orig.equippedSkills.slice() : [];
            clone.learnedSkills = orig.learnedSkills ? JSON.parse(JSON.stringify(orig.learnedSkills)) : {};
            clone._usedSkills = {};
            clone.owner = pSlot;
            var pZone = getDeployZone(pSlot);
            clone.facing = pZone ? pZone.facing : 1;
            if (clone.charId === 'Caronte') clone.abilityCooldown = 6;
            if (clone.charId === 'Yujin') clone.abilityCooldown = 8;
            if (clone.charId === 'WMS') clone.abilityCooldown = 7;
            // Apply consumable buffs, curse debuffs, survival combat buffs
            if (typeof applyConsumableBuffs === 'function') applyConsumableBuffs(clone);
            if (typeof applyCurseDebuffs === 'function') applyCurseDebuffs(clone);
            if (typeof applySurvivalCombatBuffs === 'function') applySurvivalCombatBuffs(clone);
            grid[clone.row][clone.col] = clone.id;
            teams[String(pSlot)].push(clone);
        }
    }

    // Debug: log team sizes and per-player unit counts
    for (var tk in teams) { console.log('[MP-DEBUG] initCombat team ' + tk + ': ' + teams[tk].length + ' units → ' + teams[tk].map(function(u){return u.charId + (u.isAvatar?'(AV)':'');}).join(', ')); }
    for (var _dp = 0; _dp < playersList.length; _dp++) {
        var _dpl = playersList[_dp];
        console.log('[MP-DEBUG] player[' + _dp + '] ' + _dpl.name + ': field=' + (_dpl.fieldUnits||[]).length + ' militia=' + (_dpl.militiaUnits||[]).length + ' avatar=' + (_dpl.avatar ? _dpl.avatar.avatarClass : 'NONE') + ' eliminated=' + _dpl.eliminated + ' isHuman=' + _dpl.isHuman + ' serverSlot=' + _dpl.serverSlot);
    }

    // Add creep units if PvE
    if (creepUnits && creepUnits.length > 0) {
        teams['creep'] = [];
        for (var i = 0; i < creepUnits.length; i++) {
            var c = deepClone(creepUnits[i]);
            c.alive = true;
            c.effects = [];
            c.deathAnim = 0;
            c.atkAnim = 0;
            c.hitAnim = 0;
            grid[c.row][c.col] = c.id;
            teams['creep'].push(c);
        }
    }

    // Add neutral camp creeps (one team per camp)
    if (campCreeps) {
        for (var campId in campCreeps) {
            var campUnit = campCreeps[campId];
            var cc = deepClone(campUnit);
            cc.alive = true;
            cc.effects = [];
            cc.deathAnim = 0; cc.atkAnim = 0; cc.hitAnim = 0;
            var teamKey = campId.startsWith('boss_') ? campId : 'camp_' + campId;
            if (!teams[teamKey]) teams[teamKey] = [];
            grid[cc.row][cc.col] = cc.id;
            teams[teamKey].push(cc);
        }
    }

    // --- Apply synergy buffs per player team ---
    for (var p = 0; p < playersList.length; p++) {
        var player = playersList[p];
        if (player.eliminated) continue;
        var pKey = String(player.index);
        if (teams[pKey] && typeof detectSynergies === 'function' && typeof applySynergyBuffs === 'function') {
            var synergies = detectSynergies(player);
            applySynergyBuffs(teams[pKey], synergies);
        }
    }

    // --- Pre-combat setup per team ---
    for (var key in teams) {
        var team = teams[key];
        var allEnemies = [];
        for (var k2 in teams) {
            if (k2 !== key) {
                allEnemies = allEnemies.concat(teams[k2]);
            }
        }

        // WMS: Risonanza Mistica
        for (var i = 0; i < team.length; i++) {
            if (team[i].charId === 'WMS') applyRisonanzaMistica(team[i], team);
        }
        // WMS: Sborrata Mistica
        for (var i = 0; i < team.length; i++) {
            if (team[i].charId === 'WMS' && team[i].alive) applySborrataMistica(team[i], team, allEnemies);
        }
        // Caronte: Teleport
        for (var i = 0; i < team.length; i++) {
            if (team[i].charId === 'Caronte') performCaronteTeleport(team[i], allEnemies, grid);
        }
    }

    return { teams: teams, grid: grid };
}
