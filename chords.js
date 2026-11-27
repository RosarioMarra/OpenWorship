// =====================================================================
// OPEN WORSHIP - ACCORDI, TRASPOSIZIONE, METRONOMO, SCORRIMENTO
// Formato dei cantici (compatibile ChordPro):
//   {key: Sol} {tempo: 72} {time: 4/4} {capo: 0}      <- intestazione opzionale
//   [Sol]Grande è il [Re]Signore                       <- accordi tra parentesi quadre
// Sono accettati anche gli accordi scritti su una riga sopra il testo.
// =====================================================================

const SongTools = (() => {
    const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const IT_TO_EN = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
    const EN_TO_IT = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
    const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);
    const SUFFIX_RE = /^(m|min|maj|M|dim|aug|sus|add|\+|-|°|ø|[0-9]|#|b|\(|\)|,)*$/;
    const LABEL_RE = /^\s*\[?\s*(coro|chorus|rit\.?|ritornello|strofa\s*\d*|verse\s*\d*|ponte|bridge|intro|finale|outro|pre-?coro|pre-?chorus|special|interludio|tag)\s*\]?\s*[:.]?\s*$/i;
    const INLINE_LABEL_RE = /^(coro|chorus|rit|ritornello)\s*[:\-]\s*/i;
    const META_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;

    // ---------- ACCORDI ----------
    function parseNote(str) {
        // Prima la notazione italiana (Do, Re, Mi...), poi quella anglosassone
        let m = str.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?/i);
        if (m && m[1][0] === m[1][0].toUpperCase()) {
            const letter = IT_TO_EN[m[1].toLowerCase()];
            return { semitone: (NOTE_INDEX[letter] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, acc: m[2] || '', rest: str.slice(m[0].length) };
        }
        m = str.match(/^([A-G])(#|b)?/);
        if (m) {
            return { semitone: (NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, acc: m[2] || '', rest: str.slice(m[0].length) };
        }
        return null;
    }

    function parseChord(token) {
        if (!token || token.length > 14) return null;
        const t = token.trim();
        const [main, bass] = t.split('/');
        const root = parseNote(main);
        if (!root) return null;
        let suffix = root.rest;
        if (suffix.startsWith('-')) suffix = 'm' + suffix.slice(1);
        if (!SUFFIX_RE.test(suffix)) return null;
        let bassNote = null;
        if (bass !== undefined) {
            bassNote = parseNote(bass);
            if (!bassNote || bassNote.rest) return null;
        }
        return { root: root.semitone, suffix, bass: bassNote ? bassNote.semitone : null, flat: root.acc === 'b' };
    }

    function noteName(semitone, useFlats, notation) {
        const en = (useFlats ? FLATS : SHARPS)[((semitone % 12) + 12) % 12];
        if (notation !== 'it') return en;
        return EN_TO_IT[en[0]] + en.slice(1);
    }

    function formatChord(chord, shift, notation, useFlats) {
        const flats = useFlats === undefined ? chord.flat : useFlats;
        let out = noteName(chord.root + shift, flats, notation) + chord.suffix;
        if (chord.bass !== null) out += '/' + noteName(chord.bass + shift, flats, notation);
        return out;
    }

    function prefersFlats(keyChord, shift) {
        if (!keyChord) return false;
        const name = noteName(keyChord.root + shift, true, 'en') + (keyChord.suffix.startsWith('m') && !keyChord.suffix.startsWith('maj') ? 'm' : '');
        return FLAT_KEYS.has(name);
    }

    // Riga composta solo da accordi (es. "Sol    Re   Mim")
    function isChordLine(line) {
        const tokens = line.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return false;
        return tokens.every(tok => /^[A-Z]/.test(tok) && (parseChord(tok) || /^[|%x0-9/.]+$/.test(tok)));
    }

    // Converte "accordi sopra il testo" in accordi in linea [X]
    function mergeChordLine(chordLine, lyricLine) {
        const positions = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(chordLine)) !== null) {
            if (parseChord(m[0])) positions.push({ col: m.index, chord: m[0] });
        }
        let lyric = lyricLine || '';
        const maxCol = positions.length ? positions[positions.length - 1].col : 0;
        if (lyric.length < maxCol) lyric = lyric.padEnd(maxCol, ' ');
        for (let i = positions.length - 1; i >= 0; i--) {
            const p = positions[i];
            lyric = lyric.slice(0, p.col) + '[' + p.chord + ']' + lyric.slice(p.col);
        }
        return lyric.replace(/\s+$/, '');
    }

    function normalizeChordOverLyrics(lines) {
        const out = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() && !LABEL_RE.test(line) && !line.includes('[') && isChordLine(line)) {
                const next = lines[i + 1];
                if (next !== undefined && next.trim() && !LABEL_RE.test(next) && !META_RE.test(next) && !isChordLine(next) && !next.includes('[')) {
                    out.push(mergeChordLine(line, next));
                    i++;
                } else {
                    out.push(mergeChordLine(line, ''));
                }
            } else {
                out.push(line);
            }
        }
        return out;
    }

    // ---------- INTESTAZIONE (tonalità, bpm, tempo) ----------
    function splitMeta(content) {
        const meta = {};
        const body = [];
        (content || '').replace(/\r\n?/g, '\n').split('\n').forEach(line => {
            const m = line.match(META_RE);
            if (m) {
                const k = m[1].toLowerCase();
                const v = (m[2] || '').trim();
                if (k === 'key' || k === 'tonalita') meta.key = v;
                else if (k === 'tempo' || k === 'bpm') meta.tempo = parseInt(v, 10) || null;
                else if (k === 'time') meta.time = v;
                else if (k === 'capo') meta.capo = parseInt(v, 10) || 0;
                else if (k === 'title' || k === 't') meta.title = v;
                else body.push(line); // soc/eoc/comment restano nel corpo
            } else {
                body.push(line);
            }
        });
        while (body.length && !body[0].trim()) body.shift();
        return { meta, body: body.join('\n') };
    }

    function buildContent(meta, body) {
        const head = [];
        if (meta.key) head.push(`{key: ${meta.key}}`);
        if (meta.tempo) head.push(`{tempo: ${meta.tempo}}`);
        if (meta.time) head.push(`{time: ${meta.time}}`);
        if (meta.capo) head.push(`{capo: ${meta.capo}}`);
        return (head.length ? head.join('\n') + '\n\n' : '') + (body || '').trim();
    }

    // ---------- STRUTTURA DEL CANTICO ----------
    function parseSong(content) {
        const { meta, body } = splitMeta(content);
        const rawBlocks = [];
        let current = [];
        let inChorus = false;
        body.split('\n').forEach(line => {
            const m = line.match(META_RE);
            if (m) {
                const k = m[1].toLowerCase();
                if (k === 'soc' || k === 'start_of_chorus') {
                    if (current.length) rawBlocks.push({ lines: current, chorus: inChorus });
                    current = []; inChorus = true; return;
                }
                if (k === 'eoc' || k === 'end_of_chorus') {
                    if (current.length) rawBlocks.push({ lines: current, chorus: true });
                    current = []; inChorus = false; return;
                }
                if (k === 'c' || k === 'comment') { current.push('[[' + (m[2] || '') + ']]'); return; }
                return;
            }
            if (!line.trim()) {
                if (current.length) rawBlocks.push({ lines: current, chorus: inChorus });
                current = [];
            } else {
                current.push(line.replace(/\s+$/, ''));
            }
        });
        if (current.length) rawBlocks.push({ lines: current, chorus: inChorus });

        let verseNo = 0;
        const sections = rawBlocks.map(block => {
            let lines = block.lines.slice();
            let label = null;
            let isChorus = block.chorus;
            const first = lines[0];
            const labelMatch = first.match(LABEL_RE);
            const commentMatch = first.match(/^\[\[(.*)\]\]$/);
            if (labelMatch) {
                label = labelMatch[1].replace(/\.$/, '');
                lines.shift();
            } else if (commentMatch) {
                label = commentMatch[1];
                lines.shift();
            } else if (INLINE_LABEL_RE.test(first)) {
                label = first.match(INLINE_LABEL_RE)[1];
                lines[0] = first.replace(INLINE_LABEL_RE, '');
            }
            if (label && /^(coro|chorus|rit|ritornello)/i.test(label)) isChorus = true;
            if (!label) {
                if (isChorus) label = 'Coro';
                else { verseNo++; label = 'Strofa ' + verseNo; }
            } else {
                label = label.charAt(0).toUpperCase() + label.slice(1);
                if (/^(coro|chorus|rit)/i.test(label)) label = 'Coro';
            }
            lines = normalizeChordOverLyrics(lines.filter(l => l.trim() !== ''));
            return { label, isChorus, lines: lines.map(parseLine) };
        }).filter(s => s.lines.length);

        return { meta, sections };
    }

    function parseLine(line) {
        const parts = line.split(/(\[[^\]]+\])/);
        const segments = [];
        let pending = null;
        parts.forEach(part => {
            if (!part) return;
            const m = part.match(/^\[([^\]]+)\]$/);
            const chord = m ? parseChord(m[1]) : null;
            if (chord) {
                if (pending) segments.push({ chord: pending, text: '' });
                pending = chord;
            } else {
                segments.push({ chord: pending, text: part });
                pending = null;
            }
        });
        if (pending) segments.push({ chord: pending, text: '' });
        const lyric = segments.map(s => s.text).join('').replace(/\s+/g, ' ').trim();
        return { segments, lyric, hasChord: segments.some(s => s.chord) };
    }

    function hasChords(content) {
        return parseSong(content).sections.some(s => s.lines.some(l => l.hasChord));
    }

    function detectKey(song) {
        if (song.meta.key) {
            const k = parseChord(song.meta.key);
            if (k) return k;
        }
        for (const s of song.sections) for (const l of s.lines) for (const seg of l.segments) if (seg.chord) return seg.chord;
        return null;
    }

    // Solo testo, sezioni separate (per proiezione, condivisione, ricerca, esportazione)
    function lyricSections(content) {
        return parseSong(content).sections
            .map(s => ({ label: s.label, isChorus: s.isChorus, lines: s.lines.map(l => l.lyric).filter(Boolean) }))
            .filter(s => s.lines.length);
    }

    function lyricsText(content) {
        return lyricSections(content).map(s => s.lines.join('\n')).join('\n\n');
    }

    // ---------- RENDER NEL LETTORE ----------
    function render(container, content, opts) {
        const { showChords = true, transpose = 0, capo = 0, notation = 'en' } = opts || {};
        const song = parseSong(content);
        const songHasChords = song.sections.some(s => s.lines.some(l => l.hasChord));
        const keyChord = detectKey(song);
        const shift = transpose - capo;
        const useFlats = keyChord ? prefersFlats(keyChord, shift) : undefined;
        container.innerHTML = '';

        song.sections.forEach(section => {
            const blockDiv = document.createElement('div');
            blockDiv.className = 'hymn-text-block' + (section.isChorus ? ' hymn-text-chorus' : '');
            const label = document.createElement('div');
            label.className = 'hymn-block-label';
            label.textContent = section.label;
            blockDiv.appendChild(label);

            section.lines.forEach(line => {
                const lineDiv = document.createElement('div');
                if (showChords && line.hasChord) {
                    lineDiv.className = 'hymn-line chord-line' + (line.lyric ? '' : ' chord-only');
                    line.segments.forEach(seg => {
                        const segEl = document.createElement('span');
                        segEl.className = 'cl-seg';
                        const ch = document.createElement('span');
                        ch.className = 'cl-chord';
                        ch.textContent = seg.chord ? formatChord(seg.chord, shift, notation, useFlats) : ' ';
                        const ly = document.createElement('span');
                        ly.className = 'cl-lyric';
                        ly.textContent = seg.text || (seg.chord ? ' ' : '');
                        segEl.appendChild(ch);
                        segEl.appendChild(ly);
                        lineDiv.appendChild(segEl);
                    });
                } else {
                    if (!line.lyric) return;
                    lineDiv.className = 'hymn-line';
                    lineDiv.textContent = line.lyric;
                }
                blockDiv.appendChild(lineDiv);
            });
            if (blockDiv.children.length > 1) container.appendChild(blockDiv);
        });

        return {
            hasChords: songHasChords,
            meta: song.meta,
            keyLabel: keyChord ? formatChord({ ...keyChord, bass: null, suffix: keyChord.suffix.startsWith('m') && !keyChord.suffix.startsWith('maj') ? 'm' : '' }, transpose, notation, useFlats) : null
        };
    }

    // per l'editor degli accordi
    const normalizeLines = normalizeChordOverLyrics;
    const isLabelLine = line => LABEL_RE.test(line);
    const isMetaLine = line => META_RE.test(line);

    return { parseChord, formatChord, parseSong, splitMeta, buildContent, hasChords, lyricSections, lyricsText, render, noteName, normalizeLines, isLabelLine, isMetaLine };
})();

