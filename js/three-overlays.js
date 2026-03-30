// ============================================================
// LOTA AUTO CHESS — three-overlays.js
// 3D Tactical Orders, Traps, Item Dots, Order Links
// ============================================================

var threeOrderSprites = {};   // unitId -> sprite
var threeOrderLinks = [];     // [{ line, unitId, targetId }]
var threeTrapMeshes = [];     // [{ mesh, row, col, ownerId }]
var threeItemDots = {};       // unitId -> group

// --- Helper: cell position in 3D world ---
function _cellPos3D(r, c, y) {
    return new THREE.Vector3(
        c * TILE_UNIT + TILE_UNIT / 2,
        y !== undefined ? y : UNIT_BASE_Y,
        r * TILE_UNIT + TILE_UNIT / 2
    );
}

// =============================================
// TACTICAL ORDER ICONS (3D billboard sprites)
// =============================================
function createOrderSprite3D(orderDef) {
    var c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    var ctx = c.getContext('2d');

    // Background circle
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,17,23,0.7)';
    ctx.fill();
    ctx.strokeStyle = orderDef.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Icon
    ctx.font = '28px sans-serif';
    ctx.fillStyle = orderDef.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(orderDef.icon, 32, 34);

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.35, 0.35, 1);
    sprite.renderOrder = 998;
    return sprite;
}

function updateOrderOverlays3D(playerUnits, combatUnits, phase) {
    if (!threeScene) return;

    // Remove old (dispose to prevent memory leaks)
    for (var uid in threeOrderSprites) {
        var spr = threeOrderSprites[uid];
        threeScene.remove(spr);
        if (spr.material) {
            if (spr.material.map) spr.material.map.dispose();
            spr.material.dispose();
        }
    }
    threeOrderSprites = {};
    for (var i = 0; i < threeOrderLinks.length; i++) {
        var link = threeOrderLinks[i].line;
        threeScene.remove(link);
        if (link.geometry) link.geometry.dispose();
        if (link.material) link.material.dispose();
    }
    threeOrderLinks = [];

    var units = (phase === PHASE_COMBAT || phase === PHASE_RESULT) ? combatUnits : (playerUnits || []);

    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (!u.alive && phase === PHASE_COMBAT) continue;
        if (!u.tacticalOrder || u.tacticalOrder === ORDER_FREE) continue;

        var orderDef = TACTICAL_ORDERS[u.tacticalOrder];
        if (!orderDef) continue;

        var sprite = createOrderSprite3D(orderDef);
        var pos = _cellPos3D(u.row, u.col, UNIT_BASE_Y + 1.2);
        sprite.position.copy(pos);
        threeScene.add(sprite);
        threeOrderSprites[u.id] = sprite;

        // Link line for proteggi/segui
        if ((u.tacticalOrder === ORDER_PROTECT || u.tacticalOrder === ORDER_FOLLOW) && u.tacticalTarget) {
            var target = null;
            for (var j = 0; j < units.length; j++) {
                if (units[j].id === u.tacticalTarget) { target = units[j]; break; }
            }
            if (target) {
                var from = _cellPos3D(u.row, u.col, UNIT_BASE_Y + 0.3);
                var to = _cellPos3D(target.row, target.col, UNIT_BASE_Y + 0.3);
                var geom = new THREE.BufferGeometry().setFromPoints([from, to]);
                var mat = new THREE.LineDashedMaterial({
                    color: orderDef.color, dashSize: 0.15, gapSize: 0.1,
                    transparent: true, opacity: 0.5
                });
                var line = new THREE.Line(geom, mat);
                line.computeLineDistances();
                threeScene.add(line);
                threeOrderLinks.push({ line: line, unitId: u.id, targetId: u.tacticalTarget });
            }
        }
    }
}

// =============================================
// TRAPS (3D meshes on board)
// =============================================
var _trapGeo = null;
var _trapMaterials = {};

function _getTrapMaterial(effect) {
    if (_trapMaterials[effect]) return _trapMaterials[effect];
    var colors = {
        poison: '#22c55e', freeze: '#93c5fd', damage: '#ef4444', speed_reduction: '#a78bfa'
    };
    var col = colors[effect] || '#fbbf24';
    _trapMaterials[effect] = new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.6, roughness: 0.3, metalness: 0.5
    });
    return _trapMaterials[effect];
}

