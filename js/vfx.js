// ============================================================
// LOTA AUTO CHESS — vfx.js — Visual Effects & Particle System
// ============================================================

var VFX_MAX_PARTICLES = 2000;
var vfxParticles = [];
var vfxProjectiles = [];
var vfxScreenFlash = null; // { color, alpha, duration, elapsed }
var vfxScreenShake = null; // { intensity, duration, elapsed }
var vfxZoneVisuals = [];   // persistent zone markers

// --- Particle object pool ---
function createParticle(x, y, vx, vy, color, size, life, type) {
    return {
        x: x, y: y, vx: vx, vy: vy,
        color: color, size: size,
        life: life, maxLife: life,
        type: type || 'circle', // 'circle', 'square', 'ring', 'star'
        alpha: 1.0,
        gravity: 0,
        friction: 0.98,
        shrink: true,
    };
}

// --- Spawn a burst of particles ---
function spawnBurst(x, y, count, config) {
    var col = config.color || '#fff';
    var minSize = config.minSize || 2;
    var maxSize = config.maxSize || 5;
    var speed = config.speed || 80;
    var life = config.life || 0.6;
    var type = config.type || 'circle';
    var gravity = config.gravity || 0;
    var spread = config.spread || Math.PI * 2;
    var angle = config.angle || 0;

    for (var i = 0; i < count && vfxParticles.length < VFX_MAX_PARTICLES; i++) {
        var a = angle + (Math.random() - 0.5) * spread;
        var spd = speed * (0.3 + Math.random() * 0.7);
        var sz = minSize + Math.random() * (maxSize - minSize);
        var p = createParticle(
            x + (Math.random() - 0.5) * 6,
            y + (Math.random() - 0.5) * 6,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            col, sz, life * (0.6 + Math.random() * 0.4), type
        );
        p.gravity = gravity;
        if (config.shrink !== undefined) p.shrink = config.shrink;
        if (config.friction !== undefined) p.friction = config.friction;
        vfxParticles.push(p);
    }
}

// --- Spawn rising particles (heals, buffs) ---
function spawnRising(x, y, count, config) {
    var col = config.color || '#34d399';
    for (var i = 0; i < count && vfxParticles.length < VFX_MAX_PARTICLES; i++) {
        var p = createParticle(
            x + (Math.random() - 0.5) * 20,
            y + Math.random() * 10,
            (Math.random() - 0.5) * 15,
            -(30 + Math.random() * 40),
            col, 2 + Math.random() * 3, config.life || 0.8, 'circle'
        );
        p.gravity = -10;
        p.friction = 0.97;
        vfxParticles.push(p);
    }
}

// --- Spawn ring/aoe expanding effect ---
function spawnRing(x, y, radius, config) {
    var col = config.color || '#60a5fa';
    var count = config.count || Math.round(radius * 8);
    for (var i = 0; i < count && vfxParticles.length < VFX_MAX_PARTICLES; i++) {
        var a = (Math.PI * 2 / count) * i;
        var r = radius * CELL_SIZE * (0.3 + Math.random() * 0.7);
        var p = createParticle(
            x + Math.cos(a) * r * 0.2,
            y + Math.sin(a) * r * 0.2,
            Math.cos(a) * r * 1.5,
            Math.sin(a) * r * 1.5,
            col, 2 + Math.random() * 3, config.life || 0.5, 'circle'
        );
        p.friction = 0.92;
        vfxParticles.push(p);
    }
}

// --- Spawn trail between two points ---
function spawnTrail(x1, y1, x2, y2, config) {
    var col = config.color || '#a78bfa';
    var count = config.count || 15;
    for (var i = 0; i < count && vfxParticles.length < VFX_MAX_PARTICLES; i++) {
        var t = i / count;
        var x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 8;
        var y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 8;
        var p = createParticle(x, y, (Math.random()-0.5)*10, (Math.random()-0.5)*10,
            col, 2 + Math.random() * 2, 0.4 + Math.random() * 0.3, 'circle');
        p.friction = 0.95;
        vfxParticles.push(p);
    }
}

