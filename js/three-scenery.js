// ============================================================
// LOTA AUTO CHESS — three-scenery.js — Map Beautification
// Adds trees, buildings, statues, and scattered decorations
// ============================================================

// ====================================================================
//  INITIALIZE SCENERY
// ====================================================================

function initScenery() {
    // Wait for GLTFLoader to be ready, then build scenery
    var waitForScenery = function() {
        if (_ensureGLTFLoaderForScenery()) {
            _loadSceneryElements();
            console.log('✓ Scenery initialized');
        } else {
            setTimeout(waitForScenery, 50);
        }
    };
    waitForScenery();
}

function _ensureGLTFLoaderForScenery() {
    if (!threeGLTFLoader) {
        var GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;
        if (typeof GLTFLoaderClass !== 'undefined') {
            return true; // Already initialized by three-environment.js
        }
        return false;
    }
    return true;
}

// ====================================================================
//  LOAD SCENERY ELEMENTS
// ====================================================================

function _loadSceneryElements() {
    var tasks = [];

    // Enchanted map — all vegetation inside the board
    tasks.push(_createBiomeTrees());
    // Dense interior decorations: trees, grass, rocks, center tree ring
    tasks.push(_createDenseInterior());
    // Polytope Studio nature models around the battlefield
    tasks.push(_createPolytopeNature());

    Promise.all(tasks)
        .then(function() {
            console.log('✓ All scenery elements loaded');
        })
        .catch(function(err) {
            console.error('Scenery loading error:', err);
        });
}

// ====================================================================
//  OBJ MODEL LOADER (Ultimate Nature Pack)
// ====================================================================

var _objCache = {};

function _loadOBJModel(name) {
    var basePath = 'models/nature/';
    var key = basePath + name;
    if (_objCache[key]) return Promise.resolve(_objCache[key].clone());

    return new Promise(function(resolve, reject) {
        var OBJLoaderClass = window.OBJLoader;
        var MTLLoaderClass = window.MTLLoader;
        if (!OBJLoaderClass || !MTLLoaderClass) {
            reject(new Error('OBJLoader/MTLLoader not ready'));
            return;
        }
        var mtlLoader = new MTLLoaderClass();
        mtlLoader.setPath(basePath);
        mtlLoader.load(name + '.mtl', function(materials) {
            materials.preload();
            var objLoader = new OBJLoaderClass();
            objLoader.setMaterials(materials);
            objLoader.setPath(basePath);
            objLoader.load(name + '.obj', function(obj) {
                _objCache[key] = obj;
                resolve(obj.clone());
            }, undefined, function(err) { reject(err); });
        }, undefined, function(err) { reject(err); });
    });
}

// ====================================================================
//  ENCHANTED MAP — Mondo glTF + Ultimate Nature OBJ
// ====================================================================

