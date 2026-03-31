// ============================================================
// LOTA AUTO CHESS — three-animations.js — 3D Animations
// ============================================================

// Pre-allocated temp objects — evitano GC pressure nel loop per-frame
var _tmpVec3   = new THREE.Vector3();
var _tmpQuat1  = new THREE.Quaternion();
var _tmpQuat2  = new THREE.Quaternion();

// ── Lazy per-group object cache ──────────────────────────────────────────
// Evita getObjectByName() ogni frame: la prima chiamata traversa e mette in
// cache, le successive restituiscono il riferimento direttamente.
function _getCached(g, name) {
    if (!g._objCache) g._objCache = {};
    if (g._objCache[name] !== undefined) return g._objCache[name];
    g._objCache[name] = g.getObjectByName(name);
    return g._objCache[name];
}

// ── Lazy emissive-mesh list ──────────────────────────────────────────────
// Attraversa la gerarchia UNA SOLA VOLTA, poi riusa la lista.
// Chiamare questa invece di g.traverse() ovunque servano i mesh emissivi.
function _ensureEmissiveCache(g, entry) {
    if (entry._emissiveMeshes) return entry._emissiveMeshes;
    entry._emissiveMeshes = [];
    entry._allMeshes = [];
    g.traverse(function(ch) {
        if (!ch.isMesh) return;
        entry._allMeshes.push(ch);
        if (ch.material && ch.material.emissive) entry._emissiveMeshes.push(ch);
    });
    return entry._emissiveMeshes;
}

// ---- Unit model lifecycle ----

function spawnUnitModel3D(unit) {
    if (threeUnitModels[unit.id]) return; // already exists
    console.log('[3D-SPAWN] Creating model for ' + unit.charId + ' (id=' + unit.id + ', owner=' + unit.owner + ', row=' + unit.row + ', col=' + unit.col + ')');
    var group = createCharacterModel3D(unit.charId, unit);

    // ── Bounding-box feet placement ──
    var TILE_TOP = TILE_Y * 2; // 0.15 — tile surface world Y
    var feetOffset;
    if (unit.isAvatar) {
        // Per l'avatar: usa sempre TILE_TOP — il bbox sul SkinnedMesh clonato è
        // inaffidabile se il callback del GLB ha già spostato il gruppo (cache sync)
        feetOffset = TILE_TOP;
    } else {
        // Compute bbox while group is still at origin
        var _bbox = new THREE.Box3().setFromObject(group);
        var feetMinY = _bbox.min.y;
        feetOffset = TILE_TOP - feetMinY;
    }

    var worldPos = cellToWorld(unit.row, unit.col);
    worldPos.y = feetOffset;
    group.position.copy(worldPos);

    // face toward board center
    _tmpVec3.set(BOARD_CX, worldPos.y, BOARD_CZ);
    group.lookAt(_tmpVec3);

    // ── Team indicators ──
    var ownerIdx = unit.owner;
    var teamColor = (typeof ownerIdx === 'number' && TEAM_COLORS[ownerIdx])
        ? TEAM_COLORS[ownerIdx].primary : null;

    if (teamColor) {
        var _fmy = (feetMinY !== undefined) ? feetMinY : 0;
        _addTeamBase(group, teamColor, _fmy);
        _addTeamBanner(group, teamColor, unit.charId);
        _addTeamGroundGlow(group, teamColor);
    }

    // ── Star visual upgrades ──
    if (typeof applyStarUpgrade === 'function') {
        applyStarUpgrade(group, unit.charId, unit.star, unit);
    }

    // ── Survival cosmetics ──
    if (typeof applySurvivalUpgrade === 'function' && unit.survivalCount > 0) {
        applySurvivalUpgrade(group, unit.charId, unit.survivalCount);
    }

    threeScene.add(group);

    // HP bar (positioned based on actual model height after scaling)
    var effectiveHeight = _modelHeight(unit.charId) * (STAR_SCALE[Math.min(unit.star, 5)] || 1.0);
    var hpSprite = createHpBarSprite3D();
    hpSprite.position.set(0, effectiveHeight + 0.25, 0);
    group.add(hpSprite);

    // Star indicator sprite
    if (unit.star > 0) {
        var starSprite = _createStarSprite(unit.star);
        starSprite.position.set(0, effectiveHeight + 0.32, 0);
        group.add(starSprite);
    }

    var entry = {
        group:      group,
        hpSprite:   hpSprite,
        charId:     unit.charId,
        owner:      ownerIdx,
        star:       unit.star,
        targetPos:  worldPos.clone(),
        feetOffset: feetOffset,  // world Y where group origin sits so feet = TILE_TOP
        spawnTime:  renderTime,
        animationMixer:   null,
        currentAnimation: null
    };

    // Setup AnimationMixer for GLB models with animations (e.g., avatar_guerriero)
    if (unit.charId && unit.charId.startsWith('avatar_') && typeof avatarAnimationMixers !== 'undefined') {
        _initializeAvatarAnimations(unit, group, entry);
    }

    // Setup AnimationMixer for dungeon boss GLB models
    if (unit.charId && unit.charId.startsWith('boss_') && group._gltfAnimations && group._gltfAnimations.length > 0) {
        // animation debug removed
        _initializeDungeonBossAnimations(unit, group, entry);
    }

    // Add beacon pillar above other players' avatars (tall colored light column)
    if (unit.isAvatar && typeof TEAM_COLORS !== 'undefined' && TEAM_COLORS[ownerIdx]) {
        var beaconCol = TEAM_COLORS[ownerIdx].primary || '#ffffff';
        var beaconGeo = new THREE.CylinderGeometry(0.03, 0.08, 3.0, 6);
        var beaconMat = new THREE.MeshBasicMaterial({ color: beaconCol, transparent: true, opacity: 0.5, depthWrite: false });
        var beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, 1.8, 0);
        beacon.name = 'avatar_beacon';
        group.add(beacon);
        // Glow sphere at top
        var beaconTip = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 8),
            new THREE.MeshBasicMaterial({ color: beaconCol, transparent: true, opacity: 0.8 })
        );
        beaconTip.position.set(0, 3.3, 0);
        beaconTip.name = 'avatar_beacon_tip';
        group.add(beaconTip);
    }

    threeUnitModels[unit.id] = entry;
}

// ── Initialize AnimationMixer for GLB avatar models ──
function _initializeAvatarAnimations(unit, group, entry) {
    if (group._gltfAnimations && group._gltfAnimations.length > 0) {
        // animation debug removed

        // Create mixer
        var mixer = new THREE.AnimationMixer(group);
        entry.animationMixer = mixer;

        // Find and play idle animation
        var idleClip = null;
        for (var i = 0; i < group._gltfAnimations.length; i++) {
            var clip = group._gltfAnimations[i];
            var name = clip.name.toLowerCase();
            if (name.includes('idle') || name.includes('stand') || name.includes('rest')) {
                idleClip = clip;
                break;
            }
        }

        // Fallback: use first animation if no idle found
        if (!idleClip && group._gltfAnimations.length > 0) {
            idleClip = group._gltfAnimations[0];
            console.warn('  No idle animation found, using: ' + idleClip.name);
        }

        if (idleClip) {
            var action = mixer.clipAction(idleClip);
            action.loop = THREE.LoopRepeat;
            action.clampWhenFinished = false;
            action.play();
            entry.currentAnimation = idleClip.name;
            console.log('  ✓ Playing: ' + idleClip.name + ' (' + idleClip.duration.toFixed(2) + 's)');
        } else {
            console.warn('  No animations available for ' + unit.charId);
        }
    }
}

// ── Initialize AnimationMixer for dungeon boss GLB models ──
function _initializeDungeonBossAnimations(unit, group, entry) {
    if (!group._gltfAnimations || group._gltfAnimations.length === 0) {
        console.warn('No animations found for dungeon boss ' + unit.charId);
        return;
    }

    // Get the actual model root (the cloned scene inside the group)
    var modelRoot = group._modelRoot || group.children[0];
    if (!modelRoot) {
        console.warn('Could not find model root for animation mixer');
        return;
    }

    // animation debug removed

    // Create mixer
    var mixer = new THREE.AnimationMixer(modelRoot);
    entry.animationMixer = mixer;

    // Find attack animation (aggressive!) or idle as fallback
    var attackClip = null;
    var idleClip = null;

    for (var i = 0; i < group._gltfAnimations.length; i++) {
        var clip = group._gltfAnimations[i];
        var name = clip.name.toLowerCase();

        // Prioritize attack/action animations (aggressivo!)
        if (name.includes('attack') || name.includes('action')) {
            attackClip = clip;
            break;
        }
        // Fallback: idle animations
        if (!idleClip && (name.includes('idle') || name.includes('stand') || name.includes('rest'))) {
            idleClip = clip;
        }
    }

    // Use attack if found, otherwise idle
    var selectedClip = attackClip || idleClip;

    // Fallback: use first animation if nothing else found
    if (!selectedClip && group._gltfAnimations.length > 0) {
        selectedClip = group._gltfAnimations[0];
        console.warn('  No attack/idle animation found, using: ' + selectedClip.name);
    }

    if (selectedClip) {
        var action = mixer.clipAction(selectedClip);
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
        action.play();
        entry.currentAnimation = selectedClip.name;
        console.log('  ✓ Playing AGGRESSIVE: ' + selectedClip.name + ' (' + selectedClip.duration.toFixed(2) + 's)');
    } else {
        console.warn('  No animations available for ' + unit.charId);
    }
}

// ── Initialize AnimationMixer for militia GLB models (prefers Idle) ──
function _initializeMilitiaAnimations(unit, group, entry) {
    var modelRoot = group._modelRoot || group.children[0];
    if (!modelRoot || !group._gltfAnimations || group._gltfAnimations.length === 0) return;

    var mixer = new THREE.AnimationMixer(modelRoot);
    entry.animationMixer = mixer;

    // Prefer idle, fall back to first clip
    var clip = null;
    for (var i = 0; i < group._gltfAnimations.length; i++) {
        var name = group._gltfAnimations[i].name.toLowerCase();
        if (name === 'idle' || name.includes('idle')) { clip = group._gltfAnimations[i]; break; }
    }
    if (!clip) clip = group._gltfAnimations[0];

    var action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    action.clampWhenFinished = false;
    action.play();
    entry.currentAnimation = clip.name;
    console.log('  ✓ Militia ' + unit.charId + ' playing: ' + clip.name);
}

