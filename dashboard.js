// =====================================================================
// OPEN WORSHIP - DASHBOARD
// Versetto del giorno (dalla Bibbia online), condivisione come immagine,
// azioni rapide, prossimi avvisi, cantici recenti e preferiti.
// =====================================================================

// Riferimenti dei versetti del giorno: [libro, capitolo, versetto].
// Il testo viene letto dalla Bibbia online (stessa versione della sezione Bibbia).
const VERSE_REFS = [
    [43, 3, 16], [50, 4, 13], [19, 23, 1], [23, 40, 31], [24, 29, 11], [45, 8, 28],
    [20, 3, 5], [19, 46, 1], [40, 11, 28], [6, 1, 9], [19, 119, 105], [47, 5, 17],
    [58, 11, 1], [50, 4, 6], [4, 6, 24], [19, 27, 1], [45, 12, 12], [40, 6, 33],
    [43, 14, 6], [62, 4, 8], [19, 37, 5], [23, 41, 10], [49, 2, 8], [19, 91, 1],
    [48, 5, 22], [46, 13, 4], [40, 5, 14], [43, 8, 12], [19, 121, 2], [25, 3, 22],
    [55, 1, 7], [60, 5, 7], [59, 1, 5], [19, 118, 24], [36, 3, 17], [43, 16, 33],
    [19, 100, 4], [45, 15, 13], [51, 3, 23], [23, 26, 3]
];

