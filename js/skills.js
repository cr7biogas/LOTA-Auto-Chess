// ============================================================
// LOTA AUTO CHESS — skills.js — Manual skill system (50 skills)
// ============================================================

// --- Skill tier unlock: minimum star level required ---
const SKILL_TIER_STAR = { 1: 1, 2: 2, 3: 3, 4: 4 };
const MAX_EQUIPPED_SKILLS = 3;

// --- Active combat zones ---
var combatZones = []; // { row, col, radius, dmgType, value, ticksLeft, ownerId, sourceSkill }

// --- Pending skill activation (set by UI, consumed next tick) ---
var pendingSkillAction = null; // { casterId, skillId, targetId, targetRow, targetCol }

// --- Skill Definitions (50 total: 10 per character) ---
const SKILLS = {
    // ===================== BABIDI =====================
    babidi_tangente:       { charId:'Babidi',  name:'Tangente',             icon:'💰', tier:1, cd:3, target:'enemy',      range:3, desc:'Corrompi un nemico: stun 2 tick', lore:'Il denaro compra tutto.' },
    babidi_bolla:          { charId:'Babidi',  name:'Bolla Tossica',        icon:'🟢', tier:1, cd:4, target:'enemy',      range:3, desc:'Veleno AOE 2 celle (2% maxHP/t, 3t)', lore:'Una bolla di morte che scoppia.' },
    babidi_contrattazione: { charId:'Babidi',  name:'Contrattazione',       icon:'🤝', tier:1, cd:3, target:'enemy',      range:3, desc:'Ruba 20% ATK al nemico per 4 tick', lore:'Ogni affare ha un perdente.' },
    babidi_acquario:       { charId:'Babidi',  name:'Acquario Velenoso',    icon:'🐟', tier:2, cd:5, target:'enemy',      range:4, desc:'Zona tossica 3x3: 2% maxHP/t per 4t', lore:'Un acquario di morte.' },
    babidi_svalutazione:   { charId:'Babidi',  name:'Svalutazione',         icon:'📉', tier:2, cd:4, target:'global',     range:0, desc:'-25% ATK a tutti i nemici per 3 tick', lore:'Il mercato crolla.' },
    babidi_fuga:           { charId:'Babidi',  name:'Fuga del Mercante',    icon:'🏃', tier:2, cd:3, target:'self',       range:0, desc:'Teleport lontano + 25% dodge 3t', lore:'Un buon mercante sa quando fuggire.' },
    babidi_inflazione:     { charId:'Babidi',  name:'Inflazione',           icon:'💹', tier:3, cd:5, target:'global',     range:0, desc:'Tutti i veleni fanno danno doppio per 4t', lore:'I prezzi salgono, il dolore pure.' },
    babidi_rete:           { charId:'Babidi',  name:'Rete di Contatti',     icon:'🕸', tier:3, cd:4, target:'global_ally', range:0, desc:'+8% ATK alleati per nemico debuffato, 3t', lore:'Conosco gente che conosce gente.' },
    babidi_bancarotta:     { charId:'Babidi',  name:'Bancarotta',           icon:'💥', tier:3, cd:3, target:'enemy',      range:3, desc:'Consuma monete: 40% ATK danno per moneta', lore:'Tutto o niente.' },
    babidi_monopolio:      { charId:'Babidi',  name:'Monopolio',            icon:'👑', tier:4, cd:6, target:'self',       range:0, desc:'Per 5t ogni danno genera 0.5 gold reali', lore:'Il mercato e mio.' },

    // ===================== CARONTE =====================
    caronte_esame:         { charId:'Caronte', name:'Esame a Sorpresa',     icon:'📝', tier:1, cd:3, target:'enemy',      range:3, desc:'Silence nemico per 3 tick', lore:'Silenzio, prego.' },
    caronte_bocciatura:    { charId:'Caronte', name:'Bocciatura',           icon:'❌', tier:1, cd:3, target:'enemy',      range:3, desc:'10% maxHP puro + prossimo colpo crit garantito', lore:'Insufficiente.' },
    caronte_lezione:       { charId:'Caronte', name:'Lezione Magistrale',   icon:'📖', tier:1, cd:4, target:'global',     range:0, desc:'Slow 30% tutti i nemici per 3t', lore:'La lezione piu noiosa della storia.' },
    caronte_tesi_plus:     { charId:'Caronte', name:'Tesi Potenziata',      icon:'📜', tier:2, cd:5, target:'self',       range:0, desc:'Prossima Tesi fa 25% maxHP', lore:'Revisione approvata.' },
    caronte_teleport:      { charId:'Caronte', name:'Teletrasporto Tattico',icon:'🌀', tier:2, cd:3, target:'enemy',      range:99, desc:'Ri-teleport + scudo 15% maxHP', lore:'Sorpresa, di nuovo.' },
    caronte_revisione:     { charId:'Caronte', name:'Revisione Forzata',    icon:'⏪', tier:2, cd:4, target:'enemy',      range:3, desc:'Resetta CD nemico al massimo', lore:'Riscrivi tutto da capo.' },
    caronte_plagio:        { charId:'Caronte', name:'Plagio Accademico',    icon:'🎭', tier:3, cd:5, target:'self',       range:0, desc:'Copia ATK del nemico piu forte per 4t', lore:'Citare e un arte.' },
    caronte_cattedra:      { charId:'Caronte', name:'Cattedra Maledetta',   icon:'🪑', tier:3, cd:5, target:'enemy',      range:4, desc:'Zona 2x2: 3% maxHP puro/t per 4t', lore:'Non sederti li.' },
    caronte_doppio:        { charId:'Caronte', name:'Doppio Incarico',      icon:'📑', tier:3, cd:5, target:'self',       range:0, desc:'Prossima Tesi colpisce 2 target (10% ciascuno)', lore:'Due per uno.' },
    caronte_defenestrazione:{ charId:'Caronte', name:'Defenestrazione',     icon:'💨', tier:4, cd:6, target:'enemy',      range:3, desc:'Teletrasporta nemico in angolo + 15% maxHP puro', lore:'Fuori dalla mia aula.' },

    // ===================== VALERIO =====================
    valerio_scossa:        { charId:'Valerio', name:'Scossa Sismica',       icon:'💥', tier:1, cd:3, target:'self',       range:0, desc:'AOE 2 celle: stun 1t + 80% ATK danno', lore:'La terra trema.' },
    valerio_muro:          { charId:'Valerio', name:'Muro di Segmenti',     icon:'🛡', tier:1, cd:3, target:'self',       range:0, desc:'+60% armor per 4 tick', lore:'Impenetrabile.' },
    valerio_regen_exp:     { charId:'Valerio', name:'Regen Esplosiva',      icon:'💚', tier:1, cd:4, target:'self',       range:0, desc:'Cura istantanea 25% maxHP', lore:'La carne si rigenera.' },
    valerio_divorare:      { charId:'Valerio', name:'Divorare',             icon:'🦷', tier:2, cd:4, target:'enemy',      range:1, desc:'200% ATK danno + cura 50% inflitto', lore:'*crunch*' },
    valerio_tana:          { charId:'Valerio', name:'Tana Sotterranea',     icon:'🕳', tier:2, cd:5, target:'self',       range:0, desc:'Untargetable 2t, poi AOE 100% ATK', lore:'Scompare sotto terra.' },
    valerio_spore:         { charId:'Valerio', name:'Spore Tossiche',       icon:'🍄', tier:2, cd:4, target:'self',       range:0, desc:'Veleno AOE 3 celle (1.5% maxHP/t, 4t)', lore:'Nuvola di spore.' },
    valerio_provocazione:  { charId:'Valerio', name:'Provocazione Suprema', icon:'😤', tier:3, cd:5, target:'self',       range:0, desc:'TUTTI i nemici forzati su Valerio 3t', lore:'VENITE QUI!' },
    valerio_scudo_simb:    { charId:'Valerio', name:'Scudo Simbiotico',     icon:'🔰', tier:3, cd:4, target:'ally',       range:4, desc:'Scudo 20% maxHP Valerio a un alleato', lore:'Ti proteggo io.' },
    valerio_metamorfosi:   { charId:'Valerio', name:'Metamorfosi',          icon:'🔄', tier:3, cd:6, target:'self',       range:0, desc:'Regen x3 + 30% maxHP bonus per 5t', lore:'Evoluzione temporanea.' },
    valerio_terremoto:     { charId:'Valerio', name:'Terremoto',            icon:'🌋', tier:4, cd:6, target:'self',       range:0, desc:'Sacrifica 15% HP: stessa quantita AOE + stun 1t', lore:'Il mondo crolla.' },

    // ===================== YUJIN =====================
    yujin_urlo:            { charId:'Yujin',   name:'Urlo di Guerra',       icon:'📣', tier:1, cd:3, target:'global_ally', range:0, desc:'+20% ATK tutti gli alleati per 3t', lore:'AAAARGH!' },
    yujin_esecutore:       { charId:'Yujin',   name:'Colpo Esecutore',      icon:'⚔',  tier:1, cd:4, target:'enemy',      range:1, desc:'250% ATK (500% se target sotto 30% HP)', lore:'Giustizia del Nord.' },
    yujin_carica:          { charId:'Yujin',   name:'Carica del Berserker', icon:'🏇', tier:1, cd:3, target:'enemy',      range:6, desc:'Dash sul nemico + 150% ATK + stun 1t', lore:'CARICAAA!' },
    yujin_ghiaccio:        { charId:'Yujin',   name:'Scudo di Ghiaccio',    icon:'❄',  tier:2, cd:4, target:'self',       range:0, desc:'Scudo 20% maxHP + riflette 15% danni 3t', lore:'Freddo come il Nord.' },
    yujin_vento:           { charId:'Yujin',   name:'Vento del Nord',       icon:'🌬', tier:2, cd:4, target:'self',       range:0, desc:'Spinge nemici 1 cella + slow 25% 2t', lore:'Il vento gela.' },
    yujin_giuramento:      { charId:'Yujin',   name:'Giuramento di Sangue', icon:'🩸', tier:2, cd:5, target:'self',       range:0, desc:'Sacrifica 15% HP: lifesteal 30% per 4t', lore:'Il mio sangue per la vittoria.' },
    yujin_frenesia:        { charId:'Yujin',   name:'Frenesia',             icon:'⚡', tier:3, cd:3, target:'enemy',      range:1, desc:'3 colpi rapidi al 70% ATK ciascuno', lore:'Troppo veloce per i tuoi occhi.' },
    yujin_muro_lame:       { charId:'Yujin',   name:'Muro di Lame',         icon:'🗡', tier:3, cd:4, target:'self',       range:0, desc:'Counter: chi attacca Yujin melee subisce 40% ATK 3t', lore:'Tocca me e ti tagli.' },
    yujin_ragnarok_p:      { charId:'Yujin',   name:'Ragnarok Personale',   icon:'🔥', tier:3, cd:5, target:'self',       range:0, desc:'+60% ATK ma -4% maxHP/tick per 4t', lore:'Brucia tutto.' },
    yujin_valchiria:       { charId:'Yujin',   name:'Valchiria',            icon:'👼', tier:4, cd:6, target:'self',       range:0, desc:'Invulnerabile 1t + prossimo attacco 600% ATK', lore:'Le Valchirie mi guardano.' },

    // ===================== WMS =====================
    wms_distorsione:       { charId:'WMS',     name:'Distorsione Temporale',icon:'⏳', tier:1, cd:4, target:'global_ally', range:0, desc:'Riduce CD alleati di 3 tick', lore:'Il tempo si piega.' },
    wms_benedizione:       { charId:'WMS',     name:'Benedizione Mistica',  icon:'✨', tier:1, cd:3, target:'ally',       range:4, desc:'+20% tutti gli stat alleato per 4t', lore:'Sii benedetto.' },
    wms_essenza:           { charId:'WMS',     name:'Essenza Vitale',       icon:'💖', tier:1, cd:4, target:'global_ally', range:0, desc:'Cura tutti gli alleati 10% maxHP', lore:'La vita scorre.' },
    wms_specchio:          { charId:'WMS',     name:'Specchio Cosmico',     icon:'🪞', tier:2, cd:4, target:'self',       range:0, desc:'Riflette 50% danni subiti per 4t', lore:'Guardati allo specchio.' },
    wms_vuoto:             { charId:'WMS',     name:'Vuoto Cosmico',        icon:'⬛', tier:2, cd:3, target:'enemy',      range:4, desc:'Rimuove TUTTI i buff dal nemico', lore:'Il vuoto consuma.' },
    wms_anomalia:          { charId:'WMS',     name:'Anomalia Gravitazionale',icon:'🌊', tier:2, cd:5, target:'self',     range:0, desc:'Trascina nemici entro 4 celle + 5% maxHP danno', lore:'La gravita obbedisce.' },
    wms_sdoppiamento:      { charId:'WMS',     name:'Sdoppiamento',         icon:'👥', tier:3, cd:5, target:'self',       range:0, desc:'Attacca doppio per 4 tick', lore:'Vedi doppio.' },
    wms_onda:              { charId:'WMS',     name:'Onda d\'Urto',         icon:'💫', tier:3, cd:4, target:'global',     range:0, desc:'8% HP correnti danno puro a tutti i nemici', lore:'L onda si espande.' },
    wms_trascendenza:      { charId:'WMS',     name:'Trascendenza',         icon:'🌟', tier:3, cd:5, target:'self',       range:0, desc:'Invulnerabile 2t + alleati -15% danni per 4t', lore:'Oltre la materia.' },
    wms_singolarita:       { charId:'WMS',     name:'Singolarita',          icon:'⭐', tier:4, cd:7, target:'global',     range:0, desc:'Freeze globale: tutti i nemici 2 tick', lore:'Il tempo si ferma.' },

    // ===================== BOSS SKILLS (universali — equipaggiabili su qualsiasi unità) =====================
    boss_morso_velenoso:   { charId:'_boss', name:'Morso Velenoso',         icon:'🐍', tier:1, cd:3, target:'enemy',  range:2, desc:'Avvelena il nemico: 4% maxHP/tick per 4 tick', lore:'Il veleno scorre nelle vene.' },
    boss_scudo_pietra:     { charId:'_boss', name:'Scudo di Pietra',        icon:'🛡️', tier:1, cd:5, target:'self',   range:0, desc:'Scudo pari al 30% maxHP per 4 tick', lore:'La pietra protegge.' },
    boss_onda_urto:        { charId:'_boss', name:'Onda Devastante',        icon:'💥', tier:1, cd:4, target:'enemy',  range:3, desc:'Danno AOE 3 celle: 12% maxHP a tutti i nemici', lore:'La terra trema.' },
    boss_divorare:         { charId:'_boss', name:'Divorare',               icon:'🦷', tier:1, cd:4, target:'enemy',  range:1, desc:'Attacco brutale: 200% ATK + cura 50% danno inflitto', lore:'La fame non ha fine.' },
    boss_furia_ancestrale: { charId:'_boss', name:'Furia Ancestrale',       icon:'🔥', tier:1, cd:6, target:'self',   range:0, desc:'+80% ATK e +40% velocità per 5 tick', lore:'Il potere degli antichi risorge.' },
};

