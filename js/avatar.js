// ============================================================
// LOTA AUTO CHESS — avatar.js — Player avatar system
// ============================================================

// --- Create avatar unit from class ---
function createAvatar(classId, owner) {
    var cls = AVATAR_CLASSES[classId];
    if (!cls) return null;
    var zone = getDeployZone(owner);
    var startCell = zone && zone.cells.length > 0 ? zone.cells[Math.floor(zone.cells.length / 2)] : { r: 0, c: 0 };

    return {
        id: genUnitId(),
        charId: 'avatar_' + classId,
        isAvatar: true,
        avatarClass: classId,
        owner: owner,
        star: 1,

        // Level / XP
        level: 1,
        xp: 0,
        xpToNext: AVATAR_XP_TABLE[1] || 100,

        // Stats (grow with level)
        maxHp: cls.baseStats.hp,
        hp: cls.baseStats.hp,
        atk: cls.baseStats.atk,
        baseAtk: cls.baseStats.atk,
        atkSpeed: cls.baseStats.atkSpeed,
        baseAtkSpeed: cls.baseStats.atkSpeed,
        armor: cls.baseStats.armor,
        baseArmor: cls.baseStats.armor,
        range: cls.baseStats.range,
        unitClass: 'Avatar',
        race: cls.name,
        behavior: cls.baseStats.range > 2 ? 'kite' : (cls.baseStats.range === 1 ? 'tank' : 'dps'),

        critChance: CRIT_CHANCE_BASE + 0.02,
        dodgeChance: 0,
        atkSpeedMultiplier: 1.0,
        dmgMultiplier: 1.0,
        magicResist: 0,

        row: startCell.r, col: startCell.c,
        px: 0, py: 0,
        targetRow: -1, targetCol: -1,

        alive: true,
        atkTimer: cls.baseStats.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false,
        isStopped: false,

        items: [],
        learnedSkills: {},
        equippedSkills: [],
        skillCooldowns: {},

        tacticalOrder: ORDER_FREE,
        tacticalTarget: null,
        tacticalMoveRow: -1,
        tacticalMoveCol: -1,

        survivalCount: 0,
        _needsRespawn: false,
        _consumableBuff: {},
        _curseDebuffs: [],
        effects: [],

        // Avatar-specific
        commandRadius: cls.commandRadius || 3,
        unlockedAbilities: [], // computed dynamically via getAvatarAbilities()
        abilityCooldowns: {},

        // Character-specific (minimal)
        coins: 0, hasTeleported: false, abilityCooldown: 999,
        enhancedRegenUsed: false, enhancedRegenTicks: 0,
        furiaActive: false, furiaTicks: 0, noHealDuringFuria: false,
        copiedClass: null, copiedRace: null, lastAllyAbility: null,
        deathPreventionUsed: false, nucleoUsed: false,
        reviving: false, reviveTicks: 0,
        killStacks: 0, velenoCharges: 0, cristalloApplied: false, amiciStacks: 0,

        atkAnim: 0, hitAnim: 0, deathAnim: 0,
        facing: zone ? zone.facing : 1,
    };
}

// --- Get avatar's unlocked abilities based on level ---
function getAvatarAbilities(avatar) {
    if (!avatar || !avatar.isAvatar) return [];
    var cls = AVATAR_CLASSES[avatar.avatarClass];
    if (!cls) return [];
    var result = [];
    for (var i = 0; i < cls.abilities.length; i++) {
        if (avatar.level >= cls.abilities[i].lvl) {
            result.push(cls.abilities[i]);
        }
    }
    return result;
}

// --- Grant XP to avatar ---
function grantAvatarXP(avatar, amount) {
    if (!avatar || !avatar.isAvatar || avatar.level >= AVATAR_MAX_LEVEL) return false;
    avatar.xp += amount;
    var leveledUp = false;
    while (avatar.level < AVATAR_MAX_LEVEL && avatar.xp >= avatar.xpToNext) {
        avatar.xp -= avatar.xpToNext;
        avatar.level++;
        avatar.xpToNext = (avatar.level < AVATAR_XP_TABLE.length) ? AVATAR_XP_TABLE[avatar.level] : 9999;
        _applyAvatarLevelUp(avatar);
        leveledUp = true;
    }
    return leveledUp;
}

function _applyAvatarLevelUp(avatar) {
    var cls = AVATAR_CLASSES[avatar.avatarClass];
    if (!cls) return;
    // Grow stats
    avatar.maxHp += cls.growth.hp;
    avatar.hp = Math.min(avatar.maxHp, avatar.hp + cls.growth.hp);
    avatar.atk += cls.growth.atk;
    avatar.baseAtk += cls.growth.atk;
    avatar.armor += cls.growth.armor;
    avatar.baseArmor += cls.growth.armor;

    // Check new ability unlocks
    for (var i = 0; i < cls.abilities.length; i++) {
        if (avatar.level === cls.abilities[i].lvl) {
            if (typeof showToast === 'function') {
                showToast('Lv.' + avatar.level + ' ' + cls.abilities[i].icon + ' ' + cls.abilities[i].name + ' sbloccata!', 'skill', '!');
            }
        }
    }
    if (typeof showToast === 'function') {
        showToast('Avatar Lv.' + avatar.level + '! +' + cls.growth.hp + 'HP +' + cls.growth.atk + 'ATK', 'success', '!');
    }
    // Check if special attack should be upgraded
    if (typeof checkSpecialUpgrade === 'function') checkSpecialUpgrade(avatar.level);
}

// --- XP rewards ---
function awardAvatarCombatXP(player, result) {
    if (!player || !player.avatar) return;
    var avatar = player.avatar;
    var xp = 30; // base XP per round
    var teamKey = String(player.index);

    // Win bonus
    if (result.winner === player.index) xp += 50;

    // Survivor bonus
    var survivors = result.survivors[teamKey] || 0;
    xp += survivors * 10;

    // Kill bonus (approximate from combat log)
    xp += 5 * survivors;

    grantAvatarXP(avatar, xp);
}

// --- Avatar respawn (next round at base, 80% HP) ---
function respawnAvatar(player) {
    if (!player || !player.avatar) return;
    var avatar = player.avatar;
    if (!avatar._needsRespawn) return;

    avatar._needsRespawn = false;
    avatar.hp = Math.round(avatar.maxHp * 0.80);
    avatar.alive = true;
    avatar.effects = [];

    var zone = getDeployZone(typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index);
    if (zone && zone.cells.length > 0) {
        var cell = zone.cells[Math.floor(zone.cells.length / 2)];
        // Find empty cell near center of deploy zone
        for (var i = 0; i < zone.cells.length; i++) {
            if (!findPlayerUnitAtCell(player, zone.cells[i].r, zone.cells[i].c)) {
                cell = zone.cells[i];
                break;
            }
        }
        avatar.row = cell.r;
        avatar.col = cell.c;
        avatar.px = 0;
        avatar.py = 0;
    }
}

// --- Process avatar passive abilities during combat tick ---
function processAvatarPassives(allUnits, teams) {
    for (var i = 0; i < allUnits.length; i++) {
        var av = allUnits[i];
        if (!av.alive || !av.isAvatar) continue;

        var cls = AVATAR_CLASSES[av.avatarClass];
        if (!cls) continue;
        var abilities = [];
        for (var a = 0; a < cls.abilities.length; a++) {
            if (av.level >= cls.abilities[a].lvl && cls.abilities[a].type === 'passive') {
                abilities.push(cls.abilities[a]);
            }
        }

        var allies = getAlliesOf(av, teams);

        for (var a = 0; a < abilities.length; a++) {
            var ab = abilities[a];

            if (ab.effect === 'buff_atk') {
                // Stratega: +ATK% to allies in command radius
                for (var j = 0; j < allies.length; j++) {
                    if (allies[j].id === av.id || !allies[j].alive) continue;
                    if (chebyshevDist(av.row, av.col, allies[j].row, allies[j].col) <= av.commandRadius) {
                        if (!allies[j]._avatarBuffApplied) {
                            allies[j].atk = Math.round(allies[j].atk * (1 + ab.value));
                            allies[j]._avatarBuffApplied = true;
                        }
                    }
                }
            }

            if (ab.effect === 'arcane_orbs') {
                // Stregone: spawn orbiting arcane spheres
                if (!av._arcaneOrbs) av._arcaneOrbs = { orbs: [], maxOrbs: 0, dmgMult: ab.orbDmgMult, range: ab.orbRange, cooldown: ab.orbCooldown, timer: 0 };
                var maxOrbs = ab.baseOrbs + Math.floor(av.level / 4); // +1 orb every 4 levels
                av._arcaneOrbs.maxOrbs = maxOrbs;
                av._arcaneOrbs.dmgMult = ab.orbDmgMult;
                av._arcaneOrbs.range = ab.orbRange;
                // Refill orbs if needed
                while (av._arcaneOrbs.orbs.length < maxOrbs) {
                    av._arcaneOrbs.orbs.push({ alive: true, angle: (av._arcaneOrbs.orbs.length / maxOrbs) * Math.PI * 2 });
                }
            }

            if (ab.effect === 'tank_passive') {
                // Guerriero: armor bonus + regen
                if (!av._tankPassiveApplied) {
                    av.armor += Math.round(av.baseArmor * ab.armorBonus);
                    av._tankPassiveApplied = true;
                }
                if (av.hp < av.maxHp) {
                    av.hp = Math.min(av.maxHp, av.hp + Math.round(av.maxHp * ab.regen));
                }
            }

            if (ab.effect === 'heal_passive') {
                // Mistico: heal most injured ally
                var weakest = null;
                for (var j = 0; j < allies.length; j++) {
                    if (allies[j].id === av.id || !allies[j].alive) continue;
                    if (chebyshevDist(av.row, av.col, allies[j].row, allies[j].col) <= av.commandRadius) {
                        if (!weakest || (allies[j].hp / allies[j].maxHp) < (weakest.hp / weakest.maxHp)) {
                            weakest = allies[j];
                        }
                    }
                }
                if (weakest && weakest.hp < weakest.maxHp) {
                    var heal = Math.round(weakest.maxHp * ab.value);
                    weakest.hp = Math.min(weakest.maxHp, weakest.hp + heal);
                }
            }
        }
    }
}

