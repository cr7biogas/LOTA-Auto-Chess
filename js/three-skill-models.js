// ============================================================
// LOTA AUTO CHESS — three-skill-models.js  v2 ARTISTIC
// Persistent animated 3D geometry for skill effects.
// Onde · Monete · Fulmini · Fiamme · Purghe
// ============================================================

// ── Active skill model pool ──────────────────────────────────
var _skillModels3D = [];

function _smSpawn(group, life, updateFn) {
    if (!threeScene) return null;
    threeScene.add(group);
    var m = { group: group, life: life, maxLife: life, update: updateFn, time: 0 };
    _skillModels3D.push(m);
    return m;
}

function updateSkillModels3D(dt) {
    var alive = [];
    for (var i = 0; i < _skillModels3D.length; i++) {
        var m = _skillModels3D[i];
        m.life -= dt;
        m.time += dt;
        if (m.life <= 0) {
            threeScene.remove(m.group);
            m.group.traverse(function(c) {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    if (c.material.map) c.material.map.dispose();
                    c.material.dispose();
                }
            });
            continue;
        }
        var ratio = m.life / m.maxLife;
        if (m.update) m.update(m, dt, ratio);
        alive.push(m);
    }
    _skillModels3D = alive;
}

// ── Material helpers ─────────────────────────────────────────
function _smM(hex, emissive, emissiveI, opacity, rough, metal, doubleSide) {
    return new THREE.MeshStandardMaterial({
        color: hex || '#ffffff',
        emissive: emissive || hex || '#ffffff',
        emissiveIntensity: emissiveI !== undefined ? emissiveI : 0.6,
        roughness: rough !== undefined ? rough : 0.45,
        metalness: metal !== undefined ? metal : 0.15,
        transparent: true,
        opacity: opacity !== undefined ? opacity : 0.92,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: false
    });
}
function _smB(hex, opacity) { // basic glow
    return new THREE.MeshBasicMaterial({
        color: hex, transparent: true,
        opacity: opacity !== undefined ? opacity : 0.75,
        depthWrite: false, side: THREE.DoubleSide
    });
}

// ── LIGHTNING BUILDER ────────────────────────────────────────
// Creates a zigzag bolt from 'from' to 'to' as a group of thin cylinders
function _smLightning(from, to, color, branchProb, thickness) {
    var g = new THREE.Group();
    thickness = thickness || 0.012;
    var mat = _smB(color || '#ffffff', 0.95);
    var glowMat = _smB(color || '#ffffff', 0.30);

    function _addSegment(a, b, thick) {
        var dir = b.clone().sub(a);
        var len = dir.length();
        if (len < 0.01) return;
        var mid = a.clone().lerp(b, 0.5);
        var seg = new THREE.Mesh(
            new THREE.CylinderGeometry(thick, thick, len, 4),
            mat
        );
        seg.position.copy(mid);
        seg.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.clone().normalize()
        );
        g.add(seg);
        // glow sleeve
        var glow = new THREE.Mesh(
            new THREE.CylinderGeometry(thick * 3, thick * 3, len, 4),
            glowMat
        );
        glow.position.copy(mid);
        glow.quaternion.copy(seg.quaternion);
        g.add(glow);
    }

    // Main bolt — subdivide into random zigzag segments
    var steps = 8;
    var prev = from.clone();
    for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        var next = from.clone().lerp(to, t);
        if (i < steps) {
            var perp1 = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.3, Math.random() - 0.5);
            perp1.normalize().multiplyScalar(0.18 + Math.random() * 0.22);
            next.add(perp1);
        }
        _addSegment(prev, next, thickness);
        // random branch
        if (Math.random() < (branchProb || 0.4) && i < steps - 1) {
            var branchEnd = next.clone();
            branchEnd.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.7,
                -(0.1 + Math.random() * 0.3),
                (Math.random() - 0.5) * 0.7
            ));
            _addSegment(next, branchEnd, thickness * 0.55);
        }
        prev = next;
    }
    return g;
}

// ── FLAME BUILDER ─────────────────────────────────────────────
// Multi-layer animated flame system
function _smFlame(pos, baseRadius, height, colors, life) {
    var g = new THREE.Group();
    colors = colors || ['#ef4444', '#f97316', '#fbbf24', '#fef08a'];

    // 4 nested cone layers, each slightly offset/scaled
    for (var l = 0; l < 4; l++) {
        var frac = l / 3;
        var r = baseRadius * (1 - frac * 0.55);
        var h = height * (1 - frac * 0.25);
        var cone = new THREE.Mesh(
            new THREE.ConeGeometry(r, h, 10, 1, true),
            new THREE.MeshBasicMaterial({
                color: colors[l] || '#fbbf24',
                transparent: true,
                opacity: 0.22 + frac * 0.08,
                side: THREE.DoubleSide, depthWrite: false
            })
        );
        cone.position.y = h * 0.5;
        cone.name = 'cone_' + l;
        g.add(cone);
    }
    // bright inner spire
    var spire = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.18, height * 1.15, 8, 1),
        _smB('#fef9c3', 0.55)
    );
    spire.position.y = height * 0.58;
    spire.name = 'spire';
    g.add(spire);
    // embers — small spheres
    for (var e = 0; e < 10; e++) {
        var ember = new THREE.Mesh(
            new THREE.SphereGeometry(0.022 + Math.random() * 0.018, 4, 3),
            _smB(colors[Math.floor(Math.random() * 2)], 0.8)
        );
        ember.position.set(
            (Math.random() - 0.5) * baseRadius * 0.8,
            Math.random() * height * 0.4,
            (Math.random() - 0.5) * baseRadius * 0.8
        );
        ember._vy = 1.2 + Math.random() * 1.8;
        ember._vx = (Math.random() - 0.5) * 0.8;
        ember._vz = (Math.random() - 0.5) * 0.8;
        ember.name = 'ember_' + e;
        g.add(ember);
    }
    var fireLight = new THREE.PointLight(colors[0], 12.0, 5.0);
    fireLight.position.y = height * 0.3;
    fireLight.name = 'light';
    g.add(fireLight);
    var warmLight = new THREE.PointLight(colors[2] || '#fbbf24', 6.0, 7.0);
    warmLight.name = 'warmLight';
    g.add(warmLight);

    g.position.copy(pos);

    _smSpawn(g, life || 4.0, function(m, dt, ratio) {
        var fade = ratio < 0.12 ? ratio / 0.12 : 1.0;
        // flicker
        var flicker = 0.85 + Math.sin(m.time * 17) * 0.1 + Math.sin(m.time * 31) * 0.05;
        for (var l = 0; l < 4; l++) {
            var c2 = g.getObjectByName('cone_' + l);
            if (c2) {
                var frac = l / 3;
                c2.scale.x = 1.0 + Math.sin(m.time * 8 + l * 1.3) * 0.12;
                c2.scale.z = 1.0 + Math.sin(m.time * 9 + l * 0.9) * 0.12;
                c2.scale.y = 1.0 + Math.sin(m.time * 6 + l) * 0.08;
                c2.material.opacity = (0.22 + frac * 0.08) * flicker * fade;
            }
        }
        var sp = g.getObjectByName('spire');
        if (sp) { sp.scale.x = flicker; sp.scale.z = flicker; sp.material.opacity = 0.5 * flicker * fade; }
        // ember rise
        for (var e = 0; e < 10; e++) {
            var em = g.getObjectByName('ember_' + e);
            if (em) {
                em.position.x += em._vx * dt;
                em.position.y += em._vy * dt;
                em.position.z += em._vz * dt;
                em._vy -= dt * 0.5; // slight gravity
                em.material.opacity = 0.8 * (em.position.y / (height * 1.4)) * fade;
                if (em.position.y > height * 1.3 || em.position.y < 0) {
                    em.position.set((Math.random()-0.5)*baseRadius*0.8, Math.random()*height*0.2, (Math.random()-0.5)*baseRadius*0.8);
                    em._vy = 1.2 + Math.random() * 1.8;
                }
            }
        }
        var fl = g.getObjectByName('light');
        if (fl) fl.intensity = 12 * flicker * fade;
        var wl = g.getObjectByName('warmLight');
        if (wl) wl.intensity = 6 * flicker * fade;
    });
    return g;
}

