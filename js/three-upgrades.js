// ============================================================
// LOTA AUTO CHESS — three-upgrades.js — Star & Survival Upgrades
// MASSIVE visual evolution per star level
// ============================================================

// Much more dramatic scaling
var STAR_SCALE    = [1.0, 1.0, 1.18, 1.4, 1.65, 1.9];
var STAR_EMISSIVE = [0, 0, 0.12, 0.28, 0.45, 0.7];
var STAR_METAL    = [0, 0, 0.08, 0.18, 0.3, 0.45];

// ── Electric arc helper (lightweight THREE.Line) ──
function _createArc(color, numPts, name) {
    var geo = new THREE.BufferGeometry();
    var pts = new Float32Array(numPts * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.7, depthWrite: false
    }));
    line.name = name;
    line.frustumCulled = false;
    return line;
}

// ── Jitter arc between two points (electric snap) ──
function _jitterArc(arc, ax,ay,az, bx,by,bz, jitter) {
    if (!arc || !arc.geometry) return;
    var pos = arc.geometry.attributes.position;
    var n = pos.count;
    for (var i = 0; i < n; i++) {
        var f = i / (n - 1);
        var j = jitter * Math.sin(f * Math.PI);
        pos.setXYZ(i,
            ax + (bx - ax) * f + (Math.random() - 0.5) * j,
            ay + (by - ay) * f + (Math.random() - 0.5) * j,
            az + (bz - az) * f + (Math.random() - 0.5) * j
        );
    }
    pos.needsUpdate = true;
}

// ── Personality spark cloud (small points) ──
function _createSparks(color, count, spread, yBase, name) {
    var geo = new THREE.BufferGeometry();
    var pts = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
        pts[i*3]   = (Math.random()-0.5) * spread;
        pts[i*3+1] = yBase + Math.random() * spread * 0.7;
        pts[i*3+2] = (Math.random()-0.5) * spread;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    var mat = new THREE.PointsMaterial({
        color: color, size: 0.025, transparent: true, opacity: 0.6, depthWrite: false
    });
    var p = new THREE.Points(geo, mat);
    p.name = name;
    return p;
}

// ====================================================================
//  MAIN ENTRY
// ====================================================================
function applyStarUpgrade(group, charId, star, unit) {
    if (!star || star < 2) return;
    var s = Math.min(star, 5);

    // Global scale
    group.scale.multiplyScalar(STAR_SCALE[s]);

    // Global material boost
    var emB = STAR_EMISSIVE[s];
    var meB = STAR_METAL[s];
    group.traverse(function(ch) {
        if (ch.isMesh && ch.material && !ch.name.startsWith('team') && !ch.name.startsWith('banner') && ch.name !== 'hpBar') {
            if (ch.material.metalness !== undefined) ch.material.metalness = Math.min(1, ch.material.metalness + meB);
            if (ch.material.emissiveIntensity !== undefined) ch.material.emissiveIntensity += emB;
        }
    });

    // Character upgrades
    switch (charId) {
        case 'Babidi':  _upgradeBabidi(group, s);  break;
        case 'Caronte': _upgradeCaronte(group, s);  break;
        case 'Valerio': _upgradeValerio(group, s);  break;
        case 'Yujin':   _upgradeYujin(group, s);    break;
        case 'WMS':     _upgradeWMS(group, s);      break;
    }

    // Star aura (3+)
    if (s >= 3) _addStarAura(group, s, charId);
    // Legendary crown (5)
    if (s >= 5) _addLegendaryCrown(group, charId);

    // Electric & personality enhancements
    _applyEnhancements(group, charId, s);
}

// ====================================================================
//  SURVIVAL COSMETICS
// ====================================================================
function applySurvivalUpgrade(group, charId, survivalCount) {
    if (!survivalCount || survivalCount <= 0) return;
    var n = Math.min(survivalCount, 6);
    for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var m = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 4, 4),
            _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 0.5, rough: 0.2, metal: 0.6 })
        );
        m.position.set(Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38);
        m.name = 'survMark_' + i;
        group.add(m);
    }
    var medals = Math.floor(survivalCount / 3);
    for (var mi = 0; mi < Math.min(medals, 3); mi++) {
        var medal = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.05, 0),
            _mat(mi === 0 ? '#fbbf24' : (mi === 1 ? '#c0c0c0' : '#cd7f32'), { emissive: '#fbbf24', emissiveI: 0.3, rough: 0.2, metal: 0.7 })
        );
        medal.position.set(-0.15 + mi * 0.12, 0.42, 0.32);
        medal.rotation.y = Math.PI / 4;
        medal.name = 'medal_' + mi;
        group.add(medal);
    }
}

// ====================================================================
//  STAR AURA (3+) — ground rings + floating runes
// ====================================================================
function _addStarAura(group, star, charId) {
    var col = CHAR_COLORS[charId] ? CHAR_COLORS[charId].fill : '#fbbf24';
    var r = 0.5 + (star - 3) * 0.12;

    // inner ring
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.025, 8, 28),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.name = 'starAura';
    group.add(ring);

    if (star >= 4) {
        // outer ring
        var ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(r + 0.15, 0.018, 8, 28),
            new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.2, depthWrite: false })
        );
        ring2.rotation.x = -Math.PI / 2;
        ring2.position.y = 0.04;
        ring2.name = 'starAura2';
        group.add(ring2);

        // floating runes
        for (var i = 0; i < star; i++) {
            var rune = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.035, 0),
                new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false })
            );
            rune.position.y = 0.5;
            rune.name = 'starRune_' + i;
            group.add(rune);
        }
    }
}

// ====================================================================
//  LEGENDARY CROWN (5) — golden halo + crown + light
// ====================================================================
function _addLegendaryCrown(group, charId) {
    var h = { Babidi: 1.2, Caronte: 1.35, Valerio: 1.0, Yujin: 1.3, WMS: 1.1 }[charId] || 1.1;

    var halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.025, 8, 28),
        _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 1.0, rough: 0.1, metal: 0.9 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = h;
    halo.name = 'legendHalo';
    group.add(halo);

    for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2;
        var pt = new THREE.Mesh(
            new THREE.ConeGeometry(0.025, 0.1, 4),
            _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 0.8, rough: 0.15, metal: 0.8 })
        );
        pt.position.set(Math.cos(a) * 0.22, h + 0.05, Math.sin(a) * 0.22);
        pt.name = 'crownPoint_' + i;
        group.add(pt);
    }

    var light = new THREE.PointLight('#fbbf24', 1.2, 4);
    light.position.set(0, h, 0);
    light.name = 'legendLight';
    group.add(light);

    // legend sparks
    var sg = new THREE.BufferGeometry();
    var sp = new Float32Array(30 * 3);
    for (var i = 0; i < 30; i++) {
        sp[i*3]   = (Math.random()-0.5) * 1.2;
        sp[i*3+1] = Math.random() * 1.4;
        sp[i*3+2] = (Math.random()-0.5) * 1.2;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    var sm = new THREE.PointsMaterial({ color: '#fbbf24', size: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
    var sparks = new THREE.Points(sg, sm);
    sparks.name = 'legendSparks';
    group.add(sparks);

    // body glow
    var glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 12, 10),
        new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
    );
    glow.position.y = 0.5;
    glow.name = 'legendGlow';
    group.add(glow);
}

