// ============================================================
// LOTA AUTO CHESS — three-skill-vfx.js — Per-Skill 3D VFX
// Implements vfxForSkill(skillId, caster, target, allUnits)
// called from skills.js executePendingSkill on success
// ============================================================

// Helper: world position from unit grid coords
function _sw(unit, dy) {
    if (!unit || typeof cellToWorld !== 'function') return null;
    var w = cellToWorld(unit.row, unit.col);
    w.y += (dy || 0);
    return w;
}

// Helper: trigger cast animation on the 3D model
function _castAnim(unit, skillId) {
    if (typeof triggerSkillCastAnimation === 'function') {
        triggerSkillCastAnimation(unit.id, skillId);
    }
}

// ============================================================
//  MAIN DISPATCH
// ============================================================
function vfxForSkill(skillId, caster, target, allUnits) {
    if (!caster) return;
    if (typeof threeScene === 'undefined' || !threeScene) return;

    _castAnim(caster, skillId);

    // Spawn persistent skill model (geometry object)
    if (typeof spawnSkillModel === 'function') {
        spawnSkillModel(skillId, caster, target, allUnits);
    }

    var cp = _sw(caster, 0.5);
    var tp = target ? _sw(target, 0.5) : null;
    if (!cp) return;

    switch (skillId) {

        // ===================== BABIDI =====================

        case 'babidi_tangente': {
            if (tp) {
                _projectile3D(cp, tp, '#fbbf24', 10, '#fde047', 12);
                var _tp = tp;
                setTimeout(function() {
                    _burst3D(_tp.x, _tp.y, _tp.z, 10, '#fbbf24', 2.0, 0.4, 'square');
                    _ring3D(_tp.x, _tp.y - 0.2, _tp.z, 0.3, '#fef08a', 8, 0.4);
                }, 150);
            }
            break;
        }

        case 'babidi_bolla': {
            if (tp) {
                _burst3D(tp.x, tp.y, tp.z, 20, '#22c55e', 2.5, 0.7);
                _ring3D(tp.x, tp.y - 0.2, tp.z, 0.5, '#4ade80', 18, 0.6);
                _ring3D(tp.x, tp.y + 0.1, tp.z, 0.8, '#16a34a', 12, 0.5);
                _rising3D(tp.x, tp.y - 0.3, tp.z, 12, '#86efac', 0.8);
            }
            break;
        }

        case 'babidi_contrattazione': {
            if (tp) {
                _projectile3D(cp, tp, '#fbbf24', 14, '#fde047', 8);
                _projectile3D(tp, cp, '#fbbf24', 14, '#fde047', 6);
                _rising3D(cp.x, cp.y - 0.2, cp.z, 6, '#fbbf24', 0.5);
            }
            break;
        }

        case 'babidi_acquario': {
            if (target && tp) {
                _zone3D(target.row, target.col, 1, '#22c55e', 4);
                _burst3D(tp.x, tp.y, tp.z, 25, '#16a34a', 2.0, 0.8);
                _rising3D(tp.x, tp.y - 0.2, tp.z, 15, '#4ade80', 0.9);
                triggerScreenShake(1.5, 0.1);
            }
            break;
        }

        case 'babidi_svalutazione': {
            _burst3D(cp.x, cp.y + 0.5, cp.z, 30, '#ef4444', 3.0, 0.6);
            _ring3D(cp.x, cp.y, cp.z, 1.5, '#ef4444', 24, 0.5);
            triggerScreenFlash('#ef4444', 0.15);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner) {
                        var ep = _sw(u, 0.3);
                        if (ep) _burst3D(ep.x, ep.y, ep.z, 6, '#ef4444', 1.5, 0.4, 'square');
                    }
                }
            }
            break;
        }

        case 'babidi_fuga': {
            _burst3D(cp.x, cp.y, cp.z, 22, '#fbbf24', 3.5, 0.5);
            _ring3D(cp.x, cp.y - 0.1, cp.z, 0.6, '#fde68a', 18, 0.45);
            break;
        }

        case 'babidi_inflazione': {
            triggerScreenFlash('#22c55e', 0.2);
            _ring3D(cp.x, cp.y, cp.z, 2.0, '#16a34a', 28, 0.6);
            _burst3D(cp.x, cp.y + 0.3, cp.z, 20, '#4ade80', 2.5, 0.6);
            break;
        }

        case 'babidi_rete': {
            _ring3D(cp.x, cp.y + 0.2, cp.z, 0.4, '#fbbf24', 16, 0.5);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner === caster.owner && u.id !== caster.id) {
                        var ap = _sw(u, 0.5);
                        if (ap) {
                            for (var s = 0; s < 8; s++) {
                                var frac = s / 8;
                                var lp = cp.clone().lerp(ap, frac);
                                _spawn3D(lp, {x:0,y:0.5,z:0}, '#fbbf24', 0.4, 0.3 + frac * 0.2);
                            }
                            _rising3D(ap.x, ap.y - 0.2, ap.z, 5, '#fbbf24', 0.5);
                        }
                    }
                }
            }
            break;
        }

        case 'babidi_bancarotta': {
            _burst3D(cp.x, cp.y + 0.5, cp.z, 45, '#fbbf24', 5.0, 0.9);
            _ring3D(cp.x, cp.y, cp.z, 1.0, '#fde047', 24, 0.7);
            _ring3D(cp.x, cp.y + 0.3, cp.z, 0.6, '#ffffff', 16, 0.5);
            _rising3D(cp.x, cp.y - 0.2, cp.z, 20, '#fbbf24', 0.8);
            triggerScreenShake(4, 0.3);
            triggerScreenFlash('#fbbf24', 0.25);
            break;
        }

        case 'babidi_monopolio': {
            _rising3D(cp.x, cp.y - 0.2, cp.z, 25, '#fbbf24', 1.0);
            _ring3D(cp.x, cp.y, cp.z, 0.5, '#fde047', 20, 0.6);
            _ring3D(cp.x, cp.y + 0.4, cp.z, 0.3, '#fbbf24', 14, 0.5);
            triggerScreenFlash('#fbbf24', 0.1);
            break;
        }

        // ===================== CARONTE =====================

        case 'caronte_esame': {
            if (tp) {
                _projectile3D(cp, tp, '#60a5fa', 12, '#f0abfc', 10);
                var _tp2 = tp;
                setTimeout(function() {
                    _burst3D(_tp2.x, _tp2.y, _tp2.z, 8, '#f0abfc', 1.5, 0.5, 'square');
                    _ring3D(_tp2.x, _tp2.y - 0.1, _tp2.z, 0.3, '#c084fc', 10, 0.4);
                }, 130);
            }
            break;
        }

        case 'caronte_bocciatura': {
            if (tp) {
                _burst3D(tp.x, tp.y + 0.2, tp.z, 14, '#ef4444', 2.5, 0.5, 'square');
                _ring3D(tp.x, tp.y - 0.1, tp.z, 0.25, '#dc2626', 8, 0.35);
                triggerScreenShake(1.5, 0.1);
            }
            break;
        }

        case 'caronte_lezione': {
            _ring3D(cp.x, cp.y, cp.z, 2.0, '#60a5fa', 30, 0.6);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 1.5, '#93c5fd', 22, 0.5);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner) {
                        var ep = _sw(u, 0.3);
                        if (ep) _ring3D(ep.x, ep.y, ep.z, 0.25, '#60a5fa', 8, 0.4);
                    }
                }
            }
            break;
        }

        case 'caronte_tesi_plus': {
            _rising3D(cp.x, cp.y - 0.1, cp.z, 12, '#c084fc', 0.7);
            _ring3D(cp.x, cp.y + 0.2, cp.z, 0.4, '#a78bfa', 16, 0.5);
            break;
        }

        case 'caronte_teleport': {
            _burst3D(cp.x, cp.y + 0.2, cp.z, 18, '#a78bfa', 3.0, 0.45);
            _ring3D(cp.x, cp.y - 0.1, cp.z, 0.5, '#7c3aed', 16, 0.4);
            if (tp) {
                var _tp3 = tp;
                setTimeout(function() {
                    _burst3D(_tp3.x, _tp3.y + 0.2, _tp3.z, 18, '#a78bfa', 3.0, 0.45);
                    _ring3D(_tp3.x, _tp3.y - 0.1, _tp3.z, 0.5, '#7c3aed', 16, 0.4);
                }, 200);
            }
            break;
        }

        case 'caronte_revisione': {
            if (tp) {
                for (var i = 0; i < 16; i++) {
                    var a = (i / 16) * Math.PI * 2;
                    var r = 0.3;
                    _spawn3D(
                        new THREE.Vector3(tp.x + Math.cos(a) * r, tp.y + 0.2, tp.z + Math.sin(a) * r),
                        { x: -Math.cos(a) * 1.5, y: 0.5, z: -Math.sin(a) * 1.5 },
                        '#60a5fa', 0.5, 0.5
                    );
                }
                _burst3D(tp.x, tp.y + 0.2, tp.z, 10, '#93c5fd', 2.0, 0.5);
            }
            break;
        }

        case 'caronte_plagio': {
            _rising3D(cp.x, cp.y - 0.1, cp.z, 14, '#fbbf24', 0.7);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.45, '#fbbf24', 14, 0.5);
            if (allUnits) {
                var strongest = null, maxAtk = -1;
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner && u.atk > maxAtk) {
                        maxAtk = u.atk; strongest = u;
                    }
                }
                if (strongest) {
                    var sp2 = _sw(strongest, 0.5);
                    if (sp2) _projectile3D(sp2, cp, '#fbbf24', 14, '#fbbf24', 10);
                }
            }
            break;
        }

        case 'caronte_cattedra': {
            if (target) {
                _zone3D(target.row, target.col, 0, '#7c3aed', 4);
                if (tp) {
                    _burst3D(tp.x, tp.y + 0.2, tp.z, 18, '#6d28d9', 2.5, 0.6);
                    _rising3D(tp.x, tp.y - 0.2, tp.z, 10, '#c084fc', 0.7);
                }
                triggerScreenShake(1.5, 0.1);
            }
            break;
        }

        case 'caronte_doppio': {
            var offs = [-0.25, 0.25];
            for (var i = 0; i < 2; i++) {
                var orbPos = cp.clone();
                orbPos.x += offs[i];
                orbPos.y += 0.3;
                if (tp) _projectile3D(orbPos, tp, '#c084fc', 11, '#a855f7', 12);
            }
            _ring3D(cp.x, cp.y, cp.z, 0.3, '#a78bfa', 12, 0.4);
            break;
        }

        case 'caronte_defenestrazione': {
            if (tp) {
                _burst3D(tp.x, tp.y + 0.3, tp.z, 22, '#a78bfa', 4.0, 0.6);
                _ring3D(tp.x, tp.y, tp.z, 0.4, '#7c3aed', 14, 0.5);
                triggerScreenShake(3, 0.2);
                triggerScreenFlash('#a78bfa', 0.15);
            }
            break;
        }

        // ===================== VALERIO =====================

        case 'valerio_scossa': {
            _ring3D(cp.x, cp.y - 0.2, cp.z, 0.5, '#f97316', 20, 0.4);
            _ring3D(cp.x, cp.y - 0.2, cp.z, 1.0, '#ea580c', 24, 0.5);
            _ring3D(cp.x, cp.y - 0.2, cp.z, 1.5, '#c2410c', 28, 0.6);
            _burst3D(cp.x, cp.y, cp.z, 20, '#f97316', 3.0, 0.5);
            triggerScreenShake(3, 0.2);
            break;
        }

        case 'valerio_muro': {
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.4, '#60a5fa', 16, 0.5);
            _ring3D(cp.x, cp.y + 0.5, cp.z, 0.35, '#93c5fd', 12, 0.4);
            _burst3D(cp.x, cp.y + 0.3, cp.z, 14, '#bfdbfe', 1.8, 0.5, 'square');
            break;
        }

        case 'valerio_regen_exp': {
            _burst3D(cp.x, cp.y + 0.2, cp.z, 18, '#22c55e', 2.5, 0.6);
            _rising3D(cp.x, cp.y - 0.2, cp.z, 14, '#4ade80', 0.8);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.4, '#34d399', 12, 0.4);
            break;
        }

        case 'valerio_divorare': {
            if (tp) {
                _burst3D(tp.x, tp.y, tp.z, 16, '#ea580c', 2.5, 0.4);
                _ring3D(tp.x, tp.y - 0.1, tp.z, 0.25, '#dc2626', 10, 0.3);
                _rising3D(cp.x, cp.y, cp.z, 8, '#22c55e', 0.5);
            }
            break;
        }

        case 'valerio_tana': {
            _burst3D(cp.x, cp.y - 0.2, cp.z, 20, '#78716c', 2.0, 0.5);
            _ring3D(cp.x, cp.y - 0.3, cp.z, 0.5, '#57534e', 18, 0.4);
            break;
        }

        case 'valerio_spore': {
            _burst3D(cp.x, cp.y + 0.2, cp.z, 24, '#84cc16', 2.5, 0.7);
            _ring3D(cp.x, cp.y, cp.z, 0.8, '#65a30d', 20, 0.6);
            _rising3D(cp.x, cp.y, cp.z, 14, '#a3e635', 0.9);
            _zone3D(caster.row, caster.col, 1, '#84cc16', 3);
            break;
        }

        case 'valerio_provocazione': {
            _burst3D(cp.x, cp.y + 0.4, cp.z, 28, '#ef4444', 3.5, 0.5);
            _ring3D(cp.x, cp.y, cp.z, 0.6, '#dc2626', 20, 0.5);
            triggerScreenShake(2, 0.15);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner) {
                        var ep = _sw(u, 0.5);
                        if (ep) _projectile3D(ep, cp, '#ef4444', 16, '#ef4444', 4);
                    }
                }
            }
            break;
        }

        case 'valerio_scudo_simb': {
            if (tp) {
                _projectile3D(cp, tp, '#22c55e', 12, '#4ade80', 10);
                var _tp4 = tp;
                setTimeout(function() {
                    _ring3D(_tp4.x, _tp4.y + 0.2, _tp4.z, 0.4, '#22c55e', 16, 0.5);
                    _rising3D(_tp4.x, _tp4.y - 0.1, _tp4.z, 8, '#86efac', 0.5);
                }, 120);
            }
            break;
        }

        case 'valerio_metamorfosi': {
            _ring3D(cp.x, cp.y, cp.z, 0.5, '#22c55e', 20, 0.6);
            _ring3D(cp.x, cp.y + 0.3, cp.z, 0.35, '#4ade80', 16, 0.5);
            _rising3D(cp.x, cp.y - 0.2, cp.z, 20, '#16a34a', 1.0);
            _burst3D(cp.x, cp.y + 0.3, cp.z, 20, '#86efac', 2.5, 0.7);
            triggerScreenFlash('#22c55e', 0.12);
            break;
        }

        case 'valerio_terremoto': {
            _burst3D(cp.x, cp.y - 0.2, cp.z, 40, '#b45309', 4.5, 0.8);
            _ring3D(cp.x, cp.y - 0.3, cp.z, 1.0, '#92400e', 28, 0.7);
            _ring3D(cp.x, cp.y - 0.3, cp.z, 1.8, '#78350f', 32, 0.8);
            _ring3D(cp.x, cp.y - 0.3, cp.z, 2.5, '#451a03', 36, 0.9);
            _burst3D(cp.x, cp.y + 0.2, cp.z, 20, '#ef4444', 3.0, 0.5);
            triggerScreenShake(6, 0.4);
            triggerScreenFlash('#b45309', 0.2);
            break;
        }

        // ===================== YUJIN =====================

        case 'yujin_urlo': {
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.5, '#fbbf24', 20, 0.5);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 1.5, '#fde047', 26, 0.6);
            _burst3D(cp.x, cp.y + 0.5, cp.z, 20, '#fbbf24', 3.5, 0.5);
            triggerScreenShake(2, 0.12);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner === caster.owner && u.id !== caster.id) {
                        var ap = _sw(u, 0.3);
                        if (ap) _rising3D(ap.x, ap.y - 0.1, ap.z, 6, '#fbbf24', 0.5);
                    }
                }
            }
            break;
        }

        case 'yujin_esecutore': {
            if (tp) {
                _burst3D(tp.x, tp.y + 0.1, tp.z, 18, '#ef4444', 3.5, 0.5);
                _burst3D(tp.x, tp.y + 0.3, tp.z, 10, '#fbbf24', 4.0, 0.4);
                _ring3D(tp.x, tp.y - 0.1, tp.z, 0.3, '#dc2626', 12, 0.4);
                triggerScreenShake(3, 0.2);
            }
            break;
        }

        case 'yujin_carica': {
            if (tp) {
                var steps = 12;
                for (var s = 0; s < steps; s++) {
                    var frac = s / steps;
                    var pos = cp.clone().lerp(tp, frac);
                    _spawn3D(pos, {x:(Math.random()-0.5)*0.5, y:0.8, z:(Math.random()-0.5)*0.5}, '#ef4444', 0.6, 0.3 + frac * 0.2);
                }
                _burst3D(tp.x, tp.y, tp.z, 18, '#ef4444', 3.0, 0.45);
                _ring3D(tp.x, tp.y - 0.1, tp.z, 0.3, '#dc2626', 12, 0.35);
                triggerScreenShake(3, 0.15);
            }
            break;
        }

        case 'yujin_ghiaccio': {
            _burst3D(cp.x, cp.y + 0.3, cp.z, 18, '#93c5fd', 2.0, 0.55, 'square');
            _ring3D(cp.x, cp.y + 0.3, cp.z, 0.45, '#bfdbfe', 16, 0.5);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.5, '#60a5fa', 12, 0.4);
            break;
        }

        case 'yujin_vento': {
            _ring3D(cp.x, cp.y, cp.z, 0.4, '#bae6fd', 14, 0.4);
            _ring3D(cp.x, cp.y, cp.z, 1.0, '#7dd3fc', 20, 0.5);
            _ring3D(cp.x, cp.y, cp.z, 1.8, '#38bdf8', 26, 0.6);
            _burst3D(cp.x, cp.y + 0.2, cp.z, 14, '#e0f2fe', 2.5, 0.5);
            break;
        }

        case 'yujin_giuramento': {
            _burst3D(cp.x, cp.y + 0.2, cp.z, 20, '#dc2626', 3.0, 0.5);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.4, '#991b1b', 16, 0.5);
            _rising3D(cp.x, cp.y - 0.1, cp.z, 10, '#7f1d1d', 0.7);
            triggerScreenFlash('#dc2626', 0.1);
            break;
        }

        case 'yujin_frenesia': {
            if (tp) {
                var delays = [0, 80, 160];
                for (var d = 0; d < delays.length; d++) {
                    (function(delay, _t) {
                        setTimeout(function() {
                            _burst3D(_t.x, _t.y + 0.2, _t.z, 8, '#fbbf24', 2.5, 0.3);
                            _ring3D(_t.x, _t.y, _t.z, 0.2, '#ef4444', 8, 0.25);
                        }, delay);
                    })(delays[d], tp);
                }
                triggerScreenShake(2, 0.1);
            }
            break;
        }

        case 'yujin_muro_lame': {
            _ring3D(cp.x, cp.y + 0.2, cp.z, 0.4, '#e2e8f0', 18, 0.5);
            _ring3D(cp.x, cp.y + 0.5, cp.z, 0.35, '#94a3b8', 14, 0.4);
            _burst3D(cp.x, cp.y + 0.4, cp.z, 16, '#cbd5e1', 2.0, 0.4, 'square');
            break;
        }

        case 'yujin_ragnarok_p': {
            _burst3D(cp.x, cp.y + 0.4, cp.z, 30, '#ef4444', 4.0, 0.7);
            _burst3D(cp.x, cp.y + 0.2, cp.z, 20, '#f97316', 3.5, 0.6);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.5, '#fbbf24', 20, 0.6);
            _rising3D(cp.x, cp.y - 0.2, cp.z, 15, '#fde047', 0.8);
            triggerScreenShake(3, 0.2);
            triggerScreenFlash('#ef4444', 0.15);
            break;
        }

        case 'yujin_valchiria': {
            _burst3D(cp.x, cp.y + 0.8, cp.z, 40, '#fbbf24', 5.0, 0.8);
            _ring3D(cp.x, cp.y + 0.2, cp.z, 1.5, '#fbbf24', 30, 0.7);
            _ring3D(cp.x, cp.y + 0.6, cp.z, 0.8, '#ffffff', 20, 0.6);
            _rising3D(cp.x, cp.y - 0.3, cp.z, 25, '#fef9c3', 1.0);
            triggerScreenShake(6, 0.4);
            triggerScreenFlash('#fbbf24', 0.3);
            break;
        }

        // ===================== WMS =====================

        case 'wms_distorsione': {
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.4, '#60a5fa', 16, 0.5);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 1.5, '#93c5fd', 22, 0.6);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner === caster.owner) {
                        var ap2 = _sw(u, 0.3);
                        if (ap2) {
                            _ring3D(ap2.x, ap2.y, ap2.z, 0.3, '#60a5fa', 10, 0.4);
                            _rising3D(ap2.x, ap2.y - 0.1, ap2.z, 5, '#93c5fd', 0.4);
                        }
                    }
                }
            }
            break;
        }

        case 'wms_benedizione': {
            if (tp) {
                _projectile3D(cp, tp, '#fbbf24', 12, '#fde047', 12);
                var _tp5 = tp;
                setTimeout(function() {
                    _burst3D(_tp5.x, _tp5.y + 0.3, _tp5.z, 20, '#fbbf24', 3.0, 0.6);
                    _rising3D(_tp5.x, _tp5.y - 0.1, _tp5.z, 10, '#fef08a', 0.6);
                    _ring3D(_tp5.x, _tp5.y + 0.2, _tp5.z, 0.4, '#fde047', 16, 0.5);
                }, 150);
            }
            break;
        }

        case 'wms_essenza': {
            triggerScreenFlash('#22c55e', 0.1);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 1.8, '#22c55e', 26, 0.6);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner === caster.owner) {
                        var ap3 = _sw(u, 0.2);
                        if (ap3) _rising3D(ap3.x, ap3.y - 0.1, ap3.z, 8, '#4ade80', 0.5);
                    }
                }
            }
            break;
        }

        case 'wms_specchio': {
            _ring3D(cp.x, cp.y + 0.3, cp.z, 0.4, '#e2e8f0', 18, 0.5, 'square');
            _burst3D(cp.x, cp.y + 0.3, cp.z, 16, '#f8fafc', 1.5, 0.5, 'square');
            _ring3D(cp.x, cp.y + 0.5, cp.z, 0.3, '#cbd5e1', 12, 0.4);
            break;
        }

        case 'wms_vuoto': {
            if (tp) {
                for (var i = 0; i < 20; i++) {
                    var a = (i / 20) * Math.PI * 2;
                    var rv = 0.5 + Math.random() * 0.5;
                    _spawn3D(
                        new THREE.Vector3(tp.x + Math.cos(a) * rv, tp.y + 0.3, tp.z + Math.sin(a) * rv),
                        { x: -Math.cos(a) * 2.0, y: 0.2, z: -Math.sin(a) * 2.0 },
                        '#1e1b4b', 0.6, 0.5
                    );
                }
                _burst3D(tp.x, tp.y + 0.2, tp.z, 14, '#4c1d95', 2.0, 0.5);
                _ring3D(tp.x, tp.y, tp.z, 0.35, '#6d28d9', 14, 0.4);
            }
            break;
        }

        case 'wms_anomalia': {
            _ring3D(cp.x, cp.y + 0.1, cp.z, 1.5, '#7c3aed', 24, 0.5);
            _burst3D(cp.x, cp.y + 0.3, cp.z, 20, '#8b5cf6', 2.5, 0.5);
            triggerScreenShake(2.5, 0.2);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner) {
                        var ep2 = _sw(u, 0.5);
                        if (ep2) {
                            for (var s = 0; s < 6; s++) {
                                var frac2 = s / 6;
                                var lp2 = ep2.clone().lerp(cp, frac2);
                                _spawn3D(lp2, {x:0,y:0.2,z:0}, '#7c3aed', 0.3, 0.2 + frac2 * 0.2);
                            }
                        }
                    }
                }
            }
            break;
        }

        case 'wms_sdoppiamento': {
            _burst3D(cp.x - 0.3, cp.y + 0.3, cp.z, 14, '#a78bfa', 2.0, 0.5);
            _burst3D(cp.x + 0.3, cp.y + 0.3, cp.z, 14, '#a78bfa', 2.0, 0.5);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.4, '#c084fc', 16, 0.5);
            break;
        }

        case 'wms_onda': {
            _ring3D(cp.x, cp.y, cp.z, 0.5, '#8b5cf6', 20, 0.5);
            _ring3D(cp.x, cp.y, cp.z, 1.5, '#7c3aed', 28, 0.6);
            _ring3D(cp.x, cp.y, cp.z, 2.5, '#6d28d9', 34, 0.7);
            _burst3D(cp.x, cp.y + 0.3, cp.z, 25, '#a78bfa', 3.5, 0.6);
            triggerScreenShake(3, 0.2);
            break;
        }

        case 'wms_trascendenza': {
            _burst3D(cp.x, cp.y + 0.4, cp.z, 35, '#f8fafc', 4.0, 0.8);
            _ring3D(cp.x, cp.y + 0.1, cp.z, 0.5, '#e0f2fe', 22, 0.6);
            _ring3D(cp.x, cp.y + 0.5, cp.z, 0.35, '#ffffff', 16, 0.5);
            _rising3D(cp.x, cp.y - 0.2, cp.z, 20, '#e2e8f0', 1.0);
            triggerScreenFlash('#ffffff', 0.2);
            triggerScreenShake(2, 0.15);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner === caster.owner) {
                        var ap4 = _sw(u, 0.3);
                        if (ap4) _ring3D(ap4.x, ap4.y, ap4.z, 0.3, '#ffffff', 10, 0.4);
                    }
                }
            }
            break;
        }

        case 'wms_singolarita': {
            _burst3D(cp.x, cp.y + 0.6, cp.z, 50, '#7c3aed', 5.5, 1.0);
            _ring3D(cp.x, cp.y, cp.z, 2.5, '#4c1d95', 36, 0.8);
            _ring3D(cp.x, cp.y + 0.2, cp.z, 1.8, '#6d28d9', 28, 0.7);
            _ring3D(cp.x, cp.y + 0.4, cp.z, 1.0, '#a78bfa', 20, 0.6);
            _rising3D(cp.x, cp.y - 0.3, cp.z, 30, '#c084fc', 1.1);
            if (allUnits) {
                for (var i = 0; i < allUnits.length; i++) {
                    var u = allUnits[i];
                    if (u.alive && u.owner !== caster.owner) {
                        var ep3 = _sw(u, 0.3);
                        if (ep3) _burst3D(ep3.x, ep3.y, ep3.z, 10, '#4c1d95', 1.5, 0.5, 'square');
                    }
                }
            }
            triggerScreenFlash('#7c3aed', 0.3);
            triggerScreenShake(5, 0.4);
            break;
        }

        // ===================== FALLBACK =====================
        default: {
            if (tp) {
                _projectile3D(cp, tp, '#ffffff', 10, '#ffffff', 8);
            } else {
                _burst3D(cp.x, cp.y + 0.3, cp.z, 12, '#ffffff', 2.0, 0.4);
            }
            break;
        }
    }
}
