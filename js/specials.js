// ============================================================
// LOTA AUTO CHESS — specials.js — Avatar Special Attacks
// Hold right-click during combat to charge/activate class-specific
// special attack.  Each class has a unique mechanic.
// ============================================================

// ════════════════════════════════════════════════════════════
//  UPGRADE TREE — Skill Points (SP) earned on avatar level-up
//  Each class has 6 upgrade nodes, each with up to 5 ranks.
//  Player spends SP in a dedicated panel during planning phase.
// ════════════════════════════════════════════════════════════

// SP granted per avatar level (cumulative)
var SP_PER_LEVEL = 1; // 1 SP per level → 15 SP max at level 15

// ── Upgrade trees per class ─────────────────────────────────
// Each node: id, name, icon, maxRank, effect description per rank, stat key
var SPECIAL_UPGRADES = {
    guerriero: {
        id: 'carica_devastante', name: 'Carica Devastante', icon: '🐂',
        nodes: [
            { id: 'g_dmg',      name: 'Forza Bruta',      icon: '💥', maxRank: 5, desc: '+25% danno per rango',      perRank: { dmgBonus: 0.25 } },
            { id: 'g_dist',     name: 'Slancio',          icon: '💨', maxRank: 5, desc: '+1 distanza carica per rango', perRank: { distBonus: 1 } },
            { id: 'g_cd',       name: 'Recupero Rapido',  icon: '⏱', maxRank: 3, desc: '-2 tick cooldown per rango',  perRank: { cdReduction: 2 } },
            { id: 'g_width',    name: 'Impatto Largo',    icon: '🌊', maxRank: 3, desc: '+0.3 larghezza percorso',    perRank: { widthBonus: 0.3 } },
            { id: 'g_stun',     name: 'Colpo Stordente',  icon: '⚡', maxRank: 3, desc: '+1 tick stun per rango',     perRank: { stunBonus: 1 } },
            { id: 'g_charge',   name: 'Carica Veloce',    icon: '🏃', maxRank: 3, desc: '-0.3s tempo carica massima', perRank: { chargeSpeedBonus: 0.3 } },
        ]
    },
    stratega: {
        id: 'pioggia_frecce', name: 'Pioggia di Frecce', icon: '🏹',
        nodes: [
            { id: 's_dmg',     name: 'Punte Affilate',    icon: '🗡', maxRank: 5, desc: '+20% danno per onda',        perRank: { dmgBonus: 0.20 } },
            { id: 's_radius',  name: 'Area Estesa',       icon: '⭕', maxRank: 4, desc: '+1 raggio area per rango',   perRank: { radiusBonus: 1 } },
            { id: 's_waves',   name: 'Ondate Extra',      icon: '🌧', maxRank: 4, desc: '+1 ondata di frecce',       perRank: { wavesBonus: 1 } },
            { id: 's_cd',      name: 'Ricarica Tattica',  icon: '⏱', maxRank: 3, desc: '-2 tick cooldown per rango', perRank: { cdReduction: 2 } },
            { id: 's_slow',    name: 'Frecce Frenanti',   icon: '🧊', maxRank: 3, desc: 'Slow 20% per 1 tick (+1/rango)', perRank: { slowDuration: 1 } },
            { id: 's_crit',    name: 'Mira Letale',       icon: '🎯', maxRank: 3, desc: '+10% crit chance per rango', perRank: { critBonus: 0.10 } },
        ]
    },
    mistico: {
        id: 'totem_ancestrale', name: 'Totem Ancestrale', icon: '🗿',
        nodes: [
            { id: 'm_dmg',      name: 'Furia Ancestrale', icon: '💥', maxRank: 5, desc: '+20% danno totem per rango',    perRank: { dmgBonus: 0.20 } },
            { id: 'm_dur',      name: 'Legame Eterno',    icon: '⏳', maxRank: 5, desc: '+1.5s durata per rango',        perRank: { durationBonus: 1.5 } },
            { id: 'm_range',    name: 'Vista Ancestrale', icon: '👁', maxRank: 4, desc: '+1 raggio attacco per rango',   perRank: { rangeBonus: 1 } },
            { id: 'm_cd',       name: 'Richiamo Rapido',  icon: '⏱', maxRank: 3, desc: '-3 tick cooldown per rango',    perRank: { cdReduction: 3 } },
            { id: 'm_count',    name: 'Totem Gemello',    icon: '🗿', maxRank: 2, desc: '+1 totem attivo per rango',     perRank: { maxTotems: 1 } },
            { id: 'm_heal',     name: 'Totem Curativo',   icon: '💚', maxRank: 3, desc: 'Totem cura alleati vicini 2%HP/s per rango', perRank: { healPct: 0.02 } },
        ]
    },
    stregone: {
        id: 'marchio_arcano', name: 'Marchio Arcano', icon: '🔮',
        nodes: [
            { id: 'w_dmg',      name: 'Potenza Arcana',   icon: '💥', maxRank: 5, desc: '+25% danno per rango',       perRank: { dmgBonus: 0.25 } },
            { id: 'w_radius',   name: 'Espansione',       icon: '⭕', maxRank: 4, desc: '+1 raggio marchio',          perRank: { radiusBonus: 1 } },
            { id: 'w_dur',      name: 'Concentrazione',   icon: '⏳', maxRank: 4, desc: '-0.3s carica massima',       perRank: { chargeSpeedBonus: 0.3 } },
            { id: 'w_cd',       name: 'Flusso Arcano',    icon: '⏱', maxRank: 3, desc: '-2 tick cooldown per rango',  perRank: { cdReduction: 2 } },
            { id: 'w_cost',     name: 'Autocontrollo',    icon: '🛡', maxRank: 3, desc: '-0.5% costo HP/s per rango', perRank: { costReduction: 0.005 } },
            { id: 'w_burn',     name: 'Ustione',          icon: '🩸', maxRank: 3, desc: 'Nemici bruciati: 3% HP/s per 2s (+1s/rango)', perRank: { burnDuration: 1 } },
        ]
    },
};

