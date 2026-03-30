// ============================================================
// LOTA AUTO CHESS — config.js — Global constants & state
// ============================================================

// --- Canvas ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- Board ---
const BOARD_ROWS = 66;
const BOARD_COLS = 66;
const OCTAGON_CUT = 18; // cells cut from each corner

// --- Team Colors ---
const TEAM_COLORS = {
    0: { primary: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  outline: 'rgba(59,130,246,0.6)', name: 'Blu'     },
    1: { primary: '#ef4444', bg: 'rgba(239,68,68,0.12)',   outline: 'rgba(239,68,68,0.6)',  name: 'Rosso'   },
    2: { primary: '#22c55e', bg: 'rgba(34,197,94,0.12)',   outline: 'rgba(34,197,94,0.6)',  name: 'Verde'   },
    3: { primary: '#fb923c', bg: 'rgba(251,146,60,0.12)',  outline: 'rgba(251,146,60,0.6)', name: 'Arancio' },
};

const COL_CAMP = 'rgba(180,60,60,0.18)';

// --- Creep Camp Positions (diagonal edges of octagon) ---
// Camp positions: 4 camps between bases (accessible corridors)
// Each camp is a cluster of 3 cells near the midpoint between two bases
const CREEP_CAMP_POSITIONS = {
    NW: [{r:12, c:12}, {r:12, c:13}, {r:13, c:12}],   // between Nord and Ovest
    NE: [{r:12, c:51}, {r:12, c:52}, {r:13, c:52}],   // between Nord and Est
    SW: [{r:51, c:12}, {r:52, c:12}, {r:52, c:13}],   // between Sud and Ovest
    SE: [{r:51, c:52}, {r:52, c:51}, {r:52, c:52}],   // between Sud and Est
};

// --- Dungeon Boss System (5 tiers, each dungeon independent) ---
const DUNGEON_BOSS_TIERS = [
    { tier: 1, name: 'Sentinella Oscura',   hp: 8000,   atk: 80,   armor: 5,   atkSpeed: 1.6, range: 1, gold: 3,  itemTier: 1, skillDrop: 'boss_morso_velenoso',   modelKey: 'velociraptor',      modelFile: 'models/dungeon-boss-velociraptor.glb' },
    { tier: 2, name: 'Guardiano di Pietra',  hp: 18000,  atk: 140,  armor: 15,  atkSpeed: 1.4, range: 1, gold: 5,  itemTier: 2, skillDrop: 'boss_scudo_pietra',      modelKey: 'stegosaurus',       modelFile: 'models/dungeon-boss-stegosaurus.glb' },
    { tier: 3, name: 'Araldo del Caos',      hp: 35000,  atk: 220,  armor: 22,  atkSpeed: 1.3, range: 1, gold: 8,  itemTier: 2, skillDrop: 'boss_onda_urto',          modelKey: 'parasaurolophus',   modelFile: 'models/dungeon-boss-parasaurolophus.glb' },
    { tier: 4, name: 'Divoratore d\'Ossa',   hp: 55000,  atk: 320,  armor: 30,  atkSpeed: 1.2, range: 1, gold: 12, itemTier: 3, skillDrop: 'boss_divorare',           modelKey: 'triceratops',      modelFile: 'models/dungeon-boss-triceratops.glb' },
    { tier: 5, name: 'Custode Ancestrale',   hp: 90000,  atk: 450,  armor: 40,  atkSpeed: 1.0, range: 1, gold: 18, itemTier: 3, skillDrop: 'boss_furia_ancestrale',   modelKey: 'trex',             modelFile: 'models/dungeon-boss-trex.glb' },
];
const MAX_DUNGEON_TIER = DUNGEON_BOSS_TIERS.length; // 5

const DUNGEON_BOSS_POSITIONS = {
    NW: { r: 4,  c: 4  },
    NE: { r: 4,  c: 61 },
    SW: { r: 61, c: 4  },
    SE: { r: 61, c: 61 },
};

