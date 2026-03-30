// ============================================================
// LOTA AUTO CHESS — three-setup.js — Three.js Scene, Camera, Lights
// ============================================================

var threeRenderer = null;
var threeScene    = null;
var threeCamera   = null;
var threeCanvas   = null;
var threeRaycaster = null;
var threeBoardGroup = null;     // will hold tile meshes for raycasting
var threeUnitModels = {};       // unitId -> { group, hpSprite, starSprite }

// World constants  (1 cell = 1 world-unit on X/Z)
var TILE_UNIT    = 1.0;
var TILE_Y       = 0.075;      // half-height of a tile slab
var BOARD_CX     = BOARD_COLS * TILE_UNIT / 2;
var BOARD_CZ     = BOARD_ROWS * TILE_UNIT / 2;
var UNIT_BASE_Y  = TILE_Y * 2;         // tile top surface (per-model feet offset applied in spawnUnitModel3D)

var _threeSceneInitialized = false;
function initThreeScene() {
    if (_threeSceneInitialized) { console.warn('initThreeScene() called twice — skipping'); return; }
    _threeSceneInitialized = true;
    // ---- renderer ----
    threeRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    threeRenderer.setPixelRatio(1);
    var _rs = 0.75;  // render scale: 75% risoluzione interna, canvas resta full-screen via CSS
    threeRenderer.setSize(window.innerWidth * _rs, window.innerHeight * _rs, false);
    threeRenderer.shadowMap.enabled = false; // PERF: shadow pass troppo costoso con 7000+ draw calls
    threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    threeRenderer.toneMappingExposure = 1.15;
    threeCanvas = threeRenderer.domElement;
    threeCanvas.id = 'three-canvas';
    threeCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;';
    document.body.insertBefore(threeCanvas, document.body.firstChild);

    // ---- scene ----
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color('#87ceeb'); // bright sky blue
    threeScene.fog = null;  // nebbia solo in vista FPS

    // ---- camera (orthographic isometric) ----
    _setupCamera();

    // ---- lights ----
    // ambient — warm bright
    threeScene.add(new THREE.AmbientLight('#c8c0a8', 0.85));
    // key light (golden sunlight, like Preview_1)
    var key = new THREE.DirectionalLight('#fff4d6', 1.3);
    key.position.set(BOARD_CX + 10, 18, BOARD_CZ - 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near  = 1;
    key.shadow.camera.far   = 100;
    key.shadow.camera.left  = -44;
    key.shadow.camera.right = 44;
    key.shadow.camera.top   = 44;
    key.shadow.camera.bottom = -44;
    key.shadow.bias = -0.001;
    threeScene.add(key);
    // fill (sky blue, softer)
    var fill = new THREE.DirectionalLight('#8cb8e0', 0.4);
    fill.position.set(BOARD_CX - 8, 10, BOARD_CZ + 10);
    threeScene.add(fill);
    // PERF: rim light removed — key + fill sufficient

    // Ground plane moved to _createBaseGround() in three-board.js

    // raycaster
    threeRaycaster = new THREE.Raycaster();

    // repurpose old 2D canvas as transparent overlay for damage numbers
    var old = document.getElementById('game-canvas');
    if (old) {
        old.style.zIndex = '1';
        old.style.pointerEvents = 'none';
    }

    window.addEventListener('resize', _resizeThree);

    // Double-click resets camera (disabled in FPS combat — rapid clicks = combo attack)
    window.addEventListener('dblclick', function() {
        if (!_tacticalView && typeof gamePhase !== 'undefined' && gamePhase === PHASE_COMBAT) return;
        if (typeof resetCamera === 'function') resetCamera();
    });
    // Home / Space resets camera (handled inside WASD keydown listener below)

    // Init orbit listeners (mouse + touch) once the scene is ready
    _initCameraOrbit();
    _initMouseLook();

    // Pre-load ALL avatar + army GLBs in parallel during menu screen
    var _preloadAllModels = function() {
        if (typeof _loadAvatarGLB !== 'function') return;

        var avatarIds = ['ual1_standard', 'ual2_walking', 'stratega', 'stregone', 'mistico'];
        var armataIds = ['soldato', 'arciere', 'guaritore', 'esploratore'];
        var total = avatarIds.length + armataIds.length;
        var loaded = 0;

        function _onLoaded(name) {
            loaded++;
            console.log('✓ Pre-cached: ' + name + ' (' + loaded + '/' + total + ')');
            if (loaded === total) {
                console.log('✅ Tutti i modelli pre-caricati in cache');
            }
        }

        // Load all avatars in parallel
        avatarIds.forEach(function(id) {
            _loadAvatarGLB(id, function(data) { _onLoaded(id); });
        });

        // Load all army models in parallel
        if (typeof _loadMilitiaGLB === 'function') {
            armataIds.forEach(function(id) {
                _loadMilitiaGLB(id, function(data) { _onLoaded(id); });
            });
        } else {
            loaded += armataIds.length; // skip count if loader not available
        }

        // Shader warm-up with first loaded avatar
        _loadAvatarGLB('ual1_standard', function(data) {
            if (!data) return;
            var SU = window.SkeletonUtils;
            var warmup = SU ? SU.clone(data.scene) : data.scene.clone();
            var wh = data.naturalHeight > 0 ? data.naturalHeight : 1.0;
            warmup.scale.setScalar(0.07 / wh);
            warmup.position.set(-9999, -9999, -9999);
            threeScene.add(warmup);
            setTimeout(function() { threeScene.remove(warmup); }, 200);
            console.log('✓ Shader warm-up completato');
        });
    };
    if (window._esModulesReady) {
        _preloadAllModels();
    } else {
        window.addEventListener('es-modules-ready', _preloadAllModels, { once: true });
    }
}

// === Camera Control State ===
var CAM_F_BASE     = 28;       // base frustum half-size
var CAM_ZOOM       = 1.0;      // 1.0 = default view
var CAM_ZOOM_MIN   = 0.35;     // max zoom in
var CAM_ZOOM_MAX   = 1.5;      // max zoom out
var CAM_ZOOM_SPEED = 0.08;
var CAM_PAN_X      = 0;        // world-space offset
var CAM_PAN_Z      = 0;
var CAM_PAN_LIMIT  = 20;       // max pan distance from center
var CAM_PAN_SPEED  = 0.5;      // WASD pan speed per frame
var _keysDown      = {};       // currently pressed keys
var _camPitch      = Math.PI / 5.5;
var _camYaw        = Math.PI / 4;
var _camBaseYaw    = Math.PI / 4;  // base yaw before player rotation

// Rotate camera yaw based on player's server slot so each player
// sees the board from their own base's perspective.
// Slot 0 (SUD)  = default (PI/4)
// Slot 1 (NORD) = +PI (180° flip)
// Slot 2 (OVEST)= +PI/2 (90° left)
// Slot 3 (EST)  = -PI/2 (90° right)
function applyCameraRotationForSlot(serverSlot) {
    var rotations = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
    var rotation = rotations[serverSlot] || 0;
    _camBaseYaw = Math.PI / 4 + rotation;
    _camYaw = _camBaseYaw;
    if (threeCamera) _applyCameraTransform();
    console.log('[Camera] Rotated for slot ' + serverSlot + ': yaw=' + _camYaw.toFixed(2));
}

function _setupCamera() {
    var aspect = window.innerWidth / window.innerHeight;
    var f = CAM_F_BASE * CAM_ZOOM;
    threeCamera = new THREE.OrthographicCamera(-f * aspect, f * aspect, f, -f, 0.1, 200);
    _applyCameraTransform();

    // --- Zoom (mouse wheel) ---
    window.addEventListener('wheel', function(e) {
        // FPS/avatar mode: scroll zooms orbit distance
        if (!_tacticalView && _fpvCamera) {
            var delta = e.deltaY > 0 ? CAM_ORBIT_ZOOM_SPEED : -CAM_ORBIT_ZOOM_SPEED;
            CAM_ORBIT_DISTANCE = Math.max(CAM_ORBIT_DIST_MIN, Math.min(CAM_ORBIT_DIST_MAX, CAM_ORBIT_DISTANCE + delta));
            e.preventDefault();
            return;
        }
        // Tactical mode: scroll zooms orthographic frustum
        if (!threeCamera) return;
        var delta = e.deltaY > 0 ? CAM_ZOOM_SPEED : -CAM_ZOOM_SPEED;
        CAM_ZOOM = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, CAM_ZOOM + delta));
        _updateCameraFrustum();
        e.preventDefault();
    }, { passive: false });

    // --- WASD camera pan + Home reset + FPV toggle ---
    window.addEventListener('keydown', function(e) {
        _keysDown[e.key.toLowerCase()] = true;
        if (e.key === 'Home') { if (typeof resetCamera === 'function') resetCamera(); }
        if ((e.key === 'f' || e.key === 'F') && e.altKey) {
            if (typeof toggleFPV === 'function') toggleFPV();
            e.preventDefault();
        } else if (e.key === 'f' || e.key === 'F') {
            if (typeof toggleMouseLook === 'function') toggleMouseLook();
        }
        if (e.key === '\\') {
            _avatarRunning = !_avatarRunning;
            console.log('🏃 Modalità:', _avatarRunning ? 'CORSA' : 'CAMMINATA');
        }
    });
    window.addEventListener('keyup', function(e) {
        _keysDown[e.key.toLowerCase()] = false;
    });
}