// ── Special Attack Base Definitions ─────────────────────────
var SPECIAL_DEFS = {
    guerriero: {
        id: 'carica_devastante', name: 'Carica Devastante', icon: '🐂',
        desc: 'Carica in avanti travolgendo i nemici. Tieni premuto per caricare!',
        type: 'charge_release',
        maxChargeTime: 3.0,
        cooldownBase: 18,
        levels: [
            { minCharge: 0.3, dist: 3, dmgMult: 1.5, knockback: 0, stun: 0,   label: 'Carica Debole'  },
            { minCharge: 1.2, dist: 5, dmgMult: 2.5, knockback: 2, stun: 0,   label: 'Carica Media'   },
            { minCharge: 2.5, dist: 7, dmgMult: 4.0, knockback: 3, stun: 1,   label: 'Carica Massima' },
        ],
    },
    stratega: {
        id: 'pioggia_frecce', name: 'Pioggia di Frecce', icon: '🏹',
        desc: 'Evoca una pioggia di frecce in un\'area selezionata.',
        type: 'area_target',
        maxChargeTime: 0.5,
        cooldownBase: 14,
        aoeRadius: 2,
        dmgMult: 1.0,
        waves: 3,
        waveDuration: 0.5,
    },
    mistico: {
        id: 'totem_ancestrale', name: 'Totem Ancestrale', icon: '🗿',
        desc: 'Evoca un totem che attacca i nemici nel raggio.',
        type: 'area_target',
        maxChargeTime: 0.4,
        cooldownBase: 20,
        totemDuration: 6,
        totemRange: 3,
        totemDmgMult: 0.6,
        totemAtkSpeed: 0.8,
        totemHpMult: 0.35,
        maxTotems: 1,
    },
    stregone: {
        id: 'marchio_arcano', name: 'Marchio Arcano', icon: '🔮',
        desc: 'Carica un marchio magico sul terreno. Rilascia per scatenare un\'emissione arcana verso l\'alto!',
        type: 'charge_release',
        maxChargeTime: 3.0,
        cooldownBase: 12,
        aoeRadius: 2,
        levels: [
            { minCharge: 0.3, dmgMult: 1.5, label: 'Marchio Debole'   },
            { minCharge: 1.2, dmgMult: 3.0, label: 'Marchio Potente'  },
            { minCharge: 2.5, dmgMult: 5.0, label: 'Marchio Supremo', stun: 1 },
        ],
    },
};

// ── Player upgrade state (persists across rounds) ───────────
var _specialUpgrades = {}; // nodeId → rank (0 = not purchased)
var _specialSP = 0;        // available skill points
var _specialSPTotal = 0;   // total earned

// ── Computed bonus from upgrades ────────────────────────────
function _getUpgradeBonus(classId, statKey) {
    var tree = SPECIAL_UPGRADES[classId];
    if (!tree) return 0;
    var total = 0;
    for (var i = 0; i < tree.nodes.length; i++) {
        var node = tree.nodes[i];
        var rank = _specialUpgrades[node.id] || 0;
        if (rank > 0 && node.perRank[statKey] !== undefined) {
            total += node.perRank[statKey] * rank;
        }
    }
    return total;
}

function _getEffectiveCooldown(classId) {
    var def = SPECIAL_DEFS[classId];
    if (!def) return 20;
    return Math.max(3, def.cooldownBase - _getUpgradeBonus(classId, 'cdReduction'));
}

function _getTotalRanksSpent() {
    var total = 0;
    for (var nid in _specialUpgrades) {
        total += _specialUpgrades[nid] || 0;
    }
    return total;
}

// ── SP management ───────────────────────────────────────────
function grantSpecialSP(amount) {
    _specialSP += amount;
    _specialSPTotal += amount;
}

function checkSpecialUpgrade(avatarLevel) {
    // Grant 1 SP per level (called from avatar level-up)
    grantSpecialSP(SP_PER_LEVEL);
    var av = players[0] && players[0].avatar;
    var cls = av ? av.avatarClass : null;
    var def = cls ? SPECIAL_DEFS[cls] : null;
    if (def && typeof showToast === 'function') {
        showToast(def.icon + ' +1 Punto Speciale! (' + _specialSP + ' disponibili) — Potenzia nel pannello Avatar', 'skill', '⬆');
    }
}

