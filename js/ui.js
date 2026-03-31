// ============================================================
// LOTA AUTO CHESS — ui.js — DOM UI management (4-player)
// ============================================================

// Helper: escape HTML to prevent XSS
function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// Helper: always returns the local human player regardless of slot index
function getHumanPlayer() {
    // players[0] is ALWAYS the local human player (remapped in startNewGame)
    return players ? players[0] : null;
}

// --- Side Panel Tab System ---
var _spActiveTab = 'gioco';
var _spPanelOpen = false;

function initSidePanelTabs() {
    // Icon toolbar buttons
    var icons = document.querySelectorAll('#icon-toolbar .toolbar-icon[data-panel]');
    for (var i = 0; i < icons.length; i++) {
        icons[i].addEventListener('click', function() {
            var panelId = this.getAttribute('data-panel');
            if (!panelId) return;
            _toggleSidePanel(panelId);
        });
    }
    // Also support old tab buttons (backward compat)
    var tabs = document.querySelectorAll('#sp-tabs .sp-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function() {
            var tabId = this.getAttribute('data-tab');
            _switchSPTab(tabId);
        });
    }
}

function _toggleSidePanel(panelId) {
    var sidePanel = document.getElementById('side-panel');
    if (!sidePanel) return;

    if (_spPanelOpen && _spActiveTab === panelId) {
        // Same icon clicked again — close panel
        sidePanel.classList.remove('active');
        _spPanelOpen = false;
        _updateToolbarIcons(null);
    } else {
        // Open panel with this tab
        _switchSPTab(panelId);
        sidePanel.classList.add('active');
        _spPanelOpen = true;
        _updateToolbarIcons(panelId);
    }
}

function _updateToolbarIcons(activePanel) {
    var icons = document.querySelectorAll('#icon-toolbar .toolbar-icon[data-panel]');
    for (var i = 0; i < icons.length; i++) {
        icons[i].classList.toggle('active', icons[i].getAttribute('data-panel') === activePanel);
    }
}

function _switchSPTab(tabId) {
    _spActiveTab = tabId;
    var tabs = document.querySelectorAll('#sp-tabs .sp-tab');
    var contents = document.querySelectorAll('.sp-tab-content');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabId);
    }
    for (var i = 0; i < contents.length; i++) {
        contents[i].classList.toggle('active', contents[i].id === 'sp-tab-' + tabId);
    }
    _updateToolbarIcons(tabId);
}

// Auto-switch to relevant tab on certain actions
function _autoSwitchTab(tabId) {
    if (_spActiveTab !== tabId) _switchSPTab(tabId);
    // Also open the panel if it's closed
    var sidePanel = document.getElementById('side-panel');
    if (sidePanel && !_spPanelOpen) {
        sidePanel.classList.add('active');
        _spPanelOpen = true;
    }
}

// --- Overlay management ---

function showOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function hideOverlay(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function hideAllOverlays() {
    var overlays = document.querySelectorAll('.overlay');
    for (var i = 0; i < overlays.length; i++) {
        overlays[i].classList.remove('active');
    }
}

// --- HUD updates ---

function updateHUD(player, round) {
    var elRound = document.getElementById('hud-round');
    var elPhase = document.getElementById('hud-phase');
    var elGold = document.getElementById('hud-gold');
    var elHp = document.getElementById('hud-hp');
    var elTotalGold = document.getElementById('hud-total-gold');
    var elSynergies = document.getElementById('hud-synergies');

    if (elRound) elRound.textContent = round || currentRound;
    if (elPhase) {
        var phaseLabels = {};
        phaseLabels[PHASE_MENU] = 'MENU';
        phaseLabels[PHASE_PLANNING] = 'PIANIFICAZIONE';
        phaseLabels[PHASE_DRAFT] = 'DRAFT';
        phaseLabels[PHASE_COMBAT] = 'COMBATTIMENTO';
        phaseLabels[PHASE_RESULT] = 'RISULTATO';
        phaseLabels[PHASE_GAME_OVER] = 'FINE PARTITA';
        elPhase.textContent = phaseLabels[gamePhase] || gamePhase;
    }

    if (player) {
        if (elGold) elGold.textContent = Math.floor(player.gold * 10) / 10;
        if (elHp) elHp.textContent = player.hp;
        if (elTotalGold) elTotalGold.textContent = Math.floor(player.totalGoldEarned * 10) / 10;
    }

    // Synergy badges
    if (elSynergies && player) {
        elSynergies.innerHTML = '';
        var activeSynergies = typeof detectSynergies === 'function' ? detectSynergies(player) : [];
        for (var i = 0; i < activeSynergies.length; i++) {
            var syn = activeSynergies[i];
            var badge = document.createElement('span');
            badge.className = 'synergy-badge synergy-' + syn.type;
            badge.textContent = syn.name;
            badge.title = syn.id;
            elSynergies.appendChild(badge);
        }
    }
}

// --- Draft card display ---

function showDraftCards(cards, onChoose) {
    var container = document.getElementById('draft-cards');
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < cards.length; i++) {
        (function(idx) {
            var charId = cards[idx];
            var charDef = CHARACTERS[charId];
            if (!charDef) return;

            var card = document.createElement('div');
            card.className = 'draft-card';

            var colors = CHAR_COLORS[charId] || { fill: '#888', stroke: '#555' };
            card.style.borderColor = colors.stroke;

            var nameEl = document.createElement('div');
            nameEl.className = 'draft-card-name';
            nameEl.textContent = charDef.displayName;
            nameEl.style.color = colors.fill;
            card.appendChild(nameEl);

            var classEl = document.createElement('div');
            classEl.className = 'draft-card-class';
            classEl.textContent = charDef.unitClass + ' / ' + charDef.race;
            card.appendChild(classEl);

            var statsEl = document.createElement('div');
            statsEl.className = 'draft-card-stats';
            var s1 = charDef.stats[0];
            statsEl.innerHTML =
                '<div>HP: ' + s1.hp + ' | ATK: ' + s1.atk + '</div>' +
                '<div>Armor: ' + charDef.armor + ' | Spd: ' + charDef.atkSpeed + '</div>' +
                '<div>Range: ' + charDef.range + '</div>';
            card.appendChild(statsEl);

            var humanPlayer = getHumanPlayer();
            if (humanPlayer) {
                var copies = humanPlayer.ownedCopies[charId] || 0;
                var currentStar = humanPlayer.starLevels[charId] || 0;
                var copiesEl = document.createElement('div');
                copiesEl.className = 'draft-card-copies';
                copiesEl.textContent = 'Copie possedute: ' + copies +
                    (currentStar > 0 ? ' (Stella ' + currentStar + ')' : '');
                card.appendChild(copiesEl);

                var nextStarIdx = currentStar;
                if (nextStarIdx < STAR_COPIES_NEEDED.length && nextStarIdx < charDef.maxStar) {
                    var needed = STAR_COPIES_NEEDED[nextStarIdx];
                    var nextEl = document.createElement('div');
                    nextEl.className = 'draft-card-next';
                    nextEl.textContent = 'Prossima stella: ' + needed + ' copie';
                    card.appendChild(nextEl);
                }
            }

            var poolEl = document.createElement('div');
            poolEl.className = 'draft-card-pool';
            var remaining = cardPool[charId] !== undefined ? cardPool[charId] : '?';
            poolEl.textContent = 'Pool rimanente: ' + remaining;
            card.appendChild(poolEl);

            card.addEventListener('click', function() {
                onChoose(idx);
            });

            container.appendChild(card);
        })(i);
    }

    // "Rifiuta" button — skip draft, gain 1 gold
    var refuseCard = document.createElement('div');
    refuseCard.className = 'draft-card';
    refuseCard.style.borderColor = '#fbbf24';
    refuseCard.style.opacity = '0.85';

    var refuseIcon = document.createElement('div');
    refuseIcon.className = 'draft-card-name';
    refuseIcon.textContent = 'Rifiuta';
    refuseIcon.style.color = '#fbbf24';
    refuseCard.appendChild(refuseIcon);

    var refuseDesc = document.createElement('div');
    refuseDesc.className = 'draft-card-class';
    refuseDesc.textContent = 'Nessuna carta';
    refuseCard.appendChild(refuseDesc);

    var refuseReward = document.createElement('div');
    refuseReward.className = 'draft-card-stats';
    refuseReward.innerHTML = '<div style="font-size:1.5em;margin:12px 0">+1 Oro</div><div style="color:#94a3b8">Rifiuti entrambe le carte e guadagni 1 oro</div>';
    refuseCard.appendChild(refuseReward);

    refuseCard.addEventListener('click', function() {
        onChoose(-1);
    });
    container.appendChild(refuseCard);

    // Show bench with sell option during draft
    _updateDraftBench(cards, onChoose);

    showOverlay('draft-overlay');
}

// Re-draft: sell a unit, then draw a new card to replace it
function _redraftAfterSell(originalCards, onChoose) {
    // Draw one new replacement card
    var newCard = drawCards(1);
    if (!newCard || newCard.length === 0) return;

    var replacementCharId = newCard[0];

    // Replace the draft cards display — show only the new card + refuse
    var container = document.getElementById('draft-cards');
    if (!container) return;
    container.innerHTML = '';

    // Show the new replacement card
    var charDef = CHARACTERS[replacementCharId];
    if (!charDef) return;

    var card = document.createElement('div');
    card.className = 'draft-card';
    var colors = CHAR_COLORS[replacementCharId] || { fill: '#888', stroke: '#555' };
    card.style.borderColor = colors.stroke;

    var nameEl = document.createElement('div');
    nameEl.className = 'draft-card-name';
    nameEl.textContent = charDef.displayName;
    nameEl.style.color = colors.fill;
    card.appendChild(nameEl);

    var classEl = document.createElement('div');
    classEl.className = 'draft-card-class';
    classEl.textContent = charDef.unitClass + ' / ' + charDef.race;
    card.appendChild(classEl);

    var statsEl = document.createElement('div');
    statsEl.className = 'draft-card-stats';
    var s1 = charDef.stats[0];
    statsEl.innerHTML =
        '<div>HP: ' + s1.hp + ' | ATK: ' + s1.atk + '</div>' +
        '<div>Armor: ' + charDef.armor + ' | Spd: ' + charDef.atkSpeed + '</div>' +
        '<div>Range: ' + charDef.range + '</div>';
    card.appendChild(statsEl);

    var humanPlayer = getHumanPlayer();
    if (humanPlayer) {
        var copies = humanPlayer.ownedCopies[replacementCharId] || 0;
        var currentStar = humanPlayer.starLevels[replacementCharId] || 0;
        var copiesEl = document.createElement('div');
        copiesEl.className = 'draft-card-copies';
        copiesEl.textContent = 'Copie possedute: ' + copies +
            (currentStar > 0 ? ' (Stella ' + currentStar + ')' : '');
        card.appendChild(copiesEl);
    }

    var label = document.createElement('div');
    label.className = 'draft-card-next';
    label.style.color = '#22c55e';
    label.textContent = 'NUOVA CARTA (da vendita)';
    card.appendChild(label);

    card.addEventListener('click', function() {
        processDraftChoice(getHumanPlayer(), [replacementCharId], 0);
        onChoose(-99); // signal: already processed
    });
    container.appendChild(card);

    // Refuse button
    var refuseCard = document.createElement('div');
    refuseCard.className = 'draft-card';
    refuseCard.style.borderColor = '#fbbf24';
    refuseCard.style.opacity = '0.85';
    var refuseIcon = document.createElement('div');
    refuseIcon.className = 'draft-card-name';
    refuseIcon.textContent = 'Rifiuta';
    refuseIcon.style.color = '#fbbf24';
    refuseCard.appendChild(refuseIcon);
    var refuseReward = document.createElement('div');
    refuseReward.className = 'draft-card-stats';
    refuseReward.innerHTML = '<div style="font-size:1.3em;margin:10px 0">Tieni l\'oro</div>';
    refuseCard.appendChild(refuseReward);
    refuseCard.addEventListener('click', function() {
        returnCardToPool(replacementCharId);
        onChoose(-99); // signal: already processed
    });
    container.appendChild(refuseCard);

    // Update bench display
    _updateDraftBench([replacementCharId], onChoose);
}