// ---------- METRONOMO (Web Audio, preciso) ----------
const Metronome = (() => {
    let ctx = null, timer = null, nextTime = 0, beat = 0;
    const state = { bpm: 80, beats: 4, playing: false, sound: true, onBeat: null };

    function click(time, accent) {
        if (!state.sound) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = accent ? 1600 : 1000;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.5, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
        osc.connect(gain).connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.07);
    }

    function schedule() {
        while (nextTime < ctx.currentTime + 0.12) {
            const b = beat;
            click(nextTime, b === 0);
            const delay = Math.max(0, (nextTime - ctx.currentTime) * 1000);
            setTimeout(() => state.onBeat && state.playing && state.onBeat(b, state.beats), delay);
            nextTime += 60 / state.bpm;
            beat = (beat + 1) % state.beats;
        }
    }

    return {
        state,
        start() {
            if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume();
            state.playing = true;
            beat = 0;
            nextTime = ctx.currentTime + 0.06;
            clearInterval(timer);
            timer = setInterval(schedule, 25);
        },
        stop() {
            state.playing = false;
            clearInterval(timer);
            timer = null;
        },
        setBpm(v) { state.bpm = Math.min(240, Math.max(30, Math.round(v) || 80)); },
        setBeats(v) { state.beats = Math.min(12, Math.max(1, parseInt(v, 10) || 4)); beat = 0; }
    };
})();