// --- Camp Creep Tiers (scale with round) ---
const CAMP_CREEP_TIERS = {
    early:   { minRound:1,  maxRound:10, name:'Sentinella',  hp:800,   atk:20,  armor:2,  atkSpeed:2.0, range:1, goldReward:1.5, consumableTier:1, mobCount:1, ability:null },
    mid:     { minRound:11, maxRound:25, name:'Guardiano',   hp:4000,  atk:60,  armor:5,  atkSpeed:1.6, range:1, goldReward:2.5, itemTier:1, consumableTier:1, mobCount:1, ability:'slow' },
    late:    { minRound:26, maxRound:40, name:'Custode',      hp:12000, atk:120, armor:10, atkSpeed:1.3, range:2, goldReward:3.5, itemTier:2, consumableTier:2, mobCount:2, ability:'poison' },
    endgame: { minRound:41, maxRound:50, name:'Titano',       hp:25000, atk:200, armor:15, atkSpeed:1.1, range:2, goldReward:5.0, itemTier:2, consumableTier:3, mobCount:2, ability:'aoe' },
};

// --- Combat ---
const CRIT_CHANCE_BASE = 0.08;
const CRIT_MULTIPLIER = 2.0;
const MISS_CHANCE = 0.05;
const DAMAGE_VARIANCE = 0.15;
const TICK_DURATION_S = 1.0;
const MAX_TICKS = 40;
const ARMOR_K = 50;

// --- Damage types ---
const DMG_PHYSICAL = 'physical';
const DMG_MAGIC = 'magic';
const DMG_MAGIC_PURE = 'magic_pure';

// --- Economy ---
const PLAYER_START_HP = 30;
const PLAYER_MAX_HP = 30;
const STARTING_GOLD = 0;
const BASE_INCOME = 1.0;
const PVP_WIN_GOLD = 2.0;
const PVP_KILL_GOLD = 1;          // +1 oro per ogni unità nemica uccisa
const BABIDI_GOLD_PER_STAR = [0.4, 0.8, 1.2, 1.5, 1.8];
const FIELD_SLOT_COSTS = [0, 8, 18, 45];
const BENCH_SLOT_COSTS = [0, 4, 8];
const BENCH_MAINTENANCE = [0, 0.3, 0.5];
const HP_PURCHASE_COST = 4;
const COMBAT_DAMAGE_TABLE = {
    early:  { minRound: 1,  maxRound: 3,  min: 2, max: 2 },
    mid:    { minRound: 4,  maxRound: 12, min: 2, max: 4 },
    late:   { minRound: 13, maxRound: 28, min: 2, max: 6 },
    endgame:{ minRound: 29, maxRound: 50, min: 1, max: 6 },
};

// --- Stars ---
const STAR_COPIES_NEEDED = [1, 2, 4, 8, 20];
const STAR5_POOL_REMOVAL = 20;
const STAR5_GOLD_BONUS = 20;

// --- Draft ---
const DRAFT_CARDS_SHOWN = 2;
const DRAFT_CARDS_CHOSEN = 1;
const PVE_ROUNDS = [5, 10, 15, 20, 25, 30, 35, 40, 45];
const TOTAL_PVP_ROUNDS = 50;

// --- Item ---
const MAX_ITEMS_PER_UNIT = 3;
const ITEM_SWAPS_PER_PLANNING = 1;

// --- Game Phases ---
const PHASE_MENU = 'menu';
const PHASE_PLANNING = 'planning';
const PHASE_DRAFT = 'draft';
const PHASE_COMBAT = 'combat';
const PHASE_RESULT = 'result';
const PHASE_GAME_OVER = 'gameOver';

// --- Timing ---
const PLANNING_TIMER_S = 30;
const COMBAT_ANIM_TICK_MS = 600;