// --- Execute avatar active ability (called from UI during combat) ---
function executeAvatarAbility(avatar, abilityId, allUnits, teams, grid) {
    if (!avatar || !avatar.isAvatar || !avatar.alive) return false;

    var cls = AVATAR_CLASSES[avatar.avatarClass];
    if (!cls) return false;

    var ab = null;
    for (var i = 0; i < cls.abilities.length; i++) {
        if (cls.abilities[i].id === abilityId && avatar.level >= cls.abilities[i].lvl) {
            ab = cls.abilities[i];
            break;
        }
    }
    if (!ab || ab.type !== 'active') return false;

    // Check cooldown
    if (avatar.abilityCooldowns[abilityId] > 0) return false;

    // Set cooldown
    avatar.abilityCooldowns[abilityId] = ab.cd || 10;

    var allies = getAlliesOf(avatar, teams);
    var enemies = getEnemiesOf(avatar, teams);

    // Execute effect
    switch (ab.effect) {
        case 'buff_speed': // Stratega Ordine Carica
            for (var i = 0; i < allies.length; i++) {
                if (!allies[i].alive) continue;
                if (chebyshevDist(avatar.row, avatar.col, allies[i].row, allies[i].col) <= avatar.commandRadius) {
                    allies[i].atkSpeed = Math.max(0.5, allies[i].atkSpeed / (1 + ab.value));
                }
            }
            { // VFX
                var _bsX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _bsZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                var _bsY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                if (typeof vfxOrdineCarica3D === 'function') vfxOrdineCarica3D(_bsX, _bsY, _bsZ);
            }
            break;

        case 'shield': // Stratega Scudo Tattico
            for (var i = 0; i < allies.length; i++) {
                if (!allies[i].alive) continue;
                allies[i].shield += Math.round(allies[i].maxHp * ab.value);
            }
            break;

        case 'freeze_aoe': // Stregone Nova di Gelo
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                if (chebyshevDist(avatar.row, avatar.col, enemies[i].row, enemies[i].col) <= ab.radius) {
                    enemies[i].effects.push({ type: 'freeze', value: 0, ticksLeft: ab.duration, stacking: 'refresh' });
                }
            }
            { // VFX
                var _fzX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _fzZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                var _fzY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                if (typeof vfxNovaGelo3D === 'function') vfxNovaGelo3D(_fzX, _fzY, _fzZ);
                // Play cast animation
                var _fzE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
                var _fzG = _fzE ? _fzE.group : null;
                if (_fzG && _fzG._avatarAnimator) {
                    var _fzAn = _fzG._avatarAnimator;
                    var _fzCn = _fzAn.swordFinClipName || _fzAn.sword1ClipName;
                    if (_fzCn && _fzAn.actions[_fzCn]) {
                        var _fzAc = _fzAn.actions[_fzCn];
                        _fzAc.timeScale = 1.0; _fzAc.reset(); _fzAc.play();
                        if (_fzAn.currentAction && _fzAn.currentAction !== _fzAc) _fzAn.currentAction.crossFadeTo(_fzAc, 0.08, true);
                        _fzAn.currentAction = _fzAc; _fzAn.attacking = true;
                        _fzAn.attackTimer = (_fzAc.getClip().duration / 1.0) * 0.90;
                        if (_fzE) _fzE._avatarDesiredAnim = null;
                    }
                }
            }
            break;

        case 'damage_aoe': // Stregone Pioggia di Fuoco
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                if (chebyshevDist(avatar.row, avatar.col, enemies[i].row, enemies[i].col) <= ab.radius) {
                    var rawDmg = Math.round(avatar.atk * ab.value);
                    var dmgResult = { damage: rawDmg, isCrit: false, isMiss: false, isDodge: false, damageType: DMG_MAGIC };
                    if (typeof applyDamage === 'function') {
                        applyDamage(enemies[i], dmgResult, avatar);
                    } else {
                        enemies[i].hp -= rawDmg;
                        if (enemies[i].hp <= 0) { enemies[i].hp = 0; enemies[i].alive = false; }
                    }
                    // Rain impact VFX on each enemy
                    var _drX = enemies[i]._smoothWX !== undefined ? enemies[i]._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(enemies[i].row, enemies[i].col).x : enemies[i].col);
                    var _drZ = enemies[i]._smoothWZ !== undefined ? enemies[i]._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(enemies[i].row, enemies[i].col).z : enemies[i].row);
                    var _drY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                    if (typeof _burst3D === 'function') _burst3D(_drX, _drY + 0.5, _drZ, 8, '#f97316', 3.5, 0.30);
                }
            }
            { // Central VFX
                var _daX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _daZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                var _daY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                if (typeof _ring3D === 'function') _ring3D(_daX, _daY + 0.1, _daZ, 1.5, '#f97316', 22, 0.35);
                if (typeof triggerScreenFlash === 'function') triggerScreenFlash('#f97316', 0.16);
                if (typeof triggerScreenShake === 'function') triggerScreenShake(3.5, 0.20);
            }
            break;

        case 'heavy_strike': // Guerriero Colpo Devastante
            var target = null;
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                if (!target || chebyshevDist(avatar.row, avatar.col, enemies[i].row, enemies[i].col) < chebyshevDist(avatar.row, avatar.col, target.row, target.col)) {
                    target = enemies[i];
                }
            }
            if (target && chebyshevDist(avatar.row, avatar.col, target.row, target.col) <= avatar.range + 1) {
                var rawDmg = Math.round(avatar.atk * ab.value);
                var dmgResult = { damage: rawDmg, isCrit: false, isMiss: false, isDodge: false, damageType: DMG_PHYSICAL };
                if (ab.stun) target.effects.push({ type: 'freeze', value: 0, ticksLeft: ab.stun, stacking: 'refresh' });
                if (typeof applyDamage === 'function') {
                    applyDamage(target, dmgResult, avatar);
                } else {
                    target.hp -= rawDmg;
                    if (target.hp <= 0) { target.hp = 0; target.alive = false; }
                }
            }
            // ── Animation + VFX ──
            var _hsAvE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
            var _hsAvG = _hsAvE ? _hsAvE.group : null;
            if (_hsAvG && _hsAvG._avatarAnimator) {
                var _hsAn = _hsAvG._avatarAnimator;
                var _hsCn = _hsAn.colpoClipName || _hsAn.swordFinClipName;
                if (_hsCn && _hsAn.actions[_hsCn]) {
                    var _hsAc = _hsAn.actions[_hsCn];
                    _hsAc.reset(); _hsAc.play();
                    if (_hsAn.currentAction && _hsAn.currentAction !== _hsAc) _hsAn.currentAction.crossFadeTo(_hsAc, 0.06, true);
                    _hsAn.currentAction = _hsAc;
                    _hsAn.attacking = true;
                    _hsAn.attackTimer = (_hsAc.getClip().duration / (_hsAc.timeScale || 0.6)) * 0.92;
                    if (_hsAvE) _hsAvE._avatarDesiredAnim = null;
                }
            }
            if (target && typeof vfxColpoDevastante3D === 'function') {
                var _hsTTOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                var _hsTX = target._smoothWX !== undefined ? target._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).x : target.col);
                var _hsTZ = target._smoothWZ !== undefined ? target._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).z : target.row);
                var _hsFacing = typeof _camOrbitAngle !== 'undefined' ? _camOrbitAngle + Math.PI : 0;
                vfxColpoDevastante3D(_hsTX, _hsTTOP + 0.4, _hsTZ, _hsFacing);
            }
            break;

        case 'debuff_aoe': // Guerriero Grido di Guerra
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                if (chebyshevDist(avatar.row, avatar.col, enemies[i].row, enemies[i].col) <= ab.radius) {
                    if (typeof applyEffect === 'function') {
                        applyEffect(enemies[i], { type: 'atk_reduction', value: ab.value, ticksLeft: ab.duration, stacking: 'refresh', sourceType: 'grido_guerra' });
                    } else {
                        enemies[i].effects.push({ type: 'atk_reduction', value: ab.value, ticksLeft: ab.duration, stacking: 'refresh' });
                    }
                }
            }
            // ── Animation + VFX ──
            var _daAvE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
            var _daAvG = _daAvE ? _daAvE.group : null;
            if (_daAvG && _daAvG._avatarAnimator) {
                var _daAn = _daAvG._avatarAnimator;
                var _daCn = _daAn.gridoClipName || _daAn.swordRegClipName;
                if (_daCn && _daAn.actions[_daCn]) {
                    var _daAc = _daAn.actions[_daCn];
                    _daAc.reset(); _daAc.play();
                    if (_daAn.currentAction && _daAn.currentAction !== _daAc) _daAn.currentAction.crossFadeTo(_daAc, 0.06, true);
                    _daAn.currentAction = _daAc;
                    _daAn.attacking = true;
                    _daAn.attackTimer = (_daAc.getClip().duration / (_daAc.timeScale || 1.1)) * 0.90;
                    if (_daAvE) _daAvE._avatarDesiredAnim = null;
                }
            }
            if (typeof vfxGridoGuerra3D === 'function') {
                var _daTTOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                var _daAX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _daAZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                vfxGridoGuerra3D(_daAX, _daTTOP + 0.1, _daAZ);
            }
            break;

        case 'heal_single': // Mistico Benedizione
            var weakest = null;
            for (var i = 0; i < allies.length; i++) {
                if (!allies[i].alive) continue;
                if (!weakest || (allies[i].hp / allies[i].maxHp) < (weakest.hp / weakest.maxHp)) weakest = allies[i];
            }
            if (weakest) {
                var heal = Math.round(weakest.maxHp * ab.value);
                weakest.hp = Math.min(weakest.maxHp, weakest.hp + heal);
                if (typeof addDamageNumber === 'function') addDamageNumber(weakest, heal, 'heal');
                var _hlX = weakest._smoothWX !== undefined ? weakest._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(weakest.row, weakest.col).x : weakest.col);
                var _hlZ = weakest._smoothWZ !== undefined ? weakest._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(weakest.row, weakest.col).z : weakest.row);
                var _hlY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                if (typeof vfxBenedizione3D === 'function') vfxBenedizione3D(_hlX, _hlY, _hlZ);
            }
            { // Cast animation
                var _heE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
                var _heG = _heE ? _heE.group : null;
                if (_heG && _heG._avatarAnimator) {
                    var _heAn = _heG._avatarAnimator;
                    var _heCn = _heAn.sword1ClipName || _heAn.swordRegClipName;
                    if (_heCn && _heAn.actions[_heCn]) {
                        var _heAc = _heAn.actions[_heCn];
                        _heAc.timeScale = 0.8; _heAc.reset(); _heAc.play();
                        if (_heAn.currentAction && _heAn.currentAction !== _heAc) _heAn.currentAction.crossFadeTo(_heAc, 0.10, true);
                        _heAn.currentAction = _heAc; _heAn.attacking = true;
                        _heAn.attackTimer = (_heAc.getClip().duration / 0.8) * 0.85;
                        if (_heE) _heE._avatarDesiredAnim = null;
                    }
                }
            }
            break;

        case 'barrier': // Mistico Barriera Sacra
            for (var i = 0; i < allies.length; i++) {
                if (!allies[i].alive) continue;
                if (chebyshevDist(avatar.row, avatar.col, allies[i].row, allies[i].col) <= avatar.commandRadius) {
                    allies[i].shield += Math.round(allies[i].maxHp * ab.value);
                    var _brX = allies[i]._smoothWX !== undefined ? allies[i]._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(allies[i].row, allies[i].col).x : allies[i].col);
                    var _brZ = allies[i]._smoothWZ !== undefined ? allies[i]._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(allies[i].row, allies[i].col).z : allies[i].row);
                    var _brY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                    if (typeof _ring3D === 'function') _ring3D(_brX, _brY + 0.05, _brZ, 0.4, '#86efac', 14, 0.40);
                    if (typeof _rising3D === 'function') _rising3D(_brX, _brY, _brZ, 8, '#86efac', 0.55);
                }
            }
            if (typeof triggerScreenFlash === 'function') triggerScreenFlash('#22c55e', 0.10);
            break;

        case 'ultimate': // Class-specific ultimates
            if (avatar.avatarClass === 'stratega') {
                var _ulSX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _ulSZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                var _ulSY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                for (var i = 0; i < allies.length; i++) {
                    if (!allies[i].alive) continue;
                    allies[i].atk = Math.round(allies[i].atk * (1 + ab.value));
                    var _uHeal = Math.round(allies[i].maxHp * ab.heal);
                    allies[i].hp = Math.min(allies[i].maxHp, allies[i].hp + _uHeal);
                    if (typeof addDamageNumber === 'function') addDamageNumber(allies[i], _uHeal, 'heal');
                    var _ualX = allies[i]._smoothWX !== undefined ? allies[i]._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(allies[i].row, allies[i].col).x : allies[i].col);
                    var _ualZ = allies[i]._smoothWZ !== undefined ? allies[i]._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(allies[i].row, allies[i].col).z : allies[i].row);
                    if (typeof _rising3D === 'function') _rising3D(_ualX, _ulSY, _ualZ, 10, '#fbbf24', 0.65);
                }
                if (typeof vfxVittoria3D === 'function') vfxVittoria3D(_ulSX, _ulSY, _ulSZ);
            } else if (avatar.avatarClass === 'stregone') {
                // Summon zombies handled by 'summon_zombies' effect below
                // fallback: if old config still has 'ultimate', do VFX only
                var _ulAX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                var _ulAZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                var _ulAY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                if (typeof vfxApocalisse3D === 'function') vfxApocalisse3D(_ulAX, _ulAY, _ulAZ);
            } else if (avatar.avatarClass === 'guerriero') {
                avatar._invulnerable = true;
                avatar._invulnerableTicks = ab.invuln;
                avatar.atk = Math.round(avatar.atk * ab.value);
                // ── Animation + VFX ──
                var _ulAvE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
                var _ulAvG = _ulAvE ? _ulAvE.group : null;
                if (_ulAvG && _ulAvG._avatarAnimator) {
                    var _ulAn = _ulAvG._avatarAnimator;
                    _ulAn.furiaActive = true;
                    var _ulCn = _ulAn.furiaEnterClipName || _ulAn.idleClipName;
                    if (_ulCn && _ulAn.actions[_ulCn]) {
                        var _ulAc = _ulAn.actions[_ulCn];
                        _ulAc.reset(); _ulAc.play();
                        if (_ulAn.currentAction && _ulAn.currentAction !== _ulAc) _ulAn.currentAction.crossFadeTo(_ulAc, 0.08, true);
                        _ulAn.currentAction = _ulAc;
                        _ulAn.attacking = true;
                        _ulAn.attackTimer = (_ulAc.getClip().duration / (_ulAc.timeScale || 1.0)) * 0.95;
                        if (_ulAvE) _ulAvE._avatarDesiredAnim = null;
                    }
                }
                if (typeof vfxFuriaImmortale3D === 'function') {
                    var _ulTTOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                    var _ulAX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                    var _ulAZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                    vfxFuriaImmortale3D(_ulAX, _ulTTOP + 0.1, _ulAZ);
                }
            } else if (avatar.avatarClass === 'mistico') {
                // Resurrect last dead ally
                var teamKey = String(avatar.owner);
                var deadAllies = teams[teamKey] ? teams[teamKey].filter(function(u) { return !u.alive && !u.isAvatar; }) : [];
                if (deadAllies.length > 0) {
                    var revived = deadAllies[deadAllies.length - 1];
                    revived.alive = true;
                    revived.hp = Math.round(revived.maxHp * ab.value);
                    revived.effects = [];
                    revived.deathAnim = 0;
                    // Place near avatar
                    var adj = findFreeCellAdjacentTo(avatar.row, avatar.col, grid);
                    if (adj) { revived.row = adj.r; revived.col = adj.c; grid[adj.r][adj.c] = revived.id; }
                    var _rvX = revived._smoothWX !== undefined ? revived._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(revived.row, revived.col).x : revived.col);
                    var _rvZ = revived._smoothWZ !== undefined ? revived._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(revived.row, revived.col).z : revived.row);
                    var _rvY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
                    if (typeof vfxResurrezione3D === 'function') vfxResurrezione3D(_rvX, _rvY, _rvZ);
                } else {
                    // No dead allies — mega-heal ALL alive allies instead
                    for (var _rvi = 0; _rvi < allies.length; _rvi++) {
                        if (!allies[_rvi].alive) continue;
                        var _rvh = Math.round(allies[_rvi].maxHp * 0.30);
                        allies[_rvi].hp = Math.min(allies[_rvi].maxHp, allies[_rvi].hp + _rvh);
                        if (typeof addDamageNumber === 'function') addDamageNumber(allies[_rvi], _rvh, 'heal');
                        var _rvX2 = allies[_rvi]._smoothWX !== undefined ? allies[_rvi]._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(allies[_rvi].row, allies[_rvi].col).x : allies[_rvi].col);
                        var _rvZ2 = allies[_rvi]._smoothWZ !== undefined ? allies[_rvi]._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(allies[_rvi].row, allies[_rvi].col).z : allies[_rvi].row);
                        if (typeof vfxHealTarget3D === 'function') vfxHealTarget3D(_rvX2, typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15, _rvZ2);
                    }
                    var _ulMX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
                    var _ulMZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
                    if (typeof vfxResurrezione3D === 'function') vfxResurrezione3D(_ulMX, typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15, _ulMZ);
                }
                // Cast animation
                var _ulME = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
                var _ulMG = _ulME ? _ulME.group : null;
                if (_ulMG && _ulMG._avatarAnimator) {
                    var _ulMAn = _ulMG._avatarAnimator;
                    var _ulMCn = _ulMAn.swordFinClipName || _ulMAn.sword1ClipName;
                    if (_ulMCn && _ulMAn.actions[_ulMCn]) {
                        var _ulMAc = _ulMAn.actions[_ulMCn];
                        _ulMAc.timeScale = 0.7; _ulMAc.reset(); _ulMAc.play();
                        if (_ulMAn.currentAction && _ulMAn.currentAction !== _ulMAc) _ulMAn.currentAction.crossFadeTo(_ulMAc, 0.10, true);
                        _ulMAn.currentAction = _ulMAc; _ulMAn.attacking = true;
                        _ulMAn.attackTimer = (_ulMAc.getClip().duration / 0.7) * 0.95;
                        if (_ulME) _ulME._avatarDesiredAnim = null;
                    }
                }
            }
            break;

        case 'summon_zombies': // Stregone Apocalisse — summon zombies
            var _szCount = ab.summonCount || 5;
            var _szAX = avatar._smoothWX !== undefined ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
            var _szAZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
            var _szAY = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
            // VFX: apocalypse effect at avatar
            if (typeof vfxApocalisse3D === 'function') vfxApocalisse3D(_szAX, _szAY, _szAZ);
            // Cast animation
            var _szE = typeof threeUnitModels !== 'undefined' ? threeUnitModels[avatar.id] : null;
            var _szG = _szE ? _szE.group : null;
            if (_szG && _szG._avatarAnimator) {
                var _szAn = _szG._avatarAnimator;
                var _szCn = _szAn.swordFinClipName || _szAn.sword1ClipName;
                if (_szCn && _szAn.actions[_szCn]) {
                    var _szAc = _szAn.actions[_szCn];
                    _szAc.timeScale = 0.8; _szAc.reset(); _szAc.play();
                    if (_szAn.currentAction && _szAn.currentAction !== _szAc) _szAn.currentAction.crossFadeTo(_szAc, 0.05, true);
                    _szAn.currentAction = _szAc; _szAn.attacking = true;
                    _szAn.attackTimer = (_szAc.getClip().duration / 0.8) * 0.95;
                    if (_szE) _szE._avatarDesiredAnim = null;
                }
            }
            // Spawn zombies around the avatar
            _spawnSummonedZombies(avatar, ab, _szCount);
            break;
    }

    if (typeof showToast === 'function') {
        showToast(ab.icon + ' ' + ab.name + '!', 'skill', ab.icon);
    }
    return true;
}