// ── Team-colored pedestal ring at the base ──
function _addTeamBase(group, colorHex, feetMinY) {
    // feetMinY: local-space Y of the model's lowest point (0 if unknown)
    // Position ring so its bottom sits at the feet level (tile surface)
    var _fy = (feetMinY !== undefined ? feetMinY : 0);
    var ringY = _fy + 0.04; // torus minor-radius=0.04 → bottom at _fy (tile surface)

    // outer ring (torus)
    var ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.4
        })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = ringY;
    ring.name = 'teamRing';
    group.add(ring);

    // filled disc (subtle platform)
    var disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 24),
        new THREE.MeshStandardMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.15,
            roughness: 0.9,
            side: THREE.DoubleSide
        })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = _fy + 0.002; // just above feet level to avoid z-fighting with tile
    disc.name = 'teamDisc';
    group.add(disc);
}

// ── Team-colored banner/flag on the unit's back ──
function _addTeamBanner(group, colorHex, charId) {
    var bannerH = 0.35;
    var bannerW = 0.12;
    var poleH = _modelHeight(charId) * 0.7;

    // pole
    var pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, poleH, 4),
        new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.4, metalness: 0.5 })
    );
    pole.position.set(0, poleH / 2, -0.25);
    pole.name = 'bannerPole';
    group.add(pole);

    // flag (plane geometry)
    var flag = new THREE.Mesh(
        new THREE.PlaneGeometry(bannerW, bannerH),
        new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.3,
            roughness: 0.7,
            side: THREE.DoubleSide
        })
    );
    flag.position.set(bannerW / 2 + 0.01, poleH - bannerH / 2 - 0.02, -0.25);
    flag.name = 'bannerFlag';
    group.add(flag);

    // flag top accent (tiny sphere)
    var tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 6, 6),
        new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.5
        })
    );
    tip.position.set(0, poleH + 0.01, -0.25);
    group.add(tip);
}

// ── Glowing ground circle (team halo) ──
function _addTeamGroundGlow(group, colorHex) {
    var glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 24),
        new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.005;
    glow.name = 'teamGlow';
    group.add(glow);
}

// ── Star indicator sprite ──
function _createStarSprite(starCount) {
    var c = document.createElement('canvas');
    c.width = 80; c.height = 16;
    var cx = c.getContext('2d');
    cx.font = '12px sans-serif';
    cx.fillStyle = '#fbbf24';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('\u2605'.repeat(Math.min(starCount, 5)), 40, 8);

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    var mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: true, depthWrite: false,
        sizeAttenuation: false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.06, 0.012, 1);
    sprite.renderOrder = 998;
    sprite.name = 'starSprite';
    return sprite;
}

function removeUnitModel3D(unitId) {
    var entry = threeUnitModels[unitId];
    if (!entry) return;
    threeScene.remove(entry.group);
    // Dispose AnimationMixer
    if (entry.animationMixer) {
        entry.animationMixer.stopAllAction();
        entry.animationMixer.uncacheRoot(entry.group);
    }
    // Dispose geometries, materials, textures
    entry.group.traverse(function(child) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                for (var m = 0; m < child.material.length; m++) {
                    if (child.material[m].map) child.material[m].map.dispose();
                    child.material[m].dispose();
                }
            } else {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
        // Dispose HP bar / star sprite canvas textures
        if (child.userData && child.userData.texture) {
            child.userData.texture.dispose();
        }
        // Remove PointLights from scene
        if (child.isLight) {
            threeScene.remove(child);
        }
    });
    delete threeUnitModels[unitId];
}

function clearAllUnitModels3D() {
    for (var id in threeUnitModels) {
        removeUnitModel3D(id);
    }
    threeUnitModels = {};
}

function _modelHeight(charId) {
    switch (charId) {
        case 'Babidi':  return 1.1;
        case 'Caronte': return 1.15;
        case 'Valerio': return 0.85;
        case 'Yujin':   return 1.15;
        case 'WMS':     return 0.95;
        case 'militia_soldato':
        case 'militia_arciere':
        case 'militia_guaritore':
        case 'militia_esploratore': return 0.55;
        default:        return 0.8;
    }
}

// ---- Per-frame animation update ----