function purchaseUpgrade(nodeId) {
    if (_specialSP <= 0) return false;

    // Find the node
    var av = (typeof players !== 'undefined' && players[0]) ? players[0].avatar : null;
    if (!av) return false;
    var tree = SPECIAL_UPGRADES[av.avatarClass];
    if (!tree) return false;

    var node = null;
    for (var i = 0; i < tree.nodes.length; i++) {
        if (tree.nodes[i].id === nodeId) { node = tree.nodes[i]; break; }
    }
    if (!node) return false;

    var currentRank = _specialUpgrades[nodeId] || 0;
    if (currentRank >= node.maxRank) return false;

    _specialUpgrades[nodeId] = currentRank + 1;
    _specialSP--;

    if (typeof showToast === 'function') {
        showToast(node.icon + ' ' + node.name + ' Rango ' + (currentRank + 1) + '/' + node.maxRank, 'success', node.icon);
    }
    return true;
}

// ── State ───────────────────────────────────────────────────
var _specialState = {
    phase: 'idle',
    classId: null,
    chargeTime: 0,
    activeTime: 0,
    channelTickTimer: 0,
    cooldown: 0,
    targetRow: -1,
    targetCol: -1,
    targetValid: false,
    mouseX: 0,
    mouseY: 0,
};

var _activeTotems = [];
var _activeArrowRains = [];

// ── Helpers ─────────────────────────────────────────────────
function _getAvatarForSpecial() {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return null;
    if (typeof players === 'undefined' || !players[0]) return null;
    var p = players[0];
    if (!p.avatar || !p.avatar.alive) return null;
    if (typeof combatUnits !== 'undefined') {
        for (var i = 0; i < combatUnits.length; i++) {
            if (combatUnits[i].isAvatar && combatUnits[i].owner === 0 && combatUnits[i].alive) {
                return combatUnits[i];
            }
        }
    }
    return null;
}

function _getSpecialDef(classId) { return SPECIAL_DEFS[classId] || null; }

function tickSpecialCooldown() {
    if (_specialState.cooldown > 0) _specialState.cooldown--;
}

// ── Input Handling ──────────────────────────────────────────
var _specialRMBDown = false;
var _specialRMBDownTime = 0;

function initSpecialInput() {
    window.addEventListener('mousedown', function(e) {
        if (e.button !== 2) return;
        if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
        var avatar = _getAvatarForSpecial();
        if (!avatar) return;

        _specialRMBDown = true;
        _specialRMBDownTime = performance.now();
        _specialState.mouseX = e.clientX;
        _specialState.mouseY = e.clientY;

        if (_specialState.cooldown > 0) {
            var def = _getSpecialDef(avatar.avatarClass);
            if (typeof showToast === 'function')
                showToast((def ? def.icon + ' ' : '') + 'Speciale in cooldown (' + _specialState.cooldown + ')', 'warning', '!');
            _specialRMBDown = false;
            return;
        }

        _specialState.classId = avatar.avatarClass;
        var def = _getSpecialDef(avatar.avatarClass);
        if (!def) return;

        if (def.type === 'hold_channel') {
            _specialState.phase = 'active';
            _specialState.chargeTime = 0;
            _specialState.activeTime = 0;
            _specialState.channelTickTimer = 0;
            if (typeof showToast === 'function') showToast(def.icon + ' ' + def.name + '!', 'danger', def.icon);
            if (typeof vfxSpecialStart === 'function') vfxSpecialStart(avatar, _specialState.classId);
        } else if (def.type === 'charge_release') {
            _specialState.phase = 'charging';
            _specialState.chargeTime = 0;
            if (typeof vfxSpecialStart === 'function') vfxSpecialStart(avatar, _specialState.classId);
        } else if (def.type === 'area_target') {
            _specialState.phase = 'targeting';
            _specialState.chargeTime = 0;
            _specialState.targetRow = -1;
            _specialState.targetCol = -1;
            if (typeof vfxSpecialStart === 'function') vfxSpecialStart(avatar, avatar.avatarClass);
        }
    });

    window.addEventListener('mouseup', function(e) {
        if (e.button !== 2) return;
        if (!_specialRMBDown) return;
        _specialRMBDown = false;

        // ── Stratega combo finisher: right-click after 2 left clicks → arrow storm ──
        var _sAvatar = _getAvatarForSpecial();
        if (_sAvatar && _sAvatar.avatarClass === 'stratega'
            && typeof _avatarComboStep !== 'undefined' && _avatarComboStep === 2
            && typeof avatarComboFinisher === 'function') {
            _cancelSpecial();
            avatarComboFinisher();
            return;
        }

        var holdTime = (performance.now() - _specialRMBDownTime) / 1000;
        var avatar = _sAvatar;
        var classId = _specialState.classId;
        var def = classId ? _getSpecialDef(classId) : null;

        if (holdTime < 0.25 && _specialState.phase !== 'active') {
            _cancelSpecial();
            if (avatar && typeof _screenToCell === 'function') {
                var cell = _screenToCell(e.clientX, e.clientY);
                if (cell && typeof combatUnits !== 'undefined') {
                    for (var i = 0; i < combatUnits.length; i++) {
                        var cu = combatUnits[i];
                        if (cu.alive && cu.owner !== 0 && cu.row === cell.r && cu.col === cell.c) {
                            if (typeof avatarSetTarget === 'function') avatarSetTarget(cu.id);
                            return;
                        }
                    }
                }
                if (avatar) avatar.targetUnitId = null;
            }
            return;
        }

        if (!avatar || !def) { _cancelSpecial(); return; }

        if (def.type === 'charge_release' && _specialState.phase === 'charging') {
            if (classId === 'stregone') _executeStregoneMarchio(avatar, def);
            else _executeGuerrieroCharge(avatar, def);
        } else if (def.type === 'area_target' && _specialState.phase === 'targeting') {
            if (_specialState.targetValid) {
                if (classId === 'stratega') _executeStrategaArrows(avatar, def);
                else if (classId === 'mistico') _executeMisticoTotem(avatar, def);
            } else {
                if (typeof showToast === 'function') showToast('Posizione non valida!', 'warning', '!');
            }
        } else if (def.type === 'hold_channel' && _specialState.phase === 'active') {
            // hold_channel end — currently unused (stregone migrated to charge_release)
        }

        if (_specialState.phase !== 'idle') _finishSpecial();
    });

    window.addEventListener('mousemove', function(e) {
        _specialState.mouseX = e.clientX;
        _specialState.mouseY = e.clientY;
    });

    window.addEventListener('contextmenu', function(e) {
        if (typeof gamePhase !== 'undefined' && gamePhase === PHASE_COMBAT) {
            var avatar = _getAvatarForSpecial();
            if (avatar) e.preventDefault();
        }
    });
}