// --- Tick cooldowns (called each combat tick) ---
function tickAvatarCooldowns(avatar) {
    if (!avatar || !avatar.abilityCooldowns) return;
    for (var key in avatar.abilityCooldowns) {
        if (avatar.abilityCooldowns[key] > 0) avatar.abilityCooldowns[key]--;
    }
}

// --- Save avatar after combat ---
function saveAvatarAfterCombat(player, teams) {
    if (!player || !player.avatar) return;
    var teamKey = String(typeof getPlayerSlot === 'function' ? getPlayerSlot(player) : player.index);
    var team = teams[teamKey];
    if (!team) return;

    for (var i = 0; i < team.length; i++) {
        if (team[i].id === player.avatar.id) {
            if (team[i].alive) {
                var hpRatio = team[i].hp / team[i].maxHp;
                player.avatar.hp = Math.max(1, Math.round(player.avatar.maxHp * hpRatio));
                player.avatar.row = team[i].row;
                player.avatar.col = team[i].col;
            } else {
                player.avatar._needsRespawn = true;
                // Extra damage to player when avatar dies
                applyCombatDamage(player, AVATAR_DEATH_PENALTY);
            }
            break;
        }
    }
}

// --- Show class selection UI ---
function showClassSelection(callback) {
    var overlay = document.createElement('div');
    overlay.id = 'class-select-overlay';
    overlay.className = 'overlay active';
    overlay.style.cssText = 'z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,17,23,0.97)';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:1.8em;font-weight:700;color:#e2e8f0;margin-bottom:8px;';
    title.textContent = 'Scegli la tua Classe';
    overlay.appendChild(title);

    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.85em;color:#94a3b8;margin-bottom:20px;';
    sub.textContent = 'Il tuo Avatar combattera al tuo fianco per tutta la partita';
    overlay.appendChild(sub);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:560px;width:90%;';

    for (var cid in AVATAR_CLASSES) {
        var cls = AVATAR_CLASSES[cid];
        var card = document.createElement('div');
        card.style.cssText = 'background:rgba(26,31,46,0.95);border:2px solid ' + cls.color.stroke + ';border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;';
        card.innerHTML =
            '<div style="font-size:2em;text-align:center;margin-bottom:6px;">' + cls.icon + '</div>' +
            '<div style="font-size:1.1em;font-weight:700;color:' + cls.color.fill + ';text-align:center;">' + cls.name + '</div>' +
            '<div style="font-size:0.75em;color:#94a3b8;text-align:center;margin:6px 0;">' + cls.desc + '</div>' +
            '<div style="font-size:0.7em;color:#64748b;text-align:center;">HP:' + cls.baseStats.hp + ' ATK:' + cls.baseStats.atk + ' ARM:' + cls.baseStats.armor + ' RNG:' + cls.baseStats.range + '</div>';

        (function(classId, cardEl) {
            cardEl.addEventListener('mouseenter', function() { cardEl.style.transform = 'translateY(-4px)'; cardEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; });
            cardEl.addEventListener('mouseleave', function() { cardEl.style.transform = ''; cardEl.style.boxShadow = ''; });
            cardEl.addEventListener('click', function() {
                overlay.remove();
                callback(classId);
            });
        })(cid, card);

        grid.appendChild(card);
    }

    overlay.appendChild(grid);
    document.body.appendChild(overlay);
}

