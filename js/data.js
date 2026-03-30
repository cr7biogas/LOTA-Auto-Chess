// ============================================================
// LOTA AUTO CHESS — data.js — All game data from GDD v1.6
// ============================================================

// --- Characters ---
const CHARACTERS = {
    Babidi: {
        id: 'Babidi',
        displayName: 'Babidi',
        lore: 'Mercante Grasso Arabo',
        race: 'Acquariologo',
        unitClass: 'Sciamano',
        deployZone: 'back',
        range: 3,
        atkSpeed: 1.8,
        armor: 2,
        poolCopies: 38,
        maxStar: 5,
        stats: [
            { hp: 650,   atk: 45  },  // star 1
            { hp: 1300,  atk: 90  },  // star 2
            { hp: 2600,  atk: 180 },  // star 3
            { hp: 5200,  atk: 360 },  // star 4
            { hp: 10400, atk: 720 },  // star 5
        ],
        goldPerTurn: [0.4, 0.8, 1.2, 1.5, 1.8],
        behavior: 'kite', // advance until range<=3 then stop
        abilities: {
            mercatoNero: {
                type: 'passive', trigger: 'on_enemy_death',
                coinsThreshold: 2, coinsMax: 3,
                maledizione: { atkReduction: 0.30, atkRedDuration: 5, speedReduction: 0.20, speedRedDuration: 3 },
            },
            merchantsCunning: {
                type: 'passive', trigger: 'on_receiving_attack',
                dodgeChance: 0.15,
            },
            velenoMercante: {
                type: 'passive', trigger: 'on_attack',
                poisonPerTick: 0.01, poisonTicks: 3, stacking: 'refresh',
                damageType: DMG_MAGIC,
            },
            metaPassiva: {
                type: 'meta', trigger: 'planning',
                wrPenalty: [0.02, 0.04, 0.06, 0.08, 0.10],
            },
        },
    },

    Caronte: {
        id: 'Caronte',
        displayName: 'Caronte',
        lore: 'Professore Viscido Americano',
        race: 'Accademico',
        unitClass: 'Incantatore',
        deployZone: 'back',
        range: 3,
        atkSpeed: 1.2,
        armor: 0,
        poolCopies: 38,
        maxStar: 5,
        stats: [
            { hp: 650,   atk: 70   },
            { hp: 1300,  atk: 140  },
            { hp: 2600,  atk: 280  },
            { hp: 5200,  atk: 560  },
            { hp: 10400, atk: 1120 },
        ],
        behavior: 'teleport', // teleport tick 0, never moves
        abilities: {
            tesiDifettosa: {
                type: 'active', cooldown: 6,
                target: 'enemy_highest_hp',
                dmgPercentMaxHp: 0.15,
                damageType: DMG_MAGIC_PURE,
            },
            contraccolpoArcano: {
                type: 'passive', trigger: 'on_tesi_cast',
                recoilPercentOwnMaxHp: 0.05,
                damageType: DMG_MAGIC_PURE,
            },
            scudoTeleporto: {
                type: 'passive', trigger: 'on_teleport',
                shieldPercentOwnMaxHp: 0.15,
            },
        },
    },

    Valerio: {
        id: 'Valerio',
        displayName: 'Valerio',
        lore: 'Vermoide',
        race: 'Vermoide',
        unitClass: 'Guardiano',
        deployZone: 'front',
        range: 1,
        atkSpeed: 2.2,
        armor: 8,
        poolCopies: 38,
        maxStar: 5,
        stats: [
            { hp: 900,   atk: 30  },
            { hp: 1800,  atk: 60  },
            { hp: 3600,  atk: 120 },
            { hp: 7200,  atk: 240 },
            { hp: 14400, atk: 480 },
        ],
        behavior: 'tank', // advance toward nearest, Taunt
        abilities: {
            rigenerazione: {
                type: 'passive', trigger: 'every_tick',
                regenPercentMaxHp: 0.015,
                enhancedTrigger: 'hp_below_30',
                enhancedMultiplier: 3.0,
                enhancedDuration: 4,
                enhancedUsesPerCombat: 1,
            },
            taunt: {
                type: 'passive', trigger: 'always',
                affectedRange: 1, // only melee
                note: 'WMS copying Guardiano does NOT get Taunt',
            },
            spineSegmentali: {
                type: 'passive', trigger: 'on_receiving_physical',
                reflectPercent: 0.08,
                reflectType: DMG_MAGIC,
            },
        },
    },

    Yujin: {
        id: 'Yujin',
        displayName: 'Yujin',
        lore: 'Guerriero Norvegese',
        race: 'Nordico',
        unitClass: 'Berserker',
        deployZone: 'front',
        range: 1,
        atkSpeed: 1.0,
        armor: 5,
        poolCopies: 38,
        maxStar: 5,
        stats: [
            { hp: 750,   atk: 85   },
            { hp: 1500,  atk: 170  },
            { hp: 3000,  atk: 340  },
            { hp: 6000,  atk: 680  },
            { hp: 12000, atk: 1360 },
        ],
        behavior: 'dps', // advance toward highest HP enemy
        abilities: {
            furia: {
                type: 'active', cooldown: 8, duration: 3,
                atkSpeedBonus: 0.60,
                dmgBonus: 0.20,
                noHeal: true,
                onKillDuringFuria: 'reset_cd',
            },
        },
    },

    WMS: {
        id: 'WMS',
        displayName: 'WiseMysticalSborratore',
        lore: 'Entità Mistica',
        race: 'Jolly',
        unitClass: 'Jolly',
        deployZone: 'any',
        range: 2,
        atkSpeed: 1.0,
        armor: 3,
        poolCopies: 10,
        maxStar: 3,
        stats: [
            { hp: 900,  atk: 90  },
            { hp: 2600, atk: 250 },
            { hp: 5200, atk: 450 },
        ],
        behavior: 'copy', // adopts copied class behavior
        abilities: {
            risonanzaMistica: {
                type: 'passive', trigger: 'pre_combat',
                copies: 'race_class_movement',
                excluded: ['Taunt', 'Rigenerazione', 'Furia', 'Tesi'],
                tiebreak: 'highest_max_hp',
            },
            ecoDiBattaglia: {
                type: 'active', cooldown: 7,
                potencyStar1_2: 0.60,
                potencyStar3: 0.85,
                repeatable: ['tesiDifettosa', 'furia', 'mercatoNeroProc'],
            },
            sborrataMistica: {
                type: 'passive', trigger: 'combat_start',
                enemyDmgPercentCurrentHp: 0.04,
                enemyDmgType: DMG_MAGIC_PURE,
                enemyDmgMin: 1,
                allyHpBonusPercent: 0.15,
                allyTarget: 'lowest_max_hp',
            },
            elisir: {
                type: 'meta', trigger: 'planning',
                healPerTurn: [1, [1,2], [2,4]], // star 1, 2, 3
            },
        },
    },
};