function _createBiomeTrees() {
    // Phase 1: Load Mondo glTF models (trees we already have)
    var mondoP = Promise.all([
        _loadGLBModel('models/mondo/CommonTree_1.gltf'),
        _loadGLBModel('models/mondo/CommonTree_2.gltf'),
        _loadGLBModel('models/mondo/TwistedTree_1.gltf'),
        _loadGLBModel('models/mondo/Pine_1.gltf'),
        _loadGLBModel('models/mondo/Bush_Common_Flowers.gltf'),
        _loadGLBModel('models/mondo/Rock_Medium_1.gltf')
    ]);

    // Phase 2: Load Ultimate Nature OBJ models (wait for loaders)
    var natureP = new Promise(function(resolve) {
        function tryLoad() {
            if (!window.OBJLoader || !window.MTLLoader) {
                setTimeout(tryLoad, 100);
                return;
            }
            Promise.all([
                _loadOBJModel('BirchTree_Autumn_1'),  // 0
                _loadOBJModel('Willow_1'),             // 1
                _loadOBJModel('Rock_Moss_1'),          // 2
                _loadOBJModel('Rock_Moss_3'),          // 3
                _loadOBJModel('BushBerries_1'),        // 4
                _loadOBJModel('Flowers'),              // 5
                _loadOBJModel('Grass_Short'),           // 6
                _loadOBJModel('Plant_1'),               // 7
                _loadOBJModel('TreeStump_Moss'),        // 8
                _loadOBJModel('WoodLog_Moss'),          // 9
                _loadOBJModel('Willow_Autumn_1'),       // 10
                _loadOBJModel('BirchTree_1'),           // 11
                _loadOBJModel('Bush_1'),                // 12
                _loadOBJModel('Grass'),                 // 13
                _loadOBJModel('Plant_3'),               // 14
                _loadOBJModel('Wheat'),                 // 15
                _loadOBJModel('CommonTree_Autumn_1'),   // 16
                _loadOBJModel('PineTree_Autumn_1')      // 17
            ]).then(resolve).catch(function(err) {
                console.warn('Nature OBJ load failed:', err);
                resolve(new Array(18).fill(null));
            });
        }
        tryLoad();
    });

    return Promise.all([mondoP, natureP]).then(function(results) {
        var mondo = results[0];
        var nature = results[1];

        var M = {
            greenTree1: mondo[0], greenTree2: mondo[1],
            autumnTree: mondo[2], pine: mondo[3],
            flowerBush: mondo[4], rockMondo: mondo[5],
            birchAutumn: nature[0], willow: nature[1],
            rockMoss1: nature[2], rockMoss3: nature[3],
            bushBerries: nature[4], flowers: nature[5],
            grassShort: nature[6], plant: nature[7],
            stump: nature[8], woodLog: nature[9],
            willowAutumn: nature[10], birchGreen: nature[11],
            bush: nature[12], grassTall: nature[13],
            plant3: nature[14], wheat: nature[15],
            commonAutumn: nature[16], pineAutumn: nature[17]
        };

        var Y = TILE_Y * 2;

        function put(model, x, z, s, ry) {
            if (!model) return;
            var obj = model.clone();
            obj.position.set(x * TILE_UNIT, Y, z * TILE_UNIT);
            obj.scale.set(s, s, s);
            obj.rotation.y = ry !== undefined ? ry : Math.random() * Math.PI * 2;
            threeEnvironmentGroup.add(obj);
        }

        // ═══════════════════════════════════════════════════════════
        //  WEST — Palude (lush, swampy, willows + undergrowth)
        // ═══════════════════════════════════════════════════════════
        put(M.willow,       4,  12, 0.6);
        put(M.willowAutumn, 3,  22, 0.55);
        put(M.greenTree1,   5,  33, 0.65);
        put(M.willow,       4,  44, 0.55);
        put(M.birchGreen,   5,  54, 0.5);
        put(M.bushBerries,  6,  18, 0.45);
        put(M.bush,         7,  28, 0.4);
        put(M.plant,        7,  38, 0.55);
        put(M.plant3,       6,  50, 0.45);
        put(M.grassTall,    5,  16, 0.45);
        put(M.grassShort,   6,  35, 0.4);
        put(M.grassTall,    5,  48, 0.4);
        put(M.flowers,      8,  26, 0.35);
        put(M.flowers,      7,  42, 0.3);
        put(M.woodLog,      8,  52, 0.35);

        // ═══════════════════════════════════════════════════════════
        //  EAST — Tundra (pines, birches, rocks, sparse)
        // ═══════════════════════════════════════════════════════════
        put(M.pine,         61, 12, 0.6);
        put(M.pineAutumn,   62, 24, 0.55);
        put(M.birchAutumn,  60, 33, 0.55);
        put(M.pine,         61, 44, 0.55);
        put(M.pineAutumn,   60, 55, 0.5);
        put(M.rockMoss1,    59, 18, 0.4);
        put(M.rockMoss3,    58, 38, 0.35);
        put(M.rockMondo,    60, 50, 0.3);
        put(M.bush,         59, 28, 0.35);
        put(M.grassShort,   60, 15, 0.4);
        put(M.grassShort,   59, 42, 0.35);
        put(M.plant,        58, 22, 0.4);
        put(M.stump,        57, 48, 0.4);

        // ═══════════════════════════════════════════════════════════
        //  NORTH — Vulcano (autumn foliage, warm tones, rocks)
        // ═══════════════════════════════════════════════════════════
        put(M.commonAutumn,  22, 4, 0.6);
        put(M.birchAutumn,   34, 3, 0.55);
        put(M.autumnTree,    45, 5, 0.6);
        put(M.pineAutumn,    55, 6, 0.5);
        put(M.rockMoss3,     28, 6, 0.35);
        put(M.rockMoss1,     40, 4, 0.3);
        put(M.stump,         50, 5, 0.45);
        put(M.woodLog,       36, 3, 0.4);
        put(M.bush,          25, 7, 0.35);
        put(M.grassShort,    32, 5, 0.35);
        put(M.wheat,         48, 7, 0.4);
        put(M.plant3,        20, 6, 0.4);

        // ═══════════════════════════════════════════════════════════
        //  SOUTH — Oceano (green, tropical feel, flowers)
        // ═══════════════════════════════════════════════════════════
        put(M.greenTree2,    18, 61, 0.65);
        put(M.greenTree1,    32, 60, 0.6);
        put(M.birchGreen,    46, 61, 0.55);
        put(M.greenTree2,    56, 59, 0.5);
        put(M.flowerBush,    25, 59, 0.4);
        put(M.flowerBush,    42, 60, 0.35);
        put(M.bushBerries,   52, 60, 0.4);
        put(M.flowers,       30, 61, 0.4);
        put(M.flowers,       48, 59, 0.35);
        put(M.grassShort,    22, 60, 0.35);
        put(M.grassTall,     38, 61, 0.4);
        put(M.plant,         55, 58, 0.4);

        // ═══════════════════════════════════════════════════════════
        //  BIOME BOUNDARIES (diagonal transition lines)
        // ═══════════════════════════════════════════════════════════
        // NW diagonal (r≈c, from corner to center)
        put(M.birchAutumn,   12, 11, 0.55);
        put(M.rockMondo,     8,  8,  0.3);
        put(M.grassShort,    10, 13, 0.3);
        put(M.flowers,       14, 16, 0.25);
        put(M.bush,          17, 19, 0.3);
        // NE diagonal
        put(M.autumnTree,    54, 11, 0.55);
        put(M.plant,         56, 9,  0.4);
        put(M.rockMoss1,     52, 14, 0.25);
        put(M.grassShort,    50, 17, 0.3);
        put(M.wheat,         48, 20, 0.3);
        // SW diagonal
        put(M.willow,        11, 55, 0.5);
        put(M.flowers,       9,  52, 0.35);
        put(M.plant3,        13, 50, 0.35);
        put(M.grassTall,     16, 48, 0.3);
        put(M.bushBerries,   18, 46, 0.3);
        // SE diagonal
        put(M.birchAutumn,   55, 55, 0.5);
        put(M.rockMoss1,     57, 53, 0.25);
        put(M.grassShort,    53, 52, 0.3);
        put(M.flowers,       50, 49, 0.25);
        put(M.bush,          48, 47, 0.3);

        // ═══════════════════════════════════════════════════════════
        //  DEEP INTERIOR (scattered through mid-biome areas)
        // ═══════════════════════════════════════════════════════════
        // Palude interior (west half)
        put(M.grassTall,  12, 28, 0.3);
        put(M.flowers,    15, 35, 0.25);
        put(M.plant,      10, 42, 0.35);
        put(M.grassShort, 14, 22, 0.25);
        put(M.bush,       12, 46, 0.25);
        // Tundra interior (east half)
        put(M.grassShort, 52, 25, 0.25);
        put(M.rockMondo,  55, 32, 0.2);
        put(M.plant3,     53, 40, 0.3);
        put(M.grassShort, 50, 48, 0.25);
        put(M.stump,      54, 20, 0.3);
        // Vulcano interior (top half)
        put(M.grassShort, 28, 12, 0.25);
        put(M.wheat,      35, 10, 0.3);
        put(M.rockMoss3,  42, 12, 0.2);
        put(M.plant,      22, 14, 0.3);
        put(M.woodLog,    48, 10, 0.3);
        // Oceano interior (bottom half)
        put(M.flowers,    25, 52, 0.25);
        put(M.grassTall,  35, 54, 0.3);
        put(M.flowerBush, 42, 52, 0.25);
        put(M.plant3,     50, 55, 0.3);
        put(M.grassShort, 30, 55, 0.25);

        console.log('✓ Enchanted map placed (~110 objects)');
    }).catch(function(err) {
        console.warn('Enchanted map failed:', err);
    });
}

