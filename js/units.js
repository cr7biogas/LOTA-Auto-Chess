// ============================================================
// LOTA AUTO CHESS — units.js — Unit creation, state, abilities
// ============================================================

// --- Create a unit instance from character data ---
function createUnit(charId, star, owner, row, col) {
    const charDef = CHARACTERS[charId];
    const starIdx = Math.min(star - 1, charDef.stats.length - 1);
    const s = charDef.stats[starIdx];

    return {
        id: genUnitId(),
        charId: charId,
        owner: owner, // player index 0-3, or 'creep'
        star: star,

        // Stats
        maxHp: s.hp,
        hp: s.hp,
        atk: s.atk,
        baseAtk: s.atk,
        atkSpeed: charDef.atkSpeed,
        baseAtkSpeed: charDef.atkSpeed,
        armor: charDef.armor,
        baseArmor: charDef.armor,
        range: charDef.range,
        unitClass: charDef.unitClass,
        race: charDef.race,
        behavior: charDef.behavior,

        // Combat modifiers
        critChance: CRIT_CHANCE_BASE,
        dodgeChance: charId === 'Babidi' ? 0.15 : 0,
        atkSpeedMultiplier: 1.0,
        dmgMultiplier: 1.0,
        magicResist: 0,

        // Position (grid + world)
        row: row,
        col: col,
        wx: 0, wz: 0, // world-space position, set at combat init
        moveSpeed: (function() {
            switch(charId) {
                case 'Babidi': return 0.9;
                case 'Caronte': return 1.0;
                case 'Valerio': return 1.0;
                case 'Yujin': return 1.3;
                case 'WMS': return 1.1;
                default: return 1.0;
            }
        })(),
        px: 0, py: 0,
        targetRow: -1, targetCol: -1,

        // Combat state
        alive: true,
        atkTimer: charDef.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false,
        isStopped: false,

        // Items
        items: [],

        // Tactical order
        tacticalOrder: ORDER_FREE,
        tacticalTarget: null,    // ally unit id for proteggi/segui
        tacticalMoveRow: -1,     // target cell row for ORDER_MOVE
        tacticalMoveCol: -1,     // target cell col for ORDER_MOVE

        // Skills
        learnedSkills: {},     // { skillId: level (1-3) } — permanent, persists forever
        equippedSkills: [],    // max 3 active skill IDs (subset of learned)
        skillCooldowns: {},

        // Persistence
        survivalCount: 0,
        _needsRespawn: false,
        _consumableBuff: {},
        _curseDebuffs: [],

        // Status effects
        effects: [],

        // --- Character-specific state ---
        coins: 0,
        hasTeleported: false,
        abilityCooldown: charId === 'Caronte' ? 6 : (charId === 'Yujin' ? 8 : (charId === 'WMS' ? 7 : 999)),
        enhancedRegenUsed: false,
        enhancedRegenTicks: 0,
        furiaActive: false,
        furiaTicks: 0,
        noHealDuringFuria: false,
        copiedClass: null,
        copiedRace: null,
        lastAllyAbility: null,
        deathPreventionUsed: false,
        nucleoUsed: false,
        reviving: false,
        reviveTicks: 0,
        killStacks: 0,
        velenoCharges: 0,
        cristalloApplied: false,
        amiciStacks: 0,

        // Animation
        atkAnim: 0,
        hitAnim: 0,
        deathAnim: 0,
        facing: (function() {
            var zone = getDeployZone(owner);
            return zone ? zone.facing : 1;
        })(),
    };
}

