// ============================================================
// LOTA AUTO CHESS — three-vfx.js — Complete 3D VFX System
// Overrides 2D vfx.js functions with Three.js implementations
// ============================================================

// ---- 3D Particle Pool ----
var VFX3D_MAX = 1500;
var _vfxParticles3D = [];
var _vfxProjectiles3D = [];
var _vfxZones3D = [];
var _vfxImpactMarks3D = []; // arcane ground marks that detonate after delay
var _defaultProjGeo = null; // Shared default projectile geometry
var _vfxScreenFlash3D = null;
var _vfxScreenShake3D = null;
var _vfxFlashPlane = null;
var _vfxHitSprites = [];
var _vfxHitTexCache = {}; // pre-baked hit mark textures: 'phys' | 'magic' | 'crit'

function _initHitTextures() {
    var defs = {
        phys: function(ctx) {
            ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
            ctx.strokeStyle = '#f87171'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(10,10); ctx.lineTo(54,54); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(54,10); ctx.lineTo(10,54); ctx.stroke();
            ctx.lineWidth = 2.5; ctx.strokeStyle = '#fca5a5';
            ctx.beginPath(); ctx.moveTo(6,32); ctx.lineTo(58,32); ctx.stroke();
        },
        magic: function(ctx) {
            ctx.shadowBlur = 10; ctx.shadowColor = '#a855f7';
            ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2.5;
            for (var i = 0; i < 6; i++) {
                var a = (i/6)*Math.PI*2;
                ctx.beginPath(); ctx.moveTo(32,32);
                ctx.lineTo(32+Math.cos(a)*28, 32+Math.sin(a)*28); ctx.stroke();
            }
            ctx.fillStyle = 'rgba(192,132,252,0.55)';
            ctx.beginPath(); ctx.arc(32,32,8,0,Math.PI*2); ctx.fill();
        },
        crit: function(ctx) {
            ctx.shadowBlur = 12; ctx.shadowColor = '#fbbf24';
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
            for (var i = 0; i < 8; i++) {
                var a = (i/8)*Math.PI*2;
                ctx.beginPath();
                ctx.moveTo(32+Math.cos(a)*29, 32+Math.sin(a)*29);
                ctx.lineTo(32+Math.cos(a+Math.PI/8)*10, 32+Math.sin(a+Math.PI/8)*10);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(251,191,36,0.7)';
            ctx.beginPath(); ctx.arc(32,32,9,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(32,32,9,0,Math.PI*2); ctx.stroke();
        }
    };
    ['phys','magic','crit'].forEach(function(k) {
        var c = document.createElement('canvas'); c.width = 64; c.height = 64;
        defs[k](c.getContext('2d'));
        var tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        _vfxHitTexCache[k] = tex;
    });
}

// Shared geometries (created once)
var _vfxSphereGeo = null;
var _vfxBoxGeo = null;

// ── Material pool — riusa materiali invece di creare/distruggere ogni frame ──
// Evita la GC pressure principale del sistema particelle.
var _matPool = {}; // colorKey (string) → array di MeshBasicMaterial liberi

function _acquireMat(color) {
    var k = String(color);
    var pool = _matPool[k];
    if (pool && pool.length > 0) {
        var m = pool.pop();
        m.opacity = 1.0;
        m.visible = true;
        return m;
    }
    return new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0, depthWrite: false });
}

function _releaseMat(m, colorKey) {
    if (!_matPool[colorKey]) _matPool[colorKey] = [];
    if (_matPool[colorKey].length < 24) {
        _matPool[colorKey].push(m);
    } else {
        m.dispose(); // pool saturo: rilascia normalmente
    }
}

// ── Pre-allocated spawn position + velocity — evitano new THREE.Vector3 nei burst ──
var _spawnVec = new THREE.Vector3();
var _burstVel = { x: 0, y: 0, z: 0 };

function _initVfx3D() {
    _vfxSphereGeo = new THREE.SphereGeometry(0.04, 4, 4);
    _vfxBoxGeo    = new THREE.BoxGeometry(0.06, 0.06, 0.06);

    // screen flash overlay plane (child of camera)
    var flashGeo = new THREE.PlaneGeometry(50, 50);
    var flashMat = new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 0,
        depthTest: false, depthWrite: false, side: THREE.DoubleSide
    });
    _vfxFlashPlane = new THREE.Mesh(flashGeo, flashMat);
    _vfxFlashPlane.position.set(0, 0, -2);
    _vfxFlashPlane.renderOrder = 1000;
    _vfxFlashPlane.visible = false;
    if (threeCamera) threeCamera.add(_vfxFlashPlane);
    if (threeScene && threeCamera) threeScene.add(threeCamera); // camera must be in scene for children
}

// ---- Coordinate conversion: screen pixels → world position ----
function _pixToWorld(px, py) {
    if (!threeCamera) return new THREE.Vector3(BOARD_CX, UNIT_BASE_Y, BOARD_CZ);
    var ndc = new THREE.Vector3(
        (px / window.innerWidth) * 2 - 1,
        -(py / window.innerHeight) * 2 + 1,
        0
    );
    ndc.unproject(threeCamera);
    // For ortho camera: find where the ray hits y = UNIT_BASE_Y plane
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(threeCamera.quaternion);
    if (Math.abs(dir.y) < 0.001) return ndc;
    var t = (UNIT_BASE_Y - ndc.y) / dir.y;
    return new THREE.Vector3(ndc.x + t * dir.x, UNIT_BASE_Y, ndc.z + t * dir.z);
}

// ---- Particle Spawn ----
function _spawn3D(worldPos, vel, color, size, life, type) {
    if (_vfxParticles3D.length >= VFX3D_MAX) return null;
    var geo = type === 'square' ? _vfxBoxGeo : _vfxSphereGeo;
    var colorKey = String(color);
    var mat = _acquireMat(color); // riusa dal pool invece di creare
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(worldPos);
    mesh.scale.setScalar(size || 1.0);
    threeScene.add(mesh);

    var p = {
        mesh: mesh,
        colorKey: colorKey, // serve per restituire il materiale al pool
        vx: vel.x, vy: vel.y, vz: vel.z,
        gravity: -2.0,
        life: life || 0.5,
        maxLife: life || 0.5,
        shrink: true
    };
    _vfxParticles3D.push(p);
    return p;
}

// ---- Burst (radial explosion) ----
function _burst3D(wx, wy, wz, count, color, speed, life, type) {
    for (var i = 0; i < count; i++) {
        var angle = (i / count) * Math.PI * 2;
        var pitch = (Math.random() - 0.3) * Math.PI * 0.8;
        var s = speed * (0.6 + Math.random() * 0.4);
        _burstVel.x = Math.cos(angle) * Math.cos(pitch) * s;
        _burstVel.y = Math.sin(pitch) * s * 0.5 + speed * 0.3;
        _burstVel.z = Math.sin(angle) * Math.cos(pitch) * s;
        _spawnVec.set(wx + (Math.random()-0.5)*0.1, wy, wz + (Math.random()-0.5)*0.1);
        var p = _spawn3D(_spawnVec, _burstVel, color, 0.6 + Math.random() * 0.6, life || 0.5, type);
        if (p) p.gravity = -4.0;
    }
}

// ---- Rising particles (heals, buffs) ----
function _rising3D(wx, wy, wz, count, color, life) {
    for (var i = 0; i < count; i++) {
        _spawnVec.set(wx + (Math.random()-0.5)*0.4, wy + Math.random()*0.3, wz + (Math.random()-0.5)*0.4);
        _burstVel.x = (Math.random()-0.5)*0.3;
        _burstVel.y = 1.5 + Math.random();
        _burstVel.z = (Math.random()-0.5)*0.3;
        _spawn3D(_spawnVec, _burstVel, color, 0.5 + Math.random() * 0.5, life || 0.7);
    }
}

// ---- Ring (expanding circle) ----
function _ring3D(wx, wy, wz, radius, color, count, life) {
    var n = count || 16;
    _spawnVec.set(wx, wy + 0.1, wz);
    for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var s = radius * 2.5;
        _burstVel.x = Math.cos(a) * s;
        _burstVel.y = 0.2;
        _burstVel.z = Math.sin(a) * s;
        _spawn3D(_spawnVec, _burstVel, color, 0.7, life || 0.5);
    }
}

