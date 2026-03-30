// ============================================================
// LOTA AUTO CHESS — board.js — 14x14 octagonal grid
// ============================================================

const GRID_BLOCKED = -1; // sentinel for cells outside the octagon

// --- Octagon validity check ---
function isInsideOctagon(r, c) {
    var M = BOARD_ROWS - 1; // 13
    var cut = OCTAGON_CUT - 1; // 3
    return (r + c >= cut) &&
           (r + (M - c) >= cut) &&
           ((M - r) + c >= cut) &&
           ((M - r) + (M - c) >= cut);
}

function isDungeonCell(r, c) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    return !isInsideOctagon(r, c);
}

function isValidDungeonCellForCorner(r, c, dungeonId) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    var M = BOARD_ROWS - 1;
    var cut = OCTAGON_CUT;

    switch(dungeonId) {
        case 'NW': return (r + c < cut);
        case 'NE': return (r + (M - c) < cut);
        case 'SW': return ((M - r) + c < cut);
        case 'SE': return ((M - r) + (M - c) < cut);
        default: return false;
    }
}

function isValidCell(r, c) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    return isInsideOctagon(r, c) || isDungeonCell(r, c);
}

function createEmptyGrid() {
    var grid = [];
    for (var r = 0; r < BOARD_ROWS; r++) {
        grid[r] = [];
        for (var c = 0; c < BOARD_COLS; c++) {
            // Celle giocabili: dentro l'ottagono O nei dungeon agli angoli
            grid[r][c] = (isInsideOctagon(r, c) || isDungeonCell(r, c)) ? null : GRID_BLOCKED;
        }
    }
    return grid;
}

function chebyshevDist(r1, c1, r2, c2) {
    return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
}

function isCellOccupied(grid, r, c) {
    return !isValidCell(r, c) || grid[r][c] !== null;
}

function cellToPixel(r, c) {
    // In 3D mode, project the world position to screen coordinates
    if (typeof cellToWorld === 'function' && typeof worldToScreen === 'function' && typeof threeCamera !== 'undefined' && threeCamera) {
        var wPos = cellToWorld(r, c);
        return worldToScreen(wPos);
    }
    // 2D fallback
    return {
        x: BOARD_OFFSET_X + c * CELL_SIZE + CELL_SIZE / 2,
        y: BOARD_OFFSET_Y + r * CELL_SIZE + CELL_SIZE / 2,
    };
}

function pixelToCell(px, py) {
    // In 3D mode, use raycasting
    if (typeof screenToCell === 'function' && typeof threeCamera !== 'undefined' && threeCamera) {
        return screenToCell(px, py);
    }
    // 2D fallback
    var c = Math.floor((px - BOARD_OFFSET_X) / CELL_SIZE);
    var r = Math.floor((py - BOARD_OFFSET_Y) / CELL_SIZE);
    if (isValidCell(r, c)) return { r: r, c: c };
    return null;
}

function getNeighbors(r, c) {
    var neighbors = [];
    for (var dr = -1; dr <= 1; dr++) {
        for (var dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            var nr = r + dr;
            var nc = c + dc;
            if (isValidCell(nr, nc)) neighbors.push({ r: nr, c: nc });
        }
    }
    return neighbors;
}

function bestStepToward(fromR, fromC, toR, toC, grid, unitId) {
    var neighbors = getNeighbors(fromR, fromC);
    var bestCell = null;
    var bestDist = chebyshevDist(fromR, fromC, toR, toC);
    for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        if (grid[n.r][n.c] !== null && grid[n.r][n.c] !== unitId) continue;
        var d = chebyshevDist(n.r, n.c, toR, toC);
        if (d < bestDist) { bestDist = d; bestCell = n; }
    }
    return bestCell;
}

function findSlideCell(r, c, targetR, targetC, grid) {
    var neighbors = getNeighbors(r, c);
    var bestCell = null;
    var bestDist = Infinity;
    for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i];
        if (grid[n.r][n.c] !== null) continue;
        var d = chebyshevDist(n.r, n.c, targetR, targetC);
        if (d < bestDist) { bestDist = d; bestCell = n; }
    }
    return bestCell;
}

