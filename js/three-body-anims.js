// ============================================================
// LOTA AUTO CHESS — three-body-anims.js — Spring Physics Body Animations
// Loaded AFTER three-animations.js — overrides _animateAttack + adds walk physics
// ============================================================

// ---- Spring helper ----
// s = { v: currentValue, vel: currentVelocity }
// returns mutated spring, use s.v for current value
function _spring(s, target, dt, k, damp) {
    var force = (target - s.v) * k;
    s.vel += force * dt;
    s.vel *= Math.max(0, 1.0 - damp * dt);
    s.v += s.vel * dt;
}

// Clamp helper
function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ---- Initialize per-entry spring state ----
function _initBodyState(entry) {
    if (entry._bodyPhysicsInit) return;
    entry._bodyPhysicsInit = true;

    // Walk cycle
    entry._walkPhase = Math.random() * Math.PI * 2; // stagger stride timing
    entry._isMoving = false;
    entry._moveSpeed = 0;

    // Universal springs
    entry._leanFwd      = { v: 0, vel: 0 };    // forward lean during walk/run
    entry._squash       = { v: 1, vel: 0 };    // body squash-stretch Y
    entry._stretchX     = { v: 1, vel: 0 };    // body squash-stretch X

    // Arm springs (rotation.x — raising / lowering)
    entry._armL_rx      = { v: 0, vel: 0 };
    entry._armL_rz      = { v: 0, vel: 0 };
    entry._armR_rx      = { v: 0, vel: 0 };
    entry._armR_rz      = { v: 0, vel: 0 };

    // Axe / weapon spring (Yujin)
    entry._axe_rz       = { v: -0.2, vel: 0 };
    entry._axe_rx       = { v: 0,    vel: 0 };

    // Secondary / gravity appendages
    entry._capeSwing    = { v: 0, vel: 0 };    // Yujin cape lag
    entry._tasselSwing  = { v: 0, vel: 0 };    // Caronte tassel lag
    entry._bookFloat    = { v: 0.55, vel: 0 }; // Caronte book Y
    entry._bookRot      = { v: 0.2,  vel: 0 }; // Caronte book rot.Y

    // Worm segments (Valerio) — per-segment Z offset spring
    entry._segZ  = [];
    entry._segRx = [];
    for (var s = 0; s < 4; s++) {
        entry._segZ[s]  = { v: 0, vel: 0 };
        entry._segRx[s] = { v: 0, vel: 0 };
    }

    // Impact reaction (arm recoil after strike)
    entry._impactTimer = 0;
}