// ====================================================================
//  BABIDI — Merchant Prince evolution
// ====================================================================
function _upgradeBabidi(group, star) {
    var C = CHAR_COLORS.Babidi;

    if (star >= 2) {
        // Gold necklace chain
        var necklace = new THREE.Mesh(
            new THREE.TorusGeometry(0.25, 0.018, 6, 16),
            _mat('#fbbf24', { rough: 0.25, metal: 0.6, emissive: '#fbbf24', emissiveI: 0.2 })
        );
        necklace.rotation.x = Math.PI / 6;
        necklace.position.set(0, 0.6, 0.05);
        group.add(necklace);

        // Second turban gem (green emerald)
        var gem2 = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.035, 0),
            _mat('#22c55e', { emissive: '#22c55e', emissiveI: 0.6, rough: 0.15, metal: 0.5 })
        );
        gem2.position.set(-0.14, 0.88, 0.12);
        group.add(gem2);

        // Gold arm bands
        for (var side = 0; side < 2; side++) {
            var band = new THREE.Mesh(
                new THREE.TorusGeometry(0.075, 0.012, 6, 12),
                _mat('#fbbf24', { rough: 0.2, metal: 0.65 })
            );
            band.position.set(side === 0 ? -0.42 : 0.42, 0.35, 0);
            band.rotation.y = Math.PI / 2;
            group.add(band);
        }
    }

    if (star >= 3) {
        // MASSIVE turban upgrade — extra layer
        var turban2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            _mat('#d4a43a', { rough: 0.4, metal: 0.35, emissive: '#fbbf24', emissiveI: 0.15 })
        );
        turban2.position.y = 0.87;
        turban2.scale.set(1.15, 0.85, 1.05);
        group.add(turban2);

        // Third gem (blue sapphire)
        var gem3 = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.03, 0),
            _mat('#3b82f6', { emissive: '#3b82f6', emissiveI: 0.5, rough: 0.15 })
        );
        gem3.position.set(0.14, 0.88, 0.12);
        group.add(gem3);

        // Poison flask in left hand
        var flask = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6),
            _mat('#22c55e', { emissive: '#22c55e', emissiveI: 0.3, rough: 0.3 })
        );
        flask.position.set(-0.5, 0.32, 0.12);
        flask.name = 'flask';
        group.add(flask);
        // flask stopper
        var stopper = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 6, 6),
            _mat('#8b6b4a', { rough: 0.7 })
        );
        stopper.position.set(-0.5, 0.38, 0.12);
        group.add(stopper);

        // Gold belly chain
        var bellyChain = new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.01, 4, 20),
            _mat('#fbbf24', { rough: 0.2, metal: 0.7, emissive: '#fbbf24', emissiveI: 0.15 })
        );
        bellyChain.rotation.x = -Math.PI / 2;
        bellyChain.position.y = 0.3;
        group.add(bellyChain);

        // Extra coins (5 total)
        for (var c = 3; c < 6; c++) {
            var coin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.04, 0.01, 8),
                _mat('#fbbf24', { rough: 0.2, metal: 0.7, emissive: '#fbbf24', emissiveI: 0.3 })
            );
            coin.name = 'coin_' + c;
            coin.position.set(0, 0.5, 0);
            group.add(coin);
        }

        // Poison aura
        var poisonAura = new THREE.Mesh(
            new THREE.SphereGeometry(0.6, 10, 8),
            new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })
        );
        poisonAura.position.y = 0.4;
        poisonAura.name = 'poisonAura';
        group.add(poisonAura);
    }

    if (star >= 4) {
        // ROYAL GOLD ROBE — full golden trim overlay
        var robeOverlay = new THREE.Mesh(
            new THREE.CylinderGeometry(0.44, 0.48, 0.27, 12),
            _mat('#d4a43a', { rough: 0.35, metal: 0.5, emissive: '#fbbf24', emissiveI: 0.2, opacity: 0.6 })
        );
        robeOverlay.position.y = 0.12;
        robeOverlay.material.transparent = true;
        group.add(robeOverlay);

        // Golden shoulder pads
        for (var sp = 0; sp < 2; sp++) {
            var pad = new THREE.Mesh(
                new THREE.SphereGeometry(0.09, 8, 6),
                _mat('#fbbf24', { rough: 0.2, metal: 0.65, emissive: '#fbbf24', emissiveI: 0.25 })
            );
            pad.position.set(sp === 0 ? -0.46 : 0.46, 0.55, 0);
            pad.scale.set(1, 0.6, 0.8);
            group.add(pad);
        }

        // Money bag on back
        var bag = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            _mat('#8b6b4a', { rough: 0.8 })
        );
        bag.position.set(0, 0.35, -0.35);
        group.add(bag);
        // bag tie
        var tie = new THREE.Mesh(
            new THREE.CylinderGeometry(0.005, 0.005, 0.08, 4),
            _mat('#d4a43a', { rough: 0.4 })
        );
        tie.position.set(0, 0.45, -0.35);
        group.add(tie);

        // Multi-gem turban crown
        var crownBase = new THREE.Mesh(
            new THREE.TorusGeometry(0.22, 0.02, 6, 16),
            _mat('#fbbf24', { rough: 0.15, metal: 0.8, emissive: '#fbbf24', emissiveI: 0.35 })
        );
        crownBase.rotation.x = -Math.PI / 2;
        crownBase.position.y = 0.86;
        group.add(crownBase);

        // Body golden stripes
        for (var gs = 0; gs < 4; gs++) {
            var stripe = new THREE.Mesh(
                new THREE.TorusGeometry(0.42 - gs * 0.04, 0.01, 4, 16),
                _mat('#fbbf24', { rough: 0.25, metal: 0.6, emissive: '#fbbf24', emissiveI: 0.2 })
            );
            stripe.rotation.x = -Math.PI / 2;
            stripe.position.y = 0.2 + gs * 0.12;
            group.add(stripe);
        }
    }

    if (star >= 5) {
        // SULTAN MODE — tint body gold
        var body = group.getObjectByName('body');
        if (body && body.material) {
            body.material.color.lerp(new THREE.Color('#fbbf24'), 0.3);
            body.material.emissive = new THREE.Color('#a78bfa');
            body.material.emissiveIntensity = 0.4;
        }

        // Floating treasure chest
        var chest = new THREE.Group();
        chest.name = 'chest';
        var chestBody = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.1, 0.1),
            _mat('#8b6b4a', { rough: 0.6, metal: 0.2 })
        );
        chest.add(chestBody);
        var chestLid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8, 1, false, 0, Math.PI),
            _mat('#a67220', { rough: 0.5, metal: 0.3 })
        );
        chestLid.position.y = 0.05;
        chestLid.rotation.z = Math.PI / 2;
        chest.add(chestLid);
        var chestGold = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 4, 4),
            _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 0.6 })
        );
        chestGold.position.y = 0.06;
        chest.add(chestGold);
        chest.position.set(0.55, 0.6, 0.15);
        group.add(chest);
    }
}