// ====================================================================
//  DENSE INTERIOR — trees, grass tufts, rocks, center tree ring
// ====================================================================

function _createDenseInterior() {
    var mondoP = Promise.all([
        _loadGLBModel('models/mondo/CommonTree_1.gltf'),      // 0
        _loadGLBModel('models/mondo/CommonTree_2.gltf'),      // 1
        _loadGLBModel('models/mondo/CommonTree_3.gltf'),      // 2
        _loadGLBModel('models/mondo/Pine_1.gltf'),            // 3
        _loadGLBModel('models/mondo/Pine_2.gltf'),            // 4
        _loadGLBModel('models/mondo/Grass_Common_Short.gltf'),// 5
        _loadGLBModel('models/mondo/Grass_Common_Tall.gltf'), // 6
        _loadGLBModel('models/mondo/Rock_Medium_1.gltf'),     // 7
        _loadGLBModel('models/mondo/Rock_Medium_2.gltf'),     // 8
        _loadGLBModel('models/mondo/Rock_Medium_3.gltf'),     // 9
        _loadGLBModel('models/mondo/Bush_Common.gltf'),       // 10
        _loadGLBModel('models/mondo/Bush_Common_Flowers.gltf'),// 11
        _loadGLBModel('models/mondo/Pebble_Round_1.gltf'),    // 12
        _loadGLBModel('models/mondo/Pebble_Round_2.gltf'),    // 13
        _loadGLBModel('models/mondo/Fern_1.gltf'),            // 14
        _loadGLBModel('models/mondo/TwistedTree_1.gltf'),     // 15
        _loadGLBModel('models/mondo/TwistedTree_2.gltf')      // 16
    ]);

    var natureP = new Promise(function(resolve) {
        function tryLoad() {
            if (!window.OBJLoader || !window.MTLLoader) {
                setTimeout(tryLoad, 100);
                return;
            }
            Promise.all([
                _loadOBJModel('Rock_1'),          // 0
                _loadOBJModel('Rock_5'),           // 1
                _loadOBJModel('Rock_Moss_1'),      // 2
                _loadOBJModel('Grass_Short'),       // 3
                _loadOBJModel('Grass'),             // 4
                _loadOBJModel('Bush_1'),            // 5
                _loadOBJModel('Flowers'),           // 6
                _loadOBJModel('Plant_1'),           // 7
                _loadOBJModel('Plant_3')            // 8
            ]).then(resolve).catch(function(err) {
                console.warn('Dense interior nature OBJ failed:', err);
                resolve(new Array(9).fill(null));
            });
        }
        tryLoad();
    });

    return Promise.all([mondoP, natureP]).then(function(results) {
        var m = results[0];
        var n = results[1];

        var Y = TILE_Y * 2;
        var CX = BOARD_COLS / 2;   // 33
        var CZ = BOARD_ROWS / 2;   // 33
        var CR = CENTER_CONTROL_RADIUS; // 9

        // Trees array for variety
        var trees = [m[0], m[1], m[2], m[3], m[4], m[15], m[16]];
        var grasses = [m[5], m[6], n[3], n[4]];
        var rocks = [m[7], m[8], m[9], n[0], n[1], n[2]];
        var bushes = [m[10], m[11], n[5]];
        var smalls = [m[12], m[13], m[14], n[6], n[7], n[8]]; // pebbles, ferns, flowers, plants

        function pick(arr) {
            var valid = [];
            for (var i = 0; i < arr.length; i++) { if (arr[i]) valid.push(arr[i]); }
            return valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : null;
        }

        function put(model, c, r, s, ry) {
            if (!model) return;
            if (!isInsideOctagon(Math.floor(r), Math.floor(c))) return;
            var obj = model.clone();
            obj.position.set(c * TILE_UNIT, Y, r * TILE_UNIT);
            obj.scale.set(s, s, s);
            obj.rotation.y = ry !== undefined ? ry : Math.random() * Math.PI * 2;
            threeEnvironmentGroup.add(obj);
        }

        // Seeded random for reproducibility
        var _seed = 42;
        function srand() { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed & 0x7fffffff) / 2147483647; }

        // ═══════════════════════════════════════════════════════════
        //  TREE RING around center golden circle (radius ~11-13)
        // ═══════════════════════════════════════════════════════════
        var ringR = CR + 2.5; // just outside the golden circle
        var treeCount = 16;
        for (var ti = 0; ti < treeCount; ti++) {
            var angle = (ti / treeCount) * Math.PI * 2 + srand() * 0.15;
            var dist = ringR + srand() * 1.5;
            var tx = CX + Math.cos(angle) * dist;
            var tz = CZ + Math.sin(angle) * dist;
            var treeScale = 0.45 + srand() * 0.25;
            put(pick(trees), tx, tz, treeScale);
        }
        // Fill gaps with bushes between trees
        for (var bi = 0; bi < 12; bi++) {
            var ba = (bi / 12) * Math.PI * 2 + srand() * 0.2;
            var bd = ringR + srand() * 1.0 - 0.3;
            put(pick(bushes), CX + Math.cos(ba) * bd, CZ + Math.sin(ba) * bd, 0.3 + srand() * 0.15);
        }

        // ═══════════════════════════════════════════════════════════
        //  SCATTERED TREES throughout the map (avoid center + edges)
        // ═══════════════════════════════════════════════════════════
        var scatteredTrees = 40;
        var placed = 0;
        var attempts = 0;
        while (placed < scatteredTrees && attempts < 300) {
            attempts++;
            var sc = 3 + srand() * (BOARD_COLS - 6);
            var sr = 3 + srand() * (BOARD_ROWS - 6);
            var dc = sc - CX, dr = sr - CZ;
            var distC = Math.sqrt(dc * dc + dr * dr);
            // Avoid center ring area and deploy zones (corners)
            if (distC < CR + 5) continue;
            if (!isInsideOctagon(Math.floor(sr), Math.floor(sc))) continue;
            put(pick(trees), sc, sr, 0.35 + srand() * 0.35);
            placed++;
        }

        // ═══════════════════════════════════════════════════════════
        //  GRASS TUFTS (lots of them, small, spread everywhere)
        // ═══════════════════════════════════════════════════════════
        var grassCount = 80;
        placed = 0; attempts = 0;
        while (placed < grassCount && attempts < 400) {
            attempts++;
            var gc = 2 + srand() * (BOARD_COLS - 4);
            var gr = 2 + srand() * (BOARD_ROWS - 4);
            if (!isInsideOctagon(Math.floor(gr), Math.floor(gc))) continue;
            var gdist = Math.sqrt((gc - CX) * (gc - CX) + (gr - CZ) * (gr - CZ));
            if (gdist < CR - 1) continue; // keep center zone clear
            put(pick(grasses), gc, gr, 0.15 + srand() * 0.25);
            placed++;
        }

        // ═══════════════════════════════════════════════════════════
        //  ROCKS & BOULDERS (big ones sparse, small pebbles frequent)
        // ═══════════════════════════════════════════════════════════
        // Big rocks
        var bigRockCount = 15;
        placed = 0; attempts = 0;
        while (placed < bigRockCount && attempts < 200) {
            attempts++;
            var rc = 4 + srand() * (BOARD_COLS - 8);
            var rr = 4 + srand() * (BOARD_ROWS - 8);
            var rdist = Math.sqrt((rc - CX) * (rc - CX) + (rr - CZ) * (rr - CZ));
            if (rdist < CR + 3) continue;
            if (!isInsideOctagon(Math.floor(rr), Math.floor(rc))) continue;
            put(pick(rocks), rc, rr, 0.25 + srand() * 0.3);
            placed++;
        }
        // Small pebbles
        var pebbleCount = 30;
        placed = 0; attempts = 0;
        while (placed < pebbleCount && attempts < 200) {
            attempts++;
            var pc = 2 + srand() * (BOARD_COLS - 4);
            var pr = 2 + srand() * (BOARD_ROWS - 4);
            if (!isInsideOctagon(Math.floor(pr), Math.floor(pc))) continue;
            var pdist = Math.sqrt((pc - CX) * (pc - CX) + (pr - CZ) * (pr - CZ));
            if (pdist < CR - 1) continue;
            put(pick(smalls), pc, pr, 0.1 + srand() * 0.15);
            placed++;
        }

        // ═══════════════════════════════════════════════════════════
        //  BUSHES scattered mid-map
        // ═══════════════════════════════════════════════════════════
        var bushCount = 25;
        placed = 0; attempts = 0;
        while (placed < bushCount && attempts < 200) {
            attempts++;
            var bc = 4 + srand() * (BOARD_COLS - 8);
            var br = 4 + srand() * (BOARD_ROWS - 8);
            var bdist = Math.sqrt((bc - CX) * (bc - CX) + (br - CZ) * (br - CZ));
            if (bdist < CR + 2) continue;
            if (!isInsideOctagon(Math.floor(br), Math.floor(bc))) continue;
            put(pick(bushes), bc, br, 0.2 + srand() * 0.2);
            placed++;
        }

        // ═══════════════════════════════════════════════════════════
        //  SMALL DETAILS: ferns, flowers, plants near trees/rocks
        // ═══════════════════════════════════════════════════════════
        var detailCount = 40;
        placed = 0; attempts = 0;
        while (placed < detailCount && attempts < 300) {
            attempts++;
            var dc2 = 3 + srand() * (BOARD_COLS - 6);
            var dr2 = 3 + srand() * (BOARD_ROWS - 6);
            if (!isInsideOctagon(Math.floor(dr2), Math.floor(dc2))) continue;
            var ddist = Math.sqrt((dc2 - CX) * (dc2 - CX) + (dr2 - CZ) * (dr2 - CZ));
            if (ddist < CR - 1) continue;
            put(pick(smalls), dc2, dr2, 0.12 + srand() * 0.18);
            placed++;
        }

        console.log('✓ Dense interior placed (~250 objects + center tree ring)');
    }).catch(function(err) {
        console.warn('Dense interior failed:', err);
    });
}