// --- Get all skills for a character ---
function getCharSkills(charId) {
    var result = [];
    for (var key in SKILLS) {
        if (SKILLS[key].charId === charId) result.push(key);
    }
    return result;
}

// --- Get unlocked skills based on star level ---
function getAvailableSkills(unit) {
    if (!unit || !unit.charId) return [];
    var star = unit.star || 1;
    var all = getCharSkills(unit.charId);
    var available = [];
    for (var i = 0; i < all.length; i++) {
        var skill = SKILLS[all[i]];
        if (skill && star >= SKILL_TIER_STAR[skill.tier]) {
            available.push(all[i]);
        }
    }
    // Boss skills: available if the unit has learned them (dropped from dungeon boss)
    if (unit.learnedSkills) {
        for (var sid in unit.learnedSkills) {
            if (sid.indexOf('boss_') === 0 && SKILLS[sid] && available.indexOf(sid) < 0) {
                available.push(sid);
            }
        }
    }
    return available;
}

// --- Skill Level System ---
var SKILL_UPGRADE_COST = { 2: 3, 3: 6 }; // gold cost to upgrade to level 2 or 3

function getSkillLevel(unit, skillId) {
    if (!unit.learnedSkills) return 0;
    return unit.learnedSkills[skillId] || 0;
}