function updateTrapOverlays3D(allPlayers, humanIdx) {
    if (!threeScene) return;

    // Remove old (dispose cloned materials)
    for (var i = 0; i < threeTrapMeshes.length; i++) {
        threeScene.remove(threeTrapMeshes[i].mesh);
        if (threeTrapMeshes[i].mesh.material && threeTrapMeshes[i].mesh.material !== _trapMaterials[threeTrapMeshes[i].mesh.userData.trapEffect]) {
            threeTrapMeshes[i].mesh.material.dispose();
        }
    }
    threeTrapMeshes = [];

    if (!_trapGeo) {
        _trapGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.08, 6);
    }

    for (var p = 0; p < allPlayers.length; p++) {
        var player = allPlayers[p];
        if (!player.activeTraps) continue;

        for (var t = 0; t < player.activeTraps.length; t++) {
            var trap = player.activeTraps[t];
            if (trap.triggered) continue;
            // Show own traps always, enemy traps only if revealed
            if (player.index !== humanIdx && !trap.revealed) continue;

            var mat = _getTrapMaterial(trap.effect);
            var mesh = new THREE.Mesh(_trapGeo, mat);
            var pos = _cellPos3D(trap.row, trap.col, TILE_Y * 2 + 0.05);
            mesh.position.copy(pos);
            mesh.castShadow = false;
            mesh.receiveShadow = false;

            // Pulsing animation via userData
            mesh.userData.phase = Math.random() * Math.PI * 2;
            mesh.userData.trapEffect = trap.effect;

            threeScene.add(mesh);
            threeTrapMeshes.push({ mesh: mesh, row: trap.row, col: trap.col, ownerId: typeof getPlayerSlot==='function'?getPlayerSlot(player):player.index });
        }
    }
}

// Animate trap pulsing
function animateTraps3D(dt) {
    for (var i = 0; i < threeTrapMeshes.length; i++) {
        var m = threeTrapMeshes[i].mesh;
        m.userData.phase += dt * 3;
        var pulse = 0.4 + Math.sin(m.userData.phase) * 0.2;
        m.material.opacity = pulse;
        m.rotation.y += dt * 0.5;
    }
}

// =============================================
// ITEM MODELS (3D unique mini-models per item)
// =============================================
var _itemModelCache = {};

// Compact material helper for items
function _iMat(hex, opts) {
    var o = opts || {};
    return new THREE.MeshStandardMaterial({
        color: hex, emissive: o.em || '#000', emissiveIntensity: o.emI || 0,
        metalness: o.met !== undefined ? o.met : 0.3, roughness: o.rou !== undefined ? o.rou : 0.5,
        transparent: !!o.opa, opacity: o.opa || 1.0, side: o.ds ? THREE.DoubleSide : THREE.FrontSide
    });
}

// Tier-based glow aura + sparkles for Tier 2/3
function _tierGlow(g, tier) {
    if (tier >= 2) {
        var col = tier === 3 ? '#fbbf24' : '#60a5fa';
        var glow = new THREE.Mesh(
            new THREE.SphereGeometry(tier === 3 ? 0.08 : 0.06, 6, 6),
            new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: tier === 3 ? 0.12 : 0.07, depthWrite: false })
        );
        glow.name = 'itemGlow';
        g.add(glow);
    }
    if (tier >= 3) {
        var sg = new THREE.BufferGeometry();
        var sp = new Float32Array(5 * 3);
        for (var i = 0; i < 5; i++) { sp[i*3]=(Math.random()-0.5)*0.14; sp[i*3+1]=(Math.random()-0.5)*0.14; sp[i*3+2]=(Math.random()-0.5)*0.14; }
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        var sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fbbf24', size: 0.02, transparent: true, opacity: 0.7, depthWrite: false }));
        sparkles.name = 'itemSparkles';
        g.add(sparkles);
    }
}

function _getItemModel(itemId, tier) {
    var key = itemId + '_' + tier;
    if (_itemModelCache[key]) return _itemModelCache[key].clone();
    var g = _buildItemModel(itemId, tier);
    _itemModelCache[key] = g;
    return g.clone();
}