function _cancelSpecial() {
    if (typeof vfxSpecialEnd === 'function') vfxSpecialEnd();
    _specialState.phase = 'idle';
    _specialState.chargeTime = 0;
    _specialState.activeTime = 0;
}

function _finishSpecial() {
    var classId = _specialState.classId;
    _specialState.cooldown = _getEffectiveCooldown(classId);
    _specialState.phase = 'idle';
    _specialState.chargeTime = 0;
    _specialState.activeTime = 0;
    if (typeof vfxSpecialEnd === 'function') vfxSpecialEnd();
}

// ── Per-Frame Update ────────────────────────────────────────
function updateSpecials(dt) {
    var avatar = _getAvatarForSpecial();

    // Targeting
    if (_specialState.phase === 'targeting' && avatar) {
        if (typeof _screenToCell === 'function') {
            var cell = _screenToCell(_specialState.mouseX, _specialState.mouseY);
            if (cell) {
                _specialState.targetRow = cell.r;
                _specialState.targetCol = cell.c;
                var dist = Math.max(Math.abs(avatar.row - cell.r), Math.abs(avatar.col - cell.c));
                var maxRange = _specialState.classId === 'mistico' ? 4 : 6;
                _specialState.targetValid = dist <= maxRange && typeof isValidCell === 'function' && isValidCell(cell.r, cell.c);
            }
        }
        _specialState.chargeTime += dt;
        if (typeof vfxSpecialTargeting === 'function') {
            var classId = _specialState.classId;
            var def = _getSpecialDef(classId);
            var radius = 0;
            if (classId === 'stratega') {
                radius = def.aoeRadius + _getUpgradeBonus('stratega', 'radiusBonus');
            } else if (classId === 'mistico') {
                radius = def.totemRange + _getUpgradeBonus('mistico', 'rangeBonus');
            }
            vfxSpecialTargeting(_specialState.targetRow, _specialState.targetCol, radius, _specialState.targetValid, classId);
        }
    }

    // Charging (Guerriero / Stregone)
    if (_specialState.phase === 'charging' && avatar) {
        var chClassId = _specialState.classId;
        var chDef = _getSpecialDef(chClassId);
        if (chDef) {
            var maxCharge = chDef.maxChargeTime - _getUpgradeBonus(chClassId, 'chargeSpeedBonus');
            maxCharge = Math.max(1.0, maxCharge);
            _specialState.chargeTime += dt;
            if (_specialState.chargeTime > maxCharge) _specialState.chargeTime = maxCharge;
            if (chClassId === 'stregone' && typeof vfxMarchioCharging === 'function') {
                vfxMarchioCharging(avatar, _specialState.chargeTime, maxCharge);
            } else if (typeof vfxSpecialCharging === 'function') {
                vfxSpecialCharging(avatar, _specialState.chargeTime, maxCharge);
            }
        }
    }

    _updateTotems(dt);
    _updateArrowRains(dt);
}