// ====================================================================
//  WALK-CYCLE + SECONDARY PHYSICS
//  Called in the idle/walk branch of updateAnimations3D override
// ====================================================================
function _animateBodyPhysics(g, unit, entry, dt, phase) {
    _initBodyState(entry);

    // ---- movement detection ----
    var distToTarget = g.position.distanceTo(entry.targetPos);
    var wasMoving = entry._isMoving;
    entry._isMoving = distToTarget > 0.08;
    var speedTarget = entry._isMoving ? 1.0 : 0.0;
    entry._moveSpeed += (speedTarget - entry._moveSpeed) * Math.min(1, dt * 8);

    // advance walk phase proportional to movement speed
    var walkFreq = 4.5; // steps per second at full speed
    if (entry._isMoving) {
        entry._walkPhase += dt * walkFreq * entry._moveSpeed;
    }

    var wp      = entry._walkPhase;
    var ms      = entry._moveSpeed;
    var t       = phase; // global time offset per unit

    // ======== CHARACTER-SPECIFIC BODY PHYSICS ========
    switch (unit.charId) {

        // ----------------------------------------------------------------
        case 'Babidi': {
            var body = g.getObjectByName('body');
            var armL = g.getObjectByName('armL');
            var armR = g.getObjectByName('armR');
            var head = g.getObjectByName('head');

            // Walk: fat waddling — wide side-to-side sway + shoulder roll
            if (body) {
                var waddle = Math.sin(wp * 2) * 0.07 * ms;      // horizontal sway
                var bobY   = 0.38 + Math.abs(Math.sin(wp)) * 0.025 * ms; // up-down bob
                _spring(entry._leanFwd,  ms * 0.12, dt, 18, 8);

                body.rotation.z  = waddle;
                body.rotation.x  = entry._leanFwd.v;
                body.position.y  = bobY;
            }

            // Arms: pendulum swing — opposite phase to leg steps
            var armSwingAmp = 0.38 * ms;
            var armLtarget_rx = Math.sin(wp) * armSwingAmp;         // L swings back when R leg fwd
            var armRtarget_rx = -Math.sin(wp) * armSwingAmp;

            _spring(entry._armL_rx, armLtarget_rx, dt, 22, 7);
            _spring(entry._armR_rx, armRtarget_rx, dt, 22, 7);

            // Gravitational lag on arms — they hang and trail
            var gravLag = 0.12 + ms * 0.08;
            _spring(entry._armL_rz, -0.35 - gravLag, dt, 14, 6);
            _spring(entry._armR_rz,  0.35 + gravLag, dt, 14, 6);

            if (armL) {
                armL.rotation.x = entry._armL_rx.v;
                armL.rotation.z = entry._armL_rz.v;
            }
            if (armR) {
                armR.rotation.x = entry._armR_rx.v;
                armR.rotation.z = entry._armR_rz.v;
            }

            // Head: bobs on step
            if (head) {
                head.rotation.x = -entry._leanFwd.v * 0.5;
                head.position.y = 0.72 + Math.abs(Math.sin(wp)) * 0.012 * ms;
            }

            // Coins: gravity-pulled outward on turns, orbit normal at idle
            for (var ci = 0; ci < 3; ci++) {
                var coin = g.getObjectByName('coin_' + ci);
                if (coin) {
                    var ca    = t * 1.6 + ci * 2.09;
                    var coinR = 0.55 + ms * 0.08; // expand orbit when moving
                    var coinY = 0.45 + Math.sin(ca * 0.7 + wp * 0.3) * 0.18;
                    coin.position.set(Math.cos(ca) * coinR, coinY, Math.sin(ca) * coinR);
                    // tilt coin with movement direction
                    coin.rotation.x = entry._leanFwd.v * 0.5;
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Caronte': {
            var body = g.getObjectByName('body');
            var head = g.getObjectByName('head');
            var tassel = g.getObjectByName('tassel');
            var book   = g.getObjectByName('book');

            // Caronte floats — no walk cycle, smooth glide
            // Body: gentle S-curve sway when moving
            _spring(entry._leanFwd, ms * 0.1, dt, 15, 7);
            if (body) {
                body.rotation.x = entry._leanFwd.v;
                body.rotation.z = Math.sin(t * 1.4 + wp * 0.3) * 0.03 * (1 + ms);
                body.position.y = 0.32 + Math.sin(t * 2.0) * 0.012;
            }

            // Tassel: gravity + inertia drag — lags behind movement direction
            var tasselTarget = -entry._leanFwd.v * 1.8 + Math.sin(t * 1.6 + wp * 0.5) * 0.2;
            _spring(entry._tasselSwing, tasselTarget, dt, 12, 5);
            if (tassel) {
                tassel.rotation.z = 0.3 + entry._tasselSwing.v;
                tassel.rotation.x = entry._leanFwd.v * 0.4;
            }

            // Book: floats with gravitational pull, bobs on magic pulse
            var bookYtarget = 0.55 + Math.sin(t * 1.3) * 0.04 + ms * 0.06;
            var bookRtarget = 0.2 + Math.sin(t * 0.8) * 0.1 + ms * 0.15;
            _spring(entry._bookFloat, bookYtarget, dt, 16, 6);
            _spring(entry._bookRot,   bookRtarget, dt, 10, 4);
            if (book) {
                book.position.y = entry._bookFloat.v;
                book.rotation.y = entry._bookRot.v;
                // lean book into motion
                book.rotation.x = entry._leanFwd.v * 0.3;
            }

            // Head: slight look-up when casting magic feel
            if (head) {
                head.rotation.x = -0.05 - entry._leanFwd.v * 0.4;
            }

            // Arcane orbs: wider orbit when moving, pull inward at rest
            for (var ri = 0; ri < 2; ri++) {
                var rune = g.getObjectByName('rune_' + ri);
                if (rune) {
                    var ra   = t * 0.7 + ri * Math.PI + wp * 0.2;
                    var rOrbR = 0.5 + ms * 0.12;
                    rune.position.set(
                        Math.cos(ra) * rOrbR,
                        0.6 + Math.sin(ra * 1.3) * 0.15,
                        Math.sin(ra) * rOrbR
                    );
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Valerio': {
            // Worm locomotion: peristaltic squash/stretch wave through segments
            // Segments are stacked vertically — only X sway + Y scale ripple, NO Z displacement
            // Base Y for segment s: 0.12 + s * 0.153 (from _buildValerio)
            for (var s = 0; s < 4; s++) {
                var seg = g.getObjectByName('seg_' + s);
                if (!seg) continue;

                var segBaseY = 0.12 + s * 0.153;
                var segPhase = wp - s * 0.45; // ripple delay between segments
                var squeeze  = Math.sin(segPhase * 2); // -1..1

                // Squash-stretch: segments alternately compress and expand vertically
                var scaleY = 1.0 + squeeze * 0.12 * ms;
                var scaleX = 1.0 - squeeze * 0.06 * ms; // conserve volume

                seg.scale.y = scaleY;
                seg.scale.x = scaleX;
                seg.scale.z = scaleX;

                // Subtle X sway — worm wiggles side-to-side
                seg.position.x = Math.sin(t * 1.5 + s * 0.7) * 0.018;
                // Y stays at base — no vertical drift
                seg.position.y = segBaseY;
                // Z stays at 0 — no forward telescoping
                seg.position.z = 0;
                seg.rotation.x = 0;
                seg.rotation.z = 0;
            }

            // Head segment (seg_0): scan left/right
            var headSeg = g.getObjectByName('seg_0');
            if (headSeg) {
                headSeg.rotation.y = Math.sin(t * 1.1) * 0.15;
            }

            // Spines: ripple wave
            for (var sp = 0; sp < 5; sp++) {
                var spine = g.getObjectByName('spine_' + sp);
                if (spine) {
                    var spineWave = Math.sin(t * 2.5 + sp * 0.9) * 0.1;
                    spine.scale.y  = 1.0 + Math.abs(spineWave) * 0.25 * (1 + ms);
                    spine.rotation.z = Math.sin(t * 1.8 + sp * 0.6) * 0.06;
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Yujin': {
            var body  = g.getObjectByName('body');
            var armL  = g.getObjectByName('armL');
            var armR  = g.getObjectByName('armR');
            var axe   = g.getObjectByName('axe');
            var cape  = g.getObjectByName('cape');
            var head  = g.getObjectByName('head') || g.getObjectByName('eyeL')
                        ? g.getObjectByName('head') : null;

            var isFuria  = unit.furiaActive;
            var furiaMul = isFuria ? 1.5 : 1.0;

            // Walk: heavy warrior stride
            var walkAmp = 0.05 * ms * furiaMul;
            var strideLean = Math.sin(wp * 2) * walkAmp; // lateral lean

            _spring(entry._leanFwd, ms * 0.16 * furiaMul, dt, 18, 8);

            if (body) {
                body.rotation.x = entry._leanFwd.v;
                body.rotation.z = strideLean * 0.5;
                // breathing
                body.scale.x = 1.0 + Math.sin(t * 1.8) * 0.02;
                body.scale.z = 1.0 + Math.sin(t * 1.8) * 0.015;
            }

            // Arms: heavy pendulum swing
            var armSwingAmpY = (0.45 + ms * 0.2) * furiaMul;
            _spring(entry._armL_rx, Math.sin(wp) * armSwingAmpY,  dt, 20, 7);
            _spring(entry._armR_rx, -Math.sin(wp) * armSwingAmpY, dt, 20, 7);

            // Gravitational hang — arms feel heavy
            var hangL = 0.25 + ms * 0.05;
            var hangR = -0.25 - ms * 0.05;
            _spring(entry._armL_rz, hangL, dt, 10, 5);
            _spring(entry._armR_rz, hangR, dt, 10, 5);

            if (armL) {
                armL.rotation.x = entry._armL_rx.v;
                armL.rotation.z = entry._armL_rz.v;
            }
            if (armR) {
                armR.rotation.x = entry._armR_rx.v;
                armR.rotation.z = entry._armR_rz.v;
            }

            // Axe: gravitational droop — hangs off right arm, swings with stride
            var axeTarget_rz = -0.2 + entry._armR_rx.v * 0.5 - entry._leanFwd.v * 0.4;
            var axeTarget_rx =  entry._leanFwd.v * 0.3;
            var axeSwingSpeed = isFuria ? 6 : 1.3;
            axeTarget_rz += Math.sin(t * axeSwingSpeed) * (isFuria ? 0.18 : 0.1);

            _spring(entry._axe_rz, axeTarget_rz, dt, 15, 5);
            _spring(entry._axe_rx, axeTarget_rx, dt, 15, 5);

            if (axe) {
                axe.rotation.z = entry._axe_rz.v;
                axe.rotation.x = entry._axe_rx.v;
            }

            // Cape: inertia drag — trails behind movement, flaps in idle
            var capeTargetZ = -entry._leanFwd.v * 2.5 + Math.sin(t * 2.2) * 0.08;
            var capeTargetX = strideLean * 1.8;
            _spring(entry._capeSwing, capeTargetZ, dt, 8, 3);

            if (cape) {
                cape.rotation.x = entry._capeSwing.v;
                cape.rotation.z = capeTargetX;
                // cape spread on fast movement
                cape.scale.x = 1.0 + ms * 0.15;
                cape.scale.y = 1.0 - ms * 0.06; // compress down slightly
            }

            // Furia: axe trembles violently
            if (isFuria && axe) {
                axe.rotation.z += (Math.random() - 0.5) * 0.1;
                axe.rotation.x += (Math.random() - 0.5) * 0.06;
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'WMS': {
            var core  = g.getObjectByName('core');
            var aura  = g.getObjectByName('aura');

            // WMS floats — no legs, smooth displacement
            _spring(entry._leanFwd, ms * 0.08, dt, 12, 6);

            if (core) {
                var cp = 1.0 + Math.sin(t * 2.5) * 0.08;
                core.scale.set(cp, cp, cp);
                core.rotation.y += dt * (0.8 + ms * 1.2);
            }
            if (aura) {
                var ap = 1.0 + Math.sin(t * 2.0) * 0.06 + ms * 0.05;
                aura.scale.set(ap, ap, ap);
                aura.material.opacity = 0.04 + Math.sin(t * 2.5) * 0.02;
                aura.rotation.y -= dt * 0.4;
            }

            // Wisps: inertial lag when moving — trail behind
            for (var w = 0; w < 3; w++) {
                var wisp = g.getObjectByName('wisp_' + w);
                if (wisp) {
                    var wa    = t * 1.2 + w * (Math.PI * 2 / 3);
                    var wispR = 0.38 + ms * 0.1;
                    var wispDrag = 1.0 - entry._leanFwd.v * 1.5; // trail behind
                    wisp.position.set(
                        Math.cos(wa) * wispR,
                        0.55 + Math.sin(wa * 1.5) * 0.1 - entry._leanFwd.v * 0.2,
                        Math.sin(wa) * wispR + entry._leanFwd.v * 0.25
                    );
                }
            }

            // Sparks: drift upward
            var sparks = g.getObjectByName('sparks');
            if (sparks && sparks.geometry) {
                var pos = sparks.geometry.attributes.position;
                if (pos) {
                    for (var si = 0; si < pos.count; si++) {
                        pos.setY(si, pos.getY(si) + dt * (0.15 + ms * 0.1));
                        if (pos.getY(si) > 1.0) pos.setY(si, 0.2);
                    }
                    pos.needsUpdate = true;
                }
            }

            g.position.y += Math.sin(t * 2.5) * 0.002;
            break;
        }

        default: {
            // Generic creep: simple pulse
            var bBody = g.getObjectByName('body');
            if (bBody) {
                var bp = 1.0 + Math.sin(t * 1.8) * 0.03;
                bBody.scale.set(bp, bp, bp);
            }
            break;
        }
    }
}

// ====================================================================
//  PHYSICS-BASED ATTACK ANIMATION — replaces the original _animateAttack
//  Heavy squash/stretch, anticipation, wind-up, strike, follow-through
//  atkAnim: 1.0 → 0.0;   p = 1 - atkAnim: 0 → 1
// ====================================================================
var _origAnimateAttack = (typeof _animateAttack === 'function') ? _animateAttack : null;

// Override
_animateAttack = function(g, unit, dt) {
    var p      = 1.0 - unit.atkAnim;  // 0 = start, 1 = end
    var entry  = threeUnitModels[unit.id];
    if (entry) _initBodyState(entry);

    // Forward direction vector
    var fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);

    // ── 4-phase curve ──
    // Phase A (0.00–0.20): ANTICIPATION — lean back, coil
    // Phase B (0.20–0.45): WIND-UP      — raise weapon/arms overhead
    // Phase C (0.45–0.65): STRIKE       — explosive hit, squash on impact
    // Phase D (0.65–1.00): FOLLOW-THROUGH — decelerate, stretch then relax

    var phaseA = _clamp(p / 0.20, 0, 1);
    var phaseB = _clamp((p - 0.20) / 0.25, 0, 1);
    var phaseC = _clamp((p - 0.45) / 0.20, 0, 1);
    var phaseD = _clamp((p - 0.65) / 0.35, 0, 1);

    // Ease curves
    var easeIn  = function(x) { return x * x; };
    var easeOut = function(x) { return 1 - (1-x)*(1-x); };
    var easeInOut = function(x) { return x < 0.5 ? 2*x*x : 1-2*(1-x)*(1-x); };

    // ── Body lunge ──
    // Anticipation: pull back slightly; Strike: surge forward; Follow: settle
    var lungePull   = -0.08 * easeOut(phaseA) * (phaseB < 1.0 ? 1.0 : 0); // lean back
    var lungeStrike = 0.32 * easeIn(phaseC);                                // surge
    var lungeSettle = lungeStrike * (1.0 - easeOut(phaseD));               // settle

    var lungeNet = lungePull + (phaseB >= 1.0 ? lungeSettle : 0) +
                   (phaseC > 0 ? 0.32 * easeIn(phaseC) * (1 - phaseD) : 0);
    g.position.add(fwd.clone().multiplyScalar(lungeNet));

    // ── Squash & Stretch ──
    // Anticipation: slight squash (coil); Strike: strong stretch (extension); Follow-through: return
    var sqBase = (typeof STAR_SCALE !== 'undefined' && entry && entry.star)
                ? (STAR_SCALE[Math.min(entry.star, 5)] || 1.0) : 1.0;

    var sqY = 1.0;
    var sqX = 1.0;
    if (p < 0.2) {
        // coil — slight squash down
        sqY = 1.0 - easeIn(phaseA) * 0.08;
        sqX = 1.0 + easeIn(phaseA) * 0.05;
    } else if (p < 0.65) {
        // wind-up + strike — stretch upward then snap
        var stretchP = easeIn(phaseB) * (1 - phaseC) + easeIn(phaseC) * 0.3;
        sqY = 1.0 + stretchP * 0.18;
        sqX = 1.0 - stretchP * 0.06;
    } else {
        // follow-through — relax back
        sqY = 1.0 + (1 - easeOut(phaseD)) * 0.05;
        sqX = 1.0;
    }
    g.scale.set(sqBase * sqX, sqBase * sqY, sqBase * sqX);

    switch (unit.charId) {

        // ----------------------------------------------------------------
        case 'Babidi': {
            var body  = g.getObjectByName('body');
            var armR  = g.getObjectByName('armR');
            var armL  = g.getObjectByName('armL');
            var head  = g.getObjectByName('head');

            // Anticipation: body leans back, arms cross in
            var antRx = easeIn(phaseA) * 0.2;    // lean back
            var antRz = easeIn(phaseA) * -0.08;  // slight clockwise tilt

            // Strike: arm throws forward with force, body lurches
            var strikeArmR_rx = p < 0.45
                ? -(easeIn(phaseB) * 1.8 + antRx)  // wind-up: raise right arm high
                : -(1 - easeOut(phaseC)) * 1.8 + easeOut(phaseD) * 0.3; // slam down + recover

            var strikeArmL_rx = p < 0.45
                ?  easeIn(phaseB) * 0.6               // left arm rises with balance
                : -(easeOut(phaseC) * 0.4);           // left trails on strike

            var bodyLean = p < 0.45
                ?  -antRx                              // lean back during coil
                :   easeIn(phaseC) * 0.25 - easeOut(phaseD) * 0.1; // lunge fwd then settle

            if (body) {
                body.rotation.x = bodyLean;
                body.rotation.z = antRz * (1 - phaseB);
                var bobExtra = easeIn(phaseC) * 0.06;
                body.position.y = 0.38 - bobExtra;
            }
            if (armR) {
                armR.rotation.x = strikeArmR_rx;
                armR.rotation.z = -0.4 - easeIn(phaseC) * 0.3;
            }
            if (armL) {
                armL.rotation.x = strikeArmL_rx;
                armL.rotation.z = 0.4 + easeIn(phaseC) * 0.15;
            }
            if (head) {
                // head snaps down on strike, raises in wind-up
                head.rotation.x = p < 0.45 ? -easeIn(phaseB) * 0.25 : easeIn(phaseC) * 0.15;
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Caronte': {
            var body  = g.getObjectByName('body');
            var head  = g.getObjectByName('head');
            var book  = g.getObjectByName('book');
            var tassel = g.getObjectByName('tassel');

            // Staff casting: book sweeps in dramatic arc
            var bookY = p < 0.45
                ? 0.55 + easeIn(phaseB) * 0.35     // raise book high
                : 0.55 + 0.35 - easeOut(phaseC) * 0.25 + (1 - easeOut(phaseD)) * 0.05; // pulse then lower

            var bookSpin = p < 0.45
                ? easeInOut(phaseB) * Math.PI * 0.5  // quarter spin wind-up
                : Math.PI * 0.5 - easeOut(phaseC) * Math.PI * 0.25; // release

            var bookScale = 1.0 + easeIn(phaseB) * 0.4 * (1 - phaseC) + easeIn(phaseC) * 0.15;

            if (book) {
                book.position.y = bookY;
                book.rotation.y = 0.2 + bookSpin;
                book.position.z = easeIn(phaseC) * 0.45;
                book.scale.setScalar(bookScale);
            }

            // Body rises with incantation
            if (body) {
                body.position.y = 0.32 + easeIn(phaseB) * 0.1 * (1 - phaseD);
                body.rotation.x = -easeIn(phaseB) * 0.15 * (1 - phaseC);
            }
            if (head) {
                head.rotation.x = -easeIn(phaseB) * 0.3 + easeIn(phaseC) * 0.1;
            }

            // Tassel: swings back on sudden movement, then forward
            var tasselTarget = p < 0.45
                ?  easeIn(phaseB) * 0.6           // swing back during wind-up
                : -easeIn(phaseC) * 0.4;          // whip forward on release
            if (entry) _spring(entry._tasselSwing, tasselTarget, dt, 25, 7);
            if (tassel && entry) {
                tassel.rotation.z = 0.3 + entry._tasselSwing.v;
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Valerio': {
            // Lunge attack: whole-body squash/stretch wave — NO per-segment Z extension
            for (var s = 0; s < 4; s++) {
                var seg = g.getObjectByName('seg_' + s);
                if (!seg) continue;

                var segBaseY2 = 0.12 + s * 0.153;
                var delay = s * 0.06; // back segments lag slightly
                var pSeg  = _clamp(p - delay, 0, 1);
                var phAa  = _clamp(pSeg / 0.20, 0, 1);
                var phCc  = _clamp((pSeg - 0.45) / 0.20, 0, 1);
                var phDd  = _clamp((pSeg - 0.65) / 0.35, 0, 1);

                // Anticipation: compress vertically (coil)
                // Strike: stretch vertically (extend)
                // Follow-through: return to normal
                var sqY, sqX;
                if (pSeg < 0.45) {
                    sqY = 1.0 - easeIn(phAa) * 0.25;   // squash
                    sqX = 1.0 + easeIn(phAa) * 0.15;
                } else if (pSeg < 0.65) {
                    sqY = 0.75 + easeIn(phCc) * 0.55;  // snap back + overshoot
                    sqX = 1.15 - easeIn(phCc) * 0.2;
                } else {
                    sqY = 1.0 + (1 - easeOut(phDd)) * 0.1;
                    sqX = 1.0;
                }

                seg.scale.y = sqY;
                seg.scale.x = sqX;
                seg.scale.z = sqX;
                seg.position.y = segBaseY2; // keep Y absolute
                seg.position.z = 0;         // no Z telescoping
                seg.rotation.x = 0;
            }

            // Spines: all flare during strike
            for (var sp = 0; sp < 5; sp++) {
                var spine = g.getObjectByName('spine_' + sp);
                if (spine) {
                    var spineFlare = easeIn(phaseC) * (1 - easeOut(phaseD));
                    spine.scale.y = 1.0 + spineFlare * 0.8 + Math.sin(renderTime * 2.5 + sp * 0.9) * 0.1;
                    spine.scale.x = 1.0 + spineFlare * 0.3;
                }
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'Yujin': {
            // !! HEAVY AXE SWING — full physics body !!
            var axe   = g.getObjectByName('axe');
            var armR  = g.getObjectByName('armR');
            var armL  = g.getObjectByName('armL');
            var torso = g.getObjectByName('body');
            var cape  = g.getObjectByName('cape');

            var isFuria  = unit.furiaActive;
            var furiaMul = isFuria ? 1.5 : 1.0;

            // ANTICIPATION: step back, bend knees (body squash), axe held at side
            var anticipBodyRz = easeOut(phaseA) * -0.12;         // lean right for power
            var anticipBodyRx = -easeOut(phaseA) * 0.15;         // lean back

            // WIND-UP: axe rises over head, body coils
            var windupRz = -easeInOut(phaseB) * 2.2 * furiaMul;  // axe sweeps up-right
            var windupRx = -easeIn(phaseB) * 0.6 * furiaMul;     // axe tilts back

            // STRIKE: explosive downward slam + body lunges
            var strikeRz = p >= 0.45
                ? windupRz + easeIn(phaseC) * (2.2 * furiaMul + 0.9)  // axe slams down-left
                : windupRz;
            var strikeRx = p >= 0.45
                ? windupRx + easeIn(phaseC) * 1.2                     // forward tilt
                : windupRx;

            // FOLLOW-THROUGH: weapon carries past, then springs back
            var ftRz = p >= 0.65
                ? strikeRz - easeOut(phaseD) * 0.4 * furiaMul          // overshoot right
                : strikeRz;
            var ftRx = p >= 0.65
                ? strikeRx - easeOut(phaseD) * (strikeRx - 0)          // return to neutral
                : strikeRx;

            if (axe) {
                axe.rotation.z = _clamp(ftRz, -3.5, 1.5);
                axe.rotation.x = _clamp(ftRx, -1.5, 0.6);
            }

            // Right arm: follows axe path (shoulder rotation)
            var armR_rx = p < 0.45
                ? -easeIn(phaseB) * 1.5 * furiaMul                   // raise arm
                : -1.5 * furiaMul + easeIn(phaseC) * 1.8 * furiaMul * (1 - phaseD * 0.7); // slam + settle
            var armR_rz = -0.25 - easeIn(phaseB) * 0.25;

            if (armR) {
                armR.rotation.x = armR_rx;
                armR.rotation.z = armR_rz;
            }

            // Left arm: counter-balance — swings opposite
            var armL_rx = p < 0.45
                ?  easeIn(phaseB) * 0.6 * furiaMul   // extend left as balance
                : -easeIn(phaseC) * 0.5;             // tuck on strike
            var armL_rz = 0.25 + easeIn(phaseB) * 0.2;

            if (armL) {
                armL.rotation.x = armL_rx;
                armL.rotation.z = armL_rz;
            }

            // Torso: wind-up twist + forward lunge on impact
            if (torso) {
                var torsoRot_y = p < 0.45
                    ? easeIn(phaseB) * 0.2 * furiaMul     // rotate into strike
                    : 0.2 * furiaMul - easeIn(phaseC) * 0.35 * furiaMul; // uncoil
                torso.rotation.y = torsoRot_y;
                torso.rotation.x = anticipBodyRx + (p > 0.2 ? easeIn(phaseC) * 0.3 * (1 - phaseD) : 0);
                torso.rotation.z = anticipBodyRz * (1 - phaseB);
            }

            // Cape: inertia lag — trails opposite to swing direction
            if (cape && entry) {
                var capeTargetX = p < 0.45
                    ?  easeIn(phaseB) * 0.5                 // trail behind wind-up
                    : -easeIn(phaseC) * 0.7 * furiaMul      // whip forward on strike
                    + easeOut(phaseD) * 0.3;                // settle
                _spring(entry._capeSwing, capeTargetX, dt, 12, 4);
                cape.rotation.x = entry._capeSwing.v;
                cape.rotation.z = anticipBodyRz * 0.8;
                // cape billows during wind-up
                cape.scale.x = 1.0 + easeIn(phaseB) * 0.25 * (1 - phaseC);
            }
            break;
        }

        // ----------------------------------------------------------------
        case 'WMS': {
            var core  = g.getObjectByName('core');
            var aura  = g.getObjectByName('aura');

            // WMS: energy convergence → explosion
            // Wind-up: wisps spiral inward, core compresses
            // Strike: core explodes, wisps blast outward

            var convergeSqHale = easeIn(phaseB); // 0→1 during wind-up
            var blastP         = easeIn(phaseC);
            var settleP        = easeOut(phaseD);

            if (core) {
                var coreScale;
                if (p < 0.45) {
                    coreScale = 1.0 - convergeSqHale * 0.3;   // compress (charging)
                } else if (p < 0.65) {
                    coreScale = 0.7 + blastP * 0.7;            // explode outward
                } else {
                    coreScale = 1.4 - settleP * 0.4;           // settle to 1.0
                }
                core.scale.setScalar(coreScale);
                if (core.material) {
                    core.material.emissiveIntensity = 0.4 + convergeSqHale * 1.2 + blastP * 0.8 * (1 - settleP);
                }
            }

            if (aura) {
                var auraScale = 1.0 + convergeSqHale * 0.1 + blastP * 0.5 * (1 - settleP * 0.7);
                aura.scale.setScalar(auraScale);
                if (aura.material) {
                    aura.material.opacity = 0.04 + convergeSqHale * 0.15 + blastP * 0.2;
                }
            }

            // Wisps: converge during wind-up, blast outward on strike
            for (var w = 0; w < 3; w++) {
                var wisp = g.getObjectByName('wisp_' + w);
                if (wisp) {
                    var wAngle = (Math.PI * 2 / 3) * w;
                    var wRadius = p < 0.45
                        ? 0.38 * (1 - convergeSqHale * 0.9)      // spiral inward
                        : blastP * 1.2;                           // blast out then will return in idle
                    wisp.position.x = Math.cos(wAngle) * wRadius;
                    wisp.position.z = Math.sin(wAngle) * wRadius + (p > 0.45 ? blastP * 0.5 : 0);
                    wisp.position.y = 0.55 + (p < 0.45 ? -convergeSqHale * 0.1 : blastP * 0.3);
                }
            }
            break;
        }

        default: {
            // Fallback to original for creeps
            if (_origAnimateAttack) _origAnimateAttack(g, unit, dt);
            break;
        }
    }
};

// ====================================================================
//  HOOK into updateAnimations3D — inject walk physics into idle branch
//  We patch the global reference so our physics run on every frame
// ====================================================================

var _origUpdateAnimations3D_body = (typeof updateAnimations3D === 'function') ? updateAnimations3D : null;

updateAnimations3D = function(dt, units) {
    if (!units) return;
    if (_origUpdateAnimations3D_body) _origUpdateAnimations3D_body(dt, units);

    // Second pass: inject body physics (walk cycle + secondary motion)
    // Only runs for alive units, supplements idle
    var t = (typeof renderTime !== 'undefined') ? renderTime : 0;

    for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        if (!unit.alive) continue;
        var entry = threeUnitModels[unit.id];
        if (!entry) continue;

        var g = entry.group;
        var phase = t + unit.id * 1.618;

        // Skip if in skill cast or attack (those have their own arm control)
        var inSkillCast = entry._skillCast && entry._skillCast.elapsed < entry._skillCast.duration;
        var inAttack    = unit.atkAnim > 0.1;

        if (!inSkillCast && !inAttack) {
            _animateBodyPhysics(g, unit, entry, dt, phase);
        } else {
            // Still init spring state so it's ready when idle resumes
            _initBodyState(entry);
        }
    }
};

// ====================================================================
//  INIT: ensure spring state is set up on existing entries at load time
// ====================================================================
if (typeof threeUnitModels !== 'undefined') {
    for (var _baid in threeUnitModels) {
        _initBodyState(threeUnitModels[_baid]);
    }
}
