// ============================================================
// LOTA AUTO CHESS — three-buildings.js — 3D Building Models + Animations
// ============================================================

var _buildings3D = {};   // key: buildingId → { group, defId, row, col, ownerIdx, animData }

// ── GLB cache + loader for building models ──
var _buildingGLBCache   = {};
var _buildingGLBLoading = {};

// Target height for buildings on the grid (world units)
var _BUILDING_TARGET_H = 0.7;

function _loadBuildingGLB(defId, callback) {
    if (_buildingGLBCache[defId]) { callback(_buildingGLBCache[defId]); return; }
    if (_buildingGLBLoading[defId]) { _buildingGLBLoading[defId].push(callback); return; }
    _buildingGLBLoading[defId] = [callback];

    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) {
        setTimeout(function() { _loadBuildingGLB(defId, callback); }, 100);
        return;
    }

    var loader = new GLTFLoaderClass();
    loader.load('models/buildings/' + defId + '.glb',
        function(gltf) {
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());
            var cache = {
                scene: gltf.scene,
                naturalHeight: size.y,
                naturalMinY: bbox.min.y
            };
            _buildingGLBCache[defId] = cache;
            var cbs = _buildingGLBLoading[defId] || [];
            cbs.forEach(function(cb) { cb(cache); });
            delete _buildingGLBLoading[defId];
        },
        null,
        function(err) {
            console.warn('⚠ Building GLB not found: ' + defId + ', falling back to procedural', err);
            var cbs = _buildingGLBLoading[defId] || [];
            cbs.forEach(function(cb) { cb(null); });
            delete _buildingGLBLoading[defId];
        }
    );
}

// ---- Spawn a building model on the board ----
function spawnBuilding3D(defId, row, col, ownerIdx, buildingId) {
    if (!threeScene) return;
    var key = buildingId || (defId + '_' + row + '_' + col);
    if (_buildings3D[key]) return; // already exists

    // Try loading GLB first, fallback to procedural
    _loadBuildingGLB(defId, function(cache) {
        if (_buildings3D[key]) return; // placed while loading

        var group;
        if (cache) {
            group = _buildFromGLB(cache, defId, ownerIdx);
        } else {
            group = _buildBuildingModel(defId, ownerIdx);
        }
        if (!group) return;

        var wp = cellToWorld(row, col);
        group.position.copy(wp);
        group.position.y = 0;
        threeScene.add(group);

        _buildings3D[key] = {
            group: group,
            defId: defId,
            row: row, col: col,
            ownerIdx: ownerIdx,
            anim: {},
            age: 0
        };
    });
}