// ── WAVE RING BUILDER ─────────────────────────────────────────
// Spawns an expanding ring wave at 'pos'
function _smWaveRing(pos, color, startRadius, endRadius, life, height) {
    var g = new THREE.Group();
    height = height !== undefined ? height : (pos.y || UNIT_BASE_Y);
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(startRadius, 0.055, 10, 48),
        _smM(color, color, 0.9, 0.85, 0.2, 0.1, false)
    );
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'ring';
    g.add(ring);
    // glow disc
    var disc = new THREE.Mesh(
        new THREE.CircleGeometry(startRadius, 48),
        _smB(color, 0.12)
    );
    disc.rotation.x = -Math.PI / 2;
    disc.name = 'disc';
    g.add(disc);
    var wLight = new THREE.PointLight(color, 6.0, 4.0);
    wLight.name = 'light';
    g.add(wLight);

    g.position.copy(pos);
    g.position.y = UNIT_BASE_Y + 0.02;

    _smSpawn(g, life || 0.6, function(m, dt, ratio) {
        var progress = 1 - ratio;
        var r = startRadius + progress * (endRadius - startRadius);
        var rg = g.getObjectByName('ring');
        var dg = g.getObjectByName('disc');
        if (rg) { rg.scale.setScalar(r / startRadius); rg.material.opacity = 0.85 * ratio; }
        if (dg) { dg.scale.setScalar(r / startRadius); dg.material.opacity = 0.1 * ratio; }
        var lg = g.getObjectByName('light');
        if (lg) lg.intensity = 6 * ratio;
    });
}

// ============================================================
//  MAIN DISPATCH
// ============================================================
function spawnSkillModel(skillId, caster, target, allUnits) {
    if (!threeScene || typeof cellToWorld !== 'function') return;
    var cp = cellToWorld(caster.row, caster.col);
    var tp = target ? cellToWorld(target.row, target.col) : null;

    switch (skillId) {

        // ─── BABIDI ─ monete, veleno, oro ────────────────────

        case 'babidi_tangente':
            _sm_coinProjectile(cp, tp);
            break;
        case 'babidi_bolla':
            if (tp) _sm_toxicBubble(tp);
            break;
        case 'babidi_acquario':
            if (target) _sm_poisonPool(target.row, target.col);
            break;
        case 'babidi_contrattazione':
            if (tp) _sm_goldChain(cp, tp);
            break;
        case 'babidi_monopolio':
            _sm_coinCrown(cp);
            break;
        case 'babidi_bancarotta':
            _sm_coinExplosion(cp);
            break;
        case 'babidi_inflazione':
            _sm_poisonInferno(cp);
            break;

        // ─── CARONTE ─ magia, fulmini, portali ───────────────

        case 'caronte_teleport':
            _sm_portalPair(cp, tp);
            break;
        case 'caronte_bocciatura':
            if (tp) _sm_judgmentBolt(cp, tp);
            break;
        case 'caronte_lezione':
            _sm_slowWavePulse(cp);
            break;
        case 'caronte_cattedra':
            if (target) _sm_darkThrone(target.row, target.col);
            break;
        case 'caronte_defenestrazione':
            if (tp) _sm_windowShatter(tp);
            break;
        case 'caronte_tesi_plus':
            _sm_bookChargeUp(cp);
            break;

        // ─── VALERIO ─ terra, rocce, crepe ───────────────────

        case 'valerio_scossa':
            _sm_seismicWaves(cp);
            break;
        case 'valerio_terremoto':
            _sm_rockPillars(cp);
            break;
        case 'valerio_tana':
            _sm_burrowHole(cp);
            break;
        case 'valerio_muro':
            _sm_armorWall(cp);
            break;
        case 'valerio_provocazione':
            _sm_tauntField(cp);
            break;

        // ─── YUJIN ─ fuoco, ghiaccio, fulmini ────────────────

        case 'yujin_valchiria':
            _sm_divineWings(cp);
            break;
        case 'yujin_ghiaccio':
            _sm_iceHexShield(cp);
            break;
        case 'yujin_ragnarok_p':
            _sm_ragnarokInferno(cp);
            break;
        case 'yujin_frenesia':
            if (tp) _sm_frenzyStrikes(cp, tp);
            break;
        case 'yujin_carica':
            if (tp) _sm_berserkDash(cp, tp);
            break;
        case 'yujin_esecutore':
            if (tp) _sm_executionSlam(tp);
            break;

        // ─── WMS ─ singolarità, onde, vuoto ──────────────────

        case 'wms_singolarita':
            _sm_singularity(cp);
            break;
        case 'wms_trascendenza':
            _sm_divineBeam(cp);
            break;
        case 'wms_vuoto':
            if (tp) _sm_voidPurge(tp);
            break;
        case 'wms_anomalia':
            _sm_gravityPull(cp);
            break;
        case 'wms_onda':
            _sm_cosmicWave(cp);
            break;
        case 'wms_sdoppiamento':
            _sm_splitEcho(cp);
            break;
    }
}

// ============================================================
//  BABIDI — MONETE & VELENO
// ============================================================

function _sm_coinProjectile(from, to) {
    var g = new THREE.Group();
    // 3 coins in formation
    for (var c = 0; c < 3; c++) {
        var coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.13, 0.13, 0.022, 20),
            _smM('#fbbf24', '#fde047', 1.4, 0.95, 0.1, 0.85)
        );
        coin.position.set((c - 1) * 0.18, c * 0.09, 0);
        coin.name = 'coin_' + c;
        g.add(coin);
        var rim = new THREE.Mesh(
            new THREE.TorusGeometry(0.13, 0.014, 8, 20),
            _smM('#f59e0b', '#fbbf24', 0.9, 0.9, 0.15, 0.9)
        );
        rim.position.copy(coin.position);
        rim.rotation.x = Math.PI / 2;
        g.add(rim);
    }
    var goldLight = new THREE.PointLight('#fbbf24', 10.0, 3.5);
    goldLight.name = 'light';
    g.add(goldLight);

    g.position.copy(from); g.position.y += 0.55;
    var dir = to ? to.clone().sub(from) : null;
    var dist = dir ? dir.length() : 0;
    if (dir) dir.normalize();

    _smSpawn(g, 0.65, function(m, dt, ratio) {
        if (dist > 0 && dir) {
            var traveled = (1 - ratio) * m.maxLife * 11;
            if (traveled <= dist) {
                g.position.copy(from.clone().addScaledVector(dir, traveled));
                g.position.y = from.y + 0.55 + Math.sin((1 - ratio) * Math.PI) * 0.55;
            }
        }
        // fast spin each coin
        for (var c = 0; c < 3; c++) {
            var coin = g.getObjectByName('coin_' + c);
            if (coin) coin.rotation.y += dt * (14 + c * 4);
        }
        // trail glitter
        g.scale.setScalar(0.9 + Math.sin(m.time * 20) * 0.06);
        goldLight.intensity = 10 * ratio;
    });
}

function _sm_toxicBubble(pos) {
    var g = new THREE.Group();
    var outer = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 14),
        new THREE.MeshStandardMaterial({
            color: '#22c55e', emissive: '#16a34a', emissiveIntensity: 0.4,
            transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
            roughness: 0.05
        })
    );
    outer.name = 'outer';
    g.add(outer);
    // inner membrane
    var inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 16, 12),
        _smB('#4ade80', 0.07)
    );
    g.add(inner);
    // toxic ring at equator
    var eqRing = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.032, 10, 40),
        _smM('#22c55e', '#4ade80', 1.2, 0.85, 0.2, 0.1)
    );
    eqRing.rotation.x = Math.PI / 2;
    g.add(eqRing);
    // 3 highlight spots
    for (var i = 0; i < 3; i++) {
        var spot = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 6),
            _smB('#86efac', 0.7)
        );
        var a = (i / 3) * Math.PI * 2;
        spot.position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.65);
        g.add(spot);
    }
    var tLight = new THREE.PointLight('#22c55e', 10.0, 5.0);
    tLight.name = 'light';
    g.add(tLight);

    g.position.copy(pos); g.position.y += 0.55;
    g.scale.setScalar(0.01);

    _smSpawn(g, 1.0, function(m, dt, ratio) {
        var grow = ratio > 0.5 ? 1.0 : ratio / 0.5;
        var fade = ratio < 0.18 ? ratio / 0.18 : 1.0;
        g.scale.setScalar(Math.max(0.02, grow * fade * 0.95));
        outer.material.opacity = (0.12 + Math.sin(m.time * 9) * 0.04) * fade;
        eqRing.rotation.z += dt * 1.2;
        tLight.intensity = 10 * fade;
    });
}

