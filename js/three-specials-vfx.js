// ============================================================
// LOTA AUTO CHESS — three-specials-vfx.js — 3D VFX for specials
// ============================================================

var _specialVfxState = {
    chargeParticles: [],
    stormParticles: [],
    targetCircle: null,
    totems: {},           // totemId → { group, idle timer }
    arrowRainZones: [],   // { group, timer, maxTime }
    chargeTrail: null,
};

var _TILE = function() { return typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0; };
var _TILEY = function() { return typeof UNIT_BASE_Y !== 'undefined' ? UNIT_BASE_Y : 0.15; };

// ════════════════════════════════════════════════════════════
//  START / END helpers
// ════════════════════════════════════════════════════════════
function vfxSpecialStart(avatar, classId) {
    if (!threeScene) return;
    var Y = _TILEY();
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);

    // Class-specific activation colors
    var colors = { guerriero: '#ff3300', stratega: '#3b82f6', mistico: '#22c55e', stregone: '#a855f7' };
    var col = colors[classId] || '#ffffff';

    // Ring burst at avatar feet
    if (typeof _ring3D === 'function') _ring3D(avX, Y + 0.05, avZ, 0.6, col, 16, 0.3);
    // Rising particles
    if (typeof _burst3D === 'function') _burst3D(avX, Y + 0.3, avZ, 12, col, 3, 0.25);
}

function vfxSpecialEnd() {
    _clearTargetCircle();
    _clearChargeVfx();
    _clearMarchioVfx();
}

// ════════════════════════════════════════════════════════════
//  TARGET CIRCLE (Stratega / Mistico area selection)
// ════════════════════════════════════════════════════════════
function vfxSpecialTargeting(row, col, radius, isValid, classId) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();

    if (!_specialVfxState.targetCircle) {
        var g = new THREE.Group();
        g.name = 'special_target_circle';

        // Outer ring
        var ringGeo = new THREE.RingGeometry(0.1, radius * T + 0.05, 48);
        var ringMat = new THREE.MeshBasicMaterial({
            color: 0x3b82f6, transparent: true, opacity: 0.25,
            side: THREE.DoubleSide, depthWrite: false
        });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.name = 'tc_ring';
        g.add(ring);

        // Border ring
        var borderGeo = new THREE.TorusGeometry(radius * T, 0.03, 8, 48);
        var borderMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa, transparent: true, opacity: 0.6
        });
        var border = new THREE.Mesh(borderGeo, borderMat);
        border.rotation.x = Math.PI / 2;
        border.name = 'tc_border';
        g.add(border);

        threeScene.add(g);
        _specialVfxState.targetCircle = g;
    }

    var g = _specialVfxState.targetCircle;
    g.visible = (row >= 0 && col >= 0);
    if (!g.visible) return;

    // Position
    var wp = (typeof cellToWorld === 'function') ? cellToWorld(row, col) : new THREE.Vector3(col * T + T/2, Y, row * T + T/2);
    g.position.set(wp.x, Y + 0.02, wp.z);

    // Update radius only if changed
    var ring = g.getObjectByName('tc_ring');
    var border = g.getObjectByName('tc_border');
    var scaledRadius = radius * T;
    if (ring && g.userData._lastRadius !== scaledRadius) {
        ring.geometry.dispose();
        ring.geometry = new THREE.RingGeometry(0.1, scaledRadius + 0.05, 48);
        if (border) {
            border.geometry.dispose();
            border.geometry = new THREE.TorusGeometry(scaledRadius, 0.03, 8, 48);
        }
        g.userData._lastRadius = scaledRadius;
    }

    // Color based on validity and class
    var validColor, invalidColor;
    if (classId === 'stratega') {
        validColor = 0x3b82f6; invalidColor = 0xef4444;
    } else {
        validColor = 0x22c55e; invalidColor = 0xef4444;
    }
    var col3 = isValid ? validColor : invalidColor;
    if (ring && ring.material) ring.material.color.setHex(col3);
    if (border && border.material) border.material.color.setHex(col3);

    // Pulse animation
    var t = performance.now() / 1000;
    var pulse = 1.0 + Math.sin(t * 4) * 0.05;
    g.scale.set(pulse, 1, pulse);
    if (ring && ring.material) ring.material.opacity = 0.2 + Math.sin(t * 3) * 0.08;
}