// ---- Slash trail: AAA curved arc — multi-layer glow + sparks + speed lines ----
// comboStep: 1=L→R sweep, 2=R→L return, 3=diagonal finisher
function _slashTrail3D(wx, wy, wz, facingAngle, comboStep) {
    if (!threeScene || typeof _vfxParticles3D === 'undefined') return;
    if (_vfxParticles3D.length >= VFX3D_MAX - 40) return;

    var isFinisher = (comboStep === 3);
    var fwdX = Math.sin(facingAngle);
    var fwdZ = Math.cos(facingAngle);
    var dir  = (comboStep === 2) ? -1 : 1;

    // ── Per-step tuning ─────────────────────────────────────
    var arcAngle, arcRadius, _yStart, _yEnd, thick;
    var coreCol, glowCol, edgeCol, sparkCol;
    var sparkN, speedN;
    var coreLife, glowLife, edgeLife;

    if (comboStep === 1) {
        arcAngle = 2.1; arcRadius = 0.90;
        _yStart = wy + 0.04; _yEnd = wy + 0.10; thick = 0.16;
        coreCol = '#ffffff'; glowCol = '#a0c4ff'; edgeCol = '#3b82f6'; sparkCol = '#dbeafe';
        sparkN = 8; speedN = 4;
        coreLife = 0.13; glowLife = 0.18; edgeLife = 0.23;
    } else if (comboStep === 2) {
        arcAngle = 2.3; arcRadius = 0.95;
        _yStart = wy + 0.14; _yEnd = wy - 0.02; thick = 0.20;
        coreCol = '#ffffff'; glowCol = '#93c5fd'; edgeCol = '#2563eb'; sparkCol = '#bfdbfe';
        sparkN = 10; speedN = 5;
        coreLife = 0.14; glowLife = 0.20; edgeLife = 0.25;
    } else {
        arcAngle = 2.7; arcRadius = 1.35;
        _yStart = wy + 0.50; _yEnd = wy - 0.22; thick = 0.34;
        coreCol = '#ffffff'; glowCol = '#ff8c42'; edgeCol = '#dc2626'; sparkCol = '#fbbf24';
        sparkN = 18; speedN = 8;
        coreLife = 0.19; glowLife = 0.28; edgeLife = 0.36;
    }

    var segs = 28;
    var fwdOff = 0.50;
    var cx = wx + fwdX * fwdOff;
    var cz = wz + fwdZ * fwdOff;

    // ── Build one curved arc layer ──────────────────────────
    function _arc(wMul, hMul, color, opacity, life, yOff) {
        var verts = [];
        for (var i = 0; i <= segs; i++) {
            var t = i / segs;
            var taper = Math.pow(Math.sin(t * Math.PI), 0.6);
            var a = facingAngle + dir * (t - 0.5) * arcAngle;
            var r = arcRadius + taper * 0.12;
            var px = cx + Math.sin(a) * r;
            var pz = cz + Math.cos(a) * r;
            var py = _yStart + (_yEnd - _yStart) * t + (yOff || 0);
            py += Math.sin(t * Math.PI) * 0.07 * (isFinisher ? 2.5 : 1.0);
            var h = thick * wMul * taper * hMul;
            verts.push(px, py - h, pz);
            verts.push(px, py + h, pz);
        }
        var idx = [];
        for (var i = 0; i < segs; i++) {
            var b = i * 2;
            idx.push(b, b+2, b+1, b+1, b+2, b+3);
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(idx);
        var mat = new THREE.MeshBasicMaterial({
            color: color, transparent: true, opacity: opacity,
            side: THREE.DoubleSide, depthWrite: false
        });
        var mesh = new THREE.Mesh(geo, mat);
        threeScene.add(mesh);
        _vfxParticles3D.push({ mesh:mesh, vx:0,vy:0,vz:0, gravity:0,
                                life:life, maxLife:life, shrink:false, colorKey: String(color) });
    }

    // Layer 1: Bright core (thin, sharp)
    _arc(0.25, 1.0, coreCol, 0.95, coreLife);
    // Layer 2: Inner glow
    _arc(0.55, 1.8, glowCol, 0.50, glowLife);
    // Layer 3: Outer glow edge
    _arc(1.0, 3.0, edgeCol, 0.22, edgeLife);
    // Finisher: extra wide haze + bright afterimage
    if (isFinisher) {
        _arc(1.4, 4.5, edgeCol, 0.10, edgeLife + 0.08);
        _arc(0.30, 1.2, '#fff4e0', 0.70, coreLife + 0.05, -0.03);
    }

    // ── Sparks along the arc edge ───────────────────────────
    for (var si = 0; si < sparkN; si++) {
        var st = (si + 0.3 + Math.random() * 0.4) / sparkN;
        var sa = facingAngle + dir * (st - 0.5) * arcAngle;
        var sr = arcRadius + 0.08;
        var sx = cx + Math.sin(sa) * sr;
        var sz = cz + Math.cos(sa) * sr;
        var sy = _yStart + (_yEnd - _yStart) * st + Math.sin(st * Math.PI) * 0.07;
        _spawnVec.set(sx, sy, sz);
        _burstVel.x = Math.sin(sa) * (2.0 + Math.random() * 2.5);
        _burstVel.y = 0.3 + Math.random() * 1.8;
        _burstVel.z = Math.cos(sa) * (2.0 + Math.random() * 2.5);
        var sp = _spawn3D(_spawnVec, _burstVel, sparkCol, 0.35 + Math.random() * 0.35, 0.20 + Math.random() * 0.15);
        if (sp) sp.gravity = -4.0;
    }

    // ── Speed lines (fast tangential streaks) ───────────────
    for (var li = 0; li < speedN; li++) {
        var lt = (li + Math.random()) / speedN;
        var la = facingAngle + dir * (lt - 0.5) * arcAngle * 0.7;
        var lr = arcRadius * (0.4 + Math.random() * 0.6);
        var lx = cx + Math.sin(la) * lr;
        var lz = cz + Math.cos(la) * lr;
        var ly = (_yStart + _yEnd) * 0.5 + (Math.random() - 0.5) * 0.15;
        _spawnVec.set(lx, ly, lz);
        _burstVel.x = Math.cos(la) * dir * 5.0;
        _burstVel.y = (Math.random() - 0.5) * 0.3;
        _burstVel.z = -Math.sin(la) * dir * 5.0;
        var lp = _spawn3D(_spawnVec, _burstVel, '#ffffff', 0.18, 0.08);
        if (lp) { lp.gravity = 0; lp.shrink = true; }
    }

    // ── Finisher: ground impact + embers ────────────────────
    if (isFinisher) {
        var impX = wx + fwdX * 0.7;
        var impZ = wz + fwdZ * 0.7;
        // Ground dust cloud
        for (var di = 0; di < 12; di++) {
            var da = Math.random() * Math.PI * 2;
            var dd = 0.05 + Math.random() * 0.35;
            _spawnVec.set(impX + Math.cos(da) * dd, wy - 0.15, impZ + Math.sin(da) * dd);
            _burstVel.x = Math.cos(da) * (1.2 + Math.random());
            _burstVel.y = 0.6 + Math.random() * 0.8;
            _burstVel.z = Math.sin(da) * (1.2 + Math.random());
            var dp = _spawn3D(_spawnVec, _burstVel, '#a08060', 0.5 + Math.random() * 0.4, 0.30 + Math.random() * 0.20);
            if (dp) dp.gravity = -6.0;
        }
        // Impact shockwave ring
        _ring3D(impX, wy - 0.05, impZ, 0.7, '#ff6622', 18, 0.22);
        // Rising embers
        for (var ei = 0; ei < 10; ei++) {
            _spawnVec.set(
                impX + (Math.random() - 0.5) * 0.4, wy - 0.05,
                impZ + (Math.random() - 0.5) * 0.4
            );
            _burstVel.x = (Math.random() - 0.5) * 0.6;
            _burstVel.y = 1.8 + Math.random() * 2.5;
            _burstVel.z = (Math.random() - 0.5) * 0.6;
            var ep = _spawn3D(_spawnVec, _burstVel, Math.random() < 0.5 ? '#ff6622' : '#fbbf24',
                              0.25, 0.45 + Math.random() * 0.30);
            if (ep) ep.gravity = -1.2;
        }
    }
}

// ---- Projectile (traveling orb with trail) ----
// opts: { orbScale, orbGeo, lightStr, lightDist, trailInterval, trailFn, onImpact, spinAxis }
function _projectile3D(from, to, color, speed, impactColor, impactCount, opts) {
    // Ensure from/to are THREE.Vector3 (callers may pass plain {x,y,z})
    if (!(from instanceof THREE.Vector3)) from = new THREE.Vector3(from.x, from.y, from.z);
    if (!(to instanceof THREE.Vector3)) to = new THREE.Vector3(to.x, to.y, to.z);
    var dir = to.clone().sub(from);
    var dist = dir.length();
    dir.normalize();
    opts = opts || {};

    var orbScale = opts.orbScale || 0.06;
    var geo;
    if (opts.orbGeo) {
        geo = opts.orbGeo;
    } else {
        if (!_defaultProjGeo) _defaultProjGeo = new THREE.SphereGeometry(orbScale, 7, 7);
        geo = _defaultProjGeo;
    }
    var mat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.95
    });
    var orb = new THREE.Mesh(geo, mat);
    orb.position.copy(from);
    // orient coin/elongated projectile along travel direction
    if (opts.alignDir) {
        orb.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    }
    threeScene.add(orb);
    // Nessuna PointLight — costosa per ogni proiettile. L'orb emissivo basta visivamente.

    _vfxProjectiles3D.push({
        orb: orb,
        light: null,
        from: from.clone(),
        to: to.clone(),
        dir: dir,
        speed: speed || 8,
        dist: dist,
        traveled: 0,
        color: color,
        impactColor: impactColor || color,
        impactCount: impactCount || 10,
        trailTimer: 0,
        trailInterval: opts.trailInterval || 0.03,
        trailFn: opts.trailFn || null,
        onImpact: opts.onImpact || null,
        spinAxis: opts.spinAxis || null,
        spinSpeed: opts.spinSpeed || 0
    });
}

// ── Zone visual (persistent ground marker) ──
function _zone3D(row, col, radius, color, duration) {
    var wPos = cellToWorld(row, col);
    var r = (radius + 0.5) * TILE_UNIT;

    // ring
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.03, 8, 32),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wPos.x, UNIT_BASE_Y + 0.02, wPos.z);
    threeScene.add(ring);

    // disc
    var disc = new THREE.Mesh(
        new THREE.CircleGeometry(r, 32),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(wPos.x, UNIT_BASE_Y + 0.01, wPos.z);
    threeScene.add(disc);

    _vfxZones3D.push({
        ring: ring, disc: disc,
        life: duration || 4, maxLife: duration || 4,
        color: color, pos: wPos
    });
}