// --- Projectile (travels from A to B, then triggers impact) ---
function spawnProjectile(x1, y1, x2, y2, config) {
    vfxProjectiles.push({
        x: x1, y: y1,
        targetX: x2, targetY: y2,
        speed: config.speed || 400,
        color: config.color || '#fff',
        size: config.size || 4,
        trail: config.trail !== false,
        trailColor: config.trailColor || config.color || '#fff',
        impactColor: config.impactColor || config.color || '#fff',
        impactSize: config.impactSize || 8,
        impactCount: config.impactCount || 12,
        elapsed: 0,
        type: config.type || 'circle',
    });
}

// --- Screen flash ---
function triggerScreenFlash(color, duration) {
    vfxScreenFlash = { color: color, alpha: 0.4, duration: duration || 0.3, elapsed: 0 };
}

// --- Screen shake ---
function triggerScreenShake(intensity, duration) {
    vfxScreenShake = { intensity: intensity || 4, duration: duration || 0.3, elapsed: 0 };
}

// --- Zone visual (persistent area markers) ---
function addZoneVisual(row, col, radius, color, duration) {
    var pos = cellToPixel(row, col);
    vfxZoneVisuals.push({
        x: pos.x, y: pos.y,
        radius: radius,
        color: color || 'rgba(34,197,94,0.3)',
        borderColor: color || 'rgba(34,197,94,0.6)',
        duration: duration || 4,
        elapsed: 0,
        pulsePhase: 0,
    });
}

// ========================================
// HIGH-LEVEL EFFECT SPAWNERS
// ========================================

// --- Melee attack slash ---
function vfxMeleeAttack(attackerX, attackerY, targetX, targetY, charId, isCrit) {
    var dx = targetX - attackerX;
    var dy = targetY - attackerY;
    var angle = Math.atan2(dy, dx);
    var colors = CHAR_COLORS[charId] || { fill: '#fff', stroke: '#aaa' };
    var col = isCrit ? COL_CRIT : colors.fill;
    var count = isCrit ? 18 : 10;

    spawnBurst(targetX, targetY, count, {
        color: col, speed: isCrit ? 120 : 70, life: 0.4,
        minSize: 2, maxSize: isCrit ? 6 : 4,
        angle: angle, spread: Math.PI * 0.6,
    });

    // Slash arc
    for (var i = 0; i < 6 && vfxParticles.length < VFX_MAX_PARTICLES; i++) {
        var arcAngle = angle - 0.4 + (0.8 / 5) * i;
        var dist = CELL_SIZE * 0.3;
        var p = createParticle(
            targetX + Math.cos(arcAngle) * dist,
            targetY + Math.sin(arcAngle) * dist,
            Math.cos(arcAngle) * 20, Math.sin(arcAngle) * 20,
            col, isCrit ? 4 : 3, 0.25, 'square'
        );
        p.friction = 0.9;
        vfxParticles.push(p);
    }
}

// --- Ranged attack projectile ---
function vfxRangedAttack(attackerX, attackerY, targetX, targetY, charId, isCrit) {
    var colors = CHAR_COLORS[charId] || { fill: '#fff' };
    var col = isCrit ? COL_CRIT : colors.fill;
    spawnProjectile(attackerX, attackerY, targetX, targetY, {
        color: col, size: isCrit ? 5 : 3,
        speed: 350, trailColor: col,
        impactColor: col, impactCount: isCrit ? 15 : 8,
    });
}

// --- Ability: Tesi Difettosa (purple bolt) ---
function vfxTesi(casterX, casterY, targetX, targetY) {
    spawnProjectile(casterX, casterY, targetX, targetY, {
        color: '#c084fc', size: 5, speed: 300,
        trailColor: '#a855f7', impactColor: '#7c3aed', impactCount: 16,
    });
}

// --- Ability: Furia del Nord activation ---
function vfxFuriaActivation(x, y) {
    spawnBurst(x, y, 25, { color: '#ef4444', speed: 100, life: 0.6, minSize: 3, maxSize: 7 });
    spawnRing(x, y, 1.5, { color: '#ef4444', life: 0.5, count: 20 });
    triggerScreenShake(3, 0.2);
}