function _sm_poisonPool(row, col) {
    var pos = cellToWorld(row, col);
    var g = new THREE.Group();
    var R = TILE_UNIT * 1.7;
    // main disc
    var disc = new THREE.Mesh(new THREE.CircleGeometry(R, 36),
        _smB('#16a34a', 0.28));
    disc.rotation.x = -Math.PI / 2;
    disc.name = 'disc';
    g.add(disc);
    // outer ring
    var ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055, 10, 40),
        _smM('#22c55e', '#4ade80', 1.3, 0.9, 0.2, 0.0));
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'ring';
    g.add(ring);
    // inner ring
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.03, 8, 32),
        _smB('#4ade80', 0.5));
    ring2.rotation.x = -Math.PI / 2;
    ring2.name = 'ring2';
    g.add(ring2);
    // bubbles rising
    for (var i = 0; i < 8; i++) {
        var b = new THREE.Mesh(new THREE.SphereGeometry(0.045 + Math.random()*0.03, 6, 4),
            _smB('#86efac', 0.65));
        var a = Math.random()*Math.PI*2, r = Math.random()*R*0.75;
        b.position.set(Math.cos(a)*r, 0.01, Math.sin(a)*r);
        b.name = 'bub_' + i;
        g.add(b);
    }
    var pLight = new THREE.PointLight('#22c55e', 8.0, 5.0);
    pLight.name = 'light';
    g.add(pLight);

    g.position.copy(pos); g.position.y = UNIT_BASE_Y + 0.006;

    _smSpawn(g, 4.5, function(m, dt, ratio) {
        var fade = ratio < 0.14 ? ratio / 0.14 : 1.0;
        disc.material.opacity = (0.22 + Math.sin(m.time*2.5)*0.08) * fade;
        ring.material.opacity = (0.8 + Math.sin(m.time*3.5)*0.15) * fade;
        ring2.rotation.z += dt * 0.7;
        ring2.material.opacity = (0.4 + Math.sin(m.time*4)*0.2) * fade;
        for (var i = 0; i < 8; i++) {
            var b = g.getObjectByName('bub_' + i);
            if (b) {
                b.position.y += dt * (0.35 + i*0.04);
                b.material.opacity = 0.6 * (1 - b.position.y / 0.55) * fade;
                if (b.position.y > 0.5) b.position.y = 0.005;
            }
        }
        pLight.intensity = 8 * fade;
    });
}

function _sm_goldChain(from, to) {
    var g = new THREE.Group();
    var dir = to.clone().sub(from);
    var dist = dir.length();
    dir.normalize();
    var linkCount = Math.max(4, Math.floor(dist * 4));
    for (var i = 0; i < linkCount; i++) {
        var t = i / linkCount;
        var pos2 = from.clone().lerp(to, t);
        pos2.y += 0.55 + Math.sin(t * Math.PI) * 0.3;
        var link = new THREE.Mesh(
            new THREE.TorusGeometry(0.065, 0.018, 7, 14),
            _smM('#fbbf24', '#fde047', 1.2, 0.88, 0.15, 0.85)
        );
        link.position.copy(pos2);
        link.rotation.y = (i % 2 === 0) ? 0 : Math.PI / 2;
        link.rotation.x = 0.4;
        g.add(link);
    }
    var cLight = new THREE.PointLight('#fbbf24', 8.0, 4.0);
    cLight.name = 'light';
    g.position.set(0,0,0);
    g.add(cLight);
    cLight.position.copy(from.clone().lerp(to, 0.5));
    cLight.position.y += 0.75;

    _smSpawn(g, 0.7, function(m, dt, ratio) {
        cLight.intensity = 8 * ratio;
        g.children.forEach(function(c2, idx) {
            if (c2.isMesh) c2.material.opacity = 0.88 * ratio;
        });
    });
}

function _sm_coinCrown(pos) {
    var g = new THREE.Group();
    var N = 10;
    var R = 0.58;
    for (var i = 0; i < N; i++) {
        var a = (i / N) * Math.PI * 2;
        var coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.09, 0.016, 18),
            _smM('#fbbf24', '#fef08a', 1.5, 0.95, 0.08, 0.88)
        );
        coin.position.set(Math.cos(a)*R, 0, Math.sin(a)*R);
        coin.rotation.x = Math.PI/2;
        coin.name = 'c_' + i;
        g.add(coin);
        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 6, 16),
            _smB('#f59e0b', 0.75));
        rim.position.copy(coin.position);
        rim.rotation.copy(coin.rotation);
        g.add(rim);
    }
    // 6 tall crown spires
    for (var j = 0; j < 6; j++) {
        var sa = (j / 6) * Math.PI * 2;
        var sp = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.22, 5),
            _smM('#fde047', '#fbbf24', 1.8, 0.9, 0.1, 0.85));
        sp.position.set(Math.cos(sa)*R*0.75, 0.12, Math.sin(sa)*R*0.75);
        g.add(sp);
    }
    // crown band
    var band = new THREE.Mesh(new THREE.TorusGeometry(R*0.76, 0.038, 8, 36),
        _smM('#f59e0b', '#fbbf24', 1.0, 0.85, 0.2, 0.8));
    band.rotation.x = Math.PI/2;
    g.add(band);
    var cLight = new THREE.PointLight('#fbbf24', 14.0, 5.0);
    g.add(cLight);

    g.position.copy(pos); g.position.y += 1.4;
    g.scale.setScalar(0.05);

    _smSpawn(g, 5.5, function(m, dt, ratio) {
        var s = ratio > 0.88 ? (1-ratio)/0.12 : (ratio < 0.08 ? ratio/0.08 : 1.0);
        g.scale.setScalar(Math.max(0.02, s));
        g.rotation.y += dt * 2.2;
        g.position.y = pos.y + 1.4 + Math.sin(m.time*2.5)*0.09;
        for (var i = 0; i < N; i++) {
            var c2 = g.getObjectByName('c_' + i);
            if (c2) c2.rotation.z += dt * 5;
        }
        cLight.intensity = 14 * s;
    });
}

function _sm_coinExplosion(pos) {
    var g = new THREE.Group();
    var coinCount = 18;
    for (var i = 0; i < coinCount; i++) {
        var coin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.018, 16),
            _smM('#fbbf24', '#fef08a', 1.6, 0.95, 0.08, 0.9)
        );
        var a = (i / coinCount) * Math.PI * 2;
        var pitch = (Math.random() - 0.5) * Math.PI;
        var speed = 2.5 + Math.random() * 2.0;
        coin._vx = Math.cos(a) * Math.cos(pitch) * speed;
        coin._vy = Math.abs(Math.sin(pitch)) * speed + 1.5;
        coin._vz = Math.sin(a) * Math.cos(pitch) * speed;
        coin.position.set(0, 0.4, 0);
        coin.name = 'c_' + i;
        g.add(coin);
    }
    var blast = new THREE.PointLight('#fbbf24', 20.0, 6.0);
    blast.name = 'blast';
    g.add(blast);
    g.position.copy(pos);

    _smSpawn(g, 1.1, function(m, dt, ratio) {
        for (var i = 0; i < coinCount; i++) {
            var c2 = g.getObjectByName('c_' + i);
            if (c2) {
                c2.position.x += c2._vx * dt;
                c2.position.y += c2._vy * dt;
                c2.position.z += c2._vz * dt;
                c2._vy -= 9 * dt;
                c2.rotation.y += dt * (8 + i * 0.5);
                c2.material.opacity = 0.9 * ratio;
            }
        }
        blast.intensity = 20 * ratio;
    });
}

function _sm_poisonInferno(pos) {
    var g = new THREE.Group();
    // call flame builder with green-poison palette
    var fp = pos.clone(); fp.y = UNIT_BASE_Y;
    _smFlame(fp, 0.65, 1.6, ['#16a34a','#22c55e','#4ade80','#a3e635'], 4.0);
    // outer toxic ring wave
    _smWaveRing(fp, '#22c55e', 0.2, 2.8, 0.8);
    _smSpawn(g, 0.01, function(){}); // dummy just to not break
}

// ============================================================
//  CARONTE — MAGIA, FULMINI, PORTALI
// ============================================================

