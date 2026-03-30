// ============================================================
// LOTA AUTO CHESS — three-board.js — 3D Board with 4 Biomes
// ============================================================

var boardTiles = {};        // "r_c" -> THREE.Mesh
var deployHighlights = [];  // meshes for current highlights
var boardDecorations = [];  // torches, border, center symbol

// Pre-cached refs for per-frame animation (evita loop + string compare ogni frame)
var _torchFlames = [];
var _torchLights = [];
var _centerRings = [];
var _centerDiscs = [];

// Pre-cached cave arch animation refs
var _archLights    = [];   // arch column & crown lights → flicker
var _archRunes     = [];   // arch rune rings → rotate + pulse
var _archKeystones = [];   // arch keystones → emissive pulse

var _tileMaterials = {};    // cache

function _tileMat(hex, emissive, emissiveIntensity) {
    var key = hex + (emissive || '') + (emissiveIntensity || '');
    if (!_tileMaterials[key]) {
        _tileMaterials[key] = new THREE.MeshStandardMaterial({
            color: hex,
            roughness: 0.75,
            metalness: 0.12,
            emissive: emissive || '#000000',
            emissiveIntensity: emissiveIntensity || (emissive ? 0.3 : 0)
        });
    }
    return _tileMaterials[key];
}

function createBoard3D() {
    threeBoardGroup = new THREE.Group();
    threeBoardGroup.name = 'board';

    // Base world ground (dark earth under everything)
    _createBaseGround();

    // Invisible raycasting plane — screenToCell() hits this to detect r,c
    var rayGeo = new THREE.PlaneGeometry(BOARD_COLS * TILE_UNIT + 4, BOARD_ROWS * TILE_UNIT + 4);
    var rayPlane = new THREE.Mesh(rayGeo, new THREE.MeshBasicMaterial({ visible: false }));
    rayPlane.rotation.x = -Math.PI / 2;
    rayPlane.position.set(BOARD_CX, TILE_Y * 2, BOARD_CZ);
    threeBoardGroup.add(rayPlane);

    threeScene.add(threeBoardGroup);

    // --- Dungeon Corner Tiles ---
    _createDungeonTiles();

    // --- Board Border (raised frame) ---
    _createBoardBorder();

    // --- Center Arena Symbol ---
    _createCenterSymbol();

    // --- Torches at diagonal corners ---
    _createTorches();

    // --- Base Walls around deploy zones ---
    _createBaseWalls();

    // --- Dungeon Boss Previews (permanent raptor markers at corner dungeon cells) ---
    _createDungeonBossPreviews();
}

// === BASE WORLD GROUND ===
function _createBaseGround() {
    // Large dark ground plane beneath the entire board — prevents seeing under tiles
    // and fills the area around/beyond the octagon
    var size = BOARD_ROWS * TILE_UNIT * 1.6; // extends well beyond the board
    var groundGeo = new THREE.PlaneGeometry(size, size);
    var textureLoader = new THREE.TextureLoader();
    var groundMat = new THREE.MeshStandardMaterial({
        color: '#4a7a3a',
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.FrontSide
    });
    // Load a subtle dirt texture for the world floor
    textureLoader.load('models/kenney/Textures/floor_ground_dirt.png', function(tex) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(16, 16);
        groundMat.map = tex;
        groundMat.needsUpdate = true;
    });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(BOARD_CX, 0.01, BOARD_CZ); // well below tile surface (0.15)
    ground.receiveShadow = true;
    threeScene.add(ground);
    boardDecorations.push(ground);
}

// === TERRAIN ZONES removed — biome wedges and center disc no longer rendered ===

// === BOARD BORDER (single LineLoop instead of ~220 box posts) ===
function _createBoardBorder() {
    var cut = OCTAGON_CUT;
    var M = BOARD_ROWS;
    var verts = [
        [cut, 0], [M - cut, 0], [M, cut], [M, M - cut],
        [M - cut, M], [cut, M], [0, M - cut], [0, cut]
    ];
    var points = [];
    for (var i = 0; i < verts.length; i++) {
        points.push(new THREE.Vector3(
            verts[i][0] * TILE_UNIT,
            TILE_Y * 2 + 0.01,
            verts[i][1] * TILE_UNIT
        ));
    }
    var lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    var lineMat = new THREE.LineBasicMaterial({
        color: '#475569', linewidth: 2
    });
    var border = new THREE.LineLoop(lineGeo, lineMat);
    threeScene.add(border);
    boardDecorations.push(border);
}

// === CENTER ARENA ZONE ===
function _createCenterSymbol() {
    var cx = BOARD_CX;
    var cz = BOARD_CZ;
    var R = (typeof CENTER_CONTROL_RADIUS !== 'undefined' ? CENTER_CONTROL_RADIUS : 9) * TILE_UNIT;

    // ── Outer boundary ring (marks the full center zone) ──
    var outerRingGeo = new THREE.RingGeometry(R - 0.15, R + 0.15, 32);
    var outerRingMat = new THREE.MeshBasicMaterial({
        color: '#daa520', transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false
    });
    var outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.set(cx, TILE_Y * 2 + 0.015, cz);
    outerRing.name = 'centerOuterRing';
    threeScene.add(outerRing);
    boardDecorations.push(outerRing);
    _centerRings.push(outerRing);

    // ── Zone floor tint (subtle golden glow over center area) ──
    var zoneGeo = new THREE.CircleGeometry(R, 32);
    var zoneMat = new THREE.MeshBasicMaterial({
        color: '#daa520', transparent: true, opacity: 0.06,
        side: THREE.DoubleSide, depthWrite: false
    });
    var zoneDisc = new THREE.Mesh(zoneGeo, zoneMat);
    zoneDisc.rotation.x = -Math.PI / 2;
    zoneDisc.position.set(cx, TILE_Y * 2 + 0.012, cz);
    threeScene.add(zoneDisc);
    boardDecorations.push(zoneDisc);

    // ── Inner decorative ring (smaller, more visible) ──
    var innerRingGeo = new THREE.RingGeometry(2.0, 2.4, 16);
    var innerRingMat = new THREE.MeshBasicMaterial({
        color: BIOME_CENTER.accent, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false
    });
    var innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.set(cx, TILE_Y * 2 + 0.02, cz);
    innerRing.name = 'centerRing';
    threeScene.add(innerRing);
    boardDecorations.push(innerRing);
    _centerRings.push(innerRing);

    // ── Center emblem disc ──
    var emblemGeo = new THREE.CircleGeometry(1.2, 12);
    var emblemMat = new THREE.MeshBasicMaterial({
        color: BIOME_CENTER.emissive, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide, depthWrite: false
    });
    var emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.rotation.x = -Math.PI / 2;
    emblem.position.set(cx, TILE_Y * 2 + 0.025, cz);
    emblem.name = 'centerDisc';
    threeScene.add(emblem);
    boardDecorations.push(emblem);
    _centerDiscs.push(emblem);

    // ── Stone markers around outer boundary (8 small pillars) ──
    for (var i = 0; i < 8; i++) {
        var a = i * Math.PI * 2 / 8;
        var mx = cx + Math.cos(a) * R;
        var mz = cz + Math.sin(a) * R;
        var pillarGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.4, 6);
        var pillarMat = new THREE.MeshStandardMaterial({
            color: '#8a7a60', roughness: 0.8, metalness: 0.1
        });
        var pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(mx, TILE_Y * 2 + 0.2, mz);
        threeScene.add(pillar);
        boardDecorations.push(pillar);
    }
}