function _applyCameraTransform() {
    var dist = 56;
    var cx = BOARD_CX + CAM_PAN_X;
    var cz = BOARD_CZ + CAM_PAN_Z;
    threeCamera.position.set(
        cx + dist * Math.cos(_camPitch) * Math.sin(_camYaw),
        dist * Math.sin(_camPitch),
        cz + dist * Math.cos(_camPitch) * Math.cos(_camYaw)
    );
    threeCamera.lookAt(cx, 0, cz);
    threeCamera.updateProjectionMatrix();
}

function _updateCameraFrustum() {
    if (!threeCamera) return;
    var aspect = window.innerWidth / window.innerHeight;
    var f = CAM_F_BASE * CAM_ZOOM;
    threeCamera.left   = -f * aspect;
    threeCamera.right  =  f * aspect;
    threeCamera.top    =  f;
    threeCamera.bottom = -f;
    _applyCameraTransform();
}

// Called every frame from render loop — WASD camera pan
function updateCameraEdgeScroll(dt) {
    if (!threeCamera) return;
    // When avatar follow cam is active during combat, WASD belongs to avatar movement — skip pan
    if (!_tacticalView && typeof gamePhase !== 'undefined' && gamePhase === PHASE_COMBAT) return;

    var dx = 0, dz = 0;
    var speed = CAM_PAN_SPEED * CAM_ZOOM;

    if (_keysDown['w'] || _keysDown['arrowup'])    dz = -speed;
    if (_keysDown['s'] || _keysDown['arrowdown'])  dz =  speed;
    if (_keysDown['a'] || _keysDown['arrowleft'])  dx = -speed;
    if (_keysDown['d'] || _keysDown['arrowright']) dx =  speed;

    if (dx === 0 && dz === 0) return;

    // Convert screen direction to world (isometric 45 rotation)
    var cos45 = 0.7071;
    var worldDx = (dx * cos45 + dz * cos45);
    var worldDz = (-dx * cos45 + dz * cos45);

    CAM_PAN_X = Math.max(-CAM_PAN_LIMIT, Math.min(CAM_PAN_LIMIT, CAM_PAN_X + worldDx));
    CAM_PAN_Z = Math.max(-CAM_PAN_LIMIT, Math.min(CAM_PAN_LIMIT, CAM_PAN_Z + worldDz));
    _applyCameraTransform();
}