function getSkillLevelMult(unit, skillId) {
    var lv = getSkillLevel(unit, skillId);
    if (lv <= 1) return 1.0;
    if (lv === 2) return 1.5;
    return 2.0; // level 3
}

function getSkillCooldownForLevel(skillId, level) {
    var skill = SKILLS[skillId];
    if (!skill) return 99;
    var base = skill.cd;
    if (level >= 3) return Math.max(1, base - 2);
    if (level >= 2) return Math.max(1, base - 1);
    return base;
}

// Learn a skill (called on first equip)
function learnSkill(unit, skillId) {
    if (!unit.learnedSkills) unit.learnedSkills = {};
    if (!unit.learnedSkills[skillId]) {
        unit.learnedSkills[skillId] = 1;
    }
}

// Upgrade a skill (costs gold)
function upgradeSkill(player, unit, skillId) {
    if (!player || !unit) return false;
    var currentLevel = getSkillLevel(unit, skillId);
    if (currentLevel <= 0 || currentLevel >= 3) return false;
    var nextLevel = currentLevel + 1;
    var cost = SKILL_UPGRADE_COST[nextLevel];
    if (!cost || player.gold < cost) return false;
    player.gold -= cost;
    unit.learnedSkills[skillId] = nextLevel;
    return true;
}

// --- Check if a skill is ready (not on cooldown) ---
function isSkillReady(unit, skillId) {
    if (!unit.skillCooldowns) return true;
    return !unit.skillCooldowns[skillId] || unit.skillCooldowns[skillId] <= 0;
}

// --- Set skill cooldown (level-aware) ---
function setSkillCooldown(unit, skillId) {
    var skill = SKILLS[skillId];
    if (!skill) return;
    if (!unit.skillCooldowns) unit.skillCooldowns = {};
    var level = getSkillLevel(unit, skillId);
    unit.skillCooldowns[skillId] = getSkillCooldownForLevel(skillId, level);
}

// --- Tick cooldowns for all units of a player (called each round) ---
function tickSkillCooldowns(player) {
    if (!player) return;
    var allUnits = player.fieldUnits.concat(player.benchUnits || []);
    for (var i = 0; i < allUnits.length; i++) {
        var u = allUnits[i];
        if (!u.skillCooldowns) continue;
        for (var key in u.skillCooldowns) {
            if (u.skillCooldowns[key] > 0) u.skillCooldowns[key]--;
        }
    }
}

// --- Equip / unequip a skill (also learns it on first equip) ---
function toggleEquipSkill(unit, skillId) {
    if (!unit) return false;
    if (!unit.equippedSkills) unit.equippedSkills = [];
    if (!unit.learnedSkills) unit.learnedSkills = {};

    var idx = unit.equippedSkills.indexOf(skillId);
    if (idx >= 0) {
        // Unequip (skill remains learned)
        unit.equippedSkills.splice(idx, 1);
        return true;
    }
    // Equip (max 3 active)
    if (unit.equippedSkills.length >= MAX_EQUIPPED_SKILLS) return false;
    // Must be available (tier unlock)
    var available = getAvailableSkills(unit);
    if (available.indexOf(skillId) < 0) return false;
    // Learn on first equip
    learnSkill(unit, skillId);
    unit.equippedSkills.push(skillId);
    return true;
}

// --- Queue a skill for execution (called from UI) ---
function queueSkill(casterId, skillId, targetId, targetRow, targetCol) {
    pendingSkillAction = {
        casterId: casterId,
        skillId: skillId,
        targetId: targetId || null,
        targetRow: targetRow !== undefined ? targetRow : -1,
        targetCol: targetCol !== undefined ? targetCol : -1,
    };
}

// --- Find original unit from combat clone ---
function findOriginalUnit(cloneId) {
    for (var p = 0; p < players.length; p++) {
        if (!players[p] || players[p].eliminated) continue;
        for (var u = 0; u < players[p].fieldUnits.length; u++) {
            if (players[p].fieldUnits[u].id === cloneId) return players[p].fieldUnits[u];
        }
    }
    return null;
}

// --- Execute pending skill action (called from runCombatTick) ---
function executePendingSkill(teams, grid, allUnits) {
    if (!pendingSkillAction) return;
    var action = pendingSkillAction;
    pendingSkillAction = null;

    var caster = null;
    for (var i = 0; i < allUnits.length; i++) {
        if (allUnits[i].id === action.casterId && allUnits[i].alive) {
            caster = allUnits[i];
            break;
        }
    }
    if (!caster) return;
    if (hasEffect(caster, 'silence') || hasEffect(caster, 'freeze') || hasEffect(caster, 'stun')) return;

    var skillDef = SKILLS[action.skillId];
    if (!skillDef) return;

    // Check cooldown on original unit
    var orig = findOriginalUnit(caster.id);
    if (orig && !isSkillReady(orig, action.skillId)) return;

    // Find target
    var target = null;
    if (action.targetId) {
        for (var i = 0; i < allUnits.length; i++) {
            if (allUnits[i].id === action.targetId && allUnits[i].alive) {
                target = allUnits[i];
                break;
            }
        }
    }

    // Execute
    var success = executeSkillEffect(action.skillId, caster, target, teams, grid, allUnits);

    if (success) {
        // Set cooldown on original
        if (orig) setSkillCooldown(orig, action.skillId);
        // Track usage on clone
        if (!caster._usedSkills) caster._usedSkills = {};
        caster._usedSkills[action.skillId] = true;
        combatLog.push(caster.charId + ' usa ' + skillDef.name + '!');
        // VFX for skill
        if (typeof vfxForSkill === 'function') {
            vfxForSkill(action.skillId, caster, target, allUnits);
        }
        // Toast + floating skill name for human player
        if (caster.owner === 0) {
            if (typeof toastSkillUsed === 'function') toastSkillUsed(skillDef.name, caster.charId);
        }
        // Floating skill cast indicator (for ALL units)
        spawnSkillCastIndicator(caster, skillDef);
    }
}