// --- Create a creep unit ---
function createCreepUnit(creepDef, row, col) {
    return {
        id: genUnitId(),
        charId: 'creep_' + creepDef.round,
        owner: 'creep',
        star: 1,
        maxHp: creepDef.hp,
        hp: creepDef.hp,
        atk: creepDef.atk,
        baseAtk: creepDef.atk,
        atkSpeed: creepDef.atkSpeed,
        baseAtkSpeed: creepDef.atkSpeed,
        armor: creepDef.armor,
        baseArmor: creepDef.armor,
        range: 1,
        unitClass: 'Creep',
        race: 'Creep',
        behavior: 'tank',
        critChance: CRIT_CHANCE_BASE,
        dodgeChance: 0,
        atkSpeedMultiplier: 1.0,
        dmgMultiplier: 1.0,
        magicResist: 0,
        row: row, col: col,
        wx: 0, wz: 0, moveSpeed: 0.9,
        px: 0, py: 0,
        targetRow: -1, targetCol: -1,
        alive: true,
        atkTimer: creepDef.atkSpeed,
        shield: 0,
        targetUnitId: null,
        hasMoved: false, isStopped: false,
        items: [], effects: [],
        coins: 0, hasTeleported: false, abilityCooldown: 999,
        enhancedRegenUsed: false, enhancedRegenTicks: 0,
        furiaActive: false, furiaTicks: 0, noHealDuringFuria: false,
        copiedClass: null, copiedRace: null, lastAllyAbility: null,
        deathPreventionUsed: false, nucleoUsed: false, reviving: false, reviveTicks: 0,
        killStacks: 0, velenoCharges: 0, cristalloApplied: false, amiciStacks: 0,
        atkAnim: 0, hitAnim: 0, deathAnim: 0, facing: -1,
        creepAbility: creepDef.ability,
        creepName: creepDef.name,
        creepTier: creepDef.tier,
    };
}

// --- Recalculate unit stats with items and synergy buffs ---
function recalcUnitStats(unit) {
    const charDef = CHARACTERS[unit.charId];
    if (!charDef) return;
    const starIdx = Math.min(unit.star - 1, charDef.stats.length - 1);
    const base = charDef.stats[starIdx];
    var oldMaxHp = unit.maxHp || 0;

    unit.maxHp = base.hp;
    unit.atk = base.atk;
    unit.baseAtk = base.atk;
    unit.atkSpeed = charDef.atkSpeed;
    unit.baseAtkSpeed = charDef.atkSpeed;
    unit.armor = charDef.armor;
    unit.baseArmor = charDef.armor;
    unit.range = charDef.range;
    unit.critChance = CRIT_CHANCE_BASE;
    unit.dodgeChance = unit.charId === 'Babidi' ? 0.15 : 0;
    unit.atkSpeedMultiplier = 1.0;
    unit.dmgMultiplier = 1.0;
    unit.magicResist = 0;

    for (const itemId of unit.items) {
        const item = ITEMS[itemId];
        if (!item) continue;
        if (item.bonusHp) unit.maxHp += item.bonusHp;
        if (item.bonusAtk) unit.atk += item.bonusAtk;
        if (item.bonusArmor) unit.armor += item.bonusArmor;
        if (item.bonusCrit) unit.critChance += item.bonusCrit;
        if (item.bonusAtkSpeed) unit.atkSpeedMultiplier += item.bonusAtkSpeed;
        if (item.atkSpeedPenalty) unit.atkSpeedMultiplier += item.atkSpeedPenalty;
    }

    // Preserve HP ratio if unit had HP before recalc (don't reset persistent HP)
    if (oldMaxHp > 0 && unit.hp > 0) {
        var hpRatio = unit.hp / oldMaxHp;
        unit.hp = Math.max(1, Math.round(unit.maxHp * hpRatio));
    } else {
        unit.hp = unit.maxHp;
    }
}

// --- Target selection helpers ---
function findNearestEnemy(unit, enemies) {
    let nearest = null;
    let minDist = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        const d = unitWorldDist(unit, e);
        if (d < minDist) { minDist = d; nearest = e; }
    }
    return nearest;
}

function findHighestHpEnemy(unit, enemies) {
    let best = null;
    let maxHp = -1;
    for (const e of enemies) {
        if (!e.alive) continue;
        if (e.hp > maxHp) { maxHp = e.hp; best = e; }
    }
    return best;
}