// --- Draft Bench (sell units during draft) ---
function _updateDraftBench(draftCards, onChoose) {
    var benchEl = document.getElementById('draft-bench');
    if (!benchEl) return;
    benchEl.innerHTML = '';

    var human = getHumanPlayer();
    if (!human) return;

    // Gold display
    var goldEl = document.createElement('div');
    goldEl.className = 'draft-bench-title';
    goldEl.style.color = '#fbbf24';
    goldEl.textContent = Math.floor(human.gold) + ' oro';
    benchEl.appendChild(goldEl);

    // --- FIELD SLOTS ---
    var fieldLabel = document.createElement('div');
    fieldLabel.className = 'draft-bench-title';
    fieldLabel.textContent = 'Campo (' + human.fieldUnits.length + '/' + human.unlockedFieldSlots + ')';
    benchEl.appendChild(fieldLabel);

    for (var fi = 0; fi < human.unlockedFieldSlots; fi++) {
        var fUnit = human.fieldUnits[fi] || null;
        if (fUnit) {
            benchEl.appendChild(_createDraftBenchUnit(fUnit, human, draftCards, onChoose));
        } else {
            benchEl.appendChild(_createEmptySlot('campo'));
        }
    }

    // Separator
    var sep = document.createElement('div');
    sep.style.cssText = 'width:2px;height:40px;background:#334155;margin:0 6px;';
    benchEl.appendChild(sep);

    // --- BENCH SLOTS ---
    var benchLabel = document.createElement('div');
    benchLabel.className = 'draft-bench-title';
    benchLabel.textContent = 'Panchina (' + human.benchUnits.length + '/' + human.unlockedBenchSlots + ')';
    benchEl.appendChild(benchLabel);

    for (var bi = 0; bi < human.unlockedBenchSlots; bi++) {
        var bUnit = human.benchUnits[bi] || null;
        if (bUnit) {
            benchEl.appendChild(_createDraftBenchUnit(bUnit, human, draftCards, onChoose));
        } else {
            benchEl.appendChild(_createEmptySlot('panchina'));
        }
    }

    // Locked bench slots
    for (var li = human.unlockedBenchSlots; li < (typeof BENCH_SLOT_COSTS !== 'undefined' ? BENCH_SLOT_COSTS.length : 3); li++) {
        var locked = document.createElement('div');
        locked.className = 'draft-bench-unit';
        locked.style.opacity = '0.4';
        locked.style.cursor = 'default';
        locked.style.borderColor = '#1e293b';
        var lockIcon = document.createElement('div');
        lockIcon.className = 'dbu-icon';
        lockIcon.style.background = '#1e293b';
        lockIcon.textContent = '\uD83D\uDD12';
        locked.appendChild(lockIcon);
        var lockCost = document.createElement('div');
        lockCost.className = 'dbu-sell';
        lockCost.style.color = '#475569';
        lockCost.textContent = (typeof BENCH_SLOT_COSTS !== 'undefined' ? BENCH_SLOT_COSTS[li] : '?') + 'g';
        locked.appendChild(lockCost);
        benchEl.appendChild(locked);
    }
}

function _createDraftBenchUnit(unit, human, draftCards, onChoose) {
    var colors = CHAR_COLORS[unit.charId] || { fill: '#888', stroke: '#555' };
    var el = document.createElement('div');
    el.className = 'draft-bench-unit';

    var icon = document.createElement('div');
    icon.className = 'dbu-icon';
    icon.style.background = colors.fill;
    icon.textContent = unit.charId === 'WMS' ? 'W' : unit.charId[0];
    el.appendChild(icon);

    var name = document.createElement('div');
    name.className = 'dbu-name';
    name.textContent = unit.charId;
    el.appendChild(name);

    var star = document.createElement('div');
    star.className = 'dbu-star';
    star.textContent = '\u2605'.repeat(Math.min(unit.star, 5));
    el.appendChild(star);

    var sellPrice = Math.max(1, unit.star);
    var sell = document.createElement('div');
    sell.className = 'dbu-sell';
    sell.textContent = 'Vendi +' + sellPrice + 'g';
    el.appendChild(sell);

    el.addEventListener('click', function() {
        sellUnitDuringDraft(human, unit, sellPrice);
        _redraftAfterSell(draftCards, onChoose);
    });

    return el;
}

function _createEmptySlot(type) {
    var el = document.createElement('div');
    el.className = 'draft-bench-unit';
    el.style.borderStyle = 'dashed';
    el.style.borderColor = '#334155';
    el.style.cursor = 'default';

    var icon = document.createElement('div');
    icon.className = 'dbu-icon';
    icon.style.background = '#1e293b';
    icon.textContent = '+';
    icon.style.color = '#475569';
    el.appendChild(icon);

    var label = document.createElement('div');
    label.className = 'dbu-name';
    label.style.color = '#475569';
    label.textContent = type === 'campo' ? 'Vuoto' : 'Vuoto';
    el.appendChild(label);

    return el;
}

function sellUnitDuringDraft(player, unit, price) {
    // Remove from field or bench
    var fieldIdx = -1, benchIdx = -1;
    for (var i = 0; i < player.fieldUnits.length; i++) {
        if (player.fieldUnits[i].id === unit.id) { fieldIdx = i; break; }
    }
    if (fieldIdx >= 0) {
        player.fieldUnits.splice(fieldIdx, 1);
    } else {
        for (var i = 0; i < player.benchUnits.length; i++) {
            if (player.benchUnits[i].id === unit.id) { benchIdx = i; break; }
        }
        if (benchIdx >= 0) player.benchUnits.splice(benchIdx, 1);
    }

    // Return card to pool
    if (typeof returnCardToPool === 'function') {
        returnCardToPool(unit.charId);
    }

    // Reduce owned copies
    if (player.ownedCopies[unit.charId]) {
        player.ownedCopies[unit.charId] = Math.max(0, player.ownedCopies[unit.charId] - 1);
    }

    // If no copies left, reset star level
    if ((player.ownedCopies[unit.charId] || 0) <= 0) {
        player.starLevels[unit.charId] = 0;
    }

    // Give gold
    addGold(player, price, true);

    // Remove 3D model if exists
    if (typeof removeUnitModel3D === 'function' && typeof threeUnitModels !== 'undefined' && threeUnitModels[unit.id]) {
        removeUnitModel3D(unit.id);
    }

    if (typeof showToast === 'function') {
        showToast(unit.charId + ' venduto per ' + price + ' oro!', 'info');
    }
    if (typeof playGoldSound === 'function') playGoldSound();
}

// --- Bench display ---

// --- Unit Roster (always visible, clickable) ---
function updateUnitRoster(player) {
    var roster = document.getElementById('unit-roster');
    if (!roster || !player) return;
    roster.innerHTML = '';

    var allUnits = getAllPlayerUnits(player);
    if (allUnits.length === 0) {
        roster.classList.remove('active');
        return;
    }
    roster.classList.add('active');

    for (var i = 0; i < player.fieldUnits.length; i++) {
        var unit = player.fieldUnits[i];
        var colors = (typeof CHAR_COLORS !== 'undefined' && CHAR_COLORS[unit.charId]) ? CHAR_COLORS[unit.charId] : { fill: '#888', stroke: '#555' };
        var isDead = unit._needsRespawn || unit.hp <= 0;
        var isSelected = (typeof selectedFieldUnit !== 'undefined' && selectedFieldUnit === unit.id);

        var card = document.createElement('div');
        card.className = 'roster-card' + (isSelected ? ' selected' : '') + (isDead ? ' dead' : '');

        // Survival badge
        if (unit.survivalCount > 0) {
            var sv = document.createElement('div');
            sv.className = 'roster-survival';
            sv.textContent = unit.survivalCount;
            card.appendChild(sv);
        }

        // Header: icon + name + star
        var header = document.createElement('div');
        header.className = 'roster-header';

        var icon = document.createElement('div');
        icon.className = 'roster-icon';
        icon.style.background = colors.fill;
        icon.style.borderColor = colors.stroke;
        icon.textContent = unit.charId === 'WMS' ? 'W' : unit.charId[0];
        header.appendChild(icon);

        var info = document.createElement('div');
        var nameEl = document.createElement('div');
        nameEl.className = 'roster-name';
        nameEl.textContent = unit.charId;
        info.appendChild(nameEl);
        var starEl = document.createElement('div');
        starEl.className = 'roster-star';
        starEl.textContent = '\u2605'.repeat(Math.min(unit.star, 5));
        info.appendChild(starEl);
        header.appendChild(info);
        card.appendChild(header);

        // HP bar
        var hpRatio = unit.maxHp > 0 ? Math.max(0, unit.hp / unit.maxHp) : 0;
        var hpColor = hpRatio > 0.6 ? '#34d399' : (hpRatio > 0.3 ? '#fbbf24' : '#ef4444');
        var hpBar = document.createElement('div');
        hpBar.className = 'roster-hp-bar';
        var hpFill = document.createElement('div');
        hpFill.className = 'roster-hp-fill';
        hpFill.style.width = (hpRatio * 100) + '%';
        hpFill.style.background = hpColor;
        hpBar.appendChild(hpFill);
        card.appendChild(hpBar);

        var hpText = document.createElement('div');
        hpText.className = 'roster-hp-text';
        hpText.textContent = Math.ceil(unit.hp) + '/' + unit.maxHp;
        card.appendChild(hpText);

        // Bottom row: items + order
        var bottom = document.createElement('div');
        bottom.className = 'roster-bottom';

        var items = document.createElement('div');
        items.className = 'roster-items';
        if (unit.items) {
            for (var j = 0; j < unit.items.length; j++) {
                var itemDef = typeof ITEMS !== 'undefined' ? ITEMS[unit.items[j]] : null;
                var dot = document.createElement('div');
                dot.className = 'roster-item-dot';
                dot.style.background = itemDef ? (itemDef.tier === 3 ? '#fbbf24' : itemDef.tier === 2 ? '#60a5fa' : '#94a3b8') : '#666';
                dot.title = itemDef ? itemDef.name : '';
                items.appendChild(dot);
            }
        }
        bottom.appendChild(items);

        var order = document.createElement('span');
        order.className = 'roster-order';
        if (unit.tacticalOrder && unit.tacticalOrder !== ORDER_FREE) {
            var orderDef = typeof TACTICAL_ORDERS !== 'undefined' ? TACTICAL_ORDERS[unit.tacticalOrder] : null;
            if (orderDef) {
                order.textContent = orderDef.icon;
                order.style.color = orderDef.color;
                order.title = orderDef.name;
            }
        }
        bottom.appendChild(order);
        card.appendChild(bottom);

        // Skill row
        if (unit.equippedSkills && unit.equippedSkills.length > 0) {
            var skills = document.createElement('div');
            skills.className = 'roster-skills';
            for (var s = 0; s < unit.equippedSkills.length; s++) {
                var sk = typeof SKILLS !== 'undefined' ? SKILLS[unit.equippedSkills[s]] : null;
                var skEl = document.createElement('div');
                skEl.className = 'roster-skill';
                var onCd = unit.skillCooldowns && unit.skillCooldowns[unit.equippedSkills[s]] > 0;
                if (onCd) skEl.classList.add('on-cd');
                skEl.textContent = sk ? sk.icon : '?';
                skEl.title = sk ? sk.name + (onCd ? ' (CD)' : '') : '';
                skills.appendChild(skEl);
            }
            card.appendChild(skills);
        }

        // Click handlers
        (function(unitRef, unitId) {
            // Left click = select unit
            card.addEventListener('click', function(e) {
                e.stopPropagation();
                if (gamePhase !== PHASE_PLANNING && gamePhase !== PHASE_COMBAT) return;

                // If we have a consumable/item selected, use it on this unit
                if (selectedConsumableId !== null && gamePhase === PHASE_PLANNING) {
                    var cDef = typeof CONSUMABLES !== 'undefined' ? CONSUMABLES[selectedConsumableId] : null;
                    if (cDef && typeof useConsumable === 'function') {
                        var ok = useConsumable(getHumanPlayer(), selectedConsumableId, unitRef);
                        if (ok) {
                            if (typeof playGoldSound === 'function') playGoldSound();
                            if (typeof toastConsumableUsed === 'function') toastConsumableUsed(cDef.icon + ' ' + cDef.name + ' su ' + unitRef.charId);
                        }
                    }
                    selectedConsumableId = null;
                    updateSidePanel(players);
                    updateUnitRoster(getHumanPlayer());
                    return;
                }

                if (selectedItemId !== null && gamePhase === PHASE_PLANNING) {
                    var fieldIdx = -1;
                    for (var fi = 0; fi < getHumanPlayer().fieldUnits.length; fi++) {
                        if (getHumanPlayer().fieldUnits[fi].id === unitId) { fieldIdx = fi; break; }
                    }
                    if (fieldIdx >= 0) {
                        var eqDef = typeof ITEMS !== 'undefined' ? ITEMS[selectedItemId] : null;
                        if (equipItem(getHumanPlayer(), selectedItemId, fieldIdx)) {
                            if (typeof toastItemEquip === 'function' && eqDef) toastItemEquip(eqDef.name, unitRef.charId);
                        }
                    }
                    selectedItemId = null;
                    updateSidePanel(players);
                    updateUnitRoster(getHumanPlayer());
                    return;
                }

                // Ally-select mode
                if (orderSelectAllyMode) {
                    if (unitId !== orderSelectAllyMode.unitId) {
                        var asCaster = findPlayerUnit(getHumanPlayer(), orderSelectAllyMode.unitId);
                        if (asCaster) asCaster.tacticalTarget = unitId;
                        if (typeof playGoldSound === 'function') playGoldSound();
                        if (typeof showToast === 'function') showToast('Bersaglio: ' + unitRef.charId, 'success', '\u2713');
                    }
                    cancelAllySelectMode();
                    updateUnitRoster(getHumanPlayer());
                    return;
                }

                // Check militia escort pending
                if (typeof _militiaEscortPending !== 'undefined' && _militiaEscortPending) {
                    if (typeof tryAssignMilitiaEscort === 'function') tryAssignMilitiaEscort(unitId);
                    updateUnitRoster(getHumanPlayer());
                    return;
                }

                // Normal: select this unit
                selectedFieldUnit = unitId;
                clearBenchSelection();
                if (typeof showUnitInfoCard === 'function') showUnitInfoCard(unitRef);
                updateUnitRoster(getHumanPlayer());
            });

            // Right click = open order menu + skill panel
            card.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (gamePhase !== PHASE_PLANNING) return;
                selectedFieldUnit = unitId;
                if (typeof showOrderMenu === 'function') showOrderMenu(unitId, e.clientX, e.clientY);
                if (typeof showSkillEquipPanel === 'function') showSkillEquipPanel(unitRef);
                updateUnitRoster(getHumanPlayer());
            });
        })(unit, unit.id);

        roster.appendChild(card);
    }

    // --- Militia cards in roster ---
    if (player.militiaUnits && player.militiaUnits.length > 0) {
        for (var mi = 0; mi < player.militiaUnits.length; mi++) {
            var mUnit = player.militiaUnits[mi];
            var mDef = typeof MILITIA_TYPES !== 'undefined' ? MILITIA_TYPES[mUnit.militiaType] : null;
            if (!mDef) continue;

            var mCard = document.createElement('div');
            mCard.className = 'roster-card militia-roster-card';

            var mHeader = document.createElement('div');
            mHeader.className = 'roster-header';
            var mIcon = document.createElement('div');
            mIcon.className = 'roster-icon';
            mIcon.style.background = mDef.color.fill;
            mIcon.style.borderColor = mDef.color.stroke;
            mIcon.textContent = mDef.icon;
            mIcon.style.fontSize = '12px';
            mHeader.appendChild(mIcon);
            var mInfo = document.createElement('div');
            var mName = document.createElement('div');
            mName.className = 'roster-name';
            mName.textContent = mDef.name;
            mName.style.fontSize = '9px';
            mInfo.appendChild(mName);
            mHeader.appendChild(mInfo);
            mCard.appendChild(mHeader);

            var mHpRatio = mUnit.maxHp > 0 ? Math.max(0, mUnit.hp / mUnit.maxHp) : 0;
            var mHpColor = mHpRatio > 0.6 ? '#34d399' : (mHpRatio > 0.3 ? '#fbbf24' : '#ef4444');
            var mHpBar = document.createElement('div');
            mHpBar.className = 'roster-hp-bar';
            var mHpFill = document.createElement('div');
            mHpFill.className = 'roster-hp-fill';
            mHpFill.style.width = (mHpRatio * 100) + '%';
            mHpFill.style.background = mHpColor;
            mHpBar.appendChild(mHpFill);
            mCard.appendChild(mHpBar);

            var mBottom = document.createElement('div');
            mBottom.className = 'roster-bottom';
            var mOrd = document.createElement('span');
            mOrd.className = 'roster-order';
            var mOrdDef = typeof MILITIA_ORDERS !== 'undefined' ? MILITIA_ORDERS[mUnit.militiaOrder] : null;
            if (mOrdDef) {
                mOrd.textContent = mOrdDef.icon;
                mOrd.style.color = mOrdDef.color;
                mOrd.title = mOrdDef.name;
            }
            mBottom.appendChild(mOrd);
            mCard.appendChild(mBottom);

            // Click on militia card — quick escort re-assignment or select
            (function(mRef) {
                mCard.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // If escort pending, clicking a militia card is invalid
                    if (typeof _militiaEscortPending !== 'undefined' && _militiaEscortPending) {
                        if (typeof showToast === 'function') showToast('Scegli un eroe, non una milizia!', 'warning', '⚠');
                        return;
                    }
                    // Select the militia unit so its order is visible
                    selectedFieldUnit = mRef.id;
                    clearBenchSelection();
                    updateUnitRoster(getHumanPlayer());
                });
            })(mUnit);

            roster.appendChild(mCard);
        }
    }
}