// Reset camera to default (double-click or key)
function resetCamera() {
    if (!_tacticalView) toggleFPV(); // exit avatar follow cam, back to tactical
    CAM_ZOOM = 1.0;
    CAM_PAN_X = 0;
    CAM_PAN_Z = 0;
    _camYaw = _camBaseYaw; // respect player's slot rotation
    _updateCameraFrustum();
}

function _resizeThree() {
    if (!threeRenderer) return;
    var w = window.innerWidth, h = window.innerHeight;
    var _rs = 0.75;
    threeRenderer.setSize(w * _rs, h * _rs, false);
    if (!_tacticalView && _fpvCamera) {
        _fpvCamera.aspect = w / h;
        _fpvCamera.updateProjectionMatrix();
    }
    if (threeCamera) _updateCameraFrustum();
}

// =============================================
// AVATAR CAMERA — Third-person follow (default during combat)
// Isometric tactical view toggle with F
// =============================================
// =============================================
// AVATAR CAMERA — Orbit + smooth follow
// =============================================
var _fpvCamera = null;
var _tacticalView = false;
var _camSmooth = { x: 0, y: 0, z: 0 };
var _camLookSmooth = { x: 0, y: 0, z: 0 };

// Camera orbit (mouse / touch drag)
var _camOrbitAngle = Math.PI;   // horizontal orbit angle around avatar
var _camOrbitPitch = 0.40;      // vertical orbit angle (0=horizon, PI/2=top-down)
var _camOrbitDragging = false;
var _camDragLastX = 0;
var _camDragLastY = 0;