// ====================================================================
//  CARONTE — Archmage evolution
// ====================================================================
function _upgradeCaronte(group, star) {
    if (star >= 2) {
        // Stronger glasses — larger, brighter
        group.traverse(function(ch) {
            if (ch.geometry && ch.geometry.type === 'TorusGeometry' && ch.material && ch.material.color) {
                var hex = ch.material.color.getHex();
                if (hex === 0x60a5fa) ch.material.emissiveIntensity = 0.4;
            }
        });

        // Second floating book (right side)
        var book2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.16, 0.035),
            _mat('#334155', { emissive: '#c084fc', emissiveI: 0.2 })
        );
        book2.position.set(0.45, 0.6, 0.05);
        book2.rotation.y = -0.2;
        book2.name = 'book2';
        group.add(book2);

        // Extra arcane orb
        var rune = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.5, depthWrite: false })
        );
        rune.name = 'rune_2';
        group.add(rune);
    }

    if (star >= 3) {
        // STAFF — arcane walking staff in right hand
        var staffGroup = new THREE.Group();
        staffGroup.name = 'staff';
        var shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.012, 0.8, 6),
            _mat('#5c4033', { rough: 0.7 })
        );
        staffGroup.add(shaft);
        // staff orb on top
        var staffOrb = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 6),
            _mat('#c084fc', { emissive: '#c084fc', emissiveI: 0.7, rough: 0.15, metal: 0.4 })
        );
        staffOrb.position.y = 0.42;
        staffOrb.name = 'staffOrb';
        staffGroup.add(staffOrb);
        staffGroup.position.set(0.35, 0.35, 0.1);
        staffGroup.rotation.z = -0.15;
        group.add(staffGroup);

        // Floating scroll
        var scroll = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6),
            _mat('#d4a43a', { rough: 0.4, metal: 0.3, emissive: '#fbbf24', emissiveI: 0.15 })
        );
        scroll.position.set(-0.5, 0.75, 0.1);
        scroll.rotation.z = 0.3;
        scroll.name = 'scroll';
        group.add(scroll);

        // Robe shimmer bands
        for (var i = 0; i < 3; i++) {
            var shimmer = new THREE.Mesh(
                new THREE.TorusGeometry(0.3 + i * 0.03, 0.01, 4, 14),
                _mat('#60a5fa', { emissive: '#60a5fa', emissiveI: 0.25 })
            );
            shimmer.rotation.x = -Math.PI / 2;
            shimmer.position.y = 0.15 + i * 0.15;
            group.add(shimmer);
        }

        // Third + fourth rune orbs
        for (var ri = 3; ri < 5; ri++) {
            var r = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 6, 6),
                new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.5, depthWrite: false })
            );
            r.name = 'rune_' + ri;
            group.add(r);
        }
    }

    if (star >= 4) {
        // ARCANE WINGS (ethereal wing planes behind body)
        for (var w = 0; w < 2; w++) {
            var wing = new THREE.Mesh(
                new THREE.PlaneGeometry(0.4, 0.55),
                new THREE.MeshBasicMaterial({
                    color: '#60a5fa', transparent: true, opacity: 0.12,
                    side: THREE.DoubleSide, depthWrite: false
                })
            );
            wing.position.set(w === 0 ? -0.3 : 0.3, 0.65, -0.2);
            wing.rotation.y = w === 0 ? 0.5 : -0.5;
            wing.rotation.z = w === 0 ? 0.1 : -0.1;
            wing.name = 'wing_' + w;
            group.add(wing);
        }

        // Arcane aura sphere
        var arcAura = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 12, 8),
            new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })
        );
        arcAura.position.y = 0.55;
        arcAura.name = 'arcaneAura';
        group.add(arcAura);

        // Ornate golden cap trim
        var capTrim = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.015, 6, 16),
            _mat('#fbbf24', { rough: 0.15, metal: 0.7, emissive: '#fbbf24', emissiveI: 0.4 })
        );
        capTrim.rotation.x = -Math.PI / 2;
        capTrim.rotation.z = Math.PI / 4;
        capTrim.position.y = 1.01;
        group.add(capTrim);

        // Third book orbiting
        var book3 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.13, 0.03),
            _mat('#1e293b', { emissive: '#a855f7', emissiveI: 0.2 })
        );
        book3.position.set(0, 0.75, -0.4);
        book3.name = 'book3';
        group.add(book3);
    }

    if (star >= 5) {
        // ARCHMAGE — ethereal translucent body
        var bodyMesh = group.getObjectByName('body');
        if (bodyMesh && bodyMesh.material) {
            bodyMesh.material.transparent = true;
            bodyMesh.material.opacity = 0.65;
            bodyMesh.material.emissive = new THREE.Color('#c084fc');
            bodyMesh.material.emissiveIntensity = 0.45;
        }

        // Massive arcane circle at feet
        var circle = new THREE.Mesh(
            new THREE.RingGeometry(0.5, 0.7, 32),
            new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
        );
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = 0.02;
        circle.name = 'arcCircle';
        group.add(circle);

        // Cosmic particles
        var cg = new THREE.BufferGeometry();
        var cp = new Float32Array(35 * 3);
        for (var i = 0; i < 35; i++) {
            cp[i*3]   = (Math.random()-0.5) * 1.4;
            cp[i*3+1] = Math.random() * 1.4;
            cp[i*3+2] = (Math.random()-0.5) * 1.4;
        }
        cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
        var cm = new THREE.PointsMaterial({ color: '#c084fc', size: 0.04, transparent: true, opacity: 0.5, depthWrite: false });
        group.add(new THREE.Points(cg, cm));
    }
}

// ====================================================================
//  VALERIO — Fortress Worm evolution
// ====================================================================
function _upgradeValerio(group, star) {
    if (star >= 2) {
        // Extra spines (7 total)
        for (var sp = 5; sp < 8; sp++) {
            var spine = new THREE.Mesh(
                new THREE.ConeGeometry(0.035, 0.16, 4),
                _mat('#ea580c', { rough: 0.4 })
            );
            var a = (sp / 8) * Math.PI - Math.PI / 2;
            spine.position.set(Math.cos(a) * 0.25, 0.74, Math.sin(a) * 0.25);
            spine.name = 'spine_' + sp;
            group.add(spine);
        }

        // Thicker armor bands
        for (var s = 0; s < 4; s++) {
            var band = new THREE.Mesh(
                new THREE.TorusGeometry(0.37 - s * 0.015, 0.025, 6, 14),
                _mat('#b45309', { rough: 0.3, metal: 0.45 })
            );
            band.rotation.x = -Math.PI / 2;
            band.position.y = 0.12 + s * 0.18 * 0.85;
            group.add(band);
        }

        // Front face plate (on first segment)
        var facePlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.1, 0.04),
            _mat('#b45309', { rough: 0.35, metal: 0.4 })
        );
        facePlate.position.set(0, 0.5, 0.32);
        group.add(facePlate);
    }

    if (star >= 3) {
        // SHOULDER ARMOR PLATES (big, visible)
        for (var side = 0; side < 2; side++) {
            var plate = new THREE.Mesh(
                new THREE.BoxGeometry(0.1, 0.3, 0.38),
                _mat('#ea580c', { rough: 0.35, metal: 0.4, emissive: '#fb923c', emissiveI: 0.12 })
            );
            plate.position.set(side === 0 ? -0.38 : 0.38, 0.35, 0);
            group.add(plate);

            // spike on each shoulder
            var shoulderSpike = new THREE.Mesh(
                new THREE.ConeGeometry(0.03, 0.15, 4),
                _mat('#ea580c', { rough: 0.4 })
            );
            shoulderSpike.position.set(side === 0 ? -0.42 : 0.42, 0.55, 0);
            shoulderSpike.rotation.z = side === 0 ? 0.3 : -0.3;
            group.add(shoulderSpike);
        }

        // Glowing spine tips (crystal)
        for (var cs = 0; cs < 8; cs++) {
            var crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.025, 0),
                _mat('#fbbf24', { rough: 0.1, metal: 0.6, emissive: '#fbbf24', emissiveI: 0.35 })
            );
            var ca = (cs / 8) * Math.PI - Math.PI / 2;
            crystal.position.set(Math.cos(ca) * 0.25, 0.88, Math.sin(ca) * 0.25);
            crystal.name = 'crystal_' + cs;
            group.add(crystal);
        }

        // Regen glow particles
        var rg = new THREE.BufferGeometry();
        var rp = new Float32Array(12 * 3);
        for (var i = 0; i < 12; i++) {
            rp[i*3]   = (Math.random()-0.5) * 0.7;
            rp[i*3+1] = Math.random() * 0.8;
            rp[i*3+2] = (Math.random()-0.5) * 0.7;
        }
        rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
        var rm = new THREE.PointsMaterial({ color: '#34d399', size: 0.03, transparent: true, opacity: 0.4, depthWrite: false });
        var regenPts = new THREE.Points(rg, rm);
        regenPts.name = 'regenParticles';
        group.add(regenPts);
    }

    if (star >= 4) {
        // FULL BATTLE ARMOR — chest plate, back plate
        var chestArmor = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.2, 0.06),
            _mat('#b45309', { rough: 0.25, metal: 0.55, emissive: '#fb923c', emissiveI: 0.15 })
        );
        chestArmor.position.set(0, 0.35, 0.35);
        group.add(chestArmor);

        var backPlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.25, 0.05),
            _mat('#b45309', { rough: 0.3, metal: 0.5 })
        );
        backPlate.position.set(0, 0.35, -0.35);
        group.add(backPlate);

        // TUSKS (horn-like protrusions from front)
        for (var t = 0; t < 2; t++) {
            var tusk = new THREE.Mesh(
                new THREE.ConeGeometry(0.02, 0.18, 5),
                _mat('#f5f5dc', { rough: 0.3, metal: 0.2 })
            );
            tusk.position.set(t === 0 ? -0.18 : 0.18, 0.5, 0.35);
            tusk.rotation.x = -0.6;
            tusk.rotation.z = t === 0 ? 0.3 : -0.3;
            group.add(tusk);
        }

        // Molten core glow
        var molten = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 8, 6),
            new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.12, depthWrite: false })
        );
        molten.position.y = 0.35;
        molten.name = 'moltenCore';
        group.add(molten);

        // Tail weapon (spiked tail end)
        var tailSpike = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.2, 5),
            _mat('#ea580c', { rough: 0.35, metal: 0.4, emissive: '#fb923c', emissiveI: 0.15 })
        );
        tailSpike.position.set(0, 0.05, -0.3);
        tailSpike.rotation.x = Math.PI / 3;
        group.add(tailSpike);
    }

    if (star >= 5) {
        // TITAN WORM — golden armor overlay on all segments
        for (var seg = 0; seg < 4; seg++) {
            var goldRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.39 - seg * 0.015, 0.022, 8, 18),
                _mat('#fbbf24', { rough: 0.15, metal: 0.8, emissive: '#fbbf24', emissiveI: 0.3 })
            );
            goldRing.rotation.x = -Math.PI / 2;
            goldRing.position.y = 0.12 + seg * 0.18 * 0.85;
            group.add(goldRing);
        }

        // Ground crack effect (dark ring beneath)
        var crack = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.65, 24),
            new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
        );
        crack.rotation.x = -Math.PI / 2;
        crack.position.y = 0.01;
        crack.name = 'groundCrack';
        group.add(crack);
    }
}