// --- SKILL EXECUTION ENGINE ---
function executeSkillEffect(skillId, caster, target, teams, grid, allUnits) {
    var enemies = getEnemiesOf(caster, teams);
    var allies = getAlliesOf(caster, teams);
    var aliveEnemies = [];
    for (var i = 0; i < enemies.length; i++) { if (enemies[i].alive) aliveEnemies.push(enemies[i]); }
    var aliveAllies = [];
    for (var i = 0; i < allies.length; i++) { if (allies[i].alive) aliveAllies.push(allies[i]); }

    // Skill level multiplier: L1=1.0, L2=1.5, L3=2.0
    var origUnit = typeof findOriginalUnit === 'function' ? findOriginalUnit(caster.id) : caster;
    var LV = origUnit ? getSkillLevelMult(origUnit, skillId) : 1.0;
    var LEVEL = origUnit ? getSkillLevel(origUnit, skillId) : 1;
    // Helper: scale a value by level
    function S(val) { return Math.round(val * LV); }
    // Helper: extend duration by level
    function D(baseTicks) { return baseTicks + (LEVEL - 1); }

    switch (skillId) {

        // ========== BABIDI ==========

        case 'babidi_tangente':
            if (!target) return false;
            applyEffect(target, { type: 'freeze', ticksLeft: D(2), sourceType: 'skill_tangente' }, caster);
            addDamageNumber(target, 0, 'miss');
            return true;

        case 'babidi_bolla':
            if (!target) return false;
            for (var i = 0; i < aliveEnemies.length; i++) {
                if (chebyshevDist(target.row, target.col, aliveEnemies[i].row, aliveEnemies[i].col) <= 2) {
                    applyEffect(aliveEnemies[i], { type: 'poison', value: S(Math.round(aliveEnemies[i].maxHp * 0.02)), ticksLeft: D(3), stacking: 'refresh', sourceType: 'skill_bolla' }, caster);
                }
            }
            return true;

        case 'babidi_contrattazione':
            if (!target) return false;
            var stolenAtk = Math.round(target.atk * 0.20);
            target.atk -= stolenAtk;
            caster._stolenAtk = (caster._stolenAtk || 0) + stolenAtk;
            caster._stolenAtkTargetId = target.id;
            caster.atk += stolenAtk;
            caster._contrattazioneTicks = 4;
            return true;

        case 'babidi_acquario':
            if (!target) return false;
            combatZones.push({ row: target.row, col: target.col, radius: 1, dmgType: 'poison', value: 0.02, ticksLeft: 4, ownerId: caster.owner, sourceSkill: 'acquario' });
            return true;

        case 'babidi_svalutazione':
            for (var i = 0; i < aliveEnemies.length; i++) {
                applyEffect(aliveEnemies[i], { type: 'atk_reduction', value: 0.25 * LV, ticksLeft: D(3), sourceType: 'skill_svalutazione' }, caster);
            }
            return true;

        case 'babidi_fuga': {
            // Find farthest valid cell from all enemies
            var bestR = caster.row, bestC = caster.col, bestMinDist = 0;
            for (var r = 0; r < 14; r++) {
                for (var c = 0; c < 14; c++) {
                    if (!isValidCell(r, c) || (grid[r] && grid[r][c] !== null)) continue;
                    var minEnemyDist = 999;
                    for (var e = 0; e < aliveEnemies.length; e++) {
                        var d = chebyshevDist(r, c, aliveEnemies[e].row, aliveEnemies[e].col);
                        if (d < minEnemyDist) minEnemyDist = d;
                    }
                    if (minEnemyDist > bestMinDist) { bestMinDist = minEnemyDist; bestR = r; bestC = c; }
                }
            }
            if (grid[caster.row]) grid[caster.row][caster.col] = null;
            caster.row = bestR; caster.col = bestC;
            if (grid[bestR]) grid[bestR][bestC] = caster.id;
            initUnitWorldPos(caster);
            caster.dodgeChance += 0.25;
            caster._fugaDodgeTicks = 3;
            return true;
        }

        case 'babidi_inflazione':
            caster._inflazioneTicks = 4;
            // Set global flag on all enemies
            for (var i = 0; i < aliveEnemies.length; i++) {
                aliveEnemies[i]._poisonDmgMult = 2.0;
                aliveEnemies[i]._poisonDmgMultTicks = 4;
            }
            return true;

        case 'babidi_rete': {
            var debuffedCount = 0;
            for (var i = 0; i < aliveEnemies.length; i++) {
                if (aliveEnemies[i].effects && aliveEnemies[i].effects.length > 0) debuffedCount++;
            }
            var bonus = debuffedCount * 0.08;
            for (var i = 0; i < aliveAllies.length; i++) {
                var atkFlat = Math.round(aliveAllies[i].atk * bonus);
                aliveAllies[i]._reteAtkFlat = atkFlat;
                aliveAllies[i]._reteTicks = 3;
                aliveAllies[i].atk += atkFlat;
            }
            return true;
        }

        case 'babidi_bancarotta':
            if (!target) return false;
            var coins = caster.coins || 0;
            if (coins <= 0) return false;
            var dmg = S(Math.round(coins * caster.atk * 0.40));
            caster.coins = 0;
            applyPureDamage(target, dmg, caster);
            addDamageNumber(target, dmg, 'magic');
            return true;

        case 'babidi_monopolio':
            caster._monopolioTicks = 5;
            return true;

        // ========== CARONTE ==========

        case 'caronte_esame':
            if (!target) return false;
            applyEffect(target, { type: 'silence', ticksLeft: D(3), sourceType: 'skill_esame' }, caster);
            return true;

        case 'caronte_bocciatura':
            if (!target) return false;
            var dmg = Math.round(target.maxHp * 0.10);
            applyPureDamage(target, dmg, caster);
            addDamageNumber(target, dmg, 'magic');
            target._guaranteedCrit = true;
            return true;

        case 'caronte_lezione':
            for (var i = 0; i < aliveEnemies.length; i++) {
                applyEffect(aliveEnemies[i], { type: 'speed_reduction', value: 0.30 * LV, ticksLeft: D(3), sourceType: 'skill_lezione' }, caster);
            }
            return true;

        case 'caronte_tesi_plus':
            caster._tesiPotenziata = true;
            return true;

        case 'caronte_teleport':
            if (!target) return false;
            var freeCell = findFreeCellAdjacentTo(target.row, target.col, grid);
            if (!freeCell) return false;
            if (grid[caster.row]) grid[caster.row][caster.col] = null;
            caster.row = freeCell.r; caster.col = freeCell.c;
            if (grid[freeCell.r]) grid[freeCell.r][freeCell.c] = caster.id;
            initUnitWorldPos(caster);
            caster.shield = Math.floor(caster.maxHp * 0.15);
            return true;

        case 'caronte_revisione':
            if (!target) return false;
            if (target.charId === 'Caronte') target.abilityCooldown = 6;
            else if (target.charId === 'Yujin') target.abilityCooldown = 8;
            else if (target.charId === 'WMS') target.abilityCooldown = 7;
            else target.abilityCooldown = 10;
            return true;

        case 'caronte_plagio': {
            var highestAtk = 0;
            for (var i = 0; i < aliveEnemies.length; i++) {
                if (aliveEnemies[i].atk > highestAtk) highestAtk = aliveEnemies[i].atk;
            }
            caster._plagioOrigAtk = caster.atk;
            caster.atk = highestAtk;
            caster._plagioTicks = 4;
            return true;
        }

        case 'caronte_cattedra':
            if (!target) return false;
            combatZones.push({ row: target.row, col: target.col, radius: 1, dmgType: 'pure', value: 0.03, ticksLeft: 4, ownerId: caster.owner, sourceSkill: 'cattedra' });
            return true;

        case 'caronte_doppio':
            caster._doppioIncarico = true;
            return true;

        case 'caronte_defenestrazione':
            if (!target) return false;
            // Teleport enemy to farthest corner
            var corners = [{r:0,c:3},{r:0,c:10},{r:3,c:0},{r:3,c:13},{r:10,c:0},{r:10,c:13},{r:13,c:3},{r:13,c:10}];
            var bestCorner = null; var bestDist = -1;
            for (var i = 0; i < corners.length; i++) {
                if (!isValidCell(corners[i].r, corners[i].c)) continue;
                if (grid[corners[i].r] && grid[corners[i].r][corners[i].c] !== null) continue;
                var d = chebyshevDist(target.row, target.col, corners[i].r, corners[i].c);
                if (d > bestDist) { bestDist = d; bestCorner = corners[i]; }
            }
            if (bestCorner) {
                if (grid[target.row]) grid[target.row][target.col] = null;
                target.row = bestCorner.r; target.col = bestCorner.c;
                if (grid[bestCorner.r]) grid[bestCorner.r][bestCorner.c] = target.id;
                initUnitWorldPos(target);
            }
            var dmg = Math.round(target.maxHp * 0.15);
            applyPureDamage(target, dmg, caster);
            addDamageNumber(target, dmg, 'magic');
            return true;

        // ========== VALERIO ==========

        case 'valerio_scossa':
            for (var i = 0; i < aliveEnemies.length; i++) {
                if (chebyshevDist(caster.row, caster.col, aliveEnemies[i].row, aliveEnemies[i].col) <= 2) {
                    var dmg = S(Math.round(caster.atk * 0.80));
                    aliveEnemies[i].hp -= dmg;
                    addDamageNumber(aliveEnemies[i], dmg, 'normal');
                    if (aliveEnemies[i].hp <= 0) { aliveEnemies[i].hp = 0; aliveEnemies[i].alive = false; }
                    applyEffect(aliveEnemies[i], { type: 'freeze', ticksLeft: 1, sourceType: 'skill_scossa' }, caster);
                }
            }
            return true;

        case 'valerio_muro':
            caster._muroArmorBonus = Math.round(caster.armor * 0.60);
            caster.armor += caster._muroArmorBonus;
            caster._muroTicks = 4;
            return true;

        case 'valerio_regen_exp':
            var heal = S(Math.round(caster.maxHp * 0.25));
            caster.hp = Math.min(caster.maxHp, caster.hp + heal);
            addDamageNumber(caster, heal, 'magic');
            return true;

        case 'valerio_divorare':
            if (!target) return false;
            var dmg = S(Math.round(caster.atk * 2.0));
            target.hp -= dmg;
            addDamageNumber(target, dmg, 'normal');
            if (target.hp <= 0) { target.hp = 0; target.alive = false; }
            var heal = Math.round(dmg * 0.50);
            caster.hp = Math.min(caster.maxHp, caster.hp + heal);
            return true;

        case 'valerio_tana':
            caster._burrowed = true;
            caster._burrowTicks = 2;
            caster._untargetable = true;
            return true;

        case 'valerio_spore':
            for (var i = 0; i < aliveEnemies.length; i++) {
                if (chebyshevDist(caster.row, caster.col, aliveEnemies[i].row, aliveEnemies[i].col) <= 3) {
                    applyEffect(aliveEnemies[i], { type: 'poison', value: Math.round(aliveEnemies[i].maxHp * 0.015), ticksLeft: 4, stacking: 'refresh', sourceType: 'skill_spore' }, caster);
                }
            }
            return true;

        case 'valerio_provocazione':
            for (var i = 0; i < aliveEnemies.length; i++) {
                aliveEnemies[i]._forcedTargetId = caster.id;
                aliveEnemies[i]._forcedTargetTicks = 3;
            }
            return true;

        case 'valerio_scudo_simb':
            if (!target) return false;
            target.shield += Math.round(caster.maxHp * 0.20);
            return true;

        case 'valerio_metamorfosi': {
            var hpBonus = Math.round(caster.maxHp * 0.30);
            caster.maxHp += hpBonus;
            caster.hp += hpBonus;
            caster._metamorfosiHpBonus = hpBonus;
            caster._metamorfosiTicks = 5;
            caster._metamorfosiRegenMult = 3;
            return true;
        }

        case 'valerio_terremoto': {
            var sacrifice = Math.round(caster.hp * 0.15);
            if (sacrifice >= caster.hp) sacrifice = caster.hp - 1; // Don't kill self
            if (sacrifice < 1) sacrifice = 1;
            caster.hp -= sacrifice;
            for (var i = 0; i < aliveEnemies.length; i++) {
                aliveEnemies[i].hp -= sacrifice;
                addDamageNumber(aliveEnemies[i], sacrifice, 'normal');
                if (aliveEnemies[i].hp <= 0) { aliveEnemies[i].hp = 0; aliveEnemies[i].alive = false; }
                applyEffect(aliveEnemies[i], { type: 'freeze', ticksLeft: 1, sourceType: 'skill_terremoto' }, caster);
            }
            return true;
        }

        // ========== YUJIN ==========

        case 'yujin_urlo':
            for (var i = 0; i < aliveAllies.length; i++) {
                aliveAllies[i]._urloAtkBonus = Math.round(aliveAllies[i].atk * 0.20);
                aliveAllies[i].atk += aliveAllies[i]._urloAtkBonus;
                aliveAllies[i]._urloTicks = 3;
            }
            return true;

        case 'yujin_esecutore':
            if (!target) return false;
            var mult = (target.hp / target.maxHp < 0.30) ? 5.0 * LV : 2.5 * LV;
            var dmg = Math.round(caster.atk * mult);
            target.hp -= dmg;
            addDamageNumber(target, dmg, 'crit');
            if (target.hp <= 0) { target.hp = 0; target.alive = false; }
            return true;

        case 'yujin_carica':
            if (!target) return false;
            // Dash to adjacent cell
            var freeCell = findFreeCellAdjacentTo(target.row, target.col, grid);
            if (freeCell) {
                if (grid[caster.row]) grid[caster.row][caster.col] = null;
                caster.row = freeCell.r; caster.col = freeCell.c;
                if (grid[freeCell.r]) grid[freeCell.r][freeCell.c] = caster.id;
                initUnitWorldPos(caster);
            }
            var dmg = S(Math.round(caster.atk * 1.50));
            target.hp -= dmg;
            addDamageNumber(target, dmg, 'crit');
            if (target.hp <= 0) { target.hp = 0; target.alive = false; }
            applyEffect(target, { type: 'freeze', ticksLeft: 1, sourceType: 'skill_carica' }, caster);
            return true;

        case 'yujin_ghiaccio':
            caster.shield += Math.round(caster.maxHp * 0.20);
            caster._reflectDmgPercent = 0.15;
            caster._reflectDmgTicks = 3;
            return true;

        case 'yujin_vento':
            for (var i = 0; i < aliveEnemies.length; i++) {
                var e = aliveEnemies[i];
                if (chebyshevDist(caster.row, caster.col, e.row, e.col) <= 2) {
                    // Push 1 cell away
                    var dr = Math.sign(e.row - caster.row);
                    var dc = Math.sign(e.col - caster.col);
                    var newR = e.row + dr;
                    var newC = e.col + dc;
                    if (isValidCell(newR, newC) && grid[newR] && grid[newR][newC] === null) {
                        grid[e.row][e.col] = null;
                        e.row = newR; e.col = newC;
                        grid[newR][newC] = e.id;
                        initUnitWorldPos(e);
                    }
                    applyEffect(e, { type: 'speed_reduction', value: 0.25, ticksLeft: 2, sourceType: 'skill_vento' }, caster);
                }
            }
            return true;

        case 'yujin_giuramento': {
            var sacrifice = Math.round(caster.hp * 0.15);
            caster.hp -= sacrifice;
            if (caster.hp <= 0) caster.hp = 1;
            caster._lifestealPercent = 0.30;
            caster._lifestealTicks = 4;
            return true;
        }

        case 'yujin_frenesia':
            if (!target) return false;
            for (var hit = 0; hit < 3; hit++) {
                if (!target.alive) break;
                var dmg = Math.round(caster.atk * 0.70);
                target.hp -= dmg;
                addDamageNumber(target, dmg, 'normal');
                if (target.hp <= 0) { target.hp = 0; target.alive = false; }
            }
            return true;

        case 'yujin_muro_lame':
            caster._counterDmgPercent = 0.40;
            caster._counterDmgTicks = 3;
            return true;

        case 'yujin_ragnarok_p':
            caster._ragnarokPAtkBonus = Math.round(caster.atk * 0.60);
            caster.atk += caster._ragnarokPAtkBonus;
            caster._ragnarokPTicks = 4;
            caster._ragnarokPDrain = Math.round(caster.maxHp * 0.04);
            return true;

        case 'yujin_valchiria':
            caster._invulnerable = true;
            caster._invulnerableTicks = 1;
            caster._valkyrieNextAtk = true; // 600% next attack
            return true;

        // ========== WMS ==========

        case 'wms_distorsione':
            for (var i = 0; i < aliveAllies.length; i++) {
                if (aliveAllies[i].abilityCooldown > 0) {
                    aliveAllies[i].abilityCooldown = Math.max(0, aliveAllies[i].abilityCooldown - 3);
                }
            }
            return true;

        case 'wms_benedizione':
            if (!target) return false;
            var bonus20 = 0.20;
            target._benedizioneTicks = 4;
            target._benedizioneAtkBonus = Math.round(target.atk * bonus20);
            target.atk += target._benedizioneAtkBonus;
            target._benedizioneArmorBonus = Math.round(target.armor * bonus20);
            target.armor += target._benedizioneArmorBonus;
            var hpBonus = Math.round(target.maxHp * bonus20);
            target.maxHp += hpBonus;
            target.hp += hpBonus;
            target._benedizioneHpBonus = hpBonus;
            return true;

        case 'wms_essenza':
            for (var i = 0; i < aliveAllies.length; i++) {
                var heal = Math.round(aliveAllies[i].maxHp * 0.10);
                aliveAllies[i].hp = Math.min(aliveAllies[i].maxHp, aliveAllies[i].hp + heal);
            }
            return true;

        case 'wms_specchio':
            caster._reflectDmgPercent = 0.50;
            caster._reflectDmgTicks = 4;
            return true;

        case 'wms_vuoto':
            if (!target) return false;
            target.effects = [];
            // Remove positive state flags
            if (target.furiaActive) {
                target.furiaActive = false;
                target.atkSpeedMultiplier /= (1 + 0.60);
                target.dmgMultiplier /= (1 + 0.20);
            }
            target.shield = 0;
            target._reflectDmgPercent = 0;
            target._lifestealPercent = 0;
            target._invulnerable = false;
            target._dmgReduction = 0;
            target._counterDmgPercent = 0;
            target._valkyrieNextAtk = false;
            target._untargetable = false;
            return true;

        case 'wms_anomalia':
            for (var i = 0; i < aliveEnemies.length; i++) {
                var e = aliveEnemies[i];
                if (chebyshevDist(caster.row, caster.col, e.row, e.col) <= 4) {
                    // Pull toward WMS
                    var dr = Math.sign(caster.row - e.row);
                    var dc = Math.sign(caster.col - e.col);
                    for (var step = 0; step < 2; step++) {
                        var newR = e.row + dr;
                        var newC = e.col + dc;
                        if (isValidCell(newR, newC) && grid[newR] && grid[newR][newC] === null) {
                            grid[e.row][e.col] = null;
                            e.row = newR; e.col = newC;
                            grid[newR][newC] = e.id;
                        } else break;
                    }
                    initUnitWorldPos(e);
                    var dmg = Math.round(e.maxHp * 0.05);
                    e.hp -= dmg;
                    addDamageNumber(e, dmg, 'magic');
                    if (e.hp <= 0) { e.hp = 0; e.alive = false; }
                }
            }
            return true;

        case 'wms_sdoppiamento':
            caster._doubleStrike = true;
            caster._doubleStrikeTicks = 4;
            return true;

        case 'wms_onda':
            for (var i = 0; i < aliveEnemies.length; i++) {
                var dmg = Math.round(aliveEnemies[i].hp * 0.08);
                applyPureDamage(aliveEnemies[i], dmg, caster);
                addDamageNumber(aliveEnemies[i], dmg, 'magic');
            }
            return true;

        case 'wms_trascendenza':
            caster._invulnerable = true;
            caster._invulnerableTicks = 2;
            for (var i = 0; i < aliveAllies.length; i++) {
                if (aliveAllies[i].id !== caster.id) {
                    aliveAllies[i]._dmgReduction = 0.15;
                    aliveAllies[i]._dmgReductionTicks = 4;
                }
            }
            return true;

        case 'wms_singolarita':
            for (var i = 0; i < aliveEnemies.length; i++) {
                applyEffect(aliveEnemies[i], { type: 'freeze', ticksLeft: D(2), sourceType: 'skill_singolarita' }, caster);
            }
            return true;

        // ========== BOSS SKILLS (universali) ==========

        case 'boss_morso_velenoso':
            if (!target) return false;
            applyEffect(target, { type: 'poison', ticksLeft: D(4), value: Math.round(target.maxHp * 0.04 * LV), sourceType: 'skill_morso_velenoso' }, caster);
            return true;

        case 'boss_scudo_pietra':
            caster.shield = (caster.shield || 0) + S(Math.round(caster.maxHp * 0.30));
            applyEffect(caster, { type: 'shield', ticksLeft: D(4), value: 0, sourceType: 'skill_scudo_pietra' }, caster);
            return true;

        case 'boss_onda_urto':
            if (!target) return false;
            var ondaDmg = S(Math.round(caster.maxHp * 0.12));
            for (var oi = 0; oi < aliveEnemies.length; oi++) {
                var oDist = chebyshevDist(target.row, target.col, aliveEnemies[oi].row, aliveEnemies[oi].col);
                if (oDist <= 3) {
                    aliveEnemies[oi].hp -= ondaDmg;
                    if (aliveEnemies[oi].hp <= 0) { aliveEnemies[oi].hp = 0; aliveEnemies[oi].alive = false; }
                    addDamageNumber(aliveEnemies[oi], ondaDmg, 'magic');
                }
            }
            return true;

        case 'boss_divorare':
            if (!target) return false;
            var devDmg = S(Math.round(caster.atk * 2.0));
            target.hp -= devDmg;
            if (target.hp <= 0) { target.hp = 0; target.alive = false; }
            addDamageNumber(target, devDmg, 'physical');
            var heal = Math.round(devDmg * 0.5);
            caster.hp = Math.min(caster.maxHp, caster.hp + heal);
            addDamageNumber(caster, heal, 'heal');
            return true;

        case 'boss_furia_ancestrale': {
            var furiaAtkBonus = Math.round(caster.baseAtk * 0.80 * LV);
            caster.atk += furiaAtkBonus;
            caster._furiaAncAtkBonus = furiaAtkBonus;
            caster._furiaAncOrigSpeed = caster.atkSpeed;
            caster.atkSpeed = caster.baseAtkSpeed * 0.60;
            caster._furiaAncTicks = D(5);
            return true;
        }

        default:
            return false;
    }
}