// Tuning
var CAM_ORBIT_DISTANCE = 4.0;   // current orbit radius (scroll to change)
var CAM_ORBIT_DIST_MIN = 3.0;   // closest zoom
var CAM_ORBIT_DIST_MAX = 50.0;  // farthest zoom (enough to see full map)
var CAM_ORBIT_ZOOM_SPEED = 2.0; // per scroll step
var CAM_PITCH_MIN = 0.15;       // near-horizontal (prevent camera under floor)
var CAM_PITCH_MAX = 1.50;       // near top-down
var CAM_LOOK_AHEAD = 0.5;
var CAM_LERP       = 0.10;
var CAM_ORBIT_SPEED = 0.005;    // radians per pixel dragged

// Avatar smooth world position (continuous movement)
var _avatarWX = 0;
var _avatarWZ = 0;
var _avatarSpeedWalk = 1.2;    // world units/s while walking
var _avatarSpeedRun  = 3.5;    // world units/s while running
var _avatarRunning   = false;  // toggled by backslash key
var _avatarSpeed     = 2.5;    // current speed (updated each frame)
var _avatarInited    = false;

// Prevent camera from lerping from (0,0,0) on first frame
var _fpvCamSnapped = false;
var _fpvLastAvatarId = -1;

// Alt+F mouse-look mode (pointer lock FPS)
var _mouseLookActive = false;
var _mouseLookPitch  = 0;      // independent vertical aim, -1.2 (down) to +1.2 (up)

// Fog presets
var _FOG_TACTICAL = { type: 'none' };
var _FOG_FPS      = { type: 'linear', color: '#87ceeb', near: 60, far: 130 };

function _applyFog(preset) {
    if (!threeScene) return;
    if (preset.type === 'none') {
        threeScene.fog = null;
    } else if (preset.type === 'linear') {
        threeScene.fog = new THREE.Fog(preset.color, preset.near, preset.far);
    } else {
        threeScene.fog = new THREE.FogExp2(preset.color, preset.density);
    }
}

function toggleFPV() {
    if (!threeScene) return;
    _tacticalView = !_tacticalView;
    if (_tacticalView) {
        // Back to tactical: wide fog, full camera range
        _applyFog(_FOG_TACTICAL);
        if (_fpvCamera) { _fpvCamera.far = 200; _fpvCamera.updateProjectionMatrix(); }
        if (typeof showToast === 'function') showToast('Vista Tattica — [Alt+F] torna all\'avatar', 'info', '!');
    } else {
        // FPS mode: light atmospheric fog, full map visible
        _applyFog(_FOG_FPS);
        if (_fpvCamera) { _fpvCamera.far = 150; _fpvCamera.updateProjectionMatrix(); }
        _fpvCamSnapped = false;
        if (typeof showToast === 'function') showToast('Vista Avatar — [Alt+F] vista tattica', 'info', '!');
    }
}

// Alt+F — true FPS mouse-look mode with pointer lock
function toggleMouseLook() {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    if (_mouseLookActive || document.pointerLockElement === threeCanvas) {
        document.exitPointerLock();
    } else {
        // Ensure we're in avatar cam first
        if (_tacticalView) toggleFPV();
        _mouseLookPitch = 0; // reset pitch to horizontal on entry
        _fpvCamSnapped  = false;
        threeCanvas.requestPointerLock();
    }
}