// ==================================================================
//  UPDATE LOOP — called every frame
// ==================================================================
function updateVfx3D(dt) {
    if (!_vfxSphereGeo && typeof _initVfx3D === 'function') _initVfx3D();

    // ── particles ──
    var alive = [];
    for (var i = 0; i < _vfxParticles3D.length; i++) {
        var p = _vfxParticles3D[i];
        p.life -= dt;
        if (p.life <= 0) {
            threeScene.remove(p.mesh);
            if (p.mesh.geometry && !p.mesh.geometry._shared) p.mesh.geometry.dispose();
            _releaseMat(p.mesh.material, p.colorKey); // restituisce al pool invece di dispose
            continue;
        }
        p.vx *= 0.96; p.vz *= 0.96;
        p.vy += p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        var ratio = p.life / p.maxLife;
        p.mesh.material.opacity = ratio;
        if (p.shrink) p.mesh.scale.setScalar(ratio * 0.8 + 0.2);
        alive.push(p);
    }
    _vfxParticles3D = alive;

    // ── projectiles ──
    var aliveProj = [];
    for (var i = 0; i < _vfxProjectiles3D.length; i++) {
        var pr = _vfxProjectiles3D[i];
        var step = pr.speed * dt;
        pr.traveled += step;
        pr.orb.position.addScaledVector(pr.dir, step);
        // light è null (rimossa per performance)

        // spin
        if (pr.spinAxis && pr.spinSpeed) {
            pr.orb.rotation[pr.spinAxis] += pr.spinSpeed * dt;
        }

        // trail particles
        pr.trailTimer += dt;
        if (pr.trailTimer > pr.trailInterval) {
            pr.trailTimer = 0;
            if (pr.trailFn) {
                pr.trailFn(pr.orb.position.clone());
            } else {
                _spawnVec.copy(pr.orb.position);
                _burstVel.x = 0; _burstVel.y = 0.3; _burstVel.z = 0;
                var tp = _spawn3D(_spawnVec, _burstVel, pr.color, 0.4, 0.25);
                if (tp) { tp.gravity = 0; tp.shrink = true; }
            }
        }

        if (pr.traveled >= pr.dist) {
            // impact!
            if (pr.onImpact) {
                pr.onImpact(pr.to.clone());
            } else {
                _burst3D(pr.to.x, pr.to.y, pr.to.z, pr.impactCount, pr.impactColor, 2.5, 0.4);
            }
            threeScene.remove(pr.orb);
            if (pr.orb.geometry && pr.orb.geometry !== _defaultProjGeo && pr.orb.geometry !== _babidiCoinGeo) pr.orb.geometry.dispose();
            if (pr.orb.material) pr.orb.material.dispose();
            continue;
        }
        aliveProj.push(pr);
    }
    _vfxProjectiles3D = aliveProj;

    // ── zones ──
    var aliveZones = [];
    for (var i = 0; i < _vfxZones3D.length; i++) {
        var z = _vfxZones3D[i];
        z.life -= dt;
        if (z.life <= 0) {
            threeScene.remove(z.ring);
            threeScene.remove(z.disc);
            z.ring.material.dispose(); z.ring.geometry.dispose();
            z.disc.material.dispose(); z.disc.geometry.dispose();
            continue;
        }
        // pulse
        var pulse = 0.3 + 0.15 * Math.sin(renderTime * 3);
        z.ring.material.opacity = pulse;
        z.disc.material.opacity = 0.05 + 0.04 * Math.sin(renderTime * 2.5);
        // ambient particles inside zone
        if (Math.random() < 0.15) {
            _spawnVec.set(z.pos.x + (Math.random()-0.5)*1.5, UNIT_BASE_Y, z.pos.z + (Math.random()-0.5)*1.5);
            _burstVel.x = 0; _burstVel.y = 0.8; _burstVel.z = 0;
            _spawn3D(_spawnVec, _burstVel, z.color, 0.3, 0.6);
        }
        aliveZones.push(z);
    }
    _vfxZones3D = aliveZones;

    // ── arcane impact marks (ground mark → detonate) ──
    var aliveMarks = [];
    for (var i = 0; i < _vfxImpactMarks3D.length; i++) {
        var m = _vfxImpactMarks3D[i];
        m.timer += dt;

        if (!m.detonated) {
            // Pulse ring and runes while waiting to detonate
            var pct = m.timer / m.delay;
            var pulse = 0.6 + Math.sin(pct * Math.PI * 6) * 0.3;
            m.ring.material.opacity = pulse;
            m.disc.material.opacity = 0.15 + pct * 0.25;
            // Scale ring inward slightly (contracting before boom)
            var shrink = 1.0 - pct * 0.15;
            m.ring.scale.set(shrink, shrink, 1);
            m.disc.scale.set(shrink, shrink, 1);
            // Spin rune dots
            for (var ri = 0; ri < m.runes.length; ri++) {
                var ra = (ri / m.runes.length) * Math.PI * 2 + m.timer * 12;
                m.runes[ri].position.x = m.x + Math.cos(ra) * m.radius * shrink;
                m.runes[ri].position.z = m.z + Math.sin(ra) * m.radius * shrink;
                m.runes[ri].material.opacity = pulse;
            }

            if (m.timer >= m.delay) {
                m.detonated = true;
                _detonateImpactMark(m);
                // Remove geometries
                threeScene.remove(m.ring); m.ring.geometry.dispose(); m.ring.material.dispose();
                threeScene.remove(m.disc); m.disc.geometry.dispose(); m.disc.material.dispose();
                for (var ri = 0; ri < m.runes.length; ri++) {
                    threeScene.remove(m.runes[ri]); m.runes[ri].geometry.dispose(); m.runes[ri].material.dispose();
                }
                continue; // don't keep in list
            }
        }
        aliveMarks.push(m);
    }
    _vfxImpactMarks3D = aliveMarks;

    // ── screen flash ──
    if (_vfxScreenFlash3D && _vfxFlashPlane) {
        _vfxScreenFlash3D.elapsed += dt;
        var flashRatio = 1 - (_vfxScreenFlash3D.elapsed / _vfxScreenFlash3D.duration);
        if (flashRatio <= 0) {
            _vfxFlashPlane.visible = false;
            _vfxScreenFlash3D = null;
        } else {
            _vfxFlashPlane.visible = true;
            _vfxFlashPlane.material.opacity = flashRatio * _vfxScreenFlash3D.alpha;
        }
    }

    // ── screen shake (relative offsets — safe during camera pan) ──
    if (_vfxScreenShake3D && threeCamera) {
        // Remove previous offset
        threeCamera.position.x -= _vfxScreenShake3D.offsetX;
        threeCamera.position.y -= _vfxScreenShake3D.offsetY;
        threeCamera.position.z -= _vfxScreenShake3D.offsetZ;
        _vfxScreenShake3D.elapsed += dt;
        if (_vfxScreenShake3D.elapsed >= _vfxScreenShake3D.duration) {
            _vfxScreenShake3D = null;
        } else {
            var intensity = _vfxScreenShake3D.intensity * (1 - _vfxScreenShake3D.elapsed / _vfxScreenShake3D.duration);
            _vfxScreenShake3D.offsetX = (Math.random() - 0.5) * intensity * 0.05;
            _vfxScreenShake3D.offsetY = (Math.random() - 0.5) * intensity * 0.03;
            _vfxScreenShake3D.offsetZ = (Math.random() - 0.5) * intensity * 0.05;
            threeCamera.position.x += _vfxScreenShake3D.offsetX;
            threeCamera.position.y += _vfxScreenShake3D.offsetY;
            threeCamera.position.z += _vfxScreenShake3D.offsetZ;
        }
    }

    // ── hit mark sprites (floating impact icons) ──
    for (var hi = _vfxHitSprites.length - 1; hi >= 0; hi--) {
        var hs = _vfxHitSprites[hi];
        hs.elapsed += dt;
        var ht = hs.elapsed / hs.life;
        hs.sprite.position.y += dt * 1.9;
        hs.mat.opacity = Math.max(0, 1.0 - ht * ht);
        hs.sprite.scale.setScalar(hs.sc * (1.0 + ht * 0.7));
        if (hs.elapsed >= hs.life) {
            threeScene.remove(hs.sprite);
            if (hs.tex) hs.tex.dispose(); // null for cached textures
            hs.mat.dispose();
            _vfxHitSprites.splice(hi, 1);
        }
    }
}

// ==================================================================
//  HIT MARK — floating impact sprite spawned on each received hit
// ==================================================================