function _clearTargetCircle() {
    if (_specialVfxState.targetCircle && threeScene) {
        threeScene.remove(_specialVfxState.targetCircle);
        _specialVfxState.targetCircle.traverse(function(c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        _specialVfxState.targetCircle = null;
    }
}

// ════════════════════════════════════════════════════════════
//  GUERRIERO — CHARGE VFX
// ════════════════════════════════════════════════════════════
var _chargeGlowMesh = null;
var _chargeGlowLight = null;

function vfxSpecialCharging(avatar, chargeTime, maxCharge) {
    if (!threeScene) return;
    var Y = _TILEY();
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var pct = chargeTime / maxCharge;

    // Glow sphere around avatar
    if (!_chargeGlowMesh) {
        var geo = new THREE.SphereGeometry(0.3, 16, 12);
        var mat = new THREE.MeshBasicMaterial({
            color: 0xff3300, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, depthWrite: false
        });
        _chargeGlowMesh = new THREE.Mesh(geo, mat);
        _chargeGlowMesh.name = 'charge_glow';
        threeScene.add(_chargeGlowMesh);

        _chargeGlowLight = new THREE.PointLight(0xff3300, 0, 3);
        _chargeGlowLight.name = 'charge_light';
        threeScene.add(_chargeGlowLight);
    }

    // Scale and intensity grow with charge
    var s = 0.3 + pct * 0.7;
    _chargeGlowMesh.scale.set(s, s, s);
    _chargeGlowMesh.position.set(avX, Y + 0.4, avZ);
    _chargeGlowMesh.material.opacity = 0.1 + pct * 0.3;

    // Color shifts from orange to red
    var r = 1.0, g = 0.4 - pct * 0.3, b = 0;
    _chargeGlowMesh.material.color.setRGB(r, Math.max(0, g), b);

    _chargeGlowLight.position.set(avX, Y + 0.5, avZ);
    _chargeGlowLight.intensity = pct * 4;
    _chargeGlowLight.color.setRGB(r, Math.max(0, g), b);

    // Pulse
    var t = performance.now() / 1000;
    var pulse = 1 + Math.sin(t * (6 + pct * 10)) * 0.08 * pct;
    _chargeGlowMesh.scale.multiplyScalar(pulse);

    // Vortex particles spiraling around avatar
    var vortexN = Math.ceil(1 + pct * 3);
    for (var vi = 0; vi < vortexN; vi++) {
        var angle = performance.now() / 1000 * (3 + pct * 6) + vi * (Math.PI * 2 / vortexN);
        var rad = 0.20 + pct * 0.30;
        var px = avX + Math.cos(angle) * rad;
        var pz = avZ + Math.sin(angle) * rad;
        if (typeof _spawn3D === 'function') {
            var vp = _spawn3D(
                { x: px, y: Y + 0.15 + Math.random() * 0.3, z: pz },
                { x: -Math.sin(angle) * 2.0, y: 1.5 + pct * 1.5, z: Math.cos(angle) * 2.0 },
                pct > 0.7 ? '#ff2200' : (pct > 0.4 ? '#ff6600' : '#ff8c42'),
                0.35 + pct * 0.3, 0.25 + pct * 0.15
            );
            if (vp) { vp.gravity = -0.5; vp.shrink = true; }
        }
    }
    // Ground energy ring pulse at high charge
    if (pct > 0.5 && Math.random() < pct * 0.4) {
        if (typeof _ring3D === 'function') {
            _ring3D(avX, Y + 0.03, avZ, 0.3 + pct * 0.4, pct > 0.7 ? '#ff2200' : '#ff6600', 10, 0.15);
        }
    }
    // Rising embers at high charge
    if (pct > 0.3 && Math.random() < 0.3 + pct * 0.5) {
        if (typeof _rising3D === 'function') {
            var eAngle = Math.random() * Math.PI * 2;
            var eRad = 0.1 + Math.random() * 0.2 * (1 + pct);
            _rising3D(avX + Math.cos(eAngle) * eRad, Y + 0.05, avZ + Math.sin(eAngle) * eRad,
                      1 + Math.round(pct * 2), pct > 0.7 ? '#fbbf24' : '#ff8c42', 0.35 + pct * 0.25);
        }
    }
}

function _clearChargeVfx() {
    if (_chargeGlowMesh && threeScene) {
        threeScene.remove(_chargeGlowMesh);
        _chargeGlowMesh.geometry.dispose();
        _chargeGlowMesh.material.dispose();
        _chargeGlowMesh = null;
    }
    if (_chargeGlowLight && threeScene) {
        threeScene.remove(_chargeGlowLight);
        _chargeGlowLight = null;
    }
}

function vfxGuerrieroCharge(fromX, fromY, fromZ, toX, toY, toZ, chargePct, hitEnemies) {
    if (!threeScene) return;
    _clearChargeVfx();

    var Y = fromY;
    var dx = toX - fromX, dz = toZ - fromZ;
    var pathLen = Math.sqrt(dx*dx + dz*dz) || 1;
    var ndx = dx / pathLen, ndz = dz / pathLen;

    // ── Fire trail along charge path ────────────────────────
    var steps = 24;
    for (var i = 0; i < steps; i++) {
        var t = i / steps;
        var px = fromX + dx * t;
        var pz = fromZ + dz * t;
        // Core fire burst
        if (typeof _burst3D === 'function') {
            _burst3D(px, Y + 0.18, pz, 4 + Math.round(chargePct * 6), '#ff4400', 3.5 + chargePct * 3, 0.25 + chargePct * 0.20);
        }
        // Side sparks (alternating left/right)
        if (typeof _spawn3D === 'function' && i % 3 === 0) {
            var side = (i % 2 === 0) ? 1 : -1;
            var sp = _spawn3D(
                { x: px + ndz * side * 0.15, y: Y + 0.12, z: pz - ndx * side * 0.15 },
                { x: ndz * side * (2.5 + chargePct * 2), y: 0.8 + Math.random() * 1.2, z: -ndx * side * (2.5 + chargePct * 2) },
                '#fbbf24', 0.35, 0.25 + chargePct * 0.10
            );
            if (sp) sp.gravity = -4.0;
        }
    }

    // ── Ground dust trail ───────────────────────────────────
    if (typeof _spawn3D === 'function') {
        for (var gi = 0; gi < 16; gi++) {
            var gt = gi / 16;
            var gx = fromX + dx * gt + (Math.random()-0.5) * 0.3;
            var gz = fromZ + dz * gt + (Math.random()-0.5) * 0.3;
            var gp = _spawn3D(
                { x: gx, y: Y + 0.02, z: gz },
                { x: (Math.random()-0.5)*1.5, y: 0.4 + Math.random()*0.6, z: (Math.random()-0.5)*1.5 },
                '#8b7355', 0.5 + Math.random()*0.4, 0.30 + Math.random()*0.20
            );
            if (gp) gp.gravity = -5.0;
        }
    }

    // ── Per-enemy shockwave impact ──────────────────────────
    for (var i = 0; i < hitEnemies.length; i++) {
        var hx = hitEnemies[i].x, hz = hitEnemies[i].z;
        if (typeof _ring3D === 'function') {
            _ring3D(hx, Y + 0.02, hz, 0.6, '#ff2200', 18, 0.28);
            _ring3D(hx, Y + 0.08, hz, 0.3, '#fbbf24', 10, 0.20);
        }
        if (typeof _burst3D === 'function') {
            _burst3D(hx, Y + 0.25, hz, 12 + Math.round(chargePct * 8), '#ff4400', 5.0, 0.32);
        }
        // Directional sparks on hit enemy
        if (typeof _spawn3D === 'function') {
            for (var si = 0; si < 6; si++) {
                var sp2 = _spawn3D(
                    { x: hx + (Math.random()-0.5)*0.1, y: Y + 0.2, z: hz + (Math.random()-0.5)*0.1 },
                    { x: ndx*(2+Math.random()*3) + (Math.random()-0.5)*2, y: 1.5 + Math.random()*2, z: ndz*(2+Math.random()*3) + (Math.random()-0.5)*2 },
                    Math.random() < 0.5 ? '#ffd700' : '#ff4400', 0.3, 0.25 + Math.random()*0.15
                );
                if (sp2) sp2.gravity = -4.5;
            }
        }
    }

    // ── Destination impact explosion ────────────────────────
    if (typeof _ring3D === 'function') {
        _ring3D(toX, Y + 0.02, toZ, 0.8 + chargePct * 0.6, '#ff4400', 26, 0.35);
        _ring3D(toX, Y + 0.08, toZ, 0.4 + chargePct * 0.3, '#fbbf24', 14, 0.25);
    }
    if (typeof _burst3D === 'function') {
        _burst3D(toX, Y + 0.4, toZ, 16 + Math.round(chargePct * 12), '#ff3300', 5.5, 0.40);
    }
    if (typeof _rising3D === 'function') {
        _rising3D(toX, Y, toZ, 8 + Math.round(chargePct * 6), '#fbbf24', 0.55);
    }
    if (typeof triggerScreenFlash === 'function') {
        triggerScreenFlash('#ff4400', 0.10 + chargePct * 0.10);
    }
}

// ════════════════════════════════════════════════════════════
//  STRATEGA — ARROW RAIN VFX
// ════════════════════════════════════════════════════════════
function vfxArrowRainStart(row, col, radius, totalDuration) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();
    var wp = (typeof cellToWorld === 'function') ? cellToWorld(row, col) : new THREE.Vector3(col * T + T/2, Y, row * T + T/2);

    var g = new THREE.Group();
    g.name = 'arrow_rain_zone';

    // Outer ring (border)
    var ringGeo = new THREE.RingGeometry(radius * T - 0.04, radius * T + 0.04, 48);
    var ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24, transparent: true, opacity: 0.30,
        side: THREE.DoubleSide, depthWrite: false
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);

    // Inner danger disc
    var discGeo = new THREE.CircleGeometry(radius * T * 0.92, 36);
    var discMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false
    });
    var disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.005;
    g.add(disc);

    // Crosshair lines (tactical feel)
    for (var _li = 0; _li < 4; _li++) {
        var _la = (_li / 4) * Math.PI;
        var lineGeo = new THREE.BufferGeometry();
        var lR = radius * T * 0.9;
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            Math.cos(_la)*lR, 0.01, Math.sin(_la)*lR,
            -Math.cos(_la)*lR, 0.01, -Math.sin(_la)*lR
        ], 3));
        var lineMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.12 });
        g.add(new THREE.Line(lineGeo, lineMat));
    }

    g.position.set(wp.x, Y + 0.02, wp.z);
    threeScene.add(g);

    _specialVfxState.arrowRainZones.push({
        group: g,
        timer: 0,
        maxTime: totalDuration + 0.5,
        cx: wp.x, cz: wp.z, radius: radius * T,
    });

    // Initial warning: rising particles + ring flash
    if (typeof _ring3D === 'function') _ring3D(wp.x, Y + 0.05, wp.z, radius * T * 0.5, '#fbbf24', 16, 0.20);
    if (typeof _rising3D === 'function') _rising3D(wp.x, Y, wp.z, 10, '#fbbf24', 0.45);
}

