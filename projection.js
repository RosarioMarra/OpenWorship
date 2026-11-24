// =====================================================================
// OPEN WORSHIP - PROIEZIONE
// Sfondi (fissi, foto, animati, immagine propria), carattere, grandezza,
// transizioni, tastiera, proiezione su questo dispositivo e secondo
// schermo con regia (anteprima / in diretta).
// =====================================================================

// ---------- SFONDI ----------
const IMG_SHADE = 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5))';
const PROJ_BACKGROUNDS = [
    { id: 'black', name: 'Nero', css: '#000' },
    { id: 'night', name: 'Blu notte', css: 'linear-gradient(135deg, #07152e 0%, #163d7a 100%)' },
    { id: 'violet', name: 'Viola', css: 'linear-gradient(135deg, #1d0b2e 0%, #5b2a86 100%)' },
    { id: 'sunset', name: 'Tramonto', css: 'linear-gradient(135deg, #2b0d0d 0%, #a2461c 100%)' },
    { id: 'forest', name: 'Verde', css: 'linear-gradient(135deg, #04221a 0%, #1b6b50 100%)' },
    { id: 'slate', name: 'Grigio', css: 'linear-gradient(135deg, #15181d 0%, #3c4452 100%)' },
    { id: 'a-aurora', name: 'Aurora (animato)', anim: 'aurora' },
    { id: 'a-waves', name: 'Onde di colore (animato)', anim: 'waves' },
    { id: 'a-stars', name: 'Cielo stellato (animato)', anim: 'stars' },
    { id: 'a-bokeh', name: 'Luci soffuse (animato)', anim: 'bokeh' },
    { id: 'a-rays', name: 'Raggi di luce (animato)', anim: 'rays' },
    { id: 'a-clouds', name: 'Nuvole (animato)', anim: 'clouds' },
    { id: 'a-particles', name: 'Luci che salgono (animato)', anim: 'particles' },
    { id: 'a-ocean', name: 'Mare (animato)', anim: 'ocean' },
    { id: 'a-sunrise', name: 'Alba (animato)', anim: 'sunrise' },
    { id: 'a-snow', name: 'Neve (animato)', anim: 'snow' },
    { id: 'img1', name: 'Luce', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=1920") center/cover no-repeat` },
    { id: 'img2', name: 'Montagne', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1920") center/cover no-repeat` },
    { id: 'img3', name: 'Cielo', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1444084316824-dc26d6657664?w=1920") center/cover no-repeat` },
    { id: 'img4', name: 'Natura', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920") center/cover no-repeat` },
    { id: 'ph-montagne-alba', name: 'Montagne all\'alba', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920") center/cover no-repeat` },
    { id: 'ph-lago-alpino', name: 'Lago alpino', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920") center/cover no-repeat` },
    { id: 'ph-tramonto-prato', name: 'Tramonto sul prato', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1920") center/cover no-repeat` },
    { id: 'ph-spiaggia', name: 'Spiaggia', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920") center/cover no-repeat` },
    { id: 'ph-via-lattea', name: 'Via Lattea', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920") center/cover no-repeat` },
    { id: 'ph-bosco', name: 'Bosco', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920") center/cover no-repeat` },
    { id: 'ph-mare-tramonto', name: 'Mare al tramonto', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920") center/cover no-repeat` },
    { id: 'ph-albero', name: 'Albero', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1920") center/cover no-repeat` },
    { id: 'ph-valle', name: 'Valle alpina', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920") center/cover no-repeat` },
    { id: 'ph-lago-sera', name: 'Lago di sera', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=1920") center/cover no-repeat` },
    { id: 'ph-stelle', name: 'Cielo stellato', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920") center/cover no-repeat` },
    { id: 'ph-alberi-cielo', name: 'Alberi verso il cielo', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=1920") center/cover no-repeat` },
    { id: 'ph-colline', name: 'Colline verdi', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920") center/cover no-repeat` },
    { id: 'ph-onde', name: 'Onde', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920") center/cover no-repeat` },
    { id: 'ph-ponte', name: 'Ponte nel bosco', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1920") center/cover no-repeat` },
    { id: 'ph-montagne-rosa', name: 'Montagne al tramonto', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1500964757637-c85e8a162699?w=1920") center/cover no-repeat` },
    { id: 'ph-fiori', name: 'Fiori', css: `${IMG_SHADE}, url("https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1920") center/cover no-repeat` },
    { id: 'custom', name: 'La mia immagine', css: null }
];

// Immagine propria: salvata sul dispositivo; se non c'è spazio vale per la sessione
let customBgSession = '';
function getCustomBg() {
    try { return localStorage.getItem('projCustomBg') || customBgSession; } catch (e) { return customBgSession; }
}

// Descrizione dello sfondo: colore/immagine (css) oppure animazione (anim)
function bgSpec(id) {
    const bg = PROJ_BACKGROUNDS.find(b => b.id === id) || PROJ_BACKGROUNDS[0];
    if (bg.anim) return { css: '', anim: bg.anim };
    if (bg.id === 'custom') {
        const data = getCustomBg();
        return { css: data ? `${IMG_SHADE}, url("${data}") center/cover no-repeat` : '#000', anim: '' };
    }
    return { css: bg.css, anim: '' };
}
function projBgCss(id) { return bgSpec(id).css || '#000'; }

function applyBg(bgEl, id) {
    const spec = bgSpec(id);
    bgEl.className = 'proj-bg' + (spec.anim ? ' anim-' + spec.anim : '');
    bgEl.style.background = spec.anim ? '' : spec.css;
}

// Ridimensiona l'immagine scelta (max 1920px) e la salva sul dispositivo
function loadCustomBackground(file) {
    return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) { reject(new Error('Scegli un file immagine.')); return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            const data = canvas.toDataURL('image/jpeg', 0.82);
            try { localStorage.setItem('projCustomBg', data); } catch (e) { /* troppo grande: vale solo per questa sessione */ }
            customBgSession = data;
            resolve(data);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida.')); };
        img.src = url;
    });
}

// ---------- STILE DEL TESTO E TRANSIZIONI ----------
const PROJ_FONTS = [
    { id: 'system', name: 'Sistema (stile Apple)', css: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", Roboto, Arial, sans-serif' },
    { id: 'montserrat', name: 'Montserrat', css: '"Montserrat", "Inter", sans-serif' },
    { id: 'poppins', name: 'Poppins', css: '"Poppins", "Inter", sans-serif' },
    { id: 'oswald', name: 'Oswald (stretto)', css: '"Oswald", "Arial Narrow", sans-serif' },
    { id: 'playfair', name: 'Playfair (elegante)', css: '"Playfair Display", Georgia, serif' },
    { id: 'lora', name: 'Lora (classico)', css: '"Lora", Georgia, serif' }
];
const PROJ_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Oswald:wght@400;600&family=Playfair+Display:wght@400;700&family=Lora:wght@400;700&display=swap';
const PROJ_TRANSITIONS = [
    { id: 'none', name: 'Nessuna' },
    { id: 'fade', name: 'Dissolvenza' },
    { id: 'slide', name: 'Scorrimento' },
    { id: 'zoom', name: 'Zoom' },
    { id: 'blur', name: 'Sfocatura' }
];
const PROJ_SPEEDS = { fast: 300, normal: 600, slow: 1000 };
const DEFAULT_PROJ_STYLE = { font: 'system', scale: 100, bold: true, upper: false, transition: 'fade', speed: 'normal' };

function getProjStyle() {
    return { ...DEFAULT_PROJ_STYLE, ...(appSettings.projStyle || {}) };
}
function saveProjStyle(style) {
    appSettings.projStyle = style;
    saveSettings();
}
function fontCss(id) {
    return (PROJ_FONTS.find(f => f.id === id) || PROJ_FONTS[0]).css;
}

// Caricamento dei caratteri per la proiezione (solo quando servono)
function ensureProjFonts(doc = document) {
    if (doc.getElementById('owProjFonts')) return;
    const link = doc.createElement('link');
    link.id = 'owProjFonts';
    link.rel = 'stylesheet';
    link.href = PROJ_FONTS_URL;
    doc.head.appendChild(link);
}

// Stile in comune tra pagina principale e finestra del secondo schermo
const PROJ_SHARED_CSS = `
.proj-screen{--ps-font:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,Arial,sans-serif;--ps-weight:700;--ps-case:none}
.proj-bg{overflow:hidden}
.ps-lyrics,.ps-avviso{font-family:var(--ps-font);text-transform:var(--ps-case)}
.ps-lyrics{font-weight:var(--ps-weight)}
.ps-avviso .ps-title{font-weight:var(--ps-weight)}
@keyframes owIn-fade{from{opacity:0}to{opacity:1}}
@keyframes owOut-fade{from{opacity:1}to{opacity:0}}
@keyframes owIn-slide{from{opacity:0;transform:translateX(8%)}to{opacity:1;transform:none}}
@keyframes owOut-slide{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-8%)}}
@keyframes owIn-zoom{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:none}}
@keyframes owOut-zoom{from{opacity:1;transform:none}to{opacity:0;transform:scale(1.08)}}
@keyframes owIn-blur{from{opacity:0;filter:blur(14px)}to{opacity:1;filter:none}}
@keyframes owOut-blur{from{opacity:1;filter:none}to{opacity:0;filter:blur(14px)}}
.proj-bg[class*="anim-"]::before,.proj-bg[class*="anim-"]::after{content:"";position:absolute;inset:-30%;pointer-events:none}
.anim-aurora{background:#040716}
.anim-aurora::before{background:radial-gradient(38% 34% at 30% 40%,rgba(56,189,248,.55),transparent 70%),radial-gradient(34% 30% at 72% 62%,rgba(168,85,247,.5),transparent 70%);filter:blur(40px);animation:owAurora 18s ease-in-out infinite alternate}
.anim-aurora::after{background:radial-gradient(30% 28% at 62% 30%,rgba(34,197,94,.35),transparent 70%),radial-gradient(26% 24% at 28% 72%,rgba(236,72,153,.28),transparent 70%);filter:blur(50px);animation:owAurora2 24s ease-in-out infinite alternate}
@keyframes owAurora{0%{transform:translate(-8%,-4%) rotate(0deg)}100%{transform:translate(8%,6%) rotate(25deg)}}
@keyframes owAurora2{0%{transform:translate(6%,8%) scale(1)}100%{transform:translate(-10%,-6%) scale(1.25)}}
.anim-waves{background:linear-gradient(120deg,#0b1e3f,#1d4f91,#5b2a86,#a2461c,#0b1e3f);background-size:400% 400%;animation:owShift 26s ease-in-out infinite}
.anim-waves::before{background:radial-gradient(60% 50% at 50% 120%,rgba(255,255,255,.12),transparent 70%);animation:owBreath 9s ease-in-out infinite alternate}
@keyframes owShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes owBreath{from{opacity:.3;transform:scale(1)}to{opacity:1;transform:scale(1.15)}}
.anim-stars{background:radial-gradient(ellipse at 50% 120%,#1b2a44 0%,#070912 70%)}
.anim-stars::before{background-image:radial-gradient(1.6px 1.6px at 20px 30px,#fff,transparent),radial-gradient(1.2px 1.2px at 80px 120px,#fff,transparent),radial-gradient(1px 1px at 150px 60px,#dbeafe,transparent),radial-gradient(1.4px 1.4px at 200px 160px,#fff,transparent),radial-gradient(1px 1px at 260px 20px,#fff,transparent);background-size:300px 200px;animation:owTwinkle 5s ease-in-out infinite alternate,owDrift 160s linear infinite}
.anim-stars::after{background-image:radial-gradient(1.2px 1.2px at 50px 90px,#fff,transparent),radial-gradient(1.8px 1.8px at 170px 140px,#fde68a,transparent),radial-gradient(1px 1px at 240px 40px,#fff,transparent);background-size:280px 220px;animation:owTwinkle 7s ease-in-out infinite alternate-reverse,owDrift 220s linear infinite reverse}
@keyframes owTwinkle{from{opacity:.35}to{opacity:1}}
@keyframes owDrift{from{transform:translate(0,0)}to{transform:translate(-300px,-120px)}}
.anim-bokeh{background:linear-gradient(160deg,#160c2c,#3a1a4d 60%,#4d1f2f)}
.anim-bokeh::before{background:radial-gradient(5% 9% at 15% 80%,rgba(255,214,90,.35),transparent 70%),radial-gradient(8% 14% at 40% 60%,rgba(255,140,170,.25),transparent 70%),radial-gradient(6% 11% at 70% 85%,rgba(140,190,255,.3),transparent 70%),radial-gradient(9% 16% at 85% 40%,rgba(255,214,90,.2),transparent 70%),radial-gradient(4% 7% at 55% 30%,rgba(255,255,255,.25),transparent 70%);filter:blur(6px);animation:owFloat 22s ease-in-out infinite alternate}
.anim-bokeh::after{background:radial-gradient(7% 12% at 25% 35%,rgba(140,190,255,.22),transparent 70%),radial-gradient(5% 9% at 65% 55%,rgba(255,214,90,.28),transparent 70%),radial-gradient(10% 18% at 90% 75%,rgba(255,140,170,.18),transparent 70%);filter:blur(10px);animation:owFloat 30s ease-in-out infinite alternate-reverse}
@keyframes owFloat{from{transform:translateY(4%) translateX(-2%)}to{transform:translateY(-6%) translateX(3%)}}
.anim-rays{background:radial-gradient(ellipse at 50% -10%,#3b2a12 0%,#120b05 60%,#050302 100%)}
.anim-rays::before{background:repeating-conic-gradient(from 0deg at 50% -10%,rgba(255,220,150,.10) 0deg 6deg,transparent 6deg 18deg);animation:owSpin 90s linear infinite;transform-origin:50% 10%}
.anim-rays::after{background:radial-gradient(40% 35% at 50% 0%,rgba(255,210,120,.35),transparent 70%);animation:owBreath 7s ease-in-out infinite alternate}
@keyframes owSpin{to{transform:rotate(360deg)}}
.anim-clouds{background:linear-gradient(180deg,#0d2a4f 0%,#2f6aa8 60%,#7fb2e0 100%)}
.anim-clouds::before{background:radial-gradient(22% 14% at 20% 30%,rgba(255,255,255,.55),transparent 70%),radial-gradient(28% 16% at 60% 22%,rgba(255,255,255,.45),transparent 70%),radial-gradient(20% 12% at 85% 40%,rgba(255,255,255,.4),transparent 70%);filter:blur(14px);animation:owDriftX 60s linear infinite alternate}
.anim-clouds::after{background:radial-gradient(30% 16% at 30% 70%,rgba(255,255,255,.35),transparent 70%),radial-gradient(24% 14% at 75% 80%,rgba(255,255,255,.3),transparent 70%);filter:blur(20px);animation:owDriftX 90s linear infinite alternate-reverse}
@keyframes owDriftX{from{transform:translateX(-12%)}to{transform:translateX(12%)}}
.anim-particles{background:radial-gradient(ellipse at 50% 100%,#2a1a4a 0%,#0b0a18 70%)}
.anim-particles::before{background-image:radial-gradient(2px 2px at 20px 40px,rgba(255,220,150,.9),transparent),radial-gradient(1.5px 1.5px at 90px 120px,rgba(255,255,255,.8),transparent),radial-gradient(2.5px 2.5px at 160px 70px,rgba(255,200,120,.8),transparent),radial-gradient(1.5px 1.5px at 230px 160px,rgba(255,255,255,.7),transparent);background-size:260px 200px;animation:owRise 18s linear infinite}
.anim-particles::after{background-image:radial-gradient(3px 3px at 60px 90px,rgba(255,210,140,.6),transparent),radial-gradient(2px 2px at 190px 30px,rgba(255,255,255,.6),transparent);background-size:300px 240px;filter:blur(1px);animation:owRise 28s linear infinite}
@keyframes owRise{from{background-position:0 0}to{background-position:0 -1200px}}
.anim-ocean{background:linear-gradient(180deg,#021a2b 0%,#04394f 55%,#0a5b6e 100%)}
.anim-ocean::before{background:repeating-linear-gradient(170deg,rgba(255,255,255,.06) 0 2px,transparent 2px 38px);filter:blur(2px);animation:owSwell 12s ease-in-out infinite alternate}
.anim-ocean::after{background:radial-gradient(60% 30% at 50% 0%,rgba(120,220,255,.25),transparent 70%),repeating-linear-gradient(175deg,rgba(255,255,255,.05) 0 3px,transparent 3px 60px);animation:owSwell 18s ease-in-out infinite alternate-reverse}
@keyframes owSwell{from{transform:translate(-4%,0) skewY(-2deg)}to{transform:translate(4%,3%) skewY(2deg)}}
.anim-sunrise{background:linear-gradient(180deg,#120a2e,#4a1f5c,#b8456a,#f29b4b,#ffd27a);background-size:100% 300%;animation:owDawn 30s ease-in-out infinite alternate}
.anim-sunrise::before{background:radial-gradient(30% 22% at 50% 100%,rgba(255,236,170,.75),rgba(255,180,90,.25) 50%,transparent 75%);animation:owBreath 8s ease-in-out infinite alternate}
@keyframes owDawn{from{background-position:0 0}to{background-position:0 100%}}
.anim-snow{background:linear-gradient(180deg,#0b1830 0%,#1d3557 100%)}
.anim-snow::before{background-image:radial-gradient(2px 2px at 30px 20px,#fff,transparent),radial-gradient(1.5px 1.5px at 110px 80px,#fff,transparent),radial-gradient(2.5px 2.5px at 190px 140px,rgba(255,255,255,.9),transparent),radial-gradient(1.5px 1.5px at 250px 40px,#fff,transparent);background-size:280px 220px;animation:owFall 16s linear infinite}
.anim-snow::after{background-image:radial-gradient(3px 3px at 70px 60px,rgba(255,255,255,.7),transparent),radial-gradient(2px 2px at 200px 180px,rgba(255,255,255,.7),transparent);background-size:320px 260px;filter:blur(1px);animation:owFall 26s linear infinite}
@keyframes owFall{from{background-position:0 0}to{background-position:-120px 1200px}}
@media (prefers-reduced-motion: reduce){.proj-bg[class*="anim-"]::before,.proj-bg[class*="anim-"]::after,.anim-waves,.anim-sunrise{animation:none!important}}
`;
(function injectSharedCss() {
    const style = document.createElement('style');
    style.id = 'owProjShared';
    style.textContent = PROJ_SHARED_CSS;
    document.head.appendChild(style);
})();

// Applica carattere, peso e maiuscolo allo schermo; la grandezza la usa fitSlide
function applyTextStyle(screen, style) {
    screen.style.setProperty('--ps-font', fontCss(style.font));
    screen.style.setProperty('--ps-weight', style.bold ? '700' : '400');
    screen.style.setProperty('--ps-case', style.upper ? 'uppercase' : 'none');
    screen.dataset.scale = String((style.scale || 100) / 100);
}

// ---------- DIAPOSITIVE ----------
function buildSlides(type, hymnId) {
    if (type === 'avvisi') {
        return [...avvisiDB]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(a => ({
                kind: 'avviso',
                label: a.title,
                title: a.title,
                date: new Date(a.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
                desc: a.desc || '',
                text: a.title
            }));
    }
    const hymn = hymnsDB.find(h => h.id === hymnId);
    if (!hymn) return [];
    return SongTools.lyricSections(hymn.content).map(section => ({
        kind: 'lyrics',
        label: section.label,
        lines: section.lines,
        text: section.lines.join(' / ')
    }));
}

function slideInnerHtml(slide) {
    if (!slide) return '';
    if (slide.kind === 'avviso') {
        return `<div class="ps-content ps-avviso" data-base="3.4">
            <div class="ps-title">${escapeHtml(slide.title)}</div>
            <div class="ps-date">${escapeHtml(slide.date)}</div>
            <div class="ps-desc">${escapeHtml(slide.desc).replace(/\n/g, '<br>')}</div>
        </div>`;
    }
    return `<div class="ps-content ps-lyrics" data-base="6">${slide.lines.map(l => escapeHtml(l)).join('<br>')}</div>`;
}

// Grandezza scelta, ridotta solo se la strofa non entra nello schermo
function fitSlide(screen) {
    const content = screen && screen.querySelector('.ps-content');
    if (!content || !screen.clientHeight) return;
    const scale = parseFloat(screen.dataset.scale) || 1;
    let size = (parseFloat(content.dataset.base) || 6) * scale;
    content.style.fontSize = size + 'cqw';
    let guard = 0;
    while ((content.scrollHeight > screen.clientHeight * 0.86 || content.scrollWidth > screen.clientWidth * 0.94) && size > 1.4 && guard++ < 80) {
        size -= 0.2;
        content.style.fontSize = size + 'cqw';
    }
}

// Cambia la strofa con la transizione scelta
function swapSlide(screen, html, style, animate) {
    const text = screen.querySelector('.proj-text');
    const tr = animate ? style.transition : 'none';
    const dur = PROJ_SPEEDS[style.speed] || 600;
    const old = text.querySelector('.ps-content');
    clearTimeout(screen._swapTimer);
    const insert = () => {
        text.innerHTML = html;
        fitSlide(screen);
        const c = text.querySelector('.ps-content');
        if (c && tr !== 'none') c.style.animation = `owIn-${tr} ${dur}ms ease both`;
    };
    if (!old || tr === 'none') { insert(); return; }
    old.style.animation = `owOut-${tr} ${Math.round(dur * 0.45)}ms ease both`;
    screen._swapTimer = setTimeout(insert, Math.round(dur * 0.45));
}

function paintScreen(screen, slide, bgId, blank, opts = {}) {
    if (!screen) return;
    const style = opts.style || getProjStyle();
    applyBg(screen.querySelector('.proj-bg'), bgId);
    applyTextStyle(screen, style);
    screen.classList.toggle('is-blank', !!blank);
    const html = slideInnerHtml(slide);
    if (opts.animate && screen._lastHtml !== html) swapSlide(screen, html, style, true);
    else if (screen._lastHtml !== html || opts.force) swapSlide(screen, html, style, false);
    else fitSlide(screen);
    screen._lastHtml = html;
}

// ---------- CONTROLLI: SFONDO E STILE ----------
function renderBgPicker(container, selectedId, onChange) {
    container.innerHTML = '';
    container.classList.add('bg-picker');
    PROJ_BACKGROUNDS.forEach(bg => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bg-swatch' + (bg.id === selectedId ? ' selected' : '');
        btn.title = bg.name;
        btn.setAttribute('aria-label', 'Sfondo: ' + bg.name);
        if (bg.anim) {
            btn.classList.add('bg-swatch-anim');
            btn.innerHTML = `<span class="proj-bg anim-${bg.anim}"></span><i class="ri-sparkling-line"></i>`;
        } else if (bg.id === 'custom') {
            const data = getCustomBg();
            if (data) btn.style.background = projBgCss('custom');
            else btn.innerHTML = '<i class="ri-image-add-line"></i>';
            btn.classList.add('bg-swatch-custom');
        } else {
            btn.style.background = bg.css;
        }
        btn.onclick = () => {
            if (bg.id === 'custom') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async () => {
                    try {
                        await loadCustomBackground(input.files[0]);
                        onChange('custom');
                        renderBgPicker(container, 'custom', onChange);
                    } catch (e) { alert(e.message); }
                };
                input.click();
                return;
            }
            onChange(bg.id);
            renderBgPicker(container, bg.id, onChange);
        };
        container.appendChild(btn);
    });
}

function renderStyleControls(container, style, onChange) {
    container.classList.add('proj-style');
    container.innerHTML = `
        <label class="ps-field"><span>Carattere</span>
            <select class="apple-select" data-k="font">${PROJ_FONTS.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}</select>
        </label>
        <label class="ps-field"><span>Grandezza <b data-scale-label></b></span>
            <input type="range" min="60" max="150" step="5" data-k="scale">
        </label>
        <div class="ps-toggles">
            <label class="ps-check"><input type="checkbox" data-k="bold"> Grassetto</label>
            <label class="ps-check"><input type="checkbox" data-k="upper"> MAIUSCOLO</label>
        </div>
        <label class="ps-field"><span>Transizione</span>
            <select class="apple-select" data-k="transition">${PROJ_TRANSITIONS.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
        </label>
        <label class="ps-field"><span>Velocità</span>
            <select class="apple-select" data-k="speed"><option value="fast">Veloce</option><option value="normal">Normale</option><option value="slow">Lenta</option></select>
        </label>`;
    const label = container.querySelector('[data-scale-label]');
    container.querySelectorAll('[data-k]').forEach(el => {
        const k = el.dataset.k;
        if (el.type === 'checkbox') el.checked = !!style[k];
        else el.value = String(style[k]);
        if (k === 'scale') label.textContent = style.scale + '%';
        el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
            const next = { ...style };
            next[k] = el.type === 'checkbox' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
            if (k === 'scale') label.textContent = next.scale + '%';
            style = next;
            onChange(next, k);
        });
    });
}

// Menu impostazioni unico: schede "Sfondo" e "Testo" (carattere, grandezza, transizione)
let projSettingsTab = 'bg';
function renderProjSettings(container, bgId, style, onBg, onStyle) {
    container.innerHTML = `
        <div class="proj-menu-head">
            <div class="segmented proj-menu-tabs">
                <button type="button" class="favorites-tab" data-tab="bg"><i class="ri-image-2-line"></i> Sfondo</button>
                <button type="button" class="favorites-tab" data-tab="text"><i class="ri-font-size"></i> Testo</button>
            </div>
        </div>
        <div class="proj-menu-panel" data-panel="bg"></div>
        <div class="proj-menu-panel" data-panel="text"></div>`;
    const showTab = (tab) => {
        projSettingsTab = tab;
        container.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        container.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== tab; });
    };
    container.querySelectorAll('[data-tab]').forEach(t => { t.onclick = (e) => { e.stopPropagation(); showTab(t.dataset.tab); }; });
    renderBgPicker(container.querySelector('[data-panel="bg"]'), bgId, onBg);
    renderStyleControls(container.querySelector('[data-panel="text"]'), style, onStyle);
    showTab(projSettingsTab);
}

// Breve riepilogo delle impostazioni scelte (es. "Aurora · Montserrat · Dissolvenza")
function projSummary(bgId, style) {
    const bg = (PROJ_BACKGROUNDS.find(b => b.id === bgId) || PROJ_BACKGROUNDS[0]).name.replace(' (animato)', '');
    const font = (PROJ_FONTS.find(f => f.id === style.font) || PROJ_FONTS[0]).name.replace(/ \(.*\)/, '');
    const tr = (PROJ_TRANSITIONS.find(t => t.id === style.transition) || PROJ_TRANSITIONS[0]).name;
    return `${bg} · ${font} · ${tr}`;
}

// Apre/chiude un menu a comparsa; si chiude toccando fuori o con Esc
function bindPopover(button, menu, onOpen) {
    const close = () => { menu.classList.add('hidden'); button.classList.remove('is-on'); button.setAttribute('aria-expanded', 'false'); };
    button.onclick = (e) => {
        e.stopPropagation();
        const willOpen = menu.classList.contains('hidden');
        if (willOpen) { onOpen(); menu.classList.remove('hidden'); button.classList.add('is-on'); button.setAttribute('aria-expanded', 'true'); }
        else close();
    };
    menu.onclick = (e) => e.stopPropagation();
    if (!menu._outsideBound) {
        menu._outsideBound = true;
        document.addEventListener('click', () => { if (!menu.classList.contains('hidden')) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.classList.contains('hidden')) { close(); e.stopPropagation(); } }, true);
    }
    return close;
}

// ---------- STATO DELLA PROIEZIONE ----------
const Proj = {
    mode: null,          // 'local' | 'screen'
    type: null,
    title: '',
    slides: [],
    live: 0,
    preview: 0,
    blank: false,
    bg: 'black',
    style: { ...DEFAULT_PROJ_STYLE }
};
const projOrigin = () => (window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*');

function sendToScreen(msg) {
    if (presentationWindow && !presentationWindow.closed) presentationWindow.postMessage(msg, projOrigin());
}

function setLive(index) {
    if (!Proj.slides.length) return;
    Proj.live = Math.max(0, Math.min(Proj.slides.length - 1, index));
    Proj.preview = Math.min(Proj.slides.length - 1, Proj.live + 1);
    if (Proj.mode === 'screen') {
        sendToScreen({ type: 'show', index: Proj.live });
        renderRegia(false, true);
    } else {
        renderLocalPresentation(true);
    }
}

function setPreview(index) {
    Proj.preview = Math.max(0, Math.min(Proj.slides.length - 1, index));
    renderRegia();
}

function setBlank(on) {
    Proj.blank = on;
    if (Proj.mode === 'screen') { sendToScreen({ type: 'blank', on }); renderRegia(); }
    else renderLocalPresentation();
}

function setProjBackground(id) {
    Proj.bg = id;
    appSettings.projBg = id;
    saveSettings();
    if (Proj.mode === 'screen') { sendToScreen({ type: 'bg', bg: bgSpec(id) }); renderRegia(); }
    else if (Proj.mode === 'local') renderLocalPresentation();
}

function setProjStyle(style) {
    Proj.style = style;
    saveProjStyle(style);
    if (Proj.mode === 'screen') { sendToScreen({ type: 'style', style: screenStyle(style) }); renderRegia(); }
    else if (Proj.mode === 'local') renderLocalPresentation();
}

// Stile in forma pronta per la finestra del secondo schermo
function screenStyle(style) {
    return {
        font: fontCss(style.font),
        weight: style.bold ? '700' : '400',
        upper: !!style.upper,
        scale: (style.scale || 100) / 100,
        transition: style.transition,
        duration: PROJ_SPEEDS[style.speed] || 600
    };
}

// ---------- TASTIERA ----------
function handleProjectionKey(key) {
    if (!Proj.mode) return false;
    switch (key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Spacebar':
            setLive(Proj.live + 1); return true;
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
            setLive(Proj.live - 1); return true;
        case 'Home': setLive(0); return true;
        case 'End': setLive(Proj.slides.length - 1); return true;
        case 'Enter':
            if (Proj.mode === 'screen') { setLive(Proj.preview); return true; }
            return false;
        case 'b': case 'B': case '.':
            setBlank(!Proj.blank); return true;
        case 'Escape':
            if (Proj.mode === 'local') { closeProjection(); return true; }
            return false;
    }
    return false;
}

document.addEventListener('keydown', (e) => {
    if (!Proj.mode) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (handleProjectionKey(e.key)) e.preventDefault();
});

// ---------- SCELTA DELLA MODALITÀ ----------
function askPresentationMode(type, hymnId = null) {
    if (!isAdmin) return;
    const slides = buildSlides(type, hymnId);
    if (!slides.length) {
        alert(type === 'avvisi' ? "Nessun avviso da proiettare." : "Il cantico non ha testo da proiettare.");
        return;
    }
    ensureProjFonts();
    const hymn = hymnId ? hymnsDB.find(h => h.id === hymnId) : null;
    const title = type === 'avvisi' ? 'Avvisi' : (hymn ? hymn.title : 'Cantico');
    let chosenBg = appSettings.projBg || 'black';
    let chosenStyle = getProjStyle();
    let previewIndex = 0;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content proj-choice">
            <div class="proj-choice-head">
                <div class="proj-choice-titles">
                    <h2>Proietta</h2>
                    <p class="proj-choice-title">${escapeHtml(title)}</p>
                </div>
                <button class="icon-btn" id="projSettingsToggle" title="Impostazioni proiezione" aria-expanded="false"><i class="ri-settings-3-line"></i></button>
            </div>
            <div class="proj-choice-preview proj-screen" title="Tocca per vedere la transizione"><div class="proj-bg"></div><div class="proj-text"></div></div>
            <button type="button" class="proj-summary" id="projSummary"><i class="ri-equalizer-line"></i><span></span><i class="ri-arrow-down-s-line proj-summary-arrow"></i></button>
            <div class="proj-choice-settings" id="projChoiceSettings" hidden></div>
            <div class="proj-choice-actions">
                <button class="btn-apple" id="projectSecondScreenBtn"><i class="ri-tv-2-line"></i> Secondo schermo</button>
                <button class="btn-secondary" id="projectHereBtn"><i class="ri-fullscreen-line"></i> Questo dispositivo</button>
            </div>
            <button class="btn-text proj-cancel" id="cancelProjectBtn">Annulla</button>
        </div>`;
    document.body.appendChild(modal);
    const preview = modal.querySelector('.proj-choice-preview');
    const summary = modal.querySelector('#projSummary span');
    const settingsBox = modal.querySelector('#projChoiceSettings');
    const toggleBtn = modal.querySelector('#projSettingsToggle');
    const repaint = (animate) => {
        paintScreen(preview, slides[previewIndex], chosenBg, false, { style: chosenStyle, animate, force: !animate });
        summary.textContent = projSummary(chosenBg, chosenStyle);
    };
    const renderSettings = () => renderProjSettings(settingsBox, chosenBg, chosenStyle,
        (id) => { chosenBg = id; repaint(false); },
        (style, key) => {
            chosenStyle = style;
            if (key === 'transition' || key === 'speed') {
                previewIndex = (previewIndex + 1) % slides.length;
                repaint(true);
            } else {
                repaint(false);
            }
        });
    // Le impostazioni restano chiuse finché non servono: la finestra resta corta
    const toggleSettings = () => {
        const open = settingsBox.hidden;
        if (open) renderSettings();
        settingsBox.hidden = !open;
        toggleBtn.classList.toggle('is-on', open);
        toggleBtn.setAttribute('aria-expanded', String(open));
        modal.querySelector('.proj-summary').classList.toggle('open', open);
    };
    toggleBtn.onclick = toggleSettings;
    modal.querySelector('#projSummary').onclick = toggleSettings;
    summary.textContent = projSummary(chosenBg, chosenStyle);
    // Tocco sull'anteprima: mostra la strofa successiva con la transizione
    preview.onclick = () => { previewIndex = (previewIndex + 1) % slides.length; repaint(true); };
    requestAnimationFrame(() => repaint(false));
    if (document.fonts) document.fonts.ready.then(() => fitSlide(preview));

    const close = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#cancelProjectBtn').onclick = close;
    modal.querySelector('#projectHereBtn').onclick = () => {
        close();
        startProjection('local', type, title, slides, chosenBg, chosenStyle);
    };
    modal.querySelector('#projectSecondScreenBtn').onclick = () => {
        close();
        startProjection('screen', type, title, slides, chosenBg, chosenStyle);
    };
}

function startProjection(mode, type, title, slides, bg, style) {
    closeProjection();
    Object.assign(Proj, {
        mode, type, title, slides, live: 0, preview: Math.min(1, slides.length - 1),
        blank: false, bg, style: style || getProjStyle()
    });
    appSettings.projBg = bg;
    saveProjStyle(Proj.style);
    ensureProjFonts();
    if (mode === 'local') openLocalPresentation();
    else openSecondScreen();
}

function closeProjection() {
    if (presentationWindow && !presentationWindow.closed) presentationWindow.close();
    presentationWindow = null;
    clearInterval(projCloseChecker);
    document.getElementById('presentationOverlay').classList.add('hidden');
    document.getElementById('regiaPanel').classList.add('hidden');
    document.body.classList.remove('regia-open');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    Proj.mode = null;
}
// Compatibilità con i richiami esistenti
function hideRemoteBar() { if (Proj.mode === 'screen') closeProjection(); }
function startHymnPresentation(hymnId) {
    const slides = buildSlides('cantico', hymnId);
    const hymn = hymnsDB.find(h => h.id === hymnId);
    if (slides.length) startProjection('local', 'cantico', hymn ? hymn.title : '', slides, appSettings.projBg || 'black', getProjStyle());
}
function startAvvisiPresentation() {
    const slides = buildSlides('avvisi');
    if (slides.length) startProjection('local', 'avvisi', 'Avvisi', slides, appSettings.projBg || 'black', getProjStyle());
}

// ---------- PROIEZIONE SU QUESTO DISPOSITIVO ----------
function openLocalPresentation() {
    const overlay = document.getElementById('presentationOverlay');
    overlay.classList.remove('hidden');
    document.getElementById('exitPresentationBtn').onclick = closeProjection;
    document.getElementById('presPrevBtn').onclick = () => setLive(Proj.live - 1);
    document.getElementById('presNextBtn').onclick = () => setLive(Proj.live + 1);
    document.getElementById('presBlackBtn').onclick = () => setBlank(!Proj.blank);
    const tray = document.getElementById('presBgTray');
    tray.classList.add('hidden');
    bindPopover(document.getElementById('presBgBtn'), tray, () =>
        renderProjSettings(tray, Proj.bg, Proj.style, setProjBackground, (style) => setProjStyle(style)));
    document.getElementById('presPreviewPrev').onclick = (e) => { e.stopPropagation(); setLive(Proj.live - 1); };
    document.getElementById('presPreviewNext').onclick = (e) => { e.stopPropagation(); setLive(Proj.live + 1); };

    // Scorrimento col dito o tocco ai lati: cambia strofa
    const stage = document.getElementById('presentationStage');
    stage._lastHtml = null;
    let startX = null;
    stage.ontouchstart = (e) => { startX = e.touches[0].clientX; };
    stage.ontouchend = (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) { setLive(Proj.live + (dx < 0 ? 1 : -1)); startX = null; e.preventDefault(); }
        startX = null;
    };
    stage.onclick = (e) => {
        // Con il menu aperto il tocco serve solo a chiuderlo (lo fa il menu stesso)
        if (!tray.classList.contains('hidden')) return;
        const x = e.clientX / window.innerWidth;
        setLive(Proj.live + (x < 0.3 ? -1 : 1));
    };
    if (overlay.requestFullscreen && window.innerWidth > 768) overlay.requestFullscreen().catch(() => {});
    renderLocalPresentation(false);
    if (document.fonts) document.fonts.ready.then(() => fitSlide(stage));
}

function renderLocalPresentation(animate) {
    if (Proj.mode !== 'local') return;
    const stage = document.getElementById('presentationStage');
    paintScreen(stage, Proj.slides[Proj.live], Proj.bg, Proj.blank, { style: Proj.style, animate });
    document.getElementById('presCounter').textContent = `${Proj.live + 1} / ${Proj.slides.length}`;
    document.getElementById('presBlackBtn').classList.toggle('active', Proj.blank);
    const prev = Proj.slides[Proj.live - 1];
    const next = Proj.slides[Proj.live + 1];
    const pp = document.getElementById('presPreviewPrev');
    const pn = document.getElementById('presPreviewNext');
    pp.style.visibility = prev ? 'visible' : 'hidden';
    pn.style.visibility = next ? 'visible' : 'hidden';
    pp.innerHTML = prev ? `<i class="ri-arrow-left-s-line"></i> ${escapeHtml(prev.label)}` : '';
    pn.innerHTML = next ? `${escapeHtml(next.label)} <i class="ri-arrow-right-s-line"></i>` : '';
}
window.addEventListener('resize', () => {
    if (Proj.mode === 'local') fitSlide(document.getElementById('presentationStage'));
    if (Proj.mode === 'screen') renderRegia();
});

// ---------- SECONDO SCHERMO ----------
let projCloseChecker = null;
let projMessageHandler = () => {};

// Rilevamento del secondo schermo (Chrome ed Edge, API "Window Management").
// Con il permesso già concesso i dati degli schermi sono pronti in anticipo,
// così la finestra si apre subito sullo schermo esterno senza perdere il clic.
let projScreenDetails = null;
function screenEsterno(details) {
    if (!details || !details.screens || details.screens.length < 2) return null;
    const altri = details.screens.filter(s => s !== details.currentScreen);
    return altri.find(s => !s.isInternal) || altri[0] || null;
}
async function caricaSchermi(chiediPermesso) {
    if (!('getScreenDetails' in window)) return null;
    try {
        if (!chiediPermesso && navigator.permissions) {
            const p = await navigator.permissions.query({ name: 'window-management' });
            if (p.state !== 'granted') return null;
        }
        projScreenDetails = await window.getScreenDetails();
        return projScreenDetails;
    } catch (e) { return null; }
}
caricaSchermi(false);

// Prima volta: la finestra si apre subito, poi (dopo il permesso) si sposta sullo schermo esterno
async function spostaSuSchermoEsterno(win) {
    const details = projScreenDetails || await caricaSchermi(true);
    const target = screenEsterno(details);
    if (!target || !win || win.closed) return;
    try {
        win.moveTo(target.availLeft, target.availTop);
        win.resizeTo(target.availWidth, target.availHeight);
    } catch (e) { /* il browser non permette di spostarla */ }
    try { win.postMessage({ type: 'fullscreen' }, '*'); } catch (e) { /* ignora */ }
}

function openSecondScreen() {
    const target = screenEsterno(projScreenDetails);
    const features = target
        ? `popup,fullscreen,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`
        : `popup,width=1280,height=720,left=${Math.max(0, window.screen.width - 1280)},top=0`;
    presentationWindow = window.open('', 'openWorshipProiezione', features);
    if (presentationWindow && !target) spostaSuSchermoEsterno(presentationWindow);
    if (!presentationWindow) {
        alert("Il popup è stato bloccato. Consenti i popup per questo sito e riprova.");
        Proj.mode = null;
        return;
    }
    presentationWindow.document.open();
    presentationWindow.document.write(buildSecondScreenHtml());
    presentationWindow.document.close();

    const init = () => {
        sendToScreen({
            type: 'init',
            slides: Proj.slides.map(slideInnerHtml),
            index: Proj.live,
            bg: bgSpec(Proj.bg),
            blank: Proj.blank,
            title: Proj.title,
            style: screenStyle(Proj.style)
        });
    };
    // La finestra conferma quando è pronta
    window.removeEventListener('message', projMessageHandler);
    projMessageHandler = (e) => {
        if (!presentationWindow || e.source !== presentationWindow || !e.data) return;
        if (e.data.type === 'ready') init();
        if (e.data.type === 'key') handleProjectionKey(e.data.key);
    };
    window.addEventListener('message', projMessageHandler);
    setTimeout(init, 300);

    clearInterval(projCloseChecker);
    projCloseChecker = setInterval(() => {
        if (!presentationWindow || presentationWindow.closed) {
            clearInterval(projCloseChecker);
            presentationWindow = null;
            if (Proj.mode === 'screen') closeProjection();
        }
    }, 700);

    openRegia();
}

function buildSecondScreenHtml() {
    return `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><title>Open Worship - Proiezione</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap" rel="stylesheet">
<link href="${PROJ_FONTS_URL}" rel="stylesheet">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;cursor:none;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",Roboto,Arial,sans-serif}
  .proj-screen{position:fixed;inset:0;container-type:size;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;background:#000}
  .proj-bg{position:absolute;inset:0;transition:opacity .4s}
  .proj-text{position:relative;z-index:1;width:100%;padding:0 5cqw;box-sizing:border-box;transition:opacity .3s}
  .ps-content{max-height:86cqh;overflow:hidden}
  .ps-lyrics{line-height:1.28;text-shadow:0 .3cqw 1.2cqw rgba(0,0,0,.55)}
  .ps-avviso{text-align:left}
  .ps-title{font-size:1.6em;margin-bottom:.3em}
  .ps-date{font-size:.75em;opacity:.75;margin-bottom:1em;text-transform:capitalize}
  .ps-desc{font-weight:500;line-height:1.45}
  .is-blank .proj-text,.is-blank .proj-bg{opacity:0}
  .hint{position:fixed;bottom:12px;right:16px;color:rgba(255,255,255,.35);font-size:12px;z-index:2;transition:opacity 1s}
  .fs-ask{position:fixed;left:50%;bottom:6vh;transform:translateX(-50%);z-index:3;padding:14px 26px;border-radius:999px;background:rgba(0,122,255,.92);color:#fff;font-size:20px;font-weight:600;box-shadow:0 10px 40px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap;display:none}
  .fs-ask.show{display:block}
  ${PROJ_SHARED_CSS}
</style></head>
<body>
<div class="proj-screen" id="screen"><div class="proj-bg" id="bg"></div><div class="proj-text" id="text"></div></div>
<div class="hint" id="hint">Clic: schermo intero · Esc: esci · Frecce: cambia strofa</div>
<div class="fs-ask" id="fsAsk">Clicca una volta per lo schermo intero</div>
<script>
  var slides = [], parentOrigin = '*', current = -1, timer = null;
  var st = { font: '', weight: '700', upper: false, scale: 1, transition: 'fade', duration: 600 };
  var screenEl = document.getElementById('screen');
  var textEl = document.getElementById('text');
  function applyStyle(){
    screenEl.style.setProperty('--ps-font', st.font || '');
    screenEl.style.setProperty('--ps-weight', st.weight);
    screenEl.style.setProperty('--ps-case', st.upper ? 'uppercase' : 'none');
  }
  function fit(){
    var c = screenEl.querySelector('.ps-content'); if(!c) return;
    var size = (parseFloat(c.dataset.base) || 6) * (st.scale || 1); c.style.fontSize = size + 'cqw'; var g = 0;
    while((c.scrollHeight > screenEl.clientHeight*0.86 || c.scrollWidth > screenEl.clientWidth*0.94) && size > 1.4 && g++ < 80){ size -= 0.2; c.style.fontSize = size + 'cqw'; }
  }
  function setBg(spec){
    var bg = document.getElementById('bg');
    bg.className = 'proj-bg' + (spec && spec.anim ? ' anim-' + spec.anim : '');
    bg.style.background = spec && spec.anim ? '' : ((spec && spec.css) || '#000');
  }
  function show(i, animate){
    current = i;
    var tr = animate ? st.transition : 'none', dur = st.duration || 600;
    var old = textEl.querySelector('.ps-content');
    clearTimeout(timer);
    function insert(){
      textEl.innerHTML = slides[i] || ''; fit();
      var c = textEl.querySelector('.ps-content');
      if (c && tr !== 'none') c.style.animation = 'owIn-' + tr + ' ' + dur + 'ms ease both';
    }
    if (!old || tr === 'none') { insert(); return; }
    old.style.animation = 'owOut-' + tr + ' ' + Math.round(dur * 0.45) + 'ms ease both';
    timer = setTimeout(insert, Math.round(dur * 0.45));
  }
  window.addEventListener('message', function(e){
    if (e.source !== window.opener || !e.data) return;
    var d = e.data;
    if (d.type === 'init') {
      parentOrigin = e.origin && e.origin !== 'null' ? e.origin : '*';
      slides = d.slides || []; document.title = 'Proiezione - ' + (d.title || '');
      if (d.style) st = d.style; applyStyle();
      setBg(d.bg);
      screenEl.classList.toggle('is-blank', !!d.blank);
      show(d.index || 0, false);
    } else if (d.type === 'show') show(d.index, true);
    else if (d.type === 'bg') setBg(d.bg);
    else if (d.type === 'blank') screenEl.classList.toggle('is-blank', !!d.on);
    else if (d.type === 'style') { st = d.style; applyStyle(); fit(); }
    else if (d.type === 'fullscreen') goFullscreen();
  });
  // Schermo intero: si prova da sola; se il browser vuole un clic, lo si chiede ben visibile
  var fsAsk = document.getElementById('fsAsk');
  function updateFsAsk(){ fsAsk.classList.toggle('show', !document.fullscreenElement); }
  function goFullscreen(){
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) { updateFsAsk(); return; }
    document.documentElement.requestFullscreen().then(updateFsAsk, updateFsAsk);
  }
  document.addEventListener('fullscreenchange', updateFsAsk);
  document.addEventListener('click', function(){ if (!document.fullscreenElement) goFullscreen(); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'F11') return;
    if (window.opener) { window.opener.postMessage({ type: 'key', key: e.key }, parentOrigin); e.preventDefault(); }
  });
  window.addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);
  setTimeout(function(){ document.getElementById('hint').style.opacity = 0; }, 5000);
  if (window.opener) window.opener.postMessage({ type: 'ready' }, '*');
  setTimeout(goFullscreen, 150);
<\/script>
</body></html>`;
}

// ---------- REGIA ----------
function openRegia() {
    const panel = document.getElementById('regiaPanel');
    panel.classList.remove('hidden');
    document.body.classList.add('regia-open');
    document.getElementById('regiaTitle').textContent = Proj.title;
    document.getElementById('regiaClose').onclick = closeProjection;
    document.getElementById('regiaPrev').onclick = () => setLive(Proj.live - 1);
    document.getElementById('regiaNext').onclick = () => setLive(Proj.live + 1);
    document.getElementById('regiaGoLive').onclick = () => setLive(Proj.preview);
    document.getElementById('regiaBlack').onclick = () => setBlank(!Proj.blank);
    const menu = document.getElementById('regiaSettingsMenu');
    menu.classList.add('hidden');
    bindPopover(document.getElementById('regiaSettingsBtn'), menu, () =>
        renderProjSettings(menu, Proj.bg, Proj.style, setProjBackground, (style) => setProjStyle(style)));
    document.getElementById('regiaPreviewScreen')._lastHtml = null;
    document.getElementById('regiaLiveScreen')._lastHtml = null;
    renderRegia(true);
    if (document.fonts) document.fonts.ready.then(() => renderRegia());
}

function renderRegia(rebuildList, animateLive) {
    if (Proj.mode !== 'screen') return;
    paintScreen(document.getElementById('regiaPreviewScreen'), Proj.slides[Proj.preview], Proj.bg, false, { style: Proj.style });
    paintScreen(document.getElementById('regiaLiveScreen'), Proj.slides[Proj.live], Proj.bg, Proj.blank, { style: Proj.style, animate: !!animateLive });
    document.getElementById('regiaCounter').textContent = `${Proj.live + 1} / ${Proj.slides.length}`;
    document.getElementById('regiaBlack').classList.toggle('active', Proj.blank);

    const list = document.getElementById('regiaSlides');
    if (rebuildList || list.children.length !== Proj.slides.length) {
        list.innerHTML = '';
        Proj.slides.forEach((slide, i) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'regia-slide';
            card.innerHTML = `<span class="regia-slide-head"><span class="regia-slide-num">${i + 1}</span><span class="regia-slide-label">${escapeHtml(slide.label)}</span><span class="regia-slide-badge"></span></span>
                <span class="regia-slide-text">${escapeHtml(slide.kind === 'avviso' ? slide.desc : slide.lines.join('\n'))}</span>`;
            card.onclick = () => setPreview(i);
            card.ondblclick = () => setLive(i);
            list.appendChild(card);
        });
    }
    [...list.children].forEach((card, i) => {
        card.classList.toggle('is-live', i === Proj.live);
        card.classList.toggle('is-preview', i === Proj.preview && i !== Proj.live);
        card.querySelector('.regia-slide-badge').textContent = i === Proj.live ? 'IN DIRETTA' : (i === Proj.preview ? 'ANTEPRIMA' : '');
    });
    const liveCard = list.children[Proj.live];
    if (liveCard && !rebuildList) liveCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

window.askPresentationMode = askPresentationMode;
window.startHymnPresentation = startHymnPresentation;