// === TORCHES ===
function _createTorches() {
    var torchPositions = [
        { r: 0, c: OCTAGON_CUT - 1 },      // NW
        { r: 0, c: BOARD_COLS - OCTAGON_CUT }, // NE
        { r: BOARD_ROWS - 1, c: OCTAGON_CUT - 1 }, // SW
        { r: BOARD_ROWS - 1, c: BOARD_COLS - OCTAGON_CUT }, // SE
        // Diagonal midpoints
        { r: OCTAGON_CUT - 1, c: 0 },
        { r: OCTAGON_CUT - 1, c: BOARD_COLS - 1 },
        { r: BOARD_ROWS - OCTAGON_CUT, c: 0 },
        { r: BOARD_ROWS - OCTAGON_CUT, c: BOARD_COLS - 1 },
    ];

    for (var i = 0; i < torchPositions.length; i++) {
        var tp = torchPositions[i];
        var tx = tp.c * TILE_UNIT + TILE_UNIT / 2;
        var tz = tp.r * TILE_UNIT + TILE_UNIT / 2;

        // Torch pole
        var poleGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.6, 6);
        var poleMat = new THREE.MeshStandardMaterial({ color: '#4a3728', roughness: 0.8, metalness: 0.3 });
        var pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(tx, TILE_Y * 2 + 0.3, tz);
        pole.castShadow = true;
        threeScene.add(pole);
        boardDecorations.push(pole);

        // Flame (emissive sphere)
        var flameGeo = new THREE.SphereGeometry(0.08, 8, 8);
        var flameColor = '#fbbf24';
        var flameMat = new THREE.MeshBasicMaterial({ color: flameColor });
        var flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(tx, TILE_Y * 2 + 0.65, tz);
        flame.name = 'torchFlame';
        threeScene.add(flame);
        boardDecorations.push(flame);
        _torchFlames.push(flame);

        // PERF: torch PointLights rimossi — troppo costosi con 20+ luci dinamiche
    }
}

// === BIOME AMBIENT PARTICLES removed ===

// Animate biome particles + torches + center (call each frame)
function animateBoardDecorations(dt, t) {
    // PERF: biome particles disabled — 200 GPU uploads/frame eliminated

    // Animate torches (flicker) — usa array pre-cachati, zero string compare
    for (var i = 0; i < _torchFlames.length; i++) {
        _torchFlames[i].scale.setScalar(0.8 + Math.sin(t * 6 + i * 2) * 0.3);
    }
    for (var i = 0; i < _torchLights.length; i++) {
        _torchLights[i].intensity = 0.3 + Math.sin(t * 7 + i) * 0.15 + Math.random() * 0.05;
    }

    // Animate center symbol
    for (var i = 0; i < _centerRings.length; i++) {
        _centerRings[i].rotation.z = t * 0.3;
        _centerRings[i].material.opacity = 0.3 + Math.sin(t * 2) * 0.15;
    }
    for (var i = 0; i < _centerDiscs.length; i++) {
        _centerDiscs[i].material.opacity = 0.15 + Math.sin(t * 2 + 1) * 0.1;
    }

    // Animate arch keystones (emissive pulse)
    for (var ki = 0; ki < _archKeystones.length; ki++) {
        if (_archKeystones[ki] && _archKeystones[ki].material) {
            _archKeystones[ki].material.emissiveIntensity = 0.6 + 0.55 * Math.sin(t * 1.7 + ki * 0.55);
        }
    }
    // Animate arch runes (slow rotation + opacity pulse)
    for (var ri = 0; ri < _archRunes.length; ri++) {
        var ar = _archRunes[ri];
        if (ar) {
            ar.rotation.z = t * 0.45 + ri * Math.PI * 0.5;
            if (ar.material) ar.material.opacity = 0.70 + 0.24 * Math.sin(t * 2.1 + ri * 0.9);
        }
    }
    // Animate arch & column lights (flicker)
    for (var li = 0; li < _archLights.length; li++) {
        if (_archLights[li]) {
            _archLights[li].intensity = 0.55 + 0.55 * Math.sin(t * 4.8 + li * 1.4) * Math.sin(t * 8.3 + li * 2.2);
        }
    }

    // Animate dungeon boss preview raptors
    for (var bi = 0; bi < _dungeonBossPreviewMixers.length; bi++) {
        _dungeonBossPreviewMixers[bi].update(dt);
    }
}