function updateBench(player) {
    if (!player) return;
    // Also refresh the unit roster
    if (typeof updateUnitRoster === 'function') updateUnitRoster(player);
    var benchSlots = document.querySelectorAll('#bench-panel .bench-slot');

    for (var i = 0; i < benchSlots.length; i++) {
        var slot = benchSlots[i];
        var slotIdx = parseInt(slot.getAttribute('data-slot'), 10);
        slot.innerHTML = '';

        if (slotIdx >= player.unlockedBenchSlots) {
            slot.classList.add('locked');
            var lockIcon = document.createElement('span');
            lockIcon.className = 'lock-icon';
            lockIcon.textContent = '\uD83D\uDD12';
            slot.appendChild(lockIcon);

            if (slotIdx < BENCH_SLOT_COSTS.length) {
                var costLabel = document.createElement('span');
                costLabel.className = 'slot-cost';
                costLabel.textContent = BENCH_SLOT_COSTS[slotIdx] + 'g';
                slot.appendChild(costLabel);
            }
            continue;
        }

        slot.classList.remove('locked');
        slot.classList.remove('occupied');

        var unit = player.benchUnits[slotIdx];
        if (unit) {
            slot.classList.add('occupied');
            var colors = CHAR_COLORS[unit.charId] || { fill: '#888', stroke: '#555' };
            var unitEl = document.createElement('div');
            unitEl.className = 'bench-unit';
            unitEl.style.backgroundColor = colors.fill;
            unitEl.style.borderColor = colors.stroke;

            var initial = unit.charId === 'WMS' ? 'W' : unit.charId[0];
            unitEl.textContent = initial;

            var starEl = document.createElement('div');
            starEl.className = 'bench-unit-star';
            starEl.textContent = '\u2605'.repeat(Math.min(unit.star, 5));
            unitEl.appendChild(starEl);

            if (unit.items.length > 0) {
                var itemDots = document.createElement('div');
                itemDots.className = 'bench-unit-items';
                for (var j = 0; j < unit.items.length; j++) {
                    var dot = document.createElement('span');
                    dot.className = 'item-dot';
                    itemDots.appendChild(dot);
                }
                unitEl.appendChild(itemDots);
            }

            slot.appendChild(unitEl);
        }
    }
}

// --- Side panel ---