// --- Tactical Orders ---
const ORDER_FREE = 'free';
const ORDER_ATTACK = 'attacca';
const ORDER_HOLD = 'presidia';
const ORDER_COVER = 'copertura';
const ORDER_PROTECT = 'proteggi';
const ORDER_FOLLOW = 'segui';
const ORDER_MOVE = 'sposta';

const TACTICAL_ORDERS = {
    free:      { id: 'free',      name: 'Libero',    icon: '\u2014', color: '#94a3b8', needsTarget: false, desc: 'Comportamento di default' },
    attacca:   { id: 'attacca',   name: 'Attacca',   icon: '\u2694', color: '#ef4444', needsTarget: false, desc: '+10% danno, punta il nemico piu forte' },
    presidia:  { id: 'presidia',  name: 'Presidia',  icon: '\u25A3', color: '#3b82f6', needsTarget: false, desc: 'Non si muove, attacca nel range' },
    copertura: { id: 'copertura', name: 'Copertura', icon: '\u25C1', color: '#22c55e', needsTarget: false, desc: 'Mantiene distanza, kite attivo' },
    proteggi:  { id: 'proteggi',  name: 'Proteggi',  icon: '\u2666', color: '#fbbf24', needsTarget: true,  desc: 'Resta vicino a un alleato scelto' },
    segui:     { id: 'segui',     name: 'Segui',     icon: '\u25B6', color: '#a78bfa', needsTarget: true,  desc: 'Segue un alleato, attacca i suoi bersagli' },
    sposta:    { id: 'sposta',    name: 'Sposta',    icon: '\u2316', color: '#fb923c', needsTarget: 'cell', desc: 'Si muove verso una cella, poi difende li' },
};

// --- Biomes (visual only — no gameplay bonuses) ---
const BIOMES = {
    0: { id: 'oceano',  name: 'Abisso Oceanico',   accent: '#1e6091', particle: '#4da6ff' },
    1: { id: 'vulcano', name: 'Vulcano Infernale',  accent: '#8b1a1a', particle: '#ff6b35' },
    2: { id: 'palude',  name: 'Palude Tossica',     accent: '#2d6b2d', particle: '#4ade80' },
    3: { id: 'tundra',  name: 'Tundra del Nord',    accent: '#4a7fb5', particle: '#a5d8ff' },
};
const BIOME_CENTER = { tileDark: '#1e2333', tileLight: '#252b3d', accent: '#a78bfa', emissive: '#7c3aed' };
const CENTER_CONTROL_RADIUS = 9;    // cells from board center that count as "centro"
const CENTER_CONTROL_GOLD = 1;      // +1 gold per unit in center per turn