// ── Build group from loaded GLB + animated decorations ──
function _buildFromGLB(cache, defId, ownerIdx) {
    var g = new THREE.Group();

    // Clone the loaded scene with separate materials
    var model = cache.scene.clone();
    model.traverse(function(child) {
        if (child.isMesh && child.material) {
            child.material = child.material.clone();
        }
    });

    // Scale to target height
    var s = _BUILDING_TARGET_H / (cache.naturalHeight || 1);
    model.scale.set(s, s, s);

    // Offset so bottom sits at y=0
    model.position.y = -(cache.naturalMinY || 0) * s;

    g.add(model);

    // Owner team base ring
    var oc = _ownerColor(ownerIdx);
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.025, 6, 20),
        _BMAT(oc, { emissive: oc, ei: 0.5, rough: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    // Add animated decorations per building type
    _addBuildingDecorations(g, defId, ownerIdx);

    return g;
}

// ── Animated decorations added on top of GLB models ──
function _addBuildingDecorations(g, defId, ownerIdx) {
    var oc = _ownerColor(ownerIdx);
    var def = typeof BUILDINGS !== 'undefined' ? BUILDINGS[defId] : null;
    var lightColor = def ? def.color : '#ffffff';

    switch (defId) {
        case 'zecca': {
            // Spinning gold coin above the mill
            var coin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.10, 0.10, 0.02, 12),
                _BMAT('#fbbf24', { emissive: '#fbbf24', ei: 0.6, rough: 0.3, metal: 0.9 })
            );
            coin.position.y = _BUILDING_TARGET_H + 0.12;
            coin.name = 'spinning_coin';
            g.add(coin);
            var light = new THREE.Group(/*PERF-removed*/'#fbbf24', 1.8, 2.5);
            light.position.y = _BUILDING_TARGET_H + 0.1;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'caserma': {
            // Flag on top
            var pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4),
                _BMAT('#9ca3af', { rough: 0.4, metal: 0.5 })
            );
            pole.position.y = _BUILDING_TARGET_H + 0.12;
            g.add(pole);
            var flag = new THREE.Mesh(
                new THREE.PlaneGeometry(0.18, 0.12),
                _BMAT(oc, { emissive: oc, ei: 0.4, rough: 0.7, double: true })
            );
            flag.position.set(0.09, _BUILDING_TARGET_H + 0.18, 0);
            flag.name = 'bld_flag';
            g.add(flag);
            var light = new THREE.Group(/*PERF-removed*/'#ef4444', 1.4, 2.5);
            light.position.y = _BUILDING_TARGET_H * 0.7;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'altare': {
            // Crystal floating above the gazebo
            var crystal = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.08),
                _BMAT('#c084fc', { emissive: '#a855f7', ei: 0.7, rough: 0.2, metal: 0.1 })
            );
            crystal.position.y = _BUILDING_TARGET_H + 0.15;
            crystal.name = 'bld_crystal';
            g.add(crystal);
            var aRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.16, 0.015, 8, 24),
                _BMAT('#e879f9', { emissive: '#c026d3', ei: 0.8, rough: 0.2 })
            );
            aRing.position.y = _BUILDING_TARGET_H + 0.15;
            aRing.name = 'bld_ring';
            g.add(aRing);
            var light = new THREE.Group(/*PERF-removed*/'#c084fc', 2.2, 3.0);
            light.position.y = _BUILDING_TARGET_H + 0.15;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'torreArcana': {
            // Glowing orb at top of the tower
            var orb = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 10, 10),
                _BMAT('#60a5fa', { emissive: '#3b82f6', ei: 0.8, rough: 0.1 })
            );
            orb.position.y = _BUILDING_TARGET_H + 0.08;
            orb.name = 'bld_orb';
            g.add(orb);
            // 3 orbiting crystals
            var orbColors = ['#60a5fa', '#93c5fd', '#bfdbfe'];
            for (var i = 0; i < 3; i++) {
                var oc2 = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.04),
                    _BMAT(orbColors[i], { emissive: '#3b82f6', ei: 0.6, rough: 0.2 })
                );
                var ang = (Math.PI * 2 / 3) * i;
                oc2.position.set(Math.cos(ang) * 0.22, _BUILDING_TARGET_H * 0.85, Math.sin(ang) * 0.22);
                oc2.name = 'bld_orbit_' + i;
                g.add(oc2);
            }
            var light = new THREE.Group(/*PERF-removed*/'#3b82f6', 2.8, 4.0);
            light.position.y = _BUILDING_TARGET_H + 0.06;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'fucina': {
            // Fire glow from the forge
            var fire = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.16, 8),
                _BMAT('#fb923c', { emissive: '#ea580c', ei: 0.8, rough: 0.4 })
            );
            fire.position.set(0, _BUILDING_TARGET_H * 0.65, 0.15);
            fire.name = 'bld_fire';
            g.add(fire);
            var light = new THREE.Group(/*PERF-removed*/'#f97316', 2.5, 3.5);
            light.position.set(0, _BUILDING_TARGET_H * 0.65, 0.15);
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'biblioteca': {
            // Floating magic book above the house
            var bookBody = new THREE.Mesh(
                new THREE.BoxGeometry(0.14, 0.025, 0.10),
                _BMAT('#7c3aed', { emissive: '#6d28d9', ei: 0.4, rough: 0.6 })
            );
            bookBody.position.y = _BUILDING_TARGET_H + 0.12;
            bookBody.name = 'bld_book';
            var pages = new THREE.Mesh(
                new THREE.BoxGeometry(0.10, 0.025, 0.08),
                _BMAT('#f8fafc', { rough: 0.9 })
            );
            pages.position.y = 0.013;
            bookBody.add(pages);
            g.add(bookBody);
            var light = new THREE.Group(/*PERF-removed*/'#8b5cf6', 1.5, 2.5);
            light.position.y = _BUILDING_TARGET_H + 0.1;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'oracolo': {
            // Mystical eye above the well
            var sclera = new THREE.Mesh(
                new THREE.SphereGeometry(0.10, 12, 12),
                _BMAT('#f0f9ff', { rough: 0.3, metal: 0.1 })
            );
            sclera.position.y = _BUILDING_TARGET_H + 0.15;
            g.add(sclera);
            var iris = new THREE.Mesh(
                new THREE.SphereGeometry(0.065, 10, 10),
                _BMAT('#06b6d4', { emissive: '#0891b2', ei: 0.7, rough: 0.1 })
            );
            iris.position.set(0, _BUILDING_TARGET_H + 0.15, 0.05);
            g.add(iris);
            var pupil = new THREE.Mesh(
                new THREE.SphereGeometry(0.035, 8, 8),
                _BMAT('#0c4a6e', { emissive: '#0369a1', ei: 0.4, rough: 0.1 })
            );
            pupil.position.set(0, _BUILDING_TARGET_H + 0.15, 0.09);
            pupil.name = 'bld_pupil';
            g.add(pupil);
            var oRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.18, 0.015, 6, 24),
                _BMAT('#22d3ee', { emissive: '#06b6d4', ei: 0.8, rough: 0.2 })
            );
            oRing.position.y = _BUILDING_TARGET_H + 0.15;
            oRing.name = 'bld_ring';
            g.add(oRing);
            var light = new THREE.Group(/*PERF-removed*/'#06b6d4', 2.5, 3.5);
            light.position.y = _BUILDING_TARGET_H + 0.15;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
        case 'tempio': {
            // Glowing dome aura above the inn
            var dome = new THREE.Mesh(
                new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
                _BMAT('#22c55e', { emissive: '#16a34a', ei: 0.35, rough: 0.35, metal: 0.2 })
            );
            dome.position.y = _BUILDING_TARGET_H + 0.02;
            dome.name = 'bld_dome';
            g.add(dome);
            var aura = new THREE.Mesh(
                new THREE.CircleGeometry(0.34, 20),
                _BMAT('#22c55e', { emissive: '#16a34a', ei: 0.3, rough: 0.9, double: true, alpha: 0.12 })
            );
            aura.rotation.x = -Math.PI / 2;
            aura.position.y = 0.02;
            aura.name = 'bld_aura';
            g.add(aura);
            var light = new THREE.Group(/*PERF-removed*/'#22c55e', 2.0, 3.5);
            light.position.y = _BUILDING_TARGET_H + 0.05;
            light.name = 'bld_light';
            g.add(light);
            break;
        }
    }
}