function updateSidePanel(playersArr, activeSynergies) {
    var playerList = document.getElementById('player-list');
    var synergyList = document.getElementById('synergy-list');
    var itemInventory = document.getElementById('item-inventory');
    var economyActions = document.getElementById('economy-actions');

    // Player list with HP bars and team colors
    if (playerList) {
        playerList.innerHTML = '';
        var sortedPlayers = (playersArr || players).slice().sort(function(a, b) {
            return (b.hp - a.hp) || (a.index - b.index); // stable: by HP then by index
        });
        for (var i = 0; i < sortedPlayers.length; i++) {
            var p = sortedPlayers[i];
            var pSlot = (typeof getPlayerSlot === 'function') ? getPlayerSlot(p) : p.index;
            var row = document.createElement('div');
            row.className = 'player-row team-' + pSlot + (p.eliminated ? ' eliminated' : '') + (p.index === 0 ? ' is-human' : '');

            var nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.textContent = p.name;
            nameSpan.style.color = TEAM_COLORS[pSlot] ? TEAM_COLORS[pSlot].primary : '#e2e8f0';
            row.appendChild(nameSpan);

            var hpBar = document.createElement('div');
            hpBar.className = 'player-hp-bar';
            var hpFill = document.createElement('div');
            hpFill.className = 'player-hp-fill';
            var hpRatio = clamp(p.hp / p.maxHp, 0, 1);
            hpFill.style.width = (hpRatio * 100) + '%';
            if (hpRatio > 0.6) hpFill.style.backgroundColor = COL_HP_GREEN;
            else if (hpRatio > 0.3) hpFill.style.backgroundColor = COL_GOLD;
            else hpFill.style.backgroundColor = COL_HP_RED;
            hpBar.appendChild(hpFill);
            row.appendChild(hpBar);

            var hpLabel = document.createElement('span');
            hpLabel.className = 'player-hp-label';
            hpLabel.textContent = p.hp + '/' + p.maxHp;
            row.appendChild(hpLabel);

            playerList.appendChild(row);
        }
    }

    // Active synergies
    if (synergyList) {
        synergyList.innerHTML = '';
        var synList = activeSynergies || [];
        if (synList.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-message';
            empty.textContent = 'Nessuna sinergia attiva';
            synergyList.appendChild(empty);
        } else {
            for (var i = 0; i < synList.length; i++) {
                var syn = synList[i];
                var badge = document.createElement('div');
                badge.className = 'synergy-item synergy-' + syn.type;
                badge.innerHTML = '<span class="synergy-name">' + syn.name + '</span>' +
                    '<span class="synergy-type">' + syn.type + '</span>';
                synergyList.appendChild(badge);
            }
        }
    }

    // ====================================================================
    //  SELECTED UNIT PANEL — orders & skills (planning phase only)
    // ====================================================================
    var unitPanel = document.getElementById('selected-unit-panel');
    if (unitPanel && players && getHumanPlayer()) {
        unitPanel.innerHTML = '';
        var selSection = document.getElementById('selected-unit-section');
        var humanP = getHumanPlayer();
        var selUnit = null;

        // Find selected field unit (heroes + militia)
        if (gamePhase === PHASE_PLANNING && typeof selectedFieldUnit !== 'undefined' && selectedFieldUnit !== null) {
            selUnit = findPlayerUnit(humanP, selectedFieldUnit);
        }

        if (selUnit && selSection) {
            selSection.style.display = '';
            var charDef = CHARACTERS[selUnit.charId];
            var charColors = CHAR_COLORS[selUnit.charId] || { fill: '#888', stroke: '#555' };
            // Militia/structure color override
            if (selUnit.isMilitia && typeof MILITIA_TYPES !== 'undefined' && MILITIA_TYPES[selUnit.militiaType]) {
                charColors = MILITIA_TYPES[selUnit.militiaType].color;
            }
            if (selUnit.isStructure && typeof STRUCTURE_THEMES !== 'undefined') {
                var sTheme = STRUCTURE_THEMES[selUnit.structureCharId];
                if (sTheme && sTheme[selUnit.structureType]) charColors = sTheme[selUnit.structureType].color;
            }

            // ── Unit header ──
            var header = document.createElement('div');
            header.className = 'sup-header';
            var displayName = charDef ? charDef.displayName : selUnit.charId;
            if (selUnit.isMilitia && typeof MILITIA_TYPES !== 'undefined' && MILITIA_TYPES[selUnit.militiaType]) {
                displayName = MILITIA_TYPES[selUnit.militiaType].name;
            }
            if (selUnit.isStructure && typeof getStructureDef === 'function') {
                var sDef = getStructureDef(selUnit.structureCharId, selUnit.structureType);
                if (sDef) displayName = sDef.icon + ' ' + sDef.name;
            }
            var starHtml = (selUnit.isMilitia || selUnit.isStructure) ? '' : '<span class="sup-star">' + '\u2605'.repeat(selUnit.star) + '</span>';
            header.innerHTML = '<span class="sup-name" style="color:' + charColors.fill + '">' + displayName + '</span>' + starHtml;
            unitPanel.appendChild(header);

            // ── Tactical Order section ──
            var orderTitle = document.createElement('div');
            orderTitle.className = 'sup-subtitle';
            orderTitle.textContent = 'Ordine Tattico';
            unitPanel.appendChild(orderTitle);

            var orderGrid = document.createElement('div');
            orderGrid.className = 'sup-order-grid';

            var orders = typeof TACTICAL_ORDERS !== 'undefined' ? TACTICAL_ORDERS : {};
            for (var ordKey in orders) {
                if (!orders.hasOwnProperty(ordKey)) continue;
                var ord = orders[ordKey];
                var ordBtn = document.createElement('button');
                ordBtn.className = 'sup-order-btn';
                if (selUnit.tacticalOrder === ordKey || (!selUnit.tacticalOrder && ordKey === 'free')) {
                    ordBtn.classList.add('active');
                }
                ordBtn.style.borderColor = ord.color;
                ordBtn.innerHTML = '<span class="sup-order-icon" style="color:' + ord.color + '">' + ord.icon + '</span>' +
                    '<span class="sup-order-label">' + ord.name + '</span>';
                ordBtn.title = ord.desc;

                (function(oKey, oNeedsTarget) {
                    ordBtn.addEventListener('click', function() {
                        if (typeof onOrderChosen === 'function') {
                            onOrderChosen(selUnit.id, oKey, oNeedsTarget);
                        } else {
                            selUnit.tacticalOrder = oKey;
                            if (!oNeedsTarget) selUnit.tacticalTarget = null;
                        }
                        updateSidePanel(players, activeSynergies);
                    });
                })(ordKey, ord.needsTarget);

                orderGrid.appendChild(ordBtn);
            }
            unitPanel.appendChild(orderGrid);

            // ── Skills hint (full panel is on left via right-click) ──
            var skillCount = selUnit.equippedSkills ? selUnit.equippedSkills.length : 0;
            var learnedCount = selUnit.learnedSkills ? Object.keys(selUnit.learnedSkills).length : 0;
            var skillHint = document.createElement('div');
            skillHint.className = 'sup-subtitle';
            skillHint.style.color = '#a78bfa';
            skillHint.textContent = 'Skill: ' + skillCount + '/3 attive | ' + learnedCount + ' imparate';
            unitPanel.appendChild(skillHint);
            var skillTip = document.createElement('div');
            skillTip.className = 'empty-message';
            skillTip.textContent = 'Click destro per gestire e potenziare';
            unitPanel.appendChild(skillTip);

            // ── Equipped items ──
            if (selUnit.items && selUnit.items.length > 0) {
                var itemsTitle = document.createElement('div');
                itemsTitle.className = 'sup-subtitle';
                itemsTitle.textContent = 'Items Equipaggiati';
                unitPanel.appendChild(itemsTitle);

                for (var ii = 0; ii < selUnit.items.length; ii++) {
                    var itm = ITEMS[selUnit.items[ii]];
                    if (!itm) continue;
                    var itmEl = document.createElement('div');
                    itmEl.className = 'sup-item tier-' + itm.tier;
                    itmEl.textContent = itm.name;
                    unitPanel.appendChild(itmEl);
                }
            }
        } else if (selSection) {
            // No unit selected
            if (gamePhase === PHASE_PLANNING) {
                selSection.style.display = '';
                var hint = document.createElement('div');
                hint.className = 'empty-message';
                hint.textContent = 'Clicca un\'unita in campo per gestire ordini e abilita';
                unitPanel.appendChild(hint);
            } else {
                selSection.style.display = 'none';
            }
        }
    }

    // Item inventory — full card view with equip dropdown + equipped overview
    if (itemInventory) {
        itemInventory.innerHTML = '';
        var human = getHumanPlayer();
        var isPlanning = gamePhase === PHASE_PLANNING;

        // --- Section 1: Equipped items per hero ---
        if (human) {
            var hasEquipped = false;
            for (var hi = 0; hi < human.fieldUnits.length; hi++) {
                var hu = human.fieldUnits[hi];
                if (!hu.items || hu.items.length === 0) continue;
                hasEquipped = true;
                var hColors = CHAR_COLORS[hu.charId] || { fill: '#888' };
                var heroLabel = document.createElement('div');
                heroLabel.className = 'item-hero-label';
                heroLabel.innerHTML = '<span style="color:' + hColors.fill + '">' + hu.charId + ' \u2605' + hu.star + '</span> <span style="color:#64748b">(' + hu.items.length + '/' + MAX_ITEMS_PER_UNIT + ')</span>';
                itemInventory.appendChild(heroLabel);
                for (var ei = 0; ei < hu.items.length; ei++) {
                    var eqItem = ITEMS[hu.items[ei]];
                    if (!eqItem) continue;
                    var eqStats = '';
                    if (eqItem.bonusHp) eqStats += '+' + eqItem.bonusHp + 'HP ';
                    if (eqItem.bonusAtk) eqStats += '+' + eqItem.bonusAtk + 'ATK ';
                    if (eqItem.bonusArmor) eqStats += '+' + eqItem.bonusArmor + 'Arm ';
                    var eqEl = document.createElement('div');
                    eqEl.className = 'item-card equipped tier-' + eqItem.tier;
                    eqEl.innerHTML = '<div class="item-card-row"><span class="item-card-name">' + eqItem.name + '</span>' +
                        '<span class="item-card-tier">T' + eqItem.tier + '</span>' +
                        (isPlanning ? '<button class="item-unequip-btn" data-hero="' + hi + '" data-slot="' + ei + '" title="Rimuovi">\u2715</button>' : '') +
                        '</div>' +
                        (eqStats ? '<div class="item-card-stats">' + eqStats.trim() + '</div>' : '');
                    eqEl.title = typeof getItemDescription === 'function' ? getItemDescription(hu.items[ei]) : '';
                    itemInventory.appendChild(eqEl);
                }
            }
            if (hasEquipped) {
                var sep = document.createElement('div');
                sep.className = 'item-section-sep';
                sep.textContent = 'Inventario';
                itemInventory.appendChild(sep);
            }
        }

        // --- Section 2: Unequipped items with equip dropdown ---
        if (human && human.inventory.length > 0) {
            // Build list of eligible heroes (planning only)
            var eligibleHeroes = [];
            if (isPlanning) {
                for (var eh = 0; eh < human.fieldUnits.length; eh++) {
                    var ehu = human.fieldUnits[eh];
                    if (ehu.items.length < MAX_ITEMS_PER_UNIT) {
                        eligibleHeroes.push({ idx: eh, name: ehu.charId, star: ehu.star });
                    }
                }
            }

            for (var i = 0; i < human.inventory.length; i++) {
                var itemId = human.inventory[i];
                var item = ITEMS[itemId];
                if (!item) continue;

                var statsLine = '';
                if (item.bonusHp) statsLine += '+' + item.bonusHp + ' HP ';
                if (item.bonusAtk) statsLine += '+' + item.bonusAtk + ' ATK ';
                if (item.bonusArmor) statsLine += '+' + item.bonusArmor + ' Armor ';
                if (item.bonusCrit) statsLine += '+' + Math.round(item.bonusCrit * 100) + '% Crit ';
                if (item.bonusAtkSpeed) statsLine += '+' + Math.round(item.bonusAtkSpeed * 100) + '% AtkSpd ';

                // Effect description (short)
                var effectLine = '';
                if (item.onHit) effectLine = 'On Hit: ' + (item.onHit.slow ? 'Slow' : item.onHit.poison ? 'Poison' : 'Effetto');
                if (item.onKill) effectLine = 'On Kill: ' + (item.onKill.gold ? '+' + item.onKill.gold + 'g' : 'Stack');
                if (item.passive) effectLine = item.passive;
                if (item.onSurvive) effectLine = 'Sopravvivenza: +' + (item.onSurvive.goldBonus || 0) + 'g';
                if (item.deathPrevention) effectLine = 'Previene morte (1x)';
                if (item.regenPerTick) effectLine = 'Regen: ' + Math.round(item.regenPerTick * 100) + '% HP/tick';

                var cardHtml = '<div class="item-card-row">' +
                    '<span class="item-card-name">' + item.name + '</span>' +
                    '<span class="item-card-tier">T' + item.tier + '</span></div>';
                if (statsLine) cardHtml += '<div class="item-card-stats">' + statsLine.trim() + '</div>';
                if (effectLine) cardHtml += '<div class="item-card-effect">' + effectLine + '</div>';

                // Equip buttons: one per eligible hero
                if (isPlanning && eligibleHeroes.length > 0) {
                    cardHtml += '<div class="item-equip-row">';
                    for (var he = 0; he < eligibleHeroes.length; he++) {
                        var hero = eligibleHeroes[he];
                        var hCol = CHAR_COLORS[hero.name] ? CHAR_COLORS[hero.name].fill : '#888';
                        // Check restriction
                        var restricted = item.restriction === 'WMS_star3' && (hero.name !== 'WMS' || hero.star < 3);
                        cardHtml += '<button class="item-equip-hero-btn' + (restricted ? ' disabled' : '') + '" ' +
                            'data-item-idx="' + i + '" data-hero-idx="' + hero.idx + '" ' +
                            'style="border-color:' + hCol + ';color:' + hCol + '"' +
                            (restricted ? ' disabled' : '') + '>' +
                            hero.name[0] + '\u2605' + hero.star + '</button>';
                    }
                    cardHtml += '</div>';
                }

                var itemEl = document.createElement('div');
                itemEl.className = 'item-card tier-' + item.tier;
                itemEl.innerHTML = cardHtml;
                itemEl.title = typeof getItemDescription === 'function' ? getItemDescription(itemId) : '';
                itemInventory.appendChild(itemEl);
            }
        } else if (!human || human.inventory.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-message';
            empty.textContent = 'Nessun item in inventario';
            itemInventory.appendChild(empty);
        }

        // --- Badge on toolbar icon for Zaino ---
        var zainoIcon = document.querySelector('.toolbar-icon[data-panel="zaino"]');
        if (zainoIcon && human) {
            var invCount = human.inventory.length + human.consumables.length;
            var badge = zainoIcon.querySelector('.toolbar-badge');
            if (invCount > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'toolbar-badge';
                    zainoIcon.appendChild(badge);
                }
                badge.textContent = invCount;
            } else if (badge) {
                badge.remove();
            }
        }

        // Event delegation for item actions
        if (!itemInventory._itemDelegated) {
            itemInventory._itemDelegated = true;
            itemInventory.addEventListener('click', function(e) {
                var target = e.target;

                // Unequip button
                if (target.classList.contains('item-unequip-btn')) {
                    e.stopPropagation();
                    var hi = parseInt(target.getAttribute('data-hero'));
                    var si = parseInt(target.getAttribute('data-slot'));
                    if (!isNaN(hi) && !isNaN(si) && typeof unequipItem === 'function') {
                        unequipItem(getHumanPlayer(), hi, si);
                        if (typeof playGoldSound === 'function') playGoldSound();
                        if (typeof showToast === 'function') showToast('Item rimosso', 'info', '!');
                        updateHUD(getHumanPlayer());
                        updateSidePanel(players);
                        if (typeof updateUnitRoster === 'function') updateUnitRoster(getHumanPlayer());
                    }
                    return;
                }

                // Equip to specific hero button
                if (target.classList.contains('item-equip-hero-btn') && !target.disabled) {
                    e.stopPropagation();
                    var iIdx = parseInt(target.getAttribute('data-item-idx'));
                    var hIdx = parseInt(target.getAttribute('data-hero-idx'));
                    if (isNaN(iIdx) || isNaN(hIdx)) return;
                    var iid = getHumanPlayer().inventory[iIdx];
                    if (!iid) return;
                    if (typeof equipItem === 'function' && equipItem(getHumanPlayer(), iid, hIdx)) {
                        var eqDef = ITEMS[iid];
                        var eqUnit = getHumanPlayer().fieldUnits[hIdx];
                        if (typeof playGoldSound === 'function') playGoldSound();
                        if (typeof showToast === 'function') showToast((eqDef ? eqDef.name : 'Item') + ' equipaggiato su ' + (eqUnit ? eqUnit.charId : '?'), 'success', '!');
                        updateHUD(getHumanPlayer());
                        updateSidePanel(players);
                        if (typeof updateUnitRoster === 'function') updateUnitRoster(getHumanPlayer());
                    } else {
                        if (typeof showToast === 'function') showToast('Non equipaggiabile!', 'warning', '!');
                    }
                    return;
                }
            });
        }
    }

    // Consumables
    var consumablePanel = document.getElementById('consumable-list');
    if (consumablePanel && getHumanPlayer()) {
        consumablePanel.innerHTML = '';
        var human = getHumanPlayer();
        if (human.consumables && human.consumables.length > 0) {
            for (var ci = 0; ci < human.consumables.length; ci++) {
                var cId = human.consumables[ci];
                var cDef = typeof CONSUMABLES !== 'undefined' ? CONSUMABLES[cId] : null;
                if (!cDef) continue;
                var cEl = document.createElement('div');
                cEl.className = 'inventory-item tier-' + cDef.tier;
                cEl.textContent = cDef.icon + ' ' + cDef.name;
                cEl.title = cDef.desc;
                if (gamePhase === PHASE_PLANNING) {
                    (function(consumId) {
                        cEl.style.cursor = 'pointer';
                        cEl.addEventListener('click', function() {
                            selectedConsumableId = consumId;
                            updateSidePanel(players, activeSynergies);
                        });
                    })(cId);
                    if (typeof selectedConsumableId !== 'undefined' && selectedConsumableId === cId) {
                        cEl.classList.add('selected');
                    }
                }
                consumablePanel.appendChild(cEl);
            }
        } else {
            var empty = document.createElement('div');
            empty.className = 'empty-message';
            empty.textContent = 'Nessun consumabile';
            consumablePanel.appendChild(empty);
        }
    }

    // Economy actions
    if (economyActions && getHumanPlayer()) {
        economyActions.innerHTML = '';
        var human = getHumanPlayer();

        if (human.unlockedFieldSlots < FIELD_SLOT_COSTS.length) {
            var cost = FIELD_SLOT_COSTS[human.unlockedFieldSlots];
            var btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.textContent = 'Sblocca Slot Campo (' + cost + 'g)';
            btn.disabled = human.gold < cost || gamePhase !== PHASE_PLANNING;
            btn.addEventListener('click', function() {
                if (unlockFieldSlot(human)) {
                    if (typeof playGoldSound === 'function') playGoldSound();
                    updateHUD(human);
                    updateSidePanel(players);
                }
            });
            economyActions.appendChild(btn);
        }

        if (human.unlockedBenchSlots < BENCH_SLOT_COSTS.length) {
            var cost = BENCH_SLOT_COSTS[human.unlockedBenchSlots];
            var btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.textContent = 'Sblocca Slot Panca (' + cost + 'g)';
            btn.disabled = human.gold < cost || gamePhase !== PHASE_PLANNING;
            btn.addEventListener('click', function() {
                if (unlockBenchSlot(human)) {
                    if (typeof playGoldSound === 'function') playGoldSound();
                    updateHUD(human);
                    updateBench(human);
                    updateSidePanel(players);
                }
            });
            economyActions.appendChild(btn);
        }

        if (human.hp < human.maxHp) {
            var btn = document.createElement('button');
            btn.className = 'btn btn-sm';
            btn.textContent = 'Compra +1 HP (' + HP_PURCHASE_COST + 'g)';
            btn.disabled = human.gold < HP_PURCHASE_COST || gamePhase !== PHASE_PLANNING;
            btn.addEventListener('click', function() {
                if (buyHp(human)) {
                    if (typeof playGoldSound === 'function') playGoldSound();
                    updateHUD(human);
                    updateSidePanel(players);
                }
            });
            economyActions.appendChild(btn);
        }

    }

    // --- Consumable Shop (in Zaino tab, after consumable list) ---
    if (gamePhase === PHASE_PLANNING && typeof getShopConsumables === 'function' && consumablePanel && getHumanPlayer()) {
        var shopTitle = document.createElement('div');
        shopTitle.style.cssText = 'font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:10px 0 4px;border-top:1px solid #2d3748;padding-top:6px';
        shopTitle.textContent = 'Negozio Consumabili';
        consumablePanel.appendChild(shopTitle);

        var shopItems = getShopConsumables(currentRound);
        var human = getHumanPlayer();
        for (var si = 0; si < shopItems.length; si++) {
            var cDef = CONSUMABLES[shopItems[si]];
            if (!cDef) continue;
            var shopBtn = document.createElement('button');
            shopBtn.className = 'btn btn-sm';
            shopBtn.style.cssText = 'width:100%;margin:2px 0;text-align:left;';
            shopBtn.textContent = cDef.icon + ' ' + cDef.name + ' (' + cDef.cost + 'g)';
            shopBtn.title = cDef.desc;
            shopBtn.disabled = human.gold < cDef.cost;
            (function(cId, cName, cCost) {
                shopBtn.addEventListener('click', function() {
                    if (typeof buyConsumable === 'function' && buyConsumable(getHumanPlayer(), cId)) {
                        if (typeof playGoldSound === 'function') playGoldSound();
                        if (typeof toastShopPurchase === 'function') toastShopPurchase(cName, cCost);
                        updateHUD(getHumanPlayer());
                        _autoSwitchTab('zaino');
                        updateSidePanel(players, typeof detectSynergies === 'function' ? detectSynergies(getHumanPlayer()) : []);
                    }
                });
            })(shopItems[si], cDef.name, cDef.cost);
            consumablePanel.appendChild(shopBtn);
        }
    }

    // Building inventory (planning phase only)
    if (gamePhase === PHASE_PLANNING && typeof updateBuildingInventoryUI === 'function' && players && getHumanPlayer()) {
        updateBuildingInventoryUI(getHumanPlayer());
    }

    // Special upgrade panel (planning phase)
    if (typeof renderSpecialUpgradePanel === 'function') {
        renderSpecialUpgradePanel();
    }
    // Militia shop (planning phase)
    if (typeof renderMilitiaShop === 'function' && players && getHumanPlayer()) {
        renderMilitiaShop(getHumanPlayer());
    }
    // Structure shop (planning phase)
    if (typeof renderStructureShop === 'function' && players && getHumanPlayer()) {
        renderStructureShop(getHumanPlayer());
    }
}