// --- Ability: Veleno (poison puff) ---
function vfxPoison(x, y) {
    spawnBurst(x, y, 12, { color: '#22c55e', speed: 40, life: 0.7, minSize: 2, maxSize: 5 });
}

// --- Heal effect ---
function vfxHeal(x, y) {
    spawnRising(x, y, 12, { color: '#34d399', life: 0.7 });
}

// --- Shield gain ---
function vfxShield(x, y) {
    spawnRing(x, y, 0.5, { color: '#93c5fd', life: 0.5, count: 16 });
}

// --- Teleport (poof) ---
function vfxTeleport(x, y, color) {
    spawnBurst(x, y, 20, { color: color || '#a78bfa', speed: 80, life: 0.5, minSize: 2, maxSize: 5 });
    spawnRing(x, y, 0.8, { color: color || '#a78bfa', life: 0.4, count: 16 });
}

// --- Buff activation (aura glow) ---
function vfxBuff(x, y, color) {
    spawnRising(x, y, 10, { color: color || '#fbbf24', life: 0.6 });
    spawnRing(x, y, 0.6, { color: color || '#fbbf24', life: 0.4, count: 12 });
}

// --- AOE damage ---
function vfxAOE(x, y, radius, color) {
    spawnRing(x, y, radius, { color: color || '#ef4444', life: 0.6, count: radius * 12 });
    spawnBurst(x, y, 15, { color: color || '#ef4444', speed: 60, life: 0.5 });
    triggerScreenShake(2, 0.15);
}

// --- Freeze/Stun ---
function vfxFreeze(x, y) {
    spawnBurst(x, y, 14, { color: '#93c5fd', speed: 50, life: 0.6, minSize: 2, maxSize: 5, type: 'square' });
}

// --- Silence ---
function vfxSilence(x, y) {
    spawnBurst(x, y, 10, { color: '#f472b6', speed: 40, life: 0.5, minSize: 2, maxSize: 4 });
}

// --- Death explosion ---
function vfxDeath(x, y, charId) {
    var colors = CHAR_COLORS[charId] || { fill: '#888' };
    spawnBurst(x, y, 20, { color: colors.fill, speed: 90, life: 0.7, minSize: 2, maxSize: 6, gravity: 50 });
}

// --- Skill: generic targeted impact ---
function vfxSkillImpact(casterX, casterY, targetX, targetY, color) {
    spawnProjectile(casterX, casterY, targetX, targetY, {
        color: color || '#a78bfa', size: 5, speed: 350,
        trailColor: color || '#a78bfa', impactColor: color || '#a78bfa', impactCount: 14,
    });
}

// --- Skill: AOE around caster ---
function vfxSkillAOE(x, y, radius, color) {
    vfxAOE(x, y, radius, color);
}

// --- Skill: self buff ---
function vfxSkillSelfBuff(x, y, color) {
    vfxBuff(x, y, color);
}

// --- Skill: global (screen flash + particles at all enemy positions) ---
function vfxSkillGlobal(color) {
    triggerScreenFlash(color || '#a78bfa', 0.3);
}

// --- Skill: Zone creation ---
function vfxSkillZone(row, col, radius, color, duration) {
    addZoneVisual(row, col, radius, color, duration);
    var pos = cellToPixel(row, col);
    spawnRing(pos.x, pos.y, radius, { color: color || '#22c55e', life: 0.6, count: 20 });
}

// --- Skill: Dash/charge trail ---
function vfxDash(x1, y1, x2, y2, color) {
    spawnTrail(x1, y1, x2, y2, { color: color || '#ef4444', count: 20 });
    spawnBurst(x2, y2, 12, { color: color || '#ef4444', speed: 80, life: 0.4 });
    triggerScreenShake(3, 0.15);
}

// --- Skill: Ultimate (big screen shake + flash + ring) ---
function vfxUltimate(x, y, color) {
    triggerScreenFlash(color || '#fbbf24', 0.4);
    triggerScreenShake(6, 0.4);
    spawnBurst(x, y, 35, { color: color || '#fbbf24', speed: 150, life: 0.8, minSize: 3, maxSize: 8 });
    spawnRing(x, y, 3, { color: color || '#fbbf24', life: 0.7, count: 30 });
}