function _sm_portalPair(from, to) {
    function _makePortal(pos, c1, c2) {
        var pg = new THREE.Group();
        // outer torus
        var outerT = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 14, 48),
            _smM(c1, c2, 1.1, 0.95, 0.2, 0.25));
        outerT.name = 'outerT';
        pg.add(outerT);
        // inner counter-rotating torus
        var innerT = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.042, 10, 36),
            _smM(c2, c1, 0.9, 0.85, 0.3, 0.2));
        innerT.name = 'innerT';
        pg.add(innerT);
        // portal fill
        var fill = new THREE.Mesh(new THREE.CircleGeometry(0.42, 36),
            _smB(c1, 0.16));
        fill.name = 'fill';
        pg.add(fill);
        // 8 energy spokes
        for (var i = 0; i < 8; i++) {
            var spoke = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.003, 0.38, 3),
                _smB(c2, 0.7)
            );
            var a = (i/8)*Math.PI*2;
            spoke.position.set(Math.cos(a)*0.22, Math.sin(a)*0.22, 0);
            spoke.rotation.z = a + Math.PI/2;
            pg.add(spoke);
        }
        var pL = new THREE.PointLight(c1, 12.0, 4.0);
        pL.name = 'pLight';
        pg.add(pL);
        return pg;
    }
    var p1 = _makePortal(from, '#7c3aed', '#c084fc');
    p1.position.copy(from); p1.position.y += 0.65;
    p1.scale.setScalar(0.04);

    var p2 = to ? _makePortal(to, '#a78bfa', '#6d28d9') : null;
    if (p2) { p2.position.copy(to); p2.position.y += 0.65; p2.scale.setScalar(0.04); }

    function _pu(pg) {
        return function(m, dt, ratio) {
            var s = ratio > 0.82 ? (1-ratio)/0.18 : (ratio < 0.08 ? ratio/0.08 : 1.0);
            pg.scale.setScalar(Math.max(0.02, s));
            var ot = pg.getObjectByName('outerT'); if (ot) ot.rotation.z += dt*2.8;
            var it = pg.getObjectByName('innerT'); if (it) it.rotation.z -= dt*5.5;
            var fi = pg.getObjectByName('fill'); if (fi) fi.material.opacity = (0.12 + Math.sin(m.time*8)*0.06)*s;
            var pl = pg.getObjectByName('pLight'); if (pl) pl.intensity = 12*s;
        };
    }
    _smSpawn(p1, 0.85, _pu(p1));
    if (p2) _smSpawn(p2, 0.85, _pu(p2));
}

function _sm_judgmentBolt(from, to) {
    var g = new THREE.Group();
    // Main red lightning bolt
    var bolt = _smLightning(
        new THREE.Vector3(from.x, from.y + 1.2, from.z),
        new THREE.Vector3(to.x,   to.y   + 0.2, to.z),
        '#ef4444', 0.5, 0.018
    );
    bolt.name = 'bolt';
    g.add(bolt);
    // Bright secondary bolt (narrower)
    var bolt2 = _smLightning(
        new THREE.Vector3(from.x+0.05, from.y + 1.2, from.z),
        new THREE.Vector3(to.x-0.05,   to.y   + 0.2, to.z),
        '#fbbf24', 0.3, 0.009
    );
    g.add(bolt2);
    // Impact ring
    var impRing = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.05, 8, 24),
        _smM('#ef4444', '#fbbf24', 1.5, 0.9));
    impRing.rotation.x = -Math.PI/2;
    impRing.position.copy(to); impRing.position.y += 0.05;
    impRing.name = 'impRing';
    g.add(impRing);
    var bLight = new THREE.PointLight('#ef4444', 18.0, 5.0);
    bLight.position.copy(to); bLight.position.y += 0.3;
    bLight.name = 'bLight';
    g.add(bLight);
    var topLight = new THREE.PointLight('#ef4444', 10.0, 3.0);
    topLight.position.copy(from); topLight.position.y += 1.2;
    g.add(topLight);

    _smSpawn(g, 0.45, function(m, dt, ratio) {
        // bolt flicker
        bolt.visible = Math.sin(m.time * 60) > -0.4;
        bolt2.visible = Math.sin(m.time * 80) > 0;
        var ir = g.getObjectByName('impRing');
        if (ir) {
            var p2 = (1-ratio); ir.scale.setScalar(1 + p2 * 22);
            ir.material.opacity = 0.9 * ratio;
        }
        bLight.intensity = 18 * ratio * (0.8 + Math.random() * 0.4);
        topLight.intensity = 10 * ratio * (0.7 + Math.random() * 0.6);
        // rebuild bolt shape periodically
        if (Math.floor(m.time * 25) !== Math.floor((m.time - dt) * 25)) {
            g.remove(bolt);
            bolt.traverse(function(c){ if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); });
            bolt = _smLightning(
                new THREE.Vector3(from.x, from.y+1.2, from.z),
                new THREE.Vector3(to.x, to.y+0.2, to.z),
                '#ef4444', 0.5, 0.018
            );
            g.add(bolt);
        }
    });
}

function _sm_slowWavePulse(pos) {
    var delays = [0, 0.12, 0.24];
    var colors = ['#60a5fa', '#93c5fd', '#bfdbfe'];
    for (var i = 0; i < 3; i++) {
        (function(delay, color, idx) {
            setTimeout(function() {
                _smWaveRing(pos, color, 0.2, 3.2 - idx*0.4, 0.75);
            }, delay * 1000);
        })(delays[i], colors[i], i);
    }
}

function _sm_darkThrone(row, col) {
    var pos = cellToWorld(row, col);
    var g = new THREE.Group();
    var dMat = _smM('#3b0764','#6d28d9',0.6,0.9,0.65,0.1);
    var aMat = _smM('#7c3aed','#c084fc',1.2,0.92,0.25,0.1);
    // seat
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.07,0.44), dMat); seat.position.y=0.28; g.add(seat);
    // back panel
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.56,0.045), dMat); back.position.set(0,0.58,-0.2); g.add(back);
    // legs x4
    [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.16],[0.2,0.16]].forEach(function(xz){
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.022,0.28,6),_smM('#4c1d95','#6d28d9',0.4,0.92));
        leg.position.set(xz[0],0.14,xz[1]); g.add(leg);
    });
    // back ornament bars
    for(var b=0; b<3; b++){
        var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.44,4),aMat);
        bar.position.set((b-1)*0.18, 0.58, -0.18); g.add(bar);
    }
    // 3 spires atop back
    [-0.18,0,0.18].forEach(function(x){
        var sp = new THREE.Mesh(new THREE.ConeGeometry(0.028,0.22,5),aMat);
        sp.position.set(x, 0.97, -0.19); g.add(sp);
    });
    // ground curse sigil
    var sigil = new THREE.Mesh(new THREE.CircleGeometry(0.62,32),_smB('#6d28d9',0.22));
    sigil.rotation.x = -Math.PI/2; sigil.position.y=0.005; sigil.name='sigil'; g.add(sigil);
    // inner sigil ring
    var sigRing = new THREE.Mesh(new THREE.TorusGeometry(0.44,0.04,8,32),_smM('#7c3aed','#c084fc',1.0,0.85));
    sigRing.rotation.x = -Math.PI/2; sigRing.position.y=0.01; g.add(sigRing);
    var tLight = new THREE.PointLight('#7c3aed', 14.0, 5.0); tLight.position.y=0.6; tLight.name='tLight'; g.add(tLight);

    g.position.copy(pos); g.position.y = UNIT_BASE_Y;
    g.scale.setScalar(0.01);

    _smSpawn(g, 4.5, function(m, dt, ratio) {
        var s = ratio>0.9?(1-ratio)/0.1 : (ratio<0.07?ratio/0.07:1.0);
        g.scale.setScalar(Math.max(0.01,s));
        var sg = g.getObjectByName('sigil');
        if(sg) sg.material.opacity = (0.18+Math.sin(m.time*3)*0.08)*s;
        tLight.intensity = 14*s;
        g.position.y = UNIT_BASE_Y + Math.sin(m.time*1.8)*0.03*s;
    });
}