function updateAnimations3D(dt, units) {
    if (!units) return;
    var t = renderTime;

    for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        var entry = threeUnitModels[unit.id];
        if (!entry) {
            // unit exists but no 3D model yet — create it
            spawnUnitModel3D(unit);
            entry = threeUnitModels[unit.id];
            if (!entry) continue;
        }

        // ---- STAR CHANGE DETECTION — rebuild model on merge ----
        if (entry.star !== unit.star) {
            _onStarMerge(unit, entry);
            entry = threeUnitModels[unit.id];
            if (!entry) continue;
        }

        var g = entry.group;
        var phase = t + unit.id * 1.618;

        // ---- AnimationMixer setup (delayed after GLB loads) ----
        if (!entry.animationMixer && g._gltfAnimations && g._gltfAnimations.length > 0) {
            // animation debug removed
            if (g._preferIdleAnim) {
                _initializeMilitiaAnimations(unit, g, entry);
            } else {
                _initializeDungeonBossAnimations(unit, g, entry);
            }
        }

        // ---- AnimationMixer update (for GLB models with animations) ----
        if (g._avatarAnimator) {
            g._avatarAnimator.mixer.update(dt);
        } else if (entry.animationMixer) {
            entry.animationMixer.update(dt);
        }

        // ---- Avatar: nascondi banner e cerchio in FPS, mostrali in tattica ----
        if (unit.isAvatar) {
            var _fps = (typeof _tacticalView !== 'undefined') && !_tacticalView;
            var _bn = _getCached(g, 'bannerPole');
            var _bf = _getCached(g, 'bannerFlag');
            var _tr = _getCached(g, 'teamRing');
            var _td = _getCached(g, 'teamDisc');
            var _tg = _getCached(g, 'teamGlow');
            if (_bn) _bn.visible = !_fps;
            if (_bf) _bf.visible = !_fps;
            if (_tr) _tr.visible = !_fps;
            if (_td) _td.visible = !_fps;
            if (_tg) _tg.visible = !_fps;

            // ---- Melee arc: direction + visibility + flash + dynamic combo step ----
            var _arc = _getCached(g, 'meleeArc');
            if (_arc) {
                _arc.visible = _fps && unit.alive !== false;
                if (_arc.visible) {
                    _arc.rotation.y = 0;

                    // ── Dynamic arc resize based on next combo step ──
                    if (unit.avatarClass && typeof _COMBO_PARAMS !== 'undefined' && typeof _avatarComboStep !== 'undefined' && typeof _rebuildMeleeArc === 'function') {
                        var _nextStep = (_avatarComboStep === 0 || _avatarComboStep >= 3) ? 1 : _avatarComboStep + 1;
                        if (_nextStep !== _arc._currentStep) {
                            var _cp = _COMBO_PARAMS[unit.avatarClass];
                            if (_cp && _cp[_nextStep]) {
                                var _sp = _cp[_nextStep];
                                var _rW = _sp.range * (typeof TILE_UNIT !== 'undefined' ? TILE_UNIT : 1.0);
                                var _stepCols = { 1: '#60a5fa', 2: '#93c5fd', 3: '#fbbf24' };
                                if (unit.avatarClass === 'stregone') _stepCols = { 1: '#c084fc', 2: '#d8b4fe', 3: '#e879f9' };
                                else if (unit.avatarClass === 'mistico') _stepCols = { 1: '#4ade80', 2: '#86efac', 3: '#fbbf24' };
                                var _sCol = _stepCols[_nextStep] || '#60a5fa';
                                _rebuildMeleeArc(_arc, _rW, _sp.arcDeg, _sCol, 0.10);
                                _arc._currentStep = _nextStep;
                            }
                        }
                    }

                    // Subtle idle pulse
                    var _pulse = 0.07 + 0.03 * Math.sin(t * 3.5);
                    if (_arc._fill && _arc._flashTimer <= 0) {
                        _arc._fill.material.opacity = _pulse;
                        _arc._edge.material.opacity = 0.45 + 0.15 * Math.sin(t * 3.5);
                    }
                    // Flash decay
                    if (_arc._flashTimer > 0) {
                        _arc._flashTimer -= dt;
                        var _ft = Math.max(0, _arc._flashTimer / _arc._flashDur);
                        if (_arc._fill) _arc._fill.material.opacity = _pulse + _ft * 0.35;
                        if (_arc._edge) _arc._edge.material.opacity = 0.60 + _ft * 0.35;
                        if (_arc._flashTimer <= 0) {
                            if (_arc._fill) _arc._fill.material.color.set(_arc._baseColor);
                            if (_arc._edge) _arc._edge.material.color.set(_arc._baseColor);
                        }
                    }
                }
            }

        }

        // ---- Stratega target circle: always visible during combat ----
        if (unit.isAvatar && (unit.avatarClass === 'stratega' || (unit.charId && unit.charId.indexOf('stratega') >= 0))) {
            var _inCombat = (typeof gamePhase !== 'undefined' && typeof PHASE_COMBAT !== 'undefined' && gamePhase === PHASE_COMBAT);
            // Create once
            if (!window._strategaTargetCircle && typeof _createStrategaTargetCircle === 'function' && threeScene) {
                var _tR = (typeof STRATEGA_TARGET_RADIUS !== 'undefined' ? STRATEGA_TARGET_RADIUS : 1.5) * TILE_UNIT;
                window._strategaTargetCircle = _createStrategaTargetCircle(_tR);
                threeScene.add(window._strategaTargetCircle);
                window._strategaTargetCircle._outerRef = window._strategaTargetCircle.getObjectByName('outerRing');
                window._strategaTargetCircle._innerRef = window._strategaTargetCircle.getObjectByName('innerRing');
                console.log('🎯 Stratega target circle creato!');
            }
            var _tc = window._strategaTargetCircle;
            if (_tc) {
                _tc.visible = _inCombat && unit.alive !== false;
                if (_tc.visible) {
                    var _avWX = (unit._smoothWX !== undefined) ? unit._smoothWX : g.position.x;
                    var _avWZ = (unit._smoothWZ !== undefined) ? unit._smoothWZ : g.position.z;
                    var _facing = (typeof _camOrbitAngle !== 'undefined') ? (_camOrbitAngle + Math.PI) : 0;
                    var _tRange = (typeof STRATEGA_TARGET_RANGE !== 'undefined' ? STRATEGA_TARGET_RANGE : 4.0) * TILE_UNIT;
                    var _tcX = _avWX + Math.sin(_facing) * _tRange;
                    var _tcZ = _avWZ + Math.cos(_facing) * _tRange;
                    _tc.position.set(_tcX, UNIT_BASE_Y + 0.02, _tcZ);
                    _strategaTargetWX = _tcX;
                    _strategaTargetWZ = _tcZ;

                    // Pulse
                    _tc.scale.setScalar(0.90 + 0.10 * Math.sin(t * 3.0));

                    // Combo color shift
                    var _outerR = _tc._outerRef, _innerR = _tc._innerRef;
                    if (_outerR && typeof _avatarComboStep !== 'undefined') {
                        if (_avatarComboStep === 2) {
                            _outerR.material.opacity = 0.50 + 0.15 * Math.sin(t * 6);
                            if (!_tc._wasGold) { _outerR.material.color.set('#fbbf24'); if (_innerR) _innerR.material.color.set('#fbbf24'); _tc._wasGold = true; }
                        } else {
                            _outerR.material.opacity = 0.40 + 0.08 * Math.sin(t * 3.5);
                            if (_tc._wasGold) { _outerR.material.color.set('#60a5fa'); if (_innerR) _innerR.material.color.set('#60a5fa'); _tc._wasGold = false; }
                        }
                        if (_innerR) _innerR.material.opacity = _avatarComboStep === 2 ? 0.30 : 0.20;
                    }
                }
            }
        }

        // ---- Furia Immortale: red aura while avatar._invulnerable ----
        if (unit.isAvatar && g._avatarAnimator && g._avatarAnimator.furiaActive) {
            if (!unit._invulnerable) {
                // Invulnerability expired — end furia, return to idle
                g._avatarAnimator.furiaActive = false;
                if (g._avatarAnimator.idleClipName && typeof _playAvatarAnimation === 'function') {
                    _playAvatarAnimation(g, g._avatarAnimator.idleClipName, 0.6);
                }
            } else {
                if (!entry._furiaAuraTimer) entry._furiaAuraTimer = 0;
                entry._furiaAuraTimer -= dt;
                if (entry._furiaAuraTimer <= 0) {
                    entry._furiaAuraTimer = 0.10;
                    if (typeof _rising3D === 'function') _rising3D(g.position.x, g.position.y, g.position.z, 3, '#ef4444', 0.45);
                    if (typeof _ring3D === 'function') _ring3D(g.position.x, g.position.y + 0.05, g.position.z, 0.22, '#ff2200', 8, 0.20);
                }
            }
        }

        // ---- Avatar skeletal animation: idle <-> walk <-> run switching ----
        if (unit.isAvatar && g._avatarAnimator && g._avatarAnimator.currentAction) {
            if (!g._avatarAnimator.attacking) {
                var isMoving = (typeof _avatarInited !== 'undefined' && _avatarInited)
                    ? (Math.abs(unit._smoothWX - (entry._lastWX || unit._smoothWX)) > 0.005 ||
                       Math.abs(unit._smoothWZ - (entry._lastWZ || unit._smoothWZ)) > 0.005)
                    : false;
                entry._lastWX = unit._smoothWX;
                entry._lastWZ = unit._smoothWZ;

                var isRunning = (typeof _avatarRunning !== 'undefined') && _avatarRunning;
                var desiredAnim = isMoving ? (isRunning ? 'run' : 'walk') : 'idle';

                if (desiredAnim !== entry._avatarDesiredAnim) {
                    entry._avatarDesiredAnim = desiredAnim;
                    var anim = g._avatarAnimator;
                    var targetClip;
                    if (!isMoving) {
                        targetClip = anim.idleClipName;
                    } else if (isRunning) {
                        // run → fall back to walk if no run clip
                        targetClip = anim.runClipName || anim.walkClipName || anim.idleClipName;
                    } else {
                        targetClip = anim.walkClipName || anim.idleClipName;
                    }
                    if (targetClip && typeof _playAvatarAnimation === 'function') {
                        _playAvatarAnimation(g, targetClip, 0.25);
                        // animation debug removed
                    }
                }
            } // end if (!attacking)
        }

        // ---- Militia skeletal animation: idle / walk / attack / hit / death ----
        if (unit.isMilitia && g._militiaAnimator) {
            var ma = g._militiaAnimator;
            ma.mixer.update(dt);

            if (!unit.alive && !ma.dead) {
                // Death — one-shot, then freeze
                ma.dead = true;
                ma.attacking = false;
                if (ma.deathClipName) _playMilitiaAnimation(g, ma.deathClipName, 0.1);
            } else if (unit.alive) {
                // Attack-timer countdown
                if (ma.attacking) {
                    ma.attackTimer -= dt;
                    if (ma.attackTimer <= 0) {
                        ma.attacking = false;
                        entry._milDesired = null; // allow state machine to re-evaluate
                    }
                }

                // Detect rising edge of hitAnim (new hit received)
                var prevHit = entry._prevHitAnim || 0;
                entry._prevHitAnim = unit.hitAnim;
                if (!ma.attacking && unit.hitAnim > 0.7 && prevHit <= 0.7 && ma.hitClipName) {
                    _playMilitiaAnimation(g, ma.hitClipName, 0.05);
                    ma.attacking = true;
                    var hitClipDur = ma.actions[ma.hitClipName].getClip().duration / (ma.actions[ma.hitClipName].timeScale || 1.0);
                    ma.attackTimer = hitClipDur * 0.65;
                    entry._milDesired = null;
                }

                // Detect rising edge of atkAnim (unit just fired an attack)
                var prevAtk = entry._prevAtkAnim || 0;
                entry._prevAtkAnim = unit.atkAnim;
                if (!ma.attacking && unit.atkAnim > 0.7 && prevAtk <= 0.7) {
                    // Alternate atk1 / atk2
                    entry._milAtkToggle = !entry._milAtkToggle;
                    var clipN = entry._milAtkToggle
                        ? (ma.atk2ClipName || ma.atk1ClipName)
                        : (ma.atk1ClipName || ma.atk2ClipName);
                    if (clipN && ma.actions[clipN]) {
                        _playMilitiaAnimation(g, clipN, 0.05);
                        ma.attacking = true;
                        ma.attackTimer = ma.actions[clipN].getClip().duration / (ma.actions[clipN].timeScale || 1.0) * 0.8;
                        entry._milDesired = 'atk';
                    }
                }

                // Movement / idle state machine (only when not in attack/hit animation)
                if (!ma.attacking) {
                    var mx = g.position.x;
                    var mz = g.position.z;
                    var isMoving = (entry._lastMX !== undefined) &&
                        (Math.abs(mx - entry._lastMX) > 0.004 || Math.abs(mz - entry._lastMZ) > 0.004);
                    entry._lastMX = mx;
                    entry._lastMZ = mz;

                    var milDesired = isMoving ? 'walk' : 'idle';
                    if (milDesired !== entry._milDesired) {
                        entry._milDesired = milDesired;
                        var milClip = isMoving
                            ? (ma.walkClipName || ma.idleClipName)
                            : ma.idleClipName;
                        if (milClip) _playMilitiaAnimation(g, milClip, 0.2);
                    }
                }
            }
        }

        // ---- Structure orb pulse (emissive only, no PointLight) ----
        if (unit.isStructure) {
            if (!entry._structureOrb) entry._structureOrb = g.getObjectByName('structureOrb');
            var _orb = entry._structureOrb;
            if (_orb) {
                var _pulse = 0.88 + 0.12 * Math.sin(phase * 2.4);
                _orb.scale.setScalar(_pulse);
                if (_orb.material) _orb.material.emissiveIntensity = 1.4 + 0.6 * Math.sin(phase * 2.4);
            }
        }

        // ---- merge grow-in animation ----
        if (entry._mergeGrow && entry._mergeGrow > 0) {
            entry._mergeGrow -= dt * 2.5; // grows over ~0.4s
            var growP = 1.0 - Math.max(0, entry._mergeGrow);
            // elastic ease out: overshoot then settle
            var elastic = 1.0 + Math.sin(growP * Math.PI * 1.5) * 0.15 * (1 - growP);
            var targetScale = STAR_SCALE[Math.min(unit.star, 5)] || 1.0;
            g.scale.setScalar(targetScale * elastic);

            // golden glow during growth
            if (growP < 0.8) {
                var _em = _ensureEmissiveCache(g, entry);
                for (var _mi = 0; _mi < _em.length; _mi++) {
                    if (_em[_mi].material && _em[_mi].material.emissive) {
                        _em[_mi].material.emissive.setHex(0xfbbf24);
                        _em[_mi].material.emissiveIntensity = (1 - growP) * 1.5;
                    }
                }
            } else {
                _restoreEmissives(g, entry);
            }

            if (entry._mergeGrow <= 0) {
                entry._mergeGrow = 0;
                g.scale.setScalar(targetScale);
                _restoreEmissives(g, entry);
            }
        }

        // ---- position lerp (free movement) ----
        var _unitY = entry.feetOffset !== undefined ? entry.feetOffset : UNIT_BASE_Y;
        if (unit.isAvatar && unit._smoothWX !== undefined && unit._smoothWZ !== undefined) {
            _tmpVec3.set(unit._smoothWX, _unitY, unit._smoothWZ);
        } else if (unit._freeMove) {
            // Use continuous world position for free movement
            _tmpVec3.set(unit.wx, _unitY, unit.wz);
        } else {
            var _cw = cellToWorld(unit.row, unit.col);
            _tmpVec3.set(_cw.x, _unitY, _cw.z);
        }
        entry.targetPos.copy(_tmpVec3);
        // Smooth follow: tight lerp since wx/wz update every frame
        var _moveDist = g.position.distanceTo(entry.targetPos);
        if (_moveDist < 0.01) {
            g.position.copy(entry.targetPos);
        } else {
            // Tight follow for smooth continuous movement
            var _lerpFactor = unit.isAvatar ? 0.3 : (unit._freeMove ? 0.35 : 0.18);
            g.position.lerp(entry.targetPos, _lerpFactor);
        }

        // ---- rotation ----
        var _mySlotAnim = (typeof window !== 'undefined' && window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
        if (unit.isAvatar && unit.owner === _mySlotAnim && typeof _camOrbitAngle !== 'undefined') {
            // Local avatar: use camera orbit angle
            var _meshOff = (g._modelYRotOffset !== undefined) ? g._modelYRotOffset : 0;
            g.rotation.set(0, _camOrbitAngle + Math.PI - _meshOff, 0);
        } else if (unit.isAvatar && unit._remoteFacing !== undefined) {
            // Remote avatar: use synced facing angle
            var _meshOff2 = (g._modelYRotOffset !== undefined) ? g._modelYRotOffset : 0;
            var _targetRot = unit._remoteFacing + Math.PI - _meshOff2;
            // Smooth rotation lerp
            var _curRot = g.rotation.y;
            var _diff = _targetRot - _curRot;
            while (_diff > Math.PI) _diff -= Math.PI * 2;
            while (_diff < -Math.PI) _diff += Math.PI * 2;
            g.rotation.set(0, _curRot + _diff * 0.15, 0);
        } else {
            // Non-avatar: slerp — zero allocazioni, usa temp pre-allocati
            _tmpVec3.set(BOARD_CX, g.position.y, BOARD_CZ);
            if (unit.targetUnitId) {
                var targetEntry = threeUnitModels[unit.targetUnitId];
                if (targetEntry) {
                    _tmpVec3.set(targetEntry.group.position.x, g.position.y, targetEntry.group.position.z);
                }
            }
            _tmpQuat1.copy(g.quaternion);
            g.lookAt(_tmpVec3);
            _tmpQuat2.copy(g.quaternion);
            g.quaternion.copy(_tmpQuat1);
            g.quaternion.slerp(_tmpQuat2, 0.18);
        }

        // ======== DEATH — spectacular KO ========
        if (!unit.alive) {
            _animateKO(g, unit, dt, entry);
            continue;
        }

        // ======== SKILL CAST — overrides idle during cast window ========
        if (entry._skillCast && entry._skillCast.elapsed < entry._skillCast.duration) {
            _animateSkillCast(g, unit.charId, entry._skillCast, dt, entry);
            entry._skillCast.elapsed += dt;
        } else {
            if (entry._skillCast) { entry._skillCast = null; _restoreEmissives(g, entry); }
            // ======== IDLE ========
            _animateIdle(g, unit.charId, phase, dt, unit);
        }

        // ======== STAR/SURVIVAL UPGRADE ANIMATIONS ========
        if (typeof _animateStarUpgrades === 'function') {
            _animateStarUpgrades(g, phase, unit.star);
        }

        // ======== TEAM INDICATORS ========
        _animateTeamIndicators(g, phase);

        // ======== DODGE / MISS ========
        if (unit._dodgeAnim && unit._dodgeAnim > 0) {
            _animateDodge(g, unit, dt);
        }

        // ======== ATTACK — character-specific arm/weapon swing ========
        if (unit.atkAnim > 0.1) {
            _animateAttack(g, unit, dt);
        }

        // ======== HIT — impact flash + vibration + hit mark ========
        var _prevHitV = entry._prevHitV || 0;
        entry._prevHitV = unit.hitAnim;
        if (unit.hitAnim > 0.75 && _prevHitV <= 0.75) {
            // Rising edge: spawn hit mark VFX once + cache emissive mesh list
            if (!entry._emissiveMeshes) {
                entry._emissiveMeshes = [];
                g.traverse(function(ch) {
                    if (ch.isMesh && ch.material && ch.material.emissive)
                        entry._emissiveMeshes.push(ch);
                });
            }
            if (typeof vfxHitMark3D === 'function') {
                vfxHitMark3D(g.position.x, g.position.y + 0.25, g.position.z,
                             unit._critFlash > 0, unit.charId);
            }
            entry._emissiveDirty = true;
        }
        if (unit.hitAnim > 0.1) {
            _animateHit(g, unit, dt);
        } else if (entry._emissiveDirty) {
            // Restore only once when hit ends — not every frame
            entry._emissiveDirty = false;
            _restoreEmissives(g, entry);
        }

        // ======== CRIT RECEIVED — massive impact ========
        if (unit._critFlash && unit._critFlash > 0) {
            _animateCritImpact(g, unit, dt);
        }

        // ======== FURIA GLOW (Yujin) ========
        if (unit.furiaActive && unit.charId === 'Yujin') {
            var eyes = [_getCached(g, 'eyeL'), _getCached(g, 'eyeR')];
            for (var ei = 0; ei < eyes.length; ei++) {
                if (eyes[ei] && eyes[ei].material) {
                    eyes[ei].material.color.setHex(0xef4444);
                    if (eyes[ei].material.emissive) {
                        eyes[ei].material.emissive.setHex(0xef4444);
                        eyes[ei].material.emissiveIntensity = 1.0;
                    }
                }
            }
        }

        // ======== HOVER GLOW + VIBRATION ========
        var isHovered = (typeof hoveredUnitId !== 'undefined' && hoveredUnitId === unit.id);
        _animateHover(g, entry, isHovered, t, dt);

        // ======== HP BAR ========
        if (entry.hpSprite) {
            updateHpBarSprite3D(entry.hpSprite, unit);
        }
    }

    // remove models for units that no longer exist — O(n) lookup
    var _liveIds = {};
    for (var _li = 0; _li < units.length; _li++) _liveIds[units[_li].id] = 1;
    for (var id in threeUnitModels) {
        if (!_liveIds[id]) removeUnitModel3D(parseInt(id));
    }
}