// --- Result overlay ---

function showResult(title, details, titleClass) {
    var elTitle = document.getElementById('result-title');
    var elDetails = document.getElementById('result-details');

    if (elTitle) {
        elTitle.textContent = title;
        elTitle.className = 'result-title';
        if (titleClass) elTitle.classList.add(titleClass);
    }
    if (elDetails) {
        elDetails.innerHTML = details || '';
    }

    showOverlay('result-overlay');
}

// --- Game Over screen ---

function showGameOver(winner, playersArr) {
    var elTitle = document.getElementById('gameover-title');
    var elStats = document.getElementById('gameover-stats');

    if (elTitle) {
        if (winner && winner.index === 0) {
            elTitle.textContent = 'HAI VINTO!';
            elTitle.style.color = COL_GOLD;
        } else {
            elTitle.textContent = 'PARTITA FINITA';
            elTitle.style.color = COL_TEXT;
        }
    }

    if (elStats) {
        elStats.innerHTML = '';

        var sorted = (playersArr || players).slice().sort(function(a, b) {
            return b.totalGoldEarned - a.totalGoldEarned;
        });

        var table = document.createElement('table');
        table.className = 'gameover-table';

        var thead = document.createElement('thead');
        thead.innerHTML = '<tr><th>#</th><th>Giocatore</th><th>HP</th><th>Oro Totale</th></tr>';
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        for (var i = 0; i < sorted.length; i++) {
            var p = sorted[i];
            var tr = document.createElement('tr');
            if (p.index === 0) tr.className = 'is-human';
            var teamColor = TEAM_COLORS[p.index] ? TEAM_COLORS[p.index].primary : '#e2e8f0';
            tr.innerHTML =
                '<td>' + (i + 1) + '</td>' +
                '<td style="color:' + teamColor + '">' + escapeHtml(p.name) + '</td>' +
                '<td>' + p.hp + '/' + p.maxHp + '</td>' +
                '<td>' + Math.floor(p.totalGoldEarned * 10) / 10 + '</td>';
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        elStats.appendChild(table);
    }

    showOverlay('gameover-overlay');
}

// --- Tooltip ---

var tooltipVisible = false;

// Helper: get the correct canvas element for mouse events (Three.js or 2D)
function _getInteractionTarget() {
    return (typeof threeCanvas !== 'undefined' && threeCanvas) ? threeCanvas : canvas;
}

// Bridge: convert screen pixel to board cell (2D or 3D)
function _screenToCell(mx, my) {
    // 3D mode: use raycaster
    if (typeof screenToCell === 'function' && typeof threeCanvas !== 'undefined' && threeCanvas) {
        try { return screenToCell(mx, my); } catch (e) { /* fallback to 2D */ }
    }
    // 2D mode: use pixel math
    return typeof pixelToCell === 'function' ? pixelToCell(mx, my) : null;
}

// Find a unit near (row, col) — exact match first, then adjacent cells
function _findUnitNear(units, row, col) {
    if (!units) return null;
    // exact match
    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if ((u.alive === undefined || u.alive) && u.row === row && u.col === col) return u;
    }
    // check 8 neighbors
    var best = null;
    var bestDist = 99;
    for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.alive === false) continue;
        var dr = Math.abs(u.row - row);
        var dc = Math.abs(u.col - col);
        if (dr <= 1 && dc <= 1 && (dr + dc) > 0) {
            var d = dr + dc;
            if (d < bestDist) { bestDist = d; best = u; }
        }
    }
    return best;
}

function setupTooltip() {
    var tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    var target = _getInteractionTarget();
    target.addEventListener('mousemove', function(e) {
        // In FPS avatar mode suppress tooltip entirely
        if (typeof _tacticalView !== 'undefined' && !_tacticalView &&
            typeof gamePhase !== 'undefined' && (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT)) {
            tooltip.style.display = 'none';
            tooltipVisible = false;
            hoveredUnitId = null;
            target.style.cursor = '';
            return;
        }

        var rect = target.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;

        var cell = _screenToCell(mx, my);
        if (!cell) {
            tooltip.style.display = 'none';
            tooltipVisible = false;
            return;
        }

        var foundUnit = null;

        if (gamePhase === PHASE_COMBAT || gamePhase === PHASE_RESULT) {
            foundUnit = _findUnitNear(combatUnits, cell.r, cell.c);
        } else if (gamePhase === PHASE_PLANNING && getHumanPlayer()) {
            foundUnit = _findUnitNear(getAllPlayerUnits(getHumanPlayer()), cell.r, cell.c);
        }

        if (!foundUnit) {
            tooltip.style.display = 'none';
            tooltipVisible = false;
            hoveredUnitId = null;
            target.style.cursor = '';
            return;
        }

        // Track hovered unit for 3D glow/vibration + pointer cursor
        hoveredUnitId = foundUnit.id;
        target.style.cursor = 'pointer';

        var nameEl = document.getElementById('tooltip-name');
        var classEl = document.getElementById('tooltip-class');
        var statsEl = document.getElementById('tooltip-stats');

        var charDef = CHARACTERS[foundUnit.charId];
        var displayName = charDef ? charDef.displayName : (foundUnit.creepName || foundUnit.charId);

        // Show team info
        var teamInfo = '';
        if (typeof foundUnit.owner === 'number' && TEAM_COLORS[foundUnit.owner]) {
            var _mySlot = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
            teamInfo = ' [' + (foundUnit.owner === _mySlot ? 'Tu' : (players[foundUnit.owner] ? players[foundUnit.owner].name : 'P' + foundUnit.owner)) + ']';
        }
        if (nameEl) nameEl.textContent = displayName + ' \u2605' + foundUnit.star + teamInfo;

        if (classEl) {
            classEl.textContent = (foundUnit.unitClass || '') + ' / ' + (foundUnit.race || '');
        }

        if (statsEl) {
            var computed = getComputedStats(foundUnit);
            var lines = [
                'HP: ' + foundUnit.hp + ' / ' + computed.hp,
                'ATK: ' + computed.atk,
                'Armor: ' + computed.armor,
                'Atk Speed: ' + computed.atkSpeed.toFixed(2),
                'Crit: ' + (computed.critChance * 100).toFixed(0) + '%',
                'Range: ' + computed.range,
            ];

            if (foundUnit.shield > 0) lines.push('Shield: ' + foundUnit.shield);

            if (foundUnit.items.length > 0) {
                lines.push('---');
                lines.push('Items:');
                for (var j = 0; j < foundUnit.items.length; j++) {
                    var item = ITEMS[foundUnit.items[j]];
                    if (item) lines.push('  ' + item.name);
                }
            }

            if (foundUnit.effects.length > 0) {
                lines.push('---');
                lines.push('Effetti:');
                for (var j = 0; j < foundUnit.effects.length; j++) {
                    var eff = foundUnit.effects[j];
                    lines.push('  ' + eff.type + ' (' + eff.ticksLeft + 't)');
                }
            }

            // Tactical order
            if (foundUnit.tacticalOrder && foundUnit.tacticalOrder !== ORDER_FREE) {
                var orderDef = TACTICAL_ORDERS[foundUnit.tacticalOrder];
                if (orderDef) {
                    lines.push('---');
                    lines.push('Ordine: ' + orderDef.icon + ' ' + orderDef.name);
                    if (foundUnit.tacticalTarget) {
                        // Find target name
                        var tgtName = '';
                        var searchUnits = (gamePhase === PHASE_PLANNING && getHumanPlayer()) ? getAllPlayerUnits(getHumanPlayer()) : combatUnits;
                        for (var ti = 0; ti < searchUnits.length; ti++) {
                            if (searchUnits[ti].id === foundUnit.tacticalTarget) {
                                tgtName = searchUnits[ti].charId;
                                break;
                            }
                        }
                        if (tgtName) lines.push('  Bersaglio: ' + tgtName);
                    }
                }
            }

            if (foundUnit.charId === 'Babidi') {
                lines.push('---');
                lines.push('Monete: ' + foundUnit.coins);
            }
            if (foundUnit.charId === 'Yujin' && foundUnit.furiaActive) {
                lines.push('---');
                lines.push('FURIA ATTIVA (' + foundUnit.furiaTicks + 't)');
            }
            if (foundUnit.charId === 'WMS' && foundUnit.copiedClass) {
                lines.push('---');
                lines.push('Copia: ' + foundUnit.copiedClass + '/' + foundUnit.copiedRace);
            }

            statsEl.innerHTML = lines.join('<br>');
        }

        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 16) + 'px';
        tooltip.style.top = (e.clientY + 16) + 'px';

        var tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = (e.clientX - tooltipRect.width - 8) + 'px';
        }
        if (tooltipRect.bottom > window.innerHeight) {
            tooltip.style.top = (e.clientY - tooltipRect.height - 8) + 'px';
        }

        tooltipVisible = true;
    });

    target.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
        tooltipVisible = false;
        hoveredUnitId = null;
        target.style.cursor = '';
    });
}

// --- Tactical Order Menu ---

var orderMenuUnitId = null;      // which unit the order menu is open for
var orderSelectAllyMode = null;  // { unitId, orderId } when waiting for ally click