function vfxHitMark3D(wx, wy, wz, isCrit, charId) {
    if (!threeScene) return;
    // Lazy-init cached textures
    if (!_vfxHitTexCache.phys) _initHitTextures();

    var isMagic = charId && (charId.indexOf('stregone') >= 0 || charId.indexOf('WMS') >= 0 ||
                              charId.indexOf('mistico') >= 0 || charId.indexOf('Babidi') >= 0 ||
                              charId.indexOf('guaritore') >= 0);
    var col = isCrit ? '#fbbf24' : (isMagic ? '#c084fc' : '#f87171');

    // 1. Burst — reduced count, larger/faster particles for same visual weight
    _burst3D(wx, wy + 0.18, wz, isCrit ? 12 : 8, col, isCrit ? 7.0 : 5.5, isCrit ? 0.50 : 0.32);

    // 2. Expanding ground ring
    _ring3D(wx, wy + 0.03, wz, isCrit ? 0.70 : 0.46, col, isCrit ? 14 : 10, 0.28);

    // 3. Inner ring only for crits
    if (isCrit) _ring3D(wx, wy + 0.06, wz, 0.28, '#ffffff', 8, 0.16);

    // 4. Rising streak (fewer)
    if (typeof _rising3D === 'function') {
        _rising3D(wx, wy + 0.1, wz, isCrit ? 4 : 2, col, isCrit ? 0.55 : 0.38);
    }

    // 5. Hit mark sprite — reuse pre-baked cached texture (no GPU upload per hit)
    var texKey = isCrit ? 'crit' : (isMagic ? 'magic' : 'phys');
    var tex = _vfxHitTexCache[texKey];
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    mat.renderOrder = 100;
    var sprite = new THREE.Sprite(mat);
    var sc = isCrit ? 0.54 : 0.38;
    sprite.scale.set(sc, sc, 1);
    sprite.position.set(
        wx + (Math.random() - 0.5) * 0.14,
        wy + 0.30 + Math.random() * 0.12,
        wz + (Math.random() - 0.5) * 0.14
    );
    threeScene.add(sprite);
    // Note: tex is shared/cached — do NOT dispose it; only dispose mat
    _vfxHitSprites.push({ sprite: sprite, mat: mat, tex: null,
                          life: isCrit ? 0.60 : 0.40, elapsed: 0, sc: sc });

    // 6. Screen shake
    if (isCrit && typeof triggerScreenShake === 'function') {
        triggerScreenShake(2.5, 0.14);
    } else if (!isCrit && Math.random() < 0.25 && typeof triggerScreenShake === 'function') {
        triggerScreenShake(0.8, 0.07);
    }
}

// ==================================================================
//  VFX FUNCTION OVERRIDES — same signatures as vfx.js
// ==================================================================

// ---- Screen effects ----
function triggerScreenFlash(color, duration) {
    if (_vfxFlashPlane) {
        _vfxFlashPlane.material.color.set(color);
        _vfxFlashPlane.visible = true;
    }
    _vfxScreenFlash3D = { color: color, duration: duration || 0.3, alpha: 0.35, elapsed: 0 };
}

function triggerScreenShake(intensity, duration) {
    if (!threeCamera) return;
    if (!_vfxScreenShake3D) {
        _vfxScreenShake3D = { offsetX: 0, offsetY: 0, offsetZ: 0, intensity: intensity, duration: duration || 0.2, elapsed: 0 };
    } else {
        _vfxScreenShake3D.intensity = Math.max(_vfxScreenShake3D.intensity, intensity);
        _vfxScreenShake3D.elapsed = 0;
        _vfxScreenShake3D.duration = duration || 0.2;
    }
}

// ---- Core attack VFX ----
function vfxMeleeAttack(ax, ay, tx, ty, charId, isCrit) {
    var wp = _pixToWorld(tx, ty);
    var col = CHAR_COLORS[charId] ? CHAR_COLORS[charId].fill : '#ffffff';
    var n = isCrit ? 18 : 10;
    _burst3D(wp.x, wp.y + 0.4, wp.z, n, isCrit ? '#fbbf24' : col, 3.0, 0.35);
    if (isCrit) triggerScreenShake(1.5, 0.1);
}

function vfxRangedAttack(ax, ay, tx, ty, charId, isCrit) {
    var from = _pixToWorld(ax, ay); from.y += 0.5;
    var to   = _pixToWorld(tx, ty); to.y += 0.5;

    if (charId === 'Babidi') {
        _vfxRangedBabidi(from, to, isCrit);
    } else if (charId === 'Caronte') {
        _vfxRangedCaronte(from, to, isCrit);
    } else {
        var col = CHAR_COLORS[charId] ? CHAR_COLORS[charId].fill : '#ffffff';
        _projectile3D(from, to, col, 12, isCrit ? '#fbbf24' : col, isCrit ? 15 : 8);
    }
}

// ── Babidi: spinning poison coin ──────────────────────────────────────
var _babidiCoinGeo = null;
function _vfxRangedBabidi(from, to, isCrit) {
    var coinCol  = isCrit ? '#fbbf24' : '#f59e0b';
    var poisonCol = '#4ade80';

    // spinning flat coin (cylinder = disc) — shared geometry
    if (!_babidiCoinGeo) _babidiCoinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.025, 10);

    _projectile3D(from, to, coinCol, isCrit ? 16 : 13, coinCol, 0, {
        orbGeo:        _babidiCoinGeo,
        lightStr:      isCrit ? 4.5 : 3.0,
        lightDist:     isCrit ? 4.5 : 3.5,
        trailInterval: 0.018,
        spinAxis:      'z',
        spinSpeed:     isCrit ? 22 : 14,
        trailFn: function(pos) {
            // alternating gold and green trail
            var c = Math.random() < 0.5 ? coinCol : poisonCol;
            var tp = _spawn3D(pos, {x:(Math.random()-0.5)*0.4, y:0.5, z:(Math.random()-0.5)*0.4}, c, 0.35, 0.22);
            if (tp) { tp.gravity = -0.5; tp.shrink = true; }
        },
        onImpact: function(pos) {
            // gold splat
            _burst3D(pos.x, pos.y, pos.z, isCrit ? 28 : 18, coinCol, isCrit ? 5.0 : 3.5, 0.45);
            // poison cloud
            _burst3D(pos.x, pos.y, pos.z, isCrit ? 20 : 12, poisonCol, 2.5, 0.7);
            _rising3D(pos.x, pos.y - 0.3, pos.z, isCrit ? 12 : 7, poisonCol, 0.9);
            _ring3D(pos.x, pos.y, pos.z, 0.5, poisonCol, 14, 0.4);
            if (isCrit) {
                _ring3D(pos.x, pos.y, pos.z, 0.8, coinCol, 18, 0.35);
                triggerScreenShake(1.5, 0.1);
            }
        }
    });

    // crit: 2 extra coins in a fan (staggered)
    if (isCrit) {
        [80, 160].forEach(function(delayMs) {
            setTimeout(function() {
                var offset = new THREE.Vector3(
                    (Math.random()-0.5)*0.3, 0, (Math.random()-0.5)*0.3
                );
                var fromOff = from.clone().add(offset);
                var toOff   = to.clone().add(offset);
                var g2 = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8);
                _projectile3D(fromOff, toOff, '#fde68a', 18, '#fbbf24', 0, {
                    orbGeo: g2, lightStr: 2.0, lightDist: 2.5,
                    trailInterval: 0.025, spinAxis: 'z', spinSpeed: 18,
                    trailFn: function(p) {
                        var tp = _spawn3D(p, {x:0, y:0.3, z:0}, '#fbbf24', 0.28, 0.18);
                        if (tp) { tp.gravity = 0; tp.shrink = true; }
                    },
                    onImpact: function(p) {
                        _burst3D(p.x, p.y, p.z, 8, '#fbbf24', 2.0, 0.35);
                    }
                });
            }, delayMs);
        });
    }
}

// ── Caronte: arcane bolt ──────────────────────────────────────────────
function _vfxRangedCaronte(from, to, isCrit) {
    var arcCol   = isCrit ? '#e879f9' : '#a855f7';  // magenta on crit, purple normal
    var coreCol  = '#ffffff';
    var runeCol  = isCrit ? '#fbbf24' : '#c084fc';

    // large glowing arcane orb
    var boltR = isCrit ? 0.16 : 0.12;
    var boltGeo = new THREE.SphereGeometry(boltR, 10, 10);

    _projectile3D(from, to, arcCol, isCrit ? 15 : 11, arcCol, 0, {
        orbGeo:        boltGeo,
        lightStr:      isCrit ? 6.0 : 4.0,
        lightDist:     isCrit ? 5.5 : 4.5,
        trailInterval: 0.012,
        spinAxis:      'y',
        spinSpeed:     4,
        trailFn: function(pos) {
            // crackling trail: mix of purple, white, blue sparks
            var cols = [arcCol, '#c084fc', '#f0abfc', coreCol, '#818cf8'];
            var c = cols[Math.floor(Math.random() * cols.length)];
            var vel = {
                x: (Math.random()-0.5) * 1.2,
                y: 0.6 + Math.random() * 0.8,
                z: (Math.random()-0.5) * 1.2
            };
            var tp = _spawn3D(pos, vel, c, 0.45 + Math.random()*0.2, 0.3);
            if (tp) { tp.gravity = -1.5; tp.shrink = true; }
            // second smaller spark
            if (Math.random() < 0.5) {
                var tp2 = _spawn3D(pos.clone(), {x:(Math.random()-0.5)*0.6, y:0.2, z:(Math.random()-0.5)*0.6}, coreCol, 0.25, 0.2);
                if (tp2) { tp2.gravity = 0; tp2.shrink = true; }
            }
        },
        onImpact: function(pos) {
            // main arcane explosion
            _burst3D(pos.x, pos.y, pos.z, isCrit ? 40 : 26, arcCol, isCrit ? 6.0 : 4.5, 0.5);
            // white core flash
            _burst3D(pos.x, pos.y, pos.z, isCrit ? 20 : 12, coreCol, isCrit ? 4.0 : 3.0, 0.3);
            // expanding runic rings
            _ring3D(pos.x, pos.y, pos.z, 0.35, arcCol,  18, 0.45);
            _ring3D(pos.x, pos.y, pos.z, 0.65, runeCol, 14, 0.5);
            if (isCrit) {
                _ring3D(pos.x, pos.y, pos.z, 1.0,  arcCol,  22, 0.55);
                triggerScreenFlash(arcCol, 0.12);
                triggerScreenShake(2.5, 0.18);
            } else {
                triggerScreenShake(1.2, 0.1);
            }
            // rising arcane particles
            _rising3D(pos.x, pos.y - 0.2, pos.z, isCrit ? 14 : 8, runeCol, 0.8);
        }
    });
}