function _sm_windowShatter(pos) {
    var g = new THREE.Group();
    for (var i = 0; i < 12; i++) {
        var geo = new THREE.BufferGeometry();
        var pts = new Float32Array([
            0,0,0,
            0.1+Math.random()*0.12, 0, (Math.random()-0.5)*0.06,
            0.05+Math.random()*0.06, 0.18+Math.random()*0.12, 0
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(pts,3));
        var shard = new THREE.Mesh(geo, _smB('#a78bfa', 0.72));
        var a = (i/12)*Math.PI*2;
        shard.position.set(Math.cos(a)*0.12, 0.4, Math.sin(a)*0.12);
        shard.rotation.y = a;
        shard._vx = Math.cos(a)*(2+Math.random()*1.5);
        shard._vy = 3+Math.random()*2.5;
        shard._vz = Math.sin(a)*(2+Math.random()*1.5);
        shard.name = 's_'+i;
        g.add(shard);
    }
    var sLight = new THREE.PointLight('#a78bfa',16.0,4.0); sLight.position.y=0.4; sLight.name='sLight'; g.add(sLight);
    g.position.copy(pos);
    _smSpawn(g, 0.75, function(m,dt,ratio) {
        for(var i=0;i<12;i++){
            var s=g.getObjectByName('s_'+i);
            if(s){ s.position.x+=s._vx*dt; s.position.y+=s._vy*dt; s.position.z+=s._vz*dt;
                s._vy-=12*dt; s.rotation.x+=dt*5; s.rotation.z+=dt*4;
                s.material.opacity=0.72*ratio; }
        }
        sLight.intensity=16*ratio;
    });
}

function _sm_bookChargeUp(pos) {
    var g = new THREE.Group();
    // Floating rune circles
    for (var i = 0; i < 3; i++) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.18+i*0.12,0.022,8,24),
            _smM('#60a5fa','#a78bfa',1.0+i*0.2,0.88,0.2));
        ring.rotation.x = i * 0.6;
        ring.position.y = 0.65;
        ring.name = 'r_'+i;
        g.add(ring);
    }
    var bLight = new THREE.PointLight('#60a5fa',10.0,3.5); bLight.name='bLight'; g.add(bLight);
    bLight.position.y = 0.65;
    g.position.copy(pos);
    _smSpawn(g, 0.9, function(m,dt,ratio) {
        for(var i=0;i<3;i++){
            var r=g.getObjectByName('r_'+i);
            if(r){ r.rotation.y += dt*(2+i*1.5)*(i%2?1:-1); r.material.opacity=0.88*ratio; }
        }
        bLight.intensity=10*ratio;
    });
}

// ============================================================
//  VALERIO — TERRA, ROCCE
// ============================================================

function _sm_seismicWaves(pos) {
    // 4 staggered ground wave rings
    var colors = ['#ef4444','#f97316','#ea580c','#b45309'];
    var delays = [0, 0.08, 0.17, 0.28];
    var radii  = [2.8, 2.4, 1.9, 1.4];
    for (var i = 0; i < 4; i++) {
        (function(d, c, er) {
            setTimeout(function() {
                _smWaveRing(pos, c, 0.15, er, 0.6);
            }, d * 1000);
        })(delays[i], colors[i], radii[i]);
    }
    // central crack
    _sm_groundCrack(pos);
}

function _sm_groundCrack(pos) {
    var g = new THREE.Group();
    for (var i = 0; i < 8; i++) {
        var a = (i/8)*Math.PI*2 + Math.random()*0.22;
        var len = 1.0 + Math.random()*0.8;
        var crack = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.012, len),
            _smB('#ef4444', 0.82)
        );
        crack.position.set(Math.cos(a)*len*0.42, 0.01, Math.sin(a)*len*0.42);
        crack.rotation.y = -a;
        crack.name = 'ck_'+i;
        g.add(crack);
        // lava vein
        var lava = new THREE.Mesh(new THREE.BoxGeometry(0.016,0.015,len*0.85),_smB('#fbbf24',0.55));
        lava.position.copy(crack.position); lava.position.y+=0.006;
        lava.rotation.y = crack.rotation.y;
        g.add(lava);
    }
    var disc = new THREE.Mesh(new THREE.CircleGeometry(0.28,20),_smB('#ef4444',0.6));
    disc.rotation.x=-Math.PI/2; disc.position.y=0.012; disc.name='disc'; g.add(disc);
    var cLight = new THREE.PointLight('#ef4444',12.0,4.0); cLight.name='cLight'; g.add(cLight);
    g.position.copy(pos); g.position.y = UNIT_BASE_Y+0.01;
    _smSpawn(g, 1.0, function(m,dt,ratio) {
        var p = 1-ratio;
        for(var i=0;i<8;i++){
            var c2=g.getObjectByName('ck_'+i);
            if(c2){ c2.scale.z=Math.min(p*4,1.0); c2.material.opacity=0.82*ratio; }
        }
        var d=g.getObjectByName('disc'); if(d) d.material.opacity=0.6*ratio;
        cLight.intensity=12*ratio;
    });
}

function _sm_rockPillars(pos) {
    var g = new THREE.Group();
    for (var i = 0; i < 10; i++) {
        var a = (i/10)*Math.PI*2, dist = 0.5+Math.random()*0.9;
        var h = 0.4+Math.random()*0.6;
        var pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055+Math.random()*0.045, 0.075+Math.random()*0.055, h, 6),
            _smM('#92400e','#ef4444',0.3,1.0,0.88,0.05)
        );
        pillar.position.set(Math.cos(a)*dist, -h*0.5, Math.sin(a)*dist);
        pillar.rotation.y = Math.random()*Math.PI;
        pillar._ty = h*0.5; pillar._h = h; pillar.name='p_'+i;
        g.add(pillar);
        // dirt clumps
        for(var j=0;j<3;j++){
            var bit=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.05),
                _smM('#78350f','#92400e',0.1,1.0,0.92));
            bit.position.set(Math.cos(a)*dist+(Math.random()-0.5)*0.3,0.02,Math.sin(a)*dist+(Math.random()-0.5)*0.3);
            g.add(bit);
        }
    }
    // HUGE center pillar
    var center = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,0.9,8),
        _smM('#b45309','#ef4444',0.45,1.0,0.82,0.06));
    center.position.y=-0.45; center._ty=0.45; center._h=0.9; center.name='center'; g.add(center);
    var qLight = new THREE.PointLight('#ef4444',18.0,7.0); qLight.name='qLight'; g.add(qLight);

    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    _smSpawn(g, 1.4, function(m,dt,ratio) {
        var progress=1-ratio;
        function _rise(obj) {
            if(!obj) return;
            if(progress<0.38){
                var ep=1-Math.pow(1-progress/0.38,3);
                obj.position.y = -obj._h*0.5 + ep*(obj._ty+obj._h*0.5);
            } else if(ratio<0.22){
                obj.position.y = obj._ty*(ratio/0.22);
                obj.material.opacity=ratio/0.22;
            }
        }
        for(var i=0;i<10;i++) _rise(g.getObjectByName('p_'+i));
        _rise(g.getObjectByName('center'));
        qLight.intensity=18*ratio;
    });
}

function _sm_burrowHole(pos) {
    var g = new THREE.Group();
    var hole = new THREE.Mesh(new THREE.CircleGeometry(0.42,24),
        _smB('#0c0a09',0.9)); hole.rotation.x=-Math.PI/2; hole.name='hole'; g.add(hole);
    var dirtRing = new THREE.Mesh(new THREE.TorusGeometry(0.42,0.08,10,28),
        _smM('#92400e','#78350f',0.25,0.95,0.92)); dirtRing.rotation.x=-Math.PI/2; g.add(dirtRing);
    // rubble spray
    for(var i=0;i<14;i++){
        var a=(i/14)*Math.PI*2, r=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.06),
            _smM('#78350f','#92400e',0.1,0.95,0.9));
        r.position.set(Math.cos(a)*(0.45+Math.random()*0.2),0.02,Math.sin(a)*(0.45+Math.random()*0.2));
        r._vy=1.5+Math.random()*2; r._vx=Math.cos(a)*(0.8+Math.random()); r._vz=Math.sin(a)*(0.8+Math.random());
        r.name='rb_'+i; g.add(r);
    }
    g.position.copy(pos); g.position.y=UNIT_BASE_Y+0.008;
    g.scale.setScalar(0.05);
    _smSpawn(g, 2.5, function(m,dt,ratio) {
        var s=ratio>0.88?(1-ratio)/0.12:(ratio<0.08?ratio/0.08:1.0);
        g.scale.setScalar(Math.max(0.02,s));
        for(var i=0;i<14;i++){
            var rb=g.getObjectByName('rb_'+i);
            if(rb && m.time<0.6){
                rb.position.x+=rb._vx*dt; rb.position.y+=rb._vy*dt; rb.position.z+=rb._vz*dt;
                rb._vy-=10*dt;
            }
        }
    });
}