function showOrderMenu(unitId, screenX, screenY) {
    var menu = document.getElementById('order-menu');
    if (!menu) return;

    var human = getHumanPlayer();
    if (!human) return;
    var unit = findPlayerUnit(human, unitId);
    if (!unit) return;

    orderMenuUnitId = unitId;
    menu.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'order-menu-title';
    title.textContent = unit.charId + ' — Ordine Tattico';
    menu.appendChild(title);

    for (var key in TACTICAL_ORDERS) {
        if (!TACTICAL_ORDERS.hasOwnProperty(key)) continue;
        var orderDef = TACTICAL_ORDERS[key];

        var opt = document.createElement('div');
        opt.className = 'order-option';
        if (unit.tacticalOrder === orderDef.id) opt.classList.add('active-order');
        opt.setAttribute('data-order', orderDef.id);

        var icon = document.createElement('span');
        icon.className = 'order-icon';
        icon.style.color = orderDef.color;
        icon.textContent = orderDef.icon;
        opt.appendChild(icon);

        var label = document.createElement('span');
        label.textContent = orderDef.name;
        opt.appendChild(label);

        menu.appendChild(opt);

        var desc = document.createElement('div');
        desc.className = 'order-desc';
        desc.textContent = orderDef.desc;
        menu.appendChild(desc);

        (function(orderId, needsTarget) {
            opt.addEventListener('click', function() {
                onOrderChosen(unitId, orderId, needsTarget);
            });
        })(orderDef.id, orderDef.needsTarget);
    }

    // --- Equipped items with unequip option ---
    if (unit.items && unit.items.length > 0) {
        var itemSep = document.createElement('div');
        itemSep.className = 'order-menu-title';
        itemSep.style.marginTop = '6px';
        itemSep.textContent = 'Item Equipaggiati';
        menu.appendChild(itemSep);

        for (var ii = 0; ii < unit.items.length; ii++) {
            var itemDef = ITEMS[unit.items[ii]];
            if (!itemDef) continue;
            var itemOpt = document.createElement('div');
            itemOpt.className = 'order-option';
            itemOpt.style.color = '#fbbf24';
            itemOpt.innerHTML = '<span class="order-icon">' + (itemDef.tier === 3 ? '🟡' : itemDef.tier === 2 ? '🔵' : '⚪') + '</span>' +
                '<span style="flex:1">' + itemDef.name + '</span>' +
                '<span style="font-size:10px;color:#ef4444;cursor:pointer">✕ Rimuovi</span>';
            itemOpt.title = typeof getItemDescription === 'function' ? getItemDescription(unit.items[ii]) : '';

            (function(itemSlotIdx, uid) {
                itemOpt.addEventListener('click', function() {
                    var human = getHumanPlayer();
                    if (!human) return;
                    var fieldIdx = -1;
                    for (var fi = 0; fi < human.fieldUnits.length; fi++) {
                        if (human.fieldUnits[fi].id === uid) { fieldIdx = fi; break; }
                    }
                    if (fieldIdx >= 0 && typeof unequipItem === 'function') {
                        unequipItem(human, fieldIdx, itemSlotIdx);
                        if (typeof playGoldSound === 'function') playGoldSound();
                        updateSidePanel(players);
                    }
                    hideOrderMenu();
                });
            })(ii, unitId);

            menu.appendChild(itemOpt);
        }
    }

    menu.classList.add('active');
    menu.style.left = screenX + 'px';
    menu.style.top = screenY + 'px';

    // Keep menu within viewport
    requestAnimationFrame(function() {
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (screenX - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (screenY - rect.height) + 'px';
    });
}

function hideOrderMenu() {
    var menu = document.getElementById('order-menu');
    if (menu) menu.classList.remove('active');
    orderMenuUnitId = null;
}

var orderSelectCellMode = null; // { unitId, orderId } — waiting for cell click (ORDER_MOVE)

function onOrderChosen(unitId, orderId, needsTarget) {
    hideOrderMenu();

    var human = getHumanPlayer();
    if (!human) return;
    var unit = null;
    for (var i = 0; i < human.fieldUnits.length; i++) {
        if (human.fieldUnits[i].id === unitId) { unit = human.fieldUnits[i]; break; }
    }
    if (!unit) return;

    if (needsTarget === 'cell') {
        // Enter cell-select mode (for ORDER_MOVE)
        orderSelectCellMode = { unitId: unitId, orderId: orderId };
        unit.tacticalOrder = orderId;
        unit.tacticalMoveRow = -1;
        unit.tacticalMoveCol = -1;
        var prompt = document.getElementById('order-select-prompt');
        if (prompt) {
            prompt.textContent = 'Clicca su una cella di destinazione';
            prompt.classList.add('active');
        }
    } else if (needsTarget) {
        // Enter ally-select mode
        orderSelectAllyMode = { unitId: unitId, orderId: orderId };
        unit.tacticalOrder = orderId;
        unit.tacticalTarget = null;
        var prompt = document.getElementById('order-select-prompt');
        if (prompt) {
            prompt.textContent = 'Clicca su un alleato per assegnare il bersaglio';
            prompt.classList.add('active');
        }
    } else {
        unit.tacticalOrder = orderId;
        unit.tacticalTarget = null;
    }

    if (typeof playGoldSound === 'function') playGoldSound();
}

function cancelCellSelectMode() {
    orderSelectCellMode = null;
    var prompt = document.getElementById('order-select-prompt');
    if (prompt) prompt.classList.remove('active');
}

function cancelAllySelectMode() {
    orderSelectAllyMode = null;
    var prompt = document.getElementById('order-select-prompt');
    if (prompt) prompt.classList.remove('active');
}

// --- Skill Combat Menu (during combat, right-click on own unit) ---

var skillTargetMode = null; // { casterId, skillId, targetType }

function showSkillMenu(combatUnit, screenX, screenY) {
    var menu = document.getElementById('skill-menu');
    if (!menu || !combatUnit.equippedSkills || combatUnit.equippedSkills.length === 0) return;

    menu.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'skill-menu-title';
    title.textContent = combatUnit.charId + ' — Skill';
    menu.appendChild(title);

    var orig = typeof findOriginalUnit === 'function' ? findOriginalUnit(combatUnit.id) : null;

    for (var i = 0; i < combatUnit.equippedSkills.length; i++) {
        var skillId = combatUnit.equippedSkills[i];
        var skillDef = SKILLS[skillId];
        if (!skillDef) continue;

        var ready = orig ? isSkillReady(orig, skillId) : true;
        var cdLeft = (orig && orig.skillCooldowns && orig.skillCooldowns[skillId]) ? orig.skillCooldowns[skillId] : 0;
        var usedThisCombat = combatUnit._usedSkills && combatUnit._usedSkills[skillId];

        var opt = document.createElement('div');
        opt.className = 'skill-option' + (!ready || usedThisCombat ? ' on-cooldown' : '');

        var iconEl = document.createElement('div');
        iconEl.className = 'skill-icon';
        iconEl.textContent = skillDef.icon;
        opt.appendChild(iconEl);

        var info = document.createElement('div');
        info.className = 'skill-info';
        var nameEl = document.createElement('div');
        nameEl.className = 'skill-name';
        nameEl.textContent = skillDef.name;
        info.appendChild(nameEl);
        var descEl = document.createElement('div');
        descEl.className = 'skill-desc';
        descEl.textContent = skillDef.desc;
        info.appendChild(descEl);
        opt.appendChild(info);

        var badge = document.createElement('span');
        badge.className = 'skill-cd-badge';
        if (!ready) {
            badge.textContent = cdLeft + 'r';
        } else if (usedThisCombat) {
            badge.textContent = 'Usata';
        } else {
            badge.className += ' skill-cd-ready';
            badge.textContent = 'Pronta';
        }
        opt.appendChild(badge);

        (function(sid, sdef, isReady, used) {
            opt.addEventListener('click', function() {
                if (!isReady || used) return;
                onSkillChosen(combatUnit.id, sid, sdef);
            });
        })(skillId, skillDef, ready, usedThisCombat);

        menu.appendChild(opt);
    }

    if (combatUnit.equippedSkills.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'skill-desc';
        empty.style.padding = '12px';
        empty.textContent = 'Nessuna skill equipaggiata';
        menu.appendChild(empty);
    }

    menu.classList.add('active');
    menu.style.left = screenX + 'px';
    menu.style.top = screenY + 'px';
    requestAnimationFrame(function() {
        var rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = (screenX - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) menu.style.top = (screenY - rect.height) + 'px';
    });
}

function hideSkillMenu() {
    var menu = document.getElementById('skill-menu');
    if (menu) menu.classList.remove('active');
}

function onSkillChosen(casterId, skillId, skillDef) {
    hideSkillMenu();
    if (skillDef.target === 'enemy' || skillDef.target === 'ally') {
        // Enter target select mode
        skillTargetMode = { casterId: casterId, skillId: skillId, targetType: skillDef.target };
        var prompt = document.getElementById('skill-target-prompt');
        if (prompt) prompt.classList.add('active');
    } else {
        // Self, global, global_ally — execute immediately
        queueSkill(casterId, skillId, null);
    }
}

function cancelSkillTargetMode() {
    skillTargetMode = null;
    var prompt = document.getElementById('skill-target-prompt');
    if (prompt) prompt.classList.remove('active');
}

// --- Skill Equip Panel (during planning, shown on right-click) ---

function showSkillEquipPanel(unit) {
    var panel = document.getElementById('skill-equip-panel');
    if (!panel) return;
    panel.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'skill-equip-title';
    title.textContent = unit.charId + ' — Skill (' + (unit.equippedSkills ? unit.equippedSkills.length : 0) + '/' + MAX_EQUIPPED_SKILLS + ')';
    panel.appendChild(title);

    var sub = document.createElement('div');
    sub.className = 'skill-equip-subtitle';
    sub.textContent = 'Clicca per equipaggiare/rimuovere (max 3)';
    panel.appendChild(sub);

    var allSkills = typeof getCharSkills === 'function' ? getCharSkills(unit.charId) : [];
    // Append boss skills that this unit has learned
    if (unit.learnedSkills && typeof SKILLS !== 'undefined') {
        for (var bsid in unit.learnedSkills) {
            if (bsid.indexOf('boss_') === 0 && SKILLS[bsid] && allSkills.indexOf(bsid) < 0) {
                allSkills.push(bsid);
            }
        }
    }
    var available = typeof getAvailableSkills === 'function' ? getAvailableSkills(unit) : [];
    var equipped = unit.equippedSkills || [];

    var lastTier = 0;
    for (var i = 0; i < allSkills.length; i++) {
        var sid = allSkills[i];
        var sd = SKILLS[sid];
        if (!sd) continue;

        // Tier separator
        if (sd.tier !== lastTier) {
            lastTier = sd.tier;
            var tierLabel = document.createElement('div');
            tierLabel.className = 'skill-tier-label';
            var starReq = SKILL_TIER_STAR[sd.tier] || 1;
            tierLabel.textContent = 'Tier ' + sd.tier + (starReq > 1 ? ' — Richiede \u2605' + starReq : '');
            panel.appendChild(tierLabel);
        }

        var isAvail = available.indexOf(sid) >= 0;
        var isEquipped = equipped.indexOf(sid) >= 0;
        var isLearned = unit.learnedSkills && unit.learnedSkills[sid];
        var skillLv = isLearned ? unit.learnedSkills[sid] : 0;
        var cdLeft = (unit.skillCooldowns && unit.skillCooldowns[sid]) ? unit.skillCooldowns[sid] : 0;
        var effectiveCD = (typeof getSkillCooldownForLevel === 'function' && skillLv > 0) ? getSkillCooldownForLevel(sid, skillLv) : sd.cd;

        var item = document.createElement('div');
        item.className = 'skill-equip-item';
        if (isEquipped) item.classList.add('equipped');
        if (!isAvail) item.classList.add('locked');

        var iconEl = document.createElement('div');
        iconEl.className = 'skill-equip-icon';
        iconEl.textContent = sd.icon;
        item.appendChild(iconEl);

        var infoEl = document.createElement('div');
        infoEl.className = 'skill-equip-info';
        var nameEl = document.createElement('div');
        nameEl.className = 'skill-equip-name';
        var lvText = skillLv > 0 ? ' Lv.' + skillLv : '';
        var lvStars = skillLv > 0 ? ' ' + '\u25C6'.repeat(skillLv) : '';
        nameEl.innerHTML = sd.name + '<span style="color:#fbbf24;font-size:10px">' + lvStars + '</span>';
        infoEl.appendChild(nameEl);
        var descEl = document.createElement('div');
        descEl.className = 'skill-equip-desc';
        var lvDesc = sd.desc;
        if (skillLv >= 2) lvDesc += ' [x1.5]';
        if (skillLv >= 3) lvDesc += ' [x2.0]';
        descEl.textContent = lvDesc;
        infoEl.appendChild(descEl);
        var metaEl = document.createElement('div');
        metaEl.className = 'skill-equip-meta';
        metaEl.textContent = 'CD: ' + effectiveCD + 'r | ' + sd.target + (skillLv > 0 ? ' | Lv.' + skillLv : '');
        infoEl.appendChild(metaEl);
        item.appendChild(infoEl);

        // Badges column
        var badgeWrap = document.createElement('div');
        badgeWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex-shrink:0';

        if (isEquipped) {
            var badge = document.createElement('span');
            badge.className = 'skill-equip-badge equipped-badge';
            badge.textContent = 'ATTIVA';
            badgeWrap.appendChild(badge);
        }
        if (cdLeft > 0) {
            var cdBadge = document.createElement('span');
            cdBadge.className = 'skill-equip-badge cd-badge';
            cdBadge.textContent = cdLeft + 'r';
            badgeWrap.appendChild(cdBadge);
        }
        item.appendChild(badgeWrap);

        // Upgrade button — SEPARATE row below the skill (if learned and < level 3)
        var upgRow = null;
        if (isLearned && skillLv < 3 && isAvail) {
            var upgCost = typeof SKILL_UPGRADE_COST !== 'undefined' ? SKILL_UPGRADE_COST[skillLv + 1] : 99;
            var canAfford = getHumanPlayer() && getHumanPlayer().gold >= upgCost;
            upgRow = document.createElement('div');
            upgRow.style.cssText = 'display:flex;justify-content:flex-end;padding:0 10px 4px;margin-top:-2px';
            var upgBtn = document.createElement('button');
            upgBtn.style.cssText = 'background:' + (canAfford ? 'rgba(34,197,94,0.2)' : 'rgba(100,100,100,0.1)') +
                ';border:1px solid ' + (canAfford ? 'rgba(34,197,94,0.4)' : 'rgba(100,100,100,0.2)') +
                ';color:' + (canAfford ? '#34d399' : '#64748b') +
                ';border-radius:4px;padding:3px 10px;font-size:10px;font-weight:700;cursor:' +
                (canAfford ? 'pointer' : 'not-allowed') + ';font-family:inherit';
            upgBtn.textContent = '\u2B06 Potenzia Lv.' + (skillLv + 1) + ' (' + upgCost + 'g)';
            upgBtn.title = 'Lv.' + skillLv + ' → Lv.' + (skillLv + 1) + ': +50% potenza, -1 CD';
            if (canAfford) {
                (function(skId, unitRef) {
                    upgBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof upgradeSkill === 'function' && upgradeSkill(getHumanPlayer(), unitRef, skId)) {
                            if (typeof playGoldSound === 'function') playGoldSound();
                            if (typeof showToast === 'function') {
                                var skDef = SKILLS[skId];
                                showToast((skDef ? skDef.name : skId) + ' potenziata a Lv.' + unitRef.learnedSkills[skId] + '!', 'skill', '\u2B06');
                            }
                            updateHUD(getHumanPlayer());
                            showSkillEquipPanel(unitRef);
                        }
                    });
                })(sid, unit);
            }
            upgRow.appendChild(upgBtn);
        }

        // Click to equip/unequip (on the main item row)
        if (isAvail) {
            (function(skillId, unitRef) {
                item.addEventListener('click', function() {
                    toggleEquipSkill(unitRef, skillId);
                    showSkillEquipPanel(unitRef);
                    if (typeof playGoldSound === 'function') playGoldSound();
                });
            })(sid, unit);
        }

        panel.appendChild(item);
        if (upgRow) panel.appendChild(upgRow);
    }

    panel.classList.add('active');
}