// ====================================================================
//  STAR MERGE — destroy old model, create upgraded one, play VFX
// ====================================================================
function _onStarMerge(unit, oldEntry) {
    var oldPos = oldEntry.group.position.clone();
    var oldQuat = oldEntry.group.quaternion.clone();
    var oldStar = oldEntry.star;
    var newStar = unit.star;
    var charId = unit.charId;
    var charCol = CHAR_COLORS[charId] ? CHAR_COLORS[charId].fill : '#fbbf24';

    // ── VFX: star merge explosion at old position ──
    if (typeof _burst3D === 'function') {
        // ring of gold particles for each new star
        var starDiff = newStar - oldStar;
        for (var s = 0; s < starDiff; s++) {
            setTimeout(function(idx) {
                return function() {
                    _ring3D(oldPos.x, oldPos.y + 0.5 + idx * 0.2, oldPos.z,
                        0.4 + idx * 0.15, '#fbbf24', 16 + idx * 4, 0.6);
                };
            }(s), s * 120);
        }

        // big burst in character color
        _burst3D(oldPos.x, oldPos.y + 0.5, oldPos.z, 25 + newStar * 5, charCol, 4.0, 0.7);
        // golden burst
        _burst3D(oldPos.x, oldPos.y + 0.6, oldPos.z, 15 + newStar * 3, '#fbbf24', 3.5, 0.6);
        // white sparkle ring
        _ring3D(oldPos.x, oldPos.y + 0.3, oldPos.z, 0.6, '#ffffff', 20, 0.5);

        // rising star particles
        for (var r = 0; r < newStar * 3; r++) {
            _spawn3D(
                new THREE.Vector3(
                    oldPos.x + (Math.random() - 0.5) * 0.5,
                    oldPos.y + 0.2,
                    oldPos.z + (Math.random() - 0.5) * 0.5
                ),
                { x: (Math.random() - 0.5) * 1.5, y: 3 + Math.random() * 2, z: (Math.random() - 0.5) * 1.5 },
                '#fbbf24', 0.6 + Math.random() * 0.5, 0.8 + Math.random() * 0.4
            );
        }
    }

    // screen shake proportional to star level
    if (typeof triggerScreenShake === 'function') {
        triggerScreenShake(1 + newStar * 0.8, 0.2 + newStar * 0.05);
    }

    // screen flash gold
    if (typeof triggerScreenFlash === 'function') {
        triggerScreenFlash('#fbbf24', 0.15 + newStar * 0.03);
    }

    // ── Destroy old model ──
    removeUnitModel3D(unit.id);

    // ── Create new model with upgraded visuals ──
    spawnUnitModel3D(unit);

    // ── Restore position and rotation ──
    var newEntry = threeUnitModels[unit.id];
    if (newEntry) {
        newEntry.group.position.copy(oldPos);
        newEntry.group.quaternion.copy(oldQuat);
        newEntry.targetPos.copy(oldPos);

        // ── Spawn-in scale animation: start small, grow to full size ──
        newEntry.group.scale.setScalar(0.3);
        newEntry._mergeGrow = 1.0; // will grow over ~0.5s
    }
}

// ---- Character-specific idle animations ----