// ====================================================================
//  INNER BOARD NATURE (small decorations inside the playable map)
// ====================================================================

function _createInnerBoardNature() {
    return Promise.all([
        _loadGLBModel('models/mondo/Grass_Common_Short.gltf'),
        _loadGLBModel('models/mondo/Flower_3_Group.gltf'),
        _loadGLBModel('models/mondo/Pebble_Round_1.gltf'),
        _loadGLBModel('models/mondo/Mushroom_Common.gltf'),
        _loadGLBModel('models/mondo/Fern_1.gltf'),
        _loadGLBModel('models/mondo/Bush_Common.gltf')
    ]).then(function(models) {
        var grass    = models[0];
        var flower   = models[1];
        var pebble   = models[2];
        var mushroom = models[3];
        var fern     = models[4];
        var bush     = models[5];

        var Y = TILE_Y * 2;
        var CX = BOARD_COLS / 2;  // 33
        var CZ = BOARD_ROWS / 2;  // 33

        function put(model, c, r, s) {
            // Skip if too close to center (bonus zone) or outside octagon
            var dc = c - CX, dr = r - CZ;
            if (Math.sqrt(dc*dc + dr*dr) < 5) return;  // avoid center zone
            if (!isInsideOctagon(Math.floor(r), Math.floor(c))) return;
            var obj = model.clone();
            obj.position.set(c * TILE_UNIT, Y, r * TILE_UNIT);
            obj.scale.set(s, s, s);
            obj.rotation.y = Math.random() * Math.PI * 2;
            threeEnvironmentGroup.add(obj);
        }

        // ── GRASS patches along biome boundaries (diagonal lines) ──
        // Along NW-SE diagonal (r = c line)
        put(grass, 10, 10, 0.25);  put(grass, 15, 15, 0.2);
        put(grass, 50, 50, 0.25);  put(grass, 55, 55, 0.2);
        // Along NE-SW diagonal (r = 66-c line)
        put(grass, 55, 10, 0.22);  put(grass, 50, 15, 0.2);
        put(grass, 10, 55, 0.22);  put(grass, 15, 50, 0.2);

        // ── FLOWERS near octagon edges (inner ring) ──
        put(flower, 20, 3, 0.18);   // N edge
        put(flower, 45, 3, 0.15);
        put(flower, 3, 25, 0.18);   // W edge
        put(flower, 3, 45, 0.15);
        put(flower, 62, 20, 0.17);  // E edge
        put(flower, 62, 48, 0.15);
        put(flower, 22, 62, 0.18);  // S edge
        put(flower, 48, 62, 0.15);

        // ── PEBBLES scattered mid-biome ──
        put(pebble, 12, 25, 0.15);
        put(pebble, 52, 22, 0.18);
        put(pebble, 25, 52, 0.15);
        put(pebble, 42, 55, 0.17);

        // ── MUSHROOMS in shady areas (near biome transitions) ──
        put(mushroom, 18, 18, 0.15);
        put(mushroom, 48, 48, 0.15);

        // ── FERNS in palude/oceano zones ──
        put(fern, 8, 30, 0.2);
        put(fern, 8, 40, 0.18);
        put(fern, 30, 58, 0.2);

        // ── SMALL BUSHES at biome corners ──
        put(bush, 12, 8, 0.2);
        put(bush, 55, 8, 0.18);
        put(bush, 8, 55, 0.2);
        put(bush, 55, 58, 0.18);

        console.log('✓ Inner board nature placed (~30 objects)');
    }).catch(function(err) {
        console.warn('Inner board nature failed:', err);
    });
}