// ---- Status effect VFX ----
function vfxPoison(x, y) {
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.4, w.z, 12, '#22c55e', 1.8, 0.6);
    _rising3D(w.x, w.y + 0.2, w.z, 4, '#22c55e', 0.5);
}

function vfxHeal(x, y) {
    var w = _pixToWorld(x, y);
    _rising3D(w.x, w.y + 0.2, w.z, 14, '#34d399', 0.8);
    _ring3D(w.x, w.y + 0.3, w.z, 0.4, '#34d399', 10, 0.4);
}

function vfxShield(x, y) {
    var w = _pixToWorld(x, y);
    _ring3D(w.x, w.y + 0.5, w.z, 0.5, '#93c5fd', 18, 0.5);
}

function vfxTeleport(x, y, color) {
    var c = color || '#a78bfa';
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.3, w.z, 22, c, 3.0, 0.45);
    _ring3D(w.x, w.y + 0.1, w.z, 0.6, c, 18, 0.5);
}

function vfxBuff(x, y, color) {
    var c = color || '#fbbf24';
    var w = _pixToWorld(x, y);
    _rising3D(w.x, w.y + 0.1, w.z, 12, c, 0.7);
    _ring3D(w.x, w.y + 0.3, w.z, 0.35, c, 12, 0.45);
}

function vfxAOE(x, y, radius, color) {
    var c = color || '#ef4444';
    var w = _pixToWorld(x, y);
    var r = (radius || 1) * TILE_UNIT;
    _ring3D(w.x, w.y + 0.1, w.z, r, c, 24, 0.6);
    _burst3D(w.x, w.y + 0.3, w.z, 18, c, 3.5, 0.5);
    triggerScreenShake(2, 0.15);
}

function vfxFreeze(x, y) {
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.4, w.z, 16, '#93c5fd', 2.0, 0.55, 'square');
    _ring3D(w.x, w.y + 0.2, w.z, 0.3, '#bfdbfe', 10, 0.4);
}

function vfxSilence(x, y) {
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.5, w.z, 12, '#f472b6', 1.8, 0.5);
}

function vfxDeath(x, y, charId) {
    var col = CHAR_COLORS[charId] ? CHAR_COLORS[charId].fill : '#888888';
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.4, w.z, 24, col, 4.0, 0.7);
    _ring3D(w.x, w.y + 0.1, w.z, 0.5, col, 14, 0.5);
}

function vfxFuriaActivation(x, y) {
    var w = _pixToWorld(x, y);
    _burst3D(w.x, w.y + 0.5, w.z, 28, '#ef4444', 4.5, 0.6);
    _ring3D(w.x, w.y + 0.2, w.z, 0.8, '#ef4444', 22, 0.6);
    _rising3D(w.x, w.y, w.z, 10, '#fbbf24', 0.5);
    triggerScreenShake(3, 0.2);
    triggerScreenFlash('#ef4444', 0.15);
}

// ---- Avatar ability VFX 3D (guerriero) ----

// Colpo Devastante: devastating single-target slash + impact
function vfxColpoDevastante3D(wx, wy, wz, facing) {
    if (typeof _slashTrail3D === 'function') _slashTrail3D(wx, wy + 0.2, wz, facing, 3);
    _burst3D(wx, wy + 0.4, wz, 22, '#ff4400', 5.5, 0.35);
    _ring3D(wx, wy + 0.05, wz, 0.6, '#ff2200', 18, 0.28);
    for (var _ci = 0; _ci < 8; _ci++) {
        var _ca = (_ci / 8) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_ca) * 0.25, wy + 0.05, wz + Math.sin(_ca) * 0.25),
            { x: Math.cos(_ca) * 1.8, y: 1.2 + Math.random() * 0.8, z: Math.sin(_ca) * 1.8 },
            '#cc3300', 0.22, 0.30
        );
    }
    triggerScreenShake(5, 0.18);
    triggerScreenFlash('#ff3300', 0.18);
}

// Grido di Guerra: shockwave rings centered on avatar
function vfxGridoGuerra3D(wx, wy, wz) {
    _ring3D(wx, wy + 0.15, wz, 0.35, '#fbbf24', 14, 0.50);
    _ring3D(wx, wy + 0.10, wz, 0.70, '#f59e0b', 20, 0.40);
    _ring3D(wx, wy + 0.05, wz, 1.20, '#ef4444', 26, 0.30);
    _burst3D(wx, wy + 0.5, wz, 20, '#fbbf24', 3.5, 0.45);
    _rising3D(wx, wy, wz, 12, '#fbbf24', 0.55);
    triggerScreenShake(4, 0.22);
    triggerScreenFlash('#f59e0b', 0.12);
}

// Furia Immortale: dramatic red activation explosion
function vfxFuriaImmortale3D(wx, wy, wz) {
    _burst3D(wx, wy + 0.6, wz, 32, '#ef4444', 5.5, 0.65);
    _ring3D(wx, wy + 0.15, wz, 0.90, '#ef4444', 26, 0.60);
    _ring3D(wx, wy + 0.30, wz, 0.50, '#fbbf24', 14, 0.55);
    _rising3D(wx, wy, wz, 18, '#ff4444', 0.80);
    for (var _fi = 0; _fi < 12; _fi++) {
        var _fa = (_fi / 12) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_fa) * 0.18, wy + 0.3, wz + Math.sin(_fa) * 0.18),
            { x: Math.cos(_fa) * 0.9, y: 2.8 + Math.random() * 1.5, z: Math.sin(_fa) * 0.9 },
            '#fbbf24', 0.30, 0.55
        );
    }
    triggerScreenShake(7, 0.35);
    triggerScreenFlash('#ef4444', 0.28);
}

// ============================================================
// STRATEGA VFX
// ============================================================

// Spear trail: lightweight VFX for Stratega spear throws
// Step 1 = Giavellotto, Step 2 = Giavellotto II
// Uses only 2 ribbons (core+glow) with 12 segments, pooled materials, minimal particles
function _spearTrail3D(wx, wy, wz, facingAngle, step) {
    if (!threeScene || typeof _vfxParticles3D === 'undefined') return;
    if (_vfxParticles3D.length >= VFX3D_MAX - 8) return;

    var fwdX = Math.sin(facingAngle), fwdZ = Math.cos(facingAngle);
    var segs = 12; // reduced from 22

    // Helper: build tapered ribbon — reuses material pool
    function _makeRibbon(verts, color, opacity, life) {
        var idx = [];
        for (var i = 0; i < segs; i++) { var b = i * 2; idx.push(b,b+2,b+1, b+1,b+2,b+3); }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(idx);
        var mat = _acquireMat(color);
        mat.opacity = opacity; mat.side = THREE.DoubleSide;
        var mesh = new THREE.Mesh(geo, mat);
        threeScene.add(mesh);
        _vfxParticles3D.push({ mesh: mesh, colorKey: String(color), vx:0, vy:0, vz:0, gravity:0, life: life, maxLife: life, shrink: false });
    }

    var isStep2 = (step === 2);
    var thrustLen = isStep2 ? 2.0 : 1.7;
    var colGlow = isStep2 ? '#93c5fd' : '#60a5fa';

    // Core (bright white) + glow (blue or gold-tinted) — only 2 ribbons
    var vCore = [], vGlow = [];
    for (var i = 0; i <= segs; i++) {
        var t = i / segs;
        var taper = t < 0.3 ? (t / 0.3) : Math.pow(1 - (t - 0.3) / 0.7, 1.5);
        var px = wx + fwdX * t * thrustLen;
        var pz = wz + fwdZ * t * thrustLen;
        vCore.push(px, wy - 0.012 * taper, pz, px, wy + 0.012 * taper, pz);
        vGlow.push(px, wy - 0.05 * taper, pz, px, wy + 0.05 * taper, pz);
    }
    _makeRibbon(vCore, '#ffffff', 0.90, 0.12);
    _makeRibbon(vGlow, colGlow, 0.40, 0.16);

    // 4 tip sparks (reduced from 8-10)
    var tipX = wx + fwdX * thrustLen, tipZ = wz + fwdZ * thrustLen;
    for (var s = 0; s < 4; s++) {
        _spawnVec.set(tipX + (Math.random()-0.5)*0.08, wy + (Math.random()-0.5)*0.06, tipZ + (Math.random()-0.5)*0.08);
        _burstVel.x = fwdX*2.5 + (Math.random()-0.5)*1.5;
        _burstVel.y = 1 + Math.random()*1.5;
        _burstVel.z = fwdZ*2.5 + (Math.random()-0.5)*1.5;
        _spawn3D(_spawnVec, _burstVel, s < 2 ? '#ffffff' : colGlow, 0.30, 0.18);
    }
}