function removeBuilding3D(buildingId) {
    var entry = _buildings3D[buildingId];
    if (!entry) return;
    threeScene.remove(entry.group);
    entry.group.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
        }
    });
    delete _buildings3D[buildingId];
}

function clearAllBuildings3D() {
    for (var k in _buildings3D) removeBuilding3D(k);
    _buildings3D = {};
}

// ---- Per-frame animation update ----
function updateBuildings3D(dt) {
    if (!threeScene) return;
    for (var k in _buildings3D) {
        var e = _buildings3D[k];
        e.age += dt;
        _animateBuilding(e, dt);
    }
    _updateGhostAnim(dt);
}

// Hook into render/VFX update chain
var _origUpdateVFX_bld = typeof updateVFX === 'function' ? updateVFX : null;
updateVFX = function(dt) {
    if (_origUpdateVFX_bld) _origUpdateVFX_bld(dt);
    updateBuildings3D(dt);
};

// ====================================================================
//  ANIMATION
// ====================================================================
function _animateBuilding(entry, dt) {
    var g   = entry.group;
    var t   = entry.age;
    var def = typeof BUILDINGS !== 'undefined' ? BUILDINGS[entry.defId] : null;

    switch (entry.defId) {

        case 'zecca': {
            var coin = g.getObjectByName('spinning_coin');
            if (coin) {
                coin.rotation.y += dt * 3.0;
                coin.position.y = _BUILDING_TARGET_H + 0.12 + Math.sin(t * 2.2) * 0.04;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 1.8 + Math.sin(t * 3.0) * 0.4;
            break;
        }

        case 'caserma': {
            var flag = g.getObjectByName('bld_flag');
            if (flag) {
                flag.rotation.y = Math.sin(t * 3.5) * 0.2;
                flag.rotation.z = Math.sin(t * 2.8) * 0.05;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 1.4 + Math.sin(t * 2.0) * 0.2;
            break;
        }

        case 'altare': {
            var crystal = g.getObjectByName('bld_crystal');
            if (crystal) {
                var pulse = 1.0 + Math.sin(t * 2.5) * 0.12;
                crystal.scale.set(1, pulse, 1);
                if (crystal.material) crystal.material.emissiveIntensity = 0.5 + Math.sin(t * 2.5) * 0.3;
            }
            var ring = g.getObjectByName('bld_ring');
            if (ring) {
                ring.rotation.z += dt * 0.8;
                ring.rotation.x += dt * 0.4;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 2.0 + Math.sin(t * 2.5) * 0.6;
            break;
        }

        case 'torreArcana': {
            var orb = g.getObjectByName('bld_orb');
            if (orb) {
                var s = 1.0 + Math.sin(t * 3.0) * 0.1;
                orb.scale.set(s, s, s);
                if (orb.material) orb.material.emissiveIntensity = 0.6 + Math.sin(t * 3.0) * 0.3;
            }
            for (var ci = 0; ci < 3; ci++) {
                var orbiting = g.getObjectByName('bld_orbit_' + ci);
                if (orbiting) {
                    var angle = t * 1.2 + ci * (Math.PI * 2 / 3);
                    orbiting.position.set(Math.cos(angle) * 0.22, _BUILDING_TARGET_H * 0.85 + Math.sin(t * 1.5 + ci) * 0.05, Math.sin(angle) * 0.22);
                }
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 2.5 + Math.sin(t * 3.0) * 0.7;
            break;
        }

        case 'fucina': {
            var fire = g.getObjectByName('bld_fire');
            if (fire) {
                var flicker = 1.0 + Math.sin(t * 12 + Math.random() * 0.5) * 0.2;
                fire.scale.set(flicker * 0.9, flicker, flicker * 0.9);
                if (fire.material) fire.material.emissiveIntensity = 0.7 + Math.sin(t * 8) * 0.3;
            }
            var light = g.getObjectByName('bld_light');
            if (light) {
                light.intensity = 2.0 + Math.sin(t * 8 + Math.random()) * 0.8;
                light.distance  = 2.5 + Math.sin(t * 5) * 0.4;
            }
            break;
        }

        case 'biblioteca': {
            var book = g.getObjectByName('bld_book');
            if (book) {
                book.position.y = _BUILDING_TARGET_H + 0.12 + Math.sin(t * 1.8) * 0.06;
                book.rotation.y += dt * 0.6;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 1.2 + Math.sin(t * 1.8) * 0.2;
            break;
        }

        case 'oracolo': {
            var pupil = g.getObjectByName('bld_pupil');
            if (pupil) {
                pupil.rotation.y += dt * 1.5;
                var ps = 1.0 + Math.sin(t * 2.0) * 0.15;
                pupil.scale.set(ps, ps, ps);
            }
            var ring = g.getObjectByName('bld_ring');
            if (ring) {
                ring.rotation.y += dt * 1.2;
                ring.rotation.x = Math.sin(t * 0.8) * 0.4;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 2.2 + Math.sin(t * 2.0) * 0.6;
            break;
        }

        case 'tempio': {
            var dome = g.getObjectByName('bld_dome');
            if (dome) {
                var ds = 1.0 + Math.sin(t * 1.5) * 0.04;
                dome.scale.set(ds, ds, ds);
                if (dome.material) dome.material.emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.15;
            }
            var aura = g.getObjectByName('bld_aura');
            if (aura) {
                var as = 1.0 + Math.sin(t * 2.0) * 0.06;
                aura.scale.set(as, as, as);
                if (aura.material) aura.material.opacity = 0.12 + Math.sin(t * 2.0) * 0.05;
            }
            var light = g.getObjectByName('bld_light');
            if (light) light.intensity = 1.8 + Math.sin(t * 1.5) * 0.4;
            break;
        }
    }
}

// ====================================================================
//  MODEL BUILDERS
// ====================================================================
var _BMAT = function(color, opts) {
    opts = opts || {};
    return new THREE.MeshStandardMaterial({
        color: color,
        emissive:          opts.emissive  || color,
        emissiveIntensity: opts.ei        || 0,
        roughness:         opts.rough     || 0.5,
        metalness:         opts.metal     || 0.2,
        transparent:       opts.alpha     !== undefined,
        opacity:           opts.alpha     !== undefined ? opts.alpha : 1.0,
        side:              opts.double    ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite:        opts.alpha     === undefined,
    });
};

function _buildBuildingModel(defId, ownerIdx) {
    switch (defId) {
        case 'zecca':      return _bldZecca(ownerIdx);
        case 'caserma':    return _bldCaserma(ownerIdx);
        case 'altare':     return _bldAltare(ownerIdx);
        case 'torreArcana':return _bldTorre(ownerIdx);
        case 'fucina':     return _bldFucina(ownerIdx);
        case 'biblioteca': return _bldBiblioteca(ownerIdx);
        case 'oracolo':    return _bldOracolo(ownerIdx);
        case 'tempio':     return _bldTempio(ownerIdx);
        default: return null;
    }
}

// ── Owner tint helper ──
function _ownerColor(ownerIdx) {
    if (typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[ownerIdx]) return TEAM_COLORS[ownerIdx].primary;
    return '#ffffff';
}

// ────────────────────────────────────────────────────────────
// ZECCA — gold chest + spinning coin
// ────────────────────────────────────────────────────────────
function _bldZecca(ownerIdx) {
    var g = new THREE.Group();

    // Stone base
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.48), _BMAT('#64748b', { rough: 0.8 }));
    base.position.y = 0.04;
    g.add(base);

    // Chest body
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.28), _BMAT('#92400e', { rough: 0.7, metal: 0.1 }));
    body.position.y = 0.19;
    g.add(body);

    // Chest lid (slightly wider)
    var lid = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.3), _BMAT('#a16207', { rough: 0.6 }));
    lid.position.y = 0.35;
    g.add(lid);

    // Gold lock on chest
    var lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), _BMAT('#fbbf24', { emissive: '#fbbf24', ei: 0.4, rough: 0.3, metal: 0.8 }));
    lock.position.set(0, 0.31, 0.16);
    g.add(lock);

    // Spinning coin (flat cylinder)
    var coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12), _BMAT('#fbbf24', { emissive: '#fbbf24', ei: 0.6, rough: 0.3, metal: 0.9 }));
    coin.position.y = 0.72;
    coin.name = 'spinning_coin';
    g.add(coin);

    // Owner team band
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 18), _BMAT(_ownerColor(ownerIdx), { emissive: _ownerColor(ownerIdx), ei: 0.6, rough: 0.3, metal: 0.5 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.02;
    g.add(band);

    // Light
    var light = new THREE.Group(/*PERF-removed*/'#fbbf24', 1.8, 2.5);
    light.position.y = 0.7;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// CASERMA — barracks with towers and flag
// ────────────────────────────────────────────────────────────
function _bldCaserma(ownerIdx) {
    var g = new THREE.Group();

    var oc = _ownerColor(ownerIdx);

    // Main building
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.38), _BMAT('#475569', { rough: 0.75 }));
    body.position.y = 0.18;
    g.add(body);

    // Roof / crenellations
    var roof = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.42), _BMAT('#334155', { rough: 0.8 }));
    roof.position.y = 0.40;
    g.add(roof);

    // Left tower
    var tL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), _BMAT('#374151', { rough: 0.7 }));
    tL.position.set(-0.24, 0.275, 0);
    g.add(tL);
    var cL = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 8), _BMAT(oc, { emissive: oc, ei: 0.3, rough: 0.5 }));
    cL.position.set(-0.24, 0.62, 0);
    g.add(cL);

    // Right tower
    var tR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), _BMAT('#374151', { rough: 0.7 }));
    tR.position.set(0.24, 0.275, 0);
    g.add(tR);
    var cR = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 8), _BMAT(oc, { emissive: oc, ei: 0.3, rough: 0.5 }));
    cR.position.set(0.24, 0.62, 0);
    g.add(cR);

    // Door arch
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.06), _BMAT('#1e293b'));
    door.position.set(0, 0.09, 0.2);
    g.add(door);

    // Flag pole
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4), _BMAT('#9ca3af', { rough: 0.4, metal: 0.5 }));
    pole.position.set(0, 0.575, 0.02);
    g.add(pole);

    // Flag cloth
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), _BMAT(oc, { emissive: oc, ei: 0.4, rough: 0.7, double: true }));
    flag.position.set(0.09, 0.68, 0.02);
    flag.name = 'bld_flag';
    g.add(flag);

    // Owner base ring
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 20), _BMAT(oc, { emissive: oc, ei: 0.5, rough: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    var light = new THREE.Group(/*PERF-removed*/'#ef4444', 1.4, 2.5);
    light.position.y = 0.6;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// ALTARE — stone altar + crystal pillar + ring
// ────────────────────────────────────────────────────────────
function _bldAltare(ownerIdx) {
    var g = new THREE.Group();

    // Stone base (wide cylinder)
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.1, 10), _BMAT('#94a3b8', { rough: 0.85 }));
    base.position.y = 0.05;
    g.add(base);

    // Altar top slab
    var slab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.36), _BMAT('#cbd5e1', { rough: 0.8 }));
    slab.position.y = 0.135;
    g.add(slab);

    // 4 corner pillars
    var pillarPos = [[-0.16,-0.14],[0.16,-0.14],[-0.16,0.14],[0.16,0.14]];
    for (var i = 0; i < pillarPos.length; i++) {
        var pill = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 6), _BMAT('#b0bec5', { rough: 0.8 }));
        pill.position.set(pillarPos[i][0], 0.31, pillarPos[i][1]);
        g.add(pill);
    }

    // Crystal pillar
    var crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), _BMAT('#c084fc', { emissive: '#a855f7', ei: 0.7, rough: 0.2, metal: 0.1 }));
    crystal.position.y = 0.55;
    crystal.name = 'bld_crystal';
    g.add(crystal);

    // Rotating ring
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 24), _BMAT('#e879f9', { emissive: '#c026d3', ei: 0.8, rough: 0.2 }));
    ring.position.y = 0.55;
    ring.name = 'bld_ring';
    g.add(ring);

    var light = new THREE.Group(/*PERF-removed*/'#c084fc', 2.2, 3.0);
    light.position.y = 0.55;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// TORRE ARCANA — tall tower + orbiting crystals
