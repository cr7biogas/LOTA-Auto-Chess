// ============================================================
// LOTA AUTO CHESS — render.js — Canvas rendering (octagon)
// ============================================================

if (typeof renderTime === 'undefined') var renderTime = 0;

// --- Draw the 14x14 octagonal board ---
function drawBoard() {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (var r = 0; r < BOARD_ROWS; r++) {
        for (var c = 0; c < BOARD_COLS; c++) {
            var x = BOARD_OFFSET_X + c * CELL_SIZE;
            var y = BOARD_OFFSET_Y + r * CELL_SIZE;

            // Skip cells outside the octagon
            if (!isInsideOctagon(r, c)) continue;

            // Cell fill
            var isDark = (r + c) % 2 === 0;
            ctx.fillStyle = isDark ? COL_BOARD_DARK : COL_BOARD_LIGHT;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

            // Deploy zone tint
            var zoneOwner = getDeployZoneOwner(r, c);
            if (zoneOwner >= 0) {
                ctx.fillStyle = TEAM_COLORS[zoneOwner].bg;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }

            // Camp cell tint
            if (isCreepCampCell(r, c)) {
                ctx.fillStyle = COL_CAMP;
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
            }

            // Grid lines
            ctx.strokeStyle = COL_GRID_LINE;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        }
    }

    // Row labels
    ctx.font = '10px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    for (var r = 0; r < BOARD_ROWS; r++) {
        ctx.fillText((r + 1).toString(), BOARD_OFFSET_X - 6, BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2 + 3);
    }
    ctx.textAlign = 'center';
    for (var c = 0; c < BOARD_COLS; c++) {
        ctx.fillText(String.fromCharCode(65 + c), BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2, BOARD_OFFSET_Y + BOARD_ROWS * CELL_SIZE + 14);
    }

    // Deploy zone labels + camp labels during planning
    if (gamePhase === PHASE_PLANNING) {
        ctx.font = 'bold 11px sans-serif';
        var zones = getDeployZones();
        for (var pi = 0; pi < 4; pi++) {
            var zone = zones[pi];
            if (!zone || zone.cells.length === 0) continue;
            // Compute center of zone cells
            var sumR = 0, sumC = 0;
            for (var i = 0; i < zone.cells.length; i++) {
                sumR += zone.cells[i].r; sumC += zone.cells[i].c;
            }
            var avgR = sumR / zone.cells.length;
            var avgC = sumC / zone.cells.length;
            var pos = cellToPixel(avgR, avgC);
            ctx.fillStyle = TEAM_COLORS[pi].primary;
            ctx.globalAlpha = 0.6;
            ctx.fillText(pi === 0 ? 'TU' : ('AI ' + pi), pos.x, pos.y);
            ctx.globalAlpha = 1.0;
        }

        // Camp labels
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.globalAlpha = 0.5;
        for (var campId in CREEP_CAMP_POSITIONS) {
            var cells = CREEP_CAMP_POSITIONS[campId];
            var sr = 0, sc = 0;
            for (var i = 0; i < cells.length; i++) { sr += cells[i].r; sc += cells[i].c; }
            var cpos = cellToPixel(sr / cells.length, sc / cells.length);
            ctx.fillText('CAMP', cpos.x, cpos.y);
        }
        ctx.globalAlpha = 1.0;
    }
}