// Stratega step 3 — Sfondamento (breakthrough charge) — optimized
function vfxStrategaSfondamento3D(wx, wy, wz, facing) {
    var fwdX = Math.sin(facing), fwdZ = Math.cos(facing);
    var impX = wx + fwdX * 0.8, impZ = wz + fwdZ * 0.8;

    // Directional cone — 10 particles (was 18)
    for (var _ci = 0; _ci < 10; _ci++) {
        var _ca = facing + (_ci / 10 - 0.5) * 1.4;
        var _cSpd = 4 + Math.random() * 2.5;
        _spawnVec.set(wx + fwdX * 0.3, wy + 0.05, wz + fwdZ * 0.3);
        _burstVel.x = Math.sin(_ca) * _cSpd; _burstVel.y = 0.3 + Math.random() * 0.5; _burstVel.z = Math.cos(_ca) * _cSpd;
        _spawn3D(_spawnVec, _burstVel, _ci < 3 ? '#fff4b0' : '#fbbf24', 0.45, 0.30);
    }
    _ring3D(impX, wy + 0.02, impZ, 1.2, '#fbbf24', 14, 0.25);
    _ring3D(wx, wy + 0.05, wz, 0.6, '#60a5fa', 10, 0.18);
    _burst3D(impX, wy + 0.3, impZ, 14, '#fbbf24', 5.0, 0.32);
    // 5 upward sparks (was 10)
    for (var _ui = 0; _ui < 5; _ui++) {
        _spawnVec.set(impX + (Math.random()-0.5)*0.1, wy, impZ + (Math.random()-0.5)*0.1);
        _burstVel.x = (Math.random()-0.5)*0.3; _burstVel.y = 5 + Math.random()*3; _burstVel.z = (Math.random()-0.5)*0.3;
        _spawn3D(_spawnVec, _burstVel, '#fff4b0', 0.20, 0.38);
    }
    triggerScreenShake(4.5, 0.22);
    triggerScreenFlash('#fbbf24', 0.15);
}

// Stratega ability VFX — Ordine Carica
function vfxOrdineCarica3D(wx, wy, wz) {
    _ring3D(wx, wy + 0.05, wz, 0.8, '#fbbf24', 20, 0.50);
    _ring3D(wx, wy + 0.05, wz, 1.8, '#60a5fa', 26, 0.35);
    _rising3D(wx, wy, wz, 16, '#fbbf24', 0.60);
    triggerScreenFlash('#3b82f6', 0.10);
}

// Stratega ability VFX — Vittoria (ultimate)
function vfxVittoria3D(wx, wy, wz) {
    _burst3D(wx, wy + 0.6, wz, 30, '#fbbf24', 5.0, 0.70);
    _ring3D(wx, wy + 0.1, wz, 1.2, '#fbbf24', 28, 0.65);
    _ring3D(wx, wy + 0.2, wz, 0.6, '#3b82f6', 18, 0.55);
    _rising3D(wx, wy, wz, 22, '#fbbf24', 0.90);
    for (var _vi = 0; _vi < 14; _vi++) {
        var _va = (_vi / 14) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_va) * 0.25, wy + 0.25, wz + Math.sin(_va) * 0.25),
            { x: Math.cos(_va) * 1.0, y: 3.5 + Math.random() * 1.5, z: Math.sin(_va) * 1.0 },
            '#fff4b0', 0.28, 0.65
        );
    }
    triggerScreenShake(6, 0.30);
    triggerScreenFlash('#fbbf24', 0.25);
}

// ============================================================
// STRATEGA — ARROW STORM VFX (combo finisher: sx sx dx)
// ============================================================

// Shared arrow geometry (created once, reused by all arrows)
var _arrowShaftGeo = null, _arrowHeadGeo = null;
var _arrowShaftMat = null, _arrowHeadMat = null;
function _initArrowGeos() {
    if (_arrowShaftGeo) return;
    _arrowShaftGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.30, 3);
    _arrowHeadGeo  = new THREE.ConeGeometry(0.020, 0.07, 3);
    _arrowShaftMat = new THREE.MeshBasicMaterial({ color: '#8B6914' });
    _arrowHeadMat  = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
}

// Spawn a single 3D arrow — only 2 meshes (shaft + head), shared geos & mats
function _spawnStormArrow3D(toX, toY, toZ) {
    if (!threeScene) return;
    _initArrowGeos();

    var group = new THREE.Group();
    group.add(new THREE.Mesh(_arrowShaftGeo, _arrowShaftMat));
    var head = new THREE.Mesh(_arrowHeadGeo, _arrowHeadMat);
    head.position.y = 0.185;
    group.add(head);

    var fromX = toX + (Math.random() - 0.5) * 0.6;
    var fromZ = toZ + (Math.random() - 0.5) * 0.6;
    var fromY = toY + 5 + Math.random() * 2;

    var from = new THREE.Vector3(fromX, fromY, fromZ);
    var to   = new THREE.Vector3(toX, toY + 0.03, toZ);
    var dir  = to.clone().sub(from).normalize();

    group.position.copy(from);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    threeScene.add(group);

    _vfxProjectiles3D.push({
        orb: group, light: null,
        from: from.clone(), to: to.clone(), dir: dir,
        speed: 16 + Math.random() * 5,
        dist: from.distanceTo(to), traveled: 0,
        color: '#fbbf24', impactColor: '#ffd700', impactCount: 3,
        trailTimer: 0, trailInterval: 0.06, trailFn: null, // no trail particles — save perf
        onImpact: function() {
            _burst3D(toX, toY + 0.06, toZ, 3, '#ffd700', 2.0, 0.12);
        },
        spinAxis: null, spinSpeed: 0
    });
}

// Arrow storm — 12 arrows (was 20), staggered, minimal ground FX
function vfxArrowStorm3D(cx, cy, cz, radius) {
    if (!threeScene) return;
    var count = 12;
    for (var i = 0; i < count; i++) {
        (function(idx) {
            setTimeout(function() {
                var a = Math.random() * Math.PI * 2;
                var r = Math.sqrt(Math.random()) * radius;
                _spawnStormArrow3D(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r);
            }, idx * 50 + Math.random() * 40);
        })(i);
    }
    _ring3D(cx, cy + 0.03, cz, radius * 0.6, '#fbbf24', 12, 0.20);
    _rising3D(cx, cy, cz, 6, '#d4a574', 0.35);
}

// ============================================================
// STREGONE VFX
// ============================================================

// ── Shared spear projectile geometry + materials (created once, reused) ──
var _spearProjGeo = null, _spearTipGeo = null;
var _spearProjMat = null, _spearTipMat = null;

// ── Spear projectile for Stratega — lightweight golden javelin ──
function _spearProjectile3D(fromX, fromY, fromZ, toX, toY, toZ, onImpact) {
    if (!threeScene) return;
    // Lazy-init shared geometry + materials
    if (!_spearProjGeo) {
        _spearProjGeo = new THREE.CapsuleGeometry(0.022, 0.42, 2, 4);
        _spearTipGeo  = new THREE.ConeGeometry(0.028, 0.08, 4);
        _spearProjMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
        _spearTipMat  = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    }

    var from = new THREE.Vector3(fromX, fromY + 0.30, fromZ);
    var to   = new THREE.Vector3(toX,   toY   + 0.30, toZ);
    var dir  = to.clone().sub(from);
    var dist = dir.length();
    dir.normalize();

    // Shaft + tip — shared geo & mat (no allocation per shot)
    var group = new THREE.Group();
    group.add(new THREE.Mesh(_spearProjGeo, _spearProjMat));
    var tip = new THREE.Mesh(_spearTipGeo, _spearTipMat);
    tip.position.set(0, 0.25, 0);
    group.add(tip);

    group.position.copy(from);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    threeScene.add(group);

    _vfxProjectiles3D.push({
        orb: group, light: null,
        from: from.clone(), to: to.clone(), dir: dir,
        speed: 24, dist: dist, traveled: 0,
        color: '#fbbf24', impactColor: '#ffd700', impactCount: 4,
        trailTimer: 0, trailInterval: 0.025,
        trailFn: function(pos) {
            _spawn3D(pos.clone(),
                { x: (Math.random()-0.5)*0.06, y: 0.2, z: (Math.random()-0.5)*0.06 },
                '#ffd700', 0.14, 0.15);
        },
        onImpact: onImpact || null,
        spinAxis: null, spinSpeed: 0
    });
}

// Arcane combat bolt — glowing orb with crackling trail (same style as Caronte/Babidi)
function _arcaneCombatBolt3D(fromX, fromY, fromZ, toX, toY, toZ, isCharged, onImpact) {
    if (!threeScene) return;
    var from = new THREE.Vector3(fromX, fromY, fromZ);
    var to   = new THREE.Vector3(toX,   toY + 0.35, toZ);

    var arcCol  = isCharged ? '#c084fc' : '#a855f7';
    var glowCol = isCharged ? '#f0abfc' : '#d946ef';
    var coreCol = '#ffffff';
    var orbR    = isCharged ? 0.14 : 0.10;
    var spd     = isCharged ? 10 : 14;

    var boltGeo = new THREE.SphereGeometry(orbR, 10, 10);

    // Muzzle flash at staff tip — so you clearly see where it departs
    _burst3D(fromX, fromY, fromZ, isCharged ? 8 : 5, arcCol, 2.5, 0.15);
    _burst3D(fromX, fromY, fromZ, 3, coreCol, 1.5, 0.10);

    _projectile3D(from, to, arcCol, spd, arcCol, 0, {
        orbGeo:        boltGeo,
        trailInterval: 0.012,
        spinAxis:      'y',
        spinSpeed:     isCharged ? 6 : 4,
        trailFn: function(pos) {
            // crackling purple/white sparks like Caronte
            var cols = [arcCol, '#c084fc', glowCol, coreCol, '#818cf8'];
            var c = cols[Math.floor(Math.random() * cols.length)];
            var vel = {
                x: (Math.random()-0.5) * (isCharged ? 1.4 : 1.0),
                y: 0.5 + Math.random() * 0.7,
                z: (Math.random()-0.5) * (isCharged ? 1.4 : 1.0)
            };
            var tp = _spawn3D(pos, vel, c, isCharged ? 0.40 : 0.30, 0.25);
            if (tp) { tp.gravity = -1.5; tp.shrink = true; }
            // second white core spark
            if (Math.random() < 0.4) {
                var tp2 = _spawn3D(pos.clone(), {x:(Math.random()-0.5)*0.5, y:0.2, z:(Math.random()-0.5)*0.5}, coreCol, 0.20, 0.18);
                if (tp2) { tp2.gravity = 0; tp2.shrink = true; }
            }
        },
        onImpact: onImpact || null
    });
}