// ---------- SCORRIMENTO AUTOMATICO ----------
const AutoScroll = (() => {
    let raf = null, last = 0, acc = 0, target = null;
    const state = { speed: 3, running: false, onStop: null };

    function findScroller(el) {
        let node = el;
        while (node && node !== document.body) {
            const style = getComputedStyle(node);
            if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return node;
            node = node.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }

    function step(ts) {
        if (!state.running) return;
        if (last) {
            acc += (ts - last) / 1000 * (state.speed * 8);
            const px = Math.floor(acc);
            if (px >= 1) {
                acc -= px;
                const before = target.scrollTop;
                target.scrollTop += px;
                if (target.scrollTop === before && target.scrollTop + target.clientHeight >= target.scrollHeight - 1) {
                    stop();
                    return;
                }
            }
        }
        last = ts;
        raf = requestAnimationFrame(step);
    }

    function stop() {
        state.running = false;
        cancelAnimationFrame(raf);
        raf = null;
        if (state.onStop) state.onStop();
    }

    return {
        state,
        start(el) {
            target = findScroller(el);
            state.running = true;
            last = 0; acc = 0;
            raf = requestAnimationFrame(step);
        },
        stop,
        setSpeed(v) { state.speed = Math.min(10, Math.max(1, Number(v) || 3)); }
    };
})();

window.SongTools = SongTools;
window.Metronome = Metronome;
window.AutoScroll = AutoScroll;