// ────────────────────────────────────────────────────────────
function _bldTorre(ownerIdx) {
    var g = new THREE.Group();

    // Tower shaft
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), _BMAT('#1e293b', { rough: 0.6, metal: 0.3 }));
    shaft.position.y = 0.35;
    g.add(shaft);

    // Tower top
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 8), _BMAT('#0f172a', { rough: 0.5, metal: 0.4 }));
    top.position.y = 0.76;
    g.add(top);

    // Central orb at top
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), _BMAT('#60a5fa', { emissive: '#3b82f6', ei: 0.8, rough: 0.1 }));
    orb.position.y = 0.88;
    orb.name = 'bld_orb';
    g.add(orb);

    // 3 orbiting crystals
    var orbColors = ['#60a5fa', '#93c5fd', '#bfdbfe'];
    for (var i = 0; i < 3; i++) {
        var orbs = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), _BMAT(orbColors[i], { emissive: '#3b82f6', ei: 0.6, rough: 0.2 }));
        var ang = (Math.PI * 2 / 3) * i;
        orbs.position.set(Math.cos(ang) * 0.28, 0.7, Math.sin(ang) * 0.28);
        orbs.name = 'bld_orbit_' + i;
        g.add(orbs);
    }

    // Magic rune band on base
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20), _BMAT('#3b82f6', { emissive: '#1d4ed8', ei: 0.6 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.02;
    g.add(band);

    var light = new THREE.Group(/*PERF-removed*/'#3b82f6', 2.8, 4.0);
    light.position.y = 0.85;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// FUCINA — forge with chimney + fire
// ────────────────────────────────────────────────────────────
function _bldFucina(ownerIdx) {
    var g = new THREE.Group();

    // Body
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.36), _BMAT('#374151', { rough: 0.7, metal: 0.3 }));
    body.position.y = 0.14;
    g.add(body);

    // Anvil top surface
    var anvil = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.22), _BMAT('#6b7280', { rough: 0.5, metal: 0.6 }));
    anvil.position.y = 0.31;
    g.add(anvil);

    // Chimney
    var chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.3, 8), _BMAT('#1f2937', { rough: 0.6, metal: 0.4 }));
    chimney.position.set(0.14, 0.43, 0);
    g.add(chimney);

    // Fire cone (inside chimney top)
    var fire = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), _BMAT('#fb923c', { emissive: '#ea580c', ei: 0.8, rough: 0.4 }));
    fire.position.set(0.14, 0.62, 0);
    fire.name = 'bld_fire';
    g.add(fire);

    // Inner fire glow
    var fireInner = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), _BMAT('#fde68a', { emissive: '#fbbf24', ei: 1.0, rough: 0.3 }));
    fireInner.position.set(0.14, 0.65, 0);
    g.add(fireInner);

    // Belt/rivets details
    var belt = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 4, 16), _BMAT('#4b5563', { rough: 0.5, metal: 0.7 }));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.14;
    g.add(belt);

    var light = new THREE.Group(/*PERF-removed*/'#f97316', 2.5, 3.5);
    light.position.set(0.14, 0.65, 0);
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// BIBLIOTECA — bookshelf building + floating book
// ────────────────────────────────────────────────────────────
function _bldBiblioteca(ownerIdx) {
    var g = new THREE.Group();

    // Building body
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.38, 0.34), _BMAT('#78350f', { rough: 0.8 }));
    body.position.y = 0.19;
    g.add(body);

    // Pointed roof
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.22, 4), _BMAT('#451a03', { rough: 0.75 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.49;
    g.add(roof);

    // Window (glowing)
    var win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.04), _BMAT('#fef3c7', { emissive: '#fbbf24', ei: 0.5, rough: 0.8 }));
    win.position.set(0, 0.24, 0.18);
    g.add(win);

    // Floating book above
    var bookBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.12), _BMAT('#7c3aed', { emissive: '#6d28d9', ei: 0.4, rough: 0.6 }));
    bookBody.position.y = 0.68;
    bookBody.name = 'bld_book';
    // Book pages (white plane)
    var pages = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.1), _BMAT('#f8fafc', { rough: 0.9 }));
    pages.position.y = 0.015;
    bookBody.add(pages);
    g.add(bookBody);

    var light = new THREE.Group(/*PERF-removed*/'#8b5cf6', 1.5, 2.5);
    light.position.y = 0.65;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ────────────────────────────────────────────────────────────