// Kept for backward compat — cosmetic only (no damage)
function vfxArcaneDart3D(fromX, fromY, fromZ, toX, toY, toZ, step) {
    _arcaneCombatBolt3D(fromX, fromY, fromZ, toX, toY, toZ, step === 2, null);
}

// Nova Arcana — 360° atomic detonation
function vfxNovaArcana3D(wx, wy, wz) {
    // Core white flash
    _burst3D(wx, wy + 0.5, wz, 20, '#ffffff', 4.0, 0.30);
    // Expanding atom-style rings at different heights
    _ring3D(wx, wy + 0.08, wz, 0.40, '#e879f9', 16, 0.55);
    _ring3D(wx, wy + 0.20, wz, 0.90, '#a855f7', 24, 0.42);
    _ring3D(wx, wy + 0.35, wz, 1.60, '#7e22ce', 30, 0.30);
    // Purple shrapnel burst
    _burst3D(wx, wy + 0.3, wz, 28, '#a855f7', 6.0, 0.50);
    // Upward energy column
    _rising3D(wx, wy, wz, 18, '#c084fc', 0.70);
    // Orbital debris flying outward
    for (var _ni = 0; _ni < 14; _ni++) {
        var _na = (_ni / 14) * Math.PI * 2;
        var _nr = 0.12 + Math.random() * 0.08;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_na) * _nr, wy + 0.15 + Math.random() * 0.2, wz + Math.sin(_na) * _nr),
            { x: Math.cos(_na) * 3.2, y: 0.8 + Math.random() * 1.0, z: Math.sin(_na) * 3.2 },
            Math.random() > 0.5 ? '#e879f9' : '#ffffff', 0.18, 0.45
        );
    }
    triggerScreenShake(6, 0.28);
    triggerScreenFlash('#a855f7', 0.22);
}

// Stregone cast trail — arcane swirl from hand on left-click combo
function _arcaneCastTrail3D(wx, wy, wz, facingAngle, comboStep) {
    if (!threeScene || typeof _spawn3D === 'undefined') return;
    var isFinisher = (comboStep === 3);
    var fwdX = Math.sin(facingAngle), fwdZ = Math.cos(facingAngle);
    var count = isFinisher ? 12 : 7;
    var dist = isFinisher ? 0.8 : 0.5;
    var colors = isFinisher ? ['#e879f9', '#ffffff', '#c084fc'] : ['#a855f7', '#c084fc'];
    for (var i = 0; i < count; i++) {
        var t = i / count;
        var spread = (Math.random() - 0.5) * 0.4;
        var px = wx + fwdX * t * dist + Math.cos(facingAngle) * spread;
        var pz = wz + fwdZ * t * dist - Math.sin(facingAngle) * spread;
        var c = colors[Math.floor(Math.random() * colors.length)];
        _spawn3D(
            { x: px, y: wy + 0.05 * t, z: pz },
            { x: fwdX * 2.5 + (Math.random()-0.5)*1.5, y: 0.5 + Math.random()*0.8, z: fwdZ * 2.5 + (Math.random()-0.5)*1.5 },
            c, isFinisher ? 0.14 : 0.10, isFinisher ? 0.28 : 0.18
        );
    }
}

// Stregone hit VFX — ground mark appears, then detonates
function vfxArcaneImpact3D(wx, wy, wz, isCrit) {
    if (!threeScene) return;
    var markR = isCrit ? 0.25 : 0.16;
    var delay = 0.30; // seconds before detonation

    // Small initial contact spark
    _burst3D(wx, wy + 0.2, wz, isCrit ? 6 : 3, '#ffffff', 2.0, 0.12);

    // Create ground mark (ring + disc)
    var ringGeo = new THREE.TorusGeometry(markR, 0.012, 6, 24);
    var ringMat = new THREE.MeshBasicMaterial({ color: isCrit ? '#e879f9' : '#a855f7', transparent: true, opacity: 0.8, depthWrite: false });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wx, wy + 0.02, wz);
    threeScene.add(ring);

    var discGeo = new THREE.CircleGeometry(markR, 24);
    var discMat = new THREE.MeshBasicMaterial({ color: isCrit ? '#c084fc' : '#7e22ce', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    var disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(wx, wy + 0.01, wz);
    threeScene.add(disc);

    // Small rune dots on the ring
    var runes = [];
    for (var i = 0; i < 4; i++) {
        var ra = (i / 4) * Math.PI * 2;
        var runeGeo = new THREE.SphereGeometry(0.015, 4, 4);
        var runeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
        var rune = new THREE.Mesh(runeGeo, runeMat);
        rune.position.set(wx + Math.cos(ra) * markR, wy + 0.03, wz + Math.sin(ra) * markR);
        threeScene.add(rune);
        runes.push(rune);
    }

    _vfxImpactMarks3D.push({
        ring: ring, disc: disc, runes: runes,
        x: wx, y: wy, z: wz,
        radius: markR,
        timer: 0,
        delay: delay,
        isCrit: isCrit,
        detonated: false
    });
}

// Detonation explosion when mark timer expires
function _detonateImpactMark(m) {
    var n = m.isCrit ? 14 : 8;
    // Expanding shattered rings
    _ring3D(m.x, m.y + 0.08, m.z, m.isCrit ? 0.55 : 0.35, '#e879f9', n, 0.28);
    _ring3D(m.x, m.y + 0.18, m.z, m.isCrit ? 0.35 : 0.20, '#c084fc', Math.round(n * 0.6), 0.22);
    // Upward burst from the mark
    _burst3D(m.x, m.y + 0.15, m.z, n, m.isCrit ? '#ffffff' : '#e879f9', m.isCrit ? 5.0 : 3.5, m.isCrit ? 0.32 : 0.22);
    // Rising energy wisps
    _rising3D(m.x, m.y, m.z, m.isCrit ? 8 : 4, '#c084fc', 0.35);
}

// Stregone ability VFX — Nova di Gelo
function vfxNovaGelo3D(wx, wy, wz) {
    _ring3D(wx, wy + 0.1, wz, 0.5,  '#bae6fd', 18, 0.55);
    _ring3D(wx, wy + 0.08, wz, 1.0,  '#7dd3fc', 24, 0.42);
    _ring3D(wx, wy + 0.06, wz, 1.8,  '#38bdf8', 30, 0.30);
    _burst3D(wx, wy + 0.5, wz, 20, '#bae6fd', 3.5, 0.45);
    for (var _gi = 0; _gi < 8; _gi++) {
        var _ga = (_gi / 8) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_ga) * 0.3, wy + 0.05, wz + Math.sin(_ga) * 0.3),
            { x: Math.cos(_ga) * 0.5, y: 2.0, z: Math.sin(_ga) * 0.5 },
            '#e0f2fe', 0.25, 0.55
        );
    }
    triggerScreenFlash('#7dd3fc', 0.14);
    triggerScreenShake(3, 0.18);
}

// Stregone ultimate — Apocalisse
function vfxApocalisse3D(wx, wy, wz) {
    _burst3D(wx, wy + 0.8, wz, 48, '#a855f7', 7.0, 0.80);
    _ring3D(wx, wy + 0.12, wz, 0.5,  '#e879f9', 20, 0.75);
    _ring3D(wx, wy + 0.10, wz, 1.2,  '#a855f7', 28, 0.60);
    _ring3D(wx, wy + 0.08, wz, 2.2,  '#7e22ce', 36, 0.45);
    _ring3D(wx, wy + 0.06, wz, 3.5,  '#4c1d95', 42, 0.30);
    _rising3D(wx, wy, wz, 24, '#c084fc', 1.0);
    for (var _ai = 0; _ai < 18; _ai++) {
        var _aa = (_ai / 18) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_aa) * 0.2, wy + 0.4, wz + Math.sin(_aa) * 0.2),
            { x: Math.cos(_aa) * 1.5, y: 4.0 + Math.random() * 2.0, z: Math.sin(_aa) * 1.5 },
            '#e879f9', 0.30, 0.80
        );
    }
    triggerScreenShake(9, 0.45);
    triggerScreenFlash('#a855f7', 0.35);
}

// ============================================================
// MISTICO VFX
// ============================================================

// Holy pulse — green/white radial sparkle
function _holyTrail3D(wx, wy, wz, facing, step) {
    if (!threeScene) return;
    var isFinisher = (step === 3);
    var col = isFinisher ? '#86efac' : '#4ade80';
    var col2 = isFinisher ? '#ffffff' : '#bbf7d0';
    var count = isFinisher ? 20 : 10;
    for (var _hi = 0; _hi < count; _hi++) {
        var _ha = ((_hi / count) * Math.PI * 2);
        _spawn3D(
            new THREE.Vector3(wx + (Math.random()-0.5)*0.15, wy + 0.1 + Math.random()*0.3, wz + (Math.random()-0.5)*0.15),
            { x: Math.cos(_ha) * (isFinisher ? 1.8 : 1.2), y: 0.8 + Math.random(), z: Math.sin(_ha) * (isFinisher ? 1.8 : 1.2) },
            _hi % 2 === 0 ? col : col2, 0.20, isFinisher ? 0.35 : 0.22
        );
    }
}

