// ============================================================
// LOTA AUTO CHESS — three-models.js — 3D Character Models
// ============================================================

// Material helpers
function _mat(hex, opts) {
    var o = opts || {};
    return new THREE.MeshStandardMaterial({
        color: hex,
        roughness: o.rough !== undefined ? o.rough : 0.65,
        metalness: o.metal !== undefined ? o.metal : 0.1,
        emissive:  o.emissive || '#000000',
        emissiveIntensity: o.emissiveI || 0,
        transparent: !!o.opacity,
        opacity: o.opacity || 1.0,
        side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide
    });
}

function _glow(hex, intensity) {
    return new THREE.MeshBasicMaterial({
        color: hex, transparent: true, opacity: intensity || 0.3,
        depthWrite: false
    });
}

// Avatar GLB cache + AnimationMixer
var avatarGLBCache = {};
var avatarGLBLoading = {};
var avatarAnimationMixers = {}; // unitId -> { mixer, animations }

// Dungeon boss GLB cache
var dungeonBossGLBCache = {};
var dungeonBossGLBLoading = {};

// Militia GLB cache
var militiaGLBCache = {};
var militiaGLBLoading = {};

// Structure GLB cache
var structureGLBCache = {};
var structureGLBLoading = {};

function _loadAvatarGLB(classId, callback) {
    if (avatarGLBCache[classId]) {
        console.log('✓ Avatar GLB cached: ' + classId);
        callback(avatarGLBCache[classId]);
        return;
    }
    if (avatarGLBLoading[classId]) {
        avatarGLBLoading[classId].push(callback);
        return;
    }

    avatarGLBLoading[classId] = [callback];

    // Try multiple sources for GLTFLoader
    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);

    if (!GLTFLoaderClass) {
        console.warn('⚠️  GLTFLoader not yet available, retrying in 100ms...');
        setTimeout(function() {
            _loadAvatarGLB(classId, callback);
        }, 100);
        return;
    }

    var avatarUrl = 'models/avatars/' + classId + '.glb?v=' + Date.now();
    console.log('📦 Loading avatar GLB: ' + avatarUrl);
    var loader = new GLTFLoaderClass();
    loader.load(avatarUrl,
        function(gltf) {
            console.log('✓ Avatar GLB loaded: ' + classId, gltf.scene);

            // Measure original scene for scale
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());
            console.log('  Model size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));

            // Cache raw gltf — callers will clone with SkeletonUtils
            var cache = {
                scene: gltf.scene,
                animations: gltf.animations || [],
                naturalHeight: size.y,
                naturalMinY: bbox.min.y
            };
            console.log('  Animations found:', cache.animations.length);
            cache.animations.forEach(function(clip, idx) {
                console.log('    [' + idx + '] ' + clip.name + ' (' + clip.duration.toFixed(2) + 's)');
            });

            avatarGLBCache[classId] = cache;

            var cbs = avatarGLBLoading[classId] || [];
            cbs.forEach(function(cb) { cb(cache); });
            delete avatarGLBLoading[classId];
        },
        function(progress) {
            // progress logging disabled — floods console via tunnel
        },
        function(err) {
            console.error('✗ Failed to load avatar GLB: ' + classId, err);
            callback(null);
            delete avatarGLBLoading[classId];
        }
    );
}

// ── Load Dungeon Boss GLB Model (any dino by key) ──
function _loadDungeonBossGLB(callback, modelKey, modelFile) {
    var bossKey = modelKey || 'velociraptor';
    var filePath = modelFile || 'models/dungeon-boss-velociraptor.glb';

    if (dungeonBossGLBCache[bossKey]) {
        callback(dungeonBossGLBCache[bossKey]);
        return;
    }
    if (dungeonBossGLBLoading[bossKey]) {
        dungeonBossGLBLoading[bossKey].push(callback);
        return;
    }

    dungeonBossGLBLoading[bossKey] = [callback];

    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);

    if (!GLTFLoaderClass) {
        setTimeout(function() {
            _loadDungeonBossGLB(callback, bossKey, filePath);
        }, 100);
        return;
    }

    console.log('Loading dungeon boss GLB: ' + filePath);
    var loader = new GLTFLoaderClass();
    loader.load(filePath,
        function(gltf) {
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());

            gltf.scene.traverse(function(node) {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            var cache = {
                scene: gltf.scene,
                animations: gltf.animations || [],
                naturalHeight: size.y
            };
            console.log('Boss ' + bossKey + ' loaded (' + cache.animations.length + ' anims, h=' + size.y.toFixed(2) + ')');

            dungeonBossGLBCache[bossKey] = cache;

            var cbs = dungeonBossGLBLoading[bossKey] || [];
            cbs.forEach(function(cb) { cb(cache); });
            delete dungeonBossGLBLoading[bossKey];
        },
        undefined,
        function(err) {
            console.error('Failed to load boss GLB: ' + filePath, err);
            callback(null);
            delete dungeonBossGLBLoading[bossKey];
        }
    );
}

// ── Summoned unit GLB loader (zombie, etc.) ──
var summonGLBCache = {};
var summonGLBLoading = {};
function _loadSummonGLB(typeId, callback) {
    if (summonGLBCache[typeId]) { callback(summonGLBCache[typeId]); return; }
    if (summonGLBLoading[typeId]) { summonGLBLoading[typeId].push(callback); return; }
    summonGLBLoading[typeId] = [callback];
    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) { setTimeout(function() { _loadSummonGLB(typeId, callback); }, 100); return; }
    var loader = new GLTFLoaderClass();
    loader.load('models/summoned/' + typeId + '.glb',
        function(gltf) {
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());
            summonGLBCache[typeId] = { scene: gltf.scene, animations: gltf.animations || [], naturalHeight: size.y, naturalMinY: bbox.min.y };
            var cbs = summonGLBLoading[typeId] || [];
            cbs.forEach(function(cb) { cb(summonGLBCache[typeId]); });
            delete summonGLBLoading[typeId];
        }, null,
        function(err) { console.error('✗ Failed to load summon GLB: ' + typeId, err); var cbs = summonGLBLoading[typeId] || []; cbs.forEach(function(cb) { cb(null); }); delete summonGLBLoading[typeId]; }
    );
}

// ── Militia GLB loader ──
function _loadMilitiaGLB(typeId, callback) {
    if (militiaGLBCache[typeId]) { callback(militiaGLBCache[typeId]); return; }
    if (militiaGLBLoading[typeId]) { militiaGLBLoading[typeId].push(callback); return; }
    militiaGLBLoading[typeId] = [callback];

    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) {
        setTimeout(function() { _loadMilitiaGLB(typeId, callback); }, 100);
        return;
    }

    var loader = new GLTFLoaderClass();
    loader.load('models/armata/' + typeId + '.glb',
        function(gltf) {
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());
            var cache = {
                scene: gltf.scene,
                animations: gltf.animations || [],
                naturalHeight: size.y,
                naturalMinY: bbox.min.y
            };
            militiaGLBCache[typeId] = cache;
            var cbs = militiaGLBLoading[typeId] || [];
            cbs.forEach(function(cb) { cb(cache); });
            delete militiaGLBLoading[typeId];
        },
        null,
        function(err) {
            console.error('✗ Failed to load militia GLB: ' + typeId, err);
            var cbs = militiaGLBLoading[typeId] || [];
            cbs.forEach(function(cb) { cb(null); });
            delete militiaGLBLoading[typeId];
        }
    );
}

// ── Structure GLB loader ──
function _loadStructureGLB(baseType, callback) {
    if (structureGLBCache[baseType]) { callback(structureGLBCache[baseType]); return; }
    if (structureGLBLoading[baseType]) { structureGLBLoading[baseType].push(callback); return; }
    structureGLBLoading[baseType] = [callback];

    var GLTFLoaderClass = window.GLTFLoader || (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) || (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) {
        setTimeout(function() { _loadStructureGLB(baseType, callback); }, 100);
        return;
    }

    var loader = new GLTFLoaderClass();
    loader.load('models/structures/' + baseType + '.glb',
        function(gltf) {
            var bbox = new THREE.Box3().setFromObject(gltf.scene);
            var size = bbox.getSize(new THREE.Vector3());
            var cache = {
                scene: gltf.scene,
                naturalHeight: size.y,
                naturalMinY: bbox.min.y
            };
            structureGLBCache[baseType] = cache;
            var cbs = structureGLBLoading[baseType] || [];
            cbs.forEach(function(cb) { cb(cache); });
            delete structureGLBLoading[baseType];
        },
        null,
        function(err) {
            console.error('✗ Failed to load structure GLB: ' + baseType, err);
            var cbs = structureGLBLoading[baseType] || [];
            cbs.forEach(function(cb) { cb(null); });
            delete structureGLBLoading[baseType];
        }
    );
}

// ── Setup AnimationMixer + avvia idle ──
// Cerca un'animazione per substring nei clip (case-insensitive).
// Prova prima match esatto su priorityList, poi substring su tutti i clip.
function _findClipByKeywords(clips, keywords) {
    var kl = keywords.map(function(k){ return k.toLowerCase(); });
    // 1. exact match
    for (var i = 0; i < clips.length; i++) {
        var n = clips[i].name.toLowerCase();
        for (var k = 0; k < kl.length; k++) {
            if (n === kl[k]) return clips[i];
        }
    }
    // 2. substring match (priorità all'ordine dei keywords)
    for (var k = 0; k < kl.length; k++) {
        for (var i = 0; i < clips.length; i++) {
            if (clips[i].name.toLowerCase().includes(kl[k])) return clips[i];
        }
    }
    return null;
}