function _buildItemModel(itemId, tier) {
    var g = new THREE.Group();
    g.name = 'item_' + itemId;

    switch (itemId) {

        // ═══════════ TIER 1 ═══════════

        case 'frammentoAureo': {
            // Golden crystal shard
            var shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.3, met:0.7, rou:0.2 }));
            shard.scale.set(0.7, 1.3, 0.7);
            g.add(shard);
            var core = new THREE.Mesh(new THREE.OctahedronGeometry(0.02, 0),
                new THREE.MeshBasicMaterial({ color:'#fff7ed', transparent:true, opacity:0.5 }));
            g.add(core);
            break;
        }
        case 'amuletoProtezione': {
            // Blue medallion with silver border + center gem
            var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 8),
                _iMat('#3b82f6', { em:'#60a5fa', emI:0.2, met:0.4, rou:0.3 }));
            disc.rotation.x = Math.PI/2; g.add(disc);
            var border = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 4, 12),
                _iMat('#c0c0c0', { met:0.7, rou:0.2 }));
            border.rotation.x = Math.PI/2; g.add(border);
            var gem = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6),
                _iMat('#93c5fd', { em:'#93c5fd', emI:0.5 }));
            gem.position.z = 0.006; g.add(gem);
            break;
        }
        case 'accusaFormale': {
            // Formal document with red wax seal
            var doc = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.005),
                _iMat('#f5f0e1', { rou:0.9 }));
            g.add(doc);
            var seal = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.005, 6),
                _iMat('#dc2626', { em:'#ef4444', emI:0.3, met:0.2 }));
            seal.rotation.x = Math.PI/2; seal.position.set(0, -0.015, 0.005); g.add(seal);
            // Quill line
            var quill = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.04, 0.002),
                _iMat('#1e3a5f', { rou:0.7 }));
            quill.position.set(0.01, 0.005, 0.004); quill.rotation.z = -0.3; g.add(quill);
            break;
        }
        case 'scimitarraDeserto': {
            // Curved desert scimitar
            var blade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.004),
                _iMat('#e2e8f0', { met:0.8, rou:0.15 }));
            blade.rotation.z = 0.2; blade.position.y = 0.02; g.add(blade);
            var handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.035, 4),
                _iMat('#92400e', { rou:0.8 }));
            handle.position.y = -0.03; g.add(handle);
            var guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005),
                _iMat('#fbbf24', { met:0.6, rou:0.3 }));
            guard.position.y = -0.01; g.add(guard);
            break;
        }
        case 'asciaFjord': {
            // Norse axe with rune mark
            var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.08, 4),
                _iMat('#78350f', { rou:0.85 }));
            g.add(shaft);
            var head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.005),
                _iMat('#d1d5db', { met:0.75, rou:0.2 }));
            head.position.set(0.015, 0.03, 0); g.add(head);
            var rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.006, 0),
                _iMat('#60a5fa', { em:'#60a5fa', emI:0.5 }));
            rune.position.set(0.015, 0.03, 0.004); g.add(rune);
            break;
        }
        case 'esoscheletroSeg': {
            // Segmented armor plates + spine
            for (var si = 0; si < 3; si++) {
                var seg = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4, 0, Math.PI*2, 0, Math.PI/2),
                    _iMat('#b45309', { em:'#fb923c', emI:0.1, met:0.4, rou:0.4 }));
                seg.position.y = -0.015 + si * 0.018; seg.scale.set(1.2-si*0.15, 0.6, 0.8); g.add(seg);
            }
            var spine = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.025, 3),
                _iMat('#ea580c', { em:'#fb923c', emI:0.2 }));
            spine.position.y = 0.04; g.add(spine);
            break;
        }

        // ═══════════ TIER 2 ═══════════

        case 'elmoCondiviso': {
            // Shared silver helm with visor + nose guard
            var dome = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6, 0, Math.PI*2, 0, Math.PI/2),
                _iMat('#9ca3af', { met:0.65, rou:0.25, em:'#60a5fa', emI:0.08 }));
            g.add(dome);
            var visor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.02),
                _iMat('#6b7280', { met:0.7, rou:0.2 }));
            visor.position.set(0, -0.01, 0.025); g.add(visor);
            var nose = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.025, 0.005),
                _iMat('#9ca3af', { met:0.7, rou:0.2 }));
            nose.position.set(0, -0.005, 0.035); g.add(nose);
            break;
        }
        case 'bilanciaDelMercato': {
            // Market balance scale — gold pole + green plates
            var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 4),
                _iMat('#fbbf24', { met:0.6, rou:0.3 }));
            g.add(pole);
            var beam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.004, 0.004),
                _iMat('#fbbf24', { met:0.6, rou:0.3 }));
            beam.position.y = 0.035; g.add(beam);
            for (var pi = 0; pi < 2; pi++) {
                var plate = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.003, 6),
                    _iMat('#22c55e', { em:'#22c55e', emI:0.25 }));
                plate.position.set(pi===0 ? -0.03 : 0.03, 0.02, 0); g.add(plate);
            }
            break;
        }
        case 'lamaAffilata': {
            // Sharp blade — long gleaming silver + blue crossguard
            var lb = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.003),
                _iMat('#e2e8f0', { met:0.85, rou:0.1, em:'#ffffff', emI:0.15 }));
            lb.position.y = 0.015; g.add(lb);
            var tip = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.02, 3),
                _iMat('#f8fafc', { met:0.9, rou:0.1, em:'#ffffff', emI:0.2 }));
            tip.position.y = 0.075; g.add(tip);
            var lh = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.025, 4),
                _iMat('#854d0e', { rou:0.8 }));
            lh.position.y = -0.03; g.add(lh);
            var crossg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.005, 0.005),
                _iMat('#60a5fa', { em:'#60a5fa', emI:0.3, met:0.5 }));
            crossg.position.y = -0.015; g.add(crossg);
            break;
        }
        case 'cristalloRisonante': {
            // Resonating crystal — blue dodecahedron with inner light
            var crys = new THREE.Mesh(new THREE.DodecahedronGeometry(0.035, 0),
                _iMat('#60a5fa', { em:'#93c5fd', emI:0.5, met:0.3, rou:0.15 }));
            g.add(crys);
            var inner = new THREE.Mesh(new THREE.DodecahedronGeometry(0.02, 0),
                new THREE.MeshBasicMaterial({ color:'#dbeafe', transparent:true, opacity:0.4 }));
            g.add(inner);
            break;
        }
        case 'cinturaBerserker': {
            // Berserker belt — red torus + gold buckle + red gem
            var belt = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 12),
                _iMat('#7f1d1d', { em:'#ef4444', emI:0.15, met:0.3, rou:0.5 }));
            belt.rotation.x = Math.PI/2; g.add(belt);
            var buckle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 0.006),
                _iMat('#fbbf24', { met:0.7, rou:0.2 }));
            buckle.position.z = 0.035; g.add(buckle);
            var rGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.006, 0),
                _iMat('#ef4444', { em:'#ef4444', emI:0.6 }));
            rGem.position.z = 0.04; g.add(rGem);
            break;
        }
        case 'velenoAccademico': {
            // Poison vial — green glass + cork + bubbles
            var vial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 6),
                _iMat('#22c55e', { em:'#4ade80', emI:0.3, rou:0.2, met:0.1, opa:0.7 }));
            g.add(vial);
            var cork = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.012, 4),
                _iMat('#92400e', { rou:0.85 }));
            cork.position.y = 0.03; g.add(cork);
            var bub = new THREE.Mesh(new THREE.SphereGeometry(0.006, 4, 4),
                new THREE.MeshBasicMaterial({ color:'#86efac', transparent:true, opacity:0.5 }));
            bub.position.set(0.005, -0.005, 0.01); g.add(bub);
            break;
        }
        case 'mutaCoriacea': {
            // Tough organic molt/shell with ridges
            var shell = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6, 0, Math.PI*2, 0, Math.PI*0.6),
                _iMat('#92400e', { em:'#b45309', emI:0.1, met:0.2, rou:0.7 }));
            shell.rotation.x = 0.3; g.add(shell);
            for (var mri = 0; mri < 3; mri++) {
                var ridge = new THREE.Mesh(new THREE.TorusGeometry(0.028-mri*0.005, 0.003, 3, 8),
                    _iMat('#78350f', { rou:0.8 }));
                ridge.rotation.x = Math.PI/2; ridge.position.y = 0.005+mri*0.01; g.add(ridge);
            }
            break;
        }

        // ═══════════ TIER 3 ═══════════

        case 'ragnarok': {
            // Legendary flaming greatsword
            var rblade = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, 0.004),
                _iMat('#fbbf24', { em:'#ef4444', emI:0.4, met:0.8, rou:0.15 }));
            rblade.position.y = 0.02; g.add(rblade);
            var flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 4),
                new THREE.MeshBasicMaterial({ color:'#ef4444', transparent:true, opacity:0.7 }));
            flame.position.y = 0.08; flame.name = 'ragFlame'; g.add(flame);
            var rguard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.5, met:0.7, rou:0.2 }));
            rguard.position.y = -0.025; g.add(rguard);
            var rhandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.03, 4),
                _iMat('#451a03', { rou:0.8 }));
            rhandle.position.y = -0.045; g.add(rhandle);
            break;
        }
        case 'sigilloDellUsuraio': {
            // Gold usurer's seal — ornate coin + emblem + border
            var coinBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 12),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.35, met:0.8, rou:0.15 }));
            coinBody.rotation.x = Math.PI/2; g.add(coinBody);
            var emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.015, 0),
                _iMat('#fde68a', { em:'#fbbf24', emI:0.6, met:0.9, rou:0.1 }));
            emblem.position.z = 0.006; g.add(emblem);
            var oBorder = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.004, 4, 16),
                _iMat('#f59e0b', { em:'#fbbf24', emI:0.3, met:0.8, rou:0.2 }));
            oBorder.rotation.x = Math.PI/2; g.add(oBorder);
            break;
        }
        case 'pietraDellEternita': {
            // Eternal stone — massive gem + inner glow + orbiting ring
            var eGem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0),
                _iMat('#a78bfa', { em:'#c084fc', emI:0.6, met:0.5, rou:0.1 }));
            g.add(eGem);
            var eInner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0),
                new THREE.MeshBasicMaterial({ color:'#e9d5ff', transparent:true, opacity:0.5 }));
            g.add(eInner);
            var eRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 4, 16),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.4, met:0.7 }));
            eRing.name = 'eternityRing'; g.add(eRing);
            break;
        }
        case 'dottoratoMaledetto': {
            // Cursed diploma scroll + dark aura
            var dScroll = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6),
                _iMat('#1e1b4b', { em:'#7c3aed', emI:0.3, rou:0.6 }));
            dScroll.rotation.z = 0.3; g.add(dScroll);
            for (var dci = 0; dci < 2; dci++) {
                var dcap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 6),
                    _iMat('#7c3aed', { em:'#a855f7', emI:0.4, met:0.4 }));
                dcap.rotation.z = 0.3; dcap.position.set(dci===0 ? -0.017 : 0.017, dci===0 ? -0.032 : 0.032, 0); g.add(dcap);
            }
            var dAura = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
                new THREE.MeshBasicMaterial({ color:'#7c3aed', transparent:true, opacity:0.08, depthWrite:false }));
            dAura.name = 'curseAura'; g.add(dAura);
            break;
        }
        case 'nucleoImmortale': {
            // Immortal core — glowing green sphere + 2 orbital rings
            var nCore = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8),
                _iMat('#34d399', { em:'#6ee7b7', emI:0.7, met:0.3, rou:0.15 }));
            g.add(nCore);
            var nRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.003, 4, 16),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.4, met:0.6 }));
            nRing1.name = 'immortalRing1'; g.add(nRing1);
            var nRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.003, 4, 16),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.4, met:0.6 }));
            nRing2.rotation.y = Math.PI/2; nRing2.name = 'immortalRing2'; g.add(nRing2);
            break;
        }
        case 'coronaSinergie': {
            // Golden crown + 5 points + center jewel
            var crBase = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 12),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.4, met:0.8, rou:0.15 }));
            crBase.rotation.x = Math.PI/2; g.add(crBase);
            for (var cpi = 0; cpi < 5; cpi++) {
                var ca = (cpi/5) * Math.PI*2;
                var pt = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.025, 3),
                    _iMat('#fbbf24', { em:'#fde68a', emI:0.5, met:0.7, rou:0.2 }));
                pt.position.set(Math.cos(ca)*0.03, 0.012, Math.sin(ca)*0.03); g.add(pt);
            }
            var jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.008, 0),
                _iMat('#a78bfa', { em:'#c084fc', emI:0.6 }));
            jewel.position.set(0, 0.005, 0.03); g.add(jewel);
            break;
        }
        case 'codiceOracolo': {
            // Oracle eye orb + pupil + orbital ring
            var oOrb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8),
                _iMat('#a78bfa', { em:'#c084fc', emI:0.5, met:0.2, rou:0.15 }));
            g.add(oOrb);
            var oPupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6),
                _iMat('#1e1b4b', { em:'#7c3aed', emI:0.4 }));
            oPupil.position.z = 0.025; g.add(oPupil);
            var oRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 4, 16),
                _iMat('#fbbf24', { em:'#fbbf24', emI:0.5, met:0.7 }));
            oRing.name = 'oracleRing'; g.add(oRing);
            break;
        }

        default: {
            // Fallback sphere for unknown items
            var cols = { 1:'#94a3b8', 2:'#60a5fa', 3:'#fbbf24' };
            g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8),
                new THREE.MeshBasicMaterial({ color: cols[tier] || '#fff' })));
        }
    }

    // Tier-based glow aura + sparkles
    _tierGlow(g, tier);
    return g;
}