// === PLAYER BASES (colored floor + transparent walls + corner pillars + banner) ===
function _createBaseWalls() {
    for (var pi = 0; pi < 4; pi++) {
        var zone = getDeployZone(pi);
        if (!zone || !zone.cells || zone.cells.length === 0) continue;
        var tc = TEAM_COLORS[pi];
        var color = new THREE.Color(tc.primary);

        // Find bounding box
        var minR = 999, maxR = 0, minC = 999, maxC = 0;
        for (var ci = 0; ci < zone.cells.length; ci++) {
            var cr = zone.cells[ci].r, cc = zone.cells[ci].c;
            if (cr < minR) minR = cr; if (cr > maxR) maxR = cr;
            if (cc < minC) minC = cc; if (cc > maxC) maxC = cc;
        }
        var w = (maxC - minC + 1) * TILE_UNIT;
        var h = (maxR - minR + 1) * TILE_UNIT;
        var cx = (minC + (maxC + 1)) / 2 * TILE_UNIT;
        var cz = (minR + (maxR + 1)) / 2 * TILE_UNIT;
        var x1 = minC * TILE_UNIT;
        var x2 = (maxC + 1) * TILE_UNIT;
        var z1 = minR * TILE_UNIT;
        var z2 = (maxR + 1) * TILE_UNIT;
        var FLOOR_Y = TILE_Y * 2;
        var WALL_H = 0.5;

        // ── 1. Floor glow (colored ground plane) ──
        var floorGeo = new THREE.PlaneGeometry(w, h);
        var floorMat = new THREE.MeshBasicMaterial({
            color: tc.primary, transparent: true, opacity: 0.12,
            side: THREE.DoubleSide, depthWrite: false
        });
        var floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(cx, FLOOR_Y + 0.008, cz);
        threeScene.add(floor);
        boardDecorations.push(floor);

        // ── 2. Transparent colored walls (4 sides) ──
        var wallMat = new THREE.MeshBasicMaterial({
            color: tc.primary, transparent: true, opacity: 0.15,
            side: THREE.DoubleSide, depthWrite: false
        });
        // North wall
        var wn = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat);
        wn.position.set(cx, FLOOR_Y + WALL_H / 2, z1);
        threeScene.add(wn); boardDecorations.push(wn);
        // South wall
        var ws = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat);
        ws.position.set(cx, FLOOR_Y + WALL_H / 2, z2);
        threeScene.add(ws); boardDecorations.push(ws);
        // West wall
        var ww = new THREE.Mesh(new THREE.PlaneGeometry(h, WALL_H), wallMat);
        ww.rotation.y = Math.PI / 2;
        ww.position.set(x1, FLOOR_Y + WALL_H / 2, cz);
        threeScene.add(ww); boardDecorations.push(ww);
        // East wall
        var we = new THREE.Mesh(new THREE.PlaneGeometry(h, WALL_H), wallMat);
        we.rotation.y = Math.PI / 2;
        we.position.set(x2, FLOOR_Y + WALL_H / 2, cz);
        threeScene.add(we); boardDecorations.push(we);

        // ── 3. Corner pillars (4 small cylinders at corners) ──
        var pillarMat = new THREE.MeshStandardMaterial({
            color: tc.primary, roughness: 0.5, metalness: 0.3,
            emissive: tc.primary, emissiveIntensity: 0.2
        });
        var pillarGeo = new THREE.CylinderGeometry(0.08, 0.12, WALL_H + 0.15, 6);
        var corners = [[x1,z1],[x2,z1],[x1,z2],[x2,z2]];
        for (var ci2 = 0; ci2 < 4; ci2++) {
            var pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(corners[ci2][0], FLOOR_Y + (WALL_H + 0.15) / 2, corners[ci2][1]);
            threeScene.add(pillar); boardDecorations.push(pillar);
            // Small sphere on top
            var sphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 6, 4),
                new THREE.MeshBasicMaterial({ color: tc.primary })
            );
            sphere.position.set(corners[ci2][0], FLOOR_Y + WALL_H + 0.2, corners[ci2][1]);
            threeScene.add(sphere); boardDecorations.push(sphere);
        }

        // ── 4. Team banner (tall pole + flag at center-back of base) ──
        // Determine which edge faces outward
        var bannerX = cx, bannerZ = cz;
        if (pi === 0) bannerZ = z1;      // North player → banner at north edge
        else if (pi === 1) bannerX = x1;  // West player → banner at west edge
        else if (pi === 2) bannerZ = z2;  // South player → banner at south edge
        else bannerX = x2;                // East player → banner at east edge

        // Pole
        var pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.04, 1.2, 5),
            new THREE.MeshStandardMaterial({ color: '#8a7a60', roughness: 0.7 })
        );
        pole.position.set(bannerX, FLOOR_Y + 0.6, bannerZ);
        threeScene.add(pole); boardDecorations.push(pole);

        // Flag (small colored plane)
        var flagMat = new THREE.MeshBasicMaterial({
            color: tc.primary, side: THREE.DoubleSide,
            transparent: true, opacity: 0.85
        });
        var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), flagMat);
        flag.position.set(bannerX + 0.25, FLOOR_Y + 1.05, bannerZ);
        flag.rotation.y = (pi === 1 || pi === 3) ? Math.PI / 2 : 0;
        threeScene.add(flag); boardDecorations.push(flag);
    }
}

function highlightDeployZone3D(playerIdx) {
    clearDeployHighlights3D();
    var zone = getDeployZone(playerIdx);
    if (!zone) return;
    var tc = TEAM_COLORS[playerIdx];
    var hlGeo = new THREE.PlaneGeometry(TILE_UNIT * 0.9, TILE_UNIT * 0.9);
    var hlMat = new THREE.MeshBasicMaterial({
        color: tc.primary, transparent: true, opacity: 0.15,
        side: THREE.DoubleSide, depthWrite: false
    });
    for (var i = 0; i < zone.cells.length; i++) {
        var cell = zone.cells[i];
        var hl = new THREE.Mesh(hlGeo, hlMat);
        hl.rotation.x = -Math.PI / 2;
        hl.position.set(
            cell.c * TILE_UNIT + TILE_UNIT / 2,
            TILE_Y * 2 + 0.01,
            cell.r * TILE_UNIT + TILE_UNIT / 2
        );
        threeScene.add(hl);
        deployHighlights.push(hl);
    }
}

function clearDeployHighlights3D() {
    for (var i = 0; i < deployHighlights.length; i++) {
        threeScene.remove(deployHighlights[i]);
        if (deployHighlights[i].geometry) deployHighlights[i].geometry.dispose();
        if (deployHighlights[i].material) deployHighlights[i].material.dispose();
    }
    deployHighlights = [];
}

function updateDeployHighlights3D(t) {
    var pulse = 0.1 + 0.08 * Math.sin(t * 3);
    for (var i = 0; i < deployHighlights.length; i++) {
        deployHighlights[i].material.opacity = pulse;
    }
}

// Highlight a single cell (hover)
var _hoverHighlight = null;
function showCellHover3D(r, c) {
    if (!_hoverHighlight) {
        var geo = new THREE.PlaneGeometry(TILE_UNIT * 0.92, TILE_UNIT * 0.92);
        var mat = new THREE.MeshBasicMaterial({
            color: '#ffffff', transparent: true, opacity: 0.1,
            side: THREE.DoubleSide, depthWrite: false
        });
        _hoverHighlight = new THREE.Mesh(geo, mat);
        _hoverHighlight.rotation.x = -Math.PI / 2;
        threeScene.add(_hoverHighlight);
    }
    _hoverHighlight.visible = true;
    _hoverHighlight.position.set(
        c * TILE_UNIT + TILE_UNIT / 2,
        TILE_Y * 2 + 0.02,
        r * TILE_UNIT + TILE_UNIT / 2
    );
}
function hideCellHover3D() {
    if (_hoverHighlight) _hoverHighlight.visible = false;
}