function _setupAvatarMixer(group, meshRoot, clips) {
    var mixer = new THREE.AnimationMixer(meshRoot);
    group._avatarAnimator = {
        mixer: mixer,
        clips: clips,
        actions: {},
        currentAction: null,
        idleClipName:       null,
        walkClipName:       null,
        runClipName:        null,
        sword1ClipName:     null,
        sword2ClipName:     null,
        swordFinClipName:   null,
        swordRegClipName:   null,
        // abilità guerriero
        colpoClipName:      null,
        gridoClipName:      null,
        furiaEnterClipName: null,
        furiaIdleClipName:  null,
        attacking:          false,
        attackTimer:        0,
        furiaActive:        false
    };

    // Guerriero idle con spada; fallback a idle_loop generico
    var idleClip = _findClipByKeywords(clips, ['sword_idle', 'idle_loop', 'idle_no_loop', 'idle_foldarms_loop', 'idle']);
    var walkClip = _findClipByKeywords(clips, ['jog_fwd_loop', 'walk_loop', 'walk_formal_loop', 'walk']);
    var runClip  = _findClipByKeywords(clips, ['sprint_loop', 'jog_fwd_loop', 'run']);

    console.log('🎬 Idle trovato:', idleClip ? idleClip.name : 'NESSUNO');
    console.log('🎬 Walk trovato:', walkClip ? walkClip.name : 'NESSUNO');
    console.log('🎬 Run  trovato:', runClip  ? runClip.name  : 'NESSUNO');

    // Crea solo le action necessarie
    if (idleClip) {
        var idleAction = mixer.clipAction(idleClip);
        idleAction.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[idleClip.name] = idleAction;
        group._avatarAnimator.idleClipName = idleClip.name;
    }
    if (walkClip && walkClip !== idleClip) {
        var walkAction = mixer.clipAction(walkClip);
        walkAction.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[walkClip.name] = walkAction;
        group._avatarAnimator.walkClipName = walkClip.name;
    }
    if (runClip && runClip !== idleClip && runClip !== walkClip) {
        var runAction = mixer.clipAction(runClip);
        runAction.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[runClip.name] = runAction;
        group._avatarAnimator.runClipName = runClip.name;
    }

    // UAL1 sword clips as fallback (will be overridden by UAL2 clips if available)
    var _s1fb = _findClipByKeywords(clips, ['sword_attack']);
    var _s2fb = _findClipByKeywords(clips, ['sword_attack_rm']);
    if (_s1fb) {
        var _a1fb = mixer.clipAction(_s1fb);
        _a1fb.loop = THREE.LoopOnce; _a1fb.clampWhenFinished = true; _a1fb.timeScale = 1.9;
        group._avatarAnimator.actions[_s1fb.name] = _a1fb;
        group._avatarAnimator.sword1ClipName   = _s1fb.name;
        group._avatarAnimator.sword2ClipName   = _s1fb.name; // same until UAL2 loads
        group._avatarAnimator.swordRegClipName = _s1fb.name;
    }
    if (_s2fb && _s2fb !== _s1fb) {
        var _a2fb = mixer.clipAction(_s2fb);
        _a2fb.loop = THREE.LoopOnce; _a2fb.clampWhenFinished = true; _a2fb.timeScale = 1.9;
        group._avatarAnimator.actions[_s2fb.name] = _a2fb;
        group._avatarAnimator.swordFinClipName = _s2fb.name;
    }

    // ── Ability animations (guerriero): colpo / grido / furia ──
    // Colpo Devastante: cloned sword clip played slow for heavy-blow feel
    var _colpoSrc = _s2fb || _s1fb;
    if (_colpoSrc) {
        var _colpoClip = _colpoSrc.clone();
        _colpoClip.name = 'colpo_devastante';
        var _colpoAct = mixer.clipAction(_colpoClip);
        _colpoAct.loop = THREE.LoopOnce; _colpoAct.clampWhenFinished = true; _colpoAct.timeScale = 0.6;
        group._avatarAnimator.actions['colpo_devastante'] = _colpoAct;
        group._avatarAnimator.colpoClipName = 'colpo_devastante';
    }
    // Grido di Guerra: punch gesture for war-cry shout
    var _gridoSrc = _findClipByKeywords(clips, ['punch_cross', 'punch_hook', 'overhead', 'slash_upper']);
    if (_gridoSrc) {
        var _gridoClip = _gridoSrc.clone();
        _gridoClip.name = 'grido_guerra';
        var _gridoAct = mixer.clipAction(_gridoClip);
        _gridoAct.loop = THREE.LoopOnce; _gridoAct.clampWhenFinished = true; _gridoAct.timeScale = 1.1;
        group._avatarAnimator.actions['grido_guerra'] = _gridoAct;
        group._avatarAnimator.gridoClipName = 'grido_guerra';
    }
    // Furia Immortale enter (one-shot) — power-up pose
    var _furiaEntSrc = _findClipByKeywords(clips, ['spell_simple_enter', 'cast_enter', 'power_up_enter', 'spell_enter']);
    if (_furiaEntSrc) {
        var _furiaEntClip = _furiaEntSrc.clone();
        _furiaEntClip.name = 'furia_enter';
        var _furiaEntAct = mixer.clipAction(_furiaEntClip);
        _furiaEntAct.loop = THREE.LoopOnce; _furiaEntAct.clampWhenFinished = true; _furiaEntAct.timeScale = 1.0;
        group._avatarAnimator.actions['furia_enter'] = _furiaEntAct;
        group._avatarAnimator.furiaEnterClipName = 'furia_enter';
    }
    // Furia Immortale idle (loop) — sustained power-up stance
    var _furiaIdlSrc = _findClipByKeywords(clips, ['spell_simple_idle', 'cast_idle', 'power_up_idle', 'spell_idle']);
    if (_furiaIdlSrc) {
        var _furiaIdlClip = _furiaIdlSrc.clone();
        _furiaIdlClip.name = 'furia_idle';
        var _furiaIdlAct = mixer.clipAction(_furiaIdlClip);
        _furiaIdlAct.loop = THREE.LoopRepeat; _furiaIdlAct.timeScale = 1.0;
        group._avatarAnimator.actions['furia_idle'] = _furiaIdlAct;
        group._avatarAnimator.furiaIdleClipName = 'furia_idle';
    }

    // Avvia idle subito
    if (idleClip) {
        _playAvatarAnimation(group, idleClip.name);
        console.log('🎬 ▶ Idle avviato:', idleClip.name);
    } else {
        // Fallback: primo clip non-TPose
        for (var j = 0; j < clips.length; j++) {
            if (!clips[j].name.toLowerCase().includes('tpose')) {
                var fbAction = mixer.clipAction(clips[j]);
                fbAction.loop = THREE.LoopRepeat;
                group._avatarAnimator.actions[clips[j].name] = fbAction;
                _playAvatarAnimation(group, clips[j].name);
                console.log('🎬 ▶ Fallback idle:', clips[j].name);
                break;
            }
        }
    }
}

// ── Play animation on avatar ──
function _playAvatarAnimation(group, animName, duration) {
    if (!group._avatarAnimator) return false;

    var animator = group._avatarAnimator;
    var action = animator.actions[animName];

    if (!action) {
        console.warn('Animation not found: ' + animName);
        return false;
    }

    // Cross-fade from current to new
    if (animator.currentAction && animator.currentAction !== action) {
        var fadeDuration = duration || 0.5;
        action.reset();
        action.play();
        animator.currentAction.crossFadeTo(action, fadeDuration, true);
    } else if (!animator.currentAction) {
        action.reset();
        action.play();
    }

    animator.currentAction = action;
    return true;
}

// ── Switch animation with smooth blending ──
function _switchAvatarAnimation(group, fromAnim, toAnim, blendDuration) {
    if (!group._avatarAnimator) return;

    var animator = group._avatarAnimator;
    var fromAction = animator.actions[fromAnim];
    var toAction = animator.actions[toAnim];

    if (!fromAction || !toAction) {
        console.warn('Animation not found');
        return;
    }

    var fadeDur = blendDuration || 0.5;
    toAction.reset();
    toAction.play();
    fromAction.crossFadeTo(toAction, fadeDur, true);
    animator.currentAction = toAction;
}

// ====================================================================
//  MILITIA ANIMATION SYSTEM
// ====================================================================

var MILITIA_CLIP_MAP = {
    soldato:     { idle:'Idle', walk:'Walk', atk1:'Sword_Attack',   atk2:'Sword_Attack2',  hit:'RecieveHit', death:'Death' },
    arciere:     { idle:'Idle', walk:'Walk', atk1:'Bow_Shoot',      atk2:'Bow_Draw',       hit:'RecieveHit', death:'Death' },
    guaritore:   { idle:'Idle', walk:'Walk', atk1:'Spell1',         atk2:'Staff_Attack',   hit:'RecieveHit', death:'Death' },
    esploratore: { idle:'Idle', walk:'Walk', atk1:'Dagger_Attack',  atk2:'Dagger_Attack2', hit:'RecieveHit', death:'Death' },
};

function _setupMilitiaMixer(g, modelRoot, clips, typeId) {
    var cm = MILITIA_CLIP_MAP[typeId] || MILITIA_CLIP_MAP['soldato'];
    var mixer = new THREE.AnimationMixer(modelRoot);

    var animator = {
        mixer:         mixer,
        actions:       {},
        currentAction: null,
        idleClipName:  null,
        walkClipName:  null,
        atk1ClipName:  null,
        atk2ClipName:  null,
        hitClipName:   null,
        deathClipName: null,
        attacking:     false,
        attackTimer:   0,
        dead:          false
    };

    var byName = {};
    clips.forEach(function(c) { byName[c.name] = c; });

    function reg(name, loop, ts) {
        if (!byName[name]) return null;
        var act = mixer.clipAction(byName[name]);
        act.loop = loop || THREE.LoopRepeat;
        act.clampWhenFinished = (loop === THREE.LoopOnce);
        act.timeScale = ts || 1.0;
        animator.actions[name] = act;
        return name;
    }

    animator.idleClipName  = reg(cm.idle);
    animator.walkClipName  = reg(cm.walk);
    animator.atk1ClipName  = reg(cm.atk1, THREE.LoopOnce, 1.6);
    animator.atk2ClipName  = reg(cm.atk2, THREE.LoopOnce, 1.6);
    animator.hitClipName   = reg(cm.hit,  THREE.LoopOnce, 2.0);
    animator.deathClipName = reg(cm.death,THREE.LoopOnce, 1.0);

    // Start idle immediately
    if (animator.idleClipName && animator.actions[animator.idleClipName]) {
        animator.actions[animator.idleClipName].play();
        animator.currentAction = animator.actions[animator.idleClipName];
    }

    g._militiaAnimator = animator;
}

function _playMilitiaAnimation(g, animName, blendTime) {
    var anim = g._militiaAnimator;
    if (!anim) return;
    var action = anim.actions[animName];
    if (!action) return;
    var fade = (blendTime !== undefined) ? blendTime : 0.15;
    if (anim.currentAction && anim.currentAction !== action) {
        action.reset();
        action.play();
        anim.currentAction.crossFadeTo(action, fade, true);
    } else if (!anim.currentAction) {
        action.reset();
        action.play();
    }
    anim.currentAction = action;
}

// ====================================================================
//  MODEL FACTORIES — each returns a THREE.Group
// ====================================================================

function createCharacterModel3D(charId, unit) {
    switch (charId) {
        case 'Babidi':  return _buildBabidi();
        case 'Caronte': return _buildCaronte();
        case 'Valerio': return _buildValerio();
        case 'Yujin':   return _buildYujin();
        case 'WMS':     return _buildWMS();
        default:
            if (charId && charId.startsWith('avatar_')) return _buildAvatar(unit);
            if (charId && charId.startsWith('struct_')) return _buildStructure(unit);
            if (charId && charId.startsWith('militia_')) return _buildMilitia(unit);
            if (charId && charId.startsWith('summon_')) return _buildSummoned(unit);
            if (charId && charId.startsWith('camp_'))  return _buildCampCreep(unit);
            if (charId && charId.startsWith('boss_')) {
                console.log('🎨 Building DUNGEON BOSS:', charId, 'at', unit.row, unit.col);
                return _buildDungeonBoss(unit);
            }
            if (charId && (charId.startsWith('creep_') || charId === 'creep')) return _buildBossCreep(unit);
            return _buildDefault();
    }
}

// ─── BABIDI — Fat Merchant ───────────────────────────────────
function _buildBabidi() {
    var g = new THREE.Group(); g.name = 'Babidi';
    var colors = CHAR_COLORS.Babidi;

    // body (fat ellipsoid)
    var body = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 16, 12),
        _mat(colors.fill, { rough: 0.7 })
    );
    body.scale.set(1.15, 0.9, 1.0);
    body.position.y = 0.38;
    body.castShadow = true;
    body.name = 'body';
    g.add(body);

    // robe bottom
    var robe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.46, 0.25, 12),
        _mat(colors.stroke, { rough: 0.8 })
    );
    robe.position.y = 0.12;
    robe.castShadow = true;
    g.add(robe);

    // head
    var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 12, 10),
        _mat('#d4a574')
    );
    head.position.y = 0.78;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // turban
    var turban = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        _mat('#fbbf24', { rough: 0.5, metal: 0.2 })
    );
    turban.position.y = 0.85;
    turban.scale.set(1.1, 0.8, 1.0);
    g.add(turban);

    // turban top bulge
    var bulge = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        _mat('#fbbf24', { rough: 0.4, metal: 0.3 })
    );
    bulge.position.y = 0.98;
    g.add(bulge);

    // ruby
    var ruby = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        _mat('#ef4444', { emissive: '#ef4444', emissiveI: 0.5, rough: 0.2, metal: 0.5 })
    );
    ruby.position.set(0, 0.9, 0.18);
    ruby.name = 'ruby';
    g.add(ruby);

    // eyes
    var eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    var eyeMat = _mat('#1e293b');
    var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.07, 0.77, 0.16);
    g.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.07, 0.77, 0.16);
    g.add(eyeR);

    // arms (small stubs)
    var armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.22, 6);
    var armMat = _mat(colors.fill, { rough: 0.7 });
    var armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.42, 0.4, 0);
    armL.rotation.z = 0.4;
    armL.castShadow = true;
    armL.name = 'armL';
    g.add(armL);
    var armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.42, 0.4, 0);
    armR.rotation.z = -0.4;
    armR.castShadow = true;
    armR.name = 'armR';
    g.add(armR);

    // coin orbs (will be animated)
    for (var i = 0; i < 3; i++) {
        var coin = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 6),
            _glow('#fbbf24', 0.7)
        );
        coin.name = 'coin_' + i;
        coin.position.set(0, 0.5, 0);
        g.add(coin);
    }

    return g;
}