function hideSkillEquipPanel() {
    var panel = document.getElementById('skill-equip-panel');
    if (panel) panel.classList.remove('active');
}

// --- Board interaction during planning ---

var selectedBenchUnit = null;
var selectedFieldUnit = null;
var selectedItemId = null;
var selectedConsumableId = null;
var hoveredUnitId = null; // 3D hover glow/vibration target

function clearFieldSelection() {
    selectedFieldUnit = null;
    _refreshSelectedUnitPanel();
}

function _refreshSelectedUnitPanel() {
    // trigger side panel update to refresh the selected unit section
    if (typeof players !== 'undefined' && getHumanPlayer() && typeof detectSynergies === 'function') {
        updateSidePanel(players, detectSynergies(getHumanPlayer()));
    }
}

function clearBenchSelection() {
    selectedBenchUnit = null;
    var allSlots = document.querySelectorAll('#bench-panel .bench-slot');
    for (var j = 0; j < allSlots.length; j++) {
        allSlots[j].classList.remove('selected');
    }
}

function setupBoardInteraction() {
    var interTarget = _getInteractionTarget();

    // Right-click: tactical orders (planning) or skills (combat)
    interTarget.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        hideOrderMenu();
        hideSkillMenu();
        cancelAllySelectMode();
        cancelSkillTargetMode();

        var rect = interTarget.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var cell = _screenToCell(mx, my);

        if (gamePhase === PHASE_PLANNING) {
            var human = getHumanPlayer();
            if (!human) return;

            // If a unit is already selected (left-click), open menu for THAT unit
            // (works even if right-click lands on empty space)
            if (selectedFieldUnit !== null) {
                for (var i = 0; i < human.fieldUnits.length; i++) {
                    if (human.fieldUnits[i].id === selectedFieldUnit) {
                        showOrderMenu(human.fieldUnits[i].id, e.clientX, e.clientY);
                        showSkillEquipPanel(human.fieldUnits[i]);
                        return;
                    }
                }
            }

            if (!cell) return;

            // Otherwise, check if clicking directly on a unit
            for (var i = 0; i < human.fieldUnits.length; i++) {
                if (human.fieldUnits[i].row === cell.r && human.fieldUnits[i].col === cell.c) {
                    showOrderMenu(human.fieldUnits[i].id, e.clientX, e.clientY);
                    showSkillEquipPanel(human.fieldUnits[i]);
                    return;
                }
            }
            hideSkillEquipPanel();
        } else if (gamePhase === PHASE_COMBAT && cell) {
            // Find player's combat unit at this cell
            var _mySlotC = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
            for (var i = 0; i < combatUnits.length; i++) {
                var u = combatUnits[i];
                if (u.alive && u.owner === _mySlotC && u.row === cell.r && u.col === cell.c) {
                    showSkillMenu(u, e.clientX, e.clientY);
                    return;
                }
            }
        }
    });

    // Close menus on click outside
    document.addEventListener('click', function(e) {
        var skillMenu = document.getElementById('skill-menu');
        if (skillMenu && skillMenu.classList.contains('active') && !skillMenu.contains(e.target)) {
            hideSkillMenu();
        }
        var menu = document.getElementById('order-menu');
        if (menu && menu.classList.contains('active') && !menu.contains(e.target)) {
            hideOrderMenu();
        }
    });

    interTarget.addEventListener('click', function(e) {
        // --- Skill target selection during combat ---
        if (gamePhase === PHASE_COMBAT && skillTargetMode) {
            var rect = interTarget.getBoundingClientRect();
            var mx = e.clientX - rect.left;
            var my = e.clientY - rect.top;
            var cell = _screenToCell(mx, my);
            if (cell) {
                for (var i = 0; i < combatUnits.length; i++) {
                    var cu = combatUnits[i];
                    if (cu.alive && cu.row === cell.r && cu.col === cell.c) {
                        var _mySlotS = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
                        var isEnemy = (skillTargetMode.targetType === 'enemy' && cu.owner !== _mySlotS);
                        var isAlly = (skillTargetMode.targetType === 'ally' && cu.owner === _mySlotS);
                        if (isEnemy || isAlly) {
                            queueSkill(skillTargetMode.casterId, skillTargetMode.skillId, cu.id);
                            cancelSkillTargetMode();
                            return;
                        }
                    }
                }
            }
            cancelSkillTargetMode();
            return;
        }

        // Close skill menu on click
        hideSkillMenu();

        if (gamePhase !== PHASE_PLANNING) return;
        var human = getHumanPlayer();
        if (!human) return;

        // --- Building placement mode (handle before unit placement) ---
        if (typeof _buildingPlacementMode !== 'undefined' && _buildingPlacementMode) {
            var bRect = interTarget.getBoundingClientRect();
            var bCell = _screenToCell(e.clientX - bRect.left, e.clientY - bRect.top);
            if (bCell && typeof onBuildingCellClick === 'function') {
                onBuildingCellClick(bCell.r, bCell.c);
            }
            return;
        }

        // --- Ally-select mode for proteggi/segui (handle FIRST, before cell conversion) ---
        if (orderSelectAllyMode) {
            var rect2 = interTarget.getBoundingClientRect();
            var amx = e.clientX - rect2.left;
            var amy = e.clientY - rect2.top;
            var allyCell = _screenToCell(amx, amy);

            // Try exact cell match first (heroes + militia)
            var allHUnits = getAllPlayerUnits(human);
            var allyUnit = null;
            if (allyCell) {
                allyUnit = findPlayerUnitAtCell(human, allyCell.r, allyCell.c);
            }

            // If no exact match, find nearest unit to click position (tolerance)
            if (!allyUnit) {
                var bestDist = 999;
                for (var i = 0; i < allHUnits.length; i++) {
                    var upos = cellToPixel(allHUnits[i].row, allHUnits[i].col);
                    if (typeof worldToScreen === 'function' && typeof cellToWorld === 'function') {
                        upos = worldToScreen(cellToWorld(allHUnits[i].row, allHUnits[i].col));
                    }
                    var dx = e.clientX - upos.x;
                    var dy = e.clientY - upos.y;
                    var d = Math.sqrt(dx * dx + dy * dy);
                    if (d < bestDist && d < 60) { bestDist = d; allyUnit = allHUnits[i]; }
                }
            }

            if (allyUnit && allyUnit.id !== orderSelectAllyMode.unitId) {
                var casterUnit = findPlayerUnit(human, orderSelectAllyMode.unitId);
                if (casterUnit) casterUnit.tacticalTarget = allyUnit.id;
                if (typeof playGoldSound === 'function') playGoldSound();
                if (typeof showToast === 'function') showToast('Bersaglio: ' + (allyUnit.charId || allyUnit.militiaType), 'success', '✓');
            }
            cancelAllySelectMode();
            return;
        }

        // --- Cell-select mode for ORDER_MOVE ---
        if (orderSelectCellMode) {
            var rect3 = interTarget.getBoundingClientRect();
            var cmx = e.clientX - rect3.left;
            var cmy = e.clientY - rect3.top;
            var moveCell = _screenToCell(cmx, cmy);
            if (moveCell && isValidCell(moveCell.r, moveCell.c)) {
                var moveCaster = findPlayerUnit(human, orderSelectCellMode.unitId);
                if (moveCaster) {
                    moveCaster.tacticalMoveRow = moveCell.r;
                    moveCaster.tacticalMoveCol = moveCell.c;
                }
                if (typeof playGoldSound === 'function') playGoldSound();
                if (typeof showToast === 'function') showToast('Destinazione impostata (' + moveCell.r + ',' + moveCell.c + ')', 'success', '\u2316');
            }
            cancelCellSelectMode();
            return;
        }

        var rect = interTarget.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var cell = _screenToCell(mx, my);
        if (!cell) return;

        var row = cell.r;
        var col = cell.c;

        // Check if clicking on an existing unit (hero or militia)
        var clickedBoardUnit = findPlayerUnitAtCell(human, row, col);
        var fieldIdx = -1;
        if (clickedBoardUnit) {
            for (var i = 0; i < human.fieldUnits.length; i++) {
                if (human.fieldUnits[i].id === clickedBoardUnit.id) { fieldIdx = i; break; }
            }
        }

        // Structure placement mode
        if (typeof _structurePlaceMode !== 'undefined' && _structurePlaceMode) {
            if (typeof tryPlaceStructure === 'function') {
                tryPlaceStructure(human, row, col);
            }
            updateSidePanel(players);
            return;
        }

        // Equip item to field unit (with proximity tolerance)
        if (selectedItemId !== null) {
            var eqFieldIdx = fieldIdx;
            // If no exact match, find nearest unit
            if (eqFieldIdx < 0) {
                var bestEqD = 999;
                for (var ei = 0; ei < human.fieldUnits.length; ei++) {
                    var eupos = cellToPixel(human.fieldUnits[ei].row, human.fieldUnits[ei].col);
                    if (typeof worldToScreen === 'function' && typeof cellToWorld === 'function') {
                        eupos = worldToScreen(cellToWorld(human.fieldUnits[ei].row, human.fieldUnits[ei].col));
                    }
                    var edx = e.clientX - eupos.x;
                    var edy = e.clientY - eupos.y;
                    var ed = Math.sqrt(edx * edx + edy * edy);
                    if (ed < bestEqD && ed < 60) { bestEqD = ed; eqFieldIdx = ei; }
                }
            }
            if (eqFieldIdx >= 0) {
                var eqItemDef = ITEMS[selectedItemId];
                var eqUnit = human.fieldUnits[eqFieldIdx];
                if (equipItem(human, selectedItemId, eqFieldIdx)) {
                    if (typeof toastItemEquip === 'function' && eqItemDef && eqUnit) {
                        toastItemEquip(eqItemDef.name, eqUnit.charId);
                    }
                }
            } else {
                if (typeof showToast === 'function') showToast('Clicca su un personaggio!', 'warning', '🎯');
            }
            selectedItemId = null;
            updateSidePanel(players);
            return;
        }

        // Use consumable on field unit or cell
        if (selectedConsumableId !== null) {
            var cDef = typeof CONSUMABLES !== 'undefined' ? CONSUMABLES[selectedConsumableId] : null;
            if (cDef) {
                // Find target unit: exact cell match, or nearest within tolerance (heroes + militia)
                var targetUnit = clickedBoardUnit || null;
                if (!targetUnit && (cDef.target === 'ally' || cDef.target === 'enemy' || cDef.target === 'ally_to_cell')) {
                    var bestD = 999;
                    var allCUnits = getAllPlayerUnits(human);
                    for (var cu = 0; cu < allCUnits.length; cu++) {
                        var upos = cellToPixel(allCUnits[cu].row, allCUnits[cu].col);
                        if (typeof worldToScreen === 'function' && typeof cellToWorld === 'function') {
                            upos = worldToScreen(cellToWorld(allCUnits[cu].row, allCUnits[cu].col));
                        }
                        var ddx = e.clientX - upos.x;
                        var ddy = e.clientY - upos.y;
                        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
                        if (dd < bestD && dd < 60) { bestD = dd; targetUnit = allCUnits[cu]; }
                    }
                }

                var consumeSuccess = false;
                if (cDef.target === 'cell') {
                    // Traps: place on cell (row/col needed)
                    if (typeof useConsumable === 'function') {
                        consumeSuccess = useConsumable(human, selectedConsumableId, null, row, col);
                    }
                } else if (cDef.target === 'ally_to_cell') {
                    // Teleport: needs unit + cell
                    if (targetUnit && typeof useConsumable === 'function') {
                        consumeSuccess = useConsumable(human, selectedConsumableId, targetUnit, row, col);
                    }
                } else if (cDef.target === 'global') {
                    // Global: no target needed
                    if (typeof useConsumable === 'function') {
                        consumeSuccess = useConsumable(human, selectedConsumableId, null);
                    }
                } else if (targetUnit) {
                    // Ally-targeted (potion, buff, curse)
                    if (typeof useConsumable === 'function') {
                        consumeSuccess = useConsumable(human, selectedConsumableId, targetUnit);
                    }
                }

                if (consumeSuccess) {
                    if (typeof playGoldSound === 'function') playGoldSound();
                    if (typeof toastConsumableUsed === 'function') toastConsumableUsed(cDef.icon + ' ' + cDef.name + (targetUnit ? ' su ' + targetUnit.charId : ''));
                } else {
                    if (typeof showToast === 'function') showToast('Clicca su un personaggio!', 'warning', '🎯');
                }
            }
            selectedConsumableId = null;
            updateSidePanel(players);
            return;
        }

        // Clicked on a unit (hero or militia)
        if (clickedBoardUnit) {
            var clickedUnit = clickedBoardUnit;

            // Handle militia escort assignment (scorta) — must intercept before normal selection
            if (typeof _militiaEscortPending !== 'undefined' && _militiaEscortPending) {
                if (!clickedUnit.isMilitia) {
                    if (typeof tryAssignMilitiaEscort === 'function') tryAssignMilitiaEscort(clickedUnit.id);
                } else {
                    if (typeof showToast === 'function') showToast('Scegli un eroe, non una milizia!', 'warning', '⚠');
                }
                updateUnitRoster(getHumanPlayer());
                return;
            }

            // Bench → Field unit swap (only if field unit is in deploy zone)
            if (selectedBenchUnit !== null) {
                var pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(human) : 0;
                if (!clickedUnit.isMilitia && !clickedUnit.isStructure && isDeployZone(clickedUnit.row, clickedUnit.col, pSlot)) {
                    var benchIdx = -1;
                    for (var bi = 0; bi < human.benchUnits.length; bi++) {
                        if (human.benchUnits[bi] && human.benchUnits[bi].id === selectedBenchUnit) { benchIdx = bi; break; }
                    }
                    if (benchIdx >= 0) {
                        var benchUnit = human.benchUnits[benchIdx];
                        var savedRow = clickedUnit.row, savedCol = clickedUnit.col;
                        var fieldIdx = -1;
                        for (var fi = 0; fi < human.fieldUnits.length; fi++) {
                            if (human.fieldUnits[fi].id === clickedUnit.id) { fieldIdx = fi; break; }
                        }
                        if (fieldIdx >= 0) {
                            human.fieldUnits.splice(fieldIdx, 1);
                            human.benchUnits[benchIdx] = clickedUnit;
                            clickedUnit.row = -1; clickedUnit.col = -1;
                            benchUnit.row = savedRow; benchUnit.col = savedCol;
                            benchUnit.px = 0; benchUnit.py = 0;
                            human.fieldUnits.push(benchUnit);
                            if (typeof removeUnitModel3D === 'function') {
                                removeUnitModel3D(clickedUnit.id);
                                removeUnitModel3D(benchUnit.id);
                            }
                            if (typeof spawnUnitModel3D === 'function' && typeof threeScene !== 'undefined' && threeScene) {
                                spawnUnitModel3D(benchUnit);
                            }
                            updateBench(human);
                            updateHUD(human);
                            if (typeof updateUnitRoster === 'function') updateUnitRoster(human);
                            if (typeof showToast === 'function') showToast(benchUnit.charId + ' ↔ ' + clickedUnit.charId + ' scambiati!', 'success', '✓');
                        }
                    }
                } else {
                    if (typeof showToast === 'function') showToast('Puoi sostituire solo nella tua area di base!', 'warning', '⚠');
                }
                clearBenchSelection();
                clearFieldSelection();
                return;
            }

            // Field↔Field swap: blocked — units stay where they are
            if (selectedFieldUnit !== null && selectedFieldUnit !== clickedUnit.id) {
                clearFieldSelection();
                // Just select the new unit instead
                selectedFieldUnit = clickedUnit.id;
                if (typeof showUnitInfoCard === 'function') showUnitInfoCard(clickedUnit);
                _refreshSelectedUnitPanel();
                return;
            }

            // If clicking the same selected field unit, deselect
            if (selectedFieldUnit === clickedUnit.id) {
                clearFieldSelection();
                return;
            }

            // Select this field unit
            selectedFieldUnit = clickedUnit.id;
            clearBenchSelection();
            // Show unit info card
            if (typeof showUnitInfoCard === 'function') showUnitInfoCard(clickedUnit);
            _refreshSelectedUnitPanel();
            return;
        }

        // Clicked on empty valid cell
        if (isValidCell(row, col)) {
            var cellOccupied = !!findPlayerUnitAtCell(human, row, col);
            var pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(human) : 0;

            if (!cellOccupied) {
                // Field unit selected + empty cell click: NO free repositioning
                if (selectedFieldUnit !== null) {
                    clearFieldSelection();
                    if (typeof hideUnitInfoCard === 'function') hideUnitInfoCard();
                    return;
                }

                // Place bench unit on empty cell (only in own deploy zone)
                if (selectedBenchUnit !== null) {
                    if (!isDeployZone(row, col, pSlot)) {
                        if (typeof showToast === 'function') showToast('Puoi schierare solo nella tua area di base!', 'warning', '⚠');
                        clearBenchSelection();
                        return;
                    }
                    if (human.fieldUnits.length >= human.unlockedFieldSlots) {
                        if (typeof showToast === 'function') showToast('Slot campo pieni! Sblocca un nuovo slot.', 'warning', '⚠');
                        clearBenchSelection();
                        return;
                    }

                    var benchIdx = -1;
                    for (var i = 0; i < human.benchUnits.length; i++) {
                        if (human.benchUnits[i].id === selectedBenchUnit) {
                            benchIdx = i;
                            break;
                        }
                    }
                    if (benchIdx >= 0) {
                        var unit = human.benchUnits.splice(benchIdx, 1)[0];
                        unit.row = row;
                        unit.col = col;
                        unit.px = 0;
                        unit.py = 0;
                        human.fieldUnits.push(unit);
                        if (typeof spawnUnitModel3D === 'function' && typeof threeScene !== 'undefined' && threeScene) {
                            if (typeof threeUnitModels === 'undefined' || !threeUnitModels[unit.id]) {
                                spawnUnitModel3D(unit);
                            }
                        }
                        updateBench(human);
                        updateHUD(human);
                        if (typeof showToast === 'function') showToast(unit.charId + ' schierato!', 'success', '✓');
                    }
                    clearBenchSelection();
                    return;
                }
            }
        }

        // Cancel pending escort if clicking empty space
        if (typeof _militiaEscortPending !== 'undefined' && _militiaEscortPending) {
            if (typeof cancelMilitiaEscortPending === 'function') cancelMilitiaEscortPending();
        }

        // Clicked on invalid/occupied cell with no useful action — clear everything
        clearFieldSelection();
        clearBenchSelection();
        if (typeof hideUnitInfoCard === 'function') hideUnitInfoCard();
        if (typeof hideSkillEquipPanel === 'function') hideSkillEquipPanel();
    });

    // Bench slot clicks
    var benchSlots = document.querySelectorAll('#bench-panel .bench-slot');
    for (var i = 0; i < benchSlots.length; i++) {
        (function(slot) {
            slot.addEventListener('click', function() {
                if (gamePhase !== PHASE_PLANNING) return;
                var human = getHumanPlayer();
                if (!human) return;

                var slotIdx = parseInt(slot.getAttribute('data-slot'), 10);

                // Locked slot → try to unlock
                if (slotIdx >= human.unlockedBenchSlots) {
                    if (unlockBenchSlot(human)) {
                        if (typeof playGoldSound === 'function') playGoldSound();
                        updateBench(human);
                        updateHUD(human);
                        updateSidePanel(players);
                    }
                    return;
                }

                var unit = human.benchUnits[slotIdx];

                // Field → empty bench slot: recall unit from field to bench (only from deploy zone)
                if (selectedFieldUnit !== null && !unit) {
                    var fieldUnit = findPlayerUnit(human, selectedFieldUnit);
                    var pSlot = typeof getPlayerSlot === 'function' ? getPlayerSlot(human) : 0;
                    if (fieldUnit && !fieldUnit.isMilitia && !fieldUnit.isStructure && isDeployZone(fieldUnit.row, fieldUnit.col, pSlot)) {
                        // Find and remove from fieldUnits
                        for (var fi = 0; fi < human.fieldUnits.length; fi++) {
                            if (human.fieldUnits[fi].id === selectedFieldUnit) {
                                human.fieldUnits.splice(fi, 1);
                                break;
                            }
                        }
                        // Remove 3D model
                        if (typeof removeUnitModel3D === 'function') removeUnitModel3D(fieldUnit.id);
                        // Add to bench at this slot
                        fieldUnit.row = -1; fieldUnit.col = -1;
                        while (human.benchUnits.length <= slotIdx) human.benchUnits.push(null);
                        human.benchUnits[slotIdx] = fieldUnit;
                        // Clean up null gaps
                        while (human.benchUnits.length > 0 && human.benchUnits[human.benchUnits.length - 1] === null) human.benchUnits.pop();
                        updateBench(human);
                        updateHUD(human);
                        if (typeof updateUnitRoster === 'function') updateUnitRoster(human);
                        if (typeof showToast === 'function') showToast(fieldUnit.charId + ' ritirato in panchina!', 'info', '↩');
                    } else if (fieldUnit && !isDeployZone(fieldUnit.row, fieldUnit.col, pSlot)) {
                        if (typeof showToast === 'function') showToast('Solo dalla tua area di base!', 'warning', '⚠');
                    }
                    clearFieldSelection();
                    clearBenchSelection();
                    return;
                }

                // Field ↔ bench swap: swap a field unit with a bench unit (only from deploy zone)
                if (selectedFieldUnit !== null && unit) {
                    var fieldUnit = findPlayerUnit(human, selectedFieldUnit);
                    var pSlot2 = typeof getPlayerSlot === 'function' ? getPlayerSlot(human) : 0;
                    if (fieldUnit && !fieldUnit.isMilitia && !fieldUnit.isStructure && isDeployZone(fieldUnit.row, fieldUnit.col, pSlot2)) {
                        var savedRow = fieldUnit.row, savedCol = fieldUnit.col;
                        // Remove field unit from field array
                        for (var fi = 0; fi < human.fieldUnits.length; fi++) {
                            if (human.fieldUnits[fi].id === selectedFieldUnit) {
                                human.fieldUnits.splice(fi, 1);
                                break;
                            }
                        }
                        // Remove bench unit from bench array
                        human.benchUnits.splice(slotIdx, 1);
                        // Place bench unit on field at old field unit's position
                        unit.row = savedRow; unit.col = savedCol;
                        unit.px = 0; unit.py = 0;
                        human.fieldUnits.push(unit);
                        // Put field unit on bench
                        fieldUnit.row = -1; fieldUnit.col = -1;
                        human.benchUnits.splice(slotIdx, 0, fieldUnit);
                        // Update 3D models
                        if (typeof removeUnitModel3D === 'function') {
                            removeUnitModel3D(fieldUnit.id);
                            removeUnitModel3D(unit.id);
                        }
                        if (typeof spawnUnitModel3D === 'function' && typeof threeScene !== 'undefined' && threeScene) {
                            spawnUnitModel3D(unit);
                        }
                        updateBench(human);
                        updateHUD(human);
                        if (typeof updateUnitRoster === 'function') updateUnitRoster(human);
                        if (typeof showToast === 'function') showToast(fieldUnit.charId + ' ↔ ' + unit.charId + ' scambiati!', 'success', '🔄');
                    } else if (fieldUnit && !isDeployZone(fieldUnit.row, fieldUnit.col, pSlot2)) {
                        if (typeof showToast === 'function') showToast('Solo dalla tua area di base!', 'warning', '⚠');
                    }
                    clearFieldSelection();
                    clearBenchSelection();
                    return;
                }

                // Select / deselect bench unit
                if (unit) {
                    if (selectedBenchUnit === unit.id) {
                        // Deselect
                        clearBenchSelection();
                    } else {
                        selectedBenchUnit = unit.id;
                        clearFieldSelection();
                        var allSlots = document.querySelectorAll('#bench-panel .bench-slot');
                        for (var j = 0; j < allSlots.length; j++) {
                            allSlots[j].classList.remove('selected');
                        }
                        slot.classList.add('selected');
                    }
                } else {
                    clearBenchSelection();
                }
            });
        })(benchSlots[i]);
    }
}