// ====================================================================
//  PERIMETER BUILDINGS (wood structures — legacy, not called)
// ====================================================================

function _createPerimeterBuildings() {
    return new Promise(function(resolve) {
        Promise.all([
            _loadGLBModel('models/kenney/wood-structure.glb'),
            _loadGLBModel('models/kenney/wood-support.glb'),
            _loadGLBModel('models/kenney/barrel.glb')
        ]).then(function(models) {
            var woodStructure = models[0];
            var woodSupport = models[1];
            var barrel = models[2];

            var buildingPos = [
                // Northwest corner
                { x: -4, z: -4, model: woodStructure, scale: 1.2 },
                { x: -3, z: -5, model: woodSupport, scale: 0.9 },
                { x: -5, z: -3, model: barrel, scale: 0.7 },
                // Northeast corner
                { x: BOARD_COLS + 4, z: -4, model: woodStructure, scale: 1.2 },
                { x: BOARD_COLS + 3, z: -5, model: woodSupport, scale: 0.9 },
                { x: BOARD_COLS + 5, z: -3, model: barrel, scale: 0.7 },
                // Southwest corner
                { x: -4, z: BOARD_ROWS + 4, model: woodStructure, scale: 1.2 },
                { x: -3, z: BOARD_ROWS + 5, model: woodSupport, scale: 0.9 },
                { x: -5, z: BOARD_ROWS + 5, model: barrel, scale: 0.7 },
                // Southeast corner
                { x: BOARD_COLS + 4, z: BOARD_ROWS + 4, model: woodStructure, scale: 1.2 },
                { x: BOARD_COLS + 3, z: BOARD_ROWS + 5, model: woodSupport, scale: 0.9 },
                { x: BOARD_COLS + 5, z: BOARD_ROWS + 5, model: barrel, scale: 0.7 }
            ];

            buildingPos.forEach(function(bpos) {
                var building = bpos.model.clone();
                building.position.set(bpos.x * TILE_UNIT, TILE_Y, bpos.z * TILE_UNIT);
                building.scale.set(bpos.scale, bpos.scale, bpos.scale);
                building.rotation.y = Math.random() * Math.PI * 2;
                building.castShadow = true;
                threeEnvironmentGroup.add(building);
            });

            resolve();
        });
    });
}