// ════════════════════════════════════════════════════════════
//  GUERRIERO — CHARGE
// ════════════════════════════════════════════════════════════
function _executeGuerrieroCharge(avatar, def) {
    var ct = _specialState.chargeTime;
    var maxCharge = def.maxChargeTime - _getUpgradeBonus('guerriero', 'chargeSpeedBonus');
    maxCharge = Math.max(1.0, maxCharge);

    // Scale charge thresholds
    var tier = null;
    for (var i = def.levels.length - 1; i >= 0; i--) {
        var needed = def.levels[i].minCharge * (maxCharge / def.maxChargeTime);
        if (ct >= needed) { tier = def.levels[i]; break; }
    }
    if (!tier) {
        if (typeof showToast === 'function') showToast('Carica troppo debole!', 'warning', '!');
        return;
    }

    var dmgMult = tier.dmgMult + _getUpgradeBonus('guerriero', 'dmgBonus');
    var dist = tier.dist + _getUpgradeBonus('guerriero', 'distBonus');
    var stunTicks = tier.stun + _getUpgradeBonus('guerriero', 'stunBonus');
    var pathWidth = 0.8 + _getUpgradeBonus('guerriero', 'widthBonus');

    var facing = (typeof _camOrbitAngle !== 'undefined') ? (_camOrbitAngle + Math.PI) : 0;
    var TILE = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var dx = Math.sin(facing), dz = Math.cos(facing);

    var hitEnemies = [];
    if (typeof combatUnits !== 'undefined') {
        for (var i = 0; i < combatUnits.length; i++) {
            var e = combatUnits[i];
            if (!e.alive || e.owner === avatar.owner) continue;
            var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
            var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
            var relX = ex - avX, relZ = ez - avZ;
            var proj = relX * dx + relZ * dz;
            if (proj < 0 || proj > dist * TILE) continue;
            var perpDist = Math.abs(relX * dz - relZ * dx);
            if (perpDist < TILE * pathWidth) {
                hitEnemies.push({ unit: e, proj: proj, x: ex, z: ez });
            }
        }
    }

    hitEnemies.sort(function(a, b) { return a.proj - b.proj; });

    var totalDmg = Math.round(avatar.atk * dmgMult);
    var AK = typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50;
    for (var i = 0; i < hitEnemies.length; i++) {
        var he = hitEnemies[i];
        var dmg = Math.round(totalDmg * (AK / ((he.unit.armor || 0) + AK)));
        var isCrit = Math.random() < (avatar.critChance || 0.1);
        if (isCrit) dmg = Math.round(dmg * 1.5);
        he.unit.hp -= dmg;
        if (he.unit.hp <= 0) { he.unit.hp = 0; he.unit.alive = false; }
        if (typeof addDamageNumber === 'function') addDamageNumber(he.unit, dmg, isCrit ? 'crit' : 'physical');
        if (tier.knockback > 0) {
            var kbRow = he.unit.row + Math.round(dz * tier.knockback);
            var kbCol = he.unit.col + Math.round(dx * tier.knockback);
            if (typeof isValidCell === 'function' && isValidCell(kbRow, kbCol)) {
                // Update grid: clear old cell, set new cell
                if (typeof _combatGrid !== 'undefined' && _combatGrid) {
                    _combatGrid[he.unit.row][he.unit.col] = null;
                    if (_combatGrid[kbRow][kbCol] === null) {
                        _combatGrid[kbRow][kbCol] = he.unit.id;
                        he.unit.row = kbRow; he.unit.col = kbCol;
                    } else {
                        _combatGrid[he.unit.row][he.unit.col] = he.unit.id; // restore
                    }
                } else {
                    he.unit.row = kbRow; he.unit.col = kbCol;
                }
            }
        }
        if (stunTicks > 0) {
            he.unit.effects.push({ type: 'stun', value: 0, ticksLeft: stunTicks, stacking: 'refresh' });
        }
    }

    // Move avatar
    var endX = avX + dx * dist * TILE, endZ = avZ + dz * dist * TILE;
    if (typeof cellToWorld === 'function') {
        var endR = Math.floor(endZ / TILE), endC = Math.floor(endX / TILE);
        if (typeof isValidCell === 'function' && isValidCell(endR, endC)) {
            avatar.row = endR; avatar.col = endC;
        }
    }

    if (typeof vfxGuerrieroCharge === 'function') vfxGuerrieroCharge(avX, TILE_TOP, avZ, endX, TILE_TOP, endZ, ct / maxCharge, hitEnemies);
    if (typeof triggerScreenShake === 'function') triggerScreenShake(3.0 + ct * 2, 0.25);
    if (typeof showToast === 'function') showToast('🐂 ' + tier.label + '! ' + hitEnemies.length + ' colpiti', hitEnemies.length > 0 ? 'danger' : 'info', '🐂');
}