function findLowestHpEnemy(unit, enemies) {
    let best = null;
    let minHp = Infinity;
    for (const e of enemies) {
        if (!e.alive) continue;
        if (e.hp < minHp) { minHp = e.hp; best = e; }
    }
    return best;
}

// --- Select target based on tactical order, class behavior + Taunt ---
// enemies = combined list from ALL opposing teams
// allies = optional, needed for proteggi/segui orders
function selectTarget(unit, enemies, allies) {
    // Filter out untargetable enemies
    var targetable = [];
    for (var i = 0; i < enemies.length; i++) {
        if (!enemies[i]._untargetable) targetable.push(enemies[i]);
    }
    enemies = targetable;

    // Dungeon boss: only target enemies inside the dungeon zone
    if (unit.isDungeonBoss && unit.dungeonId && typeof isValidDungeonCellForCorner === 'function') {
        var dungeonEnemies = [];
        for (var i = 0; i < enemies.length; i++) {
            if (isValidDungeonCellForCorner(enemies[i].row, enemies[i].col, unit.dungeonId)) {
                dungeonEnemies.push(enemies[i]);
            }
        }
        if (dungeonEnemies.length > 0) {
            enemies = dungeonEnemies;
        } else {
            return null; // No enemies in dungeon zone
        }
    }

    // Skill: Forced target (Provocazione Suprema)
    if (unit._forcedTargetId) {
        for (var i = 0; i < enemies.length; i++) {
            if (enemies[i].id === unit._forcedTargetId && enemies[i].alive) return enemies[i];
        }
    }

    var order = unit.tacticalOrder || ORDER_FREE;

    // --- Tactical order overrides ---
    if (order === ORDER_ATTACK) {
        // Always target highest HP enemy, IGNORE Taunt
        return findHighestHpEnemy(unit, enemies);
    }

    if (order === ORDER_PROTECT && allies && unit.tacticalTarget) {
        // Find the protected ally
        var protectee = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) {
                protectee = allies[i]; break;
            }
        }
        if (protectee) {
            // Target the nearest enemy to the protectee
            var bestTarget = null;
            var bestDist = Infinity;
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                var d = unitWorldDist(protectee, enemies[i]);
                if (d < bestDist) { bestDist = d; bestTarget = enemies[i]; }
            }
            if (bestTarget) return bestTarget;
        }
    }

    if (order === ORDER_FOLLOW && allies && unit.tacticalTarget) {
        // Attack whatever the followed ally is targeting
        var followed = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) {
                followed = allies[i]; break;
            }
        }
        if (followed && followed.targetUnitId) {
            for (var i = 0; i < enemies.length; i++) {
                if (enemies[i].id === followed.targetUnitId && enemies[i].alive) {
                    return enemies[i];
                }
            }
        }
        // Fallback: target nearest to followed ally
        if (followed) {
            var bestTarget = null;
            var bestDist = Infinity;
            for (var i = 0; i < enemies.length; i++) {
                if (!enemies[i].alive) continue;
                var d = unitWorldDist(followed, enemies[i]);
                if (d < bestDist) { bestDist = d; bestTarget = enemies[i]; }
            }
            if (bestTarget) return bestTarget;
        }
    }

    // --- Default: Taunt check + class behavior ---
    // Check Taunt: melee units must target nearest Valerio if alive
    // (ORDER_ATTACK bypasses this — handled above)
    if (unit.range <= 1) {
        var nearestValerio = null;
        var nearestDist = Infinity;
        for (var i = 0; i < enemies.length; i++) {
            if (!enemies[i].alive) continue;
            if (enemies[i].charId === 'Valerio' && enemies[i].unitClass === 'Guardiano') {
                var d = unitWorldDist(unit, enemies[i]);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestValerio = enemies[i];
                }
            }
        }
        if (nearestValerio) return nearestValerio;
    }

    switch (unit.behavior) {
        case 'kite':     return findNearestEnemy(unit, enemies);
        case 'teleport': return findLowestHpEnemy(unit, enemies);
        case 'tank':     return findNearestEnemy(unit, enemies);
        case 'dps':      return findHighestHpEnemy(unit, enemies);
        case 'carry':    return findNearestEnemy(unit, enemies);
        case 'copy':     return findNearestEnemy(unit, enemies);
        default:         return findNearestEnemy(unit, enemies);
    }
}