// --- AI picks a random avatar class ---
function aiPickAvatarClass() {
    var keys = Object.keys(AVATAR_CLASSES);
    return keys[Math.floor(Math.random() * keys.length)];
}

// =============================================
// PLAYER-CONTROLLED AVATAR INPUT
// =============================================
var _avatarMoveQueue = null;     // kept for combat grid sync
var _avatarAttackTarget = null;

function _getHumanAvatarInCombat() {
    if (typeof combatUnits === 'undefined') return null;
    var mySlot = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
    for (var i = 0; i < combatUnits.length; i++) {
        if (combatUnits[i].isAvatar && combatUnits[i].owner === mySlot && combatUnits[i].alive) return combatUnits[i];
    }
    return null;
}

// Set attack target (click on enemy)
function avatarSetTarget(unitId) {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    var av = _getHumanAvatarInCombat();
    if (!av) return;
    av.targetUnitId = unitId;
    _avatarAttackTarget = unitId;
}

// Cast ability by slot (0-3)
function avatarCastAbility(slot) {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    var av = _getHumanAvatarInCombat();
    if (!av) return;

    var abilities = getAvatarAbilities(av);
    if (slot >= abilities.length) {
        if (typeof showToast === 'function') showToast('Abilita non sbloccata', 'warning', '!');
        return;
    }

    var ab = abilities[slot];
    if (ab.type === 'passive') {
        if (typeof showToast === 'function') showToast(ab.icon + ' ' + ab.name + ' e passiva', 'info', ab.icon);
        return;
    }

    if (av.abilityCooldowns[ab.id] > 0) {
        if (typeof showToast === 'function') showToast(ab.name + ' in cooldown (' + av.abilityCooldowns[ab.id] + ')', 'warning', '!');
        return;
    }

    if (typeof combatTeams !== 'undefined' && typeof combatUnits !== 'undefined') {
        executeAvatarAbility(av, ab.id, combatUnits, combatTeams, null);
    }
}

// =============================================
// GUERRIERO COMBO ATTACK SYSTEM
// Left-click: 3-hit combo (1→2→finisher)
// =============================================
var _avatarComboStep     = 0;     // 0=idle, 1=hit1, 2=hit2, 3=finisher
var _avatarComboTimer    = 0;     // countdown to reset combo
var _avatarComboCooldown = 0;     // per-hit anti-spam cooldown
var COMBO_RESET_TIME     = 1.5;   // seconds: window to continue combo

// ── Stratega area-targeting constants ────────────────────────
var STRATEGA_TARGET_RANGE  = 4.0;   // distance from avatar to circle center (tiles)
var STRATEGA_TARGET_RADIUS = 1.5;   // AoE radius (tiles)
// Updated each frame by three-animations.js
var _strategaTargetWX = 0, _strategaTargetWZ = 0;

// ── Class-specific combo parameters ──────────────────────────
var _COMBO_PARAMS = {
    guerriero: [
        null,
        { dmgMult: 0.70, range: 1.5, arcDeg:  90, dmgType: 'physical', cooldown: 0.35, timeScale: 1.9, label: 'Fendente'    },
        { dmgMult: 0.90, range: 1.5, arcDeg:  90, dmgType: 'physical', cooldown: 0.35, timeScale: 1.9, label: 'Controtaglio' },
        { dmgMult: 1.80, range: 2.0, arcDeg: 140, dmgType: 'physical', cooldown: 0.70, timeScale: 1.7, label: 'Colpo Finale' }
    ],
    stratega: [
        null,
        { dmgMult: 0.90, aoeRadius: 1.5, dmgType: 'physical', cooldown: 0.30, timeScale: 2.0, label: 'Giavellotto',    aoeTarget: true },
        { dmgMult: 1.10, aoeRadius: 1.5, dmgType: 'physical', cooldown: 0.35, timeScale: 1.8, label: 'Giavellotto II', aoeTarget: true },
        { dmgMult: 2.00, aoeRadius: 1.5, dmgType: 'physical', cooldown: 0.80, timeScale: 1.0, label: 'Tempesta di Frecce', arrowStorm: true, slow: 2 }
    ],
    stregone: [
        null,
        { dmgMult: 0.70, range: 6.0, arcDeg:  80, dmgType: 'magic', cooldown: 0.28, timeScale: 2.0, label: 'Dardo Arcano', projectile: true },
        { dmgMult: 1.05, range: 7.0, arcDeg:  90, dmgType: 'magic', cooldown: 0.50, timeScale: 1.5, label: 'Orb Carico',   projectile: true, slow: 1 },
        { dmgMult: 1.40, range: 5.0, arcDeg: 360, dmgType: 'magic', cooldown: 0.95, timeScale: 1.2, label: 'Nova Arcana'  }
    ],
    mistico: [
        null,
        { dmgMult: 0.55, range: 3.0, arcDeg:  70, dmgType: 'magic',    cooldown: 0.28, timeScale: 2.0, label: 'Sfioramento Sacro', selfHealPct: 0.04 },
        { dmgMult: 0.85, range: 2.5, arcDeg:  95, dmgType: 'physical', cooldown: 0.42, timeScale: 1.6, label: 'Colpo di Bastone',   slow: 1 },
        { dmgMult: 1.10, range: 3.5, arcDeg: 200, dmgType: 'magic',    cooldown: 0.80, timeScale: 1.2, label: 'Onda Sacra',        allyHealPct: 0.08 }
    ]
};

// Returns the NEAREST alive enemy within a forward arc
function _getNearestInArc(avatar, range, arcDeg) {
    var list = _getEnemiesInArc(avatar, range, arcDeg);
    if (list.length === 0) return null;
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var best = list[0], bestD = Infinity;
    for (var _ni = 0; _ni < list.length; _ni++) {
        var _ex = (list[_ni]._smoothWX !== undefined) ? list[_ni]._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(list[_ni].row, list[_ni].col).x : list[_ni].col);
        var _ez = (list[_ni]._smoothWZ !== undefined) ? list[_ni]._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(list[_ni].row, list[_ni].col).z : list[_ni].row);
        var _d  = (_ex - avX) * (_ex - avX) + (_ez - avZ) * (_ez - avZ);
        if (_d < bestD) { best = list[_ni]; bestD = _d; }
    }
    return best;
}

// Fire a real projectile — visual travels, damage applied on arrival
function _fireAvatarProjectile(avatar, target, p, avX, avY, avZ) {
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var tgX = (target._smoothWX !== undefined) ? target._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).x : target.col);
    var tgZ = (target._smoothWZ !== undefined) ? target._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).z : target.row);
    var avatarClass = avatar.avatarClass;

    var dmg = Math.round(avatar.atk * p.dmgMult);
    var isCrit = Math.random() < (avatar.critChance || 0.1);
    if (isCrit) dmg = Math.round(dmg * 1.5);

    // Closure captures everything needed at fire time
    (function(tgt, d, crit, params, tx, tz) {
        var onImpact = function() {
            if (!tgt.alive) return;
            if (params.dmgType === 'magic') {
                tgt.hp -= d;
            } else {
                var AK = (typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50);
                tgt.hp -= Math.round(d * (AK / ((tgt.armor || 0) + AK)));
            }
            if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; }
            if (typeof addDamageNumber === 'function') addDamageNumber(tgt, d, crit ? 'crit' : params.dmgType);
            if (params.slow) tgt.effects.push({ type: 'speed_reduction',   value: 0.35, ticksLeft: params.slow, stacking: 'refresh' });
            if (params.stun) tgt.effects.push({ type: 'freeze', value: 0,    ticksLeft: params.stun, stacking: 'refresh' });
            // Impact VFX
            var iy = TILE_TOP;
            if (avatarClass === 'stregone' && typeof vfxArcaneImpact3D === 'function') {
                vfxArcaneImpact3D(tx, iy, tz, crit);
            } else if (avatarClass === 'stratega') {
                // Spear impact: gold burst + blue ring + upward sparks
                if (typeof _burst3D === 'function') _burst3D(tx, iy + 0.3, tz, crit ? 18 : 12, crit ? '#fff4b0' : '#fbbf24', 5.5, crit ? 0.35 : 0.25);
                if (typeof _ring3D  === 'function') {
                    _ring3D(tx, iy + 0.03, tz, 0.4, '#ffffff', 10, 0.16);
                    _ring3D(tx, iy + 0.05, tz, 0.7, '#60a5fa', 16, 0.22);
                }
                // Upward golden sparks on hit
                if (typeof _rising3D === 'function') _rising3D(tx, iy, tz, crit ? 8 : 4, '#ffd700', 0.25);
                if (typeof triggerScreenShake === 'function') triggerScreenShake(crit ? 3.0 : 1.5, 0.14);
            }
        };

        // Spawn the right visual projectile
        if (avatarClass === 'stratega' && typeof _spearProjectile3D === 'function') {
            _spearProjectile3D(avX, avY, avZ, tx, iy, tz, onImpact);
        } else if (avatarClass === 'stregone' && typeof _arcaneCombatBolt3D === 'function') {
            var isCharged = (params.label === 'Orb Carico');
            _arcaneCombatBolt3D(avX, avY, avZ, tx, TILE_TOP, tz, isCharged, onImpact);
        }
    })(target, dmg, isCrit, p, tgX, tgZ);
}

// Returns all alive enemy units within a forward arc of (range × TILE_UNIT) from avatar
function _getEnemiesInArc(avatar, range, arcDeg) {
    if (typeof combatUnits === 'undefined') return [];
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX
            : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ
            : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    // Avatar faces opposite to camera orbit angle
    var facing = (typeof _camOrbitAngle !== 'undefined') ? (_camOrbitAngle + Math.PI) : 0;
    var halfArc   = (arcDeg * Math.PI / 180) / 2;
    var rangeW    = range * (typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0);
    var result    = [];
    for (var i = 0; i < combatUnits.length; i++) {
        var e = combatUnits[i];
        if (!e.alive || e.owner === avatar.owner) continue;
        var ex = (e._smoothWX !== undefined) ? e._smoothWX
               : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
        var ez = (e._smoothWZ !== undefined) ? e._smoothWZ
               : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
        var dx = ex - avX, dz = ez - avZ;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > rangeW) continue;
        var angleToEnemy = Math.atan2(dx, dz);
        var diff = angleToEnemy - facing;
        while (diff >  Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= halfArc) result.push(e);
    }
    return result;
}

