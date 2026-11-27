// =====================================================================
// EDITOR DEGLI ACCORDI (solo amministratori)
// - tonalità scelta da un piccolo pianoforte (maggiore / minore)
// - tavolozza con gli accordi della tonalità, più "Altro…" e la gomma
// - si sceglie un accordo e si tocca la sillaba del testo dove va
// - cambiando tonalità gli accordi già inseriti vengono trasportati
// Salva nel formato già usato dall'app: {key: Sol} e [Sol]testo.
// Gli accordi restano "In arrivo" per chi legge: questo serve a prepararli.
// =====================================================================

const ChordEditor = (() => {
    const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
    const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
    const MAJOR_QUALITY = ['', 'm', 'm', '', '', 'm', 'dim'];
    const MINOR_QUALITY = ['m', 'dim', '', 'm', '', '', '']; // V maggiore, come si suona di solito
    const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const MINOR_ROMAN = ['i', 'ii°', 'III', 'iv', 'V', 'VI', 'VII'];
    const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]);   // Fa, Sib, Mib, Lab, Reb, Solb
    const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]);   // Rem, Solm, Dom, Fam, Sibm, Mibm
    const WHITE = [0, 2, 4, 5, 7, 9, 11];
    const BLACK = [{ s: 1, after: 0 }, { s: 3, after: 1 }, { s: 6, after: 3 }, { s: 8, after: 4 }, { s: 10, after: 5 }];

    let st = null;          // stato dell'editor aperto
    let audioCtx = null;

    const notation = () => (typeof appSettings !== 'undefined' && appSettings.notation) || 'it';
    const useFlats = () => (st.minor ? FLAT_MINOR : FLAT_MAJOR).has(st.root);
    const nameOf = chord => SongTools.formatChord(chord, 0, notation(), useFlats());
    const noteLabel = s => SongTools.noteName(s, useFlats(), notation());
    const keyLabel = () => noteLabel(st.root) + (st.minor ? 'm' : '');
    const keyLong = () => noteLabel(st.root) + (st.minor ? ' minore' : ' maggiore');
    const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s));

    // ---------- lettura del cantico ----------
    function parseLines(body) {
        const raw = SongTools.normalizeLines(body.replace(/\r\n?/g, '\n').split('\n'));
        return raw.map(line => {
            if (!line.trim() || SongTools.isLabelLine(line) || SongTools.isMetaLine(line)) return { raw: line };
            let text = '';
            const chords = new Map();
            const re = /\[([^\]]+)\]/g;
            let last = 0, m;
            while ((m = re.exec(line)) !== null) {
                text += line.slice(last, m.index);
                const c = SongTools.parseChord(m[1]);
                if (c) {
                    const list = chords.get(text.length) || [];
                    list.push(c);
                    chords.set(text.length, list);
                } else {
                    text += m[0];
                }
                last = re.lastIndex;
            }
            text += line.slice(last);
            return { text, chords };
        });
    }

    function detectKey(meta, lines) {
        const fromMeta = meta.key ? SongTools.parseChord(meta.key) : null;
        let first = fromMeta;
        if (!first) for (const l of lines) if (l.chords) for (const [, list] of l.chords) { first = list[0]; break; }
        if (!first) return { root: 0, minor: false };
        return { root: first.root, minor: /^m(?!aj)/.test(first.suffix) };
    }

    // ---------- scrittura ----------
    function buildBody() {
        return st.lines.map(l => {
            if (l.raw !== undefined) return l.raw;
            let out = l.text;
            [...l.chords.keys()].sort((a, b) => b - a).forEach(k => {
                const tag = l.chords.get(k).map(c => '[' + nameOf(c) + ']').join('');
                out = out.slice(0, k) + tag + out.slice(k);
            });
            return out;
        }).join('\n');
    }
    function snapshot() {
        return JSON.stringify({ root: st.root, minor: st.minor, lines: st.lines.map(l => l.chords ? [...l.chords.entries()] : null) });
    }
    function restore(snap) {
        const d = JSON.parse(snap);
        st.root = d.root; st.minor = d.minor;
        d.lines.forEach((entries, i) => { if (entries) st.lines[i].chords = new Map(entries); });
    }
    function remember() {
        st.undo.push(snapshot());
        if (st.undo.length > 60) st.undo.shift();
        st.dirty = true;
    }
    function countChords() {
        return st.lines.reduce((n, l) => n + (l.chords ? [...l.chords.values()].reduce((a, list) => a + list.length, 0) : 0), 0);
    }

    // ---------- suono del pianoforte ----------
    function playNote(semitone) {
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 261.63 * Math.pow(2, semitone / 12);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(t);
            osc.stop(t + 0.95);
        } catch (e) { /* audio non disponibile */ }
    }

    // ---------- tonalità ----------
    function setKey(root, minor) {
        const delta = ((root - st.root) % 12 + 12) % 12;
        if (delta === 0 && minor === st.minor) return;
        remember();
        if (delta) {
            st.lines.forEach(l => {
                if (!l.chords) return;
                l.chords.forEach(list => list.forEach(c => {
                    c.root = (c.root + delta) % 12;
                    if (c.bass !== null) c.bass = (c.bass + delta) % 12;
                }));
            });
        }
        st.root = root;
        st.minor = minor;
        st.brush = null;
        render();
        if (delta && countChords() && typeof showVerseToast === 'function') showVerseToast('Accordi trasportati in ' + keyLong());
    }

    function palette() {
        const steps = st.minor ? MINOR_STEPS : MAJOR_STEPS;
        const quality = st.minor ? MINOR_QUALITY : MAJOR_QUALITY;
        const roman = st.minor ? MINOR_ROMAN : MAJOR_ROMAN;
        const list = steps.map((step, i) => ({ chord: { root: (st.root + step) % 12, suffix: quality[i], bass: null, flat: false }, roman: roman[i] }));
        list.push({ chord: { root: (st.root + 7) % 12, suffix: '7', bass: null, flat: false }, roman: 'V7' });
        return list.concat(st.custom.map(c => ({ chord: c, roman: '' })));
    }

    // ---------- disegno ----------
    function render() {
        const box = document.getElementById('chordEditor');
        if (!box) return;
        box.querySelector('#ceKeyName').textContent = keyLong();
        box.querySelectorAll('[data-ce-mode]').forEach(b => b.classList.toggle('active', (b.dataset.ceMode === 'min') === st.minor));
        box.querySelector('#ceUndo').disabled = !st.undo.length;
        box.querySelector('#ceCount').textContent = countChords() ? countChords() + ' accordi' : 'nessun accordo';

        // pianoforte: tonica evidenziata, note della scala segnate
        const scale = new Set((st.minor ? MINOR_STEPS : MAJOR_STEPS).map(s => (st.root + s) % 12));
        const piano = box.querySelector('#cePiano');
        piano.innerHTML =
            WHITE.map((s, i) => `<button type="button" class="ce-key ce-white${s === st.root ? ' is-root' : ''}${scale.has(s) ? ' in-scale' : ''}" data-semi="${s}" style="--i:${i}" title="${esc(noteLabel(s))}"><span>${esc(noteLabel(s))}</span></button>`).join('') +
            BLACK.map(b => `<button type="button" class="ce-key ce-black${b.s === st.root ? ' is-root' : ''}${scale.has(b.s) ? ' in-scale' : ''}" data-semi="${b.s}" style="--after:${b.after}" title="${esc(noteLabel(b.s))}"><span>${esc(noteLabel(b.s))}</span></button>`).join('');

        // tavolozza
        const brushName = st.brush && st.brush !== 'eraser' ? nameOf(st.brush) : null;
        box.querySelector('#cePalette').innerHTML =
            palette().map(p => {
                const n = nameOf(p.chord);
                return `<button type="button" class="ce-chip${brushName === n ? ' active' : ''}" data-chord="${esc(n)}"><b>${esc(n)}</b>${p.roman ? `<small>${p.roman}</small>` : ''}</button>`;
            }).join('') +
            `<button type="button" class="ce-chip ce-other" data-other="1"><b>Altro…</b><small>Re7, Sol/Si</small></button>` +
            `<button type="button" class="ce-chip ce-eraser${st.brush === 'eraser' ? ' active' : ''}" data-eraser="1" title="Gomma: tocca un accordo nel testo per toglierlo"><b><i class="ri-eraser-line"></i></b><small>Gomma</small></button>`;

        // testo con gli accordi sopra
        box.querySelector('#ceLyrics').innerHTML = st.lines.map((l, i) => {
            if (l.raw !== undefined) {
                if (!l.raw.trim()) return '<div class="ce-gap"></div>';
                if (SongTools.isMetaLine(l.raw)) return '';
                return `<div class="ce-label">${esc(l.raw.replace(/[:.]\s*$/, ''))}</div>`;
            }
            let html = '';
            for (let k = 0; k <= l.text.length; k++) {
                const list = l.chords.get(k);
                const ch = list ? `<i class="ce-chord" data-remove="1">${esc(list.map(nameOf).join(' '))}</i>` : '';
                if (k === l.text.length) {
                    html += `<span class="ce-c ce-end" data-k="${k}" title="Accordo a fine riga">${ch}<span class="ce-plus">+</span></span>`;
                } else {
                    const c = l.text[k];
                    html += `<span class="ce-c${list ? ' has-chord' : ''}" data-k="${k}">${ch}${c === ' ' ? '&nbsp;' : esc(c)}</span>`;
                }
            }
            return `<div class="ce-line" data-l="${i}">${html}</div>`;
        }).join('');
    }

    // ---------- azioni ----------
    function onLyricsClick(e) {
        const slot = e.target.closest('.ce-c');
        if (!slot) return;
        const line = st.lines[Number(slot.closest('.ce-line').dataset.l)];
        const k = Number(slot.dataset.k);
        const existing = line.chords.get(k);
        // tocco sull'accordo già messo, o con la gomma: si toglie
        if (existing && (e.target.closest('[data-remove]') || st.brush === 'eraser')) {
            remember();
            line.chords.delete(k);
            render();
            return;
        }
        if (!st.brush || st.brush === 'eraser') {
            if (typeof showVerseToast === 'function') showVerseToast(st.brush === 'eraser' ? 'Tocca un accordo per toglierlo' : 'Scegli prima un accordo qui sopra');
            return;
        }
        remember();
        const same = existing && existing.length === 1 && nameOf(existing[0]) === nameOf(st.brush);
        if (same) line.chords.delete(k);
        else line.chords.set(k, [{ ...st.brush }]);
        render();
    }

    function onToolsClick(e) {
        const key = e.target.closest('.ce-key');
        if (key) {
            const s = Number(key.dataset.semi);
            playNote(s);
            setKey(s, st.minor);
            return;
        }
        const mode = e.target.closest('[data-ce-mode]');
        if (mode) { setKey(st.root, mode.dataset.ceMode === 'min'); return; }
        if (e.target.closest('[data-eraser]')) {
            st.brush = st.brush === 'eraser' ? null : 'eraser';
            render();
            return;
        }
        if (e.target.closest('[data-other]')) {
            const txt = prompt("Scrivi l'accordo (es. Re7, Sol/Si, Lam7, Fa#m):");
            if (!txt) return;
            const c = SongTools.parseChord(txt.trim());
            if (!c) { alert('Accordo non riconosciuto: ' + txt); return; }
            if (!st.custom.some(x => nameOf(x) === nameOf(c))) st.custom.push(c);
            st.brush = c;
            render();
            return;
        }
        const chip = e.target.closest('[data-chord]');
        if (chip) {
            const c = SongTools.parseChord(chip.dataset.chord);
            st.brush = st.brush && st.brush !== 'eraser' && nameOf(st.brush) === chip.dataset.chord ? null : c;
            if (st.brush) playNote(st.brush.root);
            render();
        }
    }

    function undo() {
        if (!st.undo.length) return;
        restore(st.undo.pop());
        render();
    }

    async function save(btn) {
        const hymn = hymnsDB.find(h => h.id === st.hymnId);
        if (!hymn) return;
        const content = SongTools.buildContent({ ...st.meta, key: keyLabel() }, buildBody());
        await withBusyButton(btn, async () => {
            const { error } = await supabaseClient.from('cantici').update({ content }).eq('id', st.hymnId);
            if (error) { alert('Salvataggio non riuscito: ' + error.message); return; }
            hymn.content = content;
            st.dirty = false;
            close(true);
            if (window.currentHymnId === hymn.id && typeof renderCurrentHymn === 'function') renderCurrentHymn();
            if (typeof showVerseToast === 'function') showVerseToast('Accordi salvati');
        });
    }

    function close(force) {
        if (!force && st && st.dirty && !confirm('Uscire senza salvare gli accordi?')) return;
        document.getElementById('chordEditor')?.remove();
        document.body.classList.remove('ce-open');
        st = null;
    }

    function open(hymnId) {
        if (typeof isAdmin !== 'undefined' && !isAdmin) return;
        const hymn = hymnsDB.find(h => h.id === hymnId);
        if (!hymn) return;
        const { meta, body } = SongTools.splitMeta(hymn.content || '');
        const lines = parseLines(body);
        const key = detectKey(meta, lines);
        st = { hymnId, meta, lines, root: key.root, minor: key.minor, brush: null, custom: [], undo: [], dirty: false };

        const box = document.createElement('div');
        box.id = 'chordEditor';
        box.className = 'ce-overlay';
        box.innerHTML = `
            <div class="ce-sheet" role="dialog" aria-label="Editor accordi">
                <header class="ce-head">
                    <button type="button" class="icon-btn" id="ceClose" title="Chiudi"><i class="ri-close-line"></i></button>
                    <div class="ce-title"><h2>Accordi</h2><p>${esc(hymn.title)} · <span id="ceCount"></span></p></div>
                    <button type="button" class="icon-btn" id="ceUndo" title="Annulla l'ultima modifica"><i class="ri-arrow-go-back-line"></i></button>
                    <button type="button" class="btn-apple" id="ceSave">Salva</button>
                </header>
                <div class="ce-tools">
                    <div class="ce-key-row">
                        <span class="ce-key-name">Tonalità: <b id="ceKeyName"></b></span>
                        <div class="segmented ce-mode">
                            <button type="button" class="favorites-tab" data-ce-mode="maj">Maggiore</button>
                            <button type="button" class="favorites-tab" data-ce-mode="min">Minore</button>
                        </div>
                    </div>
                    <div class="ce-piano" id="cePiano" aria-label="Scegli la tonalità"></div>
                    <div class="ce-palette" id="cePalette"></div>
                    <p class="ce-hint"><i class="ri-hand-coin-line"></i> Scegli un accordo e tocca la sillaba dove va. Tocca un accordo nel testo per toglierlo.</p>
                </div>
                <div class="ce-lyrics" id="ceLyrics"></div>
            </div>`;
        document.body.appendChild(box);
        document.body.classList.add('ce-open');
        box.querySelector('#ceClose').onclick = () => close(false);
        box.querySelector('#ceUndo').onclick = undo;
        box.querySelector('#ceSave').onclick = (e) => save(e.currentTarget);
        box.querySelector('.ce-tools').addEventListener('click', onToolsClick);
        box.querySelector('#ceLyrics').addEventListener('click', onLyricsClick);
        render();
    }

    document.addEventListener('keydown', (e) => {
        if (!st) return;
        if (e.key === 'Escape') close(false);
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    });

    return { open, close };
})();