function vfxArrowRainWave(row, col, radius) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();
    var wp = (typeof cellToWorld === 'function') ? cellToWorld(row, col) : new THREE.Vector3(col * T + T/2, Y, row * T + T/2);

    // More arrows, faster, steeper — rain of death feel
    var count = 14 + radius * 6;
    for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var r = Math.random() * radius * T;
        var px = wp.x + Math.cos(angle) * r;
        var pz = wp.z + Math.sin(angle) * r;
        var startY = Y + 4.5 + Math.random() * 3;

        // Fast falling arrow
        if (typeof _spawn3D === 'function') {
            var p = _spawn3D(
                { x: px, y: startY, z: pz },
                { x: (Math.random()-0.5)*0.3, y: -14 - Math.random()*6, z: (Math.random()-0.5)*0.3 },
                i < 4 ? '#ffffff' : '#fbbf24', 0.05 + Math.random()*0.03,
                0.22 + Math.random()*0.10
            );
            if (p) p.gravity = -8;
        }

        // Per-arrow ground spark on impact (staggered)
        if (i % 3 === 0 && typeof _burst3D === 'function') {
            _burst3D(px, Y + 0.08, pz, 4, '#ffd700', 2.5, 0.14);
        }
    }

    // Double ground ring — inner fast + outer slow
    if (typeof _ring3D === 'function') {
        _ring3D(wp.x, Y + 0.03, wp.z, radius * T * 0.5, '#fbbf24', 18, 0.22);
        _ring3D(wp.x, Y + 0.03, wp.z, radius * T * 1.0, '#f59e0b', 12, 0.12);
    }

    // Dust cloud rising from impact zone
    if (typeof _rising3D === 'function') {
        _rising3D(wp.x, Y, wp.z, 8, '#d4a574', 0.35);
    }

    if (typeof triggerScreenShake === 'function') triggerScreenShake(2.2, 0.14);
}