// ORACOLO — eye orb on pedestal + orbital ring
// ────────────────────────────────────────────────────────────
function _bldOracolo(ownerIdx) {
    var g = new THREE.Group();

    // Pedestal
    var ped = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.2, 8), _BMAT('#0f172a', { rough: 0.6, metal: 0.4 }));
    ped.position.y = 0.1;
    g.add(ped);

    // Top ring of pedestal
    var topRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 18), _BMAT('#06b6d4', { emissive: '#0891b2', ei: 0.5 }));
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 0.2;
    g.add(topRing);

    // Eye sphere (white sclera)
    var sclera = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), _BMAT('#f0f9ff', { rough: 0.3, metal: 0.1 }));
    sclera.position.y = 0.44;
    g.add(sclera);

    // Iris (cyan)
    var iris = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), _BMAT('#06b6d4', { emissive: '#0891b2', ei: 0.7, rough: 0.1 }));
    iris.position.set(0, 0.44, 0.08);
    g.add(iris);

    // Pupil (dark sphere)
    var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), _BMAT('#0c4a6e', { emissive: '#0369a1', ei: 0.4, rough: 0.1 }));
    pupil.position.set(0, 0.44, 0.14);
    pupil.name = 'bld_pupil';
    g.add(pupil);

    // Orbital ring
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 6, 24), _BMAT('#22d3ee', { emissive: '#06b6d4', ei: 0.8, rough: 0.2 }));
    ring.position.y = 0.44;
    ring.name = 'bld_ring';
    g.add(ring);

    var light = new THREE.Group(/*PERF-removed*/'#06b6d4', 2.5, 3.5);
    light.position.y = 0.44;
    light.name = 'bld_light';
    g.add(light);

    return g;
}