// --- Movement logic per behavior + tactical orders ---
// allies is optional, needed for proteggi/segui
function calculateMoveTarget(unit, target, grid, allies) {
    if (!target) return null;

    var order = unit.tacticalOrder || ORDER_FREE;

    // --- Tactical order movement overrides ---
    if (order === ORDER_HOLD) {
        // Never move
        return null;
    }

    if (order === ORDER_MOVE) {
        // Move toward target cell, then hold position and defend
        var mr = unit.tacticalMoveRow;
        var mc = unit.tacticalMoveCol;
        if (mr >= 0 && mc >= 0) {
            var distToTarget = chebyshevDist(unit.row, unit.col, mr, mc);
            if (distToTarget <= 0) {
                // Arrived — hold position, attack in range (like presidia)
                return null;
            }
            // Move toward target cell
            return bestStepToward(unit.row, unit.col, mr, mc, grid, unit.id);
        }
        return null;
    }

    if (order === ORDER_COVER) {
        // Kite: if enemy within range+1, flee. Otherwise stop at max range.
        var nearestEnemyDist = chebyshevDist(unit.row, unit.col, target.row, target.col);
        if (nearestEnemyDist <= unit.range) {
            // Enemy in range: flee away from it
            var dr = Math.sign(unit.row - target.row);
            var dc = Math.sign(unit.col - target.col);
            var fleeR = unit.row + dr;
            var fleeC = unit.col + dc;
            if (isValidCell(fleeR, fleeC) && !isCellOccupied(grid, fleeR, fleeC)) {
                return { r: fleeR, c: fleeC };
            }
            // Try sliding perpendicular
            return findSlideCell(unit.row, unit.col, unit.row + dr, unit.col + dc, grid);
        }
        if (nearestEnemyDist > unit.range + 2) {
            // Too far: approach to max range
            return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
        }
        return null; // Good distance, hold
    }

    if (order === ORDER_PROTECT && allies && unit.tacticalTarget) {
        var protectee = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) {
                protectee = allies[i]; break;
            }
        }
        if (protectee) {
            var distToProtectee = chebyshevDist(unit.row, unit.col, protectee.row, protectee.col);
            if (distToProtectee > 2) {
                // Too far from protectee: move toward them
                return bestStepToward(unit.row, unit.col, protectee.row, protectee.col, grid, unit.id);
            }
            // Close enough: move toward target enemy if in range, else hold near protectee
            var distToTarget = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (distToTarget <= unit.range) return null;
            // Only chase if we stay within 2 of protectee
            var step = bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
            if (step && chebyshevDist(step.r, step.c, protectee.row, protectee.col) <= 2) {
                return step;
            }
            return null;
        }
    }

    if (order === ORDER_FOLLOW && allies && unit.tacticalTarget) {
        var followed = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) {
                followed = allies[i]; break;
            }
        }
        if (followed) {
            var distToFollowed = chebyshevDist(unit.row, unit.col, followed.row, followed.col);
            if (distToFollowed > 2) {
                // Too far: move toward followed ally
                return bestStepToward(unit.row, unit.col, followed.row, followed.col, grid, unit.id);
            }
            // Close enough: move toward target
            var distToTarget = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (distToTarget <= unit.range) return null;
            return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
        }
    }

    if (order === ORDER_ATTACK) {
        // Aggressive: always move straight toward target
        var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
        if (dist <= unit.range) return null;
        var dr = Math.sign(target.row - unit.row);
        var dc = Math.sign(target.col - unit.col);
        var nr = unit.row + dr;
        var nc = unit.col + dc;
        if (isValidCell(nr, nc) && !isCellOccupied(grid, nr, nc)) return { r: nr, c: nc };
        return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
    }

    // --- Default: behavior-based movement (ORDER_FREE) ---
    switch (unit.behavior) {
        case 'stationary': {
            return null;
        }
        case 'aggressive': {
            // Dungeon boss: return to spawn if no target in dungeon
            if (unit.isDungeonBoss && !target) {
                // No enemies in dungeon zone — return to spawn
                var spawnRow = unit.spawnRow || 0;
                var spawnCol = unit.spawnCol || 0;
                var distToSpawn = chebyshevDist(unit.row, unit.col, spawnRow, spawnCol);
                if (distToSpawn > 0) {
                    return bestStepToward(unit.row, unit.col, spawnRow, spawnCol, grid, unit.id);
                }
                return null; // Already at spawn
            }

            if (!target) return null;

            // Move toward target but stay within dungeon zone
            var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (dist <= unit.range) return null;

            var step = bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);

            // If dungeon boss, verify step stays within dungeon
            if (unit.isDungeonBoss && step && unit.dungeonId) {
                if (typeof isValidDungeonCellForCorner === 'function') {
                    if (!isValidDungeonCellForCorner(step.r, step.c, unit.dungeonId)) {
                        return null; // Cannot leave dungeon zone
                    }
                }
            }
            return step;
        }
        case 'kite': {
            if (unit.isStopped) return null;
            var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (dist <= unit.range) {
                unit.isStopped = true;
                return null;
            }
            return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
        }
        case 'teleport': {
            return null;
        }
        case 'tank':
        case 'carry':
        case 'copy': {
            var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (dist <= unit.range) return null;
            return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
        }
        case 'dps': {
            var dist = chebyshevDist(unit.row, unit.col, target.row, target.col);
            if (dist <= unit.range) return null;
            if (unit.furiaActive) {
                var dr = Math.sign(target.row - unit.row);
                var dc = Math.sign(target.col - unit.col);
                var nr = unit.row + dr;
                var nc = unit.col + dc;
                if (isValidCell(nr, nc) && (grid[nr][nc] === null || grid[nr][nc] === unit.id)) return { r: nr, c: nc };
            }
            return bestStepToward(unit.row, unit.col, target.row, target.col, grid, unit.id);
        }
        default:
            return null;
    }
}