function vfxArrowRainHit(wx, wz) {
    var Y = _TILEY();
    // More impactful per-enemy hit: burst + upward sparks
    if (typeof _burst3D === 'function') {
        _burst3D(wx, Y + 0.15, wz, 8, '#fbbf24', 3.5, 0.22);
    }
    // Small upward sparks
    if (typeof _rising3D === 'function') {
        _rising3D(wx, Y, wz, 4, '#ffd700', 0.25);
    }
}

// ════════════════════════════════════════════════════════════
//  MISTICO — TOTEM VFX
// ════════════════════════════════════════════════════════════
function vfxTotemSpawn(row, col, totemId) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();
    var wp = (typeof cellToWorld === 'function') ? cellToWorld(row, col) : new THREE.Vector3(col * T + T/2, Y, row * T + T/2);

    var g = new THREE.Group();
    g.name = 'totem_' + totemId;

    // Base stone
    var base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8 })
    );
    base.position.y = 0.04;
    g.add(base);

    // Totem pillar
    var pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })
    );
    pillar.position.y = 0.33;
    g.add(pillar);

    // Carved face/rune rings on the pillar
    for (var i = 0; i < 3; i++) {
        var rune = new THREE.Mesh(
            new THREE.TorusGeometry(0.07, 0.012, 4, 12),
            new THREE.MeshStandardMaterial({
                color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.6
            })
        );
        rune.rotation.x = Math.PI / 2;
        rune.position.y = 0.18 + i * 0.14;
        g.add(rune);
    }

    // Glowing crystal top
    var crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08),
        new THREE.MeshStandardMaterial({
            color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 0.8,
            roughness: 0.2
        })
    );
    crystal.position.y = 0.65;
    crystal.name = 'totem_crystal';
    g.add(crystal);

    // Light
    var light = new THREE.PointLight(0x22c55e, 2, 3);
    light.position.y = 0.65;
    light.name = 'totem_light';
    g.add(light);

    g.position.set(wp.x, Y, wp.z);
    threeScene.add(g);

    _specialVfxState.totems[totemId] = { group: g, age: 0 };

    // Spawn burst
    if (typeof _burst3D === 'function') _burst3D(wp.x, Y + 0.3, wp.z, 20, '#22c55e', 4, 0.3);
    if (typeof _ring3D === 'function') _ring3D(wp.x, Y + 0.05, wp.z, 0.5, '#22c55e', 16, 0.3);
}