// --- Items ---
const ITEMS = {
    // === TIER 1 (rounds 5/10/15, total weight 105) ===
    frammentoAureo:      { id: 'frammentoAureo',      name: 'Frammento Aureo',          tier: 1, weight: 25, bonusAtk: 10, bonusHp: 50 },
    amuletoProtezione:   { id: 'amuletoProtezione',   name: 'Amuleto di Protezione',    tier: 1, weight: 25, bonusArmor: 2, bonusHp: 80 },
    accusaFormale:       { id: 'accusaFormale',       name: 'Accusa Formale',            tier: 1, weight: 18, bonusAtk: 20, onHit: { procChance: 0.25, effect: 'slow', speedReduction: 0.20, duration: 2 } },
    scimitarraDeserto:   { id: 'scimitarraDeserto',   name: 'Scimitarra del Deserto',    tier: 1, weight: 15, bonusAtk: 15, onKill: { stacksGained: 1, maxStacks: 3, atMaxStacks: { atkReduction: 0.30, duration: 5 } } },
    asciaFjord:          { id: 'asciaFjord',          name: 'Ascia delle Fjord',         tier: 1, weight: 12, bonusAtk: 20, effect: 'buff_extend', buffExtendTicks: 1 },
    esoscheletroSeg:     { id: 'esoscheletroSeg',     name: 'Esoscheletro Segmentale',  tier: 1, weight: 10, bonusArmor: 3, regenPerTick: 0.01 },

    // === TIER 2 (rounds 20/25/30, total weight 100) ===
    elmoCondiviso:       { id: 'elmoCondiviso',       name: 'Elmo Condiviso',            tier: 2, weight: 22, bonusHp: 150, bonusArmor: 3, atkSpeedPenalty: -0.05 },
    bilanciaDelMercato:  { id: 'bilanciaDelMercato',  name: 'Bilancia del Mercato',      tier: 2, weight: 18, onHit: { poison: true, poisonPerTick: 0.02, poisonTicks: 3, stacking: 'refresh' } },
    lamaAffilata:        { id: 'lamaAffilata',        name: 'Lama Affilata',             tier: 2, weight: 16, bonusAtk: 40, bonusCrit: 0.15 },
    cristalloRisonante:  { id: 'cristalloRisonante',  name: 'Cristallo Risonante',       tier: 2, weight: 14, atkPerAlly: 0.05, atkIfLastSurvivor: 0.30 },
    cinturaBerserker:    { id: 'cinturaBerserker',    name: 'Cintura del Berserker',     tier: 2, weight: 12, bonusAtkSpeed: 0.10, onKill: 'bonus_attack' },
    velenoAccademico:    { id: 'velenoAccademico',    name: 'Veleno Accademico',         tier: 2, weight: 10, chargesPerHit: 1, maxCharges: 5, atMaxCharges: 'poison_all' },
    mutaCoriacea:        { id: 'mutaCoriacea',        name: 'Muta Coriacea',             tier: 2, weight: 8,  belowHalf: { regen: 0.20 }, deathPrevention: { uses: 1, surviveAt: 1 } },

    // === TIER 3 (rounds 35/40/45, total weight 91) ===
    ragnarok:            { id: 'ragnarok',            name: 'Ragnarök',                  tier: 3, weight: 20, allyBelow30: { atkBonus: 0.15 }, onDeath: { aoeDmgPercent: 0.40 } },
    sigilloDellUsuraio:  { id: 'sigilloDellUsuraio',  name: "Sigillo dell'Usuraio",      tier: 3, weight: 18, onKill: { goldBonus: 1, doubleIf: 'all_4_on_field' }, tiebreaker: true },
    pietraDellEternita:  { id: 'pietraDellEternita',  name: "Pietra dell'Eternità",      tier: 3, weight: 15, bonusHp: 300, bonusAtk: 50, bonusArmor: 5, onSurvive: { goldBonus: 5 }, tiebreaker: true },
    dottoratoMaledetto:  { id: 'dottoratoMaledetto',  name: 'Dottorato Maledetto',       tier: 3, weight: 13, debuffDurMult: 2.0, onKillDebuffed: { healPercent: 0.40 } },
    nucleoImmortale:     { id: 'nucleoImmortale',     name: 'Nucleo Immortale',          tier: 3, weight: 11, oncePerMatch: true, onDeath: { surviveAt: 1, delayTicks: 2, reviveHpPercent: 0.30 } },
    coronaSinergie:      { id: 'coronaSinergie',      name: 'Corona delle Sinergie',     tier: 3, weight: 6,  effect: 'counts_as_2_for_synergy' },
    codiceOracolo:       { id: 'codiceOracolo',       name: "Codice dell'Oracolo",       tier: 3, weight: 8,  restriction: 'WMS_star3', effect: 'wms_gli_amici_solo', elisirOverride: [2,4] },
};