// --- Free movement: calculate world-space move target ---
// Returns { wx, wz, stopDist } or null (stay put)
function calculateFreeMoveTarget(unit, target, allies, allUnits) {
    var TU = (typeof TILE_UNIT !== 'undefined') ? TILE_UNIT : 1.0;
    var order = unit.tacticalOrder || ORDER_FREE;
    var attackDist = unit.range * TU + RANGE_BUFFER;

    if (order === ORDER_HOLD) return null;

    // ORDER_MOVE: march toward destination cell in world space
    if (order === ORDER_MOVE) {
        var mr = unit.tacticalMoveRow;
        var mc = unit.tacticalMoveCol;
        if (mr >= 0 && mc >= 0) {
            var destWx = mc * TU + TU * 0.5;
            var destWz = mr * TU + TU * 0.5;
            var d = worldDist(unit.wx, unit.wz, destWx, destWz);
            if (d <= 0.3) return null;
            return { wx: destWx, wz: destWz, stopDist: 0.2 };
        }
        if (!target) return null;
    }

    if (!target) return null;

    if (order === ORDER_COVER) {
        var d = unitWorldDist(unit, target);
        if (d <= attackDist) {
            // Flee away from target
            var dx = unit.wx - target.wx;
            var dz = unit.wz - target.wz;
            var len = Math.sqrt(dx * dx + dz * dz) || 1;
            return { wx: unit.wx + (dx / len) * 3, wz: unit.wz + (dz / len) * 3, stopDist: 0 };
        }
        if (d > attackDist + 2 * TU) {
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }
        return null;
    }

    if (order === ORDER_PROTECT && allies && unit.tacticalTarget) {
        var protectee = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) { protectee = allies[i]; break; }
        }
        if (protectee) {
            var distP = unitWorldDist(unit, protectee);
            if (distP > 2.5 * TU) return { wx: protectee.wx, wz: protectee.wz, stopDist: 1.0 * TU };
            var distT = unitWorldDist(unit, target);
            if (distT <= attackDist) return null;
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }
    }

    if (order === ORDER_FOLLOW && allies && unit.tacticalTarget) {
        var followed = null;
        for (var i = 0; i < allies.length; i++) {
            if (allies[i].id === unit.tacticalTarget && allies[i].alive) { followed = allies[i]; break; }
        }
        if (followed) {
            var distF = unitWorldDist(unit, followed);
            if (distF > 2.5 * TU) return { wx: followed.wx, wz: followed.wz, stopDist: 1.0 * TU };
            var distT = unitWorldDist(unit, target);
            if (distT <= attackDist) return null;
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }
    }

    if (order === ORDER_ATTACK) {
        var d = unitWorldDist(unit, target);
        if (d <= attackDist) return null;
        return { wx: target.wx, wz: target.wz, stopDist: attackDist * 0.5 };
    }

    // --- Default behavior ---
    switch (unit.behavior) {
        case 'stationary': return null;

        case 'aggressive': {
            if (unit.isDungeonBoss && !target) {
                var spawnWx = (unit.spawnCol || 0) * TU + TU * 0.5;
                var spawnWz = (unit.spawnRow || 0) * TU + TU * 0.5;
                if (worldDist(unit.wx, unit.wz, spawnWx, spawnWz) <= 0.3) return null;
                return { wx: spawnWx, wz: spawnWz, stopDist: 0.2 };
            }
            if (!target) return null;
            var d = unitWorldDist(unit, target);
            if (d <= attackDist) return null;
            // Dungeon boss zone check
            if (unit.isDungeonBoss && unit.dungeonId && typeof isValidDungeonCellForCorner === 'function') {
                var dx = target.wx - unit.wx, dz = target.wz - unit.wz;
                var dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > 0) {
                    var step = Math.min(unit.moveSpeed * TICK_DURATION_S * TU, dist);
                    var nC = Math.floor((unit.wx + (dx / dist) * step) / TU);
                    var nR = Math.floor((unit.wz + (dz / dist) * step) / TU);
                    if (!isValidDungeonCellForCorner(nR, nC, unit.dungeonId)) return null;
                }
            }
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }

        case 'kite': {
            var d = unitWorldDist(unit, target);
            if (d <= attackDist) {
                unit.isStopped = true;
                return null;
            }
            // Re-engage if target moved out of range
            if (unit.isStopped && d > attackDist + 0.5) {
                unit.isStopped = false;
            }
            if (unit.isStopped) return null;
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }

        case 'teleport': return null;

        case 'tank':
        case 'carry':
        case 'copy': {
            var d = unitWorldDist(unit, target);
            if (d <= attackDist) return null;
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }

        case 'dps': {
            var d = unitWorldDist(unit, target);
            if (d <= attackDist) return null;
            if (unit.furiaActive) {
                return { wx: target.wx, wz: target.wz, stopDist: attackDist * 0.3 };
            }
            return { wx: target.wx, wz: target.wz, stopDist: attackDist };
        }

        default: return null;
    }
}

