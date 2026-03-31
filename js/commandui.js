// ============================================================
// LOTA AUTO CHESS — commandui.js — AAA Command Interface
// Combat Log, Toast Notifications, Phase Banners, Event Feed
// ============================================================

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
var toastQueue = [];
var TOAST_MAX = 5;
var TOAST_DURATION = 3000;

function showToast(message, type, icon) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');

    var iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon || getToastIcon(type);
    toast.appendChild(iconEl);

    var textEl = document.createElement('span');
    textEl.className = 'toast-text';
    textEl.textContent = message;
    toast.appendChild(textEl);

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
        toast.classList.add('toast-show');
    });

    // Limit visible toasts
    var toasts = container.querySelectorAll('.toast');
    while (toasts.length > TOAST_MAX) {
        container.removeChild(toasts[0]);
        toasts = container.querySelectorAll('.toast');
    }

    // Auto-dismiss
    setTimeout(function() {
        toast.classList.add('toast-hide');
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
    }, TOAST_DURATION);
}

function getToastIcon(type) {
    switch (type) {
        case 'damage': return '⚔';
        case 'heal': return '💚';
        case 'gold': return '💰';
        case 'item': return '🎁';
        case 'skill': return '✨';
        case 'death': return '💀';
        case 'buff': return '⬆';
        case 'debuff': return '⬇';
        case 'trap': return '🪤';
        case 'warning': return '⚠';
        case 'success': return '✓';
        case 'error': return '✕';
        default: return 'ℹ';
    }
}

// =============================================
// COMBAT LOG SYSTEM
// =============================================
var combatLogLastIndex = 0;
var combatLogVisible = true;
var combatLogScrollPaused = false;
var combatLogFilters = { skill: true, death: true, heal: true };
var combatLogNewCount = 0;

function initCombatLog() {
    combatLogLastIndex = 0;
    combatLogNewCount = 0;
    var entries = document.getElementById('combat-log-entries');
    if (entries) entries.innerHTML = '';
    var badge = document.getElementById('combat-log-new-badge');
    if (badge) badge.classList.remove('active');
}

function updateCombatLog() {
    if (typeof combatLog === 'undefined' || !combatLog) return;
    var entries = document.getElementById('combat-log-entries');
    if (!entries) return;

    var addedNew = false;
    while (combatLogLastIndex < combatLog.length) {
        var text = combatLog[combatLogLastIndex];
        combatLogLastIndex++;

        var logClass = classifyLogEntry(text);
        var entry = document.createElement('div');
        entry.className = 'log-entry ' + logClass;
        entry.setAttribute('data-log-type', logClass.replace('log-', ''));

        // Apply filter visibility
        var filterType = logClass.replace('log-', '');
        if (combatLogFilters[filterType] === false) {
            entry.style.display = 'none';
        }

        var tick = document.createElement('span');
        tick.className = 'log-tick';
        tick.textContent = (typeof combatTick !== 'undefined' ? combatTick : '?');
        entry.appendChild(tick);

        var icon = document.createElement('span');
        icon.className = 'log-icon';
        icon.textContent = getLogIcon(text);
        entry.appendChild(icon);

        var msg = document.createElement('span');
        msg.className = 'log-msg';
        msg.textContent = text;
        entry.appendChild(msg);

        entries.appendChild(entry);
        addedNew = true;
    }

    // Auto-scroll (unless paused)
    if (addedNew) {
        var container = document.getElementById('combat-log-scroll');
        if (container && !combatLogScrollPaused) {
            container.scrollTop = container.scrollHeight;
        } else if (combatLogScrollPaused) {
            combatLogNewCount++;
            var badge = document.getElementById('combat-log-new-badge');
            if (badge) {
                badge.textContent = combatLogNewCount + ' NUOVI';
                badge.classList.add('active');
            }
        }
    }
}