// --- Process combat zones each tick ---
function processCombatZones(teams, allUnits) {
    var remaining = [];
    for (var z = 0; z < combatZones.length; z++) {
        var zone = combatZones[z];
        zone.ticksLeft--;

        // Deal damage to enemies in zone
        for (var i = 0; i < allUnits.length; i++) {
            var u = allUnits[i];
            if (!u.alive) continue;
            if (String(u.owner) === String(zone.ownerId)) continue; // Don't damage own team
            if (chebyshevDist(u.row, u.col, zone.row, zone.col) <= zone.radius) {
                var dmg = Math.round(u.maxHp * zone.value);
                if (zone.dmgType === 'pure') {
                    applyPureDamage(u, dmg, null);
                } else {
                    u.hp -= dmg;
                    if (u.hp <= 0) { u.hp = 0; u.alive = false; }
                }
                addDamageNumber(u, dmg, 'magic');
            }
        }

        if (zone.ticksLeft > 0) remaining.push(zone);
    }
    combatZones = remaining;
}

// --- Process skill buff expirations (called each tick from runCombatTick) ---
function processSkillBuffs(allUnits, grid) {
    for (var i = 0; i < allUnits.length; i++) {
        var u = allUnits[i];
        if (!u.alive) continue;

        // Contrattazione expiry (Babidi)
        if (u._contrattazioneTicks !== undefined && u._contrattazioneTicks > 0) {
            u._contrattazioneTicks--;
            if (u._contrattazioneTicks <= 0 && u._stolenAtk) {
                u.atk -= u._stolenAtk;
                // Restore stolen ATK to the target
                if (u._stolenAtkTargetId) {
                    for (var st = 0; st < allUnits.length; st++) {
                        if (allUnits[st].id === u._stolenAtkTargetId && allUnits[st].alive) {
                            allUnits[st].atk += u._stolenAtk;
                            break;
                        }
                    }
                }
                u._stolenAtk = 0;
                u._stolenAtkTargetId = null;
            }
        }

        // Fuga dodge expiry
        if (u._fugaDodgeTicks !== undefined && u._fugaDodgeTicks > 0) {
            u._fugaDodgeTicks--;
            if (u._fugaDodgeTicks <= 0) u.dodgeChance -= 0.25;
        }

        // Poison damage multiplier expiry
        if (u._poisonDmgMultTicks !== undefined && u._poisonDmgMultTicks > 0) {
            u._poisonDmgMultTicks--;
            if (u._poisonDmgMultTicks <= 0) u._poisonDmgMult = 1.0;
        }

        // Rete di Contatti expiry
        if (u._reteTicks !== undefined && u._reteTicks > 0) {
            u._reteTicks--;
            if (u._reteTicks <= 0 && u._reteAtkFlat) {
                u.atk -= u._reteAtkFlat;
                u._reteAtkFlat = 0;
            }
        }

        // Monopolio
        if (u._monopolioTicks !== undefined && u._monopolioTicks > 0) {
            u._monopolioTicks--;
        }

        // Plagio expiry
        if (u._plagioTicks !== undefined && u._plagioTicks > 0) {
            u._plagioTicks--;
            if (u._plagioTicks <= 0 && u._plagioOrigAtk !== undefined) {
                u.atk = u._plagioOrigAtk;
                u._plagioOrigAtk = undefined;
            }
        }

        // Furia Ancestrale expiry (boss skill)
        if (u._furiaAncTicks !== undefined && u._furiaAncTicks > 0) {
            u._furiaAncTicks--;
            if (u._furiaAncTicks <= 0) {
                if (u._furiaAncAtkBonus) { u.atk -= u._furiaAncAtkBonus; u._furiaAncAtkBonus = 0; }
                if (u._furiaAncOrigSpeed) { u.atkSpeed = u._furiaAncOrigSpeed; u._furiaAncOrigSpeed = 0; }
            }
        }

        // Muro di Segmenti expiry
        if (u._muroTicks !== undefined && u._muroTicks > 0) {
            u._muroTicks--;
            if (u._muroTicks <= 0 && u._muroArmorBonus) {
                u.armor -= u._muroArmorBonus;
                u._muroArmorBonus = 0;
            }
        }

        // Tana Sotterranea
        if (u._burrowed && u._burrowTicks !== undefined) {
            u._burrowTicks--;
            if (u._burrowTicks <= 0) {
                u._burrowed = false;
                u._untargetable = false;
                // AOE emerge damage
                var enemies = getEnemiesOf(u, combatTeams);
                for (var e = 0; e < enemies.length; e++) {
                    if (enemies[e].alive && chebyshevDist(u.row, u.col, enemies[e].row, enemies[e].col) <= 2) {
                        var dmg = Math.round(u.atk * 1.0);
                        enemies[e].hp -= dmg;
                        addDamageNumber(enemies[e], dmg, 'normal');
                        if (enemies[e].hp <= 0) { enemies[e].hp = 0; enemies[e].alive = false; }
                    }
                }
                combatLog.push(u.charId + ' riemerge dalla tana!');
            }
        }

        // Metamorfosi expiry
        if (u._metamorfosiTicks !== undefined && u._metamorfosiTicks > 0) {
            u._metamorfosiTicks--;
            if (u._metamorfosiTicks <= 0 && u._metamorfosiHpBonus) {
                u.maxHp -= u._metamorfosiHpBonus;
                u.hp = Math.min(u.hp, u.maxHp);
                u._metamorfosiRegenMult = 1;
                u._metamorfosiHpBonus = 0;
            }
        }

        // Urlo di Guerra expiry
        if (u._urloTicks !== undefined && u._urloTicks > 0) {
            u._urloTicks--;
            if (u._urloTicks <= 0 && u._urloAtkBonus) {
                u.atk -= u._urloAtkBonus;
                u._urloAtkBonus = 0;
            }
        }

        // Scudo di Ghiaccio / Specchio Cosmico reflect expiry
        if (u._reflectDmgTicks !== undefined && u._reflectDmgTicks > 0) {
            u._reflectDmgTicks--;
            if (u._reflectDmgTicks <= 0) u._reflectDmgPercent = 0;
        }

        // Lifesteal expiry
        if (u._lifestealTicks !== undefined && u._lifestealTicks > 0) {
            u._lifestealTicks--;
            if (u._lifestealTicks <= 0) u._lifestealPercent = 0;
        }

        // Counter damage expiry
        if (u._counterDmgTicks !== undefined && u._counterDmgTicks > 0) {
            u._counterDmgTicks--;
            if (u._counterDmgTicks <= 0) u._counterDmgPercent = 0;
        }

        // Ragnarok Personale drain + expiry
        if (u._ragnarokPTicks !== undefined && u._ragnarokPTicks > 0) {
            u.hp -= u._ragnarokPDrain || 0;
            if (u.hp <= 1) u.hp = 1;
            u._ragnarokPTicks--;
            if (u._ragnarokPTicks <= 0 && u._ragnarokPAtkBonus) {
                u.atk -= u._ragnarokPAtkBonus;
                u._ragnarokPAtkBonus = 0;
            }
        }

        // Invulnerable expiry
        if (u._invulnerableTicks !== undefined && u._invulnerableTicks > 0) {
            u._invulnerableTicks--;
            if (u._invulnerableTicks <= 0) u._invulnerable = false;
        }

        // Forced target expiry
        if (u._forcedTargetTicks !== undefined && u._forcedTargetTicks > 0) {
            u._forcedTargetTicks--;
            if (u._forcedTargetTicks <= 0) u._forcedTargetId = null;
        }

        // Benedizione expiry
        if (u._benedizioneTicks !== undefined && u._benedizioneTicks > 0) {
            u._benedizioneTicks--;
            if (u._benedizioneTicks <= 0) {
                if (u._benedizioneAtkBonus) { u.atk -= u._benedizioneAtkBonus; u._benedizioneAtkBonus = 0; }
                if (u._benedizioneArmorBonus) { u.armor -= u._benedizioneArmorBonus; u._benedizioneArmorBonus = 0; }
                if (u._benedizioneHpBonus) {
                    u.maxHp -= u._benedizioneHpBonus;
                    u.hp = Math.min(u.hp, u.maxHp);
                    u._benedizioneHpBonus = 0;
                }
            }
        }

        // Damage reduction expiry
        if (u._dmgReductionTicks !== undefined && u._dmgReductionTicks > 0) {
            u._dmgReductionTicks--;
            if (u._dmgReductionTicks <= 0) u._dmgReduction = 0;
        }

        // Double strike expiry
        if (u._doubleStrikeTicks !== undefined && u._doubleStrikeTicks > 0) {
            u._doubleStrikeTicks--;
            if (u._doubleStrikeTicks <= 0) u._doubleStrike = false;
        }

        // Guaranteed crit consumed on next hit (handled in combat.js)
    }
}