// --- Apply WMS Risonanza Mistica ---
function applyRisonanzaMistica(wms, allies) {
    let bestAlly = null;
    let bestStar = 0;
    let bestMaxHp = 0;
    for (const ally of allies) {
        if (ally.id === wms.id) continue;
        if (!ally.alive) continue;
        if (ally.star > bestStar || (ally.star === bestStar && ally.maxHp > bestMaxHp)) {
            bestStar = ally.star;
            bestMaxHp = ally.maxHp;
            bestAlly = ally;
        }
    }
    if (bestAlly) {
        wms.copiedClass = bestAlly.unitClass;
        wms.copiedRace = bestAlly.race;
        switch (bestAlly.unitClass) {
            case 'Guardiano': wms.behavior = 'tank'; break;
            case 'Berserker': wms.behavior = 'dps'; break;
            case 'Incantatore': wms.behavior = 'teleport'; break;
            case 'Sciamano': wms.behavior = 'kite'; break;
            default: wms.behavior = 'carry'; break;
        }
    }
}

// --- Apply Sborrata Mistica ---
function applySborrataMistica(wms, allies, enemies) {
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const dmg = Math.max(1, Math.floor(enemy.hp * 0.04));
        enemy.hp -= dmg;
        addDamageNumber(enemy, dmg, 'magic');
        if (enemy.hp <= 0) {
            enemy.hp = 0;
            enemy.alive = false;
        }
    }

    let target = null;
    let lowestMaxHp = Infinity;
    for (const ally of allies) {
        if (ally.id === wms.id) continue;
        if (!ally.alive) continue;
        if (ally.maxHp < lowestMaxHp) {
            lowestMaxHp = ally.maxHp;
            target = ally;
        }
    }
    if (!target) target = wms;
    const bonus = Math.floor(target.maxHp * 0.15);
    target.maxHp += bonus;
    target.hp += bonus;
}

