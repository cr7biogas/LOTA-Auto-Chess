// ============================================================
// LOTA AUTO CHESS — three-environment.js — 3D Environment & GLB Assets
// Environment perimeter handled by three-board.js (bases, border)
// Vegetation handled by three-scenery.js (Mondo/Nature)
// ============================================================

var threeEnvironmentGroup = new THREE.Group();
var threeEnvironmentGroup_name = 'environment';
var threeGLBCache = {};        // modelPath -> THREE.Group (for reuse)
var threeGLTFLoader = null;    // lazy-loaded

// ====================================================================
//  GLTF LOADER INIT
// ====================================================================

function _ensureGLTFLoader() {
    if (!threeGLTFLoader) {
        var GLTFLoaderClass = THREE.GLTFLoader || window.GLTFLoader;

        if (typeof GLTFLoaderClass !== 'undefined') {
            threeGLTFLoader = new GLTFLoaderClass();
            console.log('✓ GLTFLoader instantiated');
        } else {
            console.warn('[three-environment] GLTFLoader not ready, will retry...');
            return false;
        }
    }
    return true;
}

// ====================================================================
//  LOAD & CACHE GLB MODEL
// ====================================================================

function _loadGLBModel(modelPath) {
    return new Promise(function(resolve, reject) {
        if (!_ensureGLTFLoader()) {
            reject(new Error('GLTFLoader not ready'));
            return;
        }

        // Return cached clone if available
        if (threeGLBCache[modelPath]) {
            resolve(threeGLBCache[modelPath].clone());
            return;
        }

        // Load from disk
        threeGLTFLoader.load(
            modelPath,
            function(gltf) {
                var model = gltf.scene;
                model.traverse(function(node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                threeGLBCache[modelPath] = model;
                resolve(model.clone());
            },
            undefined,
            function(error) {
                console.error('Error loading GLB model:', modelPath, error);
                reject(error);
            }
        );
    });
}

// ====================================================================
//  INITIALIZE ENVIRONMENT
// ====================================================================

function initThreeEnvironment() {
    threeEnvironmentGroup.name = threeEnvironmentGroup_name;

    var waitForLoader = function() {
        if (_ensureGLTFLoader()) {
            threeScene.add(threeEnvironmentGroup);
            console.log('✓ Environment initialized');
        } else {
            setTimeout(waitForLoader, 50);
        }
    };

    waitForLoader();
}

// ====================================================================
//  LOOT OBJECTS (chest, coin, barrel) — spawned dynamically
// ====================================================================

var threeItemCache = {};

function spawnLootObject(itemType, position) {
    var modelPath = 'models/kenney/' + itemType + '.glb';

    _loadGLBModel(modelPath).then(function(model) {
        model.position.copy(position);
        model.scale.set(0.4, 0.4, 0.4);

        var startY = position.y;
        var floatDuration = 2000;
        var startTime = Date.now();

        var animateFloat = function() {
            var elapsed = Date.now() - startTime;
            var progress = Math.min(elapsed / floatDuration, 1);

            model.position.y = startY + Math.sin(progress * Math.PI) * 0.5;
            var opacity = 1 - progress * 0.5;
            model.traverse(function(child) {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = opacity;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animateFloat);
            } else {
                threeEnvironmentGroup.remove(model);
                model.traverse(function(child) {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) child.material.dispose();
                    }
                });
            }
        };

        threeEnvironmentGroup.add(model);
        animateFloat();
    });
}