// ════════════════════════════════════════════════════════════
//  STRATEGA — ARROW RAIN
// ════════════════════════════════════════════════════════════
function _executeStrategaArrows(avatar, def) {
    var radius = def.aoeRadius + _getUpgradeBonus('stratega', 'radiusBonus');
    var dmgMult = def.dmgMult + _getUpgradeBonus('stratega', 'dmgBonus');
    var waves = def.waves + _getUpgradeBonus('stratega', 'wavesBonus');
    var slowDur = _getUpgradeBonus('stratega', 'slowDuration');
    var critBonus = _getUpgradeBonus('stratega', 'critBonus');

    _activeArrowRains.push({
        row: _specialState.targetRow, col: _specialState.targetCol,
        radius: radius, dmgMult: dmgMult,
        avatarAtk: avatar.atk,
        avatarCrit: (avatar.critChance || 0.1) + critBonus,
        owner: avatar.owner,
        wavesLeft: waves, waveTimer: 0,
        waveInterval: def.waveDuration,
        totalTime: 0, slowDur: slowDur,
    });

    if (typeof vfxArrowRainStart === 'function') vfxArrowRainStart(_specialState.targetRow, _specialState.targetCol, radius, waves * def.waveDuration);
    if (typeof showToast === 'function') showToast('🏹 ' + def.name + '! ' + waves + ' ondate, raggio ' + radius, 'danger', '🏹');
}

function _updateArrowRains(dt) {
    for (var i = _activeArrowRains.length - 1; i >= 0; i--) {
        var rain = _activeArrowRains[i];
        rain.totalTime += dt;
        rain.waveTimer += dt;
        if (rain.waveTimer >= rain.waveInterval && rain.wavesLeft > 0) {
            rain.waveTimer -= rain.waveInterval;
            rain.wavesLeft--;
            _arrowRainWave(rain);
        }
        if (rain.wavesLeft <= 0 && rain.waveTimer > 0.3) _activeArrowRains.splice(i, 1);
    }
}

function _arrowRainWave(rain) {
    if (typeof combatUnits === 'undefined') return;
    var AK = typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50;
    for (var i = 0; i < combatUnits.length; i++) {
        var e = combatUnits[i];
        if (!e.alive || e.owner === rain.owner) continue;
        var dist = Math.max(Math.abs(e.row - rain.row), Math.abs(e.col - rain.col));
        if (dist <= rain.radius) {
            var dmg = Math.round(rain.avatarAtk * rain.dmgMult);
            var isCrit = Math.random() < rain.avatarCrit;
            if (isCrit) dmg = Math.round(dmg * 1.5);
            dmg = Math.round(dmg * (AK / ((e.armor || 0) + AK)));
            e.hp -= dmg;
            if (e.hp <= 0) { e.hp = 0; e.alive = false; }
            if (typeof addDamageNumber === 'function') addDamageNumber(e, dmg, isCrit ? 'crit' : 'physical');
            // Slow from upgrade
            if (rain.slowDur > 0) {
                e.effects.push({ type: 'speed_reduction', value: 0.20, ticksLeft: rain.slowDur, stacking: 'refresh' });
            }
            if (typeof vfxArrowRainHit === 'function') {
                var ex = (e._smoothWX !== undefined) ? e._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).x : e.col);
                var ez = (e._smoothWZ !== undefined) ? e._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(e.row, e.col).z : e.row);
                vfxArrowRainHit(ex, ez);
            }
        }
    }
    if (typeof vfxArrowRainWave === 'function') vfxArrowRainWave(rain.row, rain.col, rain.radius);
}

// ════════════════════════════════════════════════════════════
//  MISTICO — TOTEM
// ════════════════════════════════════════════════════════════
function _executeMisticoTotem(avatar, def) {
    var maxTotems = def.maxTotems + _getUpgradeBonus('mistico', 'maxTotems');

    // Remove oldest if over limit
    while (_activeTotems.length >= maxTotems) {
        var old = _activeTotems.shift();
        if (typeof vfxTotemDestroy === 'function') vfxTotemDestroy(old.id);
    }

    var totem = {
        id: 'totem_' + Date.now(),
        row: _specialState.targetRow, col: _specialState.targetCol,
        owner: avatar.owner,
        hp: Math.round(avatar.maxHp * def.totemHpMult),
        maxHp: Math.round(avatar.maxHp * def.totemHpMult),
        range: def.totemRange + _getUpgradeBonus('mistico', 'rangeBonus'),
        dmg: Math.round(avatar.atk * (def.totemDmgMult + _getUpgradeBonus('mistico', 'dmgBonus'))),
        atkSpeed: def.totemAtkSpeed,
        atkTimer: 0,
        duration: def.totemDuration + _getUpgradeBonus('mistico', 'durationBonus'),
        healPct: _getUpgradeBonus('mistico', 'healPct'),
        healTimer: 0,
        alive: true,
        realTimer: 0,
    };

    _activeTotems.push(totem);
    if (typeof vfxTotemSpawn === 'function') vfxTotemSpawn(totem.row, totem.col, totem.id);
    if (typeof showToast === 'function') showToast('🗿 Totem evocato! (' + _activeTotems.length + '/' + maxTotems + ')', 'success', '🗿');
}