// ─── CARONTE — Professor Mage ────────────────────────────────
function _buildCaronte() {
    var g = new THREE.Group(); g.name = 'Caronte';
    var colors = CHAR_COLORS.Caronte;

    // robe body (tall cylinder)
    var body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.32, 0.65, 10),
        _mat(colors.fill, { rough: 0.75 })
    );
    body.position.y = 0.32;
    body.castShadow = true;
    body.name = 'body';
    g.add(body);

    // robe bottom flare
    var flare = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.38, 0.12, 10),
        _mat(colors.stroke, { rough: 0.8 })
    );
    flare.position.y = 0.06;
    g.add(flare);

    // head
    var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 10),
        _mat('#c9ccd4')
    );
    head.position.y = 0.82;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // mortarboard cap
    var capBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.03, 0.42),
        _mat('#1e293b', { rough: 0.9 })
    );
    capBoard.position.y = 1.0;
    capBoard.rotation.y = Math.PI / 4;
    g.add(capBoard);

    // cap crown
    var capCrown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8),
        _mat('#1e293b', { rough: 0.9 })
    );
    capCrown.position.y = 0.95;
    g.add(capCrown);

    // tassel
    var tassel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.02, 0.15, 4),
        _mat('#fbbf24', { rough: 0.4, metal: 0.3 })
    );
    tassel.position.set(0.18, 0.92, 0.18);
    tassel.rotation.z = 0.3;
    tassel.name = 'tassel';
    g.add(tassel);

    // glasses
    var glassGeo = new THREE.TorusGeometry(0.04, 0.008, 6, 12);
    var glassMat = _mat('#60a5fa', { rough: 0.3, metal: 0.6, emissive: '#60a5fa', emissiveI: 0.2 });
    var glassL = new THREE.Mesh(glassGeo, glassMat);
    glassL.position.set(-0.06, 0.82, 0.14);
    glassL.rotation.y = Math.PI / 2;
    g.add(glassL);
    var glassR = new THREE.Mesh(glassGeo, glassMat);
    glassR.position.set(0.06, 0.82, 0.14);
    glassR.rotation.y = Math.PI / 2;
    g.add(glassR);

    // bridge
    var bridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.06, 4),
        glassMat
    );
    bridge.position.set(0, 0.82, 0.14);
    bridge.rotation.z = Math.PI / 2;
    g.add(bridge);

    // professor arms (robe sleeves)
    var cArmGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.25, 6);
    var cArmMat = _mat(colors.fill, { rough: 0.75 });
    var armL = new THREE.Mesh(cArmGeo, cArmMat);
    armL.position.set(-0.24, 0.42, 0.05);
    armL.rotation.z = 0.5;
    armL.castShadow = true;
    armL.name = 'armL';
    g.add(armL);
    var armR = new THREE.Mesh(cArmGeo, cArmMat);
    armR.position.set(0.24, 0.42, 0.05);
    armR.rotation.z = -0.5;
    armR.castShadow = true;
    armR.name = 'armR';
    g.add(armR);
    // hands
    var handMat = _mat('#c9ccd4');
    var handL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), handMat);
    handL.position.set(-0.35, 0.32, 0.06);
    handL.name = 'handL';
    g.add(handL);
    var handR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), handMat);
    handR.position.set(0.35, 0.32, 0.06);
    handR.name = 'handR';
    g.add(handR);

    // floating tome
    var book = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.2, 0.04),
        _mat('#475569', { emissive: '#60a5fa', emissiveI: 0.15 })
    );
    book.position.set(-0.45, 0.55, 0);
    book.rotation.y = 0.2;
    book.name = 'book';
    g.add(book);

    // arcane orbs
    for (var i = 0; i < 2; i++) {
        var orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 6, 6),
            _glow('#60a5fa', 0.5)
        );
        orb.name = 'rune_' + i;
        g.add(orb);
    }

    return g;
}

// ─── VALERIO — Worm Tank ─────────────────────────────────────
function _buildValerio() {
    var g = new THREE.Group(); g.name = 'Valerio';
    var colors = CHAR_COLORS.Valerio;

    // 4 body segments
    for (var s = 0; s < 4; s++) {
        var sw = 0.34 - s * 0.015;
        var sh = 0.18;
        var seg = new THREE.Mesh(
            new THREE.CylinderGeometry(sw, sw, sh, 10),
            _mat(colors.fill, { rough: 0.55, metal: 0.2 })
        );
        seg.position.y = 0.12 + s * sh * 0.85;
        seg.castShadow = true;
        seg.name = 'seg_' + s;
        g.add(seg);

        // armor ring on each segment
        var ring = new THREE.Mesh(
            new THREE.TorusGeometry(sw + 0.02, 0.02, 6, 12),
            _mat(colors.stroke, { rough: 0.4, metal: 0.35 })
        );
        ring.position.y = seg.position.y;
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
    }

    // spines (dorsal)
    for (var sp = 0; sp < 5; sp++) {
        var spine = new THREE.Mesh(
            new THREE.ConeGeometry(0.025, 0.12, 4),
            _mat('#ea580c', { rough: 0.5 })
        );
        var angle = (sp / 5) * Math.PI - Math.PI / 2;
        spine.position.set(
            Math.cos(angle) * 0.2,
            0.7,
            Math.sin(angle) * 0.2
        );
        spine.name = 'spine_' + sp;
        g.add(spine);
    }

    // eyes
    var eyeGeo = new THREE.SphereGeometry(0.035, 6, 6);
    var eyeWhite = _mat('#ffffff');
    var eyeL = new THREE.Mesh(eyeGeo, eyeWhite);
    eyeL.position.set(-0.12, 0.55, 0.28);
    eyeL.name = 'eyeL';
    g.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, eyeWhite);
    eyeR.position.set(0.12, 0.55, 0.28);
    eyeR.name = 'eyeR';
    g.add(eyeR);
    var pupilGeo = new THREE.SphereGeometry(0.02, 6, 6);
    var pupilMat = _mat('#1e293b');
    g.add(new THREE.Mesh(pupilGeo, pupilMat).translateX(-0.12).translateY(0.55).translateZ(0.3));
    g.add(new THREE.Mesh(pupilGeo, pupilMat).translateX(0.12).translateY(0.55).translateZ(0.3));

    // shield emblem (flat circle on front)
    var shield = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 6),
        _mat(colors.fill, { emissive: colors.fill, emissiveI: 0.2, rough: 0.4, metal: 0.3 })
    );
    shield.position.set(0, 0.35, 0.35);
    shield.rotation.x = -0.1;
    g.add(shield);

    return g;
}

// ─── YUJIN — Viking Berserker ────────────────────────────────
function _buildYujin() {
    var g = new THREE.Group(); g.name = 'Yujin';
    var colors = CHAR_COLORS.Yujin;

    // torso (broad box)
    var torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.4, 0.3),
        _mat(colors.fill, { rough: 0.6 })
    );
    torso.position.y = 0.5;
    torso.castShadow = true;
    torso.name = 'body';
    g.add(torso);

    // belt
    var belt = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.06, 0.32),
        _mat('#8b6b4a', { rough: 0.7 })
    );
    belt.position.y = 0.32;
    g.add(belt);

    // belt buckle
    var buckle = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 6),
        _mat('#d4a43a', { metal: 0.6, rough: 0.3 })
    );
    buckle.position.set(0, 0.32, 0.17);
    g.add(buckle);

    // legs
    var legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.3, 6);
    var legMat = _mat(colors.stroke, { rough: 0.7 });
    var legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.12, 0.15, 0);
    legL.castShadow = true;
    legL.name = 'legL';
    g.add(legL);
    var legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.12, 0.15, 0);
    legR.castShadow = true;
    legR.name = 'legR';
    g.add(legR);

    // arms
    var armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.32, 6);
    var armMat = _mat(colors.fill, { rough: 0.6 });
    var armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.34, 0.5, 0);
    armL.rotation.z = 0.25;
    armL.castShadow = true;
    armL.name = 'armL';
    g.add(armL);
    var armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.34, 0.5, 0);
    armR.rotation.z = -0.25;
    armR.castShadow = true;
    armR.name = 'armR';
    g.add(armR);

    // fur mantle (cape on shoulders)
    var cape = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.35),
        _mat('#7c5a3a', { rough: 0.9, doubleSide: true })
    );
    cape.position.set(0, 0.58, -0.16);
    cape.rotation.x = 0.15;
    cape.name = 'cape';
    g.add(cape);

    // head
    var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        _mat('#e4c9a0')
    );
    head.position.y = 0.82;
    head.castShadow = true;
    head.name = 'head';
    g.add(head);

    // helmet dome
    var helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        _mat('#9ca3af', { rough: 0.35, metal: 0.55 })
    );
    helmet.position.y = 0.84;
    g.add(helmet);

    // helmet rim
    var rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.015, 6, 16),
        _mat('#d4a43a', { rough: 0.3, metal: 0.6 })
    );
    rim.position.y = 0.84;
    rim.rotation.x = Math.PI / 2;
    g.add(rim);

    // nose guard
    var noseGuard = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.12, 0.02),
        _mat('#9ca3af', { metal: 0.5, rough: 0.3 })
    );
    noseGuard.position.set(0, 0.82, 0.14);
    g.add(noseGuard);

    // HORNS
    var hornGeo = new THREE.ConeGeometry(0.025, 0.22, 5);
    var hornMat = _mat('#d4a43a', { rough: 0.3, metal: 0.5 });
    var hornL = new THREE.Mesh(hornGeo, hornMat);
    hornL.position.set(-0.18, 0.98, 0);
    hornL.rotation.z = 0.5;
    g.add(hornL);
    var hornR = new THREE.Mesh(hornGeo, hornMat);
    hornR.position.set(0.18, 0.98, 0);
    hornR.rotation.z = -0.5;
    g.add(hornR);

    // eyes
    var eyeGeo = new THREE.SphereGeometry(0.02, 6, 6);
    var eyeL2 = new THREE.Mesh(eyeGeo, _mat('#ffffff'));
    eyeL2.position.set(-0.05, 0.83, 0.12);
    eyeL2.name = 'eyeL';
    g.add(eyeL2);
    var eyeR2 = new THREE.Mesh(eyeGeo, _mat('#ffffff'));
    eyeR2.position.set(0.05, 0.83, 0.12);
    eyeR2.name = 'eyeR';
    g.add(eyeR2);

    // battle axe
    var axeGroup = new THREE.Group();
    axeGroup.name = 'axe';
    // handle
    var handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.55, 4),
        _mat('#7c5a3a', { rough: 0.8 })
    );
    axeGroup.add(handle);
    // blade
    var blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.15, 0.02),
        _mat('#d1d5db', { rough: 0.2, metal: 0.7 })
    );
    blade.position.set(0.08, 0.22, 0);
    axeGroup.add(blade);
    axeGroup.position.set(0.42, 0.55, 0.05);
    axeGroup.rotation.z = -0.2;
    g.add(axeGroup);

    return g;
}

// ─── WMS — Mystic Entity ────────────────────────────────────
function _buildWMS() {
    var g = new THREE.Group(); g.name = 'WMS';
    var colors = CHAR_COLORS.WMS;

    // outer aura sphere (transparent)
    var aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 12),
        new THREE.MeshBasicMaterial({
            color: colors.fill, transparent: true, opacity: 0.06,
            depthWrite: false, side: THREE.DoubleSide
        })
    );
    aura.position.y = 0.55;
    aura.name = 'aura';
    g.add(aura);

    // core orb (glowing)
    var core = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 14, 10),
        _mat(colors.fill, { emissive: colors.fill, emissiveI: 0.6, rough: 0.2, metal: 0.3 })
    );
    core.position.y = 0.55;
    core.castShadow = true;
    core.name = 'core';
    g.add(core);

    // inner bright center
    var inner = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#fef9c3' })
    );
    inner.position.y = 0.55;
    g.add(inner);

    // eyes (purple)
    var eyeGeo = new THREE.SphereGeometry(0.025, 6, 6);
    var eyeMat = _mat('#7c3aed', { emissive: '#7c3aed', emissiveI: 0.5 });
    var eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 0.56, 0.18);
    g.add(eyeL);
    var eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 0.56, 0.18);
    g.add(eyeR);

    // energy wisps (3 orbiting spheres)
    for (var i = 0; i < 3; i++) {
        var wisp = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 6),
            _glow('#a78bfa', 0.7)
        );
        wisp.name = 'wisp_' + i;
        wisp.position.y = 0.55;
        g.add(wisp);
    }

    // sparkle points
    var sparkGeo = new THREE.BufferGeometry();
    var sparkPositions = new Float32Array(15 * 3);
    for (var i = 0; i < 15; i++) {
        sparkPositions[i * 3]     = (Math.random() - 0.5) * 0.8;
        sparkPositions[i * 3 + 1] = 0.2 + Math.random() * 0.7;
        sparkPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    var sparkMat = new THREE.PointsMaterial({
        color: '#ffffff', size: 0.03, transparent: true, opacity: 0.4,
        depthWrite: false, sizeAttenuation: true
    });
    var sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.name = 'sparks';
    g.add(sparks);

    return g;
}