// --- Planning timer ---

var planningTimerId = null;

function startPlanningTimer(seconds, onExpire) {
    stopPlanningTimer();
    var remaining = seconds;
    var timerWrap = document.getElementById('hud-timer-wrap');
    var timerEl = document.getElementById('hud-timer');
    if (timerWrap) timerWrap.style.display = '';
    if (timerEl) timerEl.textContent = remaining;

    planningTimerId = setInterval(function() {
        remaining--;
        if (timerEl) timerEl.textContent = Math.max(0, remaining);

        if (remaining <= 0) {
            stopPlanningTimer();
            if (typeof onExpire === 'function') onExpire();
        }
    }, 1000);
}

function stopPlanningTimer() {
    if (planningTimerId !== null) {
        clearInterval(planningTimerId);
        planningTimerId = null;
    }
    var timerWrap = document.getElementById('hud-timer-wrap');
    if (timerWrap) timerWrap.style.display = 'none';
}

// --- Combat speed toggle ---

var combatSpeedMultiplier = 1;

function setupCombatSpeedToggle() {
    var btn = document.getElementById('btn-speed');
    if (!btn) return;

    btn.addEventListener('click', function() {
        if (combatSpeedMultiplier === 1) combatSpeedMultiplier = 2;
        else if (combatSpeedMultiplier === 2) combatSpeedMultiplier = 4;
        else combatSpeedMultiplier = 1;
        btn.textContent = combatSpeedMultiplier + 'x';
    });
}