// === DUNGEON CORNER TILES (4 triangular shapes instead of ~2400 individual tiles) ===
function _createDungeonTiles() {
    var cut = OCTAGON_CUT; // 18
    var M = BOARD_ROWS;    // 66
    var dungeonMat = new THREE.MeshStandardMaterial({
        color: '#1a0e2e', roughness: 0.82, metalness: 0.06,
        emissive: '#8b1a8b', emissiveIntensity: 0.1
    });

    // Each dungeon corner is a right triangle in the cut-off area
    var corners = [
        // NW: vertices at (0,0), (cut,0), (0,cut)
        [[0, 0], [cut, 0], [0, cut]],
        // NE: vertices at (M,0), (M-cut,0), (M,cut)
        [[M, 0], [M, cut], [M - cut, 0]],
        // SW: vertices at (0,M), (0,M-cut), (cut,M)
        [[0, M], [cut, M], [0, M - cut]],
        // SE: vertices at (M,M), (M-cut,M), (M,M-cut)
        [[M, M], [M, M - cut], [M - cut, M]]
    ];

    corners.forEach(function(verts) {
        var shape = new THREE.Shape();
        shape.moveTo(verts[0][0] * TILE_UNIT, verts[0][1] * TILE_UNIT);
        shape.lineTo(verts[1][0] * TILE_UNIT, verts[1][1] * TILE_UNIT);
        shape.lineTo(verts[2][0] * TILE_UNIT, verts[2][1] * TILE_UNIT);
        shape.closePath();

        var geo = new THREE.ShapeGeometry(shape, 1);
        // World-position UV tiling
        var pos = geo.getAttribute('position');
        var uv  = geo.getAttribute('uv');
        var uvS = 1 / (TILE_UNIT * 4);
        for (var j = 0; j < pos.count; j++) {
            uv.setXY(j, pos.getX(j) * uvS, pos.getY(j) * uvS);
        }
        uv.needsUpdate = true;

        var mesh = new THREE.Mesh(geo, dungeonMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = TILE_Y * 2;
        mesh.receiveShadow = true;
        threeScene.add(mesh);
        boardDecorations.push(mesh);
    });

    // Dungeon atmosphere: place red torches in corners
    _createDungeonTorches();
    // Cave decorations (reduced)
    _createDungeonDecorations();
    // Cave structure: walls, ceiling, entrance arch
    _createDungeonWalls();
}

function _createDungeonTorches() {
    // Red torches in dungeon corners
    var torchPositions = [
        { r: 6,  c: 6,  corner: 'NW' },  // NW corner center
        { r: 6,  c: 59, corner: 'NE' },  // NE corner center
        { r: 59, c: 6,  corner: 'SW' },  // SW corner center
        { r: 59, c: 59, corner: 'SE' },  // SE corner center
    ];

    torchPositions.forEach(function(tp) {
        var tx = tp.c * TILE_UNIT + TILE_UNIT / 2;
        var tz = tp.r * TILE_UNIT + TILE_UNIT / 2;

        // Torch pole (darker)
        var poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.7, 6);
        var poleMat = new THREE.MeshStandardMaterial({ color: '#2a1a1a', roughness: 0.9, metalness: 0.2 });
        var pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(tx, TILE_Y * 2 + 0.35, tz);
        pole.castShadow = true;
        threeScene.add(pole);
        boardDecorations.push(pole);

        // Flame (red, emissive)
        var flameGeo = new THREE.SphereGeometry(0.1, 8, 8);
        var flameMat = new THREE.MeshBasicMaterial({ color: '#ff4444' });
        var flame = new THREE.Mesh(flameGeo, flameMat);
        flame.position.set(tx, TILE_Y * 2 + 0.75, tz);
        flame.name = 'dungeonTorchFlame';
        threeScene.add(flame);
        boardDecorations.push(flame);

        // PERF: dungeon torch PointLight removed
    });
}

// ============================================================
// DUNGEON CAVE DECORATIONS
// ============================================================

function _createDungeonDecorations() {
    // Each corner: cx/cz = world-space center of the dungeon area
    //              ax/az = boss altar position (world)
    //              sx/sz = ±1, direction pointing toward the outer corner wall
    var corners = [
        { cx: 5.5,  cz: 5.5,  ax: 4.5,  az: 4.5,  sx: -1, sz: -1 },  // NW
        { cx: 59.5, cz: 5.5,  ax: 61.5, az: 4.5,  sx:  1, sz: -1 },  // NE
        { cx: 5.5,  cz: 59.5, ax: 4.5,  az: 61.5, sx: -1, sz:  1 },  // SW
        { cx: 59.5, cz: 59.5, ax: 61.5, az: 61.5, sx:  1, sz:  1 },  // SE
    ];
    corners.forEach(function(def) {
        _buildCaveDecor(def.cx, def.cz, def.ax, def.az, def.sx, def.sz);
    });
}

function _buildCaveDecor(cx, cz, ax, az, sx, sz) {
    var TILE_TOP = TILE_Y * 2;

    // Deterministic pseudo-RNG seeded by corner position
    var _s = (Math.abs(cx * 7919 + cz * 6271) | 0) + 1;
    function rng() {
        _s = ((_s * 1664525) + 1013904223) & 0x7fffffff;
        return _s / 0x7fffffff;
    }

    // Shared materials (reused — no cloning)
    var stoneMat = new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.97, metalness: 0.03 });
    var crystalMat = new THREE.MeshStandardMaterial({
        color: '#7c3aed', emissive: '#5b21b6', emissiveIntensity: 0.9,
        roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.80
    });
    var altarMat = new THREE.MeshStandardMaterial({
        color: '#1e0a2e', roughness: 0.75, metalness: 0.25,
        emissive: '#6b21a8', emissiveIntensity: 0.3
    });

    // ── 1. STALAGMITI (4 instead of 10+) ─────────────────────────────
    var stalPos = [[sx*1.0, sz*1.0], [sx*2.5, sz*0.6], [sx*0.6, sz*2.5], [sx*3.2, sz*3.2]];
    stalPos.forEach(function(p) {
        var x = cx + p[0], z = cz + p[1];
        var h = 0.4 + rng() * 1.0;
        var geo = new THREE.ConeGeometry(0.08 + rng()*0.08, h, 5);
        var m = new THREE.Mesh(geo, stoneMat);
        m.position.set(x, TILE_TOP + h*0.5, z);
        m.rotation.y = rng() * Math.PI * 2;
        threeScene.add(m); boardDecorations.push(m);
    });

    // ── 2. CRISTALLI (2 clusters, 3 each) ────────────────────────────
    var crystalPos = [[sx*1.5, sz*0.4], [sx*0.4, sz*1.5]];
    crystalPos.forEach(function(p) {
        var kx = cx + p[0], kz = cz + p[1];
        for (var i = 0; i < 3; i++) {
            var ch = 0.25 + rng()*0.45;
            var geo = new THREE.CylinderGeometry(0.01, 0.05 + rng()*0.04, ch, 6);
            var crys = new THREE.Mesh(geo, crystalMat);
            crys.position.set(kx+(rng()-0.5)*0.3, TILE_TOP+ch*0.5, kz+(rng()-0.5)*0.3);
            crys.rotation.set((rng()-0.5)*0.4, rng()*Math.PI*2, (rng()-0.5)*0.3);
            threeScene.add(crys); boardDecorations.push(crys);
        }
    });

    // ── 3. PILASTRO (1 instead of 3) ─────────────────────────────────
    var px = cx + sx*2.2, pz = cz + sz*0.9;
    var pMat = new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: 0.9, metalness: 0.1 });
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6), pMat);
    shaft.position.set(px, TILE_TOP + 0.75, pz);
    threeScene.add(shaft); boardDecorations.push(shaft);

    // ── 4. MASSI (2 instead of 5+) ───────────────────────────────────
    var boulderPos = [[sx*3.5, sz*0.6], [sx*0.6, sz*3.5]];
    boulderPos.forEach(function(p) {
        var bs = 0.2 + rng()*0.2;
        var boulder = new THREE.Mesh(new THREE.SphereGeometry(bs, 5, 3), stoneMat);
        boulder.position.set(cx+p[0], TILE_TOP+bs*0.4, cz+p[1]);
        boulder.scale.set(1.0, 0.5, 0.8);
        threeScene.add(boulder); boardDecorations.push(boulder);
    });

    // ── 5. ALTARE (simplified: 1 tier + orb + rune) ──────────────────
    var tierGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.2, 8);
    var tier = new THREE.Mesh(tierGeo, altarMat);
    tier.position.set(ax, TILE_TOP + 0.1, az);
    threeScene.add(tier); boardDecorations.push(tier);

    var runeRing = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.44, 8),
        new THREE.MeshBasicMaterial({ color: '#c026d3', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
    );
    runeRing.rotation.x = -Math.PI / 2;
    runeRing.position.set(ax, TILE_TOP + 0.204, az);
    threeScene.add(runeRing); boardDecorations.push(runeRing);

    var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 6),
        new THREE.MeshStandardMaterial({ color: '#a855f7', emissive: '#7c3aed', emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.5 })
    );
    orb.position.set(ax, TILE_TOP + 0.35, az);
    threeScene.add(orb); boardDecorations.push(orb);

    // ── 6. NEBBIA (3 instead of 7) ───────────────────────────────────
    var mistPos = [[sx*2.0, sz*1.5, 1.8], [sx*1.5, sz*2.0, 1.5], [sx*3.8, sz*0.6, 2.0]];
    mistPos.forEach(function(mp) {
        var mistMesh = new THREE.Mesh(
            new THREE.CircleGeometry(mp[2], 8),
            new THREE.MeshBasicMaterial({ color: '#1a053a', transparent: true, opacity: 0.15, depthWrite: false })
        );
        mistMesh.rotation.x = -Math.PI / 2;
        mistMesh.position.set(cx+mp[0], TILE_TOP + 0.006, cz+mp[1]);
        threeScene.add(mistMesh); boardDecorations.push(mistMesh);
    });

    // ── 7. WALL ROCKS (3 instead of 7) ──────────────────────────────
    for (var wi = 0; wi < 3; wi++) {
        var wa = (wi / 2) * Math.PI * 0.5;
        var wd = 5.5 + rng() * 2.5;
        var wx = cx + sx * Math.abs(Math.cos(wa)) * wd;
        var wz = cz + sz * Math.abs(Math.sin(wa)) * wd;
        var ws = 0.4 + rng() * 0.4;
        var wallRock = new THREE.Mesh(new THREE.DodecahedronGeometry(ws, 0), stoneMat);
        wallRock.position.set(wx, TILE_TOP + ws*0.3, wz);
        wallRock.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
        wallRock.scale.set(0.9, 0.5, 0.8);
        threeScene.add(wallRock); boardDecorations.push(wallRock);
    }
}