// --- Draw a unit shape based on character ---
function drawUnitShape(cx, cy, charId, size, ownerIdx, star) {
    var colors = CHAR_COLORS[charId] || { fill: '#888', stroke: '#555' };
    var rad = size * 0.38;

    // Avatar color override
    var isAvatar = (typeof charId === 'string' && charId.startsWith('avatar_'));
    if (isAvatar) {
        var avClass = charId.replace('avatar_', '');
        var avCls = typeof AVATAR_CLASSES !== 'undefined' ? AVATAR_CLASSES[avClass] : null;
        if (avCls && avCls.color) colors = avCls.color;
        rad = size * 0.42; // larger than heroes
    }

    // Structure color override
    var isStructure = (typeof charId === 'string' && charId.startsWith('struct_'));
    if (isStructure) {
        var sParts = charId.split('_');
        var sCharId = sParts[1] || '';
        var sType = sParts[2] || '';
        var sTheme = typeof STRUCTURE_THEMES !== 'undefined' && STRUCTURE_THEMES[sCharId] ? STRUCTURE_THEMES[sCharId][sType] : null;
        if (sTheme && sTheme.color) colors = sTheme.color;
        rad = size * 0.35;
    }

    // Militia color override
    var isMilitia = (typeof charId === 'string' && charId.startsWith('militia_'));
    if (isMilitia) {
        var mTypeId = charId.replace('militia_', '');
        var mDef = typeof MILITIA_TYPES !== 'undefined' ? MILITIA_TYPES[mTypeId] : null;
        if (mDef && mDef.color) colors = mDef.color;
        rad = size * 0.30; // smaller
    }

    ctx.save();
    ctx.fillStyle = colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 2;

    // Camp creeps get a skull/diamond shape
    var isCamp = (typeof charId === 'string' && charId.startsWith('camp_'));
    var isCreep = (typeof charId === 'string' && charId.startsWith('creep_')) || charId === 'creep';

    if (isAvatar) {
        // Crown/star shape for avatar — larger and distinctive
        ctx.beginPath();
        for (var si = 0; si < 8; si++) {
            var ang = (Math.PI / 4) * si - Math.PI / 2;
            var dist = si % 2 === 0 ? rad : rad * 0.55;
            var px = cx + dist * Math.cos(ang);
            var py = cy + dist * Math.sin(ang);
            si === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        // Glow effect
        ctx.shadowColor = colors.fill;
        ctx.shadowBlur = 10;
    } else if (isStructure) {
        // Pentagon/tower shape for structures
        ctx.beginPath();
        ctx.moveTo(cx, cy - rad);
        ctx.lineTo(cx + rad * 0.95, cy - rad * 0.3);
        ctx.lineTo(cx + rad * 0.6, cy + rad);
        ctx.lineTo(cx - rad * 0.6, cy + rad);
        ctx.lineTo(cx - rad * 0.95, cy - rad * 0.3);
        ctx.closePath();
    } else if (isMilitia) {
        // Small square with rounded corners for militia
        ctx.beginPath();
        var sq = rad * 0.85;
        ctx.moveTo(cx - sq + 2, cy - sq);
        ctx.lineTo(cx + sq - 2, cy - sq);
        ctx.arcTo(cx + sq, cy - sq, cx + sq, cy - sq + 2, 2);
        ctx.lineTo(cx + sq, cy + sq - 2);
        ctx.arcTo(cx + sq, cy + sq, cx + sq - 2, cy + sq, 2);
        ctx.lineTo(cx - sq + 2, cy + sq);
        ctx.arcTo(cx - sq, cy + sq, cx - sq, cy + sq - 2, 2);
        ctx.lineTo(cx - sq, cy - sq + 2);
        ctx.arcTo(cx - sq, cy - sq, cx - sq + 2, cy - sq, 2);
        ctx.closePath();
    } else if (isCamp) {
        // Diamond with X
        ctx.fillStyle = '#b91c1c';
        ctx.strokeStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(cx, cy - rad);
        ctx.lineTo(cx + rad, cy);
        ctx.lineTo(cx, cy + rad);
        ctx.lineTo(cx - rad, cy);
        ctx.closePath();
    } else if (isCreep) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#b91c1c';
    } else {
        switch (charId) {
            case 'Babidi':
                ctx.beginPath();
                ctx.moveTo(cx, cy - rad);
                ctx.lineTo(cx + rad, cy);
                ctx.lineTo(cx, cy + rad);
                ctx.lineTo(cx - rad, cy);
                ctx.closePath();
                break;
            case 'Caronte':
                ctx.beginPath();
                ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                break;
            case 'Valerio':
                ctx.beginPath();
                for (var i = 0; i < 6; i++) {
                    var angle = (Math.PI / 3) * i - Math.PI / 6;
                    var px = cx + rad * Math.cos(angle);
                    var py = cy + rad * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            case 'Yujin':
                ctx.beginPath();
                ctx.moveTo(cx, cy - rad);
                ctx.lineTo(cx + rad * 0.87, cy + rad * 0.5);
                ctx.lineTo(cx - rad * 0.87, cy + rad * 0.5);
                ctx.closePath();
                break;
            case 'WMS':
                ctx.beginPath();
                for (var i = 0; i < 10; i++) {
                    var angle = (Math.PI / 5) * i - Math.PI / 2;
                    var dist = i % 2 === 0 ? rad : rad * 0.45;
                    var px = cx + dist * Math.cos(angle);
                    var py = cy + dist * Math.sin(angle);
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
            default:
                ctx.beginPath();
                ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                ctx.fillStyle = '#ef4444';
                ctx.strokeStyle = '#b91c1c';
                break;
        }
    }

    ctx.fill();
    ctx.stroke();

    // Team outline
    var teamColor = (typeof ownerIdx === 'number') ? TEAM_COLORS[ownerIdx] : null;
    if (teamColor) {
        ctx.strokeStyle = teamColor.outline;
    } else if (isCamp) {
        ctx.strokeStyle = 'rgba(185,28,28,0.8)';
    } else {
        ctx.strokeStyle = 'rgba(128,128,128,0.6)';
    }
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Character initial / icon
    ctx.fillStyle = '#fff';
    ctx.font = 'bold ' + Math.round(size * 0.22) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isCamp) {
        ctx.fillText('\u2620', cx, cy + 1); // skull
    } else if (isCreep) {
        ctx.fillText('!', cx, cy + 1);
    } else if (isAvatar) {
        var avClsL = typeof AVATAR_CLASSES !== 'undefined' ? AVATAR_CLASSES[charId.replace('avatar_', '')] : null;
        ctx.fillText(avClsL ? avClsL.icon : 'A', cx, cy + 1);
    } else if (isStructure) {
        var sPartsL = charId.split('_');
        var sThemeL = typeof STRUCTURE_THEMES !== 'undefined' && STRUCTURE_THEMES[sPartsL[1]] ? STRUCTURE_THEMES[sPartsL[1]][sPartsL[2]] : null;
        ctx.fillText(sThemeL ? sThemeL.icon : 'S', cx, cy + 1);
    } else if (isMilitia) {
        var mTypeIdLabel = charId.replace('militia_', '');
        var mDefLabel = typeof MILITIA_TYPES !== 'undefined' ? MILITIA_TYPES[mTypeIdLabel] : null;
        ctx.fillText(mDefLabel ? mDefLabel.icon : 'M', cx, cy + 1);
    } else {
        var initial = charId === 'WMS' ? 'W' : charId[0];
        ctx.fillText(initial, cx, cy + 1);
    }

    // Star indicators
    if (star > 0 && !isCamp && !isCreep && !isMilitia && !isStructure && !isAvatar) {
        ctx.font = Math.round(size * 0.15) + 'px sans-serif';
        ctx.fillStyle = COL_GOLD;
        ctx.fillText('\u2605'.repeat(Math.min(star, 5)), cx, cy + rad + size * 0.14);
    }

    ctx.restore();
}

// --- Draw HP bar above unit ---
function drawHpBar(cx, cy, hp, maxHp, size, shield) {
    var barW = size * 0.7;
    var barH = 4;
    var barY = cy - size * 0.42 - barH - 2;
    var barX = cx - barW / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);

    var hpRatio = clamp(hp / maxHp, 0, 1);
    var color = hpRatio > 0.6 ? COL_HP_GREEN : (hpRatio > 0.3 ? COL_GOLD : COL_HP_RED);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    if (shield > 0) {
        var shieldRatio = clamp(shield / maxHp, 0, 1 - hpRatio);
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillRect(barX + barW * hpRatio, barY, barW * shieldRatio, barH);
    }

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);
}