// ====================================================================
//  YUJIN — Warlord evolution
// ====================================================================
function _upgradeYujin(group, star) {
    if (star >= 2) {
        // SHOULDER PADS (big, metallic)
        for (var side = 0; side < 2; side++) {
            var pad = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
                _mat('#6b7280', { rough: 0.3, metal: 0.55 })
            );
            pad.position.set(side === 0 ? -0.32 : 0.32, 0.74, 0);
            pad.scale.set(1.2, 0.7, 0.9);
            group.add(pad);

            // spike on shoulder pad
            var padSpike = new THREE.Mesh(
                new THREE.ConeGeometry(0.02, 0.1, 4),
                _mat('#9ca3af', { rough: 0.25, metal: 0.6 })
            );
            padSpike.position.set(side === 0 ? -0.38 : 0.38, 0.8, 0);
            padSpike.rotation.z = side === 0 ? 0.4 : -0.4;
            group.add(padSpike);
        }

        // Bigger axe blade (wider)
        var axeG = group.getObjectByName('axe');
        if (axeG) {
            // second blade for double-axe
            var blade2 = new THREE.Mesh(
                new THREE.BoxGeometry(0.17, 0.14, 0.02),
                _mat('#d1d5db', { rough: 0.2, metal: 0.7 })
            );
            blade2.position.set(-0.08, 0.22, 0);
            axeG.add(blade2);
        }
    }

    if (star >= 3) {
        // WAR PAINT — glowing red stripes on torso
        for (var wp = 0; wp < 4; wp++) {
            var paint = new THREE.Mesh(
                new THREE.BoxGeometry(0.52, 0.02, 0.31),
                _mat('#ef4444', { emissive: '#ef4444', emissiveI: 0.45, rough: 0.8 })
            );
            paint.position.set(0, 0.38 + wp * 0.07, 0);
            group.add(paint);
        }

        // Longer horns — golden tips extending
        for (var h = 0; h < 2; h++) {
            var hornTip = new THREE.Mesh(
                new THREE.ConeGeometry(0.018, 0.14, 4),
                _mat('#fbbf24', { rough: 0.2, metal: 0.65, emissive: '#fbbf24', emissiveI: 0.25 })
            );
            hornTip.position.set(h === 0 ? -0.24 : 0.24, 1.15, 0);
            hornTip.rotation.z = h === 0 ? 0.55 : -0.55;
            group.add(hornTip);
        }

        // War braids (small cylinders hanging from helmet)
        for (var b = 0; b < 2; b++) {
            var braid = new THREE.Mesh(
                new THREE.CylinderGeometry(0.012, 0.008, 0.2, 4),
                _mat('#8b6b4a', { rough: 0.8 })
            );
            braid.position.set(b === 0 ? -0.16 : 0.16, 0.72, -0.1);
            braid.name = 'braid_' + b;
            group.add(braid);
        }

        // Enhanced cape (larger, flowing)
        var bigCape = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.5),
            _mat('#5c3a1e', { rough: 0.85, doubleSide: true })
        );
        bigCape.position.set(0, 0.5, -0.2);
        bigCape.rotation.x = 0.2;
        bigCape.name = 'bigCape';
        group.add(bigCape);
    }

    if (star >= 4) {
        // FULL PLATE ARMOR
        var chestPlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.54, 0.38, 0.06),
            _mat('#9ca3af', { rough: 0.25, metal: 0.65, emissive: '#ef4444', emissiveI: 0.08 })
        );
        chestPlate.position.set(0, 0.52, 0.18);
        group.add(chestPlate);

        // Arm guards
        for (var ag = 0; ag < 2; ag++) {
            var guard = new THREE.Mesh(
                new THREE.CylinderGeometry(0.085, 0.075, 0.14, 6),
                _mat('#9ca3af', { rough: 0.25, metal: 0.55 })
            );
            guard.position.set(ag === 0 ? -0.36 : 0.36, 0.38, 0);
            group.add(guard);
        }

        // Leg guards
        for (var lg = 0; lg < 2; lg++) {
            var lguard = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.08, 0.1, 6),
                _mat('#6b7280', { rough: 0.3, metal: 0.5 })
            );
            lguard.position.set(lg === 0 ? -0.12 : 0.12, 0.08, 0);
            group.add(lguard);
        }

        // Glowing horn eyes (emissive red)
        var body = group.getObjectByName('body');
        if (body && body.material) {
            body.material.emissive = new THREE.Color('#ef4444');
            body.material.emissiveIntensity = 0.12;
        }

        // Fury aura (always visible at star 4+)
        var furyAura = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 10, 8),
            new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide })
        );
        furyAura.position.y = 0.5;
        furyAura.name = 'furyAura';
        group.add(furyAura);
    }

    if (star >= 5) {
        // LEGENDARY WARLORD

        // Golden plate armor overlay
        var goldPlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 0.4, 0.07),
            _mat('#fbbf24', { rough: 0.15, metal: 0.75, emissive: '#fbbf24', emissiveI: 0.25 })
        );
        goldPlate.position.set(0, 0.52, 0.19);
        group.add(goldPlate);

        // Flaming axe effect
        var axeG2 = group.getObjectByName('axe');
        if (axeG2) {
            axeG2.traverse(function(ch) {
                if (ch.isMesh && ch.material) {
                    ch.material.emissive = new THREE.Color('#ef4444');
                    ch.material.emissiveIntensity = 0.6;
                }
            });
            // flame particles on axe
            var fg = new THREE.BufferGeometry();
            var fp = new Float32Array(12 * 3);
            for (var fi = 0; fi < 12; fi++) {
                fp[fi*3]   = 0.08 + (Math.random()-0.5) * 0.2;
                fp[fi*3+1] = 0.1 + Math.random() * 0.2;
                fp[fi*3+2] = (Math.random()-0.5) * 0.1;
            }
            fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
            var fm = new THREE.PointsMaterial({ color: '#ef4444', size: 0.05, transparent: true, opacity: 0.7, depthWrite: false });
            var flames = new THREE.Points(fg, fm);
            flames.name = 'axeFlames';
            axeG2.add(flames);
        }

        // Battle cry aura
        var cryAura = new THREE.Mesh(
            new THREE.SphereGeometry(0.75, 10, 8),
            new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })
        );
        cryAura.position.y = 0.5;
        cryAura.name = 'legendGlow';
        group.add(cryAura);
    }
}

// ====================================================================
//  WMS — Cosmic Entity evolution (max star 3)
// ====================================================================
function _upgradeWMS(group, star) {
    if (star >= 2) {
        // Larger core
        var core = group.getObjectByName('core');
        if (core) {
            core.scale.setScalar(1.25);
            if (core.material) core.material.emissiveIntensity = 0.85;
        }

        // 3 extra wisps (6 total)
        for (var w = 3; w < 6; w++) {
            var wisp = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 6, 6),
                new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.7, depthWrite: false })
            );
            wisp.name = 'wisp_' + w;
            wisp.position.y = 0.55;
            group.add(wisp);
        }

        // Second aura layer
        var aura2 = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 14, 10),
            new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide })
        );
        aura2.position.y = 0.55;
        aura2.name = 'aura2';
        group.add(aura2);

        // Energy tendrils (visible lines)
        for (var t = 0; t < 3; t++) {
            var tendril = new THREE.Mesh(
                new THREE.CylinderGeometry(0.008, 0.003, 0.4, 4),
                new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.3, depthWrite: false })
            );
            var ta = (t / 3) * Math.PI * 2;
            tendril.position.set(Math.cos(ta) * 0.3, 0.55, Math.sin(ta) * 0.3);
            tendril.lookAt(new THREE.Vector3(0, 0.55, 0));
            tendril.name = 'tendril_' + t;
            group.add(tendril);
        }
    }

    if (star >= 3) {
        // COSMIC MAXIMUM

        // Core becomes huge
        var core2 = group.getObjectByName('core');
        if (core2) {
            core2.scale.setScalar(1.5);
            if (core2.material) core2.material.emissiveIntensity = 1.2;
        }

        // 4 more wisps (10 total)
        for (var w2 = 6; w2 < 10; w2++) {
            var wisp2 = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 6, 6),
                new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.6, depthWrite: false })
            );
            wisp2.name = 'wisp_' + w2;
            wisp2.position.y = 0.55;
            group.add(wisp2);
        }

        // REALITY DISTORTION RINGS (3, different axes)
        for (var ri = 0; ri < 3; ri++) {
            var distRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.4 + ri * 0.08, 0.012, 6, 24),
                new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.25, depthWrite: false })
            );
            distRing.position.y = 0.55;
            distRing.name = 'distRing_' + ri;
            group.add(distRing);
        }

        // Cosmic aura (massive)
        var cosmicAura = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 16, 12),
            new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })
        );
        cosmicAura.position.y = 0.55;
        cosmicAura.name = 'cosmicAura';
        group.add(cosmicAura);

        // Outer aura pulse enhancement
        var aura = group.getObjectByName('aura');
        if (aura) {
            aura.scale.setScalar(1.6);
            aura.material.opacity = 0.1;
        }

        // Star field (40 tiny sparkles)
        var sfGeo = new THREE.BufferGeometry();
        var sfPos = new Float32Array(40 * 3);
        for (var i = 0; i < 40; i++) {
            sfPos[i*3]   = (Math.random()-0.5) * 1.6;
            sfPos[i*3+1] = 0.1 + Math.random() * 1.2;
            sfPos[i*3+2] = (Math.random()-0.5) * 1.6;
        }
        sfGeo.setAttribute('position', new THREE.BufferAttribute(sfPos, 3));
        var sfMat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.045, transparent: true, opacity: 0.55, depthWrite: false });
        var starField = new THREE.Points(sfGeo, sfMat);
        starField.name = 'legendSparks';
        group.add(starField);

        // Inner bright core expansion
        group.traverse(function(ch) {
            if (ch.geometry && ch.geometry.parameters && ch.geometry.parameters.radius === 0.08) {
                ch.scale.setScalar(1.5);
            }
        });
    }
}