function vfxTotemIdle(totem, dt) {
    var entry = _specialVfxState.totems[totem.id];
    if (!entry) return;
    entry.age += dt;

    var crystal = entry.group.getObjectByName('totem_crystal');
    if (crystal) {
        var t = entry.age;
        crystal.rotation.y += dt * 1.5;
        var s = 1 + Math.sin(t * 2.5) * 0.1;
        crystal.scale.set(s, s, s);
        if (crystal.material) crystal.material.emissiveIntensity = 0.6 + Math.sin(t * 2.5) * 0.3;
    }

    var light = entry.group.getObjectByName('totem_light');
    if (light) light.intensity = 2 + Math.sin(entry.age * 2.5) * 0.5;
}

function vfxTotemAttack(totemRow, totemCol, target) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();
    var wp = (typeof cellToWorld === 'function') ? cellToWorld(totemRow, totemCol) : new THREE.Vector3(totemCol * T + T/2, Y, totemRow * T + T/2);
    var tx = (target._smoothWX !== undefined) ? target._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).x : target.col);
    var tz = (target._smoothWZ !== undefined) ? target._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(target.row, target.col).z : target.row);

    // Green bolt projectile
    if (typeof _projectile3D === 'function') {
        _projectile3D(
            { x: wp.x, y: Y + 0.6, z: wp.z },
            { x: tx, y: Y + 0.3, z: tz },
            '#4ade80', 12, '#22c55e', 8
        );
    }
}