// Pointer lock events — wired once after scene init
function _initMouseLook() {
    document.addEventListener('pointerlockchange', function() {
        _mouseLookActive = (document.pointerLockElement === threeCanvas);
        if (typeof showToast === 'function') {
            showToast(
                _mouseLookActive
                    ? 'Mouse Look attivo — ESC per uscire'
                    : 'Vista Avatar — [F] mouse look',
                'info', '!'
            );
        }
    });
    document.addEventListener('pointerlockerror', function() {
        console.warn('⚠️  Pointer lock fallita');
    });
    // Pointer-lock mouse move: stessa logica di Q/E ma col mouse
    document.addEventListener('mousemove', function(e) {
        if (!_mouseLookActive) return;
        var sens = 0.0022;
        _camOrbitAngle -= e.movementX * sens;
        _camOrbitPitch  = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX,
            _camOrbitPitch + e.movementY * sens));
    });
}

function _getAvatarForCamera() {
    var mySlot = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
    if (typeof combatUnits !== 'undefined' && typeof gamePhase !== 'undefined' && (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT)) {
        for (var i = 0; i < combatUnits.length; i++) {
            if (combatUnits[i].isAvatar && combatUnits[i].owner === mySlot && combatUnits[i].alive) return combatUnits[i];
        }
    }
    if (typeof players !== 'undefined' && getHumanPlayer() && getHumanPlayer().avatar && getHumanPlayer().avatar.alive) {
        return getHumanPlayer().avatar;
    }
    return null;
}

// Init mouse / touch orbit listeners — called once from initThreeScene
function _initCameraOrbit() {
    // Returns false if the click target is inside a UI panel (should not start orbit)
    function _onGameArea(target) {
        if (!target) return true;
        var tag = target.tagName ? target.tagName.toLowerCase() : '';
        if (tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') return false;
        if (target.closest) {
            if (target.closest('#hud') ||
                target.closest('#side-panel') ||
                target.closest('#bench-panel') ||
                target.closest('#combat-log') ||
                target.closest('#avatar-hud') ||
                target.closest('#order-menu') ||
                target.closest('#skill-menu') ||
                target.closest('#skill-equip-panel') ||
                target.closest('#planning-actions') ||
                target.closest('#combat-controls') ||
                target.closest('#unit-roster') ||
                target.closest('#toast-container') ||
                target.closest('#unit-info-card') ||
                target.closest('.overlay')) return false;
        }
        return true;
    }

    // ---- Mouse ----
    var _camClickStartX = 0, _camClickStartY = 0;
    window.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        if (!_onGameArea(e.target)) return;
        _camOrbitDragging = true;
        _camDragLastX = e.clientX;
        _camDragLastY = e.clientY;
        _camClickStartX = e.clientX;
        _camClickStartY = e.clientY;
    });
    window.addEventListener('mouseup', function(e) {
        if (e.button === 0) {
            // Click = less than 8px drag → trigger combo attack during FPS combat
            var _ddx = e.clientX - _camClickStartX, _ddy = e.clientY - _camClickStartY;
            var _moved = Math.sqrt(_ddx * _ddx + _ddy * _ddy);
            if (_moved < 8 && !_tacticalView &&
                typeof gamePhase !== 'undefined' && gamePhase === PHASE_COMBAT) {
                if (typeof avatarComboAttack === 'function') avatarComboAttack();
            }
        }
        _camOrbitDragging = false;
    });
    window.addEventListener('mousemove', function(e) {
        if (!_camOrbitDragging) return;
        var dx = e.clientX - _camDragLastX;
        var dy = e.clientY - _camDragLastY;
        _camDragLastX = e.clientX;
        _camDragLastY = e.clientY;
        _applyOrbitDelta(dx, dy);
    });

    // ---- Touch (single finger) ----
    var _touchId = null;
    var _touchLastX = 0, _touchLastY = 0;
    window.addEventListener('touchstart', function(e) {
        if (_touchId !== null || e.touches.length !== 1) return;
        if (!_onGameArea(e.target)) return;
        var t = e.touches[0];
        _touchId   = t.identifier;
        _touchLastX = t.clientX;
        _touchLastY = t.clientY;
    }, { passive: true });
    window.addEventListener('touchmove', function(e) {
        if (_touchId === null) return;
        for (var i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier !== _touchId) continue;
            var dx = e.touches[i].clientX - _touchLastX;
            var dy = e.touches[i].clientY - _touchLastY;
            _touchLastX = e.touches[i].clientX;
            _touchLastY = e.touches[i].clientY;
            _applyOrbitDelta(dx * 1.8, dy * 1.8);
            break;
        }
    }, { passive: true });
    window.addEventListener('touchend', function(e) {
        for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === _touchId) { _touchId = null; break; }
        }
    }, { passive: true });
}