// ====================================================================
//  GHOST BUILDING PREVIEW — placement mode
// ====================================================================
var _ghostBld3D   = null;
var _ghostDefId   = null;
var _ghostAnimAge = 0;
var _ghostRow     = -1;
var _ghostCol     = -1;

function showBuildingGhost3D(defId) {
    clearBuildingGhost3D();
    if (!threeScene) return;

    _ghostDefId = defId;

    _loadBuildingGLB(defId, function(cache) {
        // If ghost was cleared while loading, abort
        if (_ghostDefId !== defId) return;

        var group;
        if (cache) {
            group = _buildFromGLB(cache, defId, -1);
        } else {
            group = _buildBuildingModel(defId, -1);
        }
        if (!group) return;

        // Clone all materials to semi-transparent ghosts
        group.traverse(function(child) {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity     = 0.65;
                child.material.depthWrite  = false;
            }
        });

        group.name    = 'building_ghost';
        group.visible = false;
        threeScene.add(group);

        _ghostBld3D   = group;
        _ghostAnimAge = 0;
    });
}

// Call on every mousemove during placement mode
function updateBuildingGhost3D(row, col, isValid) {
    if (!_ghostBld3D) return;

    if (row < 0 || col < 0) {
        _ghostBld3D.visible = false;
        _ghostRow = -1;
        _ghostCol = -1;
        return;
    }

    _ghostRow = row;
    _ghostCol = col;
    _ghostBld3D.visible = true;

    var wp = cellToWorld(row, col);
    _ghostBld3D.position.x = wp.x;
    _ghostBld3D.position.z = wp.z;
    // Y is handled by animation

    // Green tint when valid, red when invalid
    var er = isValid ? 0.10 : 0.90;
    var eg = isValid ? 0.75 : 0.20;
    var eb = isValid ? 0.30 : 0.20;
    var alpha  = isValid ? 0.72 : 0.52;
    var eiBase = isValid ? 0.50 : 0.70;

    _ghostBld3D.traverse(function(child) {
        if (child.isMesh && child.material) {
            if (child.material.emissive !== undefined) {
                child.material.emissive.setRGB(er, eg, eb);
                child.material.emissiveIntensity = eiBase;
            }
            child.material.opacity = alpha;
        }
        if (child.isLight) {
            child.color.setRGB(er, eg, eb);
            child.intensity = isValid ? 2.2 : 1.2;
        }
    });
}