// ============================================================
//  DUNGEON CAVE STRUCTURE — walls, ceiling, entrance arch
// ============================================================

function _createDungeonWalls() {
    if (!threeScene) return;
    var CUT    = 17;                      // tile cut depth (r+c < 17 check)
    var cutLen = CUT * TILE_UNIT;
    var BW     = BOARD_COLS * TILE_UNIT;  // full board width in world units
    var WALL_H = 6.5;                     // cave wall height
    var CEIL_H = 5.5;                     // ceiling height above tile surface
    var WALL_T = 0.9;                     // wall thickness

    // Each corner: outer corner (ox,oz),
    //   wall1 end A=(ax,az) along one board edge (horizontal),
    //   wall2 end B=(bx,bz) along other edge (vertical)
    var corners = [
        { ox: 0,  oz: 0,  ax: cutLen,    az: 0,  bx: 0,  bz: cutLen    },  // NW
        { ox: BW, oz: 0,  ax: BW-cutLen, az: 0,  bx: BW, bz: cutLen    },  // NE
        { ox: 0,  oz: BW, ax: cutLen,    az: BW, bx: 0,  bz: BW-cutLen },  // SW
        { ox: BW, oz: BW, ax: BW-cutLen, az: BW, bx: BW, bz: BW-cutLen },  // SE
    ];

    corners.forEach(function(c, idx) {
        _buildCaveStructure(c.ox, c.oz, c.ax, c.az, c.bx, c.bz,
                            WALL_H, CEIL_H, WALL_T, cutLen, idx);
    });
}