// ========================================
// UPDATE & RENDER
// ========================================

function updateVFX(dt) {
    // Update particles
    var alive = [];
    for (var i = 0; i < vfxParticles.length; i++) {
        var p = vfxParticles[i];
        p.life -= dt;
        if (p.life <= 0) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.alpha = Math.max(0, p.life / p.maxLife);
        if (p.shrink) p.size *= 0.97;

        alive.push(p);
    }
    vfxParticles = alive;

    // Update projectiles
    var aliveProj = [];
    for (var i = 0; i < vfxProjectiles.length; i++) {
        var proj = vfxProjectiles[i];
        var dx = proj.targetX - proj.x;
        var dy = proj.targetY - proj.y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 8) {
            // Impact
            spawnBurst(proj.targetX, proj.targetY, proj.impactCount, {
                color: proj.impactColor, speed: 80, life: 0.4,
                minSize: 2, maxSize: proj.impactSize * 0.6,
            });
            continue;
        }

        var move = proj.speed * dt;
        var ratio = move / dist;
        proj.x += dx * ratio;
        proj.y += dy * ratio;

        // Trail particles
        if (proj.trail && vfxParticles.length < VFX_MAX_PARTICLES) {
            var tp = createParticle(proj.x, proj.y, (Math.random()-0.5)*8, (Math.random()-0.5)*8,
                proj.trailColor, proj.size * 0.6, 0.2, 'circle');
            tp.shrink = true;
            vfxParticles.push(tp);
        }

        aliveProj.push(proj);
    }
    vfxProjectiles = aliveProj;

    // Update screen flash
    if (vfxScreenFlash) {
        vfxScreenFlash.elapsed += dt;
        if (vfxScreenFlash.elapsed >= vfxScreenFlash.duration) vfxScreenFlash = null;
    }

    // Update screen shake
    if (vfxScreenShake) {
        vfxScreenShake.elapsed += dt;
        if (vfxScreenShake.elapsed >= vfxScreenShake.duration) vfxScreenShake = null;
    }

    // Update zone visuals
    var aliveZones = [];
    for (var i = 0; i < vfxZoneVisuals.length; i++) {
        var z = vfxZoneVisuals[i];
        z.elapsed += dt;
        z.pulsePhase += dt * 3;
        if (z.elapsed < z.duration) {
            // Spawn ambient particles
            if (Math.random() < 0.3 && vfxParticles.length < VFX_MAX_PARTICLES) {
                var angle = Math.random() * Math.PI * 2;
                var r = Math.random() * z.radius * CELL_SIZE;
                var px = z.x + Math.cos(angle) * r;
                var py = z.y + Math.sin(angle) * r;
                var tp = createParticle(px, py, (Math.random()-0.5)*5, -(10+Math.random()*20),
                    z.color, 1.5 + Math.random()*2, 0.5 + Math.random()*0.3, 'circle');
                vfxParticles.push(tp);
            }
            aliveZones.push(z);
        }
    }
    vfxZoneVisuals = aliveZones;
}