// Shared orbit delta logic (mouse + touch)
function _applyOrbitDelta(dx, dy) {
    if (_mouseLookActive) return; // pointer lock handles rotation in mouse-look mode
    if (!_tacticalView) {
        // Avatar follow cam: horizontal orbit + vertical pitch
        _camOrbitAngle -= dx * CAM_ORBIT_SPEED;
        _camOrbitPitch = Math.max(CAM_PITCH_MIN, Math.min(CAM_PITCH_MAX,
            _camOrbitPitch + dy * 0.004));
    } else {
        // Tactical ortho cam: rotate isometric yaw + pitch
        _camYaw   += dx * 0.005;
        _camPitch = Math.max(0.15, Math.min(Math.PI / 2.2, _camPitch - dy * 0.003));
        _applyCameraTransform();
    }
}

// Update avatar smooth world position from WASD (called every frame)
function updateAvatarMovement(dt) {
    var phase = typeof gamePhase !== 'undefined' ? gamePhase : '';
    if (phase !== PHASE_COMBAT) { _avatarInited = false; return; }

    var avatar = _getAvatarForCamera();
    if (!avatar) return;

    // Init smooth pos from grid cell on first frame
    if (!_avatarInited) {
        var wp = cellToWorld(avatar.row, avatar.col);
        _avatarWX = wp.x;
        _avatarWZ = wp.z;
        _avatarInited = true;
    }

    // Read WASD keys — movement is relative to camera angle
    var inputX = 0, inputZ = 0;
    if (_keysDown['w'] || _keysDown['arrowup'])    inputZ = -1;
    if (_keysDown['s'] || _keysDown['arrowdown'])  inputZ =  1;
    if (_keysDown['a'] || _keysDown['arrowleft'])  inputX = -1;
    if (_keysDown['d'] || _keysDown['arrowright']) inputX =  1;

    if (inputX !== 0 || inputZ !== 0) {
        // Normalize
        var len = Math.sqrt(inputX * inputX + inputZ * inputZ);
        inputX /= len;
        inputZ /= len;

        // Rotate input into world space: W = forward (along -camera direction), D = right
        var sin = Math.sin(_camOrbitAngle);
        var cos = Math.cos(_camOrbitAngle);
        var worldDx = inputX * cos + inputZ * sin;
        var worldDz = -inputX * sin + inputZ * cos;

        // Pick speed based on run/walk mode and lerp toward it
        var targetSpeed = _avatarRunning ? _avatarSpeedRun : _avatarSpeedWalk;
        _avatarSpeed += (targetSpeed - _avatarSpeed) * Math.min(1.0, dt * 8.0);

        // Move smooth position
        _avatarWX += worldDx * _avatarSpeed * dt;
        _avatarWZ += worldDz * _avatarSpeed * dt;

        // Clamp to valid board area
        _avatarWX = Math.max(0.5, Math.min(BOARD_COLS * TILE_UNIT - 0.5, _avatarWX));
        _avatarWZ = Math.max(0.5, Math.min(BOARD_ROWS * TILE_UNIT - 0.5, _avatarWZ));

        // Update grid cell from world position
        var newCol = Math.floor(_avatarWX / TILE_UNIT);
        var newRow = Math.floor(_avatarWZ / TILE_UNIT);
        if (isValidCell(newRow, newCol) && (newRow !== avatar.row || newCol !== avatar.col)) {
            avatar.row = newRow;
            avatar.col = newCol;
        }
    } else {
        // Gently pull smooth pos toward current cell center (snap when still)
        var cellCenter = cellToWorld(avatar.row, avatar.col);
        _avatarWX += (cellCenter.x - _avatarWX) * 0.05;
        _avatarWZ += (cellCenter.z - _avatarWZ) * 0.05;
    }

    // Store smooth pos on avatar for 3D model to use
    avatar._smoothWX = _avatarWX;
    avatar._smoothWZ = _avatarWZ;
}