function clearBuildingGhost3D() {
    if (!_ghostBld3D) return;
    if (threeScene) threeScene.remove(_ghostBld3D);
    _ghostBld3D.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    _ghostBld3D   = null;
    _ghostDefId   = null;
    _ghostRow     = -1;
    _ghostCol     = -1;
    _ghostAnimAge = 0;
}

// Internal: float + slow rotation to showcase the 3D model
function _updateGhostAnim(dt) {
    if (!_ghostBld3D || !_ghostBld3D.visible) return;
    _ghostAnimAge += dt;
    // Gentle hover float
    _ghostBld3D.position.y = 0.06 + Math.sin(_ghostAnimAge * 2.8) * 0.06;
    // Slow spin so the player can admire the model from all angles
    _ghostBld3D.rotation.y += dt * 0.55;
}

// ────────────────────────────────────────────────────────────
// TEMPIO — round pillared temple + glowing dome
// ────────────────────────────────────────────────────────────
function _bldTempio(ownerIdx) {
    var g = new THREE.Group();

    // Round stone floor
    var floor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.06, 12), _BMAT('#94a3b8', { rough: 0.85 }));
    floor.position.y = 0.03;
    g.add(floor);

    // 6 pillars
    for (var i = 0; i < 6; i++) {
        var angle = (Math.PI * 2 / 6) * i;
        var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 6), _BMAT('#cbd5e1', { rough: 0.8 }));
        pillar.position.set(Math.cos(angle) * 0.2, 0.27, Math.sin(angle) * 0.2);
        g.add(pillar);
    }

    // Pillar caps
    var capRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 18), _BMAT('#e2e8f0', { rough: 0.7 }));
    capRing.rotation.x = Math.PI / 2;
    capRing.position.y = 0.5;
    g.add(capRing);

    // Dome
    var dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), _BMAT('#22c55e', { emissive: '#16a34a', ei: 0.35, rough: 0.35, metal: 0.2 }));
    dome.position.y = 0.5;
    dome.name = 'bld_dome';
    g.add(dome);

    // Aura disc
    var aura = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), _BMAT('#22c55e', { emissive: '#16a34a', ei: 0.3, rough: 0.9, double: true, alpha: 0.12 }));
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.02;
    aura.name = 'bld_aura';
    g.add(aura);

    var light = new THREE.Group(/*PERF-removed*/'#22c55e', 2.0, 3.5);
    light.position.y = 0.55;
    light.name = 'bld_light';
    g.add(light);

    return g;
}