const ITEM_TIERS = {
    1: { rounds: [5, 10, 15],    totalWeight: 105, items: ['frammentoAureo','amuletoProtezione','accusaFormale','scimitarraDeserto','asciaFjord','esoscheletroSeg'] },
    2: { rounds: [20, 25, 30],   totalWeight: 100, items: ['elmoCondiviso','bilanciaDelMercato','lamaAffilata','cristalloRisonante','cinturaBerserker','velenoAccademico','mutaCoriacea'] },
    3: { rounds: [35, 40, 45],   totalWeight: 91,  items: ['ragnarok','sigilloDellUsuraio','pietraDellEternita','dottoratoMaledetto','nucleoImmortale','coronaSinergie','codiceOracolo'] },
};

// --- Creeps ---
const CREEPS = [
    { round: 5,  name: 'Lo Scagnozzo Senza Stipendio',   hp: 1500,   atk: 30,  armor: 2,  atkSpeed: 1.8, tier: 1, ability: null },
    { round: 10, name: 'Il Portaborse Inopportuno',       hp: 3500,   atk: 54,  armor: 3,  atkSpeed: 1.6, tier: 1, ability: { trigger: 'every_8_ticks', effect: 'slow', value: 0.15, duration: 3 } },
    { round: 15, name: "L'Esattore delle Spese Piccole",  hp: 6000,   atk: 78,  armor: 5,  atkSpeed: 1.5, tier: 1, ability: { trigger: 'every_10_ticks', effect: 'atk_debuff_all', value: 0.10, duration: 5 } },
    { round: 20, name: 'Il Revisore dei Conti',           hp: 18000,  atk: 100, armor: 7,  atkSpeed: 1.4, tier: 2, ability: { trigger: 'hp_below_50', effect: 'atk_speed_buff', value: 0.20 } },
    { round: 25, name: 'Il Mercante di Dune',             hp: 28000,  atk: 140, armor: 9,  atkSpeed: 1.3, tier: 2, ability: { trigger: 'every_6_ticks', effect: 'poison_random', value: 0.03, duration: 4 } },
    { round: 30, name: 'Il Verme della Burocrazia',       hp: 32000,  atk: 200, armor: 12, atkSpeed: 1.2, tier: 2, ability: { trigger: 'hp_below_30', effect: 'regen', value: 0.05, duration: 4 } },
    { round: 35, name: 'Il Preside',                      hp: 65000,  atk: 252, armor: 15, atkSpeed: 1.1, tier: 3, ability: { trigger: 'every_5_ticks', effect: 'silence', duration: 2 } },
    { round: 40, name: "L'Auditore Glaciale",             hp: 90000,  atk: 342, armor: 18, atkSpeed: 1.0, tier: 3, ability: { trigger: 'every_7_ticks', effect: 'freeze', duration: 3, armorIgnore: 0.30 } },
    { round: 45, name: 'Il Grande Capo',                  hp: 160000, atk: 450, armor: 22, atkSpeed: 0.9, tier: 3, ability: { trigger: 'hp_phase', above50: 'target_highest_hp', below50: { effect: 'aoe', interval: 4 } } },
];