function _animateIdle(group, charId, t, dt, unit) {
    // NOTE: NEVER modify group.position/rotation/scale here — those belong
    // to the movement & facing system. Only animate CHILD meshes.

    switch (charId) {

        // ═══ BABIDI — Fat merchant waddle ═══
        case 'Babidi': {
            var bWaddle = Math.sin(t * 2.2);

            // Body: waddle sway + belly bounce + jiggle
            var bBody = _getCached(group, 'body');
            if (bBody) {
                bBody.position.y = 0.38 + Math.abs(Math.sin(t * 2.2)) * 0.04;
                bBody.position.x = bWaddle * 0.03;
                bBody.rotation.z = bWaddle * 0.08;
                bBody.rotation.x = Math.sin(t * 1.5) * 0.06;
                var bJiggle = 1.0 + Math.abs(Math.cos(t * 2.2)) * 0.04;
                bBody.scale.set(bJiggle * 1.15, 0.9, 1.0 + Math.sin(t * 4.4) * 0.02);
            }

            // Head: suspicious scanning + nods
            var bHead = _getCached(group, 'head');
            if (bHead) {
                bHead.rotation.y = Math.sin(t * 0.7) * 0.4;
                bHead.rotation.x = -0.05 + Math.sin(t * 1.8) * 0.1;
                bHead.position.y = 0.78 + Math.abs(Math.sin(t * 2.2)) * 0.02;
            }

            // Arms: counter-balance waddle
            var bArmR = _getCached(group, 'armR');
            if (bArmR) { bArmR.rotation.z = -0.4 + bWaddle * 0.25; bArmR.rotation.x = Math.sin(t * 2.2) * 0.35; }
            var bArmL = _getCached(group, 'armL');
            if (bArmL) { bArmL.rotation.z = 0.4 - bWaddle * 0.25; bArmL.rotation.x = -Math.sin(t * 2.2) * 0.35; }

            // Coins: orbit + spin
            for (var bi = 0; bi < 3; bi++) {
                var coin = _getCached(group, 'coin_' + bi);
                if (coin) {
                    var bca = t * 2.0 + bi * 2.09;
                    var bcr = 0.5 + Math.sin(t * 0.6 + bi) * 0.08;
                    coin.position.set(Math.cos(bca)*bcr, 0.5+Math.sin(bca*1.4)*0.12, Math.sin(bca)*bcr);
                    coin.rotation.x = t * 3 + bi; coin.rotation.y = t * 2;
                }
            }

            // Ruby: heartbeat
            var ruby = _getCached(group, 'ruby');
            if (ruby && ruby.material) {
                ruby.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 3)) * 0.5;
                ruby.scale.setScalar(1.0 + Math.sin(t * 3) * 0.15);
            }
            break;
        }

        // ═══ CARONTE — Hovering professor ═══
        case 'Caronte': {
            // Body: levitation bob + robe sway (on the mesh, not group)
            var cBody = _getCached(group, 'body');
            if (cBody) {
                cBody.position.y = 0.32 + Math.sin(t * 1.2) * 0.05;
                cBody.rotation.x = Math.sin(t * 0.8) * 0.1;
                cBody.rotation.z = Math.sin(t * 0.6) * 0.05;
            }

            // Head: reading nod + look around
            var cHead = _getCached(group, 'head');
            if (cHead) {
                cHead.position.y = 0.82 + Math.sin(t * 1.2) * 0.04;
                cHead.rotation.x = -0.15 + Math.sin(t * 1.0) * 0.2;
                cHead.rotation.y = Math.sin(t * 0.4) * 0.3;
            }

            // Arms: right gesticulates, left steady
            var cArmR = _getCached(group, 'armR');
            if (cArmR) { cArmR.rotation.z = -0.5 + Math.sin(t * 0.9) * 0.45; cArmR.rotation.x = -0.3 + Math.sin(t * 0.7) * 0.6; }
            var cArmL = _getCached(group, 'armL');
            if (cArmL) { cArmL.rotation.z = 0.5 + Math.sin(t * 0.5) * 0.15; cArmL.rotation.x = -0.2 + Math.sin(t * 0.8) * 0.15; }

            // Hands
            var cHandR = _getCached(group, 'handR');
            if (cHandR) { cHandR.position.y = 0.32 + Math.sin(t * 0.9) * 0.1; cHandR.position.x = 0.35 + Math.sin(t * 0.7) * 0.08; }
            var cHandL = _getCached(group, 'handL');
            if (cHandL) cHandL.position.y = 0.32 + Math.sin(t * 0.5) * 0.04;

            // Tassel: pendulum
            var tassel = _getCached(group, 'tassel');
            if (tassel) { tassel.rotation.z = 0.3 + Math.sin(t * 1.8) * 0.4; tassel.rotation.x = Math.sin(t * 1.2) * 0.15; }

            // Book: orbits + page flip
            var book = _getCached(group, 'book');
            if (book) {
                var bAng = t * 0.5;
                book.position.set(-0.35 + Math.cos(bAng)*0.15, 0.55 + Math.sin(t*1.5)*0.06, Math.sin(bAng)*0.2);
                book.rotation.y = bAng + 0.5; book.rotation.x = Math.sin(t * 0.6) * 0.12;
                book.scale.z = 1.0 + Math.abs(Math.sin(t * 2)) * 0.3;
            }

            // Arcane orbs
            for (var ci = 0; ci < 2; ci++) {
                var rune = _getCached(group, 'rune_' + ci);
                if (rune) {
                    var cra = t * 1.0 + ci * Math.PI;
                    var crr = 0.5 + Math.sin(t * 0.8 + ci * 2) * 0.1;
                    rune.position.set(Math.cos(cra)*crr, 0.55+Math.sin(cra*1.5)*0.2+ci*0.15, Math.sin(cra)*crr);
                    rune.scale.setScalar(1.0 + Math.sin(t * 4 + ci * 3) * 0.3);
                }
            }
            break;
        }

        // ═══ VALERIO — Worm undulation ═══
        case 'Valerio': {
            var vWave = t * 2.5;
            for (var vs = 0; vs < 4; vs++) {
                var seg = _getCached(group, 'seg_' + vs);
                if (seg) {
                    var vPh = vWave + vs * 1.0;
                    seg.position.x = Math.sin(vPh) * 0.04;
                    seg.position.z = Math.cos(vPh * 0.8) * 0.03;
                    var vBY = 0.12 + vs * 0.18 * 0.85;
                    seg.position.y = vBY + Math.sin(t * 1.5 + vs * 0.5) * 0.025 * (4 - vs) / 4;
                    var vBS = 1.0 + Math.sin(t * 1.5) * 0.06 * (1.0 - vs * 0.2);
                    seg.scale.x = vBS; seg.scale.z = vBS;
                    seg.rotation.y = Math.sin(vPh * 0.7) * 0.08;
                }
            }
            var vFlare = Math.max(0, Math.sin(t * 0.4));
            for (var vsp = 0; vsp < 5; vsp++) {
                var spine = _getCached(group, 'spine_' + vsp);
                if (spine) {
                    spine.scale.y = 1.0 + Math.sin(t*3+vsp*1.1)*0.25 + vFlare*vFlare*0.5;
                    spine.rotation.x = Math.sin(t*2+vsp*0.8)*0.2;
                    spine.rotation.z = Math.sin(t*1.5+vsp*1.2)*0.1;
                }
            }
            var vEyeL = _getCached(group, 'eyeL');
            var vEyeR = _getCached(group, 'eyeR');
            var vBlinkT = (t * 0.35) % 1.0;
            var vBl = (vBlinkT > 0.92 && vBlinkT < 0.97) ? 0.05 : 1.0;
            var vLk = Math.sin(t * 0.3) * 0.03;
            if (vEyeL) { vEyeL.scale.y = vBl; vEyeL.position.x = -0.12 + vLk; }
            if (vEyeR) { vEyeR.scale.y = vBl; vEyeR.position.x = 0.12 + vLk; }
            break;
        }

        // ═══ YUJIN — Warrior bounce & swing ═══
        case 'Yujin': {
            var yFuria = unit && unit.furiaActive;
            var ySpd = yFuria ? 2.5 : 1.0;
            var yBounce = Math.sin(t * 2.0 * ySpd);
            var yShift = Math.sin(t * 1.0 * ySpd);

            // Body: bounce + weight shift + breathing (ALL on body mesh, not group)
            var yBody = _getCached(group, 'body');
            if (yBody) {
                yBody.position.y = 0.5 + Math.abs(yBounce) * 0.04;
                yBody.position.x = yShift * 0.03;
                yBody.rotation.z = -yShift * 0.05;
                var yBr = Math.sin(t * 2.0 * ySpd);
                yBody.scale.x = 1.0 + yBr * 0.05;
                yBody.scale.z = 1.0 + yBr * 0.035;
                yBody.scale.y = 1.0 - yBr * 0.02;
                yBody.rotation.x = yFuria ? 0.12 : Math.sin(t * 1.2) * 0.04;
            }

            // Legs: alternating knee bend
            var yLegL = _getCached(group, 'legL');
            var yLegR = _getCached(group, 'legR');
            if (yLegL && yLegR) {
                yLegL.position.y = 0.15 + Math.max(0, yShift) * 0.03;
                yLegR.position.y = 0.15 + Math.max(0, -yShift) * 0.03;
                yLegL.rotation.x = yShift * 0.15;
                yLegR.rotation.x = -yShift * 0.15;
                yLegL.position.x = -0.12 - Math.max(0, yShift) * 0.02;
                yLegR.position.x = 0.12 + Math.max(0, -yShift) * 0.02;
            }

            // Arms
            var yArmL = _getCached(group, 'armL');
            if (yArmL) { yArmL.rotation.z = 0.25 + yShift * 0.2; yArmL.rotation.x = -yShift * 0.3; }
            var yArmR = _getCached(group, 'armR');
            if (yArmR) { yArmR.rotation.z = -0.25 - yShift * 0.15; yArmR.rotation.x = Math.sin(t * 1.5 * ySpd) * 0.25; }

            // Axe: practice swings
            var axe = _getCached(group, 'axe');
            if (axe) {
                var ySwS = yFuria ? 5.0 : 1.5;
                var ySwA = yFuria ? 0.5 : 0.25;
                axe.rotation.z = -0.2 + Math.sin(t * ySwS) * ySwA;
                axe.rotation.x = Math.sin(t * ySwS * 0.8) * (yFuria ? 0.2 : 0.1);
                axe.position.y = 0.55 + Math.sin(t * ySwS) * 0.04;
            }

            // Head: scanning
            var yHead = _getCached(group, 'head');
            if (yHead) {
                yHead.rotation.y = Math.sin(t * 0.6 * ySpd) * 0.35;
                yHead.rotation.x = yFuria ? -0.15 : Math.sin(t * 1.5) * 0.04;
                yHead.position.y = 0.82 + Math.abs(yBounce) * 0.02;
            }

            // Cape
            var cape = _getCached(group, 'cape');
            if (cape) {
                cape.rotation.x = 0.15 + Math.abs(yBounce) * 0.1 + Math.sin(t * 2 * ySpd) * 0.08;
                cape.rotation.y = yShift * 0.1;
            }

            // Furia: only tiny oscillating shake (averages to zero)
            if (yFuria) {
                group.position.x += Math.sin(t * 22) * 0.005;
                group.position.z += Math.cos(t * 19) * 0.003;
            }
            break;
        }

        // ═══ WMS — Cosmic entity ═══
        case 'WMS': {
            // Core: heartbeat pulse (on mesh, not group)
            var wCore = _getCached(group, 'core');
            if (wCore) {
                var wHeart = Math.pow(Math.abs(Math.sin(t * 2.0)), 0.5);
                wCore.scale.setScalar(1.0 + wHeart * 0.15);
                wCore.position.y = 0.55 + Math.sin(t * 1.2) * 0.05;
                if (wCore.material) wCore.material.emissiveIntensity = 0.4 + wHeart * 0.5;
            }

            // Aura: breathes + rotates (on mesh)
            var wAura = _getCached(group, 'aura');
            if (wAura) {
                var wAB = 1.0 + Math.sin(t * 1.5) * 0.12;
                wAura.scale.set(wAB, wAB, wAB);
                wAura.material.opacity = 0.03 + Math.abs(Math.sin(t * 2.0)) * 0.04;
                wAura.rotation.y = t * 0.2;
                wAura.rotation.x = t * 0.12;
                wAura.position.y = 0.55 + Math.sin(t * 1.2) * 0.05;
            }

            // Wisps: figure-8 orbits
            for (var ww = 0; ww < 3; ww++) {
                var wisp = _getCached(group, 'wisp_' + ww);
                if (wisp) {
                    var wwa = t * (1.3 + ww * 0.2) + ww * (Math.PI * 2 / 3);
                    var wwr = 0.35 + Math.sin(t * 0.8 + ww * 2) * 0.1;
                    wisp.position.set(
                        Math.cos(wwa)*wwr + Math.sin(wwa*2)*0.08,
                        0.55 + Math.sin(t*1.2)*0.05 + Math.sin(wwa*1.5)*0.15,
                        Math.sin(wwa)*wwr + Math.cos(wwa*2)*0.08
                    );
                    wisp.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3 + ww * 2)) * 0.5);
                }
            }

            // Sparks: drift
            var wSparks = _getCached(group, 'sparks');
            if (wSparks && wSparks.geometry) {
                var wsp = wSparks.geometry.attributes.position;
                for (var wsi = 0; wsi < wsp.count; wsi++) {
                    wsp.setY(wsi, wsp.getY(wsi) + dt * 0.2);
                    wsp.setX(wsi, wsp.getX(wsi) + Math.sin(t * 3 + wsi) * dt * 0.12);
                    if (wsp.getY(wsi) > 1.2) wsp.setXYZ(wsi, (Math.random()-0.5)*0.8, 0.1, (Math.random()-0.5)*0.8);
                }
                wsp.needsUpdate = true;
            }
            break;
        }

        default: {
            var dBody = _getCached(group, 'body');
            if (dBody) { var dp = 1.0 + Math.sin(t * 1.8) * 0.03; dBody.scale.set(dp, dp, dp); }
            break;
        }
    }
}