function dayOfYear(d = new Date()) {
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function bookName(id) {
    const b = bibleBooks.find(x => x.id === id);
    return b ? b.name : '';
}
function verseImageUrl(width) {
    const base = verseImages[dayOfYear() % verseImages.length];
    return base.replace(/w=\d+/, 'w=' + width);
}

// Versetto di oggi: prima dalla memoria del giorno, poi dalla Bibbia online, altrimenti quello di riserva
let verseOfDay = null;
async function loadVerseOfDay() {
    try {
        const cached = JSON.parse(localStorage.getItem('verseOfDay') || 'null');
        if (cached && cached.day === todayKey() && cached.text) { verseOfDay = cached; return cached; }
    } catch (e) { /* nessuna memoria */ }

    const [book, chapter, verse] = VERSE_REFS[dayOfYear() % VERSE_REFS.length];
    try {
        const data = await fetchBibleData('NR06', book, chapter);
        const found = data.find(v => Number(v.verse) === verse);
        if (!found) throw new Error('Versetto non trovato');
        const text = new DOMParser().parseFromString(String(found.text), 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
        verseOfDay = { day: todayKey(), text, ref: `${bookName(book)} ${chapter}:${verse}`, book, chapter, verse };
        try { localStorage.setItem('verseOfDay', JSON.stringify(verseOfDay)); } catch (e) { /* ignora */ }
    } catch (e) {
        const fallback = dailyVerses[dayOfYear() % dailyVerses.length];
        verseOfDay = { day: todayKey(), text: fallback.text, ref: fallback.ref, book: null };
    }
    return verseOfDay;
}

function renderVerseOfDay() {
    const textEl = document.getElementById('dailyVerseText');
    const refEl = document.getElementById('dailyVerseRef');
    const bg = document.querySelector('.verse-bg-image');
    if (bg) bg.style.backgroundImage = `url('${verseImageUrl(1400)}')`;
    if (!verseOfDay) {
        textEl.textContent = 'Caricamento del versetto...';
        refEl.textContent = '';
        // Quando il versetto arriva il riquadro si allunga: si ricalcola lo spazio
        loadVerseOfDay().then(() => { renderVerseOfDay(); scheduleDashboardFit(); });
        return;
    }
    textEl.textContent = `“${verseOfDay.text}”`;
    refEl.textContent = verseOfDay.ref;
    document.getElementById('readVerseChapterBtn').style.display = verseOfDay.book ? '' : 'none';
}

// --- Dashboard ---
function updateDashboard() {
    const dateEl = document.getElementById('currentDateDisplay');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    renderVerseOfDay();

    // Contatori
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('dashHymnsCount', hymnsDB.length);
    set('dashFavCount', favoritesDB.filter(id => hymnsDB.some(h => h.id === id)).length);
    set('dashNotesCount', notesDB.length);
    set('dashHighlightsCount', highlightsDB.length);

    renderDashAvvisi();
    renderDashHymns();
    fitDashboardToScreen();
}

// Su telefono la home deve stare in una schermata: si nascondono gli avvisi
// e i cantici in più finché tutto entra sopra la barra di navigazione.
// "I tuoi cantici" resta sempre visibile con almeno 2 cantici: se lo schermo
// è troppo basso, il resto si raggiunge scorrendo.
function fitDashboardToScreen() {
    const section = document.getElementById('dashboard');
    if (!section || !section.classList.contains('active')) return;
    document.querySelectorAll('#dashAvvisiList .dash-avviso, #dashHymnsList .dash-hymn').forEach(el => { el.hidden = false; });
    if (window.innerWidth > 768) return;
    const nav = document.querySelector('.mobile-nav');
    const last = [...document.querySelectorAll('.dash-stats, .dash-columns')].reverse().find(el => el.offsetParent);
    if (!nav || !last) return;
    const limit = () => nav.getBoundingClientRect().top - 8;
    const visible = sel => [...document.querySelectorAll(sel)].filter(el => !el.hidden);
    let guard = 0;
    while (last.getBoundingClientRect().bottom > limit() && guard++ < 12) {
        const hymns = visible('#dashHymnsList .dash-hymn');
        const avvisi = visible('#dashAvvisiList .dash-avviso');
        if (avvisi.length > 1) avvisi[avvisi.length - 1].hidden = true;
        else if (hymns.length > 2) hymns[hymns.length - 1].hidden = true;
        else break;
    }
}

// Ricalcolo raggruppato: dopo il caricamento del versetto, i cambi di
// dimensione della finestra e la comparsa/scomparsa della barra del browser
function scheduleDashboardFit() {
    clearTimeout(scheduleDashboardFit._t);
    scheduleDashboardFit._t = setTimeout(fitDashboardToScreen, 80);
}
window.addEventListener('resize', scheduleDashboardFit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleDashboardFit);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDashboardFit);
if ('ResizeObserver' in window) {
    const verseCard = document.querySelector('.verse-card');
    if (verseCard) new ResizeObserver(scheduleDashboardFit).observe(verseCard);
}

function renderDashAvvisi() {
    const list = document.getElementById('dashAvvisiList');
    if (!list) return;
    const oggi = new Date().toISOString().slice(0, 10);
    const sorted = [...avvisiDB].sort((a, b) => new Date(a.date) - new Date(b.date));
    let upcoming = sorted.filter(a => a.date >= oggi);
    if (!upcoming.length) upcoming = sorted.slice(-2).reverse();
    upcoming = upcoming.slice(0, 3);
    list.innerHTML = '';
    if (!upcoming.length) {
        list.innerHTML = '<p class="dash-empty"><i class="ri-notification-3-line"></i> Nessun avviso in programma.</p>';
        return;
    }
    upcoming.forEach(a => {
        const d = new Date(a.date);
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dash-avviso';
        item.innerHTML = `
            <span class="dash-date-block"><b>${d.getDate()}</b><small>${d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}</small></span>
            <span class="dash-avviso-text"><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(d.toLocaleDateString('it-IT', { weekday: 'long' }))}${a.desc ? ' · ' + escapeHtml(a.desc.slice(0, 60)) : ''}</small></span>
            <i class="ri-arrow-right-s-line"></i>`;
        item.onclick = () => openAvvisoDetailModal(a.id);
        list.appendChild(item);
    });
}

// Ultimi cantici aperti
function getRecentHymns() {
    try { return JSON.parse(localStorage.getItem('recentHymns')) || []; } catch (e) { return []; }
}
function trackRecentHymn(id) {
    const recent = [id, ...getRecentHymns().filter(x => x !== id)].slice(0, 8);
    try { localStorage.setItem('recentHymns', JSON.stringify(recent)); } catch (e) { /* ignora */ }
}

let dashHymnsTab = 'recent';
function renderDashHymns() {
    const list = document.getElementById('dashHymnsList');
    if (!list) return;
    document.querySelectorAll('.dash-hymn-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === dashHymnsTab));
    const ids = dashHymnsTab === 'recent' ? getRecentHymns() : favoritesDB;
    const hymns = ids.map(id => hymnsDB.find(h => h.id === id)).filter(Boolean).slice(0, 3); // massimo 3: la home non deve allungarsi
    list.innerHTML = '';
    if (!hymns.length) {
        list.innerHTML = dashHymnsTab === 'recent'
            ? '<p class="dash-empty"><i class="ri-music-2-line"></i> I cantici che apri compariranno qui.</p>'
            : '<p class="dash-empty"><i class="ri-heart-line"></i> Tocca il cuore su un cantico per aggiungerlo ai preferiti.</p>';
        return;
    }
    hymns.forEach(h => {
        const m = String(h.title || '').match(/^\s*(\d+)\s*[-–.:)]?\s*(.*)$/);
        const number = m && m[2] ? m[1] : '';
        const name = m && m[2] ? m[2] : h.title;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'dash-hymn';
        item.innerHTML = `${number ? `<span class="hymn-number">${escapeHtml(number)}</span>` : '<span class="hymn-number"><i class="ri-music-2-line"></i></span>'}
            <span class="dash-hymn-name">${escapeHtml(name)}</span><i class="ri-arrow-right-s-line"></i>`;
        item.onclick = () => {
            goToSection('cantici');
            openHymnView(h.id);
        };
        list.appendChild(item);
    });
}

function goToSection(target) {
    const btn = document.querySelector(`.nav-item[data-target="${target}"]`);
    if (btn) btn.click();
}

function openVerseChapter() {
    if (!verseOfDay || !verseOfDay.book) return;
    goToSection('bibbia');
    bookSelect.value = String(verseOfDay.book);
    bookSelect.dispatchEvent(new Event('change'));
    chapterSelect.value = String(verseOfDay.chapter);
    chapterSelect.dispatchEvent(new Event('change'));
    verseSelect.value = String(verseOfDay.verse);
    document.getElementById('fetchBibleBtn').click();
}

async function copyVerse() {
    if (!verseOfDay) return;
    const text = `“${verseOfDay.text}”\n— ${verseOfDay.ref}`;
    try {
        await navigator.clipboard.writeText(text);
        flashButton(document.getElementById('copyVerseBtn'), '<i class="ri-check-line"></i> Copiato');
    } catch (e) {
        alert(text);
    }
}

function flashButton(btn, html) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = html;
    setTimeout(() => { btn.innerHTML = original; }, 1600);
}