function vfxTotemDestroy(totemId) {
    var entry = _specialVfxState.totems[totemId];
    if (!entry) return;

    var pos = entry.group.position;
    if (typeof _burst3D === 'function') _burst3D(pos.x, pos.y + 0.3, pos.z, 16, '#6b7280', 4, 0.3);
    if (typeof _ring3D === 'function') _ring3D(pos.x, pos.y + 0.05, pos.z, 0.4, '#4ade80', 12, 0.25);

    if (threeScene) threeScene.remove(entry.group);
    entry.group.traverse(function(c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
    });
    delete _specialVfxState.totems[totemId];
}

function vfxClearAllTotems() {
    for (var id in _specialVfxState.totems) {
        vfxTotemDestroy(id);
    }
    _specialVfxState.totems = {};
}

// ════════════════════════════════════════════════════════════
//  STREGONE — MARCHIO ARCANO (ground sigil + upward emission)
// ════════════════════════════════════════════════════════════
var _marchioSigil = null;   // { ring, disc, runes[], light }
var _marchioLight = null;

function _clearMarchioVfx() {
    if (_marchioSigil && threeScene) {
        if (_marchioSigil.ring) { threeScene.remove(_marchioSigil.ring); _marchioSigil.ring.geometry.dispose(); _marchioSigil.ring.material.dispose(); }
        if (_marchioSigil.disc) { threeScene.remove(_marchioSigil.disc); _marchioSigil.disc.geometry.dispose(); _marchioSigil.disc.material.dispose(); }
        for (var i = 0; i < _marchioSigil.runes.length; i++) {
            threeScene.remove(_marchioSigil.runes[i]);
            _marchioSigil.runes[i].geometry.dispose();
            _marchioSigil.runes[i].material.dispose();
        }
        _marchioSigil = null;
    }
    if (_marchioLight && threeScene) {
        threeScene.remove(_marchioLight);
        _marchioLight.dispose && _marchioLight.dispose();
        _marchioLight = null;
    }
}