// Returns all alive enemies within a circle (for Stratega area targeting)
function _getEnemiesInCircle(cx, cz, radius, ownerExclude) {
    if (typeof combatUnits === 'undefined') return [];
    var r2 = radius * radius;
    var result = [];
    for (var i = 0; i < combatUnits.length; i++) {
        var e = combatUnits[i];
        if (!e.alive || e.owner === ownerExclude) continue;
        var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
        var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
        var dx = ex - cx, dz = ez - cz;
        if (dx * dx + dz * dz <= r2) result.push(e);
    }
    return result;
}

// Fire spear projectile toward target circle center, AoE damage on arrival
function _fireStrategaAreaSpear(avatar, targetX, targetZ, avX, avY, avZ, p) {
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var TU = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var dmg = Math.round(avatar.atk * p.dmgMult);
    var aoeR = (p.aoeRadius || 1.5) * TU;

    (function(d, tx, tz, radius, own) {
        var onImpact = function() {
            var enemies = _getEnemiesInCircle(tx, tz, radius, own);
            for (var i = 0; i < enemies.length; i++) {
                var e = enemies[i];
                var isCrit = Math.random() < (avatar.critChance || 0.1);
                var ed = isCrit ? Math.round(d * 1.5) : d;
                var AK = (typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50);
                e.hp -= Math.round(ed * (AK / ((e.armor || 0) + AK)));
                if (e.hp <= 0) { e.hp = 0; e.alive = false; }
                if (typeof addDamageNumber === 'function') addDamageNumber(e, ed, isCrit ? 'crit' : 'physical');
                var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
                var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
                if (typeof _burst3D === 'function') _burst3D(ex, TILE_TOP + 0.3, ez, isCrit ? 14 : 8, '#fbbf24', 5.0, 0.25);
                if (typeof _ring3D === 'function' && isCrit) _ring3D(ex, TILE_TOP + 0.03, ez, 0.3, '#ffffff', 8, 0.15);
            }
            // Area impact VFX
            if (typeof _ring3D === 'function') _ring3D(tx, TILE_TOP + 0.03, tz, radius * 0.5, '#fbbf24', 16, 0.20);
            if (typeof _burst3D === 'function') _burst3D(tx, TILE_TOP + 0.3, tz, 10, '#ffd700', 4.5, 0.22);
            if (typeof _rising3D === 'function') _rising3D(tx, TILE_TOP, tz, 4, '#ffd700', 0.25);
            if (typeof triggerScreenShake === 'function') triggerScreenShake(1.5, 0.12);
        };
        if (typeof _spearProjectile3D === 'function') {
            _spearProjectile3D(avX, avY, avZ, tx, TILE_TOP, tz, onImpact);
        }
    })(dmg, targetX, targetZ, aoeR, avatar.owner);
}

// Stratega arrow storm finisher (called on right-click after 2 left clicks)
function avatarComboFinisher() {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    var avatar = _getHumanAvatarInCombat();
    if (!avatar || !avatar.alive) return;
    if (avatar.avatarClass !== 'stratega') return;
    if (_avatarComboStep !== 2) return;
    if (_avatarComboCooldown > 0) return;

    var p = _COMBO_PARAMS['stratega'][3];
    _avatarComboStep = 0;
    _avatarComboTimer = 0;
    _avatarComboCooldown = p.cooldown;

    // ── Animation ──
    var entry = (typeof threeUnitModels !== 'undefined') ? threeUnitModels[avatar.id] : null;
    var group = entry ? entry.group : null;
    if (group && group._avatarAnimator) {
        var anim = group._avatarAnimator;
        var clipN = anim.swordFinClipName || anim.sword1ClipName || anim.swordRegClipName;
        if (clipN && anim.actions[clipN]) {
            var atkAction = anim.actions[clipN];
            atkAction.timeScale = p.timeScale;
            atkAction.reset(); atkAction.play();
            if (anim.currentAction && anim.currentAction !== atkAction)
                anim.currentAction.crossFadeTo(atkAction, 0.04, true);
            anim.currentAction = atkAction;
            anim.attacking = true;
            anim.attackTimer = (atkAction.getClip().duration / p.timeScale) * 0.85;
            if (entry) entry._avatarDesiredAnim = null;
        }
    }

    // ── AoE damage + slow ──
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var TU = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var tRadius = (p.aoeRadius || STRATEGA_TARGET_RADIUS) * TU;
    var tx = _strategaTargetWX, tz = _strategaTargetWZ;
    var dmg = Math.round(avatar.atk * p.dmgMult);

    var enemies = _getEnemiesInCircle(tx, tz, tRadius, avatar.owner);
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        var isCrit = Math.random() < (avatar.critChance || 0.1);
        var ed = isCrit ? Math.round(dmg * 1.5) : dmg;
        var AK = (typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50);
        e.hp -= Math.round(ed * (AK / ((e.armor || 0) + AK)));
        if (e.hp <= 0) { e.hp = 0; e.alive = false; }
        if (typeof addDamageNumber === 'function') addDamageNumber(e, ed, isCrit ? 'crit' : 'physical');
        if (p.slow) e.effects.push({ type: 'speed_reduction', value: 0.35, ticksLeft: p.slow, stacking: 'refresh' });
        var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
        var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
        if (typeof _burst3D === 'function') _burst3D(ex, TILE_TOP + 0.3, ez, isCrit ? 16 : 10, '#fbbf24', 5.5, 0.30);
    }

    // ── Arrow Storm VFX ──
    if (typeof vfxArrowStorm3D === 'function') vfxArrowStorm3D(tx, TILE_TOP, tz, tRadius);

    // ── Screen feedback ──
    if (typeof triggerScreenShake === 'function') triggerScreenShake(5.0, 0.30);
    if (typeof triggerScreenFlash === 'function') triggerScreenFlash('#fbbf24', 0.18);

    // ── Toast ──
    if (enemies.length > 0 && typeof showToast === 'function')
        showToast('🏹 ' + p.label + '! ×' + enemies.length, 'skill', '🏹');
}