function classifyLogEntry(text) {
    var t = text.toLowerCase();
    if (t.indexOf('usa ') !== -1 || t.indexOf('skill') !== -1 || t.indexOf('attiva') !== -1 || t.indexOf('eco di') !== -1) return 'log-skill';
    if (t.indexOf('tesi') !== -1) return 'log-skill';
    if (t.indexOf('furia') !== -1) return 'log-buff';
    if (t.indexOf('maledizione') !== -1 || t.indexOf('veleno') !== -1 || t.indexOf('debuff') !== -1) return 'log-debuff';
    if (t.indexOf('kill') !== -1 || t.indexOf('morte') !== -1 || t.indexOf('sconfigge') !== -1) return 'log-death';
    if (t.indexOf('cura') !== -1 || t.indexOf('heal') !== -1 || t.indexOf('regen') !== -1 || t.indexOf('respawn') !== -1) return 'log-heal';
    if (t.indexOf('oro') !== -1 || t.indexOf('gold') !== -1 || (t.indexOf('+') !== -1 && t.indexOf('g ') !== -1)) return 'log-gold';
    if (t.indexOf('trappola') !== -1) return 'log-trap';
    if (t.indexOf('amici') !== -1 || t.indexOf('atk') !== -1) return 'log-buff';
    if (t.indexOf('caos') !== -1 || t.indexOf('spread') !== -1) return 'log-debuff';
    return 'log-default';
}

function getLogIcon(text) {
    var t = text.toLowerCase();
    if (t.indexOf('usa ') !== -1 || t.indexOf('skill') !== -1) return '✦';
    if (t.indexOf('tesi') !== -1) return '📜';
    if (t.indexOf('furia') !== -1) return '🔥';
    if (t.indexOf('maledizione') !== -1) return '💀';
    if (t.indexOf('veleno') !== -1) return '🟢';
    if (t.indexOf('kill') !== -1 || t.indexOf('sconfigge') !== -1) return '⚔';
    if (t.indexOf('cura') !== -1 || t.indexOf('respawn') !== -1) return '💚';
    if (t.indexOf('oro') !== -1 || t.indexOf('gold') !== -1) return '💰';
    if (t.indexOf('trappola') !== -1) return '🪤';
    if (t.indexOf('amici') !== -1) return '👥';
    if (t.indexOf('attiva') !== -1) return '⚡';
    return '•';
}

function toggleCombatLog() {
    combatLogVisible = !combatLogVisible;
    var panel = document.getElementById('combat-log');
    if (panel) {
        if (combatLogVisible) panel.classList.add('active');
        else panel.classList.remove('active');
    }
    // Sync toolbar icon
    var toolbarBtn = document.getElementById('btn-toggle-log');
    if (toolbarBtn) toolbarBtn.classList.toggle('active', combatLogVisible);
}

// =============================================
// PHASE BANNER SYSTEM
// =============================================
var phaseBannerTimeout = null;

function showPhaseBanner(text, subtext, color) {
    var banner = document.getElementById('phase-banner');
    if (!banner) return;

    var titleEl = document.getElementById('phase-banner-title');
    var subEl = document.getElementById('phase-banner-sub');

    if (titleEl) {
        titleEl.textContent = text;
        titleEl.style.color = color || '#e2e8f0';
    }
    if (subEl) subEl.textContent = subtext || '';

    banner.classList.add('active');

    if (phaseBannerTimeout) clearTimeout(phaseBannerTimeout);
    phaseBannerTimeout = setTimeout(function() {
        banner.classList.remove('active');
    }, 1200);
}