function _buildCaveStructure(ox, oz, ax, az, bx, bz, wallH, ceilH, wallT, cutLen, cornerIdx) {
    var floorY = TILE_Y * 2;
    var ceilY  = floorY + ceilH;          // 0.15 + 5.5 = 5.65

    // Seeded deterministic RNG
    var _seed = (cornerIdx * 99991 + 77777) | 0;
    function rng() {
        _seed = ((_seed * 1664525) + 1013904223) & 0x7fffffff;
        return _seed / 0x7fffffff;
    }

    function mkStoneMat(hex) {
        return new THREE.MeshStandardMaterial({
            color: hex || '#15100c', roughness: 0.96, metalness: 0.05,
            emissive: '#0a0508', emissiveIntensity: 0.06
        });
    }
    var archMat = new THREE.MeshStandardMaterial({
        color: '#1e1510', roughness: 0.83, metalness: 0.17,
        emissive: '#3b0764', emissiveIntensity: 0.30
    });

    // ── WALL 1 — along the Z=oz or Z=BW outer edge (horizontal) ──────
    {
        var w1 = new THREE.Mesh(
            new THREE.BoxGeometry(cutLen, wallH, wallT),
            mkStoneMat()
        );
        w1.position.set((ox + ax) / 2, floorY + wallH / 2, oz);
        w1.name = 'caveWall'; w1.castShadow = true; w1.receiveShadow = true;
        threeScene.add(w1); boardDecorations.push(w1);

        for (var ri = 0; ri < 2; ri++) {
            var rt = (rng() - 0.5) * cutLen * 0.80;
            var rh = floorY + rng() * wallH * 0.72;
            var rs = 0.14 + rng() * 0.34;
            var rk = new THREE.Mesh(
                new THREE.DodecahedronGeometry(rs, 0),
                mkStoneMat(rng() > 0.5 ? '#0e0b08' : '#201810')
            );
            rk.position.set((ox + ax) / 2 + rt, rh,
                            oz + (rng() > 0.5 ? 1 : -1) * (wallT * 0.3 + rs * 0.12));
            rk.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
            rk.scale.set(1+rng()*0.3, 0.5+rng()*0.28, 0.85+rng()*0.25);
            rk.castShadow = true; rk.name = 'wallRock';
            threeScene.add(rk); boardDecorations.push(rk);
        }
    }

    // ── WALL 2 — along the X=ox or X=BW outer edge (vertical) ────────
    {
        var w2 = new THREE.Mesh(
            new THREE.BoxGeometry(wallT, wallH, cutLen),
            mkStoneMat()
        );
        w2.position.set(ox, floorY + wallH / 2, (oz + bz) / 2);
        w2.name = 'caveWall'; w2.castShadow = true; w2.receiveShadow = true;
        threeScene.add(w2); boardDecorations.push(w2);

        for (var ri = 0; ri < 2; ri++) {
            var rt = (rng() - 0.5) * cutLen * 0.80;
            var rh = floorY + rng() * wallH * 0.72;
            var rs = 0.14 + rng() * 0.34;
            var rk = new THREE.Mesh(
                new THREE.DodecahedronGeometry(rs, 0),
                mkStoneMat(rng() > 0.5 ? '#0e0b08' : '#201810')
            );
            rk.position.set(ox + (rng() > 0.5 ? 1 : -1) * (wallT * 0.3 + rs * 0.12),
                            rh, (oz + bz) / 2 + rt);
            rk.rotation.set(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI);
            rk.scale.set(0.85+rng()*0.25, 0.5+rng()*0.28, 1+rng()*0.3);
            rk.castShadow = true; rk.name = 'wallRock';
            threeScene.add(rk); boardDecorations.push(rk);
        }
    }

    // ── FRONT FACADE & ENTRANCE (diagonal from A to B) ─────────────
    {
        var dx = bx - ax, dz = bz - az;
        var diagLen = Math.sqrt(dx * dx + dz * dz);
        var diagAngle = Math.atan2(-dz, dx);
        var midFX = (ax + bx) / 2, midFZ = (az + bz) / 2;

        // Direction perpendicular to facade (pointing outward from cave)
        var perpX = -dz / diagLen, perpZ = dx / diagLen;
        // Flip perp to always point toward board center
        var toCX = BOARD_CX - midFX, toCZ = BOARD_CZ - midFZ;
        if (perpX * toCX + perpZ * toCZ < 0) { perpX = -perpX; perpZ = -perpZ; }

        // ─ Cliff face: rough rock wall with opening ──────────────────
        var cliffMat = mkStoneMat('#1c1410');
        var gateW = 3.0;  // opening width
        var halfDiag = diagLen / 2;
        var halfGate = gateW / 2;

        // Left cliff section (from A to gate edge)
        var leftLen = halfDiag - halfGate;
        if (leftLen > 0.5) {
            var lMidT = (halfGate > 0) ? (leftLen / 2) / halfDiag : 0.25;
            var lx = ax + dx * (leftLen * 0.5 / diagLen);
            var lz = az + dz * (leftLen * 0.5 / diagLen);
            var leftCliff = new THREE.Mesh(new THREE.BoxGeometry(leftLen, wallH, wallT * 1.4), cliffMat);
            leftCliff.position.set(lx, floorY + wallH / 2, lz);
            leftCliff.rotation.y = diagAngle;
            leftCliff.castShadow = true;
            threeScene.add(leftCliff); boardDecorations.push(leftCliff);
        }

        // Right cliff section (from gate edge to B)
        if (leftLen > 0.5) {
            var rx = bx - dx * (leftLen * 0.5 / diagLen);
            var rz = bz - dz * (leftLen * 0.5 / diagLen);
            var rightCliff = new THREE.Mesh(new THREE.BoxGeometry(leftLen, wallH, wallT * 1.4), cliffMat);
            rightCliff.position.set(rx, floorY + wallH / 2, rz);
            rightCliff.rotation.y = diagAngle;
            rightCliff.castShadow = true;
            threeScene.add(rightCliff); boardDecorations.push(rightCliff);
        }

        // ─ Large rock outcroppings flanking the entrance ─────────────
        var rockOutcropMat = mkStoneMat('#201814');
        var outcrops = [
            { t: 0.5 - halfGate / diagLen - 0.02, s: 1.1 },  // left of gate
            { t: 0.5 + halfGate / diagLen + 0.02, s: 1.0 },  // right of gate
            { t: 0.08, s: 0.7 },   // far left
            { t: 0.92, s: 0.65 },  // far right
        ];
        outcrops.forEach(function(oc) {
            var ocx = ax + dx * oc.t + perpX * 0.3;
            var ocz = az + dz * oc.t + perpZ * 0.3;
            var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(oc.s, 1), rockOutcropMat);
            rock.position.set(ocx, floorY + oc.s * 0.5, ocz);
            rock.scale.set(1.2, 0.7 + rng() * 0.3, 1.0);
            rock.rotation.set(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.2);
            rock.castShadow = true;
            threeScene.add(rock); boardDecorations.push(rock);
        });

        // ─ Gate columns (thick stone pillars) ────────────────────────
        var colH = 4.5, colR = 0.45;
        var gateLeftX  = midFX - (dx / diagLen) * halfGate;
        var gateLeftZ  = midFZ - (dz / diagLen) * halfGate;
        var gateRightX = midFX + (dx / diagLen) * halfGate;
        var gateRightZ = midFZ + (dz / diagLen) * halfGate;

        [{ x: gateLeftX, z: gateLeftZ }, { x: gateRightX, z: gateRightZ }].forEach(function(pt) {
            // Main shaft — tapered
            var shaft = new THREE.Mesh(
                new THREE.CylinderGeometry(colR * 0.75, colR, colH, 8),
                archMat.clone()
            );
            shaft.position.set(pt.x, floorY + colH / 2, pt.z);
            shaft.castShadow = true;
            threeScene.add(shaft); boardDecorations.push(shaft);

            // Plinth (wide base)
            var plinth = new THREE.Mesh(
                new THREE.CylinderGeometry(colR + 0.1, colR + 0.25, 0.3, 8),
                archMat.clone()
            );
            plinth.position.set(pt.x, floorY + 0.15, pt.z);
            threeScene.add(plinth); boardDecorations.push(plinth);

            // Capital (ornate top)
            var capital = new THREE.Mesh(
                new THREE.CylinderGeometry(colR + 0.2, colR * 0.75, 0.25, 8),
                archMat.clone()
            );
            capital.position.set(pt.x, floorY + colH + 0.12, pt.z);
            threeScene.add(capital); boardDecorations.push(capital);

            // Crystal cluster atop column (2 shards each)
            for (var ci = 0; ci < 2; ci++) {
                var cAngle = ci * Math.PI + rng() * 0.6;
                var cH = 0.5 + rng() * 0.4;
                var crystShard = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.01, 0.09, cH, 6),
                    new THREE.MeshStandardMaterial({
                        color: '#9333ea', emissive: '#7c3aed', emissiveIntensity: 1.5,
                        transparent: true, opacity: 0.9
                    })
                );
                crystShard.position.set(
                    pt.x + Math.sin(cAngle) * 0.2,
                    floorY + colH + 0.3 + cH / 2,
                    pt.z + Math.cos(cAngle) * 0.2
                );
                crystShard.rotation.set((rng() - 0.5) * 0.35, 0, (rng() - 0.5) * 0.35);
                threeScene.add(crystShard); boardDecorations.push(crystShard);
            }

            // Rubble at column base
            for (var ri = 0; ri < 3; ri++) {
                var rAng = rng() * Math.PI * 2;
                var rDist = colR + 0.2 + rng() * 0.4;
                var rSize = 0.08 + rng() * 0.12;
                var rubble = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(rSize, 0),
                    mkStoneMat('#1a1410')
                );
                rubble.position.set(
                    pt.x + Math.cos(rAng) * rDist,
                    floorY + rSize * 0.3,
                    pt.z + Math.sin(rAng) * rDist
                );
                rubble.scale.set(1, 0.5, 0.8);
                threeScene.add(rubble); boardDecorations.push(rubble);
            }
        });

        // ─ Arch stones (curved arc between columns) ──────────────────
        var NUM_STONES = 7;
        var archRadius = diagLen * 0.22;

        for (var ai = 0; ai <= NUM_STONES; ai++) {
            var tN = ai / NUM_STONES;
            var phi = tN * Math.PI;
            var stoneX = gateLeftX + (gateRightX - gateLeftX) * tN;
            var stoneZ = gateLeftZ + (gateRightZ - gateLeftZ) * tN;
            var stoneY = floorY + colH + Math.sin(phi) * archRadius;
            var stoneW = (gateW / (NUM_STONES + 1)) * 1.15;
            var stoneH_v = 0.22 + Math.sin(phi) * 0.15;

            var stone = new THREE.Mesh(
                new THREE.BoxGeometry(stoneW, stoneH_v, 0.7),
                archMat.clone()
            );
            stone.position.set(stoneX, stoneY, stoneZ);
            stone.rotation.y = diagAngle;
            stone.castShadow = true;
            threeScene.add(stone); boardDecorations.push(stone);
        }

        // ─ Keystone (crown, glowing) ─────────────────────────────────
        var keystoneY = floorY + colH + archRadius;
        var ksMat = new THREE.MeshStandardMaterial({
            color: '#1a0a2e', roughness: 0.55, metalness: 0.45,
            emissive: '#7c3aed', emissiveIntensity: 1.2
        });
        var keystone = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.75), ksMat);
        keystone.position.set(midFX, keystoneY, midFZ);
        keystone.rotation.y = diagAngle;
        keystone.name = 'archKeystone';
        threeScene.add(keystone); boardDecorations.push(keystone);
        _archKeystones.push(keystone);

        // Rune glyph on keystone
        var archRune = new THREE.Mesh(
            new THREE.RingGeometry(0.12, 0.32, 8),
            new THREE.MeshBasicMaterial({
                color: '#c026d3', transparent: true, opacity: 0.92,
                side: THREE.DoubleSide, depthWrite: false
            })
        );
        archRune.position.set(midFX, keystoneY, midFZ);
        archRune.rotation.x = Math.PI / 2;
        archRune.name = 'archRune';
        threeScene.add(archRune); boardDecorations.push(archRune);
        _archRunes.push(archRune);

        // ─ Portal glow (layered planes for depth) ────────────────────
        var portalColors = ['#7c3aed', '#9333ea', '#581c87'];
        var portalOps    = [0.18, 0.12, 0.08];
        for (var pi = 0; pi < 3; pi++) {
            var portalPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(gateW - 0.4 - pi * 0.3, colH - 0.5 - pi * 0.2),
                new THREE.MeshBasicMaterial({
                    color: portalColors[pi], transparent: true,
                    opacity: portalOps[pi], side: THREE.DoubleSide, depthWrite: false
                })
            );
            portalPlane.position.set(
                midFX - perpX * (0.1 + pi * 0.15),
                floorY + colH / 2 + 0.2,
                midFZ - perpZ * (0.1 + pi * 0.15)
            );
            portalPlane.rotation.y = diagAngle;
            threeScene.add(portalPlane); boardDecorations.push(portalPlane);
        }

        // ─ Ground mist at entrance ───────────────────────────────────
        for (var fi = 0; fi < 4; fi++) {
            var ft = 0.3 + (fi / 3) * 0.4;
            var fogX = gateLeftX + (gateRightX - gateLeftX) * ft + perpX * (rng() * 1.5 - 0.5);
            var fogZ = gateLeftZ + (gateRightZ - gateLeftZ) * ft + perpZ * (rng() * 1.5 - 0.5);
            var fogR = 0.7 + rng() * 0.8;
            var fog = new THREE.Mesh(
                new THREE.CircleGeometry(fogR, 8),
                new THREE.MeshBasicMaterial({
                    color: '#1a053a', transparent: true,
                    opacity: 0.12 + rng() * 0.1, depthWrite: false
                })
            );
            fog.rotation.x = -Math.PI / 2;
            fog.position.set(fogX, floorY + 0.008, fogZ);
            threeScene.add(fog); boardDecorations.push(fog);
        }

        // ─ Scattered rocks on ground near entrance ───────────────────
        for (var gi = 0; gi < 5; gi++) {
            var gt = 0.15 + rng() * 0.7;
            var gOff = (rng() - 0.5) * 2.5;
            var grx = gateLeftX + (gateRightX - gateLeftX) * gt + perpX * gOff;
            var grz = gateLeftZ + (gateRightZ - gateLeftZ) * gt + perpZ * gOff;
            var grs = 0.06 + rng() * 0.1;
            var groundRock = new THREE.Mesh(new THREE.DodecahedronGeometry(grs, 0), mkStoneMat('#1a1410'));
            groundRock.position.set(grx, floorY + grs * 0.3, grz);
            groundRock.scale.set(1, 0.4, 0.8);
            groundRock.rotation.y = rng() * Math.PI;
            threeScene.add(groundRock); boardDecorations.push(groundRock);
        }
    }

    // ── TRIANGULAR CEILING with STALACTITES ───────────────────────────
    {
        var cShape = new THREE.Shape();
        cShape.moveTo(ox, oz);
        cShape.lineTo(ax, az);
        cShape.lineTo(bx, bz);
        cShape.closePath();

        var SLAB_D = 0.65;
        var extGeo = new THREE.ExtrudeGeometry(cShape, { depth: SLAB_D, bevelEnabled: false });
        var ceilMesh = new THREE.Mesh(extGeo,
            new THREE.MeshStandardMaterial({
                color: '#100d09', roughness: 0.98, metalness: 0.01,
                emissive: '#050208', emissiveIntensity: 0.04,
                side: THREE.DoubleSide
            })
        );
        ceilMesh.rotation.x = Math.PI / 2;
        ceilMesh.position.y = ceilY;
        ceilMesh.name = 'caveCeiling'; ceilMesh.receiveShadow = true;
        threeScene.add(ceilMesh); boardDecorations.push(ceilMesh);

        // Stalactites hanging from ceiling
        var stalMat = new THREE.MeshStandardMaterial({ color: '#1a1208', roughness: 0.97, metalness: 0.02 });
        var crystalTipMat = new THREE.MeshStandardMaterial({
            color: '#7c3aed', emissive: '#5b21b6', emissiveIntensity: 0.85,
            transparent: true, opacity: 0.82
        });
        for (var si = 0; si < 6; si++) {
            var u = rng(), v = rng();
            if (u + v > 1.0) { u = 1.0 - u; v = 1.0 - v; }
            var stx = ox + u * (ax - ox) + v * (bx - ox);
            var stz = oz + u * (az - oz) + v * (bz - oz);
            var sh = 0.35 + rng() * 1.45;
            var sr = 0.04 + rng() * 0.12;
            var sseg = 4 + Math.floor(rng() * 3);
            var stalMesh2 = new THREE.Mesh(new THREE.ConeGeometry(sr, sh, sseg), stalMat.clone());
            stalMesh2.rotation.x = (rng() - 0.5) * 0.18;
            stalMesh2.rotation.z = Math.PI;
            stalMesh2.rotation.y = rng() * Math.PI * 2;
            stalMesh2.position.set(stx, ceilY - sh * 0.5, stz);
            stalMesh2.castShadow = true;
            threeScene.add(stalMesh2); boardDecorations.push(stalMesh2);
            if (rng() > 0.70) {
                var cpH = sh * 0.30;
                var cpMesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.01, sr * 0.55, cpH, 6),
                    crystalTipMat.clone()
                );
                cpMesh.rotation.z = Math.PI;
                cpMesh.position.set(stx, ceilY - sh - cpH * 0.5, stz);
                threeScene.add(cpMesh); boardDecorations.push(cpMesh);
            }
        }
    }
}