// ---- Team indicator animations ----
function _animateTeamIndicators(group, t) {
    // base ring pulsation (emissive intensity)
    var ring = _getCached(group, 'teamRing');
    if (ring && ring.material) {
        ring.material.emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 2.5);
    }

    // ground glow pulsation
    var glow = _getCached(group, 'teamGlow');
    if (glow && glow.material) {
        glow.material.opacity = 0.05 + 0.04 * Math.sin(t * 2.0);
        // subtle scale pulse
        var gs = 1.0 + 0.05 * Math.sin(t * 2.0);
        glow.scale.set(gs, gs, 1);
    }

    // banner flag waving
    var flag = _getCached(group, 'bannerFlag');
    if (flag) {
        flag.rotation.y = Math.sin(t * 3.0) * 0.15;
        flag.rotation.z = Math.sin(t * 2.2) * 0.05;
    }

    // disc subtle rotation
    var disc = _getCached(group, 'teamDisc');
    if (disc) {
        disc.rotation.z = t * 0.3;
    }
}

// ====================================================================
//  ATTACK ANIMATION — character-specific arm/weapon swing
//  atkAnim goes from 1.0 → 0. Progress = 1 - atkAnim (0 → 1)
// ====================================================================
function _animateAttack(g, unit, dt) {
    var p = 1.0 - unit.atkAnim; // 0=start, 1=end
    // Lunge — riusa _tmpVec3, evita new THREE.Vector3 ogni frame
    _tmpVec3.set(0, 0, 1).applyQuaternion(g.quaternion);
    var lungeStr = p < 0.5 ? p * 2 : (1 - p) * 2; // peak at 0.5
    g.position.addScaledVector(_tmpVec3, lungeStr * 0.18);

    switch (unit.charId) {
        case 'Babidi': {
            // right arm throws forward (casting poison)
            var armR = _getCached(g, 'armR');
            var armL = _getCached(g, 'armL');
            if (armR) {
                armR.rotation.x = p < 0.4 ? -p * 3.5 : -(1 - p) * 2.3;  // wind up then throw
                armR.rotation.z = -0.4 - lungeStr * 0.3;
            }
            if (armL) armL.rotation.x = lungeStr * -0.5; // slight follow
            // body lean
            var body = _getCached(g, 'body');
            if (body) body.rotation.x = lungeStr * 0.15;
            break;
        }
        case 'Caronte': {
            // staff/book casting motion — body raises, book glows
            var body2 = _getCached(g, 'body');
            if (body2) body2.position.y = 0.32 + lungeStr * 0.12;
            var head = _getCached(g, 'head');
            if (head) head.rotation.x = -lungeStr * 0.2;
            var book = _getCached(g, 'book');
            if (book) {
                book.position.z = lungeStr * 0.4;
                book.position.y = 0.55 + lungeStr * 0.15;
                book.scale.setScalar(1.0 + lungeStr * 0.3);
            }
            break;
        }
        case 'Valerio': {
            // segments compress then extend (lunging bite)
            for (var s = 0; s < 4; s++) {
                var seg = _getCached(g, 'seg_' + s);
                if (seg) {
                    var squeeze = p < 0.3 ? p / 0.3 : 0;
                    var extend = p > 0.3 && p < 0.6 ? (p - 0.3) / 0.3 : 0;
                    seg.scale.y = 1.0 - squeeze * 0.3 + extend * 0.15;
                    seg.position.z = extend * 0.1 * (s + 1);
                }
            }
            // spines flare out
            for (var sp = 0; sp < 5; sp++) {
                var spine = _getCached(g, 'spine_' + sp);
                if (spine) spine.scale.y = 1.0 + lungeStr * 0.5;
            }
            break;
        }
        case 'Yujin': {
            // !! HEAVY AXE SWING — most dramatic !!
            var axe = _getCached(g, 'axe');
            var armR2 = _getCached(g, 'armR');
            var armL2 = _getCached(g, 'armL');
            var isFuria = unit.furiaActive;
            var swingPower = isFuria ? 1.4 : 1.0;

            if (axe) {
                // wind-up (raise axe high) then slam down
                if (p < 0.35) {
                    axe.rotation.z = -0.2 - (p / 0.35) * 1.8 * swingPower;
                    axe.rotation.x = -(p / 0.35) * 0.5;
                } else {
                    var strikeP = (p - 0.35) / 0.65;
                    axe.rotation.z = -2.0 * swingPower + strikeP * (2.0 * swingPower + 0.8);
                    axe.rotation.x = -0.5 + strikeP * 1.0;
                }
            }
            // right arm follows axe
            if (armR2) {
                armR2.rotation.x = p < 0.35 ? -(p / 0.35) * 1.2 : -1.2 + ((p - 0.35) / 0.65) * 1.6;
                armR2.rotation.z = -0.25 - lungeStr * 0.3;
            }
            // left arm brace
            if (armL2) {
                armL2.rotation.x = lungeStr * -0.4;
                armL2.rotation.z = 0.25 + lungeStr * 0.2;
            }
            // body lean into swing
            var torso = _getCached(g, 'body');
            if (torso) {
                torso.rotation.x = lungeStr * 0.2;
                torso.rotation.y = p < 0.35 ? (p / 0.35) * 0.15 : 0.15 - ((p - 0.35) / 0.65) * 0.3;
            }
            break;
        }
        case 'WMS': {
            // core brightens + wisps converge forward
            var core = _getCached(g, 'core');
            if (core) {
                core.scale.setScalar(1.0 + lungeStr * 0.35);
                if (core.material) core.material.emissiveIntensity = 0.6 + lungeStr * 0.8;
            }
            var aura = _getCached(g, 'aura');
            if (aura) aura.scale.setScalar(1.0 + lungeStr * 0.2);
            // wisps shoot forward
            for (var w = 0; w < 3; w++) {
                var wisp = _getCached(g, 'wisp_' + w);
                if (wisp) wisp.position.z = 0.38 * (1 - lungeStr) + lungeStr * 0.7;
            }
            break;
        }
        default: {
            // generic attack for creeps
            var bBody = _getCached(g, 'body');
            if (bBody) bBody.scale.setScalar(1.0 + lungeStr * 0.15);
            break;
        }
    }
}

// ====================================================================
//  HIT ANIMATION — flash white + knockback
// ====================================================================
function _animateHit(g, unit, dt) {
    var intensity = unit.hitAnim; // 1.0 → 0
    var t = typeof renderTime !== 'undefined' ? renderTime : 0;

    // ── Color flash: red burst at impact, fades to white ──
    var r = 1.0;
    var grn = intensity > 0.65 ? 0.05 : (1.0 - intensity) * 0.85;
    var b   = intensity > 0.65 ? 0.05 : (1.0 - intensity) * 0.75;
    var emI = intensity > 0.65 ? 1.6 : intensity * 1.2;
    // Use cached mesh list (populated on first hit) — avoids g.traverse() every frame
    var entry = typeof threeUnitModels !== 'undefined' ? threeUnitModels[unit.id] : null;
    var meshList = entry && entry._emissiveMeshes ? entry._emissiveMeshes : null;
    if (meshList) {
        for (var mi = 0; mi < meshList.length; mi++) {
            var m = meshList[mi];
            if (m.material && m.material.emissive) {
                m.material.emissive.setRGB(r, grn, b);
                m.material.emissiveIntensity = emI;
            }
        }
    } else {
        // Fallback for non-cached (procedural units)
        g.traverse(function(child) {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissive.setRGB(r, grn, b);
                child.material.emissiveIntensity = emI;
            }
        });
    }

    // ── Rapid vibration — high-freq shake proportional to intensity ──
    var shakeAmp = intensity * 0.058;
    g.position.x += Math.sin(t * 58)        * shakeAmp;
    g.position.z += Math.cos(t * 51)        * shakeAmp * 0.8;
    g.position.y += Math.abs(Math.sin(t * 44)) * shakeAmp * 0.30;

    // ── Knockback push — riusa _tmpVec3 ──
    if (intensity > 0.55) {
        var push = (intensity - 0.55) * 0.10;
        _tmpVec3.set(0, 0, -1).applyQuaternion(g.quaternion);
        g.position.addScaledVector(_tmpVec3, push);
    }

    // ── Body recoil tilt (procedural parts) ──
    var body = _getCached(g, 'body') || _getCached(g, 'seg_0');
    if (body) body.rotation.x = -intensity * 0.30;
}