// --- Caronte Teleport at tick 0 ---
function performCaronteTeleport(caronte, enemies, grid) {
    const target = findLowestHpEnemy(caronte, enemies);
    if (!target) return;
    const freeCell = findFreeCellAdjacentTo(target.row, target.col, grid);
    if (freeCell) {
        grid[caronte.row][caronte.col] = null;
        caronte.row = freeCell.r;
        caronte.col = freeCell.c;
        grid[freeCell.r][freeCell.c] = caronte.id;
        // Sync world position for free movement
        initUnitWorldPos(caronte);
    }
    caronte.hasTeleported = true;
    caronte.shield = Math.floor(caronte.maxHp * 0.15);
    // VFX: teleport + shield
    if (typeof vfxTeleport === 'function') {
        var tp = cellToPixel(caronte.row, caronte.col);
        vfxTeleport(tp.x, tp.y, '#c084fc');
        vfxShield(tp.x, tp.y);
    }
}

// --- Damage number helper ---
function addDamageNumber(unit, amount, type) {
    const pos = cellToPixel(unit.row, unit.col);
    damageNumbers.push({
        x: pos.x + randInt(-10, 10),
        y: pos.y - CELL_SIZE / 2,
        text: type === 'miss' ? 'MISS' : (type === 'dodge' ? 'DODGE' : Math.round(amount).toString()),
        color: type === 'crit' ? COL_CRIT : (type === 'miss' || type === 'dodge' ? COL_MISS : (type === 'magic' ? COL_POISON : '#fff')),
        life: 1.0,
        vy: -1.5,
        isCrit: type === 'crit',
    });
}

// --- Helper: get all enemies of a unit from all opposing teams ---
function getEnemiesOf(unit, teams) {
    var enemies = [];
    var ownerKey = String(unit.owner);
    for (var key in teams) {
        if (key !== ownerKey) {
            var team = teams[key];
            for (var i = 0; i < team.length; i++) {
                if (team[i].alive) enemies.push(team[i]);
            }
        }
    }
    return enemies;
}

// --- Helper: get allies of a unit ---
function getAlliesOf(unit, teams) {
    var ownerKey = String(unit.owner);
    var team = teams[ownerKey];
    if (!team) return [];
    return team.filter(function(u) { return u.alive; });
}
