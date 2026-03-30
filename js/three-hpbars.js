// ============================================================
// LOTA AUTO CHESS — three-hpbars.js — 3D HP Bars (PlaneGeometry)
// ============================================================
// Uses small PlaneGeometry meshes instead of Sprites for reliability.
// Each unit gets its own canvas texture with HP bar + name + effects.

var HP_TEX_W = 128;
var HP_TEX_H = 32;

function createHpBarSprite3D() {
    // offscreen canvas
    var c = document.createElement('canvas');
    c.width  = HP_TEX_W;
    c.height = HP_TEX_H;

    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;

    var mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // PlaneGeometry in world units — 0.9 wide, 0.22 tall (larger for readability)
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), mat);
    plane.name = 'hpBar';
    plane.renderOrder = 1000;
    plane.frustumCulled = false;

    plane.userData = {
        canvas:  c,
        ctx:     c.getContext('2d'),
        texture: tex
    };

    return plane;
}

var _hpBarParentQuat = null; // reusable quaternion to avoid GC

function updateHpBarSprite3D(bar, unit) {
    if (!bar || !bar.userData || !bar.userData.ctx) return;

    // billboard: always face camera, compensating for parent rotation
    if (threeCamera && bar.parent) {
        if (!_hpBarParentQuat) _hpBarParentQuat = new THREE.Quaternion();
        bar.parent.getWorldQuaternion(_hpBarParentQuat);
        _hpBarParentQuat.invert();
        bar.quaternion.copy(_hpBarParentQuat).multiply(threeCamera.quaternion);
    }

    var c   = bar.userData.ctx;
    var w   = HP_TEX_W;
    var h   = HP_TEX_H;
    var pad = 2;

    c.clearRect(0, 0, w, h);

    // ── character name (top row) ──
    var charDef = CHARACTERS[unit.charId];
    var displayName = charDef ? charDef.displayName : (unit.creepName || unit.charId);
    c.font = 'bold 10px sans-serif';
    c.fillStyle = '#e2e8f0';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(displayName, w / 2, 0);

    // ── HP bar background ──
    var barY = 13;
    var barH = 10;
    var barX = pad;
    var barW = w - pad * 2;

    c.fillStyle = 'rgba(0,0,0,0.7)';
    _roundRect(c, barX, barY, barW, barH, 3);
    c.fill();

    // ── HP fill ──
    var ratio = clamp(unit.hp / unit.maxHp, 0, 1);
    var col   = ratio > 0.6 ? '#34d399' : (ratio > 0.3 ? '#fbbf24' : '#ef4444');

    if (ratio > 0) {
        // gradient fill
        var grad = c.createLinearGradient(barX, barY, barX, barY + barH);
        grad.addColorStop(0, col);
        grad.addColorStop(1, _darken(col));
        c.fillStyle = grad;
        _roundRect(c, barX + 1, barY + 1, (barW - 2) * ratio, barH - 2, 2);
        c.fill();
    }

    // ── shield ──
    if (unit.shield > 0) {
        var sr = clamp(unit.shield / unit.maxHp, 0, 1 - ratio);
        c.fillStyle = 'rgba(180,200,220,0.5)';
        c.fillRect(barX + 1 + (barW - 2) * ratio, barY + 1, (barW - 2) * sr, barH - 2);
    }

    // ── border ──
    c.strokeStyle = '#475569';
    c.lineWidth = 1;
    _roundRect(c, barX, barY, barW, barH, 3);
    c.stroke();

    // ── HP text ──
    c.font = 'bold 8px sans-serif';
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(Math.ceil(unit.hp) + '/' + unit.maxHp, w / 2, barY + barH / 2);

    // ── status effect icons (bottom row) ──
    if (unit.effects && unit.effects.length > 0) {
        var iconX = w / 2 - (unit.effects.length * 7);
        c.font = '8px sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'top';
        var drawn = {};
        for (var i = 0; i < unit.effects.length && i < 6; i++) {
            var eff = unit.effects[i];
            if (drawn[eff.type]) continue;
            drawn[eff.type] = true;
            var icon = '';
            var ic = '#fff';
            switch (eff.type) {
                case 'poison':           icon = '\u2620'; ic = '#22c55e'; break;
                case 'slow':
                case 'speed_reduction':  icon = '\u23F3'; ic = '#60a5fa'; break;
                case 'freeze':           icon = '\u2744'; ic = '#93c5fd'; break;
                case 'silence':          icon = '\u2715'; ic = '#f472b6'; break;
                case 'atk_reduction':    icon = '\u2193'; ic = '#ef4444'; break;
                case 'shield':           icon = '\u25C8'; ic = '#93c5fd'; break;
                default:                 icon = '\u25CF'; ic = '#94a3b8'; break;
            }
            c.fillStyle = ic;
            c.fillText(icon, iconX, barY + barH + 1);
            iconX += 14;
        }
    }

    // mark texture dirty
    bar.userData.texture.needsUpdate = true;
}

// ── Helpers ──

function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function _darken(hex) {
    var c = parseInt(hex.slice(1), 16);
    var r = Math.max(0, ((c >> 16) & 0xff) - 40);
    var g = Math.max(0, ((c >> 8)  & 0xff) - 40);
    var b = Math.max(0, ( c        & 0xff) - 40);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