function _sm_armorWall(pos) {
    var g = new THREE.Group();
    var N=6;
    for(var i=0;i<N;i++){
        var a=(i/N)*Math.PI*2;
        var plate=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.44,0.038),
            _smM('#1e3a8a','#3b82f6',0.8,0.88,0.28,0.4));
        plate.position.set(Math.cos(a)*0.58, 0.44, Math.sin(a)*0.58);
        plate.rotation.y=-a; plate.name='pl_'+i; g.add(plate);
        var edge=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.46,0.015),_smB('#93c5fd',0.45));
        edge.position.copy(plate.position); edge.rotation.y=plate.rotation.y; g.add(edge);
        // bolt rivets
        for(var r=0;r<3;r++){
            var bolt=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,4),_smM('#60a5fa','#bfdbfe',1.2,0.88));
            bolt.position.set(plate.position.x, 0.2+r*0.18, plate.position.z);
            g.add(bolt);
        }
    }
    // top ring
    var topR=new THREE.Mesh(new THREE.TorusGeometry(0.58,0.035,8,36),
        _smM('#3b82f6','#60a5fa',1.0,0.85)); topR.rotation.x=-Math.PI/2; topR.position.y=0.66; g.add(topR);
    var aLight=new THREE.PointLight('#3b82f6',12.0,5.0); aLight.name='aLight'; g.add(aLight);
    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    _smSpawn(g, 4.5, function(m,dt,ratio) {
        var fade=ratio<0.1?ratio/0.1:1.0;
        g.rotation.y+=dt*0.3;
        aLight.intensity=(10+Math.sin(m.time*4)*2)*fade;
        for(var i=0;i<N;i++){
            var p2=g.getObjectByName('pl_'+i);
            if(p2) p2.material.emissiveIntensity=(0.8+Math.sin(m.time*2+i)*0.4)*fade;
        }
        if(ratio<0.1) { g.children.forEach(function(c2){if(c2.isMesh) c2.material.opacity*=ratio/0.1;}); }
    });
}

function _sm_tauntField(pos) {
    var g = new THREE.Group();
    // 3 pulsing concentric rings that SHRINK inward (magnetic pull)
    for(var i=0;i<3;i++){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(1.8+i*0.5,0.04+i*0.01,10,40),
            _smM('#ef4444','#dc2626',0.9+i*0.1,0.88,0.3));
        ring.rotation.x=-Math.PI/2; ring.name='tr_'+i; ring._startR=1.8+i*0.5; g.add(ring);
    }
    // central pulsing sphere
    var core=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,10),
        _smM('#ef4444','#fbbf24',1.6,0.9,0.2)); core.position.y=0.55; core.name='core'; g.add(core);
    var tLight=new THREE.PointLight('#ef4444',14.0,6.0); tLight.name='tLight'; g.add(tLight);
    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    _smSpawn(g, 3.0, function(m,dt,ratio) {
        var fade=ratio<0.12?ratio/0.12:1.0;
        for(var i=0;i<3;i++){
            var tr=g.getObjectByName('tr_'+i);
            if(tr){
                var contractP=(1-ratio);
                var curR=tr._startR*(1-contractP*0.7);
                tr.scale.setScalar(curR/tr._startR);
                tr.material.opacity=(0.7+Math.sin(m.time*5+i)*0.2)*fade;
            }
        }
        var c2=g.getObjectByName('core');
        if(c2){ var ps=1+Math.sin(m.time*8)*0.2; c2.scale.setScalar(ps*fade); }
        tLight.intensity=14*fade*(0.8+Math.sin(m.time*6)*0.2);
    });
}

// ============================================================
//  YUJIN — FUOCO, GHIACCIO, FULMINI
// ============================================================

function _sm_divineWings(pos) {
    var g = new THREE.Group();
    var wingMat = new THREE.MeshStandardMaterial({
        color:'#fef9c3', emissive:'#fbbf24', emissiveIntensity:1.2,
        transparent:true, opacity:0.72, side:THREE.DoubleSide,
        roughness:0.15, metalness:0.05, depthWrite:false
    });
    function _wing(side) {
        var wg = new THREE.Group();
        // 7 feathers per wing
        for(var f=0;f<7;f++){
            var frac=f/6;
            var feat=new THREE.Mesh(
                new THREE.ConeGeometry(0.07+frac*0.045, 0.42+frac*0.32, 4),
                wingMat
            );
            feat.rotation.z = side*(Math.PI/2 + frac*0.55);
            feat.position.set(side*(0.14+frac*0.28), 0.22-frac*0.1, frac*0.04);
            feat.name='f_'+f;
            wg.add(feat);
        }
        // primary bone
        var bone=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.016,0.65,5),
            _smM('#fbbf24','#fef9c3',1.8,0.9,0.1,0.7));
        bone.rotation.z=side*(Math.PI/2-0.25);
        bone.position.set(side*0.28, 0.14, 0);
        wg.add(bone);
        return wg;
    }
    var lw=_wing(-1); lw.name='lw'; g.add(lw);
    var rw=_wing(1);  rw.name='rw'; g.add(rw);
    // halo
    var halo=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.028,10,32),
        _smM('#ffffff','#fef9c3',2.0,0.88,0.1,0.1));
    halo.rotation.x=Math.PI/2-0.3; halo.position.y=0.95; halo.name='halo'; g.add(halo);
    // divine light
    var dLight=new THREE.PointLight('#fef9c3',20.0,7.0); dLight.position.y=0.6; g.add(dLight);
    var wLight=new THREE.PointLight('#fbbf24',12.0,9.0); g.add(wLight);

    g.position.copy(pos); g.position.y+=0.18;
    g.scale.setScalar(0.02);

    _smSpawn(g, 1.4, function(m,dt,ratio) {
        var s=ratio>0.78?(1-ratio)/0.22:(ratio<0.12?ratio/0.12:1.0);
        g.scale.setScalar(Math.max(0.01,s));
        var flap=Math.sin(m.time*6)*0.25*s;
        var lw2=g.getObjectByName('lw'); if(lw2) lw2.rotation.z=-flap;
        var rw2=g.getObjectByName('rw'); if(rw2) rw2.rotation.z=flap;
        var hl=g.getObjectByName('halo'); if(hl) hl.rotation.z+=dt*3.5;
        dLight.intensity=20*s; wLight.intensity=12*s;
        g.position.y=pos.y+0.18+Math.sin(m.time*3.5)*0.06;
    });
}

function _sm_iceHexShield(pos) {
    var g = new THREE.Group();
    var iceMat = new THREE.MeshStandardMaterial({
        color:'#dbeafe', emissive:'#93c5fd', emissiveIntensity:0.7,
        transparent:true, opacity:0.58, roughness:0.04,
        side:THREE.DoubleSide, depthWrite:false
    });
    // 6 hex panels
    for(var i=0;i<6;i++){
        var a=(i/6)*Math.PI*2;
        var panel=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.52,0.03),iceMat);
        panel.position.set(Math.cos(a)*0.58, 0.46, Math.sin(a)*0.58);
        panel.rotation.y=-a; panel.name='p_'+i;
        // inner crystal face
        var cf=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.38,0.012),
            _smB('#bfdbfe',0.38));
        cf.position.z=0.016; panel.add(cf); g.add(panel);
        // edge spike
        var sp=new THREE.Mesh(new THREE.ConeGeometry(0.022,0.14,5),
            _smM('#60a5fa','#93c5fd',1.4,0.85,0.1));
        sp.position.set(Math.cos(a)*0.58, 0.78, Math.sin(a)*0.58);
        g.add(sp);
    }
    // rings
    [0.14, 0.76].forEach(function(y2){
        var r2=new THREE.Mesh(new THREE.TorusGeometry(0.58,0.028,8,6),
            _smM('#60a5fa','#93c5fd',1.2,0.85,0.2));
        r2.rotation.x=-Math.PI/2; r2.position.y=y2; g.add(r2);
    });
    var iLight=new THREE.PointLight('#93c5fd',14.0,5.0); iLight.position.y=0.46; g.add(iLight);

    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    g.scale.setScalar(0.04);

    _smSpawn(g, 3.5, function(m,dt,ratio) {
        var s=ratio>0.88?(1-ratio)/0.12:(ratio<0.08?ratio/0.08:1.0);
        g.scale.setScalar(Math.max(0.02,s));
        g.rotation.y+=dt*0.25;
        iceMat.opacity=(0.5+Math.sin(m.time*5)*0.1)*s;
        iLight.intensity=14*s;
        // sparkle shimmer
        for(var i=0;i<6;i++){
            var p2=g.getObjectByName('p_'+i);
            if(p2) p2.material.emissiveIntensity=(0.6+Math.sin(m.time*6+i)*0.4)*s;
        }
    });
}

function _sm_ragnarokInferno(pos) {
    var fp = pos.clone(); fp.y = UNIT_BASE_Y;
    // big flame
    _smFlame(fp, 0.72, 2.0, ['#ef4444','#f97316','#fbbf24','#fef08a'], 4.5);
    // outer ring wave
    _smWaveRing(fp, '#ef4444', 0.18, 2.5, 0.7);
    _smWaveRing(fp, '#f97316', 0.18, 1.8, 0.5);
}