// =============================================
// UNIT INFO CARD (selected unit detail)
// =============================================
function showUnitInfoCard(unit) {
    var card = document.getElementById('unit-info-card');
    if (!card || !unit) return;

    var charDef = typeof CHARACTERS !== 'undefined' ? CHARACTERS[unit.charId] : null;
    var colors = typeof CHAR_COLORS !== 'undefined' ? (CHAR_COLORS[unit.charId] || { fill: '#888', stroke: '#555' }) : { fill: '#888', stroke: '#555' };

    var html = '';

    // Header
    html += '<div class="uic-header" style="border-color:' + colors.stroke + '">';
    html += '<div class="uic-name" style="color:' + colors.fill + '">' + (charDef ? charDef.displayName : unit.charId) + '</div>';
    html += '<div class="uic-star">' + '\u2605'.repeat(Math.min(unit.star, 5)) + '</div>';
    html += '<div class="uic-class">' + (unit.unitClass || '') + ' / ' + (unit.race || '') + '</div>';
    html += '</div>';

    // HP Bar
    var hpRatio = unit.maxHp > 0 ? (unit.hp / unit.maxHp) : 0;
    var hpColor = hpRatio > 0.6 ? '#34d399' : (hpRatio > 0.3 ? '#fbbf24' : '#ef4444');
    html += '<div class="uic-hp-wrap">';
    html += '<div class="uic-hp-bar"><div class="uic-hp-fill" style="width:' + (hpRatio * 100) + '%;background:' + hpColor + '"></div></div>';
    html += '<div class="uic-hp-text">' + unit.hp + ' / ' + unit.maxHp + '</div>';
    html += '</div>';

    // Stats grid
    html += '<div class="uic-stats">';
    html += '<div class="uic-stat"><span class="uic-stat-icon">⚔</span><span>' + unit.atk + '</span></div>';
    html += '<div class="uic-stat"><span class="uic-stat-icon">🛡</span><span>' + unit.armor + '</span></div>';
    html += '<div class="uic-stat"><span class="uic-stat-icon">⚡</span><span>' + (unit.atkSpeed || 1).toFixed(1) + '</span></div>';
    html += '<div class="uic-stat"><span class="uic-stat-icon">🎯</span><span>' + unit.range + '</span></div>';
    html += '</div>';

    // Survival bonuses
    if (unit.survivalCount > 0) {
        var bonusDef = typeof SURVIVAL_BONUSES !== 'undefined' ? SURVIVAL_BONUSES[unit.charId] : null;
        html += '<div class="uic-section">';
        html += '<div class="uic-section-title">Sopravvivenze: ' + unit.survivalCount + '</div>';
        if (bonusDef) html += '<div class="uic-section-desc">' + bonusDef.desc + '</div>';
        html += '</div>';
    }

    // Items
    if (unit.items && unit.items.length > 0) {
        html += '<div class="uic-section"><div class="uic-section-title">Item (' + unit.items.length + '/3)</div>';
        for (var i = 0; i < unit.items.length; i++) {
            var item = typeof ITEMS !== 'undefined' ? ITEMS[unit.items[i]] : null;
            if (item) {
                html += '<div class="uic-item tier-' + item.tier + '">' + item.name + '</div>';
            }
        }
        html += '</div>';
    }

    // Equipped skills
    if (unit.equippedSkills && unit.equippedSkills.length > 0) {
        html += '<div class="uic-section"><div class="uic-section-title">Skill (' + unit.equippedSkills.length + '/3)</div>';
        for (var s = 0; s < unit.equippedSkills.length; s++) {
            var sk = typeof SKILLS !== 'undefined' ? SKILLS[unit.equippedSkills[s]] : null;
            if (sk) {
                var cdLeft = (unit.skillCooldowns && unit.skillCooldowns[unit.equippedSkills[s]]) ? unit.skillCooldowns[unit.equippedSkills[s]] : 0;
                html += '<div class="uic-skill">';
                html += '<span class="uic-skill-icon">' + sk.icon + '</span>';
                html += '<span>' + sk.name + '</span>';
                if (cdLeft > 0) html += '<span class="uic-skill-cd">' + cdLeft + 'r</span>';
                else html += '<span class="uic-skill-ready">OK</span>';
                html += '</div>';
            }
        }
        html += '</div>';
    }

    // Tactical order
    if (unit.tacticalOrder && unit.tacticalOrder !== 'free' && typeof TACTICAL_ORDERS !== 'undefined') {
        var orderDef = TACTICAL_ORDERS[unit.tacticalOrder];
        if (orderDef) {
            html += '<div class="uic-order" style="color:' + orderDef.color + '">' + orderDef.icon + ' ' + orderDef.name + '</div>';
        }
    }

    card.innerHTML = html;
    card.classList.add('active');
}

function hideUnitInfoCard() {
    var card = document.getElementById('unit-info-card');
    if (card) card.classList.remove('active');
}

// =============================================
// COMMAND UI INTEGRATION — hook into game events
// =============================================

// Override/hook combat log display into render loop
var _commandUIInitialized = false;