// --- Structures (turrets) ---
const MAX_STRUCTURES = 4;
const STRUCTURE_PLACE_RANGE = 2; // must place within 2 cells of an owned hero
const STRUCTURE_BASE_TYPES = {
    torre:     { role: 'dps',     hp: 500,  atk: 55, range: 4, atkSpeed: 1.6, armor: 2, cost: 4, desc: 'Attacco a distanza rapido' },
    catapulta: { role: 'siege',   hp: 400,  atk: 90, range: 5, atkSpeed: 3.0, armor: 1, cost: 5, desc: 'Danno elevato ad area, lento' },
    santuario: { role: 'support', hp: 600,  atk: 0,  range: 3, atkSpeed: 2.5, armor: 3, cost: 5, desc: 'Cura alleati vicini ogni tick' },
    bastione:  { role: 'defense', hp: 900,  atk: 30, range: 3, atkSpeed: 2.0, armor: 8, cost: 4, desc: 'Alta resistenza, debuffa nemici' },
};
const STRUCTURE_THEMES = {
    Babidi: {
        torre:     { name: 'Obelisco Oscuro',     icon: '\uD83D\uDD2E', color: { fill: '#a78bfa', stroke: '#7c3aed' } },
        catapulta: { name: 'Idolo Maledetto',      icon: '\uD83D\uDC80', color: { fill: '#8b5cf6', stroke: '#6d28d9' } },
        santuario: { name: 'Altare del Mercato',   icon: '\u26E9',       color: { fill: '#c4b5fd', stroke: '#a78bfa' } },
        bastione:  { name: 'Totem Velenoso',       icon: '\u2623',       color: { fill: '#7c3aed', stroke: '#5b21b6' } },
    },
    Caronte: {
        torre:     { name: 'Balista Norrena',      icon: '\uD83C\uDFF9', color: { fill: '#94a3b8', stroke: '#64748b' } },
        catapulta: { name: 'Catapulta Glaciale',   icon: '\u2744',       color: { fill: '#93c5fd', stroke: '#3b82f6' } },
        santuario: { name: 'Runa Protettiva',      icon: '\uD83D\uDEE1', color: { fill: '#cbd5e1', stroke: '#94a3b8' } },
        bastione:  { name: 'Muro Runico',          icon: '\uD83E\uDDF1', color: { fill: '#64748b', stroke: '#475569' } },
    },
    Valerio: {
        torre:     { name: 'Cannone Accademico',   icon: '\uD83D\uDD2B', color: { fill: '#fb923c', stroke: '#ea580c' } },
        catapulta: { name: 'Mortaio a Vapore',     icon: '\uD83D\uDCA3', color: { fill: '#f97316', stroke: '#c2410c' } },
        santuario: { name: 'Stazione Medica',      icon: '\u2695',       color: { fill: '#fdba74', stroke: '#fb923c' } },
        bastione:  { name: 'Barricata d\'Acciaio', icon: '\uD83D\uDEA7', color: { fill: '#ea580c', stroke: '#9a3412' } },
    },
    Yujin: {
        torre:     { name: 'Torre Laser',          icon: '\u26A1', color: { fill: '#f87171', stroke: '#dc2626' } },
        catapulta: { name: 'Drone Esplosivo',      icon: '\uD83D\uDEF8', color: { fill: '#ef4444', stroke: '#b91c1c' } },
        santuario: { name: 'Nucleo Energetico',    icon: '\uD83D\uDCA0', color: { fill: '#fca5a5', stroke: '#f87171' } },
        bastione:  { name: 'Campo di Forza',       icon: '\uD83D\uDEE1', color: { fill: '#dc2626', stroke: '#991b1b' } },
    },
    WMS: {
        torre:     { name: 'Cristallo Arcano',     icon: '\uD83D\uDC8E', color: { fill: '#fbbf24', stroke: '#d97706' } },
        catapulta: { name: 'Sfera del Caos',       icon: '\uD83C\uDF0A', color: { fill: '#fcd34d', stroke: '#f59e0b' } },
        santuario: { name: 'Fontana Mistica',      icon: '\u2728', color: { fill: '#fde68a', stroke: '#fbbf24' } },
        bastione:  { name: 'Specchio Mistico',     icon: '\uD83E\uDE9E', color: { fill: '#d97706', stroke: '#92400e' } },
    },
};