// --- AI auto-uses skills during combat (called each tick for AI units) ---
function aiUseSkills(teams, grid, allUnits) {
    for (var i = 0; i < allUnits.length; i++) {
        var unit = allUnits[i];
        if (!unit.alive || unit.owner === 0 || typeof unit.owner !== 'number') continue;
        if (!unit.equippedSkills || unit.equippedSkills.length === 0) continue;
        if (unit._burrowed) continue;
        if (hasEffect(unit, 'silence') || hasEffect(unit, 'freeze') || hasEffect(unit, 'stun')) continue;

        // AI uses one skill per tick with some randomness
        if (Math.random() > 0.15) continue; // ~15% chance per tick to try a skill

        var orig = findOriginalUnit(unit.id);

        for (var s = 0; s < unit.equippedSkills.length; s++) {
            var sid = unit.equippedSkills[s];
            if (unit._usedSkills && unit._usedSkills[sid]) continue;
            if (orig && !isSkillReady(orig, sid)) continue;

            var sd = SKILLS[sid];
            if (!sd) continue;

            var target = null;
            if (sd.target === 'enemy') {
                var enemies = getEnemiesOf(unit, teams);
                var aliveE = [];
                for (var e = 0; e < enemies.length; e++) { if (enemies[e].alive) aliveE.push(enemies[e]); }
                if (aliveE.length === 0) continue;
                // Pick nearest or random target within range
                var inRange = [];
                for (var e = 0; e < aliveE.length; e++) {
                    if (chebyshevDist(unit.row, unit.col, aliveE[e].row, aliveE[e].col) <= (sd.range || 99)) {
                        inRange.push(aliveE[e]);
                    }
                }
                if (inRange.length === 0) continue;
                target = inRange[Math.floor(Math.random() * inRange.length)];
            } else if (sd.target === 'ally') {
                var allies = getAlliesOf(unit, teams);
                var aliveA = [];
                for (var a = 0; a < allies.length; a++) { if (allies[a].alive && allies[a].id !== unit.id) aliveA.push(allies[a]); }
                if (aliveA.length === 0) continue;
                target = aliveA[Math.floor(Math.random() * aliveA.length)];
            }

            var success = executeSkillEffect(sid, unit, target, teams, grid, allUnits);
            if (success) {
                if (orig) setSkillCooldown(orig, sid);
                if (!unit._usedSkills) unit._usedSkills = {};
                unit._usedSkills[sid] = true;
                combatLog.push(unit.charId + ' (AI) usa ' + sd.name + '!');
                if (typeof vfxForSkill === 'function') vfxForSkill(sid, unit, target, allUnits);
                spawnSkillCastIndicator(unit, sd);
                break; // one skill per tick
            }
        }
    }
}