// Called on left-click during FPS combat
function avatarComboAttack() {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    var avatar = _getHumanAvatarInCombat();
    if (!avatar || !avatar.alive) return;
    if (_avatarComboCooldown > 0) return;

    // Advance combo step 1→2→3→1→...
    _avatarComboStep++;
    if (_avatarComboStep > 3) _avatarComboStep = 1;
    // Stratega: left click caps at step 2 — step 3 is right-click finisher (arrow storm)
    var avatarClass = avatar.avatarClass || 'guerriero';
    if (avatarClass === 'stratega' && _avatarComboStep > 2) _avatarComboStep = 1;
    _avatarComboTimer = COMBO_RESET_TIME;
    var classParams = _COMBO_PARAMS[avatarClass] || _COMBO_PARAMS['guerriero'];
    var p = classParams[_avatarComboStep];
    var isFinisher = (_avatarComboStep === 3);

    _avatarComboCooldown = p.cooldown;

    // ── Animation ────────────────────────────────────────────
    var entry = (typeof threeUnitModels !== 'undefined') ? threeUnitModels[avatar.id] : null;
    var group = entry ? entry.group : null;
    if (group && group._avatarAnimator) {
        var anim = group._avatarAnimator;
        var clipN;
        if (isFinisher)            clipN = anim.swordFinClipName || anim.sword1ClipName || anim.swordRegClipName;
        else if (_avatarComboStep === 2) clipN = anim.sword2ClipName || anim.sword1ClipName || anim.swordRegClipName;
        else                       clipN = anim.sword1ClipName || anim.swordRegClipName;
        if (clipN && anim.actions[clipN]) {
            var atkAction = anim.actions[clipN];
            atkAction.timeScale = p.timeScale;
            atkAction.reset(); atkAction.play();
            if (anim.currentAction && anim.currentAction !== atkAction)
                anim.currentAction.crossFadeTo(atkAction, 0.04, true);
            anim.currentAction = atkAction;
            anim.attacking     = true;
            anim.attackTimer   = (atkAction.getClip().duration / p.timeScale) * 0.85;
            if (entry) entry._avatarDesiredAnim = null;
        }
    }

    // ── World coords ─────────────────────────────────────────
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX
            : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ
            : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var avY = TILE_TOP + 0.4;
    var facing = (typeof _camOrbitAngle !== 'undefined') ? (_camOrbitAngle + Math.PI) : 0;

    // ── Hit detection — AOE TARGET / PROJECTILE / INSTANT ────
    var enemies = [];
    if (p.aoeTarget && avatarClass === 'stratega') {
        // Stratega: fire spear toward target circle, AoE damage on arrival
        _fireStrategaAreaSpear(avatar, _strategaTargetWX, _strategaTargetWZ, avX, avY, avZ, p);
        // No immediate damage — deferred to projectile impact
    } else if (p.projectile) {
        // Real projectile: find nearest target, fire, damage deferred to onImpact
        var projTarget = _getNearestInArc(avatar, p.range, p.arcDeg);
        if (projTarget) {
            // Staff classes: offset origin to staff tip
            var projAvX = avX, projAvY = avY, projAvZ = avZ;
            if (avatarClass === 'stregone' || avatarClass === 'mistico') {
                projAvX += Math.sin(facing) * 0.35;
                projAvZ += Math.cos(facing) * 0.35;
                projAvY += 0.15;
            }
            _fireAvatarProjectile(avatar, projTarget, p, projAvX, projAvY, projAvZ);
        } else if (avatarClass === 'stregone' || avatarClass === 'mistico') {
            // No target found — fire visual-only bolt forward so player sees the attack
            var TILE = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
            var missRange = p.range * TILE;
            var missX = avX + Math.sin(facing) * missRange;
            var missZ = avZ + Math.cos(facing) * missRange;
            var staffX = avX + Math.sin(facing) * 0.35;
            var staffZ = avZ + Math.cos(facing) * 0.35;
            var staffY = avY + 0.15;
            if (typeof _arcaneCombatBolt3D === 'function') {
                var isCharged = (p.label === 'Orb Carico');
                _arcaneCombatBolt3D(staffX, staffY, staffZ, missX, TILE_TOP, missZ, isCharged, null);
            }
        }
        // No immediate damage, no post-hit effects
    } else {
        // Instant melee/AoE
        enemies = _getEnemiesInArc(avatar, p.range, p.arcDeg);
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            var dmg = Math.round(avatar.atk * p.dmgMult);
            var isCrit = Math.random() < (avatar.critChance || 0.1);
            if (isCrit) dmg = Math.round(dmg * 1.5);
            if (p.dmgType === 'magic') {
                e.hp -= dmg;
            } else {
                var AK = (typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50);
                e.hp -= Math.round(dmg * (AK / ((e.armor || 0) + AK)));
            }
            if (e.hp <= 0) { e.hp = 0; e.alive = false; }
            if (typeof addDamageNumber === 'function') addDamageNumber(e, dmg, isCrit ? 'crit' : p.dmgType);
            if (p.stun) e.effects.push({ type: 'freeze', value: 0,    ticksLeft: p.stun, stacking: 'refresh' });
            if (p.slow) e.effects.push({ type: 'speed_reduction',   value: 0.35, ticksLeft: p.slow, stacking: 'refresh' });

            // Per-enemy hit VFX
            var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
            var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
            if (typeof _burst3D === 'function') {
                var _hcMap = { guerriero: isFinisher ? '#ff3300' : (isCrit ? '#fbbf24' : '#ff6666'),
                               stratega:  isFinisher ? '#fbbf24' : (isCrit ? '#ffd700' : '#93c5fd'),
                               stregone:  isFinisher ? '#e879f9' : (isCrit ? '#c084fc' : '#a855f7'),
                               mistico:   isFinisher ? '#86efac' : (isCrit ? '#fef08a' : '#4ade80') };
                _burst3D(ex, avY, ez, isFinisher ? 16 : (isCrit ? 12 : 8),
                    _hcMap[avatarClass] || '#ff6666', isFinisher ? 5.0 : 4.0, isFinisher ? 0.30 : 0.20);
            }
            // Guerriero AAA: directional metal sparks + impact debris
            if (avatarClass === 'guerriero' && typeof _spawn3D === 'function') {
                var _dirX = ex - avX, _dirZ = ez - avZ;
                var _dLen = Math.sqrt(_dirX*_dirX + _dirZ*_dirZ) || 1;
                _dirX /= _dLen; _dirZ /= _dLen;
                var _skN = isFinisher ? 10 : (isCrit ? 6 : 4);
                for (var _sk = 0; _sk < _skN; _sk++) {
                    var _skPos = new THREE.Vector3(ex + (Math.random()-0.5)*0.1, avY + (Math.random()-0.5)*0.12, ez + (Math.random()-0.5)*0.1);
                    var _skVel = { x: _dirX*(3+Math.random()*3) + (Math.random()-0.5)*2,
                                   y: 1.0 + Math.random()*2.0,
                                   z: _dirZ*(3+Math.random()*3) + (Math.random()-0.5)*2 };
                    var _skP = _spawn3D(_skPos, _skVel, isCrit ? '#ffd700' : '#e8dcc8', 0.3, 0.22 + Math.random()*0.10);
                    if (_skP) _skP.gravity = -5.0;
                }
                if (isFinisher && typeof _ring3D === 'function') {
                    _ring3D(ex, TILE_TOP + 0.02, ez, 0.45, '#ff4400', 14, 0.18);
                }
            }
            if (isFinisher) {
                if (avatarClass === 'stregone' && typeof vfxArcaneImpact3D === 'function') vfxArcaneImpact3D(ex, TILE_TOP, ez, isCrit);
                else if (typeof _ring3D === 'function') {
                    var _rcMap = { guerriero:'#ff2200', stratega:'#fbbf24', stregone:'#a855f7', mistico:'#22c55e' };
                    _ring3D(ex, avY - 0.1, ez, 0.7, _rcMap[avatarClass] || '#ff2200', 18, 0.25);
                }
            }
        }

        // ── Post-hit class effects (instant attacks only) ─────
        if (avatarClass === 'mistico' && p.selfHealPct && enemies.length > 0) {
            avatar.hp = Math.min(avatar.maxHp, avatar.hp + Math.round(avatar.maxHp * p.selfHealPct * enemies.length));
            if (typeof vfxHealTarget3D === 'function') vfxHealTarget3D(avX, avY, avZ);
        }
        if (avatarClass === 'mistico' && p.allyHealPct && typeof combatUnits !== 'undefined') {
            for (var _mi = 0; _mi < combatUnits.length; _mi++) {
                var _mu = combatUnits[_mi];
                if (!_mu.alive || _mu.owner !== avatar.owner) continue;
                var _heal = Math.round(_mu.maxHp * p.allyHealPct);
                _mu.hp = Math.min(_mu.maxHp, _mu.hp + _heal);
                if (typeof addDamageNumber === 'function') addDamageNumber(_mu, _heal, 'heal');
                if (typeof vfxHealTarget3D === 'function') {
                    var _mx = (_mu._smoothWX !== undefined) ? _mu._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(_mu.row, _mu.col).x : _mu.col);
                    var _mz = (_mu._smoothWZ !== undefined) ? _mu._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(_mu.row, _mu.col).z : _mu.row);
                    vfxHealTarget3D(_mx, TILE_TOP, _mz);
                }
            }
            if (typeof vfxOndaSacra3D === 'function') vfxOndaSacra3D(avX, avY, avZ);
            if (typeof showToast === 'function') showToast('✨ Onda Sacra! Tutti curati', 'heal', '✨');
        }
    }

    // ── Swing/trail VFX ──────────────────────────────────────
    if (avatarClass === 'guerriero' && typeof _slashTrail3D === 'function') {
        _slashTrail3D(avX, avY, avZ, facing, _avatarComboStep);
    } else if (avatarClass === 'stratega') {
        // Ranged throw — small burst at avatar hand, no melee trail (projectile has its own trail)
        if (typeof _burst3D === 'function') _burst3D(avX, avY + 0.1, avZ, 5, _avatarComboStep === 2 ? '#fbbf24' : '#60a5fa', 3.0, 0.15);
    } else if (avatarClass === 'stregone' && typeof _arcaneCastTrail3D === 'function') {
        _arcaneCastTrail3D(avX, avY, avZ, facing, _avatarComboStep);
    } else if (avatarClass === 'mistico' && typeof _holyTrail3D === 'function') {
        _holyTrail3D(avX, avY, avZ, facing, _avatarComboStep);
    }

    // ── Whoosh ring at avatar ─────────────────────────────────
    if (typeof _ring3D === 'function') {
        var ringCols2 = { guerriero: isFinisher ? '#ff6600' : '#c8d4ff',
                          stratega:  isFinisher ? '#fbbf24' : '#60a5fa',
                          stregone:  isFinisher ? '#e879f9' : '#c084fc',
                          mistico:   isFinisher ? '#86efac' : '#bbf7d0' };
        _ring3D(avX, avY, avZ, isFinisher ? 1.4 : 0.9, ringCols2[avatarClass] || '#c8d4ff', isFinisher ? 20 : 12, 0.16);
    }

    // ── Finisher special VFX ─────────────────────────────────
    if (isFinisher) {
        if (avatarClass === 'guerriero' && typeof _burst3D === 'function') {
            // AAA finisher: shockwave burst + radial embers + secondary ring
            _burst3D(avX, avY + 0.15, avZ, 18, '#ff4400', 5.5, 0.38);
            _burst3D(avX, avY + 0.30, avZ, 10, '#fbbf24', 3.5, 0.28);
            if (typeof _ring3D === 'function') {
                _ring3D(avX, avY - 0.05, avZ, 1.0, '#ff3300', 22, 0.20);
                _ring3D(avX, avY + 0.10, avZ, 0.5, '#fbbf24', 12, 0.15);
            }
            if (typeof _rising3D === 'function') _rising3D(avX, avY, avZ, 8, '#ff6622', 0.50);
        }
        else if (avatarClass === 'stratega' && typeof vfxStrategaSfondamento3D === 'function')
            vfxStrategaSfondamento3D(avX, avY, avZ, facing);
        else if (avatarClass === 'stregone' && typeof vfxNovaArcana3D === 'function')
            vfxNovaArcana3D(avX, avY, avZ);
        // mistico finisher VFX already fired above (vfxOndaSacra3D)
    }

    // ── Screen feedback ───────────────────────────────────────
    var flashCols = { guerriero: isFinisher ? '#ff6600' : '#ffffff',
                      stratega:  isFinisher ? '#fbbf24' : '#93c5fd',
                      stregone:  isFinisher ? '#a855f7' : '#e9d5ff',
                      mistico:   isFinisher ? '#22c55e' : '#dcfce7' };
    if (typeof triggerScreenFlash === 'function')
        triggerScreenFlash(flashCols[avatarClass] || '#ffffff', isFinisher ? 0.12 : 0.07);
    var shakeStr = { guerriero: isFinisher ? 4.5 : 1.6, stratega: isFinisher ? 4.5 : 0.8,
                     stregone:  isFinisher ? 5.0 : 0.5, mistico:   isFinisher ? 2.5 : 0.4 };
    if (typeof triggerScreenShake === 'function')
        triggerScreenShake(shakeStr[avatarClass] || 1.0, isFinisher ? 0.22 : 0.12);

    // ── Finisher toast ────────────────────────────────────────
    if (isFinisher && enemies.length > 0 && typeof showToast === 'function') {
        var labels = { guerriero: '⚔️ ', stratega: '🗡️ ', stregone: '✨ ', mistico: '💚 ' };
        showToast((labels[avatarClass] || '⚔️ ') + p.label + '! ×' + enemies.length, 'skill', labels[avatarClass] || '⚔️');
    }

    // ── Melee arc flash ───────────────────────────────────────
    if (group) {
        var _arc = group.getObjectByName('meleeArc');
        if (_arc) {
            var arcFlashCols = { guerriero: isFinisher ? '#ff6600' : '#93c5fd',
                                 stratega:  isFinisher ? '#fbbf24' : '#60a5fa',
                                 stregone:  isFinisher ? '#e879f9' : '#c084fc',
                                 mistico:   isFinisher ? '#86efac' : '#4ade80' };
            _arc._flashTimer = isFinisher ? 0.5 : 0.3;
            _arc._flashDur   = _arc._flashTimer;
            if (_arc._fill) _arc._fill.material.color.set(arcFlashCols[avatarClass] || '#93c5fd');
            if (_arc._edge) _arc._edge.material.color.set(arcFlashCols[avatarClass] || '#93c5fd');
        }
    }

    // combo debug removed
}

