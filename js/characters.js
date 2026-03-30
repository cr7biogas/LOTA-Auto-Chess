// ============================================================
// LOTA AUTO CHESS — characters.js — Character models & animations
// ============================================================

var renderTime = 0;

// --- Utility ---
function _pulse(t, speed, lo, hi) {
    return lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * speed));
}

// ====================================================================
//  MAIN ENTRY — replaces old drawUnitShape
// ====================================================================
function drawCharacterModel(cx, cy, charId, size, ownerIdx, star, unit) {
    var rad = size * 0.38;
    var colors = CHAR_COLORS[charId] || { fill: '#888', stroke: '#555' };
    var t = unit ? (renderTime + unit.id * 1.618) : renderTime;

    ctx.save();

    var isCamp  = (typeof charId === 'string' && charId.startsWith('camp_'));
    var isCreep = (typeof charId === 'string' && (charId.startsWith('creep_') || charId === 'creep'));

    if (isCamp) {
        _drawCampCreep(cx, cy, rad, size, t);
    } else if (isCreep) {
        _drawBossCreep(cx, cy, rad, size, t, unit);
    } else {
        switch (charId) {
            case 'Babidi':  _drawBabidi(cx, cy, rad, size, colors, t, unit);  break;
            case 'Caronte': _drawCaronte(cx, cy, rad, size, colors, t, unit); break;
            case 'Valerio': _drawValerio(cx, cy, rad, size, colors, t, unit); break;
            case 'Yujin':   _drawYujin(cx, cy, rad, size, colors, t, unit);   break;
            case 'WMS':     _drawWMS(cx, cy, rad, size, colors, t, unit);     break;
            default:        _drawDefault(cx, cy, rad, colors);                break;
        }
    }

    // ---- Team outline (circle around unit) ----
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 1, 0, Math.PI * 2);
    var tc = (typeof ownerIdx === 'number') ? TEAM_COLORS[ownerIdx] : null;
    ctx.strokeStyle = tc ? tc.outline : (isCamp ? 'rgba(185,28,28,0.8)' : 'rgba(128,128,128,0.6)');
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- Star indicators ----
    if (star > 0 && !isCamp && !isCreep) {
        ctx.font = Math.round(size * 0.15) + 'px sans-serif';
        ctx.fillStyle = COL_GOLD;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u2605'.repeat(Math.min(star, 5)), cx, cy + rad + size * 0.16);
    }

    ctx.restore();
}