// ════════════════════════════════════════════════════════════
//  CAMP CREEPS — 4 tiers, each progressively more terrifying
// ════════════════════════════════════════════════════════════

function _buildCampCreep(unit) {
    // Determine tier from unit HP
    var tier = 1;
    if (unit) {
        if (unit.maxHp >= 20000) tier = 4;
        else if (unit.maxHp >= 8000) tier = 3;
        else if (unit.maxHp >= 2000) tier = 2;
    }
    switch (tier) {
        case 1: return _buildCampT1();
        case 2: return _buildCampT2();
        case 3: return _buildCampT3();
        case 4: return _buildCampT4();
        default: return _buildCampT1();
    }
}

// ── Tier 1: SENTINELLA — Small imp/goblin ──
function _buildCampT1() {
    var g = new THREE.Group(); g.name = 'camp_creep';
    // squat body
    var body = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 6),
        _mat('#991b1b', { rough: 0.6, emissive: '#ef4444', emissiveI: 0.1 })
    );
    body.position.y = 0.22;
    body.scale.set(1.1, 0.85, 0.9);
    body.castShadow = true;
    body.name = 'body';
    g.add(body);
    // head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), _mat('#b91c1c', { rough: 0.5 }));
    head.position.y = 0.4;
    g.add(head);
    // tiny horns
    for (var h = 0; h < 2; h++) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.08, 4), _mat('#7f1d1d'));
        horn.position.set(h === 0 ? -0.06 : 0.06, 0.48, 0);
        horn.rotation.z = h === 0 ? 0.3 : -0.3;
        g.add(horn);
    }
    // beady eyes
    var eyeM = _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 0.5 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), eyeM).translateX(-0.05).translateY(0.42).translateZ(0.08));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), eyeM).translateX(0.05).translateY(0.42).translateZ(0.08));
    // stubby legs
    for (var l = 0; l < 2; l++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 5), _mat('#7f1d1d', { rough: 0.7 }));
        leg.position.set(l === 0 ? -0.08 : 0.08, 0.06, 0);
        g.add(leg);
    }
    return g;
}

// ── Tier 2: GUARDIANO — Armored wolf-beast ──
function _buildCampT2() {
    var g = new THREE.Group(); g.name = 'camp_creep';
    // elongated beast body
    var body = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 10, 8),
        _mat('#991b1b', { rough: 0.5, emissive: '#dc2626', emissiveI: 0.12 })
    );
    body.position.y = 0.3;
    body.scale.set(1.3, 0.9, 0.95);
    body.castShadow = true;
    body.name = 'body';
    g.add(body);
    // head (wolf snout)
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), _mat('#b91c1c', { rough: 0.45 }));
    head.position.set(0, 0.42, 0.15);
    head.scale.set(0.9, 0.8, 1.2);
    g.add(head);
    // snout
    var snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 5), _mat('#991b1b'));
    snout.position.set(0, 0.4, 0.3);
    snout.rotation.x = -Math.PI / 2;
    g.add(snout);
    // horns (bigger)
    for (var h = 0; h < 2; h++) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 5), _mat('#4a0000', { rough: 0.4, metal: 0.3 }));
        horn.position.set(h === 0 ? -0.1 : 0.1, 0.55, 0.05);
        horn.rotation.z = h === 0 ? 0.35 : -0.35;
        g.add(horn);
    }
    // glowing eyes
    var eyeM = _mat('#fbbf24', { emissive: '#fbbf24', emissiveI: 0.7 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), eyeM).translateX(-0.06).translateY(0.44).translateZ(0.22));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), eyeM).translateX(0.06).translateY(0.44).translateZ(0.22));
    // 4 legs
    for (var l = 0; l < 4; l++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.2, 5), _mat('#7f1d1d', { rough: 0.6 }));
        leg.position.set((l < 2 ? -0.12 : 0.12), 0.1, (l % 2 === 0 ? 0.1 : -0.1));
        leg.castShadow = true;
        g.add(leg);
    }
    // back spikes
    for (var s = 0; s < 3; s++) {
        var spike = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 4), _mat('#991b1b', { emissive: '#ef4444', emissiveI: 0.15 }));
        spike.position.set(0, 0.45 + s * 0.02, -0.05 + s * 0.05);
        g.add(spike);
    }
    // armor plate on chest
    var plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.04), _mat('#4a0000', { rough: 0.3, metal: 0.4 }));
    plate.position.set(0, 0.3, 0.22);
    g.add(plate);
    return g;
}

// ── Tier 3: CUSTODE — Armored demon golem ──
function _buildCampT3() {
    var g = new THREE.Group(); g.name = 'camp_creep';
    // massive torso
    var body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.45, 0.3),
        _mat('#7f1d1d', { rough: 0.4, metal: 0.3, emissive: '#dc2626', emissiveI: 0.15 })
    );
    body.position.y = 0.42;
    body.castShadow = true;
    body.name = 'body';
    g.add(body);
    // head (skull-like)
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), _mat('#991b1b', { rough: 0.4, metal: 0.2 }));
    head.position.y = 0.75;
    head.scale.set(1.0, 0.85, 0.9);
    g.add(head);
    // jaw
    var jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.08), _mat('#7f1d1d'));
    jaw.position.set(0, 0.66, 0.1);
    g.add(jaw);
    // massive horns
    for (var h = 0; h < 2; h++) {
        var horn = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.25, 5),
            _mat('#4a0000', { rough: 0.3, metal: 0.4, emissive: '#ef4444', emissiveI: 0.1 })
        );
        horn.position.set(h === 0 ? -0.14 : 0.14, 0.88, 0);
        horn.rotation.z = h === 0 ? 0.45 : -0.45;
        g.add(horn);
    }
    // burning eyes
    var eyeM = _mat('#ef4444', { emissive: '#ef4444', emissiveI: 1.0 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeM).translateX(-0.06).translateY(0.76).translateZ(0.12));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeM).translateX(0.06).translateY(0.76).translateZ(0.12));
    // thick arms
    for (var a = 0; a < 2; a++) {
        var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 6), _mat('#7f1d1d', { rough: 0.5 }));
        arm.position.set(a === 0 ? -0.28 : 0.28, 0.4, 0.05);
        arm.rotation.z = a === 0 ? 0.2 : -0.2;
        arm.castShadow = true;
        g.add(arm);
        // fist
        var fist = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), _mat('#991b1b', { rough: 0.4, metal: 0.3 }));
        fist.position.set(a === 0 ? -0.32 : 0.32, 0.2, 0.06);
        g.add(fist);
    }
    // legs (thick pillars)
    for (var l = 0; l < 2; l++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.2, 6), _mat('#4a0000', { rough: 0.5 }));
        leg.position.set(l === 0 ? -0.12 : 0.12, 0.1, 0);
        leg.castShadow = true;
        g.add(leg);
    }
    // shoulder spikes
    for (var sp = 0; sp < 2; sp++) {
        var spk = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), _mat('#991b1b', { emissive: '#ef4444', emissiveI: 0.2 }));
        spk.position.set(sp === 0 ? -0.25 : 0.25, 0.7, 0);
        spk.rotation.z = sp === 0 ? 0.5 : -0.5;
        g.add(spk);
    }
    // lava glow in chest crack
    var lavaGlow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.02), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 }));
    lavaGlow.position.set(0, 0.42, 0.16);
    lavaGlow.name = 'lavaGlow';
    g.add(lavaGlow);
    return g;
}

// ── Tier 4: TITANO — Colossal titan of destruction ──
function _buildCampT4() {
    var g = new THREE.Group(); g.name = 'camp_creep';
    g.scale.setScalar(1.3); // already massive

    // huge torso
    var body = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.55, 0.35),
        _mat('#450a0a', { rough: 0.35, metal: 0.4, emissive: '#991b1b', emissiveI: 0.2 })
    );
    body.position.y = 0.5;
    body.castShadow = true;
    body.name = 'body';
    g.add(body);
    // emissive veins on body
    for (var v = 0; v < 3; v++) {
        var vein = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.015, 0.36), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.4 }));
        vein.position.set(0, 0.35 + v * 0.15, 0);
        vein.name = 'vein_' + v;
        g.add(vein);
    }
    // skull head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), _mat('#7f1d1d', { rough: 0.35, metal: 0.25 }));
    head.position.y = 0.88;
    head.scale.set(1.1, 0.9, 0.95);
    g.add(head);
    // crown of horns (6)
    for (var h = 0; h < 6; h++) {
        var ha = (h / 6) * Math.PI * 2;
        var horn = new THREE.Mesh(
            new THREE.ConeGeometry(0.03, 0.2 + h % 2 * 0.08, 5),
            _mat('#450a0a', { rough: 0.3, metal: 0.4, emissive: '#ef4444', emissiveI: 0.15 })
        );
        horn.position.set(Math.cos(ha) * 0.14, 0.98, Math.sin(ha) * 0.14);
        horn.rotation.z = Math.cos(ha) * 0.3;
        horn.rotation.x = Math.sin(ha) * 0.3;
        g.add(horn);
    }
    // blazing eyes (3 eyes!)
    var eyeM = _mat('#ef4444', { emissive: '#ef4444', emissiveI: 1.2 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeM).translateX(-0.07).translateY(0.9).translateZ(0.14));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), eyeM).translateX(0.07).translateY(0.9).translateZ(0.14));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeM).translateY(0.95).translateZ(0.14)); // third eye
    // massive arms
    for (var a = 0; a < 2; a++) {
        var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.45, 6), _mat('#450a0a', { rough: 0.4, metal: 0.3 }));
        arm.position.set(a === 0 ? -0.35 : 0.35, 0.45, 0.05);
        arm.rotation.z = a === 0 ? 0.15 : -0.15;
        arm.castShadow = true;
        g.add(arm);
        // claws
        for (var cl = 0; cl < 3; cl++) {
            var claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.08, 3), _mat('#991b1b', { rough: 0.3, metal: 0.4 }));
            claw.position.set(a === 0 ? -0.38 : 0.38, 0.18, -0.03 + cl * 0.03);
            claw.rotation.x = -0.3;
            g.add(claw);
        }
    }
    // column legs
    for (var l = 0; l < 2; l++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.25, 6), _mat('#450a0a', { rough: 0.45, metal: 0.3 }));
        leg.position.set(l === 0 ? -0.15 : 0.15, 0.12, 0);
        leg.castShadow = true;
        g.add(leg);
    }
    // fire aura
    var fireAura = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 10, 8),
        new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })
    );
    fireAura.position.y = 0.5;
    fireAura.name = 'fireAura';
    g.add(fireAura);
    // ground scorched ring
    var scorch = new THREE.Mesh(
        new THREE.RingGeometry(0.5, 0.7, 20),
        new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.01;
    scorch.name = 'scorchRing';
    g.add(scorch);
    return g;
}

// ════════════════════════════════════════════════════════════
//  BOSS CREEPS — 9 unique monsters, one per PvE round
// ════════════════════════════════════════════════════════════

function _buildBossCreep(unit) {
    var round = 5;
    if (unit && unit.charId) {
        var parts = unit.charId.split('_');
        if (parts.length > 1) round = parseInt(parts[1]) || 5;
    }
    var tier = (unit && unit.creepTier) ? unit.creepTier : (round <= 15 ? 1 : (round <= 30 ? 2 : 3));

    var g = new THREE.Group();
    g.name = 'boss_creep';

    // Base scale by tier
    var bossScale = 1.0 + tier * 0.2;
    g.scale.setScalar(bossScale);

    switch (round) {
        case 5:  _boss5(g);  break;
        case 10: _boss10(g); break;
        case 15: _boss15(g); break;
        case 20: _boss20(g); break;
        case 25: _boss25(g); break;
        case 30: _boss30(g); break;
        case 35: _boss35(g); break;
        case 40: _boss40(g); break;
        case 45: _boss45(g); break;
        default: _boss5(g);  break;
    }
    return g;
}

// R5 — Lo Scagnozzo: small imp, hunched, tattered
function _boss5(g) {
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), _mat('#b91c1c', { rough: 0.6, emissive: '#ef4444', emissiveI: 0.1 }));
    body.position.y = 0.28; body.scale.set(1.0, 0.85, 0.9); body.castShadow = true; body.name = 'body'; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), _mat('#dc2626')); head.position.y = 0.48; g.add(head);
    // small horns
    _addHorns(g, 0.02, 0.08, 0.52, 0.08);
    // eyes
    _addEyes(g, 0.02, 0.5, 0.1);
    // hunched back bump
    var bump = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), _mat('#991b1b')); bump.position.set(0, 0.35, -0.12); g.add(bump);
}