// Called every frame from render loop
function updateAvatarCombo(dt) {
    if (_avatarComboCooldown > 0) _avatarComboCooldown -= dt;
    if (_avatarComboTimer   > 0) {
        _avatarComboTimer -= dt;
        if (_avatarComboTimer <= 0) _avatarComboStep = 0;
    }

    // Release attack animation lock when timer expires
    var avatar = _getHumanAvatarInCombat();
    if (!avatar) return;
    var entry = (typeof threeUnitModels !== 'undefined') ? threeUnitModels[avatar.id] : null;
    var group = entry ? entry.group : null;
    if (group && group._avatarAnimator && group._avatarAnimator.attacking) {
        group._avatarAnimator.attackTimer -= dt;
        if (group._avatarAnimator.attackTimer <= 0) {
            group._avatarAnimator.attacking = false;
            // After furia_enter finishes, loop into furia_idle
            if (group._avatarAnimator.furiaActive && group._avatarAnimator.furiaIdleClipName) {
                if (typeof _playAvatarAnimation === 'function') {
                    _playAvatarAnimation(group, group._avatarAnimator.furiaIdleClipName, 0.3);
                }
            } else if (entry) {
                entry._avatarDesiredAnim = null; // state machine re-evaluates
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
//  ARCANE ORBS — floating spheres that orbit & auto-fire
// ════════════════════════════════════════════════════════════
var _arcaneOrbMeshes = []; // { mesh, glowMesh, idx }

function updateArcaneOrbs(dt) {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) {
        _clearArcaneOrbMeshes();
        return;
    }
    var avatar = _getHumanAvatarInCombat();
    if (!avatar || !avatar._arcaneOrbs) {
        _clearArcaneOrbMeshes();
        return;
    }

    var orbs = avatar._arcaneOrbs;
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var TILE = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var avY = TILE_TOP + 0.45;
    var t = performance.now() / 1000;

    // Ensure meshes exist for each alive orb
    var aliveCount = 0;
    for (var i = 0; i < orbs.orbs.length; i++) {
        if (orbs.orbs[i].alive) aliveCount++;
    }
    _syncArcaneOrbMeshes(aliveCount);

    // Orbit speed
    var orbitRadius = 0.3;
    var orbitSpeed = 2.0;
    var bobAmp = 0.06;
    var bobSpeed = 3.0;

    // Update orb positions (orbit around avatar)
    var meshIdx = 0;
    for (var i = 0; i < orbs.orbs.length; i++) {
        var orb = orbs.orbs[i];
        if (!orb.alive) continue;
        orb.angle += orbitSpeed * dt;
        var ox = avX + Math.cos(orb.angle) * orbitRadius;
        var oz = avZ + Math.sin(orb.angle) * orbitRadius;
        var oy = avY + Math.sin(t * bobSpeed + i * 1.5) * bobAmp;

        if (meshIdx < _arcaneOrbMeshes.length) {
            _arcaneOrbMeshes[meshIdx].mesh.position.set(ox, oy, oz);
            _arcaneOrbMeshes[meshIdx].glowMesh.position.set(ox, oy, oz);
            // Subtle sparkle trail
            if (Math.random() < 0.3 && typeof _spawn3D === 'function') {
                _spawn3D({ x: ox, y: oy, z: oz },
                    { x: (Math.random()-0.5)*0.3, y: 0.2, z: (Math.random()-0.5)*0.3 },
                    '#c084fc', 0.06, 0.15);
            }
        }
        meshIdx++;
    }

    // Auto-fire cooldown
    orbs.timer -= dt;
    if (orbs.timer > 0) return;

    // Find nearest enemy in range
    if (typeof combatUnits === 'undefined') return;
    var best = null, bestD = Infinity;
    for (var i = 0; i < combatUnits.length; i++) {
        var e = combatUnits[i];
        if (!e.alive || e.owner === avatar.owner) continue;
        var dist = Math.max(Math.abs(e.row - avatar.row), Math.abs(e.col - avatar.col));
        if (dist <= orbs.range && dist < bestD) { best = e; bestD = dist; }
    }
    if (!best) return;

    // Find first alive orb to launch
    var launchIdx = -1;
    for (var i = 0; i < orbs.orbs.length; i++) {
        if (orbs.orbs[i].alive) { launchIdx = i; break; }
    }
    if (launchIdx < 0) return;

    // Launch orb!
    var orb = orbs.orbs[launchIdx];
    orb.alive = false;
    orbs.timer = orbs.cooldown;

    var orbX = avX + Math.cos(orb.angle) * orbitRadius;
    var orbZ = avZ + Math.sin(orb.angle) * orbitRadius;
    var orbY = avY;

    var tgX = (best._smoothWX !== undefined) ? best._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(best.row, best.col).x : best.col);
    var tgZ = (best._smoothWZ !== undefined) ? best._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(best.row, best.col).z : best.row);

    // Deal damage on impact
    var dmg = Math.round(avatar.atk * orbs.dmgMult);
    var isCrit = Math.random() < (avatar.critChance || 0.1);
    if (isCrit) dmg = Math.round(dmg * 1.5);

    (function(tgt, d, crit, tx, tz) {
        var onImpact = function() {
            if (!tgt.alive) return;
            tgt.hp -= d;
            if (tgt.hp <= 0) { tgt.hp = 0; tgt.alive = false; }
            if (typeof addDamageNumber === 'function') addDamageNumber(tgt, d, crit ? 'crit' : 'magic');
            if (typeof vfxArcaneImpact3D === 'function') vfxArcaneImpact3D(tx, TILE_TOP, tz, crit);
        };
        if (typeof _arcaneCombatBolt3D === 'function') {
            _arcaneCombatBolt3D(orbX, orbY, orbZ, tx, TILE_TOP, tz, false, onImpact);
        }
    })(best, dmg, isCrit, tgX, tgZ);

    // Respawn orb after delay
    (function(idx, orbsRef) {
        setTimeout(function() {
            if (orbsRef.orbs[idx]) {
                orbsRef.orbs[idx].alive = true;
                orbsRef.orbs[idx].angle = Math.random() * Math.PI * 2;
            }
        }, 3000); // respawn after 3 seconds
    })(launchIdx, orbs);
}

function _syncArcaneOrbMeshes(count) {
    if (!threeScene) return;
    // Remove excess
    while (_arcaneOrbMeshes.length > count) {
        var m = _arcaneOrbMeshes.pop();
        threeScene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose();
        threeScene.remove(m.glowMesh); m.glowMesh.geometry.dispose(); m.glowMesh.material.dispose();
    }
    // Add missing
    while (_arcaneOrbMeshes.length < count) {
        var coreGeo = new THREE.SphereGeometry(0.04, 8, 8);
        var coreMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        var core = new THREE.Mesh(coreGeo, coreMat);
        threeScene.add(core);

        var glowGeo = new THREE.SphereGeometry(0.07, 8, 8);
        var glowMat = new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.4, depthWrite: false });
        var glow = new THREE.Mesh(glowGeo, glowMat);
        threeScene.add(glow);

        _arcaneOrbMeshes.push({ mesh: core, glowMesh: glow });
    }
}

function _clearArcaneOrbMeshes() {
    if (!threeScene) return;
    for (var i = 0; i < _arcaneOrbMeshes.length; i++) {
        threeScene.remove(_arcaneOrbMeshes[i].mesh);
        _arcaneOrbMeshes[i].mesh.geometry.dispose();
        _arcaneOrbMeshes[i].mesh.material.dispose();
        threeScene.remove(_arcaneOrbMeshes[i].glowMesh);
        _arcaneOrbMeshes[i].glowMesh.geometry.dispose();
        _arcaneOrbMeshes[i].glowMesh.material.dispose();
    }
    _arcaneOrbMeshes = [];
}

// ════════════════════════════════════════════════════════════
//  SUMMONED ZOMBIES — spawned by Apocalisse
// ════════════════════════════════════════════════════════════
var _activeZombies = [];

function _spawnSummonedZombies(avatar, ab, count) {
    var TILE = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;

    for (var i = 0; i < count; i++) {
        // Find a random valid cell near the avatar
        var attempts = 0, zRow, zCol;
        do {
            zRow = avatar.row + Math.floor(Math.random() * 5) - 2;
            zCol = avatar.col + Math.floor(Math.random() * 5) - 2;
            attempts++;
        } while (attempts < 20 && typeof isValidCell === 'function' && !isValidCell(zRow, zCol));

        var zombieId = 'zombie_' + Date.now() + '_' + i;
        var zombie = {
            id: zombieId,
            charId: 'summon_zombie',
            summonType: 'zombie',
            owner: avatar.owner,
            alive: true,
            hp: Math.round(avatar.maxHp * (ab.zombieHpMult || 0.30)),
            maxHp: Math.round(avatar.maxHp * (ab.zombieHpMult || 0.30)),
            atk: Math.round(avatar.atk * (ab.zombieDmgMult || 0.25)),
            armor: 0,
            range: 1,
            atkSpeed: 2.0,
            atkTimer: 0,
            row: zRow, col: zCol,
            targetRow: zRow, targetCol: zCol,
            targetUnitId: null,
            effects: [],
            shield: 0,
            hasMoved: false,
            isStopped: false,
            behavior: 'aggressive',
            _isSummon: true,
            _summonTimer: ab.duration || 8,
            _summonOwner: avatar.id
        };

        // Add smooth world positions
        if (typeof cellToWorld === 'function') {
            var wp = cellToWorld(zRow, zCol);
            zombie._smoothWX = wp.x;
            zombie._smoothWZ = wp.z;
        }

        // Add to combat
        if (typeof combatUnits !== 'undefined') combatUnits.push(zombie);
        _activeZombies.push(zombie);

        // Spawn 3D model
        if (typeof spawnUnitModel3D === 'function') spawnUnitModel3D(zombie);

        // Spawn VFX: ground burst where zombie appears
        if (typeof cellToWorld === 'function') {
            var zwp = cellToWorld(zRow, zCol);
            if (typeof _burst3D === 'function') _burst3D(zwp.x, TILE_TOP + 0.2, zwp.z, 12, '#4ade80', 3.5, 0.35);
            if (typeof _ring3D === 'function') _ring3D(zwp.x, TILE_TOP + 0.03, zwp.z, 0.4, '#22c55e', 14, 0.30);
            if (typeof _rising3D === 'function') _rising3D(zwp.x, TILE_TOP, zwp.z, 8, '#86efac', 0.50);
        }
    }

    if (typeof showToast === 'function') showToast('🧟 ' + count + ' Zombi evocati!', 'danger', '🧟');
}