// Called each frame while charging (right-click held)
function vfxMarchioCharging(avatar, chargeTime, maxCharge) {
    if (!threeScene) return;
    var T = _TILE();
    var Y = _TILEY();
    var avX = (avatar._smoothWX !== undefined) ? avatar._smoothWX : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).x : avatar.col);
    var avZ = (avatar._smoothWZ !== undefined) ? avatar._smoothWZ : (typeof cellToWorld === 'function' ? cellToWorld(avatar.row, avatar.col).z : avatar.row);
    var pct = chargeTime / maxCharge;
    var t = performance.now() / 1000;

    // Create sigil geometry on first call
    if (!_marchioSigil) {
        var baseR = 0.5 * T;
        // Outer ring (torus on ground)
        var ringGeo = new THREE.TorusGeometry(baseR, 0.025, 8, 48);
        var ringMat = new THREE.MeshBasicMaterial({ color: '#a855f7', transparent: true, opacity: 0.5, depthWrite: false });
        var ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(avX, Y + 0.02, avZ);
        threeScene.add(ring);

        // Inner disc (translucent ground fill)
        var discGeo = new THREE.CircleGeometry(baseR, 48);
        var discMat = new THREE.MeshBasicMaterial({ color: '#7e22ce', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
        var disc = new THREE.Mesh(discGeo, discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(avX, Y + 0.01, avZ);
        threeScene.add(disc);

        // Rune markers (small tori around the circle)
        var runes = [];
        for (var i = 0; i < 6; i++) {
            var ra = (i / 6) * Math.PI * 2;
            var runeGeo = new THREE.TorusGeometry(0.04, 0.008, 4, 8);
            var runeMat = new THREE.MeshBasicMaterial({ color: '#e879f9', transparent: true, opacity: 0.6, depthWrite: false });
            var rune = new THREE.Mesh(runeGeo, runeMat);
            rune.rotation.x = -Math.PI / 2;
            rune.position.set(avX + Math.cos(ra) * baseR * 0.75, Y + 0.03, avZ + Math.sin(ra) * baseR * 0.75);
            threeScene.add(rune);
            runes.push(rune);
        }

        _marchioSigil = { ring: ring, disc: disc, runes: runes, baseR: baseR };

        // Point light from below
        _marchioLight = new THREE.PointLight(0xa855f7, 0, 4);
        _marchioLight.name = 'marchio_light';
        threeScene.add(_marchioLight);
    }

    // Grow sigil with charge
    var scaleR = 1.0 + pct * 0.8;
    _marchioSigil.ring.scale.set(scaleR, scaleR, 1);
    _marchioSigil.ring.position.set(avX, Y + 0.02, avZ);
    _marchioSigil.ring.material.opacity = 0.3 + pct * 0.5;
    // Color shifts from purple to bright magenta
    var cr = 0.66 + pct * 0.25, cg = 0.13 + pct * 0.1, cb = 0.97;
    _marchioSigil.ring.material.color.setRGB(cr, cg, cb);

    _marchioSigil.disc.scale.set(scaleR, scaleR, 1);
    _marchioSigil.disc.position.set(avX, Y + 0.01, avZ);
    _marchioSigil.disc.material.opacity = 0.05 + pct * 0.2;

    // Rotate rune markers and pulse
    for (var i = 0; i < _marchioSigil.runes.length; i++) {
        var ra = (i / 6) * Math.PI * 2 + t * (1.5 + pct * 3);
        var runeR = _marchioSigil.baseR * 0.75 * scaleR;
        _marchioSigil.runes[i].position.set(avX + Math.cos(ra) * runeR, Y + 0.03, avZ + Math.sin(ra) * runeR);
        _marchioSigil.runes[i].material.opacity = 0.4 + Math.sin(t * 6 + i) * 0.2 * pct;
        var runeS = 1.0 + pct * 0.6 + Math.sin(t * 8 + i * 1.5) * 0.15;
        _marchioSigil.runes[i].scale.setScalar(runeS);
    }

    // Light intensity grows with charge
    _marchioLight.position.set(avX, Y + 0.3, avZ);
    _marchioLight.intensity = pct * 5;
    _marchioLight.distance = 2 + pct * 3;

    // Spiraling particles drawn INWARD toward center (energy gathering)
    if (Math.random() < 0.4 + pct * 0.6) {
        var sa = Math.random() * Math.PI * 2;
        var sr = _marchioSigil.baseR * scaleR * (0.6 + Math.random() * 0.5);
        var px = avX + Math.cos(sa) * sr;
        var pz = avZ + Math.sin(sa) * sr;
        // Velocity toward center with upward component
        var toCX = (avX - px) * 2.5, toCZ = (avZ - pz) * 2.5;
        if (typeof _spawn3D === 'function') {
            var sp = _spawn3D(
                { x: px, y: Y + 0.05 + Math.random() * 0.1, z: pz },
                { x: toCX, y: 0.3 + pct * 0.5, z: toCZ },
                Math.random() > 0.5 ? '#a855f7' : '#e879f9',
                0.08 + pct * 0.06, 0.3 + pct * 0.15
            );
            if (sp) sp.gravity = 0;
        }
    }

    // Ground pulse ring occasionally
    if (pct > 0.3 && Math.random() < 0.08 + pct * 0.12) {
        if (typeof _ring3D === 'function') {
            _ring3D(avX, Y + 0.03, avZ, _marchioSigil.baseR * scaleR * (0.4 + Math.random() * 0.4), '#c084fc', 10, 0.2);
        }
    }
}

// Called on release — massive upward energy column
function vfxMarchioRelease(wx, wy, wz, radiusW, chargePct) {
    if (!threeScene) return;
    _clearMarchioVfx();

    var columnHeight = 2.0 + chargePct * 3.0;
    var particleCount = Math.round(20 + chargePct * 40);

    // ── Ground explosion ring ──
    if (typeof _ring3D === 'function') {
        _ring3D(wx, wy + 0.05, wz, radiusW * 0.5, '#e879f9', 20, 0.4);
        _ring3D(wx, wy + 0.05, wz, radiusW * 1.0, '#a855f7', 28, 0.3);
        if (chargePct > 0.7) _ring3D(wx, wy + 0.05, wz, radiusW * 1.5, '#7e22ce', 32, 0.25);
    }

    // ── Upward energy column (main effect) ──
    for (var i = 0; i < particleCount; i++) {
        var angle = Math.random() * Math.PI * 2;
        var r = Math.random() * radiusW * 0.6;
        var px = wx + Math.cos(angle) * r;
        var pz = wz + Math.sin(angle) * r;
        var upSpeed = 4.0 + Math.random() * columnHeight * 2;
        var colors = ['#a855f7', '#c084fc', '#e879f9', '#f0abfc', '#ffffff'];
        var c = colors[Math.floor(Math.random() * colors.length)];
        if (typeof _spawn3D === 'function') {
            var sp = _spawn3D(
                { x: px, y: wy + 0.05 + Math.random() * 0.15, z: pz },
                { x: (Math.random() - 0.5) * 1.5, y: upSpeed, z: (Math.random() - 0.5) * 1.5 },
                c, 0.06 + Math.random() * 0.08, 0.5 + chargePct * 0.4
            );
            if (sp) sp.gravity = -1.5;
        }
    }

    // ── Spiraling pillar particles ──
    var spiralCount = Math.round(12 + chargePct * 16);
    for (var i = 0; i < spiralCount; i++) {
        var h = (i / spiralCount) * columnHeight;
        var sa = (i / spiralCount) * Math.PI * 6;
        var sr = radiusW * 0.3 * (1 - i / spiralCount * 0.5);
        if (typeof _spawn3D === 'function') {
            _spawn3D(
                { x: wx + Math.cos(sa) * sr, y: wy + h * 0.3, z: wz + Math.sin(sa) * sr },
                { x: Math.cos(sa) * 1.5, y: 3.0 + h * 1.5, z: Math.sin(sa) * 1.5 },
                i % 3 === 0 ? '#ffffff' : '#c084fc', 0.10, 0.45 + chargePct * 0.2
            );
        }
    }

    // ── Core burst at ground level ──
    if (typeof _burst3D === 'function') {
        _burst3D(wx, wy + 0.3, wz, Math.round(16 + chargePct * 20), '#e879f9', 5.0, 0.40);
    }

    // ── Rising energy wisps ──
    if (typeof _rising3D === 'function') {
        _rising3D(wx, wy, wz, Math.round(12 + chargePct * 12), '#c084fc', 0.65);
    }
}

// ════════════════════════════════════════════════════════════
//  FRAME UPDATE — cleanup zones, arrow rain rings
// ════════════════════════════════════════════════════════════
function updateSpecialVfx(dt) {
    // Update arrow rain zones
    for (var i = _specialVfxState.arrowRainZones.length - 1; i >= 0; i--) {
        var z = _specialVfxState.arrowRainZones[i];
        z.timer += dt;

        // Pulse the zone ring
        if (z.group.children.length > 0) {
            var ring = z.group.children[0];
            if (ring.material) {
                ring.material.opacity = 0.15 + Math.sin(z.timer * 6) * 0.08;
            }
        }

        if (z.timer >= z.maxTime) {
            if (threeScene) threeScene.remove(z.group);
            z.group.traverse(function(c) {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            _specialVfxState.arrowRainZones.splice(i, 1);
        }
    }
}

// Hook into VFX update chain
var _origUpdateVFX_specials = typeof updateVFX === 'function' ? updateVFX : null;
updateVFX = function(dt) {
    if (_origUpdateVFX_specials) _origUpdateVFX_specials(dt);
    updateSpecialVfx(dt);
    if (typeof updateSpecials === 'function') updateSpecials(dt);
    if (typeof renderSpecialHUD === 'function') renderSpecialHUD();
};