function _sm_frenzyStrikes(from, to) {
    // 3 lightning bolts with increasing angle spread
    var spread = [0, 0.18, -0.18];
    for (var i = 0; i < 3; i++) {
        (function(offset, delay) {
            var toOffset = to.clone();
            toOffset.x += offset;
            var g = new THREE.Group();
            var bolt = _smLightning(
                new THREE.Vector3(from.x, from.y+1.0, from.z),
                new THREE.Vector3(toOffset.x, toOffset.y+0.2, toOffset.z),
                '#fbbf24', 0.45, 0.016
            );
            bolt.name = 'bolt';
            g.add(bolt);
            var bL = new THREE.PointLight('#fbbf24', 14.0, 4.0);
            bL.position.copy(toOffset); bL.position.y += 0.2;
            bL.name = 'bL'; g.add(bL);
            setTimeout(function() {
                _smSpawn(g, 0.22, function(m2, dt2, r2) {
                    bolt.visible = Math.sin(m2.time * 70) > -0.3;
                    bL.intensity = 14 * r2 * (0.7 + Math.random() * 0.6);
                    // re-roll bolt shape
                    if (Math.floor(m2.time * 30) !== Math.floor((m2.time - dt2) * 30)) {
                        g.remove(bolt);
                        bolt.traverse(function(c){if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});
                        bolt = _smLightning(
                            new THREE.Vector3(from.x, from.y+1.0, from.z),
                            new THREE.Vector3(toOffset.x, toOffset.y+0.2, toOffset.z),
                            '#fbbf24', 0.45, 0.016
                        );
                        bolt.name = 'bolt';
                        g.add(bolt);
                    }
                });
            }, delay);
        })(spread[i], i * 90);
    }
}

function _sm_berserkDash(from, to) {
    var g = new THREE.Group();
    var dir = to.clone().sub(from); var dist = dir.length(); dir.normalize();
    var mid = from.clone().lerp(to, 0.5);
    // slash arc
    var slash = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.05, 0.28),
        _smB('#ef4444', 0.62));
    slash.name = 'slash';
    g.add(slash);
    var gSlash = new THREE.Mesh(new THREE.BoxGeometry(dist, 0.018, 0.09),
        _smB('#fbbf24', 0.8));
    g.add(gSlash);
    g.position.copy(mid); g.position.y += 0.4;
    g.lookAt(new THREE.Vector3(to.x, g.position.y, to.z));
    var sLight = new THREE.PointLight('#ef4444', 14.0, 5.0); sLight.name='sLight'; g.add(sLight);
    _smSpawn(g, 0.42, function(m,dt,ratio) {
        slash.material.opacity = ratio*0.62;
        gSlash.material.opacity = ratio*0.8;
        sLight.intensity = 14*ratio;
    });
}

function _sm_executionSlam(pos) {
    var g = new THREE.Group();
    // Impact X shape — two crossed slashes
    for(var i=0;i<2;i++){
        var slash=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.04,0.2),
            _smB(i===0?'#ef4444':'#fbbf24', 0.75));
        slash.rotation.y = i * Math.PI/4;
        slash.position.y = 0.1;
        g.add(slash);
    }
    // shockwave ring
    var ring=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.06,10,32),
        _smM('#ef4444','#fbbf24',1.5,0.88)); ring.rotation.x=-Math.PI/2; ring.name='ring'; g.add(ring);
    var eLight=new THREE.PointLight('#ef4444',20.0,6.0); g.add(eLight);
    g.position.copy(pos); g.position.y=UNIT_BASE_Y+0.05;
    _smSpawn(g, 0.55, function(m,dt,ratio) {
        var p=1-ratio; var r=g.getObjectByName('ring');
        if(r){ r.scale.setScalar(1+p*18); r.material.opacity=0.88*ratio; }
        eLight.intensity=20*ratio;
        g.children.forEach(function(c2){if(c2.isMesh&&c2.name!=='ring') c2.material.opacity=(c2.material.opacity||0.75)*0.92;});
    });
}

// ============================================================
//  WMS — SINGOLARITÀ, ONDE COSMICHE
// ============================================================

function _sm_singularity(pos) {
    var g = new THREE.Group();
    // event horizon orb
    var orb=new THREE.Mesh(new THREE.SphereGeometry(0.34,20,14),
        new THREE.MeshStandardMaterial({
            color:'#0a0618', emissive:'#7c3aed', emissiveIntensity:0.65,
            roughness:0.06, metalness:0.5, transparent:true, opacity:0.97
        }));
    orb.name='orb'; g.add(orb);
    // bright plasma core
    var core=new THREE.Mesh(new THREE.SphereGeometry(0.12,12,10),
        _smM('#c084fc','#e9d5ff',2.5,0.92,0.1)); g.add(core);
    // 3 orbital rings on different axes
    var ringAxes=[[0,0,0],[Math.PI/3,0,0],[Math.PI*2/3,0,0]];
    for(var i=0;i<3;i++){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(0.6+i*0.14,0.032,10,40),
            _smM('#7c3aed','#a78bfa',1.0+i*0.15,0.82,0.2));
        ring.rotation.x=ringAxes[i][0]; ring.rotation.z=ringAxes[i][0]*0.6;
        ring.name='ring_'+i; g.add(ring);
    }
    // outer accretion disc
    var disc=new THREE.Mesh(new THREE.TorusGeometry(1.1,0.06,8,48),
        _smM('#4c1d95','#7c3aed',0.9,0.7,0.3)); disc.rotation.x=-Math.PI/2; disc.name='disc'; g.add(disc);
    // ground shadow
    var shadow=new THREE.Mesh(new THREE.CircleGeometry(0.55,32),_smB('#1e1b4b',0.55));
    shadow.rotation.x=-Math.PI/2; shadow.position.y=-0.68; g.add(shadow);
    var sLight=new THREE.PointLight('#7c3aed',20.0,8.0); g.add(sLight);
    var sLight2=new THREE.PointLight('#c084fc',10.0,12.0); g.add(sLight2);

    g.position.copy(pos); g.position.y+=0.78;
    g.scale.setScalar(0.08);

    _smSpawn(g, 2.0, function(m,dt,ratio) {
        var p=1-ratio;
        var s; if(p<0.28) s=p/0.28; else if(p<0.62) s=1.0; else s=Math.max(0.01,1-(p-0.62)/0.38);
        g.scale.setScalar(s);
        for(var i=0;i<3;i++){
            var r2=g.getObjectByName('ring_'+i);
            if(r2){ r2.rotation.y+=dt*(1.8+i*1.0); r2.rotation.x+=dt*(0.6+i*0.35)*(i%2?1:-1); }
        }
        core.scale.setScalar(1+Math.sin(m.time*10)*0.35);
        orb.material.emissiveIntensity=0.65+Math.sin(m.time*7)*0.35;
        var d2=g.getObjectByName('disc'); if(d2){ d2.rotation.z+=dt*1.5; d2.material.opacity=0.7*s; }
        sLight.intensity=20*s; sLight2.intensity=10*s;
        orb.scale.set(1+Math.sin(m.time*4)*0.05,1+Math.sin(m.time*5)*0.05,1+Math.sin(m.time*3)*0.05);
    });
}

function _sm_divineBeam(pos) {
    var g = new THREE.Group();
    // vertical light column
    var beam=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.18,5.5,14,1,true),
        _smB('#e0f2fe',0.22));
    beam.position.y=2.75; beam.name='beam'; g.add(beam);
    var core=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.06,5.5,8,1,true),
        _smB('#ffffff',0.6));
    core.position.y=2.75; core.name='core'; g.add(core);
    // base rings
    [0.45, 0.85, 1.3].forEach(function(r2,i2){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(r2,0.038,10,36),
            _smM('#7dd3fc','#38bdf8',1.2-i2*0.2,0.88,0.2));
        ring.rotation.x=-Math.PI/2; ring.position.y=0.06; ring.name='ring_'+i2; g.add(ring);
    });
    // halo at top
    var top=new THREE.Mesh(new THREE.TorusGeometry(0.38,0.04,10,28),
        _smM('#ffffff','#e0f2fe',1.8,0.88)); top.rotation.x=-Math.PI/2; top.position.y=5.1; g.add(top);
    var bLight=new THREE.PointLight('#7dd3fc',20.0,8.0); bLight.position.y=1.2; bLight.name='bLight'; g.add(bLight);
    var tLight=new THREE.PointLight('#ffffff',12.0,6.0); tLight.position.y=4.5; g.add(tLight);

    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    g.scale.setScalar(0.04);

    _smSpawn(g, 2.5, function(m,dt,ratio) {
        var s=ratio>0.88?(1-ratio)/0.12:(ratio<0.05?ratio/0.05:1.0);
        g.scale.setScalar(Math.max(0.02,s));
        var be=g.getObjectByName('beam'); if(be) be.material.opacity=(0.18+Math.sin(m.time*8)*0.06)*s;
        var co=g.getObjectByName('core'); if(co) co.material.opacity=(0.55+Math.sin(m.time*11)*0.15)*s;
        for(var i=0;i<3;i++){
            var r2=g.getObjectByName('ring_'+i);
            if(r2){ r2.rotation.z+=dt*(0.8+i*0.5)*(i%2?1:-1); r2.material.opacity=(0.88-i*0.1)*s; }
        }
        bLight.intensity=(16+Math.sin(m.time*9)*4)*s;
        tLight.intensity=(12+Math.sin(m.time*7)*3)*s;
        g.rotation.y+=dt*0.4;
    });
}