function _updateTotems(dt) {
    if (typeof combatUnits === 'undefined') return;
    var AK = typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50;

    for (var i = _activeTotems.length - 1; i >= 0; i--) {
        var totem = _activeTotems[i];
        if (!totem.alive) {
            if (typeof vfxTotemDestroy === 'function') vfxTotemDestroy(totem.id);
            _activeTotems.splice(i, 1);
            continue;
        }

        totem.realTimer += dt;
        if (totem.realTimer >= totem.duration) {
            totem.alive = false;
            if (typeof vfxTotemDestroy === 'function') vfxTotemDestroy(totem.id);
            _activeTotems.splice(i, 1);
            continue;
        }

        // Attack
        totem.atkTimer += dt;
        if (totem.atkTimer >= totem.atkSpeed) {
            totem.atkTimer -= totem.atkSpeed;
            var bestTarget = null, bestDist = Infinity;
            for (var j = 0; j < combatUnits.length; j++) {
                var e = combatUnits[j];
                if (!e.alive || e.owner === totem.owner) continue;
                var dist = Math.max(Math.abs(e.row - totem.row), Math.abs(e.col - totem.col));
                if (dist <= totem.range && dist < bestDist) { bestTarget = e; bestDist = dist; }
            }
            if (bestTarget) {
                var dmg = Math.round(totem.dmg * (AK / ((bestTarget.armor || 0) + AK)));
                bestTarget.hp -= dmg;
                if (bestTarget.hp <= 0) { bestTarget.hp = 0; bestTarget.alive = false; }
                if (typeof addDamageNumber === 'function') addDamageNumber(bestTarget, dmg, 'magic');
                if (typeof vfxTotemAttack === 'function') vfxTotemAttack(totem.row, totem.col, bestTarget);
            }
        }

        // Healing aura (from upgrade)
        if (totem.healPct > 0) {
            totem.healTimer += dt;
            if (totem.healTimer >= 1.0) {
                totem.healTimer -= 1.0;
                for (var j = 0; j < combatUnits.length; j++) {
                    var ally = combatUnits[j];
                    if (!ally.alive || ally.owner !== totem.owner) continue;
                    var dist = Math.max(Math.abs(ally.row - totem.row), Math.abs(ally.col - totem.col));
                    if (dist <= totem.range && ally.hp < ally.maxHp) {
                        var heal = Math.round(ally.maxHp * totem.healPct);
                        ally.hp = Math.min(ally.maxHp, ally.hp + heal);
                        if (typeof addDamageNumber === 'function') addDamageNumber(ally, heal, 'heal');
                    }
                }
            }
        }

        if (typeof vfxTotemIdle === 'function') vfxTotemIdle(totem, dt);
    }
}

// ════════════════════════════════════════════════════════════
//  STREGONE — FIRE STORM
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  STREGONE — MARCHIO ARCANO (charge + release ground mark)
// ════════════════════════════════════════════════════════════
function _executeStregoneMarchio(avatar, def) {
    var ct = _specialState.chargeTime;
    var maxCharge = def.maxChargeTime - _getUpgradeBonus('stregone', 'chargeSpeedBonus');
    maxCharge = Math.max(1.0, maxCharge);

    // Find tier
    var tier = null;
    for (var i = def.levels.length - 1; i >= 0; i--) {
        var needed = def.levels[i].minCharge * (maxCharge / def.maxChargeTime);
        if (ct >= needed) { tier = def.levels[i]; break; }
    }
    if (!tier) {
        if (typeof showToast === 'function') showToast('Carica troppo debole!', 'warning', '!');
        return;
    }

    var radius = def.aoeRadius + _getUpgradeBonus('stregone', 'radiusBonus');
    var dmgMult = tier.dmgMult + _getUpgradeBonus('stregone', 'dmgBonus');
    var burnDur = _getUpgradeBonus('stregone', 'burnDuration');
    var stunTicks = tier.stun || 0;
    var chargePct = ct / maxCharge;

    var TILE = typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0;
    var AK = typeof ARMOR_K !== 'undefined' ? ARMOR_K : 50;
    var TILE_TOP = typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15;
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);

    // Hit enemies in radius
    var hitCount = 0;
    if (typeof combatUnits !== 'undefined') {
        for (var i = 0; i < combatUnits.length; i++) {
            var e = combatUnits[i];
            if (!e.alive || e.owner === avatar.owner) continue;
            var dist = Math.max(Math.abs(e.row - avatar.row), Math.abs(e.col - avatar.col));
            if (dist <= radius) {
                var dmg = Math.round(avatar.atk * dmgMult);
                var isCrit = Math.random() < (avatar.critChance || 0.1);
                if (isCrit) dmg = Math.round(dmg * 1.5);
                e.hp -= dmg;
                if (e.hp <= 0) { e.hp = 0; e.alive = false; }
                if (typeof addDamageNumber === 'function') addDamageNumber(e, dmg, isCrit ? 'crit' : 'magic');
                if (stunTicks > 0) e.effects.push({ type: 'freeze', value: 0, ticksLeft: stunTicks, stacking: 'refresh' });
                if (burnDur > 0) e.effects.push({ type: 'poison', value: Math.round(e.maxHp * 0.03), ticksLeft: 2 + burnDur, stacking: 'refresh', sourceType: 'burn' });
                hitCount++;
            }
        }
    }

    // VFX: upward emission from ground mark
    if (typeof vfxMarchioRelease === 'function') {
        vfxMarchioRelease(avX, TILE_TOP, avZ, radius * TILE, chargePct);
    }

    if (typeof showToast === 'function') {
        showToast('🔮 ' + tier.label + '!' + (hitCount > 0 ? ' x' + hitCount : ''), hitCount > 0 ? 'danger' : 'warning', '🔮');
    }
    if (typeof triggerScreenShake === 'function') triggerScreenShake(4 + chargePct * 5, 0.28);
    if (typeof triggerScreenFlash === 'function') triggerScreenFlash('#a855f7', 0.15 + chargePct * 0.1);
}