// --- Avatar System ---
const AVATAR_MAX_LEVEL = 15;
const AVATAR_XP_TABLE = [0,100,250,450,700,1000,1400,1900,2500,3200,4000,5000,6200,7600,9200]; // XP needed for each level
const AVATAR_DEATH_PENALTY = 3; // extra HP damage to player when avatar dies
const AVATAR_CLASSES = {
    stratega: {
        id:'stratega', name:'Stratega', icon:'\uD83D\uDC51',
        desc:'Comandante tattico. Aura che potenzia gli alleati vicini.',
        color:{ fill:'#3b82f6', stroke:'#1d4ed8' },
        baseStats:{ hp:1200, atk:40, armor:5, range:2, atkSpeed:1.8 },
        growth:{ hp:80, atk:5, armor:0.5 },
        commandRadius: 4,
        abilities:[
            { id:'aura_comando',  lvl:1,  type:'passive', name:'Aura di Comando',   icon:'\uD83D\uDC51', desc:'+10% ATK alleati entro 4 celle',       effect:'buff_atk',   value:0.10 },
            { id:'ordine_carica', lvl:3,  type:'active',  name:'Ordine: Carica!',   icon:'\u2694',  desc:'Alleati vicini +25% AtkSpeed 3 tick',   effect:'buff_speed', value:0.25, duration:3, cd:8 },
            { id:'scudo_tattico', lvl:7,  type:'active',  name:'Scudo Tattico',     icon:'\uD83D\uDEE1', desc:'Scudo 20% maxHP a tutti gli alleati', effect:'shield',     value:0.20, cd:12 },
            { id:'vittoria',      lvl:12, type:'active',  name:'Grido di Vittoria', icon:'\uD83C\uDFC6', desc:'+30% ATK e cura 15% HP a tutti',     effect:'ultimate',   value:0.30, heal:0.15, cd:20 },
        ],
    },
    stregone: {
        id:'stregone', name:'Stregone', icon:'\uD83D\uDD2E',
        desc:'Mago devastante. Incantesimi ad area e debuff potenti.',
        color:{ fill:'#a855f7', stroke:'#7e22ce' },
        baseStats:{ hp:800, atk:70, armor:2, range:4, atkSpeed:2.0 },
        growth:{ hp:50, atk:8, armor:0.3 },
        commandRadius: 3,
        abilities:[
            { id:'sfere_arcane',   lvl:1,  type:'passive', name:'Sfere Arcane',       icon:'\u2604',  desc:'Evoca sfere orbitanti che attaccano nemici vicini', effect:'arcane_orbs', baseOrbs:1, orbDmgMult:0.40, orbRange:3, orbCooldown:1.5 },
            { id:'nova_gelo',      lvl:3,  type:'active',  name:'Nova di Gelo',       icon:'\u2744',  desc:'Congela nemici entro 3 celle per 2 tick',  effect:'freeze_aoe',  radius:3, duration:2, cd:10 },
            { id:'pioggia_fuoco',  lvl:7,  type:'active',  name:'Pioggia di Fuoco',   icon:'\uD83D\uDD25', desc:'30% ATK danno a tutti i nemici in area', effect:'damage_aoe',  value:0.30, radius:4, cd:8 },
            { id:'apocalisse',     lvl:12, type:'active',  name:'Apocalisse',         icon:'\uD83C\uDF0B', desc:'Evoca 5 zombi che attaccano i nemici!',   effect:'summon_zombies', summonCount:5, zombieHpMult:0.30, zombieDmgMult:0.25, duration:8, cd:25 },
        ],
    },
    guerriero: {
        id:'guerriero', name:'Guerriero', icon:'\u2694',
        desc:'Combattente in prima linea. Resistenza e danni devastanti.',
        color:{ fill:'#ef4444', stroke:'#b91c1c' },
        baseStats:{ hp:1800, atk:55, armor:8, range:1, atkSpeed:1.5 },
        growth:{ hp:120, atk:6, armor:0.8 },
        commandRadius: 2,
        abilities:[
            { id:'corazza_viva',    lvl:1,  type:'passive', name:'Corazza Viva',        icon:'\uD83D\uDEE1', desc:'+15% armor, regen 1% HP/tick',           effect:'tank_passive', armorBonus:0.15, regen:0.01 },
            { id:'colpo_devastante',lvl:3,  type:'active',  name:'Colpo Devastante',    icon:'\uD83D\uDCA5', desc:'200% ATK al bersaglio + stun 1 tick',    effect:'heavy_strike', value:2.0, stun:1, cd:6 },
            { id:'grido_guerra',    lvl:7,  type:'active',  name:'Grido di Guerra',     icon:'\uD83D\uDCE3', desc:'-20% ATK nemici entro 3 celle, 4 tick',  effect:'debuff_aoe',   value:0.20, radius:3, duration:4, cd:10 },
            { id:'furia_immortale', lvl:12, type:'active',  name:'Furia Immortale',     icon:'\uD83D\uDD25', desc:'Invulnerabile 3 tick + 2x ATK',          effect:'ultimate',     value:2.0, invuln:3, cd:22 },
        ],
    },
    mistico: {
        id:'mistico', name:'Mistico', icon:'\u2728',
        desc:'Guaritore e supporto. Cure, scudi e potenziamenti.',
        color:{ fill:'#22c55e', stroke:'#15803d' },
        baseStats:{ hp:1000, atk:25, armor:4, range:3, atkSpeed:2.2 },
        growth:{ hp:60, atk:3, armor:0.4 },
        commandRadius: 5,
        abilities:[
            { id:'tocco_vitale',    lvl:1,  type:'passive', name:'Tocco Vitale',        icon:'\uD83D\uDC9A', desc:'Cura alleato piu ferito 2% HP/tick',     effect:'heal_passive', value:0.02 },
            { id:'benedizione',     lvl:3,  type:'active',  name:'Benedizione',         icon:'\u2728', desc:'Cura 25% maxHP a un alleato',            effect:'heal_single',  value:0.25, cd:7 },
            { id:'barriera_sacra',  lvl:7,  type:'active',  name:'Barriera Sacra',      icon:'\uD83D\uDD2F', desc:'Scudo 30% maxHP + immun debuff 3 tick', effect:'barrier',      value:0.30, duration:3, cd:12 },
            { id:'resurrezione',    lvl:12, type:'active',  name:'Resurrezione',        icon:'\uD83C\uDF1F', desc:'Rianima alleato morto con 50% HP',       effect:'ultimate',     value:0.50, cd:30 },
        ],
    },
};