// R10 — Il Portaborse: carries a huge sack, slow
function _boss10(g) {
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 8), _mat('#991b1b', { rough: 0.5 }));
    body.position.y = 0.35; body.castShadow = true; body.name = 'body'; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), _mat('#b91c1c')); head.position.y = 0.68; g.add(head);
    _addHorns(g, 0.025, 0.1, 0.72, 0.1);
    _addEyes(g, 0.025, 0.7, 0.1);
    // huge sack on back
    var sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), _mat('#8b6b4a', { rough: 0.85 }));
    sack.position.set(0, 0.45, -0.25); sack.scale.set(1.0, 1.2, 0.9); g.add(sack);
    // sack tie
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), _mat('#5c3a1e')).translateY(0.58).translateZ(-0.25));
    // thick legs
    for (var l = 0; l < 2; l++) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.18, 5), _mat('#7f1d1d')); leg.position.set(l===0?-0.1:0.1, 0.09, 0); g.add(leg); }
}

// R15 — L'Esattore: tall thin demon with clipboard
function _boss15(g) {
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.6, 8), _mat('#991b1b', { rough: 0.45, metal: 0.15 }));
    body.position.y = 0.4; body.castShadow = true; body.name = 'body'; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), _mat('#b91c1c', { rough: 0.4 })); head.position.y = 0.78; g.add(head);
    _addHorns(g, 0.03, 0.15, 0.85, 0.12);
    _addEyes(g, 0.025, 0.8, 0.11, '#ef4444');
    // clipboard
    var clip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.015), _mat('#5c3a1e', { rough: 0.6 }));
    clip.position.set(-0.25, 0.45, 0.15); clip.rotation.z = 0.1; g.add(clip);
    var paper = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.15), _mat('#e2e8f0', { doubleSide: true }));
    paper.position.set(-0.25, 0.45, 0.16); g.add(paper);
    // thin arms
    for (var a = 0; a < 2; a++) { var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.3, 5), _mat('#991b1b')); arm.position.set(a===0?-0.22:0.22, 0.5, 0.05); arm.rotation.z = a===0?0.15:-0.15; g.add(arm); }
    // tail
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.25, 4), _mat('#7f1d1d')); tail.position.set(0, 0.2, -0.22); tail.rotation.x = 0.6; g.add(tail);
}

// R20 — Il Revisore: muscular beast in suit, berserker
function _boss20(g) {
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.3), _mat('#7f1d1d', { rough: 0.4, metal: 0.2, emissive: '#dc2626', emissiveI: 0.1 }));
    body.position.y = 0.42; body.castShadow = true; body.name = 'body'; g.add(body);
    // suit vest overlay
    var vest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.35, 0.02), _mat('#1e293b', { rough: 0.7 })); vest.position.set(0, 0.42, 0.16); g.add(vest);
    // tie
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.01), _mat('#ef4444')).translateY(0.42).translateZ(0.17));
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), _mat('#991b1b', { rough: 0.4 })); head.position.y = 0.75; g.add(head);
    _addHorns(g, 0.035, 0.18, 0.82, 0.13);
    _addEyes(g, 0.03, 0.77, 0.12, '#fbbf24');
    // massive arms (muscular)
    for (var a = 0; a < 2; a++) { var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 6), _mat('#7f1d1d', { rough: 0.5 })); arm.position.set(a===0?-0.28:0.28, 0.42, 0.05); arm.rotation.z = a===0?0.2:-0.2; arm.castShadow=true; g.add(arm); }
    for (var l = 0; l < 2; l++) { var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.2, 6), _mat('#1e293b')); leg.position.set(l===0?-0.12:0.12, 0.1, 0); g.add(leg); }
}

// R25 — Il Mercante di Dune: desert snake/wraith, hooded
function _boss25(g) {
    // snake-like body (curved cylinder segments)
    for (var s = 0; s < 5; s++) {
        var seg = new THREE.Mesh(new THREE.CylinderGeometry(0.15 - s*0.015, 0.15 - s*0.01, 0.12, 8),
            _mat('#d4a43a', { rough: 0.5, metal: 0.2, emissive: '#fbbf24', emissiveI: 0.05 }));
        seg.position.set(Math.sin(s * 0.3) * 0.05, 0.12 + s * 0.1, -s * 0.04);
        seg.name = 'seg_' + s;
        seg.castShadow = true;
        g.add(seg);
    }
    g.children[0].name = 'body';
    // hood/cowl
    var hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI*2, 0, Math.PI*0.6),
        _mat('#5c3a1e', { rough: 0.7 }));
    hood.position.y = 0.65; hood.scale.set(1.1, 1.0, 1.2); g.add(hood);
    // glowing green eyes (poisoner)
    var eyeM = _mat('#22c55e', { emissive: '#22c55e', emissiveI: 0.8 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), eyeM).translateX(-0.06).translateY(0.62).translateZ(0.12));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), eyeM).translateX(0.06).translateY(0.62).translateZ(0.12));
    // poison vapor aura
    var vapor = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
    vapor.position.y = 0.4; vapor.name = 'poisonAura'; g.add(vapor);
}

// R30 — Il Verme della Burocrazia: HUGE worm with paper armor
function _boss30(g) {
    g.scale.setScalar(1.15);
    for (var s = 0; s < 6; s++) {
        var sw = 0.2 - s * 0.012;
        var seg = new THREE.Mesh(new THREE.CylinderGeometry(sw, sw, 0.15, 10),
            _mat('#b91c1c', { rough: 0.4, metal: 0.25, emissive: '#dc2626', emissiveI: 0.08 }));
        seg.position.set(Math.sin(s * 0.4) * 0.03, 0.1 + s * 0.13, 0);
        seg.name = 'seg_' + s;
        seg.castShadow = true;
        g.add(seg);
        // paper/document armor plates
        if (s < 4) {
            var paper = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.1), _mat('#e2e8f0', { rough: 0.9, doubleSide: true, opacity: 0.6 }));
            paper.material.transparent = true;
            paper.position.set(sw + 0.02, 0.1 + s * 0.13, 0);
            paper.rotation.y = Math.PI / 4 + s * 0.5;
            g.add(paper);
        }
    }
    g.children[0].name = 'body';
    // mouth/maw
    var maw = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), _mat('#450a0a', { rough: 0.5 }));
    maw.position.set(0, 0.86, 0.12); maw.rotation.y = Math.PI / 2; g.add(maw);
    _addEyes(g, 0.025, 0.85, 0.15, '#ef4444');
    // regen glow
    var regenGlow = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: '#34d399', transparent: true, opacity: 0.1, depthWrite: false }));
    regenGlow.position.y = 0.4; regenGlow.name = 'regenGlow'; g.add(regenGlow);
}

// R35 — Il Preside: tall authoritarian with evil mortarboard
function _boss35(g) {
    g.scale.setScalar(1.1);
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.7, 10), _mat('#1e293b', { rough: 0.4, metal: 0.2, emissive: '#dc2626', emissiveI: 0.08 }));
    body.position.y = 0.45; body.castShadow = true; body.name = 'body'; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), _mat('#991b1b', { rough: 0.35 })); head.position.y = 0.9; g.add(head);
    // evil mortarboard
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.45), _mat('#0f172a', { rough: 0.8 }));
    cap.position.y = 1.08; cap.rotation.y = Math.PI / 4; g.add(cap);
    var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 6), _mat('#0f172a'));
    crown.position.y = 1.02; g.add(crown);
    // burning tassel
    var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.2, 4), _mat('#ef4444', { emissive: '#ef4444', emissiveI: 0.6 }));
    tassel.position.set(0.2, 0.98, 0.2); tassel.name = 'tassel'; g.add(tassel);
    _addHorns(g, 0.035, 0.2, 0.98, 0.15);
    _addEyes(g, 0.03, 0.92, 0.13, '#ef4444');
    // silence aura (pink ring)
    var silRing = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 6, 20), new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.15, depthWrite: false }));
    silRing.rotation.x = -Math.PI/2; silRing.position.y = 0.5; silRing.name = 'silenceRing'; g.add(silRing);
    // arms reaching
    for (var a = 0; a < 2; a++) { var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 6), _mat('#1e293b')); arm.position.set(a===0?-0.25:0.25, 0.55, 0.1); arm.rotation.z = a===0?0.15:-0.15; arm.rotation.x = -0.2; g.add(arm); }
}

// R40 — L'Auditore Glaciale: ice crystal golem
function _boss40(g) {
    g.scale.setScalar(1.15);
    // crystalline body
    var body = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 1),
        _mat('#bfdbfe', { rough: 0.1, metal: 0.5, emissive: '#93c5fd', emissiveI: 0.3 }));
    body.position.y = 0.5; body.castShadow = true; body.name = 'body'; g.add(body);
    // ice head
    var head = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), _mat('#e0f2fe', { rough: 0.08, metal: 0.6, emissive: '#93c5fd', emissiveI: 0.2 }));
    head.position.y = 0.85; g.add(head);
    // ice horns (crystalline)
    for (var h = 0; h < 2; h++) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), _mat('#bfdbfe', { rough: 0.05, metal: 0.7, emissive: '#60a5fa', emissiveI: 0.3 }));
        horn.position.set(h===0?-0.12:0.12, 0.98, 0); horn.rotation.z = h===0?0.4:-0.4; g.add(horn);
    }
    // blue glowing eyes
    var iceEye = _mat('#60a5fa', { emissive: '#60a5fa', emissiveI: 1.2 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), iceEye).translateX(-0.06).translateY(0.87).translateZ(0.12));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), iceEye).translateX(0.06).translateY(0.87).translateZ(0.12));
    // ice crystal arms
    for (var a = 0; a < 2; a++) {
        var iceArm = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), _mat('#bfdbfe', { rough: 0.05, metal: 0.6 }));
        iceArm.position.set(a===0?-0.35:0.35, 0.5, 0.05); g.add(iceArm);
    }
    // ice crystal shards floating around
    for (var sh = 0; sh < 5; sh++) {
        var shard = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.1, 3), _mat('#e0f2fe', { rough: 0.05, metal: 0.7, emissive: '#93c5fd', emissiveI: 0.2 }));
        var sa = (sh / 5) * Math.PI * 2;
        shard.position.set(Math.cos(sa) * 0.4, 0.5 + Math.sin(sa * 2) * 0.15, Math.sin(sa) * 0.4);
        shard.rotation.set(Math.random(), Math.random(), Math.random());
        shard.name = 'shard_' + sh;
        g.add(shard);
    }
    // freeze aura
    var freezeAura = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: '#93c5fd', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
    freezeAura.position.y = 0.5; freezeAura.name = 'freezeAura'; g.add(freezeAura);
    // ground frost
    var frost = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 24), new THREE.MeshBasicMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    frost.rotation.x = -Math.PI/2; frost.position.y = 0.01; frost.name = 'frostRing'; g.add(frost);
}

