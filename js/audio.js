// ============================================================
// LOTA AUTO CHESS — audio.js — Procedural audio (stub)
// ============================================================

var audioCtx = null;
var masterVolume = 0.3;

function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        // AudioContext not supported; all audio functions become no-ops
        audioCtx = null;
    }
}

function setVolume(v) {
    masterVolume = clamp(v, 0, 1);
}

// --- Internal helper: play an oscillator burst ---
function _playTone(frequency, duration, type, gainValue) {
    if (!audioCtx) return;
    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

    var vol = (gainValue !== undefined ? gainValue : 0.3) * masterVolume;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

// --- Internal helper: play a noise burst ---
function _playNoise(duration, gainValue) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    var bufferSize = Math.floor(audioCtx.sampleRate * duration);
    var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
    }

    var source = audioCtx.createBufferSource();
    source.buffer = buffer;

    var gain = audioCtx.createGain();
    var vol = (gainValue !== undefined ? gainValue : 0.15) * masterVolume;
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    source.connect(gain);
    gain.connect(audioCtx.destination);

    source.start(audioCtx.currentTime);
    source.stop(audioCtx.currentTime + duration);
}

// --- Hit sound: brief noise burst ---
function playHitSound() {
    _playNoise(0.08, 0.12);
}

// --- Crit sound: louder/higher hit ---
function playCritSound() {
    _playNoise(0.12, 0.25);
    _playTone(880, 0.08, 'sawtooth', 0.2);
}

// --- Death sound: low thud ---
function playDeathSound() {
    _playTone(80, 0.25, 'sine', 0.3);
    _playNoise(0.15, 0.1);
}

// --- Gold sound: short chime ---
function playGoldSound() {
    _playTone(1047, 0.08, 'sine', 0.2);  // C6
    setTimeout(function() {
        _playTone(1319, 0.1, 'sine', 0.15); // E6
    }, 60);
}

// --- Draft sound: card flip ---
function playDraftSound() {
    _playNoise(0.04, 0.15);
    setTimeout(function() {
        _playTone(523, 0.06, 'triangle', 0.15); // C5
    }, 30);
}

// --- Phase transition jingle ---
function playPhaseSound() {
    _playTone(440, 0.12, 'triangle', 0.2);  // A4
    setTimeout(function() {
        _playTone(554, 0.12, 'triangle', 0.18); // C#5
    }, 100);
    setTimeout(function() {
        _playTone(659, 0.18, 'triangle', 0.2);  // E5
    }, 200);
}

// ============================================================
// MENU SOUNDTRACK — Polyphonic procedural dark-fantasy theme
// 4 voices: bass drone, pad chords, arpeggio, melody
// Key: A minor / D minor, 72 BPM, looping
// ============================================================

var _menuMusic = null;