// --- Colors ---
const COL_BG = '#0f1117';
const COL_BOARD_DARK = '#1a1f2e';
const COL_BOARD_LIGHT = '#232938';
const COL_GRID_LINE = '#2d3748';
const COL_TEXT = '#e2e8f0';
const COL_GOLD = '#fbbf24';
const COL_HP_GREEN = '#34d399';
const COL_HP_RED = '#ef4444';
const COL_CRIT = '#fbbf24';
const COL_MISS = '#94a3b8';
const COL_POISON = '#22c55e';

// --- Militia ---
const MAX_MILITIA = 6;
const MILITIA_TYPES = {
    soldato: {
        id: 'soldato', name: 'Soldato', icon: '🛡', role: 'tank',
        cost: 2, hp: 600, atk: 25, armor: 5, range: 1, atkSpeed: 2.0,
        behavior: 'tank', desc: 'Fante corazzato. Assorbe danni in prima linea.',
        color: { fill: '#6b7280', stroke: '#4b5563' },
    },
    arciere: {
        id: 'arciere', name: 'Arciere', icon: '🏹', role: 'dps',
        cost: 3, hp: 350, atk: 45, armor: 1, range: 3, atkSpeed: 1.6,
        behavior: 'kite', desc: 'Tiratore a distanza. Pressione costante.',
        color: { fill: '#65a30d', stroke: '#4d7c0f' },
    },
    guaritore: {
        id: 'guaritore', name: 'Guaritore', icon: '💚', role: 'support',
        cost: 4, hp: 450, atk: 0, armor: 2, range: 2, atkSpeed: 3.0,
        healPerTick: 0.02, healRadius: 2,
        behavior: 'kite', desc: 'Cura alleati vicini ogni tick (2% maxHP).',
        color: { fill: '#22c55e', stroke: '#16a34a' },
    },
    esploratore: {
        id: 'esploratore', name: 'Esploratore', icon: '👁', role: 'scout',
        cost: 2, hp: 300, atk: 20, armor: 0, range: 1, atkSpeed: 1.4,
        behavior: 'dps', moveSpeed: 2, desc: 'Veloce, ideale per controllare il centro.',
        color: { fill: '#06b6d4', stroke: '#0891b2' },
    },
};