function updateFPVCamera(dt) {
    if (!_fpvCamera) {
        var aspect = window.innerWidth / window.innerHeight;
        _fpvCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 150);
    }

    // Auto-release pointer lock when combat ends (so overlays/buttons are clickable)
    if (_mouseLookActive && typeof gamePhase !== 'undefined' && gamePhase !== PHASE_COMBAT) {
        document.exitPointerLock();
    }

    updateAvatarMovement(dt);

    // Q / E — ruota la visuale
    if (!_tacticalView && typeof gamePhase !== 'undefined' && gamePhase === PHASE_COMBAT) {
        var _orbitSpeed = 1.8; // rad/s
        if (_keysDown['q']) _camOrbitAngle += _orbitSpeed * dt;
        if (_keysDown['e']) _camOrbitAngle -= _orbitSpeed * dt;
    }

    if (_tacticalView) return;

    var avatar = _getAvatarForCamera();
    if (!avatar) return;

    var avX = avatar._smoothWX !== undefined ? avatar._smoothWX : cellToWorld(avatar.row, avatar.col).x;
    var avZ = avatar._smoothWZ !== undefined ? avatar._smoothWZ : cellToWorld(avatar.row, avatar.col).z;

    // First frame or new avatar: snap pivot and orient camera behind avatar
    var avatarId = avatar.id || -1;
    if (!_fpvCamSnapped || _fpvLastAvatarId !== avatarId) {
        var _dax = BOARD_CX - avX, _daz = BOARD_CZ - avZ;
        var _dalen = Math.sqrt(_dax * _dax + _daz * _daz);
        if (_dalen > 0.01) _camOrbitAngle = Math.atan2(_dax, _daz) + Math.PI;
        _camSmooth.x = avX;
        _camSmooth.z = avZ;
        _fpvCamSnapped = true;
        _fpvLastAvatarId = avatarId;
    }

    // Smooth pivot follows avatar (dt-based, frame-rate independent)
    var _pl = Math.min(1.0, dt * 12);
    _camSmooth.x += (avX - _camSmooth.x) * _pl;
    _camSmooth.z += (avZ - _camSmooth.z) * _pl;

    // ── 3rd-person orbit: same code for both F and Alt+F modes ──
    // (mouse-look just uses pointer lock instead of Q/E to drive _camOrbitAngle)
    var _hd = Math.cos(_camOrbitPitch) * CAM_ORBIT_DISTANCE;
    _fpvCamera.position.set(
        _camSmooth.x + Math.sin(_camOrbitAngle) * _hd,
        UNIT_BASE_Y  + Math.sin(_camOrbitPitch) * CAM_ORBIT_DISTANCE,
        _camSmooth.z + Math.cos(_camOrbitAngle) * _hd
    );
    // Look ahead scales with orbit distance for smooth zoomed-out view
    var _lookAhead = CAM_LOOK_AHEAD * Math.min(1.0, 6.0 / CAM_ORBIT_DISTANCE);
    _fpvCamera.lookAt(
        _camSmooth.x - Math.sin(_camOrbitAngle) * _lookAhead,
        UNIT_BASE_Y  + 0.5,
        _camSmooth.z - Math.cos(_camOrbitAngle) * _lookAhead
    );
}