function updateSummonedZombies(dt) {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) {
        _activeZombies = [];
        return;
    }
    if (_activeZombies.length === 0) return;

    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;

    for (var i = _activeZombies.length - 1; i >= 0; i--) {
        var z = _activeZombies[i];
        if (!z.alive) {
            _despawnZombie(z);
            _activeZombies.splice(i, 1);
            continue;
        }

        // Duration countdown
        z._summonTimer -= dt;
        if (z._summonTimer <= 0) {
            z.alive = false;
            _despawnZombie(z);
            _activeZombies.splice(i, 1);
            continue;
        }

        // Attack timer
        z.atkTimer += dt;
        if (z.atkTimer >= z.atkSpeed) {
            z.atkTimer -= z.atkSpeed;
            // Find random nearby enemy
            if (typeof combatUnits !== 'undefined') {
                var bestTarget = null, bestDist = Infinity;
                for (var j = 0; j < combatUnits.length; j++) {
                    var e = combatUnits[j];
                    if (!e.alive || e.owner === z.owner || e._isSummon) continue;
                    var dist = Math.max(Math.abs(e.row - z.row), Math.abs(e.col - z.col));
                    if (dist <= z.range + 1 && dist < bestDist) { bestTarget = e; bestDist = dist; }
                }
                if (!bestTarget) {
                    // No nearby enemy — pick random enemy anywhere
                    var allEnemies = [];
                    for (var j = 0; j < combatUnits.length; j++) {
                        if (combatUnits[j].alive && combatUnits[j].owner !== z.owner && !combatUnits[j]._isSummon) allEnemies.push(combatUnits[j]);
                    }
                    if (allEnemies.length > 0) bestTarget = allEnemies[Math.floor(Math.random() * allEnemies.length)];
                }
                if (bestTarget) {
                    // Move toward target
                    if (Math.abs(bestTarget.row - z.row) > 1 || Math.abs(bestTarget.col - z.col) > 1) {
                        z.row += (bestTarget.row > z.row ? 1 : bestTarget.row < z.row ? -1 : 0);
                        z.col += (bestTarget.col > z.col ? 1 : bestTarget.col < z.col ? -1 : 0);
                        if (typeof cellToWorld === 'function') {
                            var nwp = cellToWorld(z.row, z.col);
                            z._smoothWX = nwp.x; z._smoothWZ = nwp.z;
                        }
                    }
                    // Attack if in range
                    var atkDist = Math.max(Math.abs(bestTarget.row - z.row), Math.abs(bestTarget.col - z.col));
                    if (atkDist <= z.range) {
                        bestTarget.hp -= z.atk;
                        if (bestTarget.hp <= 0) { bestTarget.hp = 0; bestTarget.alive = false; }
                        if (typeof addDamageNumber === 'function') addDamageNumber(bestTarget, z.atk, 'physical');
                        // Attack VFX
                        var eX = bestTarget._smoothWX !== undefined ? bestTarget._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(bestTarget.row, bestTarget.col).x : bestTarget.col);
                        var eZ = bestTarget._smoothWZ !== undefined ? bestTarget._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(bestTarget.row, bestTarget.col).z : bestTarget.row);
                        if (typeof _burst3D === 'function') _burst3D(eX, TILE_TOP + 0.2, eZ, 5, '#4ade80', 2.5, 0.18);
                        // Play bite animation on zombie model
                        var zEntry = typeof threeUnitModels !== 'undefined' ? threeUnitModels[z.id] : null;
                        if (zEntry && zEntry.group && zEntry.group._summonAttackClip && zEntry.group._summonActions) {
                            var biteAct = zEntry.group._summonActions[zEntry.group._summonAttackClip];
                            if (biteAct) { biteAct.reset(); biteAct.play(); }
                        }
                    }
                }
            }
        }

        // Update 3D model position
        var zEntry = typeof threeUnitModels !== 'undefined' ? threeUnitModels[z.id] : null;
        if (zEntry && zEntry.group) {
            if (typeof cellToWorld === 'function') {
                var twp = cellToWorld(z.row, z.col);
                zEntry.group.position.x += (twp.x - zEntry.group.position.x) * 0.1;
                zEntry.group.position.z += (twp.z - zEntry.group.position.z) * 0.1;
            }
            // Update animation mixer
            if (zEntry.group._summonMixer) zEntry.group._summonMixer.update(dt);
        }
    }
}

function _despawnZombie(z) {
    // Death VFX
    if (typeof cellToWorld === 'function') {
        var wp = cellToWorld(z.row, z.col);
        var Y = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
        if (typeof _burst3D === 'function') _burst3D(wp.x, Y + 0.2, wp.z, 10, '#22c55e', 3, 0.30);
        if (typeof _rising3D === 'function') _rising3D(wp.x, Y, wp.z, 6, '#4ade80', 0.40);
    }
    // Remove 3D model
    if (typeof threeUnitModels !== 'undefined' && threeUnitModels[z.id]) {
        var entry = threeUnitModels[z.id];
        if (entry.group && typeof threeScene !== 'undefined') {
            threeScene.remove(entry.group);
            entry.group.traverse(function(c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        }
        delete threeUnitModels[z.id];
    }
    // Remove from combatUnits
    if (typeof combatUnits !== 'undefined') {
        for (var i = combatUnits.length - 1; i >= 0; i--) {
            if (combatUnits[i].id === z.id) { combatUnits.splice(i, 1); break; }
        }
    }
}

// Init avatar input — abilities (1-4), attack (right-click), stop (space)
// WASD movement is handled by updateAvatarMovement in three-setup.js
function initAvatarInput() {
    window.addEventListener('keydown', function(e) {
        if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
        if (!_getHumanAvatarInCombat()) return;

        switch (e.key) {
            case '1': avatarCastAbility(0); break;
            case '2': avatarCastAbility(1); break;
            case '3': avatarCastAbility(2); break;
            case '4': avatarCastAbility(3); break;
            case ' ':
                var av = _getHumanAvatarInCombat();
                if (av) { av.targetUnitId = null; _avatarAttackTarget = null; }
                e.preventDefault();
                break;
        }
    });

    // Right-click is now handled by specials.js (hold for special attack,
    // short click falls back to enemy targeting via specials.js fallback).
    // Init special input system
    if (typeof initSpecialInput === 'function') initSpecialInput();
}

// =============================================
// AVATAR ABILITY HUD (bottom-center during combat)
// =============================================
function renderAvatarHUD() {
    var hud = document.getElementById('avatar-hud');
    if (!hud) return;

    if (typeof gamePhase === 'undefined' || (gamePhase !== PHASE_COMBAT && gamePhase !== PHASE_PLANNING)) {
        hud.style.display = 'none';
        hud.classList.remove('combat-mode');
        return;
    }

    var player = (typeof players !== 'undefined') ? players[0] : null;
    if (!player || !player.avatar || !player.avatar.alive) {
        hud.style.display = 'none';
        hud.classList.remove('combat-mode');
        return;
    }

    hud.style.display = 'flex';
    // During combat, drop HUD to bottom (no bench visible); during planning, stay above bench
    if (gamePhase === PHASE_COMBAT) {
        hud.classList.add('combat-mode');
    } else {
        hud.classList.remove('combat-mode');
    }
    var av = player.avatar;
    var cls = AVATAR_CLASSES[av.avatarClass];
    if (!cls) return;

    var html = '';

    // Avatar info
    html += '<div class="av-hud-info">';
    html += '<span class="av-hud-icon" style="color:' + cls.color.fill + '">' + cls.icon + '</span>';
    html += '<span class="av-hud-name">' + cls.name + ' Lv.' + av.level + '</span>';
    html += '<div class="av-hud-bars">';
    var hpPct = Math.round((av.hp / av.maxHp) * 100);
    html += '<div class="av-hud-bar"><div class="av-hud-fill hp" style="width:' + hpPct + '%"></div><span>' + av.hp + '/' + av.maxHp + '</span></div>';
    var xpPct = av.xpToNext > 0 ? Math.round((av.xp / av.xpToNext) * 100) : 100;
    html += '<div class="av-hud-bar"><div class="av-hud-fill xp" style="width:' + xpPct + '%"></div><span>XP ' + av.xp + '/' + av.xpToNext + '</span></div>';
    html += '</div></div>';

    // Ability buttons
    html += '<div class="av-hud-abilities">';
    for (var i = 0; i < cls.abilities.length; i++) {
        var ab = cls.abilities[i];
        var unlocked = av.level >= ab.lvl;
        var cd = (av.abilityCooldowns && av.abilityCooldowns[ab.id]) || 0;
        var onCd = cd > 0;
        var btnCls = 'av-ability-btn' + (unlocked ? '' : ' locked') + (onCd ? ' on-cd' : '') + (ab.type === 'passive' ? ' passive' : '');
        html += '<button class="' + btnCls + '" data-slot="' + i + '" title="' + ab.name + ': ' + ab.desc + '">';
        html += '<span class="av-ability-key">' + (i + 1) + '</span>';
        html += '<span class="av-ability-icon">' + ab.icon + '</span>';
        if (onCd) html += '<span class="av-ability-cd">' + cd + '</span>';
        if (!unlocked) html += '<span class="av-ability-lock">Lv.' + ab.lvl + '</span>';
        html += '</button>';
    }
    html += '</div>';

    // Special attack button (integrated, not floating)
    if (typeof SPECIAL_DEFS !== 'undefined' && typeof _specialState !== 'undefined') {
        var specDef = SPECIAL_DEFS[av.avatarClass];
        if (specDef) {
            html += '<div class="av-special-separator"></div>';
            var specCd = _specialState.cooldown || 0;
            var specCharging = _specialState.phase === 'charging';
            var specActive = _specialState.phase === 'active' || _specialState.phase === 'targeting';
            var specCls = 'av-special-btn' + (specCd > 0 ? ' on-cd' : '') + (specCharging || specActive ? ' active' : '');
            html += '<div class="' + specCls + '" title="' + specDef.name + ': ' + specDef.desc + '">';
            html += '<span class="av-special-key">RMB</span>';
            html += '<span class="av-special-icon">' + specDef.icon + '</span>';
            if (specCd > 0) html += '<span class="av-special-cd">' + specCd + '</span>';
            var totalRanks = (typeof _getTotalRanksSpent === 'function') ? _getTotalRanksSpent() : 0;
            if (totalRanks > 0) html += '<span class="av-special-stars">' + '\u2605'.repeat(Math.min(totalRanks, 8)) + '</span>';
            if (specCharging) {
                var maxC = specDef.maxChargeTime;
                if (av.avatarClass === 'guerriero' && typeof _getUpgradeBonus === 'function')
                    maxC = Math.max(1, maxC - _getUpgradeBonus('guerriero', 'chargeSpeedBonus'));
                var cpct = Math.min(100, Math.round((_specialState.chargeTime / maxC) * 100));
                html += '<div class="av-special-charge"><div class="av-special-charge-fill" style="width:' + cpct + '%"></div></div>';
            }
            if (_specialState.phase === 'active' && av.avatarClass === 'stregone') {
                var maxDur = specDef.maxChargeTime + ((typeof _getUpgradeBonus === 'function') ? _getUpgradeBonus('stregone', 'durationBonus') : 0);
                var apct = Math.round((_specialState.activeTime / maxDur) * 100);
                html += '<div class="av-special-charge channel"><div class="av-special-charge-fill" style="width:' + (100 - apct) + '%"></div></div>';
            }
            html += '</div>';
        }
    }

    hud.innerHTML = html;

    // Click handlers for ability buttons
    if (!hud._delegated) {
        hud._delegated = true;
        hud.addEventListener('click', function(e) {
            var btn = e.target.closest ? e.target.closest('.av-ability-btn') : null;
            if (!btn || btn.classList.contains('locked')) return;
            var slot = parseInt(btn.getAttribute('data-slot'));
            if (!isNaN(slot)) avatarCastAbility(slot);
        });
    }
}