// entry opzionale: se passato usa la lista cached invece di traverse
function _restoreEmissives(g, entry) {
    var list = entry ? entry._emissiveMeshes : null;
    if (list) {
        for (var ri = 0; ri < list.length; ri++) {
            var child = list[ri];
            if (child.material && child.material.emissive) {
                if (child.material._origEmissive === undefined) {
                    child.material._origEmissive = child.material.emissive.getHex();
                    child.material._origEmissiveI = child.material.emissiveIntensity;
                }
                child.material.emissive.setHex(child.material._origEmissive);
                child.material.emissiveIntensity = child.material._origEmissiveI;
            }
        }
        return;
    }
    // fallback: traverse (usato solo se cache non ancora disponibile)
    g.traverse(function(child) {
        if (child.isMesh && child.material && child.material.emissive) {
            if (child.material._origEmissive === undefined) {
                child.material._origEmissive = child.material.emissive.getHex();
                child.material._origEmissiveI = child.material.emissiveIntensity;
            }
            child.material.emissive.setHex(child.material._origEmissive);
            child.material.emissiveIntensity = child.material._origEmissiveI;
        }
    });
}

// ====================================================================
//  HOVER ANIMATION — glow + vibration when cursor is over a unit
// ====================================================================
function _animateHover(g, entry, isHovered, t, dt) {
    // smoothly ramp hover intensity (0→1 on enter, 1→0 on leave)
    if (entry._hoverIntensity === undefined) entry._hoverIntensity = 0;
    var target = isHovered ? 1 : 0;
    entry._hoverIntensity += (target - entry._hoverIntensity) * Math.min(1, dt * 10);
    if (entry._hoverIntensity < 0.01 && !isHovered) {
        if (entry._hoverIntensity > 0 || entry._hoverWasActive) {
            // fully restore emissives + scale when hover fades out
            _restoreEmissives(g, entry);
            var baseScale = (typeof STAR_SCALE !== 'undefined' && entry.star)
                ? (STAR_SCALE[Math.min(entry.star, 5)] || 1.0) : 1.0;
            g.scale.setScalar(baseScale);
            entry._hoverWasActive = false;
        }
        entry._hoverIntensity = 0;
        // restore any hover offset
        if (entry._hoverOffsetX) {
            g.position.x -= entry._hoverOffsetX;
            entry._hoverOffsetX = 0;
        }
        if (entry._hoverOffsetZ) {
            g.position.z -= entry._hoverOffsetZ;
            entry._hoverOffsetZ = 0;
        }
        return;
    }
    entry._hoverWasActive = true;

    var hi = entry._hoverIntensity;

    // ── Emissive glow: bright white-ish rim light — usa lista cached ──
    var glowIntensity = hi * 0.6;
    var _hoverMeshes = _ensureEmissiveCache(g, entry);
    for (var _hi = 0; _hi < _hoverMeshes.length; _hi++) {
        var _hm = _hoverMeshes[_hi];
        if (!_hm.material || !_hm.material.emissive) continue;
        if (_hm.material._origEmissive === undefined) {
            _hm.material._origEmissive = _hm.material.emissive.getHex();
            _hm.material._origEmissiveI = _hm.material.emissiveIntensity;
        }
        var origI = _hm.material._origEmissiveI || 0;
        _hm.material.emissiveIntensity = origI + glowIntensity;
        if (hi > 0.3) {
            var origHex = _hm.material._origEmissive || 0;
            var r1 = (origHex >> 16) & 0xff;
            var g1 = (origHex >> 8) & 0xff;
            var b1 = origHex & 0xff;
            var blend = hi * 0.35;
            var r = Math.min(255, Math.round(r1 + (255 - r1) * blend));
            var gg = Math.min(255, Math.round(g1 + (255 - g1) * blend));
            var b = Math.min(255, Math.round(b1 + (255 - b1) * blend));
            _hm.material.emissive.setHex((r << 16) | (gg << 8) | b);
        }
    }

    // ── Vibration: rapid small displacement ──
    var vibFreq = 30; // Hz — fast shake
    var vibAmp = 0.012 * hi; // small amplitude
    // remove previous offset
    if (entry._hoverOffsetX) g.position.x -= entry._hoverOffsetX;
    if (entry._hoverOffsetZ) g.position.z -= entry._hoverOffsetZ;
    // apply new
    entry._hoverOffsetX = Math.sin(t * vibFreq) * vibAmp;
    entry._hoverOffsetZ = Math.cos(t * vibFreq * 1.3) * vibAmp * 0.7;
    g.position.x += entry._hoverOffsetX;
    g.position.z += entry._hoverOffsetZ;

    // ── Subtle scale pulse ──
    var baseScale = (typeof STAR_SCALE !== 'undefined' && entry.star)
        ? (STAR_SCALE[Math.min(entry.star, 5)] || 1.0) : 1.0;
    var pulse = 1.0 + Math.sin(t * 6) * 0.025 * hi;
    g.scale.setScalar(baseScale * pulse);
}

// ====================================================================
//  DODGE ANIMATION — quick side-step with body lean
// ====================================================================
function _animateDodge(g, unit, dt) {
    unit._dodgeAnim -= dt * 4; // lasts ~0.25s
    if (unit._dodgeAnim <= 0) { unit._dodgeAnim = 0; return; }

    var p = unit._dodgeAnim; // 1 → 0
    var sideDir = (unit.id % 2 === 0) ? 1 : -1; // alternate dodge direction

    // lateral step — riusa _tmpVec3
    _tmpVec3.set(sideDir, 0, 0).applyQuaternion(g.quaternion);
    var strength = Math.sin(p * Math.PI) * 0.35;
    g.position.addScaledVector(_tmpVec3, strength * dt * 8);

    // body lean away
    var body = _getCached(g, 'body') || _getCached(g, 'seg_0') || _getCached(g, 'core');
    if (body) {
        body.rotation.z = sideDir * Math.sin(p * Math.PI) * 0.3;
    }

    // head duck
    var head = _getCached(g, 'head');
    if (head) {
        head.position.y -= Math.sin(p * Math.PI) * 0.06;
    }
}

// ====================================================================
//  CRIT IMPACT — devastating visual feedback on the victim
// ====================================================================
function _animateCritImpact(g, unit, dt) {
    unit._critFlash -= dt * 3; // lasts ~0.33s
    if (unit._critFlash <= 0) { unit._critFlash = 0; return; }

    var p = unit._critFlash;
    var _critEntry = typeof threeUnitModels !== 'undefined' ? threeUnitModels[unit.id] : null;

    // golden flash — usa lista cached se disponibile
    var _critMeshes = _critEntry ? _ensureEmissiveCache(g, _critEntry) : null;
    if (_critMeshes) {
        for (var _ci = 0; _ci < _critMeshes.length; _ci++) {
            if (_critMeshes[_ci].material && _critMeshes[_ci].material.emissive) {
                _critMeshes[_ci].material.emissive.setHex(0xfbbf24);
                _critMeshes[_ci].material.emissiveIntensity = p * 1.2;
            }
        }
    } else {
        g.traverse(function(child) {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissive.setHex(0xfbbf24);
                child.material.emissiveIntensity = p * 1.2;
            }
        });
    }

    // violent shake
    g.position.x += (Math.random() - 0.5) * p * 0.08;
    g.position.z += (Math.random() - 0.5) * p * 0.08;

    // scale squash on impact
    if (p > 0.7) {
        g.scale.y = 0.8;
        g.scale.x = 1.15;
        g.scale.z = 1.15;
    } else {
        // bounce back
        g.scale.y = 1.0 + (1 - p) * 0.05;
        g.scale.x = 1.0;
        g.scale.z = 1.0;
    }
}

// ====================================================================
//  KO / DEATH — spectacular multi-phase death animation
// ====================================================================
function _animateKO(g, unit, dt, entry) {
    // Initialize KO state
    if (!unit._koPhase) {
        unit._koPhase = 1;
        unit._koTimer = 0;
        unit._koFlashCount = 0;
        // spawn death VFX
        var wp = g.position;
        if (typeof _burst3D === 'function') {
            var charCol = CHAR_COLORS[unit.charId] ? CHAR_COLORS[unit.charId].fill : '#888';
            _burst3D(wp.x, wp.y + 0.4, wp.z, 30, charCol, 4.5, 0.7);
            _ring3D(wp.x, wp.y + 0.1, wp.z, 0.6, charCol, 20, 0.6);
        }
        if (typeof triggerScreenShake === 'function') triggerScreenShake(2.5, 0.2);
    }

    unit._koTimer += dt;

    // Phase 1 (0-0.3s): Stagger — lean back, flash red/white
    if (unit._koPhase === 1) {
        // flash between normal and red — usa lista cached
        unit._koFlashCount += dt * 15;
        var flashOn = Math.sin(unit._koFlashCount * Math.PI) > 0;
        var _koEm = _ensureEmissiveCache(g, entry);
        for (var _koi = 0; _koi < _koEm.length; _koi++) {
            if (_koEm[_koi].material && _koEm[_koi].material.emissive) {
                _koEm[_koi].material.emissive.setHex(flashOn ? 0xef4444 : 0x000000);
                _koEm[_koi].material.emissiveIntensity = flashOn ? 1.0 : 0;
            }
        }

        // stagger backward — riusa _tmpVec3
        _tmpVec3.set(0, 0, -1).applyQuaternion(g.quaternion);
        g.position.addScaledVector(_tmpVec3, dt * 0.5);

        // lean back
        g.rotation.x = -unit._koTimer * 0.8;

        if (unit._koTimer > 0.35) { unit._koPhase = 2; unit._koTimer = 0; }
    }

    // Phase 2 (0.3-0.7s): Fall to ground
    else if (unit._koPhase === 2) {
        var fallProgress = Math.min(unit._koTimer / 0.4, 1.0);

        // rotate to fall (tip over forward or backward)
        g.rotation.x = -0.28 + fallProgress * (-Math.PI / 2 + 0.28);

        // drop Y position
        g.position.y = Math.max(0, UNIT_BASE_Y * (1 - fallProgress * 0.8));

        // slight bounce at impact
        if (fallProgress > 0.9 && !unit._koBounced) {
            unit._koBounced = true;
            if (typeof triggerScreenShake === 'function') triggerScreenShake(1.5, 0.1);
            // ground impact particles
            if (typeof _burst3D === 'function') {
                _burst3D(g.position.x, 0.05, g.position.z, 15, '#94a3b8', 2.0, 0.4);
            }
        }

        if (unit._koTimer > 0.4) { unit._koPhase = 3; unit._koTimer = 0; }
    }

    // Phase 3 (0.7-1.2s): Dissolve — shrink, particles burst, fade
    else if (unit._koPhase === 3) {
        var dissolveP = Math.min(unit._koTimer / 0.5, 1.0);

        // shrink all axes
        var s = Math.max(0, 1.0 - dissolveP);
        g.scale.set(s, s, s);

        // fade materials — usa lista cached di tutti i mesh
        _ensureEmissiveCache(g, entry);
        var _koAll = entry._allMeshes || [];
        for (var _kai = 0; _kai < _koAll.length; _kai++) {
            if (_koAll[_kai].material) {
                _koAll[_kai].material.transparent = true;
                _koAll[_kai].material.opacity = Math.max(0, 1.0 - dissolveP);
            }
        }

        // continuous dissolve particles
        if (dissolveP < 0.8 && Math.random() < 0.4) {
            var col = CHAR_COLORS[unit.charId] ? CHAR_COLORS[unit.charId].fill : '#888';
            if (typeof _spawn3D === 'function') {
                _spawn3D(
                    new THREE.Vector3(
                        g.position.x + (Math.random() - 0.5) * 0.3,
                        g.position.y + Math.random() * 0.3,
                        g.position.z + (Math.random() - 0.5) * 0.3
                    ),
                    { x: (Math.random() - 0.5) * 1.5, y: 1.5 + Math.random() * 2, z: (Math.random() - 0.5) * 1.5 },
                    col, 0.5 + Math.random() * 0.5, 0.6
                );
            }
        }

        // final disappear
        if (dissolveP >= 1.0) {
            g.visible = false;
        }
    }
}