// ====================================================================
//  ENHANCEMENT LAYER — Electric arcs, personality auras, sparks
//  Lightweight FX that amplify each character's identity per star
// ====================================================================
function _applyEnhancements(group, charId, star) {
    if (!star || star < 2) return;
    switch (charId) {
        case 'Babidi':  _enhanceBabidi(group, star);  break;
        case 'Caronte': _enhanceCaronte(group, star);  break;
        case 'Valerio': _enhanceValerio(group, star);  break;
        case 'Yujin':   _enhanceYujin(group, star);    break;
        case 'WMS':     _enhanceWMS(group, star);      break;
    }
}

// ── BABIDI — Toxic Merchant: poison drips, greed arcs, corruption ──
function _enhanceBabidi(group, star) {
    if (star >= 2) {
        // Toxic drip particles (green drops falling around body)
        group.add(_createSparks('#22c55e', 8, 0.5, 0.2, 'toxicDrip'));
        // Poison arc — crackles between coin area
        group.add(_createArc('#22c55e', 6, 'toxicArc_0'));
    }
    if (star >= 3) {
        // Second toxic arc — wider orbit, more corruption spreading
        group.add(_createArc('#4ade80', 6, 'toxicArc_1'));
        // Poison pulse — expanding toxic shockwave (periodic)
        var poisonPulse = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 8, 6),
            new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })
        );
        poisonPulse.position.y = 0.4;
        poisonPulse.name = 'poisonPulse';
        group.add(poisonPulse);
    }
    if (star >= 4) {
        // Merchant's greed arc — gold lightning from turban
        group.add(_createArc('#fbbf24', 6, 'merchantArc_0'));
        // Greed glow — gold inner pulse (the merchant's corruption made visible)
        var greedGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 8, 6),
            new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })
        );
        greedGlow.position.y = 0.45;
        greedGlow.name = 'greedGlow';
        group.add(greedGlow);
    }
    if (star >= 5) {
        // Sultan's curse — toxic storm arc radiating outward
        group.add(_createArc('#86efac', 8, 'sultanArc_0'));
    }
}

// ── CARONTE — Arcane Professor: thesis lightning, knowledge sparks, dimension tears ──
function _enhanceCaronte(group, star) {
    if (star >= 2) {
        // Knowledge sparks — blue particles rising (wisdom ascending)
        group.add(_createSparks('#60a5fa', 8, 0.6, 0.3, 'knowledgeSparks'));
        // Thesis arc — electric crackle between floating books
        group.add(_createArc('#60a5fa', 6, 'thesisArc_0'));
    }
    if (star >= 3) {
        // Staff lightning — arc from orb crackling down the shaft
        group.add(_createArc('#c084fc', 6, 'staffArc_0'));
        // Rune chain — arc connecting orbiting rune symbols
        group.add(_createArc('#a855f7', 6, 'runeChainArc_0'));
    }
    if (star >= 4) {
        // Wing lightning — electric arc between ethereal wings
        group.add(_createArc('#818cf8', 6, 'wingArc_0'));
        // Arcane storm — arc from mortarboard cap outward
        group.add(_createArc('#c084fc', 6, 'arcaneStormArc_0'));
        // Arcane pulse ring — expanding knowledge shockwave
        var arcanePulse = new THREE.Mesh(
            new THREE.TorusGeometry(0.45, 0.008, 4, 20),
            new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.0, depthWrite: false })
        );
        arcanePulse.rotation.x = -Math.PI / 2;
        arcanePulse.position.y = 0.03;
        arcanePulse.name = 'arcanePulse';
        group.add(arcanePulse);
    }
    if (star >= 5) {
        // Dimension tear arcs — reality ripping around the Archmage
        group.add(_createArc('#a78bfa', 8, 'dimensionArc_0'));
        group.add(_createArc('#e879f9', 8, 'dimensionArc_1'));
    }
}

// ── VALERIO — Fortress Worm: seismic arcs, earth sparks, regen lightning ──
function _enhanceValerio(group, star) {
    if (star >= 2) {
        // Earth sparks — orange particles crumbling from base
        group.add(_createSparks('#fb923c', 8, 0.5, 0.05, 'earthSparks'));
        // Armor crackle — arc between armor bands
        group.add(_createArc('#fb923c', 6, 'earthArc_0'));
    }
    if (star >= 3) {
        // Crystal arc — lightning jumping between glowing crystal tips
        group.add(_createArc('#fbbf24', 6, 'crystalArc_0'));
        // Regen arc — green healing lightning along spine
        group.add(_createArc('#34d399', 6, 'regenArc_0'));
    }
    if (star >= 4) {
        // Seismic arcs — earth energy erupting from ground to body
        group.add(_createArc('#ea580c', 6, 'seismicArc_0'));
        group.add(_createArc('#fb923c', 6, 'seismicArc_1'));
        // Seismic pulse ring — tectonic shockwave
        var seismicPulse = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.01, 4, 20),
            new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.0, depthWrite: false })
        );
        seismicPulse.rotation.x = -Math.PI / 2;
        seismicPulse.position.y = 0.02;
        seismicPulse.name = 'seismicPulse';
        group.add(seismicPulse);
    }
    if (star >= 5) {
        // Titan storm — massive earth lightning
        group.add(_createArc('#fbbf24', 8, 'titanArc_0'));
    }
}

// ── YUJIN — Norse Berserker: fury lightning, rage arcs, battle storm ──
function _enhanceYujin(group, star) {
    if (star >= 2) {
        // Fury sparks — red embers scattering from body
        group.add(_createSparks('#ef4444', 8, 0.5, 0.3, 'furySparks'));
        // Rage arc — electric crackle between shoulder pads
        group.add(_createArc('#ef4444', 6, 'rageArc_0'));
    }
    if (star >= 3) {
        // Horn lightning — red arc snapping between viking horns
        group.add(_createArc('#f87171', 6, 'hornArc_0'));
        // War paint crackle — arc along war paint stripes
        group.add(_createArc('#dc2626', 6, 'warPaintArc_0'));
    }
    if (star >= 4) {
        // Rage storm — arc erupting from body outward
        group.add(_createArc('#ef4444', 6, 'stormArc_0'));
        // Fury ground arc — from axe to ground, pure rage
        group.add(_createArc('#b91c1c', 6, 'furyGroundArc_0'));
        // Rage pulse — expanding fury shockwave
        var ragePulse = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 8, 6),
            new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })
        );
        ragePulse.position.y = 0.5;
        ragePulse.name = 'ragePulse';
        group.add(ragePulse);
    }
    if (star >= 5) {
        // Berserker tempest — full crackle lightning
        group.add(_createArc('#fca5a5', 8, 'berserkerArc_0'));
    }
}