// ====================================================================
//  GATE STATUES (column + emissive sphere)
// ====================================================================

function _createGateStatues() {
    return new Promise(function(resolve) {
        _loadGLBModel('models/kenney/column.glb').then(function(colModel) {
            var statuePositions = [
                // North gate (Player 1 team - blue)
                { x: BOARD_CX - 2.5, z: -2.5, rot: 0, playerIdx: 0 },
                { x: BOARD_CX + 2.5, z: -2.5, rot: 0, playerIdx: 0 },
                // South gate (Player 3 team - green)
                { x: BOARD_CX - 2.5, z: BOARD_ROWS * TILE_UNIT + 2.5, rot: Math.PI, playerIdx: 2 },
                { x: BOARD_CX + 2.5, z: BOARD_ROWS * TILE_UNIT + 2.5, rot: Math.PI, playerIdx: 2 },
                // West gate (Player 2 team - red)
                { x: -2.5, z: BOARD_CZ - 2.5, rot: Math.PI / 2, playerIdx: 1 },
                { x: -2.5, z: BOARD_CZ + 2.5, rot: Math.PI / 2, playerIdx: 1 },
                // East gate (Player 4 team - orange)
                { x: BOARD_COLS * TILE_UNIT + 2.5, z: BOARD_CZ - 2.5, rot: -Math.PI / 2, playerIdx: 3 },
                { x: BOARD_COLS * TILE_UNIT + 2.5, z: BOARD_CZ + 2.5, rot: -Math.PI / 2, playerIdx: 3 }
            ];

            statuePositions.forEach(function(spos) {
                var col = colModel.clone();
                col.position.set(spos.x, TILE_Y, spos.z);
                col.rotation.y = spos.rot;
                col.scale.set(0.8, 1.0, 0.8);
                threeEnvironmentGroup.add(col);

                // Top decoration: emissive sphere (team color)
                var tc = TEAM_COLORS[spos.playerIdx];
                var sphereGeo = new THREE.SphereGeometry(0.25, 8, 8);
                var sphereMat = new THREE.MeshBasicMaterial({ color: tc.primary });
                var sphere = new THREE.Mesh(sphereGeo, sphereMat);
                sphere.position.set(spos.x, TILE_Y + 1.2, spos.z);
                threeEnvironmentGroup.add(sphere);
            });

            resolve();
        });
    });
}