// R45 — Il Grande Capo: MASSIVE demon lord, the final boss
function _boss45(g) {
    g.scale.setScalar(1.35); // HUGE

    // massive demonic torso
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.4),
        _mat('#450a0a', { rough: 0.3, metal: 0.35, emissive: '#991b1b', emissiveI: 0.25 }));
    body.position.y = 0.55; body.castShadow = true; body.name = 'body'; g.add(body);

    // emissive cracks on body
    for (var v = 0; v < 4; v++) {
        var crack = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.02, 0.41), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.5 }));
        crack.position.set(0, 0.38 + v * 0.12, 0);
        crack.name = 'crack_' + v;
        g.add(crack);
    }

    // demon skull head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), _mat('#7f1d1d', { rough: 0.3, metal: 0.3 }));
    head.position.y = 0.96; head.scale.set(1.1, 0.95, 1.0); g.add(head);

    // crown of massive horns (8!)
    for (var h = 0; h < 8; h++) {
        var ha = (h / 8) * Math.PI * 2;
        var hLen = 0.2 + (h % 2) * 0.12;
        var horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, hLen, 5),
            _mat('#450a0a', { rough: 0.25, metal: 0.45, emissive: '#ef4444', emissiveI: 0.2 }));
        horn.position.set(Math.cos(ha) * 0.16, 1.08, Math.sin(ha) * 0.16);
        horn.rotation.z = Math.cos(ha) * 0.35;
        horn.rotation.x = Math.sin(ha) * 0.35;
        g.add(horn);
    }

    // 4 blazing eyes
    var bossEye = _mat('#ef4444', { emissive: '#ef4444', emissiveI: 1.5 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bossEye).translateX(-0.08).translateY(0.98).translateZ(0.16));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bossEye).translateX(0.08).translateY(0.98).translateZ(0.16));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), bossEye).translateX(-0.04).translateY(1.04).translateZ(0.15));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), bossEye).translateX(0.04).translateY(1.04).translateZ(0.15));

    // 4 ARMS (demon lord has 4 arms!)
    for (var a = 0; a < 4; a++) {
        var isOuter = a >= 2;
        var isLeft = a % 2 === 0;
        var xOff = isLeft ? -1 : 1;
        var arm = new THREE.Mesh(
            new THREE.CylinderGeometry(isOuter ? 0.06 : 0.08, isOuter ? 0.05 : 0.065, isOuter ? 0.35 : 0.4, 6),
            _mat('#450a0a', { rough: 0.4, metal: 0.3 })
        );
        arm.position.set(xOff * (isOuter ? 0.38 : 0.32), isOuter ? 0.65 : 0.5, 0.05);
        arm.rotation.z = xOff * (isOuter ? 0.3 : 0.15);
        arm.castShadow = true;
        g.add(arm);
        // claws on each arm
        for (var cl = 0; cl < 3; cl++) {
            var claw = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.1, 3), _mat('#991b1b', { metal: 0.4 }));
            claw.position.set(xOff * (isOuter ? 0.42 : 0.36), isOuter ? 0.44 : 0.28, -0.03 + cl * 0.03);
            claw.rotation.x = -0.4;
            g.add(claw);
        }
    }

    // massive legs
    for (var l = 0; l < 2; l++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.3, 8), _mat('#450a0a', { rough: 0.4, metal: 0.3 }));
        leg.position.set(l === 0 ? -0.18 : 0.18, 0.15, 0); leg.castShadow = true; g.add(leg);
    }

    // tail
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.4, 5), _mat('#7f1d1d', { emissive: '#ef4444', emissiveI: 0.1 }));
    tail.position.set(0, 0.3, -0.35); tail.rotation.x = 0.7; g.add(tail);

    // infernal aura
    var infernoAura = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10),
        new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
    infernoAura.position.y = 0.55; infernoAura.name = 'infernoAura'; g.add(infernoAura);

    // ground fire ring
    var fireRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 28),
        new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    fireRing.rotation.x = -Math.PI/2; fireRing.position.y = 0.01; fireRing.name = 'fireRing'; g.add(fireRing);

    // point light (boss glows)
    var bossLight = new THREE.PointLight('#ef4444', 1.0, 4);
    bossLight.position.set(0, 1.0, 0); bossLight.name = 'bossLight'; g.add(bossLight);
}

// ── Boss helper: add horns ──
function _addHorns(g, radius, height, yPos, xSpread) {
    var hMat = _mat('#4a0000', { rough: 0.35, metal: 0.35 });
    for (var h = 0; h < 2; h++) {
        var horn = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), hMat);
        horn.position.set(h === 0 ? -xSpread : xSpread, yPos, 0);
        horn.rotation.z = h === 0 ? 0.4 : -0.4;
        g.add(horn);
    }
}

// ── Boss helper: add glowing eyes ──
function _addEyes(g, radius, yPos, zPos, color) {
    var c = color || '#fbbf24';
    var eyeM = _mat(c, { emissive: c, emissiveI: 0.7 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 5, 5), eyeM).translateX(-0.06).translateY(yPos).translateZ(zPos));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 5, 5), eyeM).translateX(0.06).translateY(yPos).translateZ(zPos));
}

// ─── Melee arc indicator: sector in XZ plane, pointing toward +Z by default ──
// Call with rotation.y = Math.PI + _camOrbitAngle each frame to track facing dir
function _createMeleeArcMesh(radiusWorld, arcDeg, color, fillOpacity) {
    var halfArc = (arcDeg * Math.PI / 180) / 2;
    var segs = 28;

    // Filled fan
    var fv = [], fi = [];
    fv.push(0, 0, 0); // center vertex 0
    for (var i = 0; i <= segs; i++) {
        var a = -halfArc + (i / segs) * (arcDeg * Math.PI / 180);
        fv.push(Math.sin(a) * radiusWorld, 0, Math.cos(a) * radiusWorld);
    }
    for (var i = 0; i < segs; i++) fi.push(0, i + 1, i + 2);
    var fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3));
    fillGeo.setIndex(fi);
    var fillMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: fillOpacity || 0.10,
        side: THREE.DoubleSide, depthWrite: false
    });
    var fillMesh = new THREE.Mesh(fillGeo, fillMat);

    // Outline (two radius lines + arc curve)
    var ev = [];
    ev.push(0, 0.003, 0);
    for (var i = 0; i <= segs; i++) {
        var a = -halfArc + (i / segs) * (arcDeg * Math.PI / 180);
        ev.push(Math.sin(a) * radiusWorld, 0.003, Math.cos(a) * radiusWorld);
    }
    ev.push(0, 0.003, 0); // close to center
    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ev, 3));
    var edgeMat = new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.60, depthWrite: false
    });
    var edgeLine = new THREE.Line(edgeGeo, edgeMat);

    var wrapper = new THREE.Group();
    wrapper.add(fillMesh);
    wrapper.add(edgeLine);
    wrapper._fill = fillMesh;
    wrapper._edge = edgeLine;
    wrapper._baseColor = color;
    wrapper._flashTimer = 0;
    wrapper._flashDur   = 0;
    return wrapper;
}

// ─── Load UAL2 combo clips into the UAL1 mixer (same rig = retarget works) ──
// UAL2 has Sword_Regular_A/B/C + Sword_Regular_Combo — better than UAL1 sword clips
function _loadUAL2ComboClips(avatarGroup) {
    _loadAvatarGLB('ual2_walking', function(ual2Data) {
        if (!ual2Data || !avatarGroup._avatarAnimator) return;
        var mixer = avatarGroup._avatarAnimator.mixer;
        var clips = ual2Data.animations || [];

        var hitA  = _findClipByKeywords(clips, ['sword_regular_a']);
        var hitB  = _findClipByKeywords(clips, ['sword_regular_b']);
        var finCl = _findClipByKeywords(clips, ['sword_regular_combo', 'sword_regular_c']);

        function _reg(clip, speed) {
            if (!clip) return null;
            var act = mixer.clipAction(clip);
            act.loop = THREE.LoopOnce;
            act.clampWhenFinished = true;
            act.timeScale = speed || 1.9;
            avatarGroup._avatarAnimator.actions[clip.name] = act;
            return clip.name;
        }

        var n1 = _reg(hitA,  1.9);
        var n2 = _reg(hitB,  1.9);
        var nF = _reg(finCl, 1.7); // finisher slightly slower for weight

        if (n1) { avatarGroup._avatarAnimator.sword1ClipName   = n1; avatarGroup._avatarAnimator.swordRegClipName = n1; }
        if (n2)   avatarGroup._avatarAnimator.sword2ClipName   = n2;
        if (nF)   avatarGroup._avatarAnimator.swordFinClipName = nF;

        console.log('⚔️  UAL2 combo clips loaded → A:', n1, '| B:', n2, '| Fin:', nF);
    });
}

// ─── Attach sword GLB to avatar's right hand bone ────────────
function _attachSwordToHand(avatarGroup, avatarClone, avatarScale) {
    var GLTFLoaderClass = window.GLTFLoader ||
        (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) ||
        (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) return;

    var loader = new GLTFLoaderClass();
    loader.load('models/kenney/weapon-sword.glb', function(gltf) {
        // Find hand_r bone in the cloned skeleton
        var handBone = null;
        avatarClone.traverse(function(node) {
            if ((node.isBone || node.type === 'Bone') && node.name === 'hand_r') {
                handBone = node;
            }
        });

        if (!handBone) {
            console.warn('⚔️  hand_r bone not found — cannot attach sword');
            avatarClone.traverse(function(n) {
                if (n.isBone) console.log('   Bone:', n.name);
            });
            return;
        }

        var swordScene = gltf.scene;
        // Scale: desired world sword length ~0.05 = swordScale × 0.45 × avatarScale
        // avatarScale ≈ 0.038, swordNaturalHeight ≈ 0.45
        var swordScale = 0.05 / (0.45 * avatarScale);
        swordScene.scale.setScalar(swordScale);
        // Orient sword: UAL1 hand_r has X toward fingertips — rotate so blade points forward
        swordScene.rotation.set(0, 0, -Math.PI / 2);
        // Shift so pommel sits at grip, blade extends toward fingers
        swordScene.position.set(0.05, 0, 0);
        swordScene.name = 'swordModel';

        handBone.add(swordScene);
        avatarGroup._swordModel = swordScene;
        console.log('⚔️  Sword attached to hand_r, scale:', swordScale.toFixed(1));
    }, undefined, function(err) {
        console.warn('⚔️  weapon-sword.glb load error:', err);
    });
}

// ─── Attach spear to avatar's right hand bone ────────────────
function _attachSpearToHand(avatarGroup, avatarClone, avatarScale) {
    var GLTFLoaderClass = window.GLTFLoader ||
        (typeof THREE !== 'undefined' ? THREE.GLTFLoader : null) ||
        (typeof GLTFLoader !== 'undefined' ? GLTFLoader : null);
    if (!GLTFLoaderClass) return;

    var loader = new GLTFLoaderClass();
    loader.load('models/kenney/weapon-spear.glb', function(gltf) {
        var handBone = null;
        avatarClone.traverse(function(node) {
            if ((node.isBone || node.type === 'Bone') && node.name === 'hand_r') handBone = node;
        });
        if (!handBone) { console.warn('🗡️  hand_r not found for spear'); return; }
        var spear = gltf.scene;
        var spearScale = 0.07 / (0.9 * avatarScale);
        spear.scale.setScalar(spearScale);
        spear.rotation.set(0, 0, -Math.PI / 2);
        spear.position.set(0.05, 0, 0);
        spear.name = 'spearModel';
        handBone.add(spear);
        avatarGroup._weaponModel = spear;
        console.log('🗡️  Spear attached to hand_r');
    }, undefined, function(e) { console.warn('🗡️  weapon-spear.glb error:', e); });
}

// ─── Add procedural staff to hand ────────────────────────────
function _attachStaffToHand(avatarGroup, avatarClone, avatarScale, orbColor) {
    var handBone = null;
    avatarClone.traverse(function(node) {
        if ((node.isBone || node.type === 'Bone') && node.name === 'hand_r') handBone = node;
    });
    if (!handBone) { console.warn('🪄  hand_r not found for staff'); return; }

    var staffGroup = new THREE.Group();
    var staffScale = 0.06 / (0.9 * avatarScale);

    var rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.025, 1.0, 5),
        _mat('#5c3a1e', { rough: 0.9, metal: 0.0 })
    );
    rod.rotation.z = -Math.PI / 2;
    rod.position.set(0.5, 0, 0);
    staffGroup.add(rod);

    var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        _mat(orbColor, { emissive: orbColor, emissiveI: 0.9, rough: 0.3 })
    );
    orb.position.set(1.0, 0, 0);
    staffGroup.add(orb);

    var glow = new THREE.PointLight(orbColor, 0.8, 0.5);
    glow.position.set(1.0, 0, 0);
    staffGroup.add(glow);

    staffGroup.scale.setScalar(staffScale);
    staffGroup.name = 'staffModel';
    handBone.add(staffGroup);
    avatarGroup._weaponModel = staffGroup;
}

// ─── Rebuild arc geometry in-place (for dynamic combo step changes) ──
function _rebuildMeleeArc(wrapper, radius, arcDeg, color, fillOpacity) {
    if (wrapper._fill) { wrapper.remove(wrapper._fill); wrapper._fill.geometry.dispose(); wrapper._fill.material.dispose(); }
    if (wrapper._edge) { wrapper.remove(wrapper._edge); wrapper._edge.geometry.dispose(); wrapper._edge.material.dispose(); }

    var halfArc = (arcDeg * Math.PI / 180) / 2;
    var segs = 28;

    var fv = [], fi = [];
    fv.push(0, 0, 0);
    for (var i = 0; i <= segs; i++) {
        var a = -halfArc + (i / segs) * (arcDeg * Math.PI / 180);
        fv.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    }
    for (var i = 0; i < segs; i++) fi.push(0, i + 1, i + 2);
    var fillGeo = new THREE.BufferGeometry();
    fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(fv, 3));
    fillGeo.setIndex(fi);
    var fillMesh = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: fillOpacity || 0.10,
        side: THREE.DoubleSide, depthWrite: false
    }));

    var ev = [];
    ev.push(0, 0.003, 0);
    for (var i = 0; i <= segs; i++) {
        var a = -halfArc + (i / segs) * (arcDeg * Math.PI / 180);
        ev.push(Math.sin(a) * radius, 0.003, Math.cos(a) * radius);
    }
    ev.push(0, 0.003, 0);
    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ev, 3));
    var edgeLine = new THREE.Line(edgeGeo, new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.60, depthWrite: false
    }));

    wrapper.add(fillMesh);
    wrapper.add(edgeLine);
    wrapper._fill = fillMesh;
    wrapper._edge = edgeLine;
    wrapper._baseColor = color;
}