// ── WMS — Cosmic Entity: reality arcs, cosmic sparks, dimension tears ──
function _enhanceWMS(group, star) {
    if (star >= 2) {
        // Reality sparks — pale multi-hue particles drifting chaotically
        group.add(_createSparks('#e9d5ff', 10, 0.6, 0.2, 'realitySparks'));
        // Cosmic arc — electric between orbiting wisps
        group.add(_createArc('#a78bfa', 6, 'cosmicArc_0'));
    }
    if (star >= 3) {
        // Reality storm arcs — tearing through distortion rings
        group.add(_createArc('#c084fc', 8, 'realityArc_0'));
        group.add(_createArc('#e879f9', 8, 'realityArc_1'));
        // Reality tear — flickering slice in space-time
        var tear = new THREE.Mesh(
            new THREE.PlaneGeometry(0.08, 0.25),
            new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
        );
        tear.position.set(0.5, 0.6, 0);
        tear.name = 'realityTear';
        group.add(tear);
    }
}

// ====================================================================
//  STAR UPGRADE ANIMATIONS (called each frame from idle loop)
// ====================================================================
function _animateStarUpgrades(group, t, star) {
    if (!star || star < 2) return;

    // Electric & personality enhancement FX
    _animateEnhancements(group, t);

    // Star aura pulse + rotate
    var aura = group.getObjectByName('starAura');
    if (aura) { aura.material.opacity = 0.2 + 0.12 * Math.sin(t * 2.5); aura.rotation.z = t * 0.5; }
    var aura2 = group.getObjectByName('starAura2');
    if (aura2) { aura2.material.opacity = 0.15 + 0.08 * Math.sin(t * 2); aura2.rotation.z = -t * 0.3; }

    // Floating runes orbit
    for (var i = 0; i < 8; i++) {
        var rune = group.getObjectByName('starRune_' + i);
        if (rune) {
            var ra = t * 0.8 + i * (Math.PI * 2 / 8);
            rune.position.set(Math.cos(ra) * 0.6, 0.4 + Math.sin(ra * 1.5) * 0.2, Math.sin(ra) * 0.6);
            rune.rotation.y = t * 2;
        }
    }

    // Legendary elements
    var halo = group.getObjectByName('legendHalo');
    if (halo) halo.rotation.z = t * 0.8;
    for (var cp = 0; cp < 5; cp++) {
        var pt = group.getObjectByName('crownPoint_' + cp);
        if (pt) pt.position.y += Math.sin(t * 3 + cp * 1.26) * 0.001;
    }
    var ll = group.getObjectByName('legendLight');
    if (ll) ll.intensity = 0.8 + Math.sin(t * 4) * 0.4;
    var lg = group.getObjectByName('legendGlow');
    if (lg) { var p = 1.0 + Math.sin(t * 2) * 0.08; lg.scale.set(p, p, p); lg.material.opacity = 0.06 + 0.03 * Math.sin(t * 2.5); }
    var ls = group.getObjectByName('legendSparks');
    if (ls && ls.geometry && ls.geometry.attributes.position) {
        var pos = ls.geometry.attributes.position;
        for (var si = 0; si < pos.count; si++) { pos.setY(si, pos.getY(si) + 0.004); if (pos.getY(si) > 1.4) pos.setY(si, 0.1); }
        pos.needsUpdate = true;
    }

    // Survival marks orbit
    for (var sm = 0; sm < 6; sm++) {
        var mk = group.getObjectByName('survMark_' + sm);
        if (mk) { var ma = t * 0.6 + sm * (Math.PI * 2 / 6); mk.position.x = Math.cos(ma) * 0.38; mk.position.z = Math.sin(ma) * 0.38; }
    }
    for (var mi = 0; mi < 3; mi++) {
        var med = group.getObjectByName('medal_' + mi);
        if (med) { med.rotation.y = t * 1.5 + mi * 0.5; }
    }

    // Babidi extras
    var poison = group.getObjectByName('poisonAura');
    if (poison) poison.material.opacity = 0.04 + 0.02 * Math.sin(t * 2);
    var flask = group.getObjectByName('flask');
    if (flask) flask.rotation.y = Math.sin(t * 1.5) * 0.2;
    for (var ec = 3; ec < 6; ec++) {
        var exCoin = group.getObjectByName('coin_' + ec);
        if (exCoin) { var eca = t * 1.3 + ec * 1.2; exCoin.position.set(Math.cos(eca) * 0.7, 0.45 + Math.sin(eca * 0.8) * 0.15, Math.sin(eca) * 0.7); }
    }
    var chest = group.getObjectByName('chest');
    if (chest) { chest.position.y = 0.6 + Math.sin(t * 1.2) * 0.04; chest.rotation.y = t * 0.3; }

    // Caronte extras
    var scroll = group.getObjectByName('scroll');
    if (scroll) { scroll.position.y = 0.75 + Math.sin(t * 1.1) * 0.06; scroll.rotation.z = 0.3 + Math.sin(t * 0.9) * 0.15; }
    var staffOrb = group.getObjectByName('staffOrb');
    if (staffOrb && staffOrb.material) staffOrb.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 2.5);
    for (var bk = 2; bk <= 3; bk++) {
        var exBook = group.getObjectByName('book' + (bk > 2 ? bk : '2'));
        if (exBook) { exBook.position.y = 0.6 + Math.sin(t * 1.4 + bk) * 0.05; exBook.rotation.y += 0.002; }
    }
    for (var er = 2; er < 5; er++) {
        var exRune = group.getObjectByName('rune_' + er);
        if (exRune) { var era = t * 0.6 + er * Math.PI * 0.6; exRune.position.set(Math.cos(era) * 0.6, 0.65 + Math.sin(era * 1.2) * 0.15, Math.sin(era) * 0.6); }
    }
    var arcCircle = group.getObjectByName('arcCircle');
    if (arcCircle) arcCircle.rotation.z = t * 0.2;
    for (var wi = 0; wi < 2; wi++) {
        var wing = group.getObjectByName('wing_' + wi);
        if (wing) { wing.rotation.z = (wi === 0 ? 0.1 : -0.1) + Math.sin(t * 2 + wi * Math.PI) * 0.08; wing.material.opacity = 0.1 + 0.04 * Math.sin(t * 2.5); }
    }
    var arcAura = group.getObjectByName('arcaneAura');
    if (arcAura) arcAura.material.opacity = 0.04 + 0.02 * Math.sin(t * 2);

    // Valerio extras
    var molten = group.getObjectByName('moltenCore');
    if (molten) molten.material.opacity = 0.1 + 0.06 * Math.sin(t * 2.5);
    for (var vc = 0; vc < 8; vc++) {
        var cr = group.getObjectByName('crystal_' + vc);
        if (cr) { cr.rotation.y = t * 2 + vc * 0.8; cr.scale.setScalar(1.0 + Math.sin(t * 3 + vc) * 0.15); }
    }
    var regen = group.getObjectByName('regenParticles');
    if (regen && regen.geometry && regen.geometry.attributes.position) {
        var rp = regen.geometry.attributes.position;
        for (var ri = 0; ri < rp.count; ri++) { rp.setY(ri, rp.getY(ri) + 0.003); if (rp.getY(ri) > 0.9) rp.setY(ri, 0.1); }
        rp.needsUpdate = true;
    }
    var gc = group.getObjectByName('groundCrack');
    if (gc) { gc.material.opacity = 0.08 + 0.04 * Math.sin(t * 2); gc.rotation.z = t * 0.1; }

    // Yujin extras
    var fury = group.getObjectByName('furyAura');
    if (fury) fury.material.opacity = 0.04 + 0.02 * Math.sin(t * 3);
    var bigCape = group.getObjectByName('bigCape');
    if (bigCape) bigCape.rotation.x = 0.2 + Math.sin(t * 1.5) * 0.08;
    for (var br = 0; br < 2; br++) {
        var braid = group.getObjectByName('braid_' + br);
        if (braid) { braid.rotation.x = Math.sin(t * 1.8 + br * Math.PI) * 0.15; braid.rotation.z = Math.sin(t * 1.2 + br) * 0.1; }
    }
    var axeFlames = group.getObjectByName('axeFlames');
    if (axeFlames && axeFlames.geometry && axeFlames.geometry.attributes.position) {
        var afp = axeFlames.geometry.attributes.position;
        for (var afi = 0; afi < afp.count; afi++) { afp.setY(afi, afp.getY(afi) + 0.006); if (afp.getY(afi) > 0.35) afp.setY(afi, 0.1); }
        afp.needsUpdate = true;
    }

    // WMS extras
    for (var ew = 3; ew < 10; ew++) {
        var exW = group.getObjectByName('wisp_' + ew);
        if (exW) {
            var ewa = t * (0.8 + ew * 0.05) + ew * (Math.PI * 2 / 10);
            var ewr = 0.35 + (ew - 3) * 0.025;
            exW.position.set(Math.cos(ewa) * ewr, 0.55 + Math.sin(ewa * 1.3) * 0.12, Math.sin(ewa) * ewr);
        }
    }
    for (var dr = 0; dr < 3; dr++) {
        var distR = group.getObjectByName('distRing_' + dr);
        if (distR) { distR.rotation.x = t * (0.5 + dr * 0.2); distR.rotation.y = t * (0.3 + dr * 0.15); }
    }
    var cosmA = group.getObjectByName('cosmicAura');
    if (cosmA) { var ca = 1.0 + Math.sin(t * 1.5) * 0.06; cosmA.scale.set(ca, ca, ca); }
    var aura2m = group.getObjectByName('aura2');
    if (aura2m) { aura2m.material.opacity = 0.03 + 0.02 * Math.sin(t * 2.2); }
}