const MILITIA_ORDERS = {
    posizione:  { id: 'posizione',  name: 'Posizione',  icon: '📍', color: '#3b82f6', desc: 'Resta dove piazzato, difende la zona' },
    scorta:     { id: 'scorta',     name: 'Scorta',     icon: '🤝', color: '#fbbf24', desc: 'Segue un eroe alleato, attacca i suoi nemici', needsTarget: true },
    avanzata:   { id: 'avanzata',   name: 'Avanzata',   icon: '⚔', color: '#ef4444', desc: 'Avanza verso il centro, attacca chi incontra' },
};

// Character colors
const CHAR_COLORS = {
    Babidi:  { fill: '#a78bfa', stroke: '#7c3aed' },
    Caronte: { fill: '#94a3b8', stroke: '#64748b' },
    Valerio: { fill: '#fb923c', stroke: '#ea580c' },
    Yujin:   { fill: '#f87171', stroke: '#dc2626' },
    WMS:     { fill: '#fbbf24', stroke: '#d97706' },
};

// --- Cell size (computed on resize) ---
let CELL_SIZE = 40;
let BOARD_OFFSET_X = 0;
let BOARD_OFFSET_Y = 0;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    // Account for fixed UI elements so the board never overlaps them
    const hudH = 56;
    const benchH = 90;
    const sidePanelW = 280;
    const availableW = maxW - sidePanelW;
    const availableH = maxH - hudH - benchH;

    const boardArea = Math.min(availableW * 0.85, availableH * 0.95);
    CELL_SIZE = Math.floor(boardArea / BOARD_ROWS);
    CELL_SIZE = Math.max(8, Math.min(22, CELL_SIZE));

    canvas.width = maxW * dpr;
    canvas.height = maxH * dpr;
    canvas.style.width = maxW + 'px';
    canvas.style.height = maxH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const boardW = CELL_SIZE * BOARD_COLS;
    const boardH = CELL_SIZE * BOARD_ROWS;
    // Center board horizontally in the space left of the side panel
    BOARD_OFFSET_X = Math.floor((availableW - boardW) / 2);
    // Center board vertically between HUD and bench panel
    BOARD_OFFSET_Y = hudH + Math.floor((availableH - boardH) / 2);
    // Safety clamps: never overlap HUD or bench
    if (BOARD_OFFSET_Y < hudH) BOARD_OFFSET_Y = hudH;
    if (BOARD_OFFSET_Y + boardH > maxH - benchH) BOARD_OFFSET_Y = maxH - benchH - boardH;
}

// --- Global Game State ---
let gamePhase = PHASE_MENU;
let currentRound = 0;
let combatTick = 0;
let animationFrameId = null;
let players = [];
let combatTeams = {};
let combatUnits = [];
let damageNumbers = [];
let combatEffects = [];
let combatLog = [];
let combatResult = null;
let combatEliminations = [];
let readyPlayers = new Set();

// Camp reward tracking for current combat
let campRewardsThisRound = []; // [{campId, playerIdx, gold, itemId}]

// --- Utility ---
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
let nextUnitId = 1;
function genUnitId() { return nextUnitId++; }
// Helper: all player units (heroes + militia) for interaction/targeting
function getAllPlayerUnits(player) {
    if (!player) return [];
    var all = (player.fieldUnits || []).concat(player.militiaUnits || []).concat(player.structures || []);
    if (player.avatar && player.avatar.alive) all.push(player.avatar);
    return all;
}
// Helper: find unit by id across fieldUnits + militiaUnits
function findPlayerUnit(player, unitId) {
    var all = getAllPlayerUnits(player);
    for (var i = 0; i < all.length; i++) {
        if (all[i].id === unitId) return all[i];
    }
    return null;
}
function findPlayerUnitAtCell(player, r, c) {
    var all = getAllPlayerUnits(player);
    for (var i = 0; i < all.length; i++) {
        if (all[i].row === r && all[i].col === c) return all[i];
    }
    return null;
}