// ── Reset ───────────────────────────────────────────────────
function resetSpecials() {
    _specialState.phase = 'idle';
    _specialState.chargeTime = 0;
    _specialState.activeTime = 0;
    _specialState.channelTickTimer = 0;
    _specialState.cooldown = 0;
    _specialRMBDown = false;
    _activeTotems = [];
    _activeArrowRains = [];
    if (typeof vfxSpecialEnd === 'function') vfxSpecialEnd();
    if (typeof vfxClearAllTotems === 'function') vfxClearAllTotems();
}

// ════════════════════════════════════════════════════════════
//  UPGRADE PANEL UI — rendered inside #special-upgrade-list
//  in the Armata tab of the side panel (planning phase only)
// ════════════════════════════════════════════════════════════
function renderSpecialUpgradePanel() {
    var section = document.getElementById('special-section');
    var listEl  = document.getElementById('special-upgrade-list');
    if (!section || !listEl) return;

    var av = (typeof players !== 'undefined' && players[0]) ? players[0].avatar : null;
    if (!av || typeof gamePhase === 'undefined' || gamePhase !== PHASE_PLANNING) {
        section.style.display = 'none';
        return;
    }

    var classId = av.avatarClass;
    var tree = SPECIAL_UPGRADES[classId];
    var def = SPECIAL_DEFS[classId];
    if (!tree || !def) { section.style.display = 'none'; return; }

    section.style.display = '';

    var html = '';

    // Header with name + SP counter
    html += '<div class="sup-header">';
    html += '<span class="sup-icon">' + def.icon + '</span>';
    html += '<span class="sup-title">' + def.name + '</span>';
    html += '<span class="sup-sp">SP: <b>' + _specialSP + '</b></span>';
    html += '</div>';

    // Upgrade nodes
    html += '<div class="sup-nodes">';
    for (var i = 0; i < tree.nodes.length; i++) {
        var node = tree.nodes[i];
        var rank = _specialUpgrades[node.id] || 0;
        var canBuy = _specialSP > 0 && rank < node.maxRank;
        var isMaxed = rank >= node.maxRank;

        html += '<div class="sup-node' + (isMaxed ? ' maxed' : '') + (canBuy ? ' available' : '') + '" data-node-id="' + node.id + '">';

        // Top row: icon + name + pips
        html += '<div class="sup-node-top">';
        html += '<span class="sup-node-icon">' + node.icon + '</span>';
        html += '<span class="sup-node-name">' + node.name + '</span>';
        html += '<span class="sup-node-ranks">';
        for (var r = 0; r < node.maxRank; r++) {
            html += '<span class="sup-pip' + (r < rank ? ' filled' : '') + '"></span>';
        }
        html += '</span>';
        html += '</div>';

        // Description
        html += '<div class="sup-node-desc">' + node.desc + '</div>';

        // Action
        if (canBuy) {
            html += '<button class="sup-buy-btn" data-node-id="' + node.id + '">' + (rank + 1) + '/' + node.maxRank + ' Potenzia</button>';
        } else if (isMaxed) {
            html += '<span class="sup-maxed-label">MAX</span>';
        }

        html += '</div>';
    }
    html += '</div>';

    // Stats summary
    html += '<div class="sup-stats">';
    html += '<span class="sup-stats-label">CD: ' + _getEffectiveCooldown(classId) + 't</span>';
    var totalSpent = _getTotalRanksSpent();
    html += '<span class="sup-stats-label">' + totalSpent + '/' + _specialSPTotal + ' spesi</span>';
    html += '</div>';

    listEl.innerHTML = html;

    // Event delegation (one-time)
    if (!listEl._delegated) {
        listEl._delegated = true;
        listEl.addEventListener('click', function(e) {
            var btn = e.target.closest ? e.target.closest('.sup-buy-btn') : null;
            if (!btn) {
                var nodeEl = e.target.closest ? e.target.closest('.sup-node.available') : null;
                if (nodeEl) btn = nodeEl;
            }
            if (!btn) return;
            var nodeId = btn.getAttribute('data-node-id');
            if (!nodeId) return;
            if (purchaseUpgrade(nodeId)) {
                renderSpecialUpgradePanel();
                if (typeof updateHUD === 'function' && typeof getHumanPlayer === 'function' && typeof currentRound !== 'undefined')
                    updateHUD(getHumanPlayer(), currentRound);
            }
        });
    }
}

// renderSpecialHUD is no longer needed — the special button is now
// integrated directly into the avatar HUD bar (renderAvatarHUD in avatar.js).
function renderSpecialHUD() { /* no-op */ }