function _sm_voidPurge(pos) {
    var g = new THREE.Group();
    // void sphere — expands then implodes
    var orb=new THREE.Mesh(new THREE.SphereGeometry(0.32,18,12),
        new THREE.MeshStandardMaterial({
            color:'#0f0818', emissive:'#6d28d9', emissiveIntensity:0.55,
            roughness:0.04, transparent:true, opacity:0.94
        }));
    orb.name='orb'; g.add(orb);
    // 2 spinning rings
    for(var i=0;i<2;i++){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(0.44+i*0.12,0.025,8,32),
            _smB('#6d28d9',0.55));
        ring.rotation.x=i*Math.PI/4; ring.name='r_'+i; g.add(ring);
    }
    // vacuum pull lines (8 thin beams shooting from orb outward then sucking back)
    for(var i=0;i<8;i++){
        var a=(i/8)*Math.PI*2;
        var beam=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.003,0.6,3),
            _smB('#4c1d95',0.65));
        beam.position.set(Math.cos(a)*0.45, 0.1, Math.sin(a)*0.45);
        beam.rotation.z=-a+Math.PI/2; beam.rotation.y=a;
        beam.name='beam_'+i; g.add(beam);
    }
    var vLight=new THREE.PointLight('#6d28d9',18.0,5.0); vLight.name='vLight'; g.add(vLight);

    g.position.copy(pos); g.position.y+=0.55;
    g.scale.setScalar(0.08);

    _smSpawn(g, 1.0, function(m,dt,ratio) {
        var p=1-ratio;
        // grow 0-0.3, hold 0.3-0.6, collapse 0.6-1.0
        var s; if(p<0.3) s=p/0.3; else if(p<0.6) s=1.0; else s=Math.max(0.01,1-(p-0.6)/0.4);
        g.scale.setScalar(s);
        for(var i=0;i<2;i++){
            var r2=g.getObjectByName('r_'+i);
            if(r2) r2.rotation.y+=dt*(3+i*2)*(i%2?1:-1);
        }
        // beams pulse in/out
        for(var i=0;i<8;i++){
            var b=g.getObjectByName('beam_'+i);
            if(b){ b.scale.x=1+Math.sin(m.time*8+i)*0.4; b.material.opacity=0.65*ratio*s; }
        }
        orb.material.emissiveIntensity=0.55+Math.sin(m.time*10)*0.4;
        vLight.intensity=18*s;
    });
}

function _sm_gravityPull(pos) {
    var g = new THREE.Group();
    // 5 rings on different tilted planes, all visible
    var data=[[0.7,0],[0.95,Math.PI/5],[1.2,Math.PI*2/5],[1.45,Math.PI*3/5],[1.7,Math.PI*4/5]];
    for(var i=0;i<5;i++){
        var ring=new THREE.Mesh(new THREE.TorusGeometry(data[i][0],0.03,10,40),
            _smM('#8b5cf6','#c084fc',0.85+i*0.08,0.82,0.25));
        ring.rotation.x=data[i][1]; ring.rotation.z=data[i][1]*0.7;
        ring.name='gr_'+i; g.add(ring);
    }
    // central graviton
    var grav=new THREE.Mesh(new THREE.SphereGeometry(0.14,12,10),
        _smM('#a78bfa','#c084fc',2.0,0.92,0.1));
    grav.name='grav'; g.add(grav);
    var gLight=new THREE.PointLight('#8b5cf6',16.0,7.0); g.add(gLight);

    g.position.copy(pos); g.position.y+=0.65;
    g.scale.setScalar(0.08);

    _smSpawn(g, 1.2, function(m,dt,ratio) {
        var s=ratio>0.82?(1-ratio)/0.18:(ratio<0.1?ratio/0.1:1.0);
        g.scale.setScalar(Math.max(0.02,s));
        for(var i=0;i<5;i++){
            var r2=g.getObjectByName('gr_'+i);
            if(r2){ r2.rotation.y+=dt*(1.5+i*0.7)*(i%2?1:-1); r2.rotation.x+=dt*0.5*(i%2?1:-1); }
        }
        var gv=g.getObjectByName('grav'); if(gv) gv.scale.setScalar(1+Math.sin(m.time*10)*0.28);
        gLight.intensity=16*s;
    });
}

function _sm_cosmicWave(pos) {
    // 5 rings expanding outward in a staggered sequence — HUGE scale
    var colors=['#8b5cf6','#7c3aed','#6d28d9','#a78bfa','#c084fc'];
    var radii =[3.5, 3.0, 2.5, 1.8, 1.1];
    var delays=[0.0, 0.06, 0.12, 0.20, 0.30];
    for(var i=0;i<5;i++){
        (function(d,c,er){
            setTimeout(function(){
                _smWaveRing(pos, c, 0.18, er, 0.7+(i*0.05));
            }, d*1000);
        })(delays[i], colors[i], radii[i]);
    }
    // vertical component
    var g=new THREE.Group();
    var arc=new THREE.Mesh(new THREE.TorusGeometry(0.15,0.055,10,32),
        _smM('#a78bfa','#c084fc',1.4,0.88));
    arc.position.y=0.7; arc.name='arc'; g.add(arc);
    var aLight=new THREE.PointLight('#7c3aed',16.0,6.0); g.add(aLight);
    g.position.copy(pos); g.position.y=UNIT_BASE_Y;
    _smSpawn(g, 1.0, function(m,dt,ratio) {
        var p=1-ratio; var ar=g.getObjectByName('arc');
        if(ar){ ar.scale.setScalar(1+p*20); ar.material.opacity=0.88*ratio; ar.position.y=0.7+p*0.8; }
        aLight.intensity=16*ratio;
    });
}

function _sm_splitEcho(pos) {
    var g = new THREE.Group();
    // two ghost orbs that split apart
    for(var s=0;s<2;s++){
        var ghost=new THREE.Mesh(new THREE.SphereGeometry(0.22,14,10),
            new THREE.MeshStandardMaterial({
                color:'#a78bfa', emissive:'#7c3aed', emissiveIntensity:0.9,
                transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false
            }));
        ghost.position.set((s===0?-1:1)*0.1, 0.55, 0);
        ghost._side = (s===0?-1:1);
        ghost.name='ghost_'+s; g.add(ghost);
        var gL=new THREE.PointLight('#a78bfa',8.0,3.5);
        gL.position.copy(ghost.position); gL.name='gL_'+s; g.add(gL);
    }
    g.position.copy(pos);
    _smSpawn(g, 0.8, function(m,dt,ratio) {
        var p=1-ratio;
        for(var s=0;s<2;s++){
            var gh=g.getObjectByName('ghost_'+s);
            var gl2=g.getObjectByName('gL_'+s);
            if(gh){ gh.position.x=gh._side*(0.1+p*0.65); gh.material.opacity=0.55*ratio;
                gh.scale.setScalar(1+p*0.3); }
            if(gl2){ gl2.position.x=gh?gh.position.x:0; gl2.intensity=8*ratio; }
        }
    });
}

// ============================================================
//  RENDER LOOP HOOK
// ============================================================
var _origUpdateVFXforModels = (typeof updateVFX === 'function') ? updateVFX : null;
updateVFX = function(dt) {
    if (_origUpdateVFXforModels) _origUpdateVFXforModels(dt);
    if (typeof threeScene !== 'undefined' && threeScene) updateSkillModels3D(dt);
};