// ─── Stratega target circle — persistent ground AoE indicator ──
function _createStrategaTargetCircle(radius) {
    var g = new THREE.Group();
    g.name = 'strategaTargetCircle';

    // Outer ring — thick, bright
    var outerGeo = new THREE.TorusGeometry(radius, 0.035, 8, 48);
    var outerMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.55, depthWrite: false });
    var outer = new THREE.Mesh(outerGeo, outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.name = 'outerRing';
    g.add(outer);

    // Inner ring
    var innerGeo = new THREE.TorusGeometry(radius * 0.6, 0.025, 6, 36);
    var innerMat = new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.35, depthWrite: false });
    var inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.name = 'innerRing';
    g.add(inner);

    // Fill disc — more visible
    var discGeo = new THREE.CircleGeometry(radius, 36);
    var discMat = new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
    var disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.005;
    disc.name = 'fillDisc';
    g.add(disc);

    // Center crosshair dot — bigger, brighter
    var dotGeo = new THREE.CircleGeometry(0.08, 12);
    var dotMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.60, side: THREE.DoubleSide, depthWrite: false });
    var dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.008;
    dot.name = 'centerDot';
    g.add(dot);

    // Crosshair tick marks
    var tickMat = new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.28, depthWrite: false });
    for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2;
        var r0 = radius * 0.82, r1 = radius * 0.98;
        var lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([
            Math.cos(a) * r0, 0.006, Math.sin(a) * r0,
            Math.cos(a) * r1, 0.006, Math.sin(a) * r1
        ], 3));
        g.add(new THREE.Line(lineGeo, tickMat));
    }

    g.visible = false;
    return g;
}

// ─── Load Kenney character GLB (guerriero) — native skeleton + 32 animations ──
function _buildKenneyAvatar(g, classId, col) {
    var fbMat = _mat(col, { emissive: col, emissiveI: 0.3 });
    var fbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.45, 8), fbMat);
    fbBody.position.y = 0.25; fbBody.name = 'avatarFallback';
    g.add(fbBody);

    _loadAvatarGLB(classId, function(data) {
        if (!data) { console.error('❌ ' + classId + '.glb non caricato'); return; }

        var fallback = g.getObjectByName('avatarFallback');
        if (fallback) g.remove(fallback);

        var SU = window.SkeletonUtils;
        var cloned = SU ? SU.clone(data.scene) : data.scene.clone();

        var h = data.naturalHeight > 0 ? data.naturalHeight : 1.0;
        var s = 0.07 / h;
        cloned.scale.set(s, s, s);
        cloned.position.set(0, 0, 0);

        cloned.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(cloned);
        cloned.position.y = isFinite(box.min.y) ? -box.min.y : (h * s) * 0.5;

        cloned.traverse(function(node) {
            node.visible = true;
            if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; }
        });

        g.add(cloned);
        g.visible = true;

        // Melee arc indicator
        var meleeArcMesh = _createMeleeArcMesh(1.5, 90, '#60a5fa', 0.10);
        meleeArcMesh.position.y = 0.005;
        meleeArcMesh.name = 'meleeArc';
        meleeArcMesh.visible = false;
        meleeArcMesh._currentStep = 1;
        g.add(meleeArcMesh);

        // Setup native animations from the Kenney GLB
        var clips = data.animations || [];
        console.log('🎬 Kenney ' + classId + ': ' + clips.length + ' native clips');
        _setupKenneyMixer(g, cloned, clips);

        // Update threeUnitModels feetOffset
        for (var uid in threeUnitModels) {
            if (threeUnitModels[uid] && threeUnitModels[uid].group === g) {
                threeUnitModels[uid].feetOffset = TILE_Y * 2;
                threeUnitModels[uid].targetPos.y = TILE_Y * 2;
                break;
            }
        }

        console.log('⚔️  Kenney guerriero caricato. Scale:', s.toFixed(3));
    });
}

// ─── Setup AnimationMixer for Kenney models (native clip names) ──
function _setupKenneyMixer(group, meshRoot, clips) {
    var mixer = new THREE.AnimationMixer(meshRoot);
    group._avatarAnimator = {
        mixer: mixer,
        clips: clips,
        actions: {},
        currentAction: null,
        idleClipName:       null,
        walkClipName:       null,
        runClipName:        null,
        sword1ClipName:     null,
        sword2ClipName:     null,
        swordFinClipName:   null,
        swordRegClipName:   null,
        colpoClipName:      null,
        gridoClipName:      null,
        furiaEnterClipName: null,
        furiaIdleClipName:  null,
        attacking:          false,
        attackTimer:        0,
        furiaActive:        false
    };

    // Map Kenney clip names to animator slots
    var idleClip  = _findClipByKeywords(clips, ['idle']);
    var walkClip  = _findClipByKeywords(clips, ['walk']);
    var runClip   = _findClipByKeywords(clips, ['sprint']);
    var atkR      = _findClipByKeywords(clips, ['attack-melee-right']);
    var atkL      = _findClipByKeywords(clips, ['attack-melee-left']);
    var kickR     = _findClipByKeywords(clips, ['attack-kick-right']);
    var dieClip   = _findClipByKeywords(clips, ['die']);

    console.log('🎬 Kenney Idle:', idleClip ? idleClip.name : 'NONE');
    console.log('🎬 Kenney Walk:', walkClip ? walkClip.name : 'NONE');
    console.log('🎬 Kenney AtkR:', atkR ? atkR.name : 'NONE');

    // Idle
    if (idleClip) {
        var a = mixer.clipAction(idleClip);
        a.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[idleClip.name] = a;
        group._avatarAnimator.idleClipName = idleClip.name;
    }
    // Walk
    if (walkClip && walkClip !== idleClip) {
        var a = mixer.clipAction(walkClip);
        a.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[walkClip.name] = a;
        group._avatarAnimator.walkClipName = walkClip.name;
    }
    // Run (sprint)
    if (runClip && runClip !== walkClip) {
        var a = mixer.clipAction(runClip);
        a.loop = THREE.LoopRepeat;
        group._avatarAnimator.actions[runClip.name] = a;
        group._avatarAnimator.runClipName = runClip.name;
    }
    // Sword attacks → melee-right / melee-left / kick
    if (atkR) {
        var a = mixer.clipAction(atkR);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true; a.timeScale = 1.5;
        group._avatarAnimator.actions[atkR.name] = a;
        group._avatarAnimator.sword1ClipName   = atkR.name;
        group._avatarAnimator.swordRegClipName = atkR.name;
    }
    if (atkL) {
        var a = mixer.clipAction(atkL);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true; a.timeScale = 1.5;
        group._avatarAnimator.actions[atkL.name] = a;
        group._avatarAnimator.sword2ClipName   = atkL.name;
        group._avatarAnimator.swordFinClipName = atkL.name;
    }
    // Colpo Devastante → kick (heavy blow feel)
    if (kickR) {
        var a = mixer.clipAction(kickR);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true; a.timeScale = 0.8;
        group._avatarAnimator.actions['colpo_devastante'] = a;
        group._avatarAnimator.colpoClipName = 'colpo_devastante';
    }
    // Grido di Guerra → attack-melee-left (dramatic gesture)
    if (atkL) {
        var grido = atkL.clone();
        grido.name = 'grido_guerra';
        var a = mixer.clipAction(grido);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true; a.timeScale = 0.7;
        group._avatarAnimator.actions['grido_guerra'] = a;
        group._avatarAnimator.gridoClipName = 'grido_guerra';
    }
    // Furia Immortale → sprint as power-up stance
    if (runClip) {
        var furiaEnt = runClip.clone();
        furiaEnt.name = 'furia_enter';
        var a = mixer.clipAction(furiaEnt);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true; a.timeScale = 2.0;
        group._avatarAnimator.actions['furia_enter'] = a;
        group._avatarAnimator.furiaEnterClipName = 'furia_enter';

        var furiaIdl = runClip.clone();
        furiaIdl.name = 'furia_idle';
        var a2 = mixer.clipAction(furiaIdl);
        a2.loop = THREE.LoopRepeat; a2.timeScale = 1.5;
        group._avatarAnimator.actions['furia_idle'] = a2;
        group._avatarAnimator.furiaIdleClipName = 'furia_idle';
    }
    // Die animation (for death sequence)
    if (dieClip) {
        var a = mixer.clipAction(dieClip);
        a.loop = THREE.LoopOnce; a.clampWhenFinished = true;
        group._avatarAnimator.actions[dieClip.name] = a;
    }

    // Start idle
    if (idleClip) {
        _playAvatarAnimation(group, idleClip.name);
        console.log('🎬 ▶ Kenney idle avviato:', idleClip.name);
    }
}

// ─── Load outfit GLB + borrow UAL1 animations ────────────────
function _buildOutfitAvatar(g, classId, col) {
    // Fallback geometry while loading
    var fbMat = _mat(col, { emissive: col, emissiveI: 0.3 });
    var fbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.45, 8), fbMat);
    fbBody.position.y = 0.25; fbBody.name = 'avatarFallback';
    g.add(fbBody);

    _loadAvatarGLB(classId, function(outfitData) {
        if (!outfitData) { console.error('❌ ' + classId + '.glb non caricato'); return; }

        var fallback = g.getObjectByName('avatarFallback');
        if (fallback) g.remove(fallback);

        var SU = window.SkeletonUtils;
        var cloned = SU ? SU.clone(outfitData.scene) : outfitData.scene.clone();

        var h = outfitData.naturalHeight > 0 ? outfitData.naturalHeight : 1.0;
        var s = 0.07 / h;
        cloned.scale.set(s, s, s);
        cloned.position.set(0, 0, 0);

        cloned.updateMatrixWorld(true);
        var box = new THREE.Box3().setFromObject(cloned);
        cloned.position.y = isFinite(box.min.y) ? -box.min.y : (h * s) * 0.5;

        cloned.traverse(function(node) {
            node.visible = true;
            if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; }
        });

        g.add(cloned);
        g.visible = true;

        // Attach weapon per class
        if (classId === 'guerriero') {
            _attachSwordToHand(g, cloned, s);
        } else if (classId === 'stratega') {
            _attachSpearToHand(g, cloned, s);
        } else if (classId === 'stregone') {
            _attachStaffToHand(g, cloned, s, '#a855f7');
        } else if (classId === 'mistico') {
            _attachStaffToHand(g, cloned, s, '#22c55e');
        }

        // Melee arc indicator — NOT for stratega (uses target circle instead)
        if (classId !== 'stratega') {
            var _arcDefs = { guerriero: { r: 1.5, deg: 90, col: '#60a5fa' },
                             stregone: { r: 4.0, deg: 45, col: '#c084fc' },
                             mistico:  { r: 3.0, deg: 70, col: '#4ade80' } };
            var _ad = _arcDefs[classId] || { r: 2.0, deg: 90, col: '#60a5fa' };
            var meleeArcMesh = _createMeleeArcMesh(_ad.r, _ad.deg, _ad.col, 0.10);
            meleeArcMesh.position.y = 0.005;
            meleeArcMesh.name = 'meleeArc';
            meleeArcMesh.visible = false;
            meleeArcMesh._currentStep = 1;
            g.add(meleeArcMesh);
        }

        // Borrow UAL1 animations (same UE4 skeleton convention)
        _loadAvatarGLB('ual1_standard', function(ualData) {
            if (!ualData) return;
            var clips = ualData.animations || [];
            if (clips.length > 0) {
                _setupAvatarMixer(g, cloned, clips);
                console.log('🎬 ' + classId + ': ' + clips.length + ' UAL1 clips applicati. Scale:', s.toFixed(3));
            } else {
                console.warn('⚠️  ' + classId + ': nessuna animazione UAL1 disponibile');
            }
            // Guerriero: load UAL2 combo clips (Sword_Regular_A/B/Combo)
            if (classId === 'guerriero') {
                _loadUAL2ComboClips(g);
            }
        });

        // Update threeUnitModels feetOffset
        for (var uid in threeUnitModels) {
            if (threeUnitModels[uid] && threeUnitModels[uid].group === g) {
                threeUnitModels[uid].feetOffset = TILE_Y * 2;
                threeUnitModels[uid].targetPos.y = TILE_Y * 2;
                break;
            }
        }
    });
}