// ====================================================================
//  SCATTERED GROUND DECORATIONS (Mondo + Kenney mix)
// ====================================================================

function _scatterGroundDecor() {
    // Just a few rocks at the 4 corners — lightweight
    return _loadGLBModel('models/mondo/Rock_Medium_1.gltf').then(function(rockModel) {
        var TILE_TOP = TILE_Y * 2;
        var positions = [
            { x: -3, z: -3 },
            { x: BOARD_COLS + 3, z: -3 },
            { x: -3, z: BOARD_ROWS + 3 },
            { x: BOARD_COLS + 3, z: BOARD_ROWS + 3 },
            { x: -4, z: Math.floor(BOARD_ROWS / 2) },
            { x: BOARD_COLS + 4, z: Math.floor(BOARD_ROWS / 2) },
            { x: Math.floor(BOARD_COLS / 2), z: -4 },
            { x: Math.floor(BOARD_COLS / 2), z: BOARD_ROWS + 4 }
        ];
        positions.forEach(function(pos) {
            var obj = rockModel.clone();
            obj.position.set(pos.x * TILE_UNIT, TILE_TOP, pos.z * TILE_UNIT);
            obj.scale.set(0.3, 0.3, 0.3);
            obj.rotation.y = Math.random() * Math.PI * 2;
            obj.castShadow = true;
            threeEnvironmentGroup.add(obj);
        });
        console.log('✓ Ground rocks placed (8 total)');
    }).catch(function(err) {
        console.warn('Ground decor failed:', err);
    });
}

// ====================================================================
//  POLYTOPE STUDIO NATURE — high-quality models around battlefield
// ====================================================================