function setupDashboardCards() {
    document.querySelectorAll('[data-section]').forEach(el => {
        el.addEventListener('click', () => goToSection(el.getAttribute('data-section')));
    });
    document.getElementById('shareVerseBtn').onclick = openShareVerseModal;
    document.getElementById('copyVerseBtn').onclick = copyVerse;
    document.getElementById('readVerseChapterBtn').onclick = openVerseChapter;
    document.getElementById('quickSearchHymn').onclick = () => {
        goToSection('cantici');
        setTimeout(() => document.getElementById('hymnSearch').focus(), 250);
    };
    document.getElementById('quickBible').onclick = () => goToSection('bibbia');
    document.getElementById('quickNote').onclick = () => openNoteModal();
    document.getElementById('quickAvviso').onclick = () => openAvvisoModal();
    document.querySelectorAll('.dash-hymn-tab').forEach(tab => {
        tab.onclick = () => { dashHymnsTab = tab.dataset.tab; renderDashHymns(); fitDashboardToScreen(); };
    });
}
function updateVerseOfDayImage() { renderVerseOfDay(); }

// =====================================================================
// CONDIVISIONE DEL VERSETTO COME IMMAGINE
// =====================================================================
const SHARE_FORMATS = {
    square: { w: 1080, h: 1080, label: 'Quadrato' },
    post: { w: 1080, h: 1350, label: 'Post' },
    story: { w: 1080, h: 1920, label: 'Storia' }
};
const SHARE_BACKGROUNDS = [
    { id: 'today', name: 'Foto del giorno', img: () => verseImageUrl(1600) },
    { id: 'img1', name: 'Luce', img: () => 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1600' },
    { id: 'img2', name: 'Montagne', img: () => 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1600' },
    { id: 'img3', name: 'Cielo', img: () => 'https://images.unsplash.com/photo-1444084316824-dc26d6657664?w=1600' },
    { id: 'img4', name: 'Natura', img: () => 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600' },
    { id: 'ph-montagne-alba', name: 'Montagne all\'alba', img: () => 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600' },
    { id: 'ph-lago-alpino', name: 'Lago alpino', img: () => 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600' },
    { id: 'ph-tramonto-prato', name: 'Tramonto sul prato', img: () => 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1600' },
    { id: 'ph-spiaggia', name: 'Spiaggia', img: () => 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600' },
    { id: 'ph-via-lattea', name: 'Via Lattea', img: () => 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600' },
    { id: 'ph-bosco', name: 'Bosco', img: () => 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1600' },
    { id: 'ph-mare-tramonto', name: 'Mare al tramonto', img: () => 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1600' },
    { id: 'ph-albero', name: 'Albero', img: () => 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1600' },
    { id: 'ph-valle', name: 'Valle alpina', img: () => 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600' },
    { id: 'ph-lago-sera', name: 'Lago di sera', img: () => 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=1600' },
    { id: 'ph-stelle', name: 'Cielo stellato', img: () => 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1600' },
    { id: 'ph-alberi-cielo', name: 'Alberi verso il cielo', img: () => 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=1600' },
    { id: 'ph-colline', name: 'Colline verdi', img: () => 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1600' },
    { id: 'ph-onde', name: 'Onde', img: () => 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1600' },
    { id: 'ph-ponte', name: 'Ponte nel bosco', img: () => 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1600' },
    { id: 'ph-montagne-rosa', name: 'Montagne al tramonto', img: () => 'https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=1600' },
    { id: 'ph-fiori', name: 'Fiori', img: () => 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1600' },
    { id: 'night', name: 'Blu notte', colors: ['#07152e', '#1d4f91'] },
    { id: 'violet', name: 'Viola', colors: ['#1d0b2e', '#6b2b8f'] },
    { id: 'sunset', name: 'Tramonto', colors: ['#3a1208', '#c2611f'] },
    { id: 'forest', name: 'Verde', colors: ['#04221a', '#1f7a5a'] },
    { id: 'light', name: 'Chiaro', colors: ['#fdfbf6', '#ece4d4'], dark: true }
];

const imageCache = new Map();
function loadImage(url) {
    if (imageCache.has(url)) return imageCache.get(url);
    const p = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Immagine non disponibile'));
        img.src = url;
    });
    imageCache.set(url, p);
    p.catch(() => imageCache.delete(url));
    return p;
}

function wrapLines(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);
    return lines;
}

// Versetto da condividere come immagine: quello del giorno oppure uno scelto nella Bibbia
let shareVerseOverride = null;
function currentShareVerse() {
    return shareVerseOverride || verseOfDay || { text: '', ref: '' };
}

async function renderVerseImage(formatId, bgId) {
    const { w, h } = SHARE_FORMATS[formatId];
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const bg = SHARE_BACKGROUNDS.find(b => b.id === bgId) || SHARE_BACKGROUNDS[0];
    let darkText = !!bg.dark;

    // Sfondo
    let drewImage = false;
    if (bg.img) {
        try {
            const img = await loadImage(bg.img());
            const scale = Math.max(w / img.width, h / img.height);
            const iw = img.width * scale, ih = img.height * scale;
            ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
            const shade = ctx.createLinearGradient(0, 0, 0, h);
            shade.addColorStop(0, 'rgba(0,0,0,0.35)');
            shade.addColorStop(0.5, 'rgba(0,0,0,0.5)');
            shade.addColorStop(1, 'rgba(0,0,0,0.7)');
            ctx.fillStyle = shade;
            ctx.fillRect(0, 0, w, h);
            drewImage = true;
        } catch (e) { /* si usa il colore */ }
    }
    if (!drewImage) {
        const colors = bg.colors || ['#07152e', '#1d4f91'];
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, colors[0]);
        grad.addColorStop(1, colors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    const ink = darkText ? '#1a1712' : '#ffffff';
    const accent = darkText ? '#a36a00' : '#ffd65a';
    const pad = 96;
    const font = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, Arial, sans-serif';
    const serif = font; // stesso carattere stile Apple anche per il versetto
    try { await document.fonts.load('600 60px Inter'); } catch (e) { /* carattere di sistema */ }

    // Intestazione
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = accent;
    ctx.font = `700 30px ${font}`;
    ctx.textAlign = 'center';
    const topY = formatId === 'story' ? 260 : 150;
    ctx.fillText((currentShareVerse().kicker || 'VERSETTO DEL GIORNO').toUpperCase(), w / 2, topY);
    ctx.fillStyle = darkText ? 'rgba(26,23,18,0.6)' : 'rgba(255,255,255,0.75)';
    ctx.font = `500 28px ${font}`;
    ctx.fillText(new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), w / 2, topY + 46);

    // Testo del versetto: dimensione adattata allo spazio
    const text = `“${currentShareVerse().text}”`;
    const boxTop = topY + 120;
    const boxBottom = h - (formatId === 'story' ? 420 : 250);
    const maxWidth = w - pad * 2;
    let size = 84, lines = [], lineH = 0;
    for (; size >= 34; size -= 2) {
        ctx.font = `600 ${size}px ${serif}`;
        lines = wrapLines(ctx, text, maxWidth);
        lineH = size * 1.32;
        if (lines.length * lineH <= boxBottom - boxTop - 90) break;
    }
    const blockH = lines.length * lineH + 90;
    let y = boxTop + (boxBottom - boxTop - blockH) / 2 + size;
    ctx.fillStyle = ink;
    ctx.font = `600 ${size}px ${serif}`;
    if (!darkText) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; }
    lines.forEach(line => { ctx.fillText(line, w / 2, y); y += lineH; });
    ctx.shadowBlur = 0;

    // Riferimento
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(Math.max(34, size * 0.55))}px ${font}`;
    ctx.fillText(currentShareVerse().ref, w / 2, y + 40);

    // Firma in basso con il logo
    const footY = h - (formatId === 'story' ? 200 : 110);
    try {
        const logo = await loadImage('immagini/icon-192.png');
        const ls = 56;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(w / 2 - 150, footY - ls + 14, ls, ls, 14) : ctx.rect(w / 2 - 150, footY - ls + 14, ls, ls);
        ctx.clip();
        ctx.fillStyle = '#fff';
        ctx.fillRect(w / 2 - 150, footY - ls + 14, ls, ls);
        ctx.drawImage(logo, w / 2 - 150 + 6, footY - ls + 20, ls - 12, ls - 12);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.fillStyle = darkText ? 'rgba(26,23,18,0.8)' : 'rgba(255,255,255,0.9)';
        ctx.font = `700 34px ${font}`;
        ctx.fillText('Open Worship', w / 2 - 80, footY);
    } catch (e) {
        ctx.textAlign = 'center';
        ctx.fillStyle = darkText ? 'rgba(26,23,18,0.8)' : 'rgba(255,255,255,0.9)';
        ctx.font = `700 34px ${font}`;
        ctx.fillText('Open Worship', w / 2, footY);
    }
    return canvas;
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Immagine non creata'))), 'image/png');
        } catch (e) { reject(e); }
    });
}

async function openShareVerseModal(customVerse) {
    // senza parametro: versetto del giorno; con parametro: versetti scelti nella Bibbia
    shareVerseOverride = customVerse && customVerse.text ? customVerse : null;
    if (!shareVerseOverride && !verseOfDay) await loadVerseOfDay();
    let format = 'post';
    let bgId = 'today';
    let currentBlob = null;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-wide share-verse">
            <div class="modal-title-row">
                <h2>Condividi il versetto</h2>
                <button class="icon-btn" data-close title="Chiudi"><i class="ri-close-line"></i></button>
            </div>
            <div class="share-layout">
                <div class="share-preview"><div class="apple-spinner"></div><img alt="Anteprima immagine del versetto" hidden></div>
                <div class="share-options">
                    <div class="field-label">FORMATO</div>
                    <div class="segmented share-formats">
                        ${Object.entries(SHARE_FORMATS).map(([id, f]) => `<button class="favorites-tab" data-format="${id}">${f.label}</button>`).join('')}
                    </div>
                    <div class="field-label">SFONDO</div>
                    <div class="bg-picker share-bgs">
                        ${SHARE_BACKGROUNDS.map(b => `<button type="button" class="bg-swatch" data-bg="${b.id}" title="${escapeHtml(b.name)}" aria-label="Sfondo: ${escapeHtml(b.name)}"
                            style="background:${b.img ? `url('${b.img().replace('w=1600', 'w=200')}') center/cover` : `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})`}"></button>`).join('')}
                    </div>
                    <div class="share-actions">
                        <button class="btn-apple" data-share><i class="ri-share-line"></i> Condividi</button>
                        <button class="btn-secondary" data-download><i class="ri-download-line"></i> Scarica</button>
                        <button class="btn-secondary" data-copy><i class="ri-file-copy-line"></i> Copia testo</button>
                    </div>
                    <p class="share-note" hidden></p>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const img = modal.querySelector('.share-preview img');
    const spinner = modal.querySelector('.share-preview .apple-spinner');
    const note = modal.querySelector('.share-note');
    const close = () => { if (img.src) URL.revokeObjectURL(img.src); modal.remove(); };
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('[data-close]').onclick = close;

    let renderToken = 0;
    async function refresh() {
        const token = ++renderToken;
        modal.querySelectorAll('[data-format]').forEach(b => b.classList.toggle('active', b.dataset.format === format));
        modal.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('selected', b.dataset.bg === bgId));
        modal.querySelector('.share-preview').dataset.format = format;
        spinner.hidden = false;
        note.hidden = true;
        try {
            const canvas = await renderVerseImage(format, bgId);
            let blob;
            try {
                blob = await canvasToBlob(canvas);
            } catch (e) {
                // Foto non utilizzabile per l'esportazione: si passa a uno sfondo a colori
                bgId = 'night';
                note.textContent = 'Questa foto non può essere esportata: uso uno sfondo a colori.';
                note.hidden = false;
                blob = await canvasToBlob(await renderVerseImage(format, bgId));
                modal.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('selected', b.dataset.bg === bgId));
            }
            if (token !== renderToken) return;
            currentBlob = blob;
            if (img.src) URL.revokeObjectURL(img.src);
            img.src = URL.createObjectURL(blob);
            img.hidden = false;
        } finally {
            if (token === renderToken) spinner.hidden = true;
        }
    }

    modal.querySelectorAll('[data-format]').forEach(b => b.onclick = () => { format = b.dataset.format; refresh(); });
    modal.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => { bgId = b.dataset.bg; refresh(); });

    const fileName = () => `versetto-${currentShareVerse().ref.replace(/[^\w]+/g, '-').toLowerCase()}.png`;
    modal.querySelector('[data-download]').onclick = () => {
        if (!currentBlob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(currentBlob);
        a.download = fileName();
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    modal.querySelector('[data-share]').onclick = async () => {
        if (!currentBlob) return;
        const file = new File([currentBlob], fileName(), { type: 'image/png' });
        // Il link dell'app accompagna anche l'immagine: nelle chat mostra il logo
        const caption = `“${currentShareVerse().text}” — ${currentShareVerse().ref}\n\n${typeof APP_PUBLIC_URL === 'string' ? APP_PUBLIC_URL : ''}`.trim();
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: currentShareVerse().kicker || 'Versetto del giorno', text: caption }); } catch (e) { /* annullato */ }
        } else {
            modal.querySelector('[data-download]').click();
            note.textContent = 'Questo dispositivo non permette di condividere immagini: l\'immagine è stata scaricata.';
            note.hidden = false;
        }
    };
    modal.querySelector('[data-copy]').onclick = async (e) => {
        const btn = e.currentTarget;
        try {
            await navigator.clipboard.writeText(`“${currentShareVerse().text}”\n— ${currentShareVerse().ref}`);
            flashButton(btn, '<i class="ri-check-line"></i> Copiato');
        } catch (err) { /* ignora */ }
    };

    refresh();
}

window.openShareVerseModal = openShareVerseModal;