function findFreeCellAdjacentTo(r, c, grid) {
    var neighbors = getNeighbors(r, c);
    for (var i = neighbors.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = neighbors[i]; neighbors[i] = neighbors[j]; neighbors[j] = tmp;
    }
    for (var i = 0; i < neighbors.length; i++) {
        if (grid[neighbors[i].r][neighbors[i].c] === null) return neighbors[i];
    }
    return null;
}

// --- Deploy Zones (built dynamically from octagon shape) ---
// DEPLOY_ZONES stores cell arrays computed at load time.
// We cannot call isInsideOctagon at const-definition time since BOARD_ROWS
// isn't available yet in some environments, so we build lazily.

var _deployZonesCache = null;

function _buildDeployZones() {
    var M = BOARD_ROWS - 1;
    var DEPTH = 4;   // cells deep from each edge
    var LEN   = 20;  // cells along each edge
    var lo = Math.floor((BOARD_COLS - LEN) / 2);  // = 23  first col/row of the strip
    var hi = lo + LEN - 1;                         // = 42  last  col/row of the strip
    var zones = {};

    // Player 0: SOUTH (bottom DEPTH rows, centered LEN cols)
    var south = [];
    for (var r = M - DEPTH + 1; r <= M; r++)
        for (var c = lo; c <= hi; c++)
            if (isInsideOctagon(r, c) && !isCreepCampCell(r, c))
                south.push({r: r, c: c});
    zones[0] = { cells: south, label: 'SUD', facing: -1 };

    // Player 1: NORTH (top DEPTH rows, centered LEN cols)
    var north = [];
    for (var r = 0; r <= DEPTH - 1; r++)
        for (var c = lo; c <= hi; c++)
            if (isInsideOctagon(r, c) && !isCreepCampCell(r, c))
                north.push({r: r, c: c});
    zones[1] = { cells: north, label: 'NORD', facing: 1 };

    // Player 2: WEST (left DEPTH cols, centered LEN rows)
    var west = [];
    for (var c = 0; c <= DEPTH - 1; c++)
        for (var r = lo; r <= hi; r++)
            if (isInsideOctagon(r, c) && !isCreepCampCell(r, c))
                west.push({r: r, c: c});
    zones[2] = { cells: west, label: 'OVEST', facing: 1 };

    // Player 3: EAST (right DEPTH cols, centered LEN rows)
    var east = [];
    for (var c = M - DEPTH + 1; c <= M; c++)
        for (var r = lo; r <= hi; r++)
            if (isInsideOctagon(r, c) && !isCreepCampCell(r, c))
                east.push({r: r, c: c});
    zones[3] = { cells: east, label: 'EST', facing: -1 };

    return zones;
}

function getDeployZones() {
    if (!_deployZonesCache) _deployZonesCache = _buildDeployZones();
    return _deployZonesCache;
}

function getDeployZone(playerIndex) {
    return getDeployZones()[playerIndex] || null;
}

function isDeployZone(r, c, playerIndex) {
    var zone = getDeployZone(playerIndex);
    if (!zone) return false;
    for (var i = 0; i < zone.cells.length; i++) {
        if (zone.cells[i].r === r && zone.cells[i].c === c) return true;
    }
    return false;
}

function getDeployZoneOwner(r, c) {
    var zones = getDeployZones();
    for (var i = 0; i < 4; i++) {
        if (isDeployZone(r, c, i)) return i;
    }
    return -1;
}

// --- Creep Camp helpers ---
function isCreepCampCell(r, c) {
    for (var key in CREEP_CAMP_POSITIONS) {
        var cells = CREEP_CAMP_POSITIONS[key];
        for (var i = 0; i < cells.length; i++) {
            if (cells[i].r === r && cells[i].c === c) return true;
        }
    }
    return false;
}

function getCreepCampId(r, c) {
    for (var key in CREEP_CAMP_POSITIONS) {
        var cells = CREEP_CAMP_POSITIONS[key];
        for (var i = 0; i < cells.length; i++) {
            if (cells[i].r === r && cells[i].c === c) return key;
        }
    }
    return null;
}

function getBoardCenter() {
    return { r: Math.floor(BOARD_ROWS / 2), c: Math.floor(BOARD_COLS / 2) };
}