// Onda Sacra — expanding green holy wave
function vfxOndaSacra3D(wx, wy, wz) {
    _ring3D(wx, wy + 0.12, wz, 0.40, '#86efac', 16, 0.60);
    _ring3D(wx, wy + 0.10, wz, 1.00, '#4ade80', 24, 0.45);
    _ring3D(wx, wy + 0.08, wz, 1.80, '#22c55e', 30, 0.32);
    _burst3D(wx, wy + 0.4, wz, 22, '#86efac', 4.0, 0.50);
    _rising3D(wx, wy, wz, 18, '#4ade80', 0.75);
    for (var _oi = 0; _oi < 10; _oi++) {
        var _oa = (_oi / 10) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_oa) * 0.2, wy + 0.05, wz + Math.sin(_oa) * 0.2),
            { x: Math.cos(_oa) * 2.0, y: 2.2 + Math.random(), z: Math.sin(_oa) * 2.0 },
            '#fef08a', 0.26, 0.45
        );
    }
    triggerScreenShake(2.5, 0.18);
    triggerScreenFlash('#22c55e', 0.14);
}

// Heal VFX on healed target
function vfxHealTarget3D(wx, wy, wz) {
    _rising3D(wx, wy, wz, 12, '#4ade80', 0.60);
    _ring3D(wx, wy + 0.05, wz, 0.3, '#86efac', 12, 0.35);
    for (var _hii = 0; _hii < 6; _hii++) {
        _spawn3D(
            new THREE.Vector3(wx + (Math.random()-0.5)*0.2, wy + 0.05, wz + (Math.random()-0.5)*0.2),
            { x: (Math.random()-0.5)*0.3, y: 2.0 + Math.random() * 0.8, z: (Math.random()-0.5)*0.3 },
            '#fef08a', 0.22, 0.45
        );
    }
}

// Mistico ability VFX — Benedizione
function vfxBenedizione3D(wx, wy, wz) {
    _rising3D(wx, wy, wz, 18, '#4ade80', 0.70);
    _ring3D(wx, wy + 0.08, wz, 0.5, '#86efac', 16, 0.50);
    _ring3D(wx, wy + 0.06, wz, 1.1, '#22c55e', 22, 0.35);
    for (var _bi = 0; _bi < 8; _bi++) {
        _spawn3D(
            new THREE.Vector3(wx + (Math.random()-0.5)*0.3, wy + 0.1, wz + (Math.random()-0.5)*0.3),
            { x: (Math.random()-0.5)*0.5, y: 3.0 + Math.random() * 1.0, z: (Math.random()-0.5)*0.5 },
            '#fef08a', 0.25, 0.55
        );
    }
    triggerScreenFlash('#22c55e', 0.10);
}

// Mistico ultimate — Resurrezione
function vfxResurrezione3D(wx, wy, wz) {
    _burst3D(wx, wy + 0.7, wz, 36, '#4ade80', 5.0, 0.80);
    _ring3D(wx, wy + 0.1, wz, 0.6,  '#86efac', 20, 0.75);
    _ring3D(wx, wy + 0.08, wz, 1.3,  '#22c55e', 28, 0.60);
    _ring3D(wx, wy + 0.06, wz, 2.2,  '#15803d', 34, 0.42);
    _rising3D(wx, wy, wz, 26, '#4ade80', 1.0);
    for (var _ri = 0; _ri < 16; _ri++) {
        var _ra = (_ri / 16) * Math.PI * 2;
        _spawn3D(
            new THREE.Vector3(wx + Math.cos(_ra) * 0.2, wy + 0.3, wz + Math.sin(_ra) * 0.2),
            { x: Math.cos(_ra) * 0.8, y: 4.5 + Math.random() * 2.0, z: Math.sin(_ra) * 0.8 },
            '#fef08a', 0.32, 0.85
        );
    }
    triggerScreenShake(5, 0.28);
    triggerScreenFlash('#4ade80', 0.28);
}

// ---- Skill VFX ----
function vfxSkillImpact(cx, cy, tx, ty, color) {
    var from = _pixToWorld(cx, cy); from.y += 0.5;
    var to   = _pixToWorld(tx, ty); to.y += 0.5;
    _projectile3D(from, to, color, 10, color, 14);
}

function vfxSkillGlobal(color) {
    triggerScreenFlash(color, 0.3);
}

function vfxSkillZone(row, col, radius, color, duration) {
    _zone3D(row, col, radius, color, duration);
}

function vfxDash(cx, cy, tx, ty, color) {
    var from = _pixToWorld(cx, cy); from.y += 0.3;
    var to   = _pixToWorld(tx, ty); to.y += 0.3;
    // trail
    var steps = 15;
    for (var i = 0; i < steps; i++) {
        var frac = i / steps;
        var pos = from.clone().lerp(to, frac);
        _spawn3D(pos, {x:(Math.random()-0.5)*0.5, y:0.8, z:(Math.random()-0.5)*0.5}, color, 0.5, 0.3 + frac * 0.3);
    }
    // impact
    _burst3D(to.x, to.y, to.z, 16, color, 3.0, 0.4);
    triggerScreenShake(3, 0.15);
}

function vfxUltimate(x, y, color) {
    var c = color || '#fbbf24';
    var w = _pixToWorld(x, y);
    // massive burst
    _burst3D(w.x, w.y + 0.5, w.z, 40, c, 5.0, 0.8);
    // large ring
    _ring3D(w.x, w.y + 0.2, w.z, 1.5, c, 30, 0.7);
    // secondary smaller ring
    _ring3D(w.x, w.y + 0.6, w.z, 0.8, '#ffffff', 16, 0.5);
    // rising energy
    _rising3D(w.x, w.y, w.z, 20, c, 0.9);
    // screen effects
    triggerScreenShake(6, 0.4);
    triggerScreenFlash(c, 0.35);
}

// ---- Tesi Difettosa (Caronte's signature skill) ----
function vfxTesi(cx, cy, tx, ty) {
    var from = _pixToWorld(cx, cy); from.y += 0.7;
    var to   = _pixToWorld(tx, ty); to.y += 0.5;
    _projectile3D(from, to, '#c084fc', 8, '#a855f7', 18);
}

// ---- Spawn helpers used by existing vfx.js API ----
function spawnBurst(x, y, count, config) {
    var w = _pixToWorld(x, y);
    var c = config || {};
    _burst3D(w.x, w.y + 0.3, w.z, count, c.color || '#fff', (c.speed || 60) / 20, c.life || 0.5, c.type);
}

function spawnRising(x, y, count, config) {
    var w = _pixToWorld(x, y);
    var c = config || {};
    _rising3D(w.x, w.y + 0.2, w.z, count, c.color || '#fff', c.life || 0.7);
}

function spawnRing(x, y, radius, config) {
    var w = _pixToWorld(x, y);
    var c = config || {};
    _ring3D(w.x, w.y + 0.2, w.z, (radius || 1) * TILE_UNIT * 0.5, c.color || '#fff', c.count || 16, c.life || 0.5);
}

function spawnTrail(x1, y1, x2, y2, config) {
    var from = _pixToWorld(x1, y1); from.y += 0.4;
    var to   = _pixToWorld(x2, y2); to.y += 0.4;
    var c = config || {};
    var n = c.count || 12;
    for (var i = 0; i < n; i++) {
        var frac = i / n;
        var pos = from.clone().lerp(to, frac);
        _spawn3D(pos, {x:0, y:0.3, z:0}, c.color || '#fff', 0.4, 0.2 + frac * 0.2);
    }
}

function spawnProjectile(x1, y1, x2, y2, config) {
    var from = _pixToWorld(x1, y1); from.y += 0.5;
    var to   = _pixToWorld(x2, y2); to.y += 0.5;
    var c = config || {};
    _projectile3D(from, to, c.color || '#fff', (c.speed || 350) / 40, c.impactColor || c.color || '#fff', c.impactCount || 10);
}

// ---- Zone visual (used by addZoneVisual in vfx.js) ----
function addZoneVisual(row, col, radius, color, duration) {
    _zone3D(row, col, radius, color, duration);
}

// ==================================================================
//  OVERRIDE the 2D vfx update/render with 3D versions
// ==================================================================
// The 2D functions updateVFX(dt) and renderVFX(ctx) from vfx.js
// are still called in the 2D fallback path. In 3D mode, renderFrame3D
// calls updateVfx3D(dt) instead.

// Hook into render loop: override updateVFX to use 3D when available
var _origUpdateVFX = typeof updateVFX === 'function' ? updateVFX : null;
var _origRenderVFX = typeof renderVFX === 'function' ? renderVFX : null;

updateVFX = function(dt) {
    if (typeof threeRenderer !== 'undefined' && threeRenderer) {
        updateVfx3D(dt);
    } else if (_origUpdateVFX) {
        _origUpdateVFX(dt);
    }
};

renderVFX = function(ctx2d) {
    // In 3D mode, particles are already rendered by Three.js
    if (typeof threeRenderer !== 'undefined' && threeRenderer) return;
    if (_origRenderVFX) _origRenderVFX(ctx2d);
};