// --- Draw a single unit ---
function drawUnit(unit) {
    if (!unit.alive && unit.deathAnim <= 0) return;

    var pos = cellToPixel(unit.row, unit.col);
    var _dx2d = pos.x - unit.px, _dy2d = pos.y - unit.py;
    if (Math.abs(_dx2d) < 1 && Math.abs(_dy2d) < 1) {
        unit.px = pos.x; unit.py = pos.y; // snap when close
    } else {
        unit.px += _dx2d * 0.35; // faster arrival
        unit.py += _dy2d * 0.35;
    }

    var cx = unit.px;
    var cy = unit.py;

    ctx.save();

    if (!unit.alive) ctx.globalAlpha = unit.deathAnim;

    if (unit.atkAnim > 0) {
        var lunge = unit.atkAnim * 2; // reduced from 4 to 2
        cy += unit.facing * -lunge;
    }

    if (unit.hitAnim > 0.5) ctx.globalAlpha *= 0.6;

    if (unit.furiaActive) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15; }
    if (unit._invulnerable) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20; }
    if (unit._burrowed) { ctx.globalAlpha *= 0.25; }
    if (unit._lifestealPercent && unit._lifestealPercent > 0) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12; }
    if (unit._doubleStrike) { ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 12; }
    if (unit._counterDmgPercent && unit._counterDmgPercent > 0) { ctx.shadowColor = '#f87171'; ctx.shadowBlur = 10; }
    if (unit._reflectDmgPercent && unit._reflectDmgPercent > 0) { ctx.shadowColor = '#93c5fd'; ctx.shadowBlur = 12; }
    if (unit._metamorfosiTicks && unit._metamorfosiTicks > 0) { ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 15; }
    if (unit.effects && unit.effects.some(function(e) { return e.type === 'poison'; })) {
        ctx.shadowColor = COL_POISON; ctx.shadowBlur = 10;
    }

    var ownerIdx = (typeof unit.owner === 'number') ? unit.owner : -1;
    if (typeof drawCharacterModel === 'function') {
        drawCharacterModel(cx, cy, unit.charId, CELL_SIZE, ownerIdx, unit.star, unit);
    } else {
        drawUnitShape(cx, cy, unit.charId, CELL_SIZE, ownerIdx, unit.star);
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (unit.alive) drawHpBar(cx, cy, unit.hp, unit.maxHp, CELL_SIZE, unit.shield);

    // Tactical order indicator
    if (unit.tacticalOrder && unit.tacticalOrder !== ORDER_FREE) {
        var orderDef = TACTICAL_ORDERS[unit.tacticalOrder];
        if (orderDef) {
            ctx.font = 'bold ' + Math.round(CELL_SIZE * 0.22) + 'px sans-serif';
            ctx.fillStyle = orderDef.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(orderDef.icon, cx + CELL_SIZE * 0.32, cy - CELL_SIZE * 0.32);
        }
    }

    // Item dots (colored by tier)
    if (unit.items && unit.items.length > 0) {
        var dotY = cy - CELL_SIZE * 0.46;
        var dotStartX = cx - (unit.items.length - 1) * 4;
        for (var di = 0; di < unit.items.length; di++) {
            var itemDef = typeof ITEMS !== 'undefined' ? ITEMS[unit.items[di]] : null;
            var dotColor = '#94a3b8';
            if (itemDef) { if (itemDef.tier === 3) dotColor = '#fbbf24'; else if (itemDef.tier === 2) dotColor = '#60a5fa'; }
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(dotStartX + di * 8, dotY, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0f1117'; ctx.lineWidth = 1; ctx.stroke();
        }
    }

    // Survival badge
    if (unit.survivalCount && unit.survivalCount > 0) {
        ctx.font = 'bold 8px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var badgeX = cx - CELL_SIZE * 0.35;
        var badgeY = cy + CELL_SIZE * 0.35;
        // Background
        ctx.fillStyle = 'rgba(15,17,23,0.7)';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(unit.survivalCount, badgeX, badgeY + 1);
    }

    // Status effect icons
    var iconIdx = 0;
    var iconY = cy + CELL_SIZE * 0.38;
    if (hasEffect(unit, 'poison')) {
        ctx.fillStyle = COL_POISON; ctx.font = '10px sans-serif';
        ctx.fillText('\u2620', cx - 12 + iconIdx * 12, iconY); iconIdx++;
    }
    if (hasEffect(unit, 'speed_reduction')) {
        ctx.fillStyle = '#60a5fa'; ctx.font = '10px sans-serif';
        ctx.fillText('\u23F3', cx - 12 + iconIdx * 12, iconY); iconIdx++;
    }
    if (hasEffect(unit, 'freeze')) {
        ctx.fillStyle = '#93c5fd'; ctx.font = '10px sans-serif';
        ctx.fillText('\u2744', cx - 12 + iconIdx * 12, iconY); iconIdx++;
    }
    if (hasEffect(unit, 'stun')) {
        ctx.fillStyle = '#fbbf24'; ctx.font = '10px sans-serif';
        ctx.fillText('\u26A1', cx - 12 + iconIdx * 12, iconY); iconIdx++;
    }
    if (hasEffect(unit, 'silence')) {
        ctx.fillStyle = '#f472b6'; ctx.font = '10px sans-serif';
        ctx.fillText('\u2715', cx - 12 + iconIdx * 12, iconY); iconIdx++;
    }

    ctx.restore();
}

// --- Floating damage numbers ---
function drawDamageNumbers(dt) {
    var remaining = [];
    for (var i = 0; i < damageNumbers.length; i++) {
        var dn = damageNumbers[i];
        dn.y += dn.vy;
        dn.vy -= 0.03;
        dn.life -= dt * 1.5;
        if (dn.life <= 0) continue;

        ctx.save();
        ctx.globalAlpha = clamp(dn.life, 0, 1);
        ctx.font = dn.isCrit ? 'bold 18px sans-serif' : '14px sans-serif';
        ctx.fillStyle = dn.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(dn.text, dn.x, dn.y);
        ctx.restore();

        remaining.push(dn);
    }
    damageNumbers = remaining;
}

// --- Draw info above board ---
function drawCombatInfo() {
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = COL_TEXT;
    ctx.textAlign = 'center';
    var centerX = BOARD_OFFSET_X + (BOARD_COLS * CELL_SIZE) / 2;

    if (gamePhase === PHASE_COMBAT) {
        ctx.fillText('Tick ' + combatTick + ' / ' + MAX_TICKS, centerX, BOARD_OFFSET_Y - 24);

        var aliveCount = 0;
        for (var key in combatTeams) {
            if (key.startsWith('camp_') || key === 'creep') continue;
            var hasAlive = false;
            for (var i = 0; i < combatTeams[key].length; i++) {
                if (combatTeams[key][i].alive) { hasAlive = true; break; }
            }
            if (hasAlive) aliveCount++;
        }
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(aliveCount + ' squadre in campo', centerX, BOARD_OFFSET_Y - 8);
    } else if (gamePhase === PHASE_PLANNING) {
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('ROUND ' + currentRound + ' — Schiera le tue unita!', centerX, BOARD_OFFSET_Y - 12);
    }
    ctx.restore();
}

// --- Placement hints ---
function drawPlacementHints(playerIdx) {
    if (gamePhase !== PHASE_PLANNING) return;
    ctx.save();
    var zone = getDeployZone(playerIdx);
    if (!zone) { ctx.restore(); return; }

    ctx.strokeStyle = TEAM_COLORS[playerIdx] ? TEAM_COLORS[playerIdx].outline : '#60a5fa';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    for (var i = 0; i < zone.cells.length; i++) {
        var cell = zone.cells[i];
        var x = BOARD_OFFSET_X + cell.c * CELL_SIZE;
        var y = BOARD_OFFSET_Y + cell.r * CELL_SIZE;
        ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
    ctx.setLineDash([]);
    ctx.restore();
}

// --- Main render function ---
function renderFrame(dt) {
    // Accumulate time for character idle animations
    if (typeof renderTime !== 'undefined') renderTime += dt;

    // ====== 3D RENDERING (if Three.js is initialized) ======
    if (typeof threeRenderer !== 'undefined' && threeRenderer && threeScene && threeCamera) {
        renderFrame3D(dt);
        return;
    }

    // ====== FALLBACK: 2D Canvas rendering ======
    resizeCanvas();
    drawBoard();

    if (gamePhase === PHASE_PLANNING) {
        drawPlacementHints(0);
    }

    // Draw traps (visible ones during planning, own traps always)
    if (typeof players !== 'undefined') {
        for (var pi = 0; pi < players.length; pi++) {
            if (!players[pi].activeTraps) continue;
            for (var ti = 0; ti < players[pi].activeTraps.length; ti++) {
                var trap = players[pi].activeTraps[ti];
                if (trap.triggered) continue;
                // Show own traps always, enemy traps only if revealed
                if (pi !== 0 && !trap.revealed && gamePhase !== PHASE_PLANNING) continue;
                var tx = BOARD_OFFSET_X + trap.col * CELL_SIZE + CELL_SIZE / 2;
                var ty = BOARD_OFFSET_Y + trap.row * CELL_SIZE + CELL_SIZE / 2;
                ctx.save();
                ctx.globalAlpha = pi === 0 ? 0.6 : 0.3;
                ctx.fillStyle = trap.effect === 'freeze' ? '#93c5fd' : (trap.effect === 'damage' ? '#ef4444' : '#22c55e');
                ctx.font = Math.round(CELL_SIZE * 0.3) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                var trapDef = typeof CONSUMABLES !== 'undefined' ? CONSUMABLES[trap.consumableId] : null;
                ctx.fillText(trapDef ? trapDef.icon : '!', tx, ty);
                ctx.restore();
            }
        }
    }

    // Draw survival count badges on units during planning
    if (gamePhase === PHASE_PLANNING && players && getHumanPlayer()) {
        for (var si = 0; si < getHumanPlayer().fieldUnits.length; si++) {
            var su = getHumanPlayer().fieldUnits[si];
            if (su.survivalCount > 0) {
                var sp = cellToPixel(su.row, su.col);
                ctx.save();
                ctx.font = 'bold 9px sans-serif';
                ctx.fillStyle = '#fbbf24';
                ctx.textAlign = 'center';
                ctx.fillText('S' + su.survivalCount, sp.x - CELL_SIZE * 0.32, sp.y + CELL_SIZE * 0.42);
                ctx.restore();
            }
        }
    }

    if (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT) {
        for (var i = 0; i < combatUnits.length; i++) {
            var unit = combatUnits[i];
            drawUnit(unit);
            if (unit.atkAnim > 0) unit.atkAnim -= dt * 5;
            if (unit.hitAnim > 0) unit.hitAnim -= dt * 5;
            if (!unit.alive && unit.deathAnim > 0) unit.deathAnim -= dt * 2;
        }
    } else if (gamePhase === PHASE_PLANNING) {
        var player = getHumanPlayer();
        if (player) {
            for (var i = 0; i < player.fieldUnits.length; i++) {
                var unit = player.fieldUnits[i];
                var pos = cellToPixel(unit.row, unit.col);
                if (unit.px === 0 && unit.py === 0) { unit.px = pos.x; unit.py = pos.y; }
                drawUnit(unit);

                // Draw move target flag (ORDER_MOVE)
                if (unit.tacticalOrder === ORDER_MOVE && unit.tacticalMoveRow >= 0 && unit.tacticalMoveCol >= 0) {
                    var mpos = cellToPixel(unit.tacticalMoveRow, unit.tacticalMoveCol);
                    var pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.3;
                    var teamCol = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[unit.owner]) ? TEAM_COLORS[unit.owner].primary : '#fb923c';
                    ctx.save();

                    // Dashed line from unit to destination
                    ctx.globalAlpha = 0.5;
                    ctx.strokeStyle = teamCol;
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(unit.px || pos.x, unit.py || pos.y);
                    ctx.lineTo(mpos.x, mpos.y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Pulsing ground circle
                    ctx.globalAlpha = pulse * 0.3;
                    ctx.fillStyle = teamCol;
                    ctx.beginPath();
                    ctx.arc(mpos.x, mpos.y, CELL_SIZE * 0.4, 0, Math.PI * 2);
                    ctx.fill();

                    // Flag pole
                    ctx.globalAlpha = 0.9;
                    var fx = mpos.x;
                    var fy = mpos.y;
                    var flagH = CELL_SIZE * 0.7;
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(fx, fy);
                    ctx.lineTo(fx, fy - flagH);
                    ctx.stroke();

                    // Flag cloth (triangle)
                    ctx.fillStyle = teamCol;
                    ctx.globalAlpha = 0.85 + Math.sin(Date.now() * 0.006) * 0.1;
                    ctx.beginPath();
                    ctx.moveTo(fx, fy - flagH);
                    ctx.lineTo(fx + CELL_SIZE * 0.35, fy - flagH + CELL_SIZE * 0.15);
                    ctx.lineTo(fx, fy - flagH + CELL_SIZE * 0.3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.4;
                    ctx.stroke();

                    ctx.restore();
                }

                // Draw order link to ally (proteggi/segui)
                if (unit.tacticalTarget && (unit.tacticalOrder === ORDER_PROTECT || unit.tacticalOrder === ORDER_FOLLOW)) {
                    var allLinkUnits = getAllPlayerUnits(player);
                    for (var ti = 0; ti < allLinkUnits.length; ti++) {
                        var targetAlly = allLinkUnits[ti];
                        if (targetAlly.id === unit.tacticalTarget) {
                            var tpos = cellToPixel(targetAlly.row, targetAlly.col);
                            var orderDef = TACTICAL_ORDERS[unit.tacticalOrder];
                            ctx.save();
                            ctx.strokeStyle = orderDef ? orderDef.color : '#fbbf24';
                            ctx.globalAlpha = 0.5;
                            ctx.lineWidth = 2;
                            ctx.setLineDash([4, 4]);
                            ctx.beginPath();
                            ctx.moveTo(unit.px || pos.x, unit.py || pos.y);
                            ctx.lineTo(tpos.x, tpos.y);
                            ctx.stroke();
                            ctx.setLineDash([]);
                            ctx.restore();
                            break;
                        }
                    }
                }

                // Highlight selected field unit
                if (typeof selectedFieldUnit !== 'undefined' && selectedFieldUnit === unit.id) {
                    ctx.save();
                    var sx = BOARD_OFFSET_X + unit.col * CELL_SIZE;
                    var sy = BOARD_OFFSET_Y + unit.row * CELL_SIZE;
                    ctx.strokeStyle = '#a78bfa';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([6, 3]);
                    ctx.strokeRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2);
                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }

            // Draw militia units
            if (player.militiaUnits) {
                for (var mi = 0; mi < player.militiaUnits.length; mi++) {
                    var mUnit = player.militiaUnits[mi];
                    var mpos = cellToPixel(mUnit.row, mUnit.col);
                    if (mUnit.px === 0 && mUnit.py === 0) { mUnit.px = mpos.x; mUnit.py = mpos.y; }
                    drawUnit(mUnit);
                }
            }
            // Draw structures
            if (player.structures) {
                for (var si = 0; si < player.structures.length; si++) {
                    var sUnit = player.structures[si];
                    var spos = cellToPixel(sUnit.row, sUnit.col);
                    if (sUnit.px === 0 && sUnit.py === 0) { sUnit.px = spos.x; sUnit.py = spos.y; }
                    drawUnit(sUnit);
                }
            }
        }
    }

    // VFX: update and render particles, projectiles, zones, screen effects
    if (typeof updateVFX === 'function') updateVFX(dt);
    if (typeof renderVFX === 'function') renderVFX(ctx);

    drawDamageNumbers(dt);
    drawCombatInfo();

    // Skill cast indicators (floating skill names)
    if (typeof updateSkillCastIndicators === 'function') updateSkillCastIndicators(dt);
    if (typeof renderSkillCastIndicators === 'function') renderSkillCastIndicators(ctx);

    // Skill cooldown HUD (top-left during combat)
    if (typeof renderSkillCooldownHUD === 'function') renderSkillCooldownHUD(ctx);

    // Command UI: update combat log + toasts
    if (typeof updateCommandUI === 'function') updateCommandUI(dt);
}

// ====================================================================
//  3D RENDER PIPELINE
// ====================================================================
function renderFrame3D(dt) {
    resizeCanvas(); // still needed for 2D overlay (damage numbers)

    // init 3D VFX system on first call
    if (typeof _initVfx3D === 'function' && !_vfxSphereGeo) _initVfx3D();

    // clear 2D overlay canvas (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var t = renderTime;

    // --- planning phase ---
    if (gamePhase === PHASE_PLANNING) {
        if (deployHighlights.length === 0) {
            var _humanSlot = (typeof getPlayerSlot === 'function' && players && players[0]) ? getPlayerSlot(players[0]) : 0;
            highlightDeployZone3D(_humanSlot);
        }
        updateDeployHighlights3D(t);
        if (typeof animateBoardDecorations === 'function') animateBoardDecorations(dt, t);

        // ensure player's field units + militia have 3D models
        var human = getHumanPlayer();
        if (human) {
            // Combine field units + militia
            var allHumanUnits = getAllPlayerUnits(human);

            // spawn models for all units
            for (var i = 0; i < allHumanUnits.length; i++) {
                var u = allHumanUnits[i];
                if (!threeUnitModels[u.id]) {
                    spawnUnitModel3D(u);
                }
            }
            // update animations
            updateAnimations3D(dt, allHumanUnits);

            // remove stale models
            for (var id in threeUnitModels) {
                var found = false;
                for (var j = 0; j < allHumanUnits.length; j++) {
                    if (allHumanUnits[j].id === parseInt(id)) { found = true; break; }
                }
                if (!found) removeUnitModel3D(parseInt(id));
            }

            // highlight selected unit (hero or militia, glow on tile)
            if (typeof selectedFieldUnit !== 'undefined' && selectedFieldUnit !== null) {
                var selU = findPlayerUnit(human, selectedFieldUnit);
                if (selU) showCellHover3D(selU.row, selU.col);
            } else {
                hideCellHover3D();
            }
        }
    }

    // --- combat / result phase ---
    if (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT) {
        clearDeployHighlights3D();

        // spawn/update all combat units
        for (var i = 0; i < combatUnits.length; i++) {
            var cu = combatUnits[i];
            if (!threeUnitModels[cu.id]) spawnUnitModel3D(cu);
        }
        // Camera first: updates _camOrbitAngle from Q/E so animations read the fresh angle
        if (typeof updateFPVCamera === 'function') updateFPVCamera(dt);

        // Per-frame free movement: smoothly walk units toward combat targets
        if (typeof updateFreeMovementFrame === 'function') updateFreeMovementFrame(dt, combatUnits);

        updateAnimations3D(dt, combatUnits);
        if (typeof animateBoardDecorations === 'function') animateBoardDecorations(dt, t);

        // decay animation timers (same as 2D)
        for (var i = 0; i < combatUnits.length; i++) {
            var cu2 = combatUnits[i];
            if (cu2.atkAnim > 0) cu2.atkAnim -= dt * 5;
            if (cu2.hitAnim > 0) cu2.hitAnim -= dt * 5;
            if (!cu2.alive && cu2.deathAnim > 0) cu2.deathAnim -= dt * 2;
        }
    }

    // --- transition: clear models when phase changes ---
    if (gamePhase === PHASE_DRAFT || gamePhase === PHASE_MENU || gamePhase === PHASE_GAME_OVER) {
        clearAllUnitModels3D();
        clearDeployHighlights3D();
    }

    // --- VFX ---
    if (typeof updateVFX === 'function') updateVFX(dt);

    // --- 3D Overlays: orders, traps, item dots ---
    if (typeof updateThreeOverlays === 'function') updateThreeOverlays(dt);

    // --- Camera: planning/tactical pan only (combat+result handled above before animations) ---
    if (typeof updateFPVCamera === 'function' &&
        gamePhase !== PHASE_COMBAT && gamePhase !== PHASE_RESULT) updateFPVCamera(dt);
    if (typeof updateCameraEdgeScroll === 'function') updateCameraEdgeScroll(dt);
    if (typeof updateAvatarCombo === 'function') updateAvatarCombo(dt);
    if (typeof updateArcaneOrbs === 'function') updateArcaneOrbs(dt);
    if (typeof updateSummonedZombies === 'function') updateSummonedZombies(dt);

    // --- Render Three.js scene (with post-processing if available) ---
    var activeCam = (typeof getActiveCamera === 'function') ? getActiveCamera() : threeCamera;
    if (typeof _composer !== 'undefined' && _composer) {
        if (typeof _updateComposerCamera === 'function') _updateComposerCamera(activeCam);
        _composer.render();
    } else {
        threeRenderer.render(threeScene, activeCam);
    }

    // --- PERF monitor (top-left corner) ---
    if (threeRenderer.info) {
        if (typeof window._perfFrameCount === 'undefined') window._perfFrameCount = 0;
        window._perfFrameCount++;
        if (window._perfFrameCount % 30 === 0) {
            var info = threeRenderer.info.render;
            var _perfDiv = document.getElementById('perf-monitor');
            if (!_perfDiv) {
                _perfDiv = document.createElement('div');
                _perfDiv.id = 'perf-monitor';
                _perfDiv.style.cssText = 'position:fixed;top:4px;left:4px;color:#0f0;font:11px monospace;z-index:99999;background:rgba(0,0,0,0.6);padding:3px 6px;pointer-events:none;';
                document.body.appendChild(_perfDiv);
            }
            _perfDiv.textContent = 'Draw:' + info.calls + ' Tri:' + info.triangles + ' Tex:' + threeRenderer.info.memory.textures;
        }
    }

    // --- 2D overlay: damage numbers + combat info + skill indicators ---
    drawDamageNumbers(dt);
    drawCombatInfo();

    if (typeof updateSkillCastIndicators === 'function') updateSkillCastIndicators(dt);
    if (typeof renderSkillCastIndicators === 'function') renderSkillCastIndicators(ctx);
    if (typeof renderSkillCooldownHUD === 'function') renderSkillCooldownHUD(ctx);
    if (typeof renderAvatarHUD === 'function') renderAvatarHUD();
    if (typeof updateCommandUI === 'function') updateCommandUI(dt);
}