// ============================================================
//  PRE-WARM SHADER: spawna un modello dummy per ogni personaggio
//  all'avvio così gli shader GLSL vengono compilati una volta sola
//  prima che il giocatore piazzi la prima unità
// ============================================================
function preWarmCharacterShaders() {
    if (!threeScene || !threeRenderer) return;
    if (typeof createCharacterModel3D !== 'function') return;
    if (typeof CHARACTERS === 'undefined') return;

    var charIds = Object.keys(CHARACTERS);
    var dummies = [];

    charIds.forEach(function(cid) {
        var dummy = {
            id: '_prewarm_' + cid,
            charId: cid,
            row: -999, col: -999,
            playerIndex: 0,
            level: 1, stars: 1,
            hp: 100, maxHp: 100,
            team: 0, isAlive: true
        };
        try {
            var g = createCharacterModel3D(cid, dummy);
            if (g) {
                g.position.set(-9999, -9999, -9999);
                g.visible = false;
                threeScene.add(g);
                dummies.push(g);
            }
        } catch (e) {}
    });

    // Compila tutti gli shader in un colpo solo
    try { threeRenderer.compile(threeScene, threeCamera); } catch (e) {}

    // Rimuovi i dummy — i programmi shader restano compilati in cache GPU
    dummies.forEach(function(g) {
        g.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(function(m) { m.dispose(); });
                } else {
                    child.material.dispose();
                }
            }
        });
        threeScene.remove(g);
    });
}

// ============================================================
//  PRE-WARM: spawna tutti i modelli + compila gli shader PRIMA
//  che inizi il loop di combattimento, così il primo frame è fluido
// ============================================================
function preWarmRound3D() {
    if (!threeScene || !threeRenderer) return;
    if (typeof combatUnits === 'undefined' || !combatUnits) return;

    // 1. Spawna subito tutti i modelli 3D delle unità
    //    (evita la creazione lazy mid-frame al primo render)
    for (var i = 0; i < combatUnits.length; i++) {
        var u = combatUnits[i];
        if (u && typeof threeUnitModels !== 'undefined' && !threeUnitModels[u.id]) {
            if (typeof spawnUnitModel3D === 'function') spawnUnitModel3D(u);
        }
    }

    // 2. Forza la compilazione di tutti gli shader GLSL ora in scena
    //    Three.js compila i shader lazily al primo uso; farlo qui evita
    //    lo stutter al primo frame di combattimento
    var cam = threeCamera;
    if (_fpvCamera) cam = _fpvCamera;
    try { threeRenderer.compile(threeScene, cam); } catch(e) {}
}

function getActiveCamera() {
    var phase = typeof gamePhase !== 'undefined' ? gamePhase : '';
    if ((phase === PHASE_COMBAT || phase === PHASE_RESULT) && !_tacticalView && _fpvCamera && _getAvatarForCamera()) {
        return _fpvCamera;
    }
    return threeCamera;
}

// ---- coordinate bridge ----
function cellToWorld(r, c) {
    return new THREE.Vector3(c * TILE_UNIT + TILE_UNIT / 2, UNIT_BASE_Y, r * TILE_UNIT + TILE_UNIT / 2);
}

function worldToCell(pos) {
    var c = Math.floor(pos.x / TILE_UNIT);
    var r = Math.floor(pos.z / TILE_UNIT);
    return { r: r, c: c };
}

// Project 3D world pos to 2D screen pixel coords (for damage numbers etc.)
function worldToScreen(worldPos) {
    var cam = (typeof getActiveCamera === 'function') ? getActiveCamera() : threeCamera;
    var v = worldPos.clone().project(cam);
    return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
}

// Raycast from screen pixel to board — returns {r, c} or null
function screenToCell(px, py) {
    if (!threeRaycaster || !threeBoardGroup) return null;
    var cam = (typeof getActiveCamera === 'function') ? getActiveCamera() : threeCamera;
    if (!cam) return null;
    var mouse = new THREE.Vector2(
        (px / window.innerWidth) * 2 - 1,
        -(py / window.innerHeight) * 2 + 1
    );
    threeRaycaster.setFromCamera(mouse, cam);
    var hits = threeRaycaster.intersectObjects(threeBoardGroup.children, false);
    if (hits.length > 0) {
        var pt = hits[0].point;
        var c = Math.floor(pt.x / TILE_UNIT);
        var r = Math.floor(pt.z / TILE_UNIT);
        if (isValidCell(r, c)) return { r: r, c: c };
    }
    return null;
}