// --- Synergies ---
const SYNERGIES = {
    // === Pairs ===
    accademiaLosca:    { id: 'accademiaLosca',    name: 'Accademia Losca',     type: 'pair', chars: ['Babidi','Caronte'],  buff: 'spell_slow_10' },
    pazienzaInfinita:  { id: 'pazienzaInfinita',  name: 'Pazienza Infinita',   type: 'pair', chars: ['Babidi','Valerio'],  buff: 'armor_stack', armorPerStack: 1, maxStacks: 5, interval: 3 },
    contrattoGuerra:   { id: 'contrattoGuerra',   name: 'Contratto di Guerra', type: 'pair', chars: ['Babidi','Yujin'],    buff: 'coin_dmg_bonus', dmgPerCoin: 0.15, maxCoins: 3 },
    caviaLaboratorio:  { id: 'caviaLaboratorio',  name: 'Cavia da Laboratorio',type: 'pair', chars: ['Caronte','Valerio'], buff: 'redirect_regen', redirectPercent: 0.25, regenBonus: 0.40 },
    caosAccademico:    { id: 'caosAccademico',     name: 'Caos Accademico',     type: 'pair', chars: ['Caronte','Yujin'],   buff: 'furia_debuff_spread' },
    corpoEForza:       { id: 'corpoEForza',       name: 'Corpo e Forza',       type: 'pair', chars: ['Valerio','Yujin'],   buff: 'regen_to_atk', conversion: 0.15 },

    // === Trios ===
    senzaIlMartello: {
        id: 'senzaIlMartello', name: 'Senza il Martello', type: 'trio',
        chars: ['Babidi','Caronte','Valerio'],
        buff: { magicResist: 0.30, tesiCdOverride: 4 },
        debuff: { physAtkReduction: 0.20 },
        counter: { chars: ['Caronte','Yujin'], minStar: 2 },
    },
    senzaIlMuro: {
        id: 'senzaIlMuro', name: 'Senza il Muro', type: 'trio',
        chars: ['Babidi','Caronte','Yujin'],
        buff: { startingCoins: 2, tesiTick0: true, furiaTick1: true },
        debuff: { maxHpReduction: 0.15, noRegen: true },
        counter: { chars: ['Valerio','Yujin'], minStar: 2 },
    },
    senzaLaMente: {
        id: 'senzaLaMente', name: 'Senza la Mente', type: 'trio',
        chars: ['Babidi','Valerio','Yujin'],
        buff: { valerioHeals: { percent: 0.05, interval: 3 }, magicDmgReduction: 0.70 },
        debuff: { cdIncrease: 2 },
        counter: { chars: ['Caronte','Valerio'], minStar: 2 },
    },
    senzaIlBanchiere: {
        id: 'senzaIlBanchiere', name: 'Senza il Banchiere', type: 'trio',
        chars: ['Caronte','Valerio','Yujin'],
        buff: { tesiLifesteal: 0.10, yujinSlowImmune: true },
        debuff: { negativeEffectDurMult: 1.50 },
        counter: { chars: ['Babidi','Caronte'], minStar: 2 },
    },

    // === Quartet ===
    gliAmici: {
        id: 'gliAmici', name: 'Gli Amici', type: 'quartet',
        chars: ['Babidi','Caronte','Valerio','Yujin'],
        altActivation: 'WMS_star3_codice',
        buff: { atkBonusPerDeath: 0.20 },
        debuff: null, // no debuff
    },
};

// --- Pool initial state ---
function createInitialPool() {
    const pool = {};
    for (const [id, char] of Object.entries(CHARACTERS)) {
        pool[id] = char.poolCopies;
    }
    return pool;
}