function initCommandUI() {
    if (_commandUIInitialized) return;
    _commandUIInitialized = true;

    // Toggle button (header)
    var toggleBtn = document.getElementById('combat-log-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            toggleCombatLog();
        });
    }
    // Toolbar log icon
    var toolbarLogBtn = document.getElementById('btn-toggle-log');
    if (toolbarLogBtn) {
        toolbarLogBtn.addEventListener('click', function() {
            toggleCombatLog();
        });
    }

    // Pause auto-scroll button
    var pauseBtn = document.getElementById('combat-log-pause');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', function() {
            combatLogScrollPaused = !combatLogScrollPaused;
            pauseBtn.classList.toggle('active', combatLogScrollPaused);
            pauseBtn.innerHTML = combatLogScrollPaused ? '&#x25B6;' : '&#x23F8;';
            var logEl = document.getElementById('combat-log');
            if (logEl) logEl.classList.toggle('scroll-paused', combatLogScrollPaused);
            // If un-pausing, scroll to bottom and clear badge
            if (!combatLogScrollPaused) {
                var container = document.getElementById('combat-log-scroll');
                if (container) container.scrollTop = container.scrollHeight;
                combatLogNewCount = 0;
                var badge = document.getElementById('combat-log-new-badge');
                if (badge) badge.classList.remove('active');
            }
        });
    }

    // Filter buttons
    var filterBtns = document.querySelectorAll('.combat-log-controls button[data-filter]');
    for (var i = 0; i < filterBtns.length; i++) {
        filterBtns[i].addEventListener('click', function() {
            var filterType = this.getAttribute('data-filter');
            combatLogFilters[filterType] = !combatLogFilters[filterType];
            this.classList.toggle('active', combatLogFilters[filterType]);
            // Show/hide matching entries
            var entriesEl = document.getElementById('combat-log-entries');
            if (entriesEl) {
                var logEntries = entriesEl.querySelectorAll('.log-entry');
                for (var j = 0; j < logEntries.length; j++) {
                    var type = logEntries[j].getAttribute('data-log-type');
                    if (type === filterType) {
                        logEntries[j].style.display = combatLogFilters[filterType] ? '' : 'none';
                    }
                }
            }
        });
    }
}

// Called from renderFrame each frame
function updateCommandUI(dt) {
    var logPanel = document.getElementById('combat-log');
    if (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT) {
        updateCombatLog();
        // Respect user toggle — only sync panel visibility with combatLogVisible
        if (logPanel) {
            if (combatLogVisible && !logPanel.classList.contains('active')) {
                logPanel.classList.add('active');
            } else if (!combatLogVisible && logPanel.classList.contains('active')) {
                logPanel.classList.remove('active');
            }
        }
    } else {
        // Outside combat: hide panel but preserve user preference
        if (logPanel && logPanel.classList.contains('active')) {
            logPanel.classList.remove('active');
        }
    }
}

// Helper: show toast for consumable usage
function toastConsumableUsed(consumableName) {
    showToast(consumableName + ' utilizzato!', 'success', '✓');
}

// Helper: show toast for shop purchase
function toastShopPurchase(itemName, cost) {
    showToast(itemName + ' acquistato! (-' + cost + 'g)', 'gold', '💰');
}

// Helper: show toast for item equip
function toastItemEquip(itemName, unitName) {
    showToast(itemName + ' equipaggiato su ' + unitName, 'item', '🎁');
}

// Helper: show toast for skill usage
function toastSkillUsed(skillName, unitName) {
    showToast(unitName + ' usa ' + skillName + '!', 'skill', '✨');
}

// Helper: phase banner shortcuts
function showPhaseBannerForPhase(phase) {
    switch (phase) {
        case 'combat':
            showPhaseBanner('COMBATTIMENTO', 'Round ' + (typeof currentRound !== 'undefined' ? currentRound : '?'), '#ef4444');
            break;
        case 'planning':
            showPhaseBanner('PIANIFICAZIONE', 'Premi Pronto! quando sei pronto', '#3b82f6');
            break;
        case 'draft':
            showPhaseBanner('DRAFT', 'Scegli la tua carta', '#a78bfa');
            break;
        case 'result':
            showPhaseBanner('RISULTATO', '', '#fbbf24');
            break;
        case 'pve':
            showPhaseBanner('PvE ROUND', 'Tutti contro il Creep!', '#22c55e');
            break;
    }
}