// =============================================
// SKILL CAST INDICATOR — floating skill name + icon above unit
// =============================================
var skillCastIndicators = []; // { x, y, text, icon, color, life, maxLife, vy }

function spawnSkillCastIndicator(unit, skillDef) {
    if (!unit || !skillDef) return;
    var pos = typeof cellToPixel === 'function' ? cellToPixel(unit.row, unit.col) : { x: 0, y: 0 };
    skillCastIndicators.push({
        x: pos.x,
        y: pos.y - CELL_SIZE * 0.6,
        text: skillDef.icon + ' ' + skillDef.name,
        color: (typeof CHAR_COLORS !== 'undefined' && CHAR_COLORS[unit.charId]) ? CHAR_COLORS[unit.charId].fill : '#a78bfa',
        life: 1.8,
        maxLife: 1.8,
        vy: -25,
        owner: unit.owner,
    });
}

function updateSkillCastIndicators(dt) {
    var alive = [];
    for (var i = 0; i < skillCastIndicators.length; i++) {
        var ind = skillCastIndicators[i];
        ind.life -= dt;
        if (ind.life <= 0) continue;
        ind.y += ind.vy * dt;
        ind.vy *= 0.97;
        alive.push(ind);
    }
    skillCastIndicators = alive;
}

function renderSkillCastIndicators(ctx) {
    for (var i = 0; i < skillCastIndicators.length; i++) {
        var ind = skillCastIndicators[i];
        var alpha = Math.min(1, ind.life / (ind.maxLife * 0.3));
        ctx.save();
        ctx.globalAlpha = alpha;

        // Background pill
        ctx.font = 'bold 12px sans-serif';
        var textW = ctx.measureText(ind.text).width;
        var pillW = textW + 16;
        var pillH = 22;
        var px = ind.x - pillW / 2;
        var py = ind.y - pillH / 2;
        var pr = 6;

        ctx.fillStyle = 'rgba(15,17,23,0.85)';
        ctx.beginPath();
        ctx.moveTo(px + pr, py);
        ctx.lineTo(px + pillW - pr, py);
        ctx.arcTo(px + pillW, py, px + pillW, py + pr, pr);
        ctx.lineTo(px + pillW, py + pillH - pr);
        ctx.arcTo(px + pillW, py + pillH, px + pillW - pr, py + pillH, pr);
        ctx.lineTo(px + pr, py + pillH);
        ctx.arcTo(px, py + pillH, px, py + pillH - pr, pr);
        ctx.lineTo(px, py + pr);
        ctx.arcTo(px, py, px + pr, py, pr);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ind.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Text
        ctx.fillStyle = ind.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ind.text, ind.x, ind.y);

        ctx.restore();
    }
}