// ====================================================================
//  addDamageNumber OVERRIDE — detect dodge/miss/crit for animations
// ====================================================================
var _origAddDamageNumber = typeof addDamageNumber === 'function' ? addDamageNumber : null;

addDamageNumber = function(unit, amount, type) {
    // Set animation flags on the unit for 3D animations
    if (type === 'dodge') {
        unit._dodgeAnim = 1.0;
    }
    if (type === 'miss') {
        // The unit that "received" the miss should do a slight dodge too
        unit._dodgeAnim = 0.6; // shorter dodge for miss
    }
    if (type === 'crit') {
        unit._critFlash = 1.0;
        // extra screen shake for crits
        if (typeof triggerScreenShake === 'function') triggerScreenShake(3, 0.15);
        // crit burst particles
        if (typeof _burst3D === 'function' && typeof cellToWorld === 'function') {
            var wp = cellToWorld(unit.row, unit.col);
            _burst3D(wp.x, wp.y + 0.5, wp.z, 20, '#fbbf24', 5.0, 0.5);
            _ring3D(wp.x, wp.y + 0.2, wp.z, 0.5, '#ffffff', 12, 0.3);
        }
    }

    // Call original
    if (_origAddDamageNumber) _origAddDamageNumber(unit, amount, type);
}

// ====================================================================
//  SKILL CAST ANIMATION — triggered when a unit uses a skill
// ====================================================================

// Called from three-skill-vfx.js (or directly) to start a cast animation
function triggerSkillCastAnimation(unitId, skillId) {
    var entry = threeUnitModels[unitId];
    if (!entry) return;
    entry._skillCast = { skillId: skillId, elapsed: 0, duration: 0.5 };
}

// Per-frame cast animation — replaces idle for the cast duration
// p goes 0→1 over duration; windup is p<0.5, release is p≥0.5
// entry: passato per usare lista emissive cached invece di traverse
function _animateSkillCast(group, charId, castData, dt, entry) {
    var p = Math.min(castData.elapsed / castData.duration, 1.0);
    var isWindup = p < 0.5;
    var phase = isWindup ? (p / 0.5) : ((p - 0.5) / 0.5); // 0→1 within each half

    switch (charId) {

        case 'Babidi': {
            var body = _getCached(group, 'body');
            var armL = _getCached(group, 'armL');
            var armR = _getCached(group, 'armR');
            var lift = isWindup ? phase * 0.14 : (1 - phase) * 0.14;
            if (body) body.position.y = 0.38 + lift;
            if (armL) armL.rotation.z = 0.4 + (isWindup ? phase * 0.9 : (1 - phase) * 0.9);
            if (armR) armR.rotation.z = -0.4 - (isWindup ? phase * 0.9 : (1 - phase) * 0.9);
            // coins speed up during cast
            for (var i = 0; i < 3; i++) {
                var coin = _getCached(group, 'coin_' + i);
                if (coin) {
                    var ca = castData.elapsed * 5 + i * 2.09;
                    var cr = 0.55 + (isWindup ? phase * 0.25 : (1 - phase) * 0.25);
                    coin.position.set(Math.cos(ca) * cr, 0.45 + Math.sin(ca * 0.7) * 0.15, Math.sin(ca) * cr);
                }
            }
            break;
        }

        case 'Caronte': {
            var book = _getCached(group, 'book');
            var tassel = _getCached(group, 'tassel');
            var bookRise = isWindup ? phase * 0.32 : (1 - phase) * 0.32;
            var bookSpin = isWindup ? phase * Math.PI : (1 - phase) * Math.PI;
            if (book) {
                book.position.y = 0.55 + bookRise;
                book.rotation.y = 0.2 + bookSpin;
                book.scale.setScalar(1.0 + (isWindup ? phase * 0.25 : (1 - phase) * 0.25));
            }
            if (tassel) tassel.rotation.z = 0.3 + (isWindup ? phase * 0.5 : (1 - phase) * 0.5);
            // glasses glow — usa lista cached
            var glowI = isWindup ? phase * 0.9 : (1 - phase) * 0.9;
            var _cEm = entry ? _ensureEmissiveCache(group, entry) : [];
            for (var _cei = 0; _cei < _cEm.length; _cei++) {
                var _cem = _cEm[_cei];
                if (_cem.material && _cem.material.emissive &&
                    _cem.material.color && _cem.material.color.getHexString() === '60a5fa') {
                    _cem.material.emissiveIntensity = (_cem.material._origEmissiveI || 0) + glowI;
                }
            }
            break;
        }

        case 'Valerio': {
            var segScale = 1.0 + (isWindup ? phase * 0.18 : (1 - phase) * 0.18);
            for (var s = 0; s < 4; s++) {
                var seg = _getCached(group, 'seg_' + s);
                if (seg) seg.scale.setScalar(segScale);
            }
            var spineScale = 1.0 + (isWindup ? phase * 0.6 : (1 - phase) * 0.6);
            for (var sp = 0; sp < 5; sp++) {
                var spine = _getCached(group, 'spine_' + sp);
                if (spine) spine.scale.y = spineScale;
            }
            // emissive charge-up — usa lista cached
            var chargeI = isWindup ? phase * 0.6 : (1 - phase) * 0.6;
            var _vEm = entry ? _ensureEmissiveCache(group, entry) : [];
            for (var _vei = 0; _vei < _vEm.length; _vei++) {
                if (_vEm[_vei].material && _vEm[_vei].material.emissive) {
                    _vEm[_vei].material.emissive.setStyle('#f97316');
                    _vEm[_vei].material.emissiveIntensity = chargeI;
                }
            }
            break;
        }

        case 'Yujin': {
            var axe = _getCached(group, 'axe');
            var bodyY = _getCached(group, 'body');
            if (isWindup) {
                // raise axe overhead
                if (axe) {
                    axe.position.y = 0.55 + phase * 0.45;
                    axe.rotation.z = -0.2 - phase * 1.0;
                    axe.rotation.x = -phase * 0.6;
                }
                if (bodyY) bodyY.rotation.z = -phase * 0.12;
            } else {
                // slam down
                if (axe) {
                    axe.position.y = 0.55 + (1 - phase) * 0.45;
                    axe.rotation.z = -0.2 - (1 - phase) * 1.0 + phase * 0.5;
                    axe.rotation.x = -(1 - phase) * 0.6;
                }
                if (bodyY) bodyY.rotation.z = -(1 - phase) * 0.12;
                // impact flash — usa lista cached
                if (phase < 0.35) {
                    var flashI = (0.35 - phase) / 0.35 * 1.5;
                    var _yEm = entry ? _ensureEmissiveCache(group, entry) : [];
                    for (var _yei = 0; _yei < _yEm.length; _yei++) {
                        if (_yEm[_yei].material && _yEm[_yei].material.emissive) {
                            _yEm[_yei].material.emissive.setStyle('#ef4444');
                            _yEm[_yei].material.emissiveIntensity = flashI;
                        }
                    }
                }
            }
            break;
        }

        case 'WMS': {
            var core = _getCached(group, 'core');
            var aura = _getCached(group, 'aura');
            var coreScale = 1.0 + (isWindup ? phase * 0.2 : (1 - phase) * 0.2);
            if (core) {
                core.scale.set(coreScale, coreScale, coreScale);
                core.material.emissiveIntensity = 0.6 + (isWindup ? phase * 1.2 : (1 - phase) * 1.2);
            }
            if (aura) aura.material.opacity = 0.06 + (isWindup ? phase * 0.14 : (1 - phase) * 0.14);
            // wisps spiral in then explode out
            for (var w = 0; w < 3; w++) {
                var wisp = _getCached(group, 'wisp_' + w);
                if (wisp) {
                    var wa, wr;
                    if (isWindup) {
                        wa = castData.elapsed * 8 + w * 2.09;
                        wr = 0.38 * (1 - phase * 0.7);
                        wisp.position.set(Math.cos(wa) * wr, 0.55, Math.sin(wa) * wr);
                    } else {
                        wa = castData.elapsed * 5 + w * 2.09;
                        wr = 0.38 * (0.3 + phase * 1.0);
                        wisp.position.set(Math.cos(wa) * wr, 0.55 + phase * 0.35, Math.sin(wa) * wr);
                    }
                }
            }
            break;
        }

        default: {
            // generic: whole model pulses emissive — usa lista cached
            var gI = isWindup ? phase * 0.7 : (1 - phase) * 0.7;
            var _dEm = entry ? _ensureEmissiveCache(group, entry) : null;
            if (_dEm) {
                for (var _dei = 0; _dei < _dEm.length; _dei++) {
                    if (_dEm[_dei].material && _dEm[_dei].material.emissive) {
                        _dEm[_dei].material.emissive.setStyle('#ffffff');
                        _dEm[_dei].material.emissiveIntensity = gI;
                    }
                }
                break;
            }
            // fallback se entry non disponibile
            group.traverse(function(child) {
                if (child.isMesh && child.material && child.material.emissive) {
                    child.material.emissive.setStyle('#ffffff');
                    child.material.emissiveIntensity = gI;
                }
            });
            break;
        }
    }
}