function startMenuMusic() {
    if (!audioCtx) return;
    if (_menuMusic && _menuMusic.playing) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    _menuMusic = { playing: true, nodes: [], timers: [] };

    var ctx = audioCtx;
    var now = ctx.currentTime;
    var bpm = 72;
    var beat = 60 / bpm;          // ~0.833s per beat
    var bar = beat * 4;           // ~3.333s per bar
    var loopLen = bar * 8;        // 8 bars = ~26.6s loop
    var vol = masterVolume * 0.35;

    // Note frequencies (A minor / D minor palette)
    var N = {
        A2:110.00, B2:123.47, C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00,
        A3:220.00, B3:246.94, C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00,
        A4:440.00, B4:493.88, C5:523.25, D5:587.33, E5:659.26, F5:698.46, G5:783.99,
        A5:880.00
    };

    // === Master bus with reverb-like effect ===
    var masterGain = ctx.createGain();
    masterGain.gain.value = vol;
    var compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    masterGain.connect(compressor);
    compressor.connect(ctx.destination);
    _menuMusic.nodes.push(masterGain, compressor);

    // === Helper: schedule an oscillator note ===
    function _note(freq, start, dur, type, gainVal, dest) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + start);
        var v = gainVal * vol;
        // Soft attack + release envelope
        g.gain.setValueAtTime(0.001, now + start);
        g.gain.linearRampToValueAtTime(v, now + start + Math.min(0.08, dur * 0.15));
        g.gain.setValueAtTime(v, now + start + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        osc.connect(g);
        g.connect(dest || masterGain);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
        _menuMusic.nodes.push(osc, g);
    }

    // ────────────────────────────────────────
    //  VOICE 1: Bass drone (sine, low octave)
    // ────────────────────────────────────────
    // Chord progression per bar: Am | Dm | F | Em | Am | Dm | Em | Am
    var bassNotes = [N.A2, N.D3, N.F3, N.E3, N.A2, N.D3, N.E3, N.A2];
    for (var bi = 0; bi < 8; bi++) {
        _note(bassNotes[bi], bi * bar, bar * 0.95, 'sine', 0.55);
        // Sub-octave ghost
        _note(bassNotes[bi] * 0.5, bi * bar, bar * 0.9, 'sine', 0.2);
    }

    // ────────────────────────────────────────
    //  VOICE 2: Pad chords (triangle, sustained)
    // ────────────────────────────────────────
    // Am = A3+C4+E4 | Dm = D4+F4+A4 | F = F3+A3+C4 | Em = E3+G3+B3
    var chords = [
        [N.A3, N.C4, N.E4],         // Am
        [N.D4, N.F4, N.A4],         // Dm
        [N.F3, N.A3, N.C4],         // F
        [N.E3, N.G3, N.B3],         // Em
        [N.A3, N.C4, N.E4],         // Am
        [N.D4, N.F4, N.A4],         // Dm
        [N.E3, N.G3, N.B3],         // Em
        [N.A3, N.C4, N.E4],         // Am
    ];
    for (var ci = 0; ci < 8; ci++) {
        var chord = chords[ci];
        for (var cn = 0; cn < chord.length; cn++) {
            _note(chord[cn], ci * bar, bar * 0.9, 'triangle', 0.12);
        }
    }

    // ────────────────────────────────────────
    //  VOICE 3: Arpeggio (sine, eighth notes)
    // ────────────────────────────────────────
    var arps = [
        [N.A4, N.C5, N.E5, N.A5, N.E5, N.C5, N.A4, N.E4],   // Am
        [N.D4, N.F4, N.A4, N.D5, N.A4, N.F4, N.D4, N.A3],   // Dm
        [N.F4, N.A4, N.C5, N.F5, N.C5, N.A4, N.F4, N.C4],   // F
        [N.E4, N.G4, N.B4, N.E5, N.B4, N.G4, N.E4, N.B3],   // Em
        [N.A4, N.C5, N.E5, N.A5, N.E5, N.C5, N.A4, N.E4],   // Am
        [N.D4, N.F4, N.A4, N.D5, N.A4, N.F4, N.D4, N.A3],   // Dm
        [N.E4, N.G4, N.B4, N.E5, N.B4, N.G4, N.E4, N.B3],   // Em
        [N.A4, N.C5, N.E5, N.A5, N.E5, N.C5, N.A4, N.E4],   // Am
    ];
    for (var ai = 0; ai < 8; ai++) {
        var arp = arps[ai];
        for (var an = 0; an < 8; an++) {
            _note(arp[an], ai * bar + an * beat * 0.5, beat * 0.45, 'sine', 0.09);
        }
    }

    // ────────────────────────────────────────
    //  VOICE 4: Melody (sawtooth filtered, sparse)
    //  Plays on bars 3-4 and 7-8 for contrast
    // ────────────────────────────────────────
    var melodyPhrases = [
        // Bars 3-4 (F → Em): ascending phrase
        { bar: 2, notes: [
            { n: N.C5, t: 0,          d: beat },
            { n: N.D5, t: beat,       d: beat * 0.5 },
            { n: N.E5, t: beat * 1.5, d: beat * 1.5 },
            { n: N.F5, t: beat * 3,   d: beat },
        ]},
        { bar: 3, notes: [
            { n: N.E5, t: 0,          d: beat * 1.5 },
            { n: N.D5, t: beat * 2,   d: beat },
            { n: N.B4, t: beat * 3,   d: beat },
        ]},
        // Bars 7-8 (Em → Am): resolving phrase
        { bar: 6, notes: [
            { n: N.E5, t: 0,          d: beat },
            { n: N.D5, t: beat,       d: beat * 0.5 },
            { n: N.C5, t: beat * 1.5, d: beat },
            { n: N.B4, t: beat * 2.5, d: beat * 1.5 },
        ]},
        { bar: 7, notes: [
            { n: N.A4, t: 0,          d: beat * 2 },
            { n: N.E4, t: beat * 2.5, d: beat * 1.5 },
        ]},
    ];

    // Filtered sawtooth for warmer melody tone
    var melFilter = ctx.createBiquadFilter();
    melFilter.type = 'lowpass';
    melFilter.frequency.value = 1800;
    melFilter.Q.value = 2;
    melFilter.connect(masterGain);
    _menuMusic.nodes.push(melFilter);

    for (var mi = 0; mi < melodyPhrases.length; mi++) {
        var phrase = melodyPhrases[mi];
        for (var mn = 0; mn < phrase.notes.length; mn++) {
            var mNote = phrase.notes[mn];
            _note(mNote.n, phrase.bar * bar + mNote.t, mNote.d, 'sawtooth', 0.13, melFilter);
        }
    }

    // ────────────────────────────────────────
    //  LOOP: restart after loopLen
    // ────────────────────────────────────────
    var loopTimer = setTimeout(function _loopMenuMusic() {
        if (!_menuMusic || !_menuMusic.playing) return;
        _cleanupMenuNodes();
        _menuMusic.nodes = [];
        _menuMusic.timers = [];
        // Rebuild by calling self
        var wasPlaying = _menuMusic.playing;
        _menuMusic.playing = false;
        if (wasPlaying) startMenuMusic();
    }, loopLen * 1000 + 200);
    _menuMusic.timers.push(loopTimer);
}

function _cleanupMenuNodes() {
    if (!_menuMusic) return;
    for (var i = 0; i < _menuMusic.nodes.length; i++) {
        try {
            var n = _menuMusic.nodes[i];
            if (n.stop) n.stop();
            if (n.disconnect) n.disconnect();
        } catch (e) {}
    }
}

function stopMenuMusic() {
    if (!_menuMusic) return;
    _menuMusic.playing = false;
    for (var i = 0; i < _menuMusic.timers.length; i++) {
        clearTimeout(_menuMusic.timers[i]);
    }
    _cleanupMenuNodes();
    _menuMusic = null;
}