// ─── AVATAR — Player character ───────────────────────────────
function _buildAvatar(unit) {
    var g = new THREE.Group(); g.name = 'avatar';
    var classId = unit && unit.avatarClass ? unit.avatarClass : 'stratega';
    var cls = typeof AVATAR_CLASSES !== 'undefined' ? AVATAR_CLASSES[classId] : null;
    var col = cls ? cls.color.fill : '#3b82f6';
    var colS = cls ? cls.color.stroke : '#1d4ed8';

    // All outfit-based classes (UE4 skeleton + UAL1 animations)
    if (classId === 'guerriero' || classId === 'stratega' || classId === 'stregone' || classId === 'mistico') {
        // Outfit GLB models from the Modular Fantasy pack
        _buildOutfitAvatar(g, classId, col);
    } else {
        // Procedural fallback for unknown classes
        var mat = _mat(col, { emissive: colS, emissiveI: 0.4 });
        var body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.45, 8), mat);
        body.position.y = 0.25; body.castShadow = true; g.add(body);
        var head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), mat);
        head.position.y = 0.55; g.add(head);
        _addEyes(g, 0.025, 0.55, 0.09, '#ffffff');
    }

    // Ground glow ring (command radius indicator)
    var aura = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.35, 16),
        _mat(col, { emissive: col, emissiveI: 0.6 })
    );
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.02;
    aura.material.transparent = true;
    aura.material.opacity = 0.3;
    aura.name = 'avatarAura';
    g.add(aura);

    return g;
}

// ─── STRUCTURES — Fixed defensive structures ────────────────
function _buildStructure(unit) {
    var g = new THREE.Group(); g.name = 'structure';
    var baseType = unit && unit.structureType ? unit.structureType : 'torre';
    var sCharId = unit && unit.structureCharId ? unit.structureCharId : 'Babidi';
    var theme = typeof STRUCTURE_THEMES !== 'undefined' && STRUCTURE_THEMES[sCharId] ? STRUCTURE_THEMES[sCharId][baseType] : null;
    var col = theme ? theme.color.fill : '#888888';
    var colS = theme ? theme.color.stroke : '#555555';

    // Fallback box shown while GLB loads
    var fallback = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.35, 0.20),
        _mat(col, { emissive: colS, emissiveI: 0.3 })
    );
    fallback.position.y = 0.175;
    fallback.castShadow = true;
    fallback.name = 'structure_fallback';
    g.add(fallback);

    // Load real GLB model asynchronously
    _loadStructureGLB(baseType, function(modelData) {
        if (!modelData) return;

        // Remove fallback
        var fb = g.getObjectByName('structure_fallback');
        if (fb) { g.remove(fb); if (fb.geometry) fb.geometry.dispose(); if (fb.material) fb.material.dispose(); }

        var clone = modelData.scene.clone(true);

        // Scale to ~0.55m height
        var TARGET_HEIGHT = 0.55;
        var sc = modelData.naturalHeight > 0 ? TARGET_HEIGHT / modelData.naturalHeight : 1;
        clone.scale.setScalar(sc);
        clone.position.y = -modelData.naturalMinY * sc;

        // Subtle emissive tint from theme color — makes each type visually distinct
        var emissiveColor = new THREE.Color(col);
        clone.traverse(function(node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    var mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(function(m) {
                        if (m.emissive) { m.emissive.copy(emissiveColor); m.emissiveIntensity = 0.18; }
                    });
                }
            }
        });

        g.add(clone);

        // Role indicator: small glowing orb (emissive only — no PointLight for perf)
        var orbColors = { torre: '#f87171', catapulta: '#fb923c', santuario: '#34d399', bastione: '#94a3b8' };
        var orbCol = orbColors[baseType] || col;
        var orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 7, 7),
            _mat(orbCol, { emissive: orbCol, emissiveI: 1.8 })
        );
        orb.position.y = TARGET_HEIGHT + 0.12;
        orb.name = 'structureOrb';
        g.add(orb);
    });

    return g;
}

// ─── MILITIA — Small support troops ──────────────────────────
function _buildMilitia(unit) {
    var g = new THREE.Group(); g.name = 'militia';
    var typeId = unit && unit.militiaType ? unit.militiaType : 'soldato';
    var mDef = typeof MILITIA_TYPES !== 'undefined' ? MILITIA_TYPES[typeId] : null;
    var col = mDef && mDef.color ? mDef.color.fill : '#6b7280';

    // Tiny fallback capsule shown while GLB loads
    var fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6),
        _mat(col, { emissive: col, emissiveI: 0.15 })
    );
    fallback.position.y = 0.23;
    fallback.castShadow = true;
    fallback.name = 'militia_fallback';
    g.add(fallback);

    // Load real GLB model asynchronously
    _loadMilitiaGLB(typeId, function(modelData) {
        if (!modelData) return;

        // Remove fallback
        var fb = g.getObjectByName('militia_fallback');
        if (fb) { g.remove(fb); if (fb.geometry) fb.geometry.dispose(); if (fb.material) fb.material.dispose(); }

        // Clone scene preserving skeleton
        var clone = window.SkeletonUtils && window.SkeletonUtils.clone
            ? window.SkeletonUtils.clone(modelData.scene)
            : modelData.scene.clone(true);

        // Scale so model height ≈ 0.52 units
        var TARGET_HEIGHT = 0.52;
        var sc = modelData.naturalHeight > 0 ? TARGET_HEIGHT / modelData.naturalHeight : 1;
        clone.scale.setScalar(sc);

        // Offset Y so model feet land at group's local y=0
        clone.position.y = -modelData.naturalMinY * sc;

        clone.traverse(function(node) {
            if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
        });

        g.add(clone);
        g._modelRoot = clone;
        _setupMilitiaMixer(g, clone, modelData.animations, typeId);
    });

    return g;
}

// ── SUMMONED UNIT (zombie, etc.) ──
function _buildSummoned(unit) {
    var g = new THREE.Group(); g.name = 'summoned';
    var typeId = unit && unit.summonType ? unit.summonType : 'zombie';

    // Green-tinted fallback while loading
    var fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6),
        _mat('#4ade80', { emissive: '#22c55e', emissiveI: 0.3 })
    );
    fallback.position.y = 0.23; fallback.name = 'summon_fallback';
    g.add(fallback);

    _loadSummonGLB(typeId, function(modelData) {
        if (!modelData) return;
        var fb = g.getObjectByName('summon_fallback');
        if (fb) { g.remove(fb); if (fb.geometry) fb.geometry.dispose(); if (fb.material) fb.material.dispose(); }

        var clone = window.SkeletonUtils && window.SkeletonUtils.clone
            ? window.SkeletonUtils.clone(modelData.scene)
            : modelData.scene.clone(true);

        var TARGET_HEIGHT = 0.50;
        var sc = modelData.naturalHeight > 0 ? TARGET_HEIGHT / modelData.naturalHeight : 1;
        clone.scale.setScalar(sc);
        clone.position.y = -modelData.naturalMinY * sc;

        // Greenish tint for undead look
        clone.traverse(function(node) {
            if (node.isMesh) {
                node.castShadow = true; node.receiveShadow = true;
                if (node.material) {
                    node.material = node.material.clone();
                    node.material.emissive = new THREE.Color('#1a4d1a');
                    node.material.emissiveIntensity = 0.2;
                }
            }
        });

        g.add(clone);
        g._modelRoot = clone;

        // Setup animations — zombie has its own clips
        if (modelData.animations && modelData.animations.length > 0) {
            var mixer = new THREE.AnimationMixer(clone);
            g._summonMixer = mixer;
            g._summonActions = {};
            for (var i = 0; i < modelData.animations.length; i++) {
                var clip = modelData.animations[i];
                var action = mixer.clipAction(clip);
                g._summonActions[clip.name] = action;
                // Auto-play idle
                if (clip.name.toLowerCase().indexOf('idle') >= 0) {
                    action.loop = THREE.LoopRepeat;
                    action.play();
                    g._summonCurrentAction = action;
                    g._summonIdleClip = clip.name;
                }
                if (clip.name.toLowerCase().indexOf('walk') >= 0) g._summonWalkClip = clip.name;
                if (clip.name.toLowerCase().indexOf('bite') >= 0 || clip.name.toLowerCase().indexOf('attack') >= 0) g._summonAttackClip = clip.name;
            }
        }
    });

    return g;
}

// ── DUNGEON BOSS — Velociraptor Model ──
function _buildDungeonBoss(unit) {
    var g = new THREE.Group();
    g.name = 'dungeonBoss_' + (unit.dungeonId || 'unknown');

    // Determine tier and model from config
    var tierIdx = (unit.dungeonTier || 1) - 1;
    var tierDef = (typeof DUNGEON_BOSS_TIERS !== 'undefined') ? DUNGEON_BOSS_TIERS[tierIdx] : null;
    var modelKey = tierDef ? tierDef.modelKey : 'velociraptor';
    var modelFile = tierDef ? tierDef.modelFile : 'models/dungeon-boss-velociraptor.glb';

    // Scale per tier (bigger dinos for higher tiers)
    var tierScales = { velociraptor: 0.30, stegosaurus: 0.25, parasaurolophus: 0.28, triceratops: 0.28, trex: 0.30 };
    var baseScale = tierScales[modelKey] || 0.25;

    // Tier color themes (emissive tint gets more intense)
    var tierColors = ['#cc8844', '#7788aa', '#aa44aa', '#cc4422', '#ff2200'];
    var tierEmissive = tierColors[tierIdx] || '#ff4444';

    // Fallback while GLB loads
    var fallbackCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.25, 0.7, 8),
        _mat(tierEmissive, { rough: 0.6, metal: 0.5 })
    );
    fallbackCone.castShadow = true;
    fallbackCone.name = 'boss_fallback';
    g.add(fallbackCone);

    // Load the correct GLB model
    _loadDungeonBossGLB(function(modelData) {
        if (!modelData) return;

        var modelClone = window.SkeletonUtils && window.SkeletonUtils.clone
            ? window.SkeletonUtils.clone(modelData.scene)
            : modelData.scene.clone(true);

        if (modelData.animations && modelData.animations.length > 0) {
            g._gltfAnimations = modelData.animations;
        }

        modelClone.scale.set(baseScale, baseScale, baseScale);
        modelClone.position.y = baseScale * 0.3;

        // Dark brown mottled base + tier emissive tint
        var _bs = 7777 + tierIdx * 3333;
        function _br() { _bs = ((_bs * 1664525) + 1013904223) & 0x7fffffff; return _bs / 0x7fffffff; }
        var browns = ['#3b2214', '#4a2e1a', '#2e1a0e', '#5a3a22', '#332010'];
        var spots  = ['#1a0e06', '#0f0804', '#261508'];

        modelClone.traverse(function(node) {
            if (node.isMesh && node.material) {
                var mat = node.material.clone();
                mat.color = new THREE.Color(_br() > 0.4 ? browns[Math.floor(_br() * browns.length)] : spots[Math.floor(_br() * spots.length)]);
                mat.emissive = new THREE.Color(tierEmissive);
                mat.emissiveIntensity = 0.2 + tierIdx * 0.08;
                mat.roughness = 0.85;
                mat.metalness = 0.05;
                node.material = mat;
            }
        });

        g._modelRoot = modelClone;

        // Remove fallback
        var fb = g.getObjectByName('boss_fallback');
        if (fb) g.remove(fb);

        g.add(modelClone);

        // Aura circle (tier-colored)
        var auraSize = 0.5 + tierIdx * 0.15;
        var aura = new THREE.Mesh(
            new THREE.CylinderGeometry(auraSize, auraSize, 0.05, 16),
            new THREE.MeshBasicMaterial({ color: tierEmissive, transparent: true, opacity: 0.2, depthWrite: false })
        );
        aura.position.y = 0.01;
        g.add(aura);

        console.log('Boss ' + (tierDef ? tierDef.name : modelKey) + ' loaded (tier ' + (tierIdx + 1) + ', scale ' + baseScale.toFixed(2) + ')');
    }, modelKey, modelFile);

    return g;
}

function _buildDefault() {
    var g = new THREE.Group(); g.name = 'default';
    var body = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 8, 6),
        _mat('#888888')
    );
    body.position.y = 0.3;
    body.castShadow = true;
    g.add(body);
    return g;
}