// =============================================
// SKILL COOLDOWN HUD — persistent overlay during combat
// =============================================
function renderSkillCooldownHUD(ctx) {
    if (typeof gamePhase === 'undefined' || gamePhase !== PHASE_COMBAT) return;
    if (typeof players === 'undefined' || !getHumanPlayer()) return;

    var human = getHumanPlayer();
    var hudX = 12;
    var hudY = 70;

    // Find human's combat units
    var humanUnits = [];
    if (typeof combatUnits !== 'undefined') {
        for (var i = 0; i < combatUnits.length; i++) {
            var _mySlot = (window.mySlotId !== null && window.mySlotId !== undefined) ? window.mySlotId : 0;
            if (combatUnits[i].owner === _mySlot && combatUnits[i].alive) humanUnits.push(combatUnits[i]);
        }
    }
    if (humanUnits.length === 0) return;

    ctx.save();

    for (var u = 0; u < humanUnits.length; u++) {
        var unit = humanUnits[u];
        if (!unit.equippedSkills || unit.equippedSkills.length === 0) continue;

        var colors = (typeof CHAR_COLORS !== 'undefined' && CHAR_COLORS[unit.charId]) ? CHAR_COLORS[unit.charId] : { fill: '#888' };
        var orig = typeof findOriginalUnit === 'function' ? findOriginalUnit(unit.id) : null;

        // Unit name header
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = colors.fill;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(unit.charId, hudX, hudY);
        hudY += 14;

        // Skill slots
        for (var s = 0; s < unit.equippedSkills.length; s++) {
            var sid = unit.equippedSkills[s];
            var sd = typeof SKILLS !== 'undefined' ? SKILLS[sid] : null;
            if (!sd) continue;

            var cdLeft = (orig && orig.skillCooldowns && orig.skillCooldowns[sid]) ? orig.skillCooldowns[sid] : 0;
            var used = unit._usedSkills && unit._usedSkills[sid];
            var ready = !used && cdLeft <= 0;

            // Background
            ctx.fillStyle = ready ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)';
            ctx.fillRect(hudX, hudY, 140, 18);
            ctx.strokeStyle = ready ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(hudX, hudY, 140, 18);

            // Icon + name
            ctx.font = '11px sans-serif';
            ctx.fillStyle = ready ? '#34d399' : '#64748b';
            ctx.textAlign = 'left';
            ctx.fillText(sd.icon + ' ' + sd.name, hudX + 4, hudY + 3);

            // Status
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'right';
            if (used) {
                ctx.fillStyle = '#ef4444';
                ctx.fillText('USATA', hudX + 136, hudY + 4);
            } else if (cdLeft > 0) {
                ctx.fillStyle = '#ef4444';
                ctx.fillText(cdLeft + 'r', hudX + 136, hudY + 4);
            } else {
                ctx.fillStyle = '#34d399';
                ctx.fillText('OK', hudX + 136, hudY + 4);
            }

            hudY += 20;
        }
        hudY += 6;
    }

    ctx.restore();
}