function updateItemDots3D(units) {
    if (!threeScene) return;

    // Remove old
    for (var uid in threeItemDots) {
        threeScene.remove(threeItemDots[uid]);
    }
    threeItemDots = {};

    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (!u.items || u.items.length === 0) continue;

        var group = new THREE.Group();
        for (var j = 0; j < u.items.length; j++) {
            var item = typeof ITEMS !== 'undefined' ? ITEMS[u.items[j]] : null;
            var tier = item ? item.tier : 1;
            var model = _getItemModel(u.items[j], tier);
            model.position.set(-0.12 + j * 0.12, 0, 0);
            model.userData._baseY = 0;
            group.add(model);
        }

        var pos = _cellPos3D(u.row, u.col, UNIT_BASE_Y + 0.9);
        group.position.copy(pos);

        if (threeCamera) group.quaternion.copy(threeCamera.quaternion);

        threeScene.add(group);
        threeItemDots[u.id] = group;
    }
}

// =============================================
// MASTER UPDATE (called from render loop)
// =============================================
function updateThreeOverlays(dt) {
    if (!threeScene) return;

    var phase = typeof gamePhase !== 'undefined' ? gamePhase : '';
    var humanUnits = (typeof players !== 'undefined' && getHumanPlayer()) ? getAllPlayerUnits(getHumanPlayer()) : [];
    var cUnits = typeof combatUnits !== 'undefined' ? combatUnits : [];

    // Tactical orders
    if (phase === PHASE_PLANNING) {
        updateOrderOverlays3D(humanUnits, null, phase);
        updateMoveFlags3D(humanUnits);
        if (typeof players !== 'undefined') updateTrapOverlays3D(players, 0);
        updateItemDots3D(humanUnits);
    } else if (phase === PHASE_COMBAT || phase === PHASE_RESULT) {
        updateOrderOverlays3D(null, cUnits, phase);
        // Show flags for human ORDER_MOVE units during combat
        var humanCombatMove = [];
        for (var fi = 0; fi < cUnits.length; fi++) {
            if (cUnits[fi].owner === 0 && cUnits[fi].alive && cUnits[fi].tacticalOrder === ORDER_MOVE) humanCombatMove.push(cUnits[fi]);
        }
        updateMoveFlags3D(humanCombatMove);
        if (typeof players !== 'undefined') updateTrapOverlays3D(players, 0);
        // Item dots for human combat units
        var humanCombat = [];
        for (var i = 0; i < cUnits.length; i++) {
            if (cUnits[i].owner === 0 && cUnits[i].alive) humanCombat.push(cUnits[i]);
        }
        updateItemDots3D(humanCombat);
    }

    // Animate traps
    animateTraps3D(dt);

    // Billboard + animate item models
    var _iNow = Date.now() * 0.001;
    for (var uid in threeItemDots) {
        var ig = threeItemDots[uid];
        if (threeCamera) ig.quaternion.copy(threeCamera.quaternion);
        for (var ci = 0; ci < ig.children.length; ci++) {
            var ich = ig.children[ci];
            // Gentle floating bob
            ich.position.y = (ich.userData._baseY || 0) + Math.sin(_iNow * 2.5 + ci * 1.8) * 0.012;
            // Tier glow pulse
            var igl = ich.getObjectByName('itemGlow');
            if (igl) { var igs = 1.0 + Math.sin(_iNow*3+ci)*0.15; igl.scale.setScalar(igs); igl.material.opacity = 0.08 + 0.04*Math.sin(_iNow*2+ci); }
            // Sparkle orbit
            var ispk = ich.getObjectByName('itemSparkles');
            if (ispk) ispk.rotation.y = _iNow * 2.0 + ci;
            // Pietra dell'Eternità — orbiting ring
            var eRing = ich.getObjectByName('eternityRing');
            if (eRing) { eRing.rotation.x = _iNow*1.5; eRing.rotation.z = _iNow*0.7; }
            // Nucleo Immortale — dual orbital rings
            var iR1 = ich.getObjectByName('immortalRing1');
            if (iR1) iR1.rotation.x = _iNow * 1.8;
            var iR2 = ich.getObjectByName('immortalRing2');
            if (iR2) iR2.rotation.z = _iNow * 1.3;
            // Codice dell'Oracolo — oracle ring
            var oRing = ich.getObjectByName('oracleRing');
            if (oRing) { oRing.rotation.x = _iNow*1.2; oRing.rotation.y = _iNow*0.8; }
            // Dottorato Maledetto — curse aura pulse
            var curA = ich.getObjectByName('curseAura');
            if (curA) curA.material.opacity = 0.06 + 0.04*Math.sin(_iNow*2.5+ci);
            // Ragnarök — flame flicker
            var ragF = ich.getObjectByName('ragFlame');
            if (ragF) { ragF.scale.y = 0.8 + Math.sin(_iNow*6)*0.3; ragF.material.opacity = 0.5 + Math.sin(_iNow*5)*0.3; }
        }
    }
}