function renderVFX(ctx) {
    // Apply screen shake offset
    if (vfxScreenShake) {
        var progress = vfxScreenShake.elapsed / vfxScreenShake.duration;
        var intensity = vfxScreenShake.intensity * (1 - progress);
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * intensity * 2,
            (Math.random() - 0.5) * intensity * 2
        );
    }

    // Render zone visuals (below particles)
    for (var i = 0; i < vfxZoneVisuals.length; i++) {
        var z = vfxZoneVisuals[i];
        var progress = z.elapsed / z.duration;
        var alpha = (1 - progress) * 0.3;
        var pulse = 1 + Math.sin(z.pulsePhase) * 0.08;
        var r = z.radius * CELL_SIZE * pulse;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.x, z.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha * 2;
        ctx.strokeStyle = z.borderColor || z.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Render particles
    for (var i = 0; i < vfxParticles.length; i++) {
        var p = vfxParticles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.type === 'circle') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
            ctx.fill();
        } else if (p.type === 'square') {
            var s = p.size;
            ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
        } else if (p.type === 'ring') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, p.size), 0, Math.PI * 2);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (p.type === 'star') {
            ctx.beginPath();
            for (var si = 0; si < 5; si++) {
                var a = (Math.PI * 2 / 5) * si - Math.PI / 2;
                var r1 = p.size;
                var r2 = p.size * 0.4;
                ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
                var a2 = a + Math.PI / 5;
                ctx.lineTo(p.x + Math.cos(a2) * r2, p.y + Math.sin(a2) * r2);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // Render projectiles
    for (var i = 0; i < vfxProjectiles.length; i++) {
        var proj = vfxProjectiles[i];
        ctx.save();
        ctx.fillStyle = proj.color;
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // Screen flash overlay
    if (vfxScreenFlash) {
        var progress = vfxScreenFlash.elapsed / vfxScreenFlash.duration;
        var alpha = vfxScreenFlash.alpha * (1 - progress);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = vfxScreenFlash.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // End screen shake
    if (vfxScreenShake) {
        ctx.restore();
    }
}

// ========================================
// SKILL VFX MAPPING — spawn effects for each skill
// ========================================
function vfxForSkill(skillId, caster, target, allUnits) {
    var cx = caster.px || 0;
    var cy = caster.py || 0;
    var tx = target ? (target.px || 0) : cx;
    var ty = target ? (target.py || 0) : cy;

    switch (skillId) {
        // BABIDI
        case 'babidi_tangente':       vfxSkillImpact(cx, cy, tx, ty, '#fbbf24'); vfxFreeze(tx, ty); break;
        case 'babidi_bolla':          vfxAOE(tx, ty, 2, '#22c55e'); break;
        case 'babidi_contrattazione': spawnTrail(tx, ty, cx, cy, {color:'#fbbf24', count:15}); vfxBuff(cx, cy, '#fbbf24'); break;
        case 'babidi_acquario':       vfxSkillZone(target?target.row:0, target?target.col:0, 1, 'rgba(34,197,94,0.4)', 4); break;
        case 'babidi_svalutazione':   vfxSkillGlobal('#ef4444'); break;
        case 'babidi_fuga':           vfxTeleport(cx, cy, '#a78bfa'); break;
        case 'babidi_inflazione':     vfxSkillGlobal('#22c55e'); vfxBuff(cx, cy, '#22c55e'); break;
        case 'babidi_rete':           vfxBuff(cx, cy, '#fbbf24'); break;
        case 'babidi_bancarotta':     vfxSkillImpact(cx, cy, tx, ty, '#fbbf24'); triggerScreenShake(3, 0.2); break;
        case 'babidi_monopolio':      vfxUltimate(cx, cy, '#fbbf24'); break;

        // CARONTE
        case 'caronte_esame':         vfxSkillImpact(cx, cy, tx, ty, '#94a3b8'); vfxSilence(tx, ty); break;
        case 'caronte_bocciatura':    vfxSkillImpact(cx, cy, tx, ty, '#ef4444'); break;
        case 'caronte_lezione':       vfxSkillGlobal('#60a5fa'); break;
        case 'caronte_tesi_plus':     vfxBuff(cx, cy, '#c084fc'); break;
        case 'caronte_teleport':      vfxTeleport(cx, cy, '#c084fc'); setTimeout(function(){vfxTeleport(cx,cy,'#c084fc');}, 200); break;
        case 'caronte_revisione':     vfxSkillImpact(cx, cy, tx, ty, '#f472b6'); break;
        case 'caronte_plagio':        vfxBuff(cx, cy, '#94a3b8'); break;
        case 'caronte_cattedra':      vfxSkillZone(target?target.row:0, target?target.col:0, 1, 'rgba(148,163,184,0.4)', 4); break;
        case 'caronte_doppio':        vfxBuff(cx, cy, '#c084fc'); break;
        case 'caronte_defenestrazione': vfxUltimate(tx, ty, '#c084fc'); break;

        // VALERIO
        case 'valerio_scossa':        vfxAOE(cx, cy, 2, '#fb923c'); triggerScreenShake(4, 0.25); break;
        case 'valerio_muro':          vfxShield(cx, cy); vfxBuff(cx, cy, '#60a5fa'); break;
        case 'valerio_regen_exp':     vfxHeal(cx, cy); break;
        case 'valerio_divorare':      vfxMeleeAttack(cx, cy, tx, ty, 'Valerio', true); break;
        case 'valerio_tana':          vfxTeleport(cx, cy, '#fb923c'); break;
        case 'valerio_spore':         vfxAOE(cx, cy, 3, '#22c55e'); break;
        case 'valerio_provocazione':  vfxUltimate(cx, cy, '#ef4444'); break;
        case 'valerio_scudo_simb':    vfxShield(tx, ty); spawnTrail(cx, cy, tx, ty, {color:'#60a5fa'}); break;
        case 'valerio_metamorfosi':   vfxBuff(cx, cy, '#fb923c'); vfxRing(cx, cy, 1, {color:'#fb923c'}); break;
        case 'valerio_terremoto':     vfxUltimate(cx, cy, '#fb923c'); break;

        // YUJIN
        case 'yujin_urlo':           vfxAOE(cx, cy, 2, '#ef4444'); break;
        case 'yujin_esecutore':      vfxMeleeAttack(cx, cy, tx, ty, 'Yujin', true); triggerScreenShake(3, 0.15); break;
        case 'yujin_carica':         vfxDash(cx, cy, tx, ty, '#ef4444'); break;
        case 'yujin_ghiaccio':       vfxShield(cx, cy); vfxBuff(cx, cy, '#93c5fd'); break;
        case 'yujin_vento':          vfxAOE(cx, cy, 2, '#93c5fd'); break;
        case 'yujin_giuramento':     vfxBuff(cx, cy, '#ef4444'); spawnRising(cx, cy, 8, {color:'#ef4444'}); break;
        case 'yujin_frenesia':       vfxMeleeAttack(cx, cy, tx, ty, 'Yujin', false); break;
        case 'yujin_muro_lame':      vfxBuff(cx, cy, '#f87171'); break;
        case 'yujin_ragnarok_p':     vfxBuff(cx, cy, '#ef4444'); triggerScreenFlash('#ef4444', 0.2); break;
        case 'yujin_valchiria':      vfxUltimate(cx, cy, '#fbbf24'); break;

        // WMS
        case 'wms_distorsione':      vfxSkillGlobal('#a78bfa'); vfxBuff(cx, cy, '#a78bfa'); break;
        case 'wms_benedizione':      vfxSkillImpact(cx, cy, tx, ty, '#fbbf24'); vfxBuff(tx, ty, '#fbbf24'); break;
        case 'wms_essenza':          vfxSkillGlobal('#34d399'); break;
        case 'wms_specchio':         vfxShield(cx, cy); vfxBuff(cx, cy, '#93c5fd'); break;
        case 'wms_vuoto':            vfxSkillImpact(cx, cy, tx, ty, '#1e1b4b'); spawnBurst(tx,ty,15,{color:'#4c1d95',speed:60,life:0.5}); break;
        case 'wms_anomalia':         vfxAOE(cx, cy, 4, '#a78bfa'); triggerScreenShake(4, 0.3); break;
        case 'wms_sdoppiamento':     vfxBuff(cx, cy, '#a78bfa'); vfxTeleport(cx+20, cy, '#a78bfa'); break;
        case 'wms_onda':             vfxSkillGlobal('#c084fc'); vfxRing(cx, cy, 4, {color:'#c084fc',life:0.6}); break;
        case 'wms_trascendenza':     vfxUltimate(cx, cy, '#a78bfa'); break;
        case 'wms_singolarita':      vfxUltimate(cx, cy, '#7c3aed'); triggerScreenFlash('#1e1b4b', 0.5); break;

        default: vfxBuff(cx, cy, '#a78bfa'); break;
    }
}

// Alias for spawnRing used in mapping above
var vfxRing = spawnRing;