function _createPolytopeNature() {
    var basePath = 'models/nature/';
    var cx = BOARD_CX;
    var cz = BOARD_CZ;
    var boardRadius = BOARD_ROWS * TILE_UNIT * 0.5;

    // Model definitions: [file, count, minDist, maxDist, scaleMin, scaleMax, yOffset]
    var models = [
        { file: 'SM_Fruit_Tree_01_green.glb', count: 14, minR: boardRadius + 2, maxR: boardRadius + 18, sMin: 0.25, sMax: 0.4, y: 0 },
        { file: 'SM_Pine_Tree_03_green.glb',  count: 12, minR: boardRadius + 3, maxR: boardRadius + 20, sMin: 0.2, sMax: 0.35, y: 0 },
        { file: 'SM_Fruit_Tree_01_apples.glb', count: 6, minR: boardRadius + 4, maxR: boardRadius + 15, sMin: 0.25, sMax: 0.35, y: 0 },
        { file: 'SM_Fruit_Tree_01_stump.glb',  count: 5, minR: boardRadius + 2, maxR: boardRadius + 12, sMin: 0.3, sMax: 0.5, y: 0 },
        { file: 'SM_Generic_Rock_01.glb',      count: 12, minR: boardRadius + 1, maxR: boardRadius + 16, sMin: 0.4, sMax: 0.8, y: 0 },
        { file: 'SM_Menhir_Rock_02.glb',       count: 4,  minR: boardRadius + 5, maxR: boardRadius + 18, sMin: 0.3, sMax: 0.5, y: 0 },
        { file: 'SM_River_Rock_Pile_02.glb',   count: 8,  minR: boardRadius + 1, maxR: boardRadius + 14, sMin: 0.5, sMax: 0.9, y: 0 },
        { file: 'SM_Ore_Rock_01.glb',          count: 4,  minR: boardRadius + 6, maxR: boardRadius + 20, sMin: 0.3, sMax: 0.5, y: 0 },
        { file: 'SM_Generic_Shrub_01_green.glb', count: 18, minR: boardRadius + 1, maxR: boardRadius + 15, sMin: 0.3, sMax: 0.6, y: 0 },
        { file: 'SM_Grass_02.glb',             count: 30, minR: boardRadius + 0.5, maxR: boardRadius + 12, sMin: 0.4, sMax: 0.8, y: 0 },
        { file: 'SM_Poppy_02.glb',             count: 15, minR: boardRadius + 1, maxR: boardRadius + 10, sMin: 0.5, sMax: 0.9, y: 0 },
        { file: 'SM_Caesars_Mushroom_01.glb',  count: 8,  minR: boardRadius + 1, maxR: boardRadius + 8, sMin: 0.5, sMax: 1.0, y: 0 }
    ];

    var loadPromises = models.map(function(def) {
        return _loadGLBModel(basePath + def.file).then(function(template) {
            // Normalize template size
            var box = new THREE.Box3().setFromObject(template);
            var size = new THREE.Vector3();
            box.getSize(size);
            var maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) template.scale.multiplyScalar(1.0 / maxDim);
            // Re-center
            box.setFromObject(template);
            var center = new THREE.Vector3();
            box.getCenter(center);
            template.position.sub(center);
            template.position.y = -box.min.y;

            // Enhance materials + fix alpha + enable shadows
            template.traverse(function(ch) {
                if (ch.isMesh) {
                    ch.castShadow = true;
                    ch.receiveShadow = true;
                    if (ch.material) {
                        // Fix invisible foliage (alpha=0 from Unreal export)
                        if (ch.material.opacity < 0.1) ch.material.opacity = 1.0;
                        if (ch.material.color) {
                            var c = ch.material.color;
                            if (c.r < 0.05 && c.g < 0.05 && c.b < 0.05) {
                                // Black fallback = missing texture, give natural color
                                ch.material.color.setHex(0x5a8a3a);
                            }
                        }
                        // Foliage: enable alpha test for leaf cutouts
                        if (ch.material.map && ch.material.transparent) {
                            ch.material.alphaTest = 0.3;
                            ch.material.side = THREE.DoubleSide;
                            ch.material.depthWrite = true;
                        }
                        // Better PBR values for nature
                        if (ch.material.metalness > 0.3) ch.material.metalness = 0.05;
                        ch.material.roughness = Math.max(ch.material.roughness, 0.5);
                    }
                }
            });

            // Place instances around the board
            for (var i = 0; i < def.count; i++) {
                var angle = Math.random() * Math.PI * 2;
                var dist = def.minR + Math.random() * (def.maxR - def.minR);
                var px = cx + Math.cos(angle) * dist;
                var pz = cz + Math.sin(angle) * dist;
                var scale = def.sMin + Math.random() * (def.sMax - def.sMin);

                var instance = template.clone();
                instance.scale.multiplyScalar(scale);
                instance.position.set(px, def.y, pz);
                instance.rotation.y = Math.random() * Math.PI * 2;
                threeScene.add(instance);
            }

            console.log('🌿 Placed ' + def.count + 'x ' + def.file);
        }).catch(function(err) {
            console.warn('⚠️  Failed to load ' + def.file + ':', err.message || err);
        });
    });

    return Promise.all(loadPromises);
}

// ====================================================================
//  EXPORT
// ====================================================================

// Call this in game initialization
// Typically called after initThreeEnvironment() in game.js