// ============================================================
// DUNGEON BOSS PREVIEWS — permanent raptor markers
// ============================================================

var _dungeonBossPreviewGroups = [];
var _dungeonBossPreviewMixers = []; // AnimationMixers for animated previews

function _createDungeonBossPreviews() {
    if (!threeScene) return;

    var BOSS_POSITIONS = [
        { r: 4,  c: 4,  corner: 'NW' },
        { r: 4,  c: 61, corner: 'NE' },
        { r: 61, c: 4,  corner: 'SW' },
        { r: 61, c: 61, corner: 'SE' }
    ];
    var TILE_TOP = TILE_Y * 2;

    function _placePreview(pos, modelData) {
        var wx = pos.c * TILE_UNIT + TILE_UNIT / 2;
        var wz = pos.r * TILE_UNIT + TILE_UNIT / 2;

        var group = new THREE.Group();
        group.name = 'bossPreview_' + pos.corner;
        group.position.set(wx, TILE_TOP, wz);
        group.lookAt(new THREE.Vector3(BOARD_CX, TILE_TOP, BOARD_CZ));

        // ── Ground aura (menacing purple glow under the boss) ──
        var auraGeo = new THREE.CircleGeometry(1.2, 16);
        var auraMat = new THREE.MeshBasicMaterial({
            color: '#7c3aed', transparent: true, opacity: 0.2,
            side: THREE.DoubleSide, depthWrite: false
        });
        var aura = new THREE.Mesh(auraGeo, auraMat);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.01;
        aura.name = 'bossAura';
        group.add(aura);

        // Inner bright aura ring
        var innerAura = new THREE.Mesh(
            new THREE.RingGeometry(0.6, 1.0, 16),
            new THREE.MeshBasicMaterial({
                color: '#a855f7', transparent: true, opacity: 0.15,
                side: THREE.DoubleSide, depthWrite: false
            })
        );
        innerAura.rotation.x = -Math.PI / 2;
        innerAura.position.y = 0.015;
        group.add(innerAura);

        if (!modelData) {
            // Fallback: menacing red cone
            var cone = new THREE.Mesh(
                new THREE.ConeGeometry(0.4, 1.2, 8),
                new THREE.MeshStandardMaterial({
                    color: '#8b0000', emissive: '#cc0000',
                    emissiveIntensity: 1.0, transparent: true, opacity: 0.8
                })
            );
            cone.position.y = 0.6;
            group.add(cone);
        } else {
            var SU = window.SkeletonUtils;
            var modelClone = (SU && SU.clone) ? SU.clone(modelData.scene) : modelData.scene.clone(true);
            var scale = 0.45;
            modelClone.scale.set(scale, scale, scale);
            modelClone.position.y = 0;

            // Dark brown mottled/spotted pattern
            var _spotSeed = 12345;
            function _spotRng() { _spotSeed = ((_spotSeed * 1664525) + 1013904223) & 0x7fffffff; return _spotSeed / 0x7fffffff; }
            var baseColors = ['#3b2214', '#4a2e1a', '#2e1a0e', '#5a3a22', '#332010'];
            var spotColors = ['#1a0e06', '#0f0804', '#261508', '#3d2816'];

            modelClone.traverse(function(node) {
                if (node.isMesh && node.material) {
                    var mat = node.material.clone();
                    // Pick a random dark brown base
                    var baseCol = baseColors[Math.floor(_spotRng() * baseColors.length)];
                    var spotCol = spotColors[Math.floor(_spotRng() * spotColors.length)];
                    // Alternate between base and spot colors for mottled look
                    mat.color = new THREE.Color(_spotRng() > 0.4 ? baseCol : spotCol);
                    mat.emissive = new THREE.Color('#1a0e06');
                    mat.emissiveIntensity = 0.15;
                    mat.roughness = 0.85;
                    mat.metalness = 0.05;
                    mat.transparent = false;
                    mat.opacity = 1.0;
                    mat.depthWrite = true;
                    node.material = mat;
                }
            });
            group.add(modelClone);

            // Glowing amber eyes
            var eyeMat = new THREE.MeshBasicMaterial({
                color: '#ffaa00', transparent: true, opacity: 0.95
            });
            var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
            var eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
            eyeL.position.set(-0.06, scale * 1.65, scale * 0.7);
            eyeR.position.set(0.06, scale * 1.65, scale * 0.7);
            group.add(eyeL);
            group.add(eyeR);

            // Set up AnimationMixer — attack animation
            if (modelData.animations && modelData.animations.length > 0) {
                var mixer = new THREE.AnimationMixer(modelClone);
                var clip = null;
                // Priority: attack/action first
                for (var i = 0; i < modelData.animations.length; i++) {
                    var name = modelData.animations[i].name.toLowerCase();
                    if (name.includes('attack') || name.includes('action') || name.includes('bite') || name.includes('claw')) {
                        clip = modelData.animations[i]; break;
                    }
                }
                if (!clip) clip = modelData.animations[0];

                if (clip) {
                    var action = mixer.clipAction(clip);
                    action.loop = THREE.LoopRepeat;
                    action.timeScale = 0.7;
                    action.play();
                    _dungeonBossPreviewMixers.push(mixer);
                }
            }
        }

        threeScene.add(group);
        boardDecorations.push(group);
        _dungeonBossPreviewGroups.push(group);
    }

    if (typeof _loadDungeonBossGLB !== 'function') {
        BOSS_POSITIONS.forEach(function(pos) { _placePreview(pos, null); });
        return;
    }

    _loadDungeonBossGLB(function(modelData) {
        BOSS_POSITIONS.forEach(function(pos) { _placePreview(pos, modelData); });
    });
}