// ====================================================================
//  BABIDI — Mercante Grasso · Sciamano · Kite
//  Fat pear-shaped body, golden turban with ruby, coin sparkles
// ====================================================================
function _drawBabidi(cx, cy, rad, size, colors, t, unit) {
    var bob = Math.sin(t * 1.5) * rad * 0.04;
    cy += bob;

    // ── body (fat oval) ──
    var bw = rad * 1.05, bh = rad * 0.88;
    var bg = ctx.createRadialGradient(cx - rad * 0.15, cy - rad * 0.1, rad * 0.12, cx, cy + rad * 0.1, rad * 1.1);
    bg.addColorStop(0, '#c4b5fd');
    bg.addColorStop(0.55, colors.fill);
    bg.addColorStop(1, colors.stroke);
    ctx.beginPath();
    ctx.ellipse(cx, cy + rad * 0.12, bw, bh, 0, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // robe V-line
    if (rad > 10) {
        ctx.beginPath();
        ctx.moveTo(cx - rad * 0.18, cy - rad * 0.28);
        ctx.lineTo(cx, cy + rad * 0.15);
        ctx.lineTo(cx + rad * 0.18, cy - rad * 0.28);
        ctx.strokeStyle = 'rgba(124,58,237,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // ── head ──
    var hy = cy - rad * 0.42, hr = rad * 0.32;
    ctx.beginPath();
    ctx.arc(cx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a574';
    ctx.fill();
    ctx.strokeStyle = '#b8864e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── turban ──
    var ty = hy - hr * 0.25;
    // base wrap
    ctx.beginPath();
    ctx.ellipse(cx, ty, hr * 1.15, hr * 0.65, 0, Math.PI, 0, true);
    var tg = ctx.createLinearGradient(cx - hr, ty, cx + hr, ty);
    tg.addColorStop(0, '#c08a30');
    tg.addColorStop(0.5, '#fbbf24');
    tg.addColorStop(1, '#c08a30');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = '#a67220';
    ctx.lineWidth = 1;
    ctx.stroke();
    // top bulge
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.35, ty);
    ctx.quadraticCurveTo(cx, ty - hr * 0.95, cx + hr * 0.35, ty);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#a67220';
    ctx.stroke();
    // ruby gem
    ctx.beginPath();
    ctx.arc(cx, ty - hr * 0.08, rad * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // gem glint
    ctx.beginPath();
    ctx.arc(cx - rad * 0.02, ty - hr * 0.12, rad * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    // ── eyes (shrewd, narrowed) ──
    if (rad > 9) {
        var ey = hy + hr * 0.1, ew = hr * 0.2, eh = hr * 0.12;
        var lookX = Math.sin(t * 0.5) * hr * 0.05;
        // whites
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cx - hr * 0.28, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + hr * 0.28, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
        // pupils
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx - hr * 0.28 + lookX, ey, eh * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + hr * 0.28 + lookX, ey, eh * 0.6, 0, Math.PI * 2); ctx.fill();
        // brow line
        ctx.beginPath();
        ctx.moveTo(cx - hr * 0.45, ey - eh * 1.1);
        ctx.lineTo(cx - hr * 0.1, ey - eh * 0.7);
        ctx.moveTo(cx + hr * 0.45, ey - eh * 1.1);
        ctx.lineTo(cx + hr * 0.1, ey - eh * 0.7);
        ctx.strokeStyle = '#8b6b4a';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // ── mouth (smirk) ──
    if (rad > 12) {
        ctx.beginPath();
        ctx.arc(cx + hr * 0.05, hy + hr * 0.48, hr * 0.14, 0.15, Math.PI - 0.3, false);
        ctx.strokeStyle = '#8b6b4a';
        ctx.lineWidth = 0.9;
        ctx.stroke();
    }

    // ── coin sparkles (orbiting) ──
    for (var ci = 0; ci < 3; ci++) {
        var ct = t * 1.6 + ci * 2.09;
        var coinA = 0.35 + 0.3 * Math.sin(ct * 2);
        var coinR = rad * 0.04 + rad * 0.015 * Math.sin(ct * 3);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ct) * rad * 0.85, cy + Math.sin(ct * 0.7) * rad * 0.45, coinR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251,191,36,' + coinA + ')';
        ctx.fill();
    }

    // ── poison vapor (green wisps rising) ──
    if (rad > 11) {
        for (var vi = 0; vi < 2; vi++) {
            var vt = t * 2.2 + vi * 3.1;
            var vy = cy - rad * 0.1 - ((vt * 0.4) % 1) * rad * 0.6;
            var vx = cx + rad * 0.45 * (vi === 0 ? 1 : -1) + Math.sin(vt * 3) * rad * 0.08;
            var va = 0.18 * (1 - ((vt * 0.4) % 1));
            ctx.beginPath();
            ctx.arc(vx, vy, rad * 0.06, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34,197,94,' + va + ')';
            ctx.fill();
        }
    }
}

// ====================================================================
//  CARONTE — Professore Viscido · Incantatore · Teleport
//  Tall thin robe, mortarboard cap, spectacles, arcane runes
// ====================================================================
function _drawCaronte(cx, cy, rad, size, colors, t, unit) {
    var fl = Math.sin(t * 2) * rad * 0.05;
    cy += fl;

    // ── body (long academic robe, trapezoid) ──
    var bt = cy - rad * 0.2, bb = cy + rad * 0.82;
    var tw = rad * 0.45, bw = rad * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - tw, bt); ctx.lineTo(cx + tw, bt);
    ctx.lineTo(cx + bw, bb); ctx.lineTo(cx - bw, bb);
    ctx.closePath();
    var rg = ctx.createLinearGradient(cx, bt, cx, bb);
    rg.addColorStop(0, '#b0bec5');
    rg.addColorStop(0.4, colors.fill);
    rg.addColorStop(1, colors.stroke);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // center seam
    if (rad > 10) {
        ctx.beginPath();
        ctx.moveTo(cx, bt + rad * 0.08);
        ctx.lineTo(cx, bb);
        ctx.strokeStyle = 'rgba(100,116,139,0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // ── head ──
    var hy = cy - rad * 0.48, hr = rad * 0.27;
    ctx.beginPath(); ctx.arc(cx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#c9ccd4';
    ctx.fill();
    ctx.strokeStyle = '#9aa0ad';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── mortarboard cap ──
    var capY = hy - hr * 0.55;
    // board
    ctx.beginPath();
    ctx.moveTo(cx - hr * 1.5, capY);
    ctx.lineTo(cx + hr * 1.5, capY);
    ctx.lineTo(cx + hr * 1.35, capY - hr * 0.3);
    ctx.lineTo(cx - hr * 1.35, capY - hr * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // crown
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - hr * 0.45, capY, hr * 0.9, hr * 0.45);
    // tassel
    var tSwing = Math.sin(t * 1.6) * hr * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx + hr * 0.4, capY - hr * 0.15);
    ctx.quadraticCurveTo(cx + hr * 1.0 + tSwing, capY + hr * 0.35, cx + hr * 0.85 + tSwing, capY + hr * 0.8);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + hr * 0.85 + tSwing, capY + hr * 0.8, hr * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    // ── glasses ──
    if (rad > 8) {
        var gy = hy + hr * 0.08, gr = hr * 0.22;
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = '#60a5fa';
        // lenses
        ctx.beginPath(); ctx.arc(cx - hr * 0.3, gy, gr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + hr * 0.3, gy, gr, 0, Math.PI * 2); ctx.stroke();
        // glare
        ctx.fillStyle = 'rgba(96,165,250,0.12)';
        ctx.beginPath(); ctx.arc(cx - hr * 0.3, gy, gr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + hr * 0.3, gy, gr, 0, Math.PI * 2); ctx.fill();
        // bridge
        ctx.beginPath();
        ctx.moveTo(cx - hr * 0.08, gy);
        ctx.lineTo(cx + hr * 0.08, gy);
        ctx.stroke();
        // pupils behind glass
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(cx - hr * 0.3, gy + gr * 0.15, gr * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + hr * 0.3, gy + gr * 0.15, gr * 0.35, 0, Math.PI * 2); ctx.fill();
    }

    // ── thin mouth (neutral) ──
    if (rad > 12) {
        ctx.beginPath();
        ctx.moveTo(cx - hr * 0.15, hy + hr * 0.55);
        ctx.lineTo(cx + hr * 0.15, hy + hr * 0.55);
        ctx.strokeStyle = '#7a8190';
        ctx.lineWidth = 0.7;
        ctx.stroke();
    }

    // ── floating tome (beside body, glowing) ──
    if (rad > 10) {
        var bookT = t * 0.6;
        var bkX = cx - rad * 0.75 + Math.sin(bookT) * rad * 0.05;
        var bkY = cy + Math.cos(bookT * 1.3) * rad * 0.08;
        // glow
        ctx.beginPath();
        ctx.arc(bkX, bkY, rad * 0.18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96,165,250,0.12)';
        ctx.fill();
        // book shape
        ctx.fillStyle = '#475569';
        ctx.fillRect(bkX - rad * 0.1, bkY - rad * 0.12, rad * 0.2, rad * 0.24);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bkX - rad * 0.1, bkY - rad * 0.12, rad * 0.2, rad * 0.24);
        // spine
        ctx.beginPath();
        ctx.moveTo(bkX, bkY - rad * 0.12);
        ctx.lineTo(bkX, bkY + rad * 0.12);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }

    // ── arcane runes orbiting ──
    if (rad > 9) {
        var symbols = ['\u2726', '\u2727', '\u2735'];
        for (var si = 0; si < 3; si++) {
            var st = t * 0.7 + si * 2.09;
            var sx = cx + Math.cos(st) * rad * 0.95;
            var sy = cy + Math.sin(st) * rad * 0.55;
            var sa = 0.2 + 0.15 * Math.sin(st * 2.5);
            ctx.font = Math.round(rad * 0.18) + 'px sans-serif';
            ctx.fillStyle = 'rgba(96,165,250,' + sa + ')';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(symbols[si], sx, sy);
        }
    }
}

// ====================================================================
//  VALERIO — Vermoide · Guardiano · Tank
//  Thick segmented worm, armored plates, spines, shield emblem
// ====================================================================
function _drawValerio(cx, cy, rad, size, colors, t, unit) {
    var segCount = 4;
    var segW = rad * 0.92;
    var segH = rad * 0.38;
    var bodyTop = cy - rad * 0.6;

    // ── body segments ──
    for (var seg = 0; seg < segCount; seg++) {
        var phase = Math.sin(t * 1.5 + seg * 0.8) * rad * 0.02;
        var sy = bodyTop + seg * segH * 0.72;
        var sx = cx + phase;
        var sw = segW * (1 - seg * 0.04);
        var sr = segH * 0.32;

        // gradient (metallic armor)
        var sg = ctx.createLinearGradient(sx - sw, sy, sx + sw, sy);
        sg.addColorStop(0, colors.stroke);
        sg.addColorStop(0.25, colors.fill);
        sg.addColorStop(0.5, '#fdba74');  // highlight stripe
        sg.addColorStop(0.75, colors.fill);
        sg.addColorStop(1, colors.stroke);

        // rounded rect
        ctx.beginPath();
        ctx.moveTo(sx - sw + sr, sy);
        ctx.arcTo(sx + sw, sy, sx + sw, sy + segH, sr);
        ctx.arcTo(sx + sw, sy + segH, sx - sw, sy + segH, sr);
        ctx.arcTo(sx - sw, sy + segH, sx - sw, sy, sr);
        ctx.arcTo(sx - sw, sy, sx + sw, sy, sr);
        ctx.closePath();
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // armor seam
        ctx.beginPath();
        ctx.moveTo(sx - sw * 0.8, sy + segH * 0.5);
        ctx.lineTo(sx + sw * 0.8, sy + segH * 0.5);
        ctx.strokeStyle = 'rgba(234,88,12,0.25)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
    }

    // ── spines (dorsal) ──
    for (var sp = 0; sp < 5; sp++) {
        var spX = cx - rad * 0.5 + sp * rad * 0.25;
        var spH = rad * 0.18 + Math.sin(t * 2.5 + sp * 0.9) * rad * 0.03;
        ctx.beginPath();
        ctx.moveTo(spX - rad * 0.03, bodyTop + rad * 0.04);
        ctx.lineTo(spX, bodyTop - spH);
        ctx.lineTo(spX + rad * 0.03, bodyTop + rad * 0.04);
        ctx.closePath();
        ctx.fillStyle = '#ea580c';
        ctx.fill();
    }

    // ── eyes (on first segment) ──
    if (rad > 8) {
        var ey = bodyTop + segH * 0.32;
        var er = rad * 0.07;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(cx - rad * 0.22, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + rad * 0.22, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx - rad * 0.22, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + rad * 0.22, ey, er * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // ── shield emblem (center of body) ──
    if (rad > 11) {
        var shY = cy + rad * 0.08;
        var shR = rad * 0.14;
        ctx.beginPath();
        ctx.moveTo(cx, shY - shR);
        ctx.lineTo(cx + shR, shY - shR * 0.25);
        ctx.lineTo(cx + shR * 0.7, shY + shR);
        ctx.lineTo(cx, shY + shR * 1.2);
        ctx.lineTo(cx - shR * 0.7, shY + shR);
        ctx.lineTo(cx - shR, shY - shR * 0.25);
        ctx.closePath();
        ctx.fillStyle = 'rgba(251,146,60,0.3)';
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
    }

    // ── regen sparkles (when low HP) ──
    if (unit && unit.hp < unit.maxHp * 0.5 && rad > 9) {
        for (var ri = 0; ri < 4; ri++) {
            var rt = t * 3 + ri * 1.57;
            var ry = cy - ((rt * 0.35) % 1) * rad * 0.8;
            var rx = cx + Math.sin(rt * 2.5) * rad * 0.5;
            var ra = 0.3 * (1 - ((rt * 0.35) % 1));
            ctx.beginPath();
            ctx.arc(rx, ry, rad * 0.035, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(52,211,153,' + ra + ')';
            ctx.fill();
        }
    }
}

// ====================================================================
//  YUJIN — Guerriero Norvegese · Berserker · DPS
//  Broad shoulders, horned helmet, battle axe, fur mantle
// ====================================================================
function _drawYujin(cx, cy, rad, size, colors, t, unit) {
    var breath = Math.sin(t * 1.8) * rad * 0.025;
    var isFuria = unit && unit.furiaActive;
    if (isFuria) cx += Math.sin(t * 18) * rad * 0.02;

    // ── fur mantle (behind body) ──
    if (rad > 10) {
        ctx.fillStyle = '#7c5a3a';
        // left cape
        ctx.beginPath();
        ctx.moveTo(cx - rad * 0.85, cy - rad * 0.18);
        ctx.quadraticCurveTo(cx - rad * 1.1, cy + rad * 0.35, cx - rad * 0.7, cy + rad * 0.55);
        ctx.lineTo(cx - rad * 0.8, cy - rad * 0.2);
        ctx.closePath();
        ctx.fill();
        // right cape
        ctx.beginPath();
        ctx.moveTo(cx + rad * 0.85, cy - rad * 0.18);
        ctx.quadraticCurveTo(cx + rad * 1.1, cy + rad * 0.35, cx + rad * 0.7, cy + rad * 0.55);
        ctx.lineTo(cx + rad * 0.8, cy - rad * 0.2);
        ctx.closePath();
        ctx.fill();
    }

    // ── body (broad shoulders, warrior torso) ──
    var sw = rad * 0.88 + breath * 0.5;
    var bb = cy + rad * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - sw, cy - rad * 0.2);
    ctx.lineTo(cx + sw, cy - rad * 0.2);
    ctx.lineTo(cx + sw * 0.6, bb);
    ctx.lineTo(cx - sw * 0.6, bb);
    ctx.closePath();
    var bg = ctx.createLinearGradient(cx, cy - rad * 0.3, cx, bb);
    bg.addColorStop(0, isFuria ? '#fca5a5' : '#faa0a0');
    bg.addColorStop(0.5, colors.fill);
    bg.addColorStop(1, colors.stroke);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // chest armour cross
    if (rad > 10) {
        ctx.beginPath();
        ctx.moveTo(cx - sw * 0.5, cy - rad * 0.12);
        ctx.lineTo(cx + sw * 0.15, bb - rad * 0.08);
        ctx.moveTo(cx + sw * 0.5, cy - rad * 0.12);
        ctx.lineTo(cx - sw * 0.15, bb - rad * 0.08);
        ctx.strokeStyle = 'rgba(220,38,38,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // belt
    if (rad > 11) {
        ctx.beginPath();
        ctx.moveTo(cx - sw * 0.7, cy + rad * 0.2);
        ctx.lineTo(cx + sw * 0.7, cy + rad * 0.2);
        ctx.strokeStyle = '#8b6b4a';
        ctx.lineWidth = 2;
        ctx.stroke();
        // buckle
        ctx.beginPath();
        ctx.arc(cx, cy + rad * 0.2, rad * 0.05, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a43a';
        ctx.fill();
    }

    // ── head ──
    var hy = cy - rad * 0.47, hr = rad * 0.26;
    ctx.beginPath(); ctx.arc(cx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#e4c9a0';
    ctx.fill();
    ctx.strokeStyle = '#c4a87a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── viking helmet ──
    var helmY = hy - hr * 0.25;
    // dome
    ctx.beginPath();
    ctx.arc(cx, helmY, hr * 1.08, Math.PI, 0, false);
    var hg = ctx.createLinearGradient(cx - hr, helmY, cx + hr, helmY);
    hg.addColorStop(0, '#4b5563');
    hg.addColorStop(0.3, '#9ca3af');
    hg.addColorStop(0.5, '#d1d5db');
    hg.addColorStop(0.7, '#9ca3af');
    hg.addColorStop(1, '#4b5563');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.stroke();
    // nose guard
    ctx.beginPath();
    ctx.moveTo(cx, helmY + hr * 0.15);
    ctx.lineTo(cx, hy + hr * 0.3);
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // rim
    ctx.beginPath();
    ctx.moveTo(cx - hr * 1.15, helmY + hr * 0.1);
    ctx.lineTo(cx + hr * 1.15, helmY + hr * 0.1);
    ctx.strokeStyle = '#d4a43a';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // ── HORNS ──
    var hornL = rad * 0.38;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#d4a43a';
    ctx.lineCap = 'round';
    // left
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.85, helmY);
    ctx.quadraticCurveTo(cx - hr * 1.6, helmY - hornL * 0.4, cx - hr * 1.25, helmY - hornL);
    ctx.stroke();
    // right
    ctx.beginPath();
    ctx.moveTo(cx + hr * 0.85, helmY);
    ctx.quadraticCurveTo(cx + hr * 1.6, helmY - hornL * 0.4, cx + hr * 1.25, helmY - hornL);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // ── eyes ──
    if (rad > 8) {
        var ey = hy + hr * 0.2;
        var eColor = isFuria ? '#ef4444' : '#fff';
        ctx.fillStyle = eColor;
        ctx.fillRect(cx - hr * 0.42, ey - hr * 0.1, hr * 0.28, hr * 0.18);
        ctx.fillRect(cx + hr * 0.14, ey - hr * 0.1, hr * 0.28, hr * 0.18);
        if (!isFuria) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx - hr * 0.32, ey - hr * 0.05, hr * 0.12, hr * 0.12);
            ctx.fillRect(cx + hr * 0.2, ey - hr * 0.05, hr * 0.12, hr * 0.12);
        }
    }

    // ── battle axe (right side) ──
    if (rad > 9) {
        var axSwing = Math.sin(t * 1.3) * 0.12 + (isFuria ? Math.sin(t * 6) * 0.08 : 0);
        ctx.save();
        ctx.translate(cx + rad * 0.72, cy - rad * 0.05);
        ctx.rotate(-0.3 + axSwing);
        // handle
        ctx.beginPath();
        ctx.moveTo(0, -rad * 0.42);
        ctx.lineTo(0, rad * 0.38);
        ctx.strokeStyle = '#7c5a3a';
        ctx.lineWidth = 2;
        ctx.stroke();
        // blade
        ctx.beginPath();
        ctx.moveTo(0, -rad * 0.38);
        ctx.quadraticCurveTo(rad * 0.28, -rad * 0.28, rad * 0.24, -rad * 0.12);
        ctx.lineTo(0, -rad * 0.18);
        ctx.closePath();
        var bladeG = ctx.createLinearGradient(0, -rad * 0.38, rad * 0.28, -rad * 0.12);
        bladeG.addColorStop(0, '#d1d5db');
        bladeG.addColorStop(1, '#6b7280');
        ctx.fillStyle = bladeG;
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
    }

    // ── furia fire particles ──
    if (isFuria && rad > 7) {
        for (var fi = 0; fi < 6; fi++) {
            var ft = t * 5 + fi * 1.05;
            var fr = rad * 0.75 + Math.sin(ft) * rad * 0.25;
            var fa = ft;
            var fx = cx + Math.cos(fa) * fr;
            var fy = cy + Math.sin(fa) * fr * 0.55;
            var fAlpha = 0.25 + 0.2 * Math.sin(ft * 2);
            var fSize = rad * 0.05 + rad * 0.03 * Math.sin(ft * 3);
            ctx.beginPath();
            ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(239,68,68,' + fAlpha + ')';
            ctx.fill();
        }
    }
}

// ====================================================================
//  WMS — WiseMysticalSborratore · Jolly · Copy
//  Ethereal floating orb, energy wisps, cosmic sparkles
// ====================================================================
function _drawWMS(cx, cy, rad, size, colors, t, unit) {
    var fl = Math.sin(t * 2.5) * rad * 0.06;
    cy += fl;

    // ── outer aura (soft ring) ──
    var aR = rad * _pulse(t, 2.0, 0.95, 1.08);
    ctx.beginPath();
    ctx.arc(cx, cy, aR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251,191,36,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(251,191,36,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── energy tendrils (3 rotating wisps) ──
    var coreR = rad * 0.52;
    for (var wi = 0; wi < 3; wi++) {
        var wa = t * 1.2 + wi * (Math.PI * 2 / 3);
        var wr = rad * 0.72;
        var wx = cx + Math.cos(wa) * wr;
        var wy = cy + Math.sin(wa) * wr;
        // trail
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(wa) * coreR * 0.75, cy + Math.sin(wa) * coreR * 0.75);
        ctx.quadraticCurveTo(
            cx + Math.cos(wa + 0.35) * wr * 0.75,
            cy + Math.sin(wa + 0.35) * wr * 0.75,
            wx, wy
        );
        ctx.strokeStyle = 'rgba(167,139,250,0.35)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // head
        ctx.beginPath();
        ctx.arc(wx, wy, rad * 0.06, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(167,139,250,0.6)';
        ctx.fill();
    }

    // ── inner core (radial gradient orb) ──
    var cg = ctx.createRadialGradient(cx - coreR * 0.2, cy - coreR * 0.2, 0, cx, cy, coreR);
    cg.addColorStop(0, '#fef9c3');
    cg.addColorStop(0.35, colors.fill);
    cg.addColorStop(0.7, colors.stroke);
    cg.addColorStop(1, 'rgba(217,119,6,0.2)');
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.fill();

    // ── face (mysterious eyes) ──
    if (rad > 8) {
        var ey = cy - coreR * 0.05;
        var blink = Math.sin(t * 0.3);
        var eH = blink > 0.96 ? 0 : rad * 0.055;   // occasional blink

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(cx - coreR * 0.28, ey, rad * 0.06, eH, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + coreR * 0.28, ey, rad * 0.06, eH, 0, 0, Math.PI * 2); ctx.fill();
        if (eH > 0) {
            ctx.fillStyle = '#7c3aed';
            ctx.beginPath(); ctx.arc(cx - coreR * 0.28, ey, rad * 0.032, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + coreR * 0.28, ey, rad * 0.032, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ── cosmic sparkle particles ──
    for (var pi = 0; pi < 5; pi++) {
        var pt = t * 1.8 + pi * 1.26;
        var pLife = (pt * 0.45) % 1;
        var pDist = rad * (0.25 + 0.65 * pLife);
        var pAngle = pt * 0.65 + pi * 1.88;
        var px = cx + Math.cos(pAngle) * pDist;
        var py = cy + Math.sin(pAngle) * pDist;
        var pSize = rad * 0.028 * (1 - pLife);
        var pAlpha = 0.55 * (1 - pLife);
        if (pSize > 0.4) {
            // 4-point star spark
            ctx.beginPath();
            for (var si = 0; si < 8; si++) {
                var sa = (Math.PI / 4) * si - Math.PI / 8 + pAngle * 0.5;
                var sd = si % 2 === 0 ? pSize * 2.5 : pSize * 0.6;
                si === 0 ? ctx.moveTo(px + Math.cos(sa) * sd, py + Math.sin(sa) * sd)
                         : ctx.lineTo(px + Math.cos(sa) * sd, py + Math.sin(sa) * sd);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,' + pAlpha + ')';
            ctx.fill();
        }
    }

    // ── copy indicator (small colored dot for copied class) ──
    var cc = unit ? unit.copiedClass : null;
    if (cc && rad > 10) {
        var copyCol = null;
        switch (cc) {
            case 'Guardiano':  copyCol = CHAR_COLORS.Valerio;  break;
            case 'Berserker':  copyCol = CHAR_COLORS.Yujin;    break;
            case 'Incantatore':copyCol = CHAR_COLORS.Caronte;  break;
            case 'Sciamano':   copyCol = CHAR_COLORS.Babidi;   break;
        }
        if (copyCol) {
            ctx.beginPath();
            ctx.arc(cx, cy + coreR * 0.65, rad * 0.09, 0, Math.PI * 2);
            ctx.fillStyle = copyCol.fill;
            ctx.fill();
            ctx.strokeStyle = copyCol.stroke;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
    }
}

// ====================================================================
//  CREEPS
// ====================================================================
function _drawCampCreep(cx, cy, rad, size, t) {
    var pulse = _pulse(t, 2.5, 0.95, 1.02);
    var r = rad * pulse;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    var cg = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.15, cx, cy, r);
    cg.addColorStop(0, '#f87171');
    cg.addColorStop(1, '#991b1b');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // skull icon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(size * 0.2) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2620', cx, cy + 1);
}

function _drawBossCreep(cx, cy, rad, size, t, unit) {
    var pulse = _pulse(t, 1.8, 0.96, 1.06);
    var r = rad * pulse;
    // glow
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(239,68,68,0.12)';
    ctx.fill();
    // body
    var bg = ctx.createRadialGradient(cx, cy - r * 0.25, r * 0.2, cx, cy, r);
    bg.addColorStop(0, '#fca5a5');
    bg.addColorStop(0.5, '#ef4444');
    bg.addColorStop(1, '#991b1b');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // horns
    if (rad > 9) {
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.5, cy - r * 0.7);
        ctx.quadraticCurveTo(cx - r * 0.9, cy - r * 1.3, cx - r * 0.65, cy - r * 1.15);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.5, cy - r * 0.7);
        ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.3, cx + r * 0.65, cy - r * 1.15);
        ctx.stroke();
        ctx.lineCap = 'butt';
    }
    // eyes
    if (rad > 8) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r * 0.25, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.08, r * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + r * 0.25, cy - r * 0.08, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    // boss icon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(size * 0.22) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy + r * 0.25);
}

function _drawDefault(cx, cy, rad, colors) {
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = colors.fill;
    ctx.fill();
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(rad * 0.7) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + 1);
}