// ====================================================================
//  ENHANCEMENT ANIMATIONS — electric arcs, personality particles, pulses
// ====================================================================
function _animateEnhancements(group, t) {
    // Electric arc snap — only update ~12% of frames for that sharp "snap" feel
    var doSnap = Math.random() < 0.13;

    // ── BABIDI — toxic drips fall, poison arcs crackle, greed pulses ──
    var toxDrip = group.getObjectByName('toxicDrip');
    if (toxDrip && toxDrip.geometry) {
        var tp = toxDrip.geometry.attributes.position;
        for (var i = 0; i < tp.count; i++) {
            tp.setY(i, tp.getY(i) - 0.008);
            if (tp.getY(i) < 0.05) { tp.setY(i, 0.7 + Math.random() * 0.3); tp.setX(i, (Math.random()-0.5)*0.5); tp.setZ(i, (Math.random()-0.5)*0.5); }
        }
        tp.needsUpdate = true;
    }
    if (doSnap) {
        var tArc0 = group.getObjectByName('toxicArc_0');
        if (tArc0) {
            var ba0 = t * 1.3;
            _jitterArc(tArc0, Math.cos(ba0)*0.4, 0.5, Math.sin(ba0)*0.4, Math.cos(ba0+2.2)*0.35, 0.65, Math.sin(ba0+2.2)*0.35, 0.12);
            tArc0.material.opacity = 0.4 + Math.random() * 0.4;
        }
        var tArc1 = group.getObjectByName('toxicArc_1');
        if (tArc1) {
            var ba1 = t * 0.9 + 1.5;
            _jitterArc(tArc1, Math.cos(ba1)*0.45, 0.35, Math.sin(ba1)*0.45, Math.cos(ba1+1.8)*0.3, 0.7, Math.sin(ba1+1.8)*0.3, 0.15);
            tArc1.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var mArc = group.getObjectByName('merchantArc_0');
        if (mArc) {
            _jitterArc(mArc, 0, 0.9, 0, (Math.random()-0.5)*0.5, 0.3, (Math.random()-0.5)*0.5, 0.1);
            mArc.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var sltArc = group.getObjectByName('sultanArc_0');
        if (sltArc) {
            var sa = Math.random() * Math.PI * 2;
            _jitterArc(sltArc, 0, 0.9, 0, Math.cos(sa)*0.7, 0.3+Math.random()*0.4, Math.sin(sa)*0.7, 0.15);
            sltArc.material.opacity = 0.3 + Math.random() * 0.5;
        }
    }
    var poisonP = group.getObjectByName('poisonPulse');
    if (poisonP) {
        var pp = (t * 0.5) % 1.0;
        if (pp < 0.3) { var pps = 1.0 + pp * 3.3; poisonP.scale.setScalar(pps); poisonP.material.opacity = 0.12 * (1.0 - pp / 0.3); }
        else { poisonP.material.opacity = 0; }
    }
    var greedG = group.getObjectByName('greedGlow');
    if (greedG) { greedG.material.opacity = 0.04 + 0.03 * Math.sin(t * 2.5); var gs = 1.0 + Math.sin(t * 1.8) * 0.06; greedG.scale.setScalar(gs); }

    // ── CARONTE — knowledge rises, thesis crackles, arcane pulses ──
    var knowSp = group.getObjectByName('knowledgeSparks');
    if (knowSp && knowSp.geometry) {
        var kp = knowSp.geometry.attributes.position;
        for (var ki = 0; ki < kp.count; ki++) {
            kp.setY(ki, kp.getY(ki) + 0.006);
            if (kp.getY(ki) > 1.2) { kp.setY(ki, 0.3); kp.setX(ki, (Math.random()-0.5)*0.6); kp.setZ(ki, (Math.random()-0.5)*0.6); }
        }
        kp.needsUpdate = true;
    }
    if (doSnap) {
        var thArc = group.getObjectByName('thesisArc_0');
        if (thArc) {
            _jitterArc(thArc, -0.45, 0.6, 0.05, 0.45, 0.6, 0.05, 0.15);
            thArc.material.opacity = 0.4 + Math.random() * 0.45;
        }
        var stfArc = group.getObjectByName('staffArc_0');
        if (stfArc) {
            _jitterArc(stfArc, 0.35, 0.77, 0.1, 0.35+(Math.random()-0.5)*0.2, 0.1, 0.1, 0.08);
            stfArc.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var rcArc = group.getObjectByName('runeChainArc_0');
        if (rcArc) {
            var rca = t * 0.6;
            _jitterArc(rcArc, Math.cos(rca)*0.6, 0.65, Math.sin(rca)*0.6, Math.cos(rca+Math.PI)*0.6, 0.65, Math.sin(rca+Math.PI)*0.6, 0.1);
            rcArc.material.opacity = 0.35 + Math.random() * 0.4;
        }
        var wArc = group.getObjectByName('wingArc_0');
        if (wArc) {
            _jitterArc(wArc, -0.3, 0.65, -0.2, 0.3, 0.65, -0.2, 0.12);
            wArc.material.opacity = 0.35 + Math.random() * 0.45;
        }
        var asArc = group.getObjectByName('arcaneStormArc_0');
        if (asArc) {
            var asa = Math.random() * Math.PI * 2;
            _jitterArc(asArc, 0, 1.0, 0, Math.cos(asa)*0.5, 0.5, Math.sin(asa)*0.5, 0.1);
            asArc.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var dArc0 = group.getObjectByName('dimensionArc_0');
        if (dArc0) {
            _jitterArc(dArc0, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.6, (Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.6, (Math.random()-0.5)*0.8, 0.18);
            dArc0.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var dArc1 = group.getObjectByName('dimensionArc_1');
        if (dArc1) {
            _jitterArc(dArc1, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.6, (Math.random()-0.5)*0.8, (Math.random()-0.5)*0.8, 0.3+Math.random()*0.6, (Math.random()-0.5)*0.8, 0.18);
            dArc1.material.opacity = 0.3 + Math.random() * 0.5;
        }
    }
    var arcPulse = group.getObjectByName('arcanePulse');
    if (arcPulse) {
        var ap = (t * 0.4) % 1.0;
        if (ap < 0.35) { var aps = 1.0 + ap * 2.8; arcPulse.scale.setScalar(aps); arcPulse.material.opacity = 0.2 * (1.0 - ap / 0.35); }
        else { arcPulse.material.opacity = 0; }
    }

    // ── VALERIO — earth crumbles, crystals zap, seismic erupts ──
    var earthSp = group.getObjectByName('earthSparks');
    if (earthSp && earthSp.geometry) {
        var ep = earthSp.geometry.attributes.position;
        for (var ei = 0; ei < ep.count; ei++) {
            ep.setY(ei, ep.getY(ei) - 0.005);
            if (ep.getY(ei) < 0.02) { ep.setY(ei, 0.3 + Math.random()*0.2); ep.setX(ei, (Math.random()-0.5)*0.5); ep.setZ(ei, (Math.random()-0.5)*0.5); }
        }
        ep.needsUpdate = true;
    }
    if (doSnap) {
        var eArc = group.getObjectByName('earthArc_0');
        if (eArc) {
            var ea = t * 1.1;
            _jitterArc(eArc, Math.cos(ea)*0.37, 0.12, Math.sin(ea)*0.37, Math.cos(ea+1.5)*0.37, 0.42, Math.sin(ea+1.5)*0.37, 0.08);
            eArc.material.opacity = 0.4 + Math.random() * 0.4;
        }
        var cryArc = group.getObjectByName('crystalArc_0');
        if (cryArc) {
            var vca1 = t * 2, vca2 = vca1 + Math.PI * 0.7;
            _jitterArc(cryArc, Math.cos(vca1)*0.25, 0.88, Math.sin(vca1)*0.25, Math.cos(vca2)*0.25, 0.88, Math.sin(vca2)*0.25, 0.1);
            cryArc.material.opacity = 0.35 + Math.random() * 0.45;
        }
        var regArc = group.getObjectByName('regenArc_0');
        if (regArc) {
            _jitterArc(regArc, (Math.random()-0.5)*0.15, 0.1, (Math.random()-0.5)*0.15, (Math.random()-0.5)*0.15, 0.75, (Math.random()-0.5)*0.15, 0.08);
            regArc.material.opacity = 0.3 + Math.random() * 0.4;
        }
        var seiArc0 = group.getObjectByName('seismicArc_0');
        if (seiArc0) {
            _jitterArc(seiArc0, (Math.random()-0.5)*0.3, 0.02, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.2, 0.5, (Math.random()-0.5)*0.2, 0.12);
            seiArc0.material.opacity = 0.35 + Math.random() * 0.45;
        }
        var seiArc1 = group.getObjectByName('seismicArc_1');
        if (seiArc1) {
            _jitterArc(seiArc1, (Math.random()-0.5)*0.35, 0.02, (Math.random()-0.5)*0.35, (Math.random()-0.5)*0.25, 0.55, (Math.random()-0.5)*0.25, 0.12);
            seiArc1.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var titArc = group.getObjectByName('titanArc_0');
        if (titArc) {
            var vta = Math.random() * Math.PI * 2;
            _jitterArc(titArc, Math.cos(vta)*0.4, 0.02, Math.sin(vta)*0.4, 0, 0.8, 0, 0.15);
            titArc.material.opacity = 0.35 + Math.random() * 0.45;
        }
    }
    var seiPulse = group.getObjectByName('seismicPulse');
    if (seiPulse) {
        var sp2 = (t * 0.35) % 1.0;
        if (sp2 < 0.3) { var sps = 1.0 + sp2 * 3.3; seiPulse.scale.setScalar(sps); seiPulse.material.opacity = 0.15 * (1.0 - sp2 / 0.3); }
        else { seiPulse.material.opacity = 0; }
    }

    // ── YUJIN — fury scatters, horns crackle, rage erupts ──
    var furSp = group.getObjectByName('furySparks');
    if (furSp && furSp.geometry) {
        var fp2 = furSp.geometry.attributes.position;
        for (var fi = 0; fi < fp2.count; fi++) {
            fp2.setX(fi, fp2.getX(fi) + (Math.random()-0.5)*0.02);
            fp2.setY(fi, fp2.getY(fi) + 0.005);
            fp2.setZ(fi, fp2.getZ(fi) + (Math.random()-0.5)*0.02);
            if (fp2.getY(fi) > 1.0) { fp2.setXYZ(fi, (Math.random()-0.5)*0.4, 0.3, (Math.random()-0.5)*0.4); }
        }
        fp2.needsUpdate = true;
    }
    if (doSnap) {
        var rArc = group.getObjectByName('rageArc_0');
        if (rArc) {
            _jitterArc(rArc, -0.32, 0.74, 0, 0.32, 0.74, 0, 0.12);
            rArc.material.opacity = 0.4 + Math.random() * 0.4;
        }
        var hArc = group.getObjectByName('hornArc_0');
        if (hArc) {
            _jitterArc(hArc, -0.24, 1.15, 0, 0.24, 1.15, 0, 0.1);
            hArc.material.opacity = 0.4 + Math.random() * 0.45;
        }
        var wpArc = group.getObjectByName('warPaintArc_0');
        if (wpArc) {
            _jitterArc(wpArc, -0.25, 0.38, 0.15, 0.25, 0.6, 0.15, 0.1);
            wpArc.material.opacity = 0.3 + Math.random() * 0.4;
        }
        var stArc = group.getObjectByName('stormArc_0');
        if (stArc) {
            var ysa = Math.random() * Math.PI * 2;
            _jitterArc(stArc, 0, 0.5, 0, Math.cos(ysa)*0.6, 0.3+Math.random()*0.5, Math.sin(ysa)*0.6, 0.12);
            stArc.material.opacity = 0.35 + Math.random() * 0.45;
        }
        var fgArc = group.getObjectByName('furyGroundArc_0');
        if (fgArc) {
            _jitterArc(fgArc, 0.4, 0.4, 0.1, 0.1+Math.random()*0.2, 0.02, Math.random()*0.3, 0.08);
            fgArc.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var bkArc = group.getObjectByName('berserkerArc_0');
        if (bkArc) {
            _jitterArc(bkArc, (Math.random()-0.5)*0.5, 0.2+Math.random()*0.7, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, 0.2+Math.random()*0.7, (Math.random()-0.5)*0.5, 0.15);
            bkArc.material.opacity = 0.35 + Math.random() * 0.45;
        }
    }
    var rageP = group.getObjectByName('ragePulse');
    if (rageP) {
        var rp3 = (t * 0.6) % 1.0;
        if (rp3 < 0.25) { var rps = 1.0 + rp3 * 4.0; rageP.scale.setScalar(rps); rageP.material.opacity = 0.1 * (1.0 - rp3 / 0.25); }
        else { rageP.material.opacity = 0; }
    }

    // ── WMS — reality drifts, cosmic zaps, tears flicker ──
    var rlSp = group.getObjectByName('realitySparks');
    if (rlSp && rlSp.geometry) {
        var rsp = rlSp.geometry.attributes.position;
        for (var ri = 0; ri < rsp.count; ri++) {
            rsp.setX(ri, rsp.getX(ri) + (Math.random()-0.5)*0.015);
            rsp.setY(ri, rsp.getY(ri) + (Math.random()-0.5)*0.015);
            rsp.setZ(ri, rsp.getZ(ri) + (Math.random()-0.5)*0.015);
            var dx = rsp.getX(ri), dy = rsp.getY(ri)-0.55, dz = rsp.getZ(ri);
            if (dx*dx+dy*dy+dz*dz > 0.64) { rsp.setXYZ(ri, (Math.random()-0.5)*0.3, 0.4+Math.random()*0.3, (Math.random()-0.5)*0.3); }
        }
        rsp.needsUpdate = true;
    }
    if (doSnap) {
        var csArc = group.getObjectByName('cosmicArc_0');
        if (csArc) {
            var wca = t * 0.8;
            _jitterArc(csArc, Math.cos(wca)*0.35, 0.55, Math.sin(wca)*0.35, Math.cos(wca+2.5)*0.35, 0.55, Math.sin(wca+2.5)*0.35, 0.12);
            csArc.material.opacity = 0.4 + Math.random() * 0.4;
        }
        var rlArc0 = group.getObjectByName('realityArc_0');
        if (rlArc0) {
            _jitterArc(rlArc0, (Math.random()-0.5)*0.6, 0.3+Math.random()*0.5, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, 0.3+Math.random()*0.5, (Math.random()-0.5)*0.6, 0.2);
            rlArc0.material.opacity = 0.3 + Math.random() * 0.5;
        }
        var rlArc1 = group.getObjectByName('realityArc_1');
        if (rlArc1) {
            _jitterArc(rlArc1, (Math.random()-0.5)*0.7, 0.2+Math.random()*0.6, (Math.random()-0.5)*0.7, (Math.random()-0.5)*0.7, 0.2+Math.random()*0.6, (Math.random()-0.5)*0.7, 0.2);
            rlArc1.material.opacity = 0.3 + Math.random() * 0.5;
        }
    }
    var tear = group.getObjectByName('realityTear');
    if (tear) {
        var tf = (t * 0.7) % 1.0;
        if (tf < 0.15) { tear.material.opacity = 0.5 + Math.random()*0.3; tear.scale.set(1, 0.8+Math.random()*0.4, 1); }
        else if (tf < 0.2) { tear.material.opacity = 0; tear.position.set((Math.random()-0.5)*0.8, 0.3+Math.random()*0.5, (Math.random()-0.5)*0.8); tear.rotation.z = Math.random()*Math.PI; }
        else { tear.material.opacity = 0; }
    }
}