// =============================================
// MOVE FLAGS — 3D flag markers for ORDER_MOVE
// =============================================
var _threeMoveFlags = {}; // unitId -> { group }

function updateMoveFlags3D(units) {
    if (!threeScene) return;

    // Track which flags are still needed
    var needed = {};

    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.tacticalOrder !== ORDER_MOVE || u.tacticalMoveRow < 0 || u.tacticalMoveCol < 0) continue;
        var key = u.id;
        needed[key] = true;

        var wpos = cellToWorld(u.tacticalMoveRow, u.tacticalMoveCol);
        var teamCol = (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[u.owner]) ? TEAM_COLORS[u.owner].primary : '#fb923c';

        if (!_threeMoveFlags[key]) {
            // Create flag
            var g = new THREE.Group();
            g.name = 'moveFlag_' + key;

            // Pole
            var poleMat = new THREE.MeshBasicMaterial({ color: '#e2e8f0' });
            var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), poleMat);
            pole.position.y = 0.6;
            g.add(pole);

            // Flag cloth (plane)
            var flagMat = new THREE.MeshBasicMaterial({
                color: teamCol, side: THREE.DoubleSide,
                transparent: true, opacity: 0.85
            });
            var flagGeo = new THREE.PlaneGeometry(0.4, 0.25);
            var flag = new THREE.Mesh(flagGeo, flagMat);
            flag.position.set(0.2, 1.05, 0);
            flag.name = 'flagCloth';
            g.add(flag);

            // Ground ring
            var ringMat = new THREE.MeshBasicMaterial({
                color: teamCol, transparent: true, opacity: 0.3, side: THREE.DoubleSide
            });
            var ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 12), ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02;
            ring.name = 'flagRing';
            g.add(ring);

            g.position.copy(wpos);
            g.position.y = 0;
            threeScene.add(g);
            _threeMoveFlags[key] = { group: g };
        } else {
            // Update position
            _threeMoveFlags[key].group.position.set(wpos.x, 0, wpos.z);
        }

        // Animate: wave flag + pulse ring
        var fg = _threeMoveFlags[key].group;
        var t = Date.now() * 0.003;
        var cloth = fg.getObjectByName('flagCloth');
        if (cloth) cloth.rotation.y = Math.sin(t) * 0.15;
        var ring = fg.getObjectByName('flagRing');
        if (ring) ring.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.15;
    }

    // Remove stale flags (dispose to prevent leaks)
    for (var fk in _threeMoveFlags) {
        if (!needed[fk]) {
            var fg = _threeMoveFlags[fk].group;
            fg.traverse(function(child) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            threeScene.remove(fg);
            delete _threeMoveFlags[fk];
        }
    }
}
