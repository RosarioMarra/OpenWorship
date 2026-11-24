// =====================================================================
// SCALETTE DEL SERVIZIO
// Ogni scaletta ha una data, un titolo facoltativo e un elenco di cantici.
// Ogni cantico ha un numero progressivo (la sua posizione) e un'etichetta.
// Tutti gli utenti le vedono, solo gli amministratori le creano e modificano
// (regole nel database, vedi supabase-scalette.sql).
// =====================================================================

const SCALETTA_ETICHETTE = [
    { id: 'preghiera', nome: 'Preghiera', tono: 'tone-purple' },
    { id: 'inizio', nome: 'Inizio', tono: 'tone-blue' },
    { id: 'testimonianze', nome: 'Testimonianze', tono: 'tone-orange' },
    { id: 'offerta', nome: 'Offerta', tono: 'tone-green' }
];
let scaletteDB = [];
let scalettaApertaId = null;
let scalettaEtichettaScelta = 'inizio';
let scalettaModificaId = null;

try { scaletteDB = JSON.parse(localStorage.getItem('scaletteDB') || '[]'); } catch (e) { scaletteDB = []; }

function etichettaInfo(id) {
    return SCALETTA_ETICHETTE.find(e => e.id === id) || SCALETTA_ETICHETTE[1];
}
function dataLocale(iso) {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return y ? new Date(y, (m || 1) - 1, d || 1) : new Date();
}
function oggiIso() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function dataLunga(iso) {
    const s = dataLocale(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
}
function titoloCantico(id) {
    const h = hymnsDB.find(x => String(x.id) === String(id));
    return h ? h.title : 'Cantico non più disponibile';
}

async function loadScalette() {
    const { data, error } = await supabaseClient.from('scalette').select('*');
    if (error || !data) { console.error('Errore download scalette', error); return; }
    scaletteDB = data;
    try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (e) { /* spazio pieno */ }
    if (currentTab === 'scalette') renderScalette();
    apriScalettaDaLink();
    renderDashScaletta();
}

async function salvaScaletta(scaletta) {
    scaletta.updated_at = new Date().toISOString();
    const { error } = await supabaseClient.from('scalette')
        .update({ data: scaletta.data, titolo: scaletta.titolo, voci: scaletta.voci, updated_at: scaletta.updated_at })
        .eq('id', scaletta.id);
    if (error) {
        alert('Salvataggio non riuscito: ' + error.message);
        await loadScalette();
        return false;
    }
    try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (e) { /* spazio pieno */ }
    renderDashScaletta();
    return true;
}

// ---------- disegno ----------
function renderScalette() {
    const list = document.getElementById('hymnsList');
    if (!list) return;
    const aperta = scaletteDB.find(s => s.id === scalettaApertaId);
    if (aperta) return renderScalettaDettaglio(list, aperta);
    scalettaApertaId = null;

    const oggi = oggiIso();
    const prossime = scaletteDB.filter(s => s.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
    const passate = scaletteDB.filter(s => s.data < oggi).sort((a, b) => b.data.localeCompare(a.data));
    const card = (s, prossimo) => {
        const n = (s.voci || []).length;
        return `
        <button type="button" class="scaletta-card${prossimo ? ' is-next' : ''}" onclick="apriScaletta('${escapeHtml(s.id)}')">
            ${tesseraData(s.data)}
            <span class="scaletta-card-main">
                ${prossimo ? '<span class="scaletta-next-badge">Prossimo servizio</span>' : ''}
                <span class="scaletta-card-title">${escapeHtml(s.titolo || 'Servizio')}</span>
                <span class="scaletta-card-sub"><i class="ri-music-2-line"></i> ${n} ${n === 1 ? 'cantico' : 'cantici'}</span>
            </span>
            <i class="ri-arrow-right-s-line scaletta-card-go"></i>
        </button>`;
    };
    const gruppo = (titolo, elenco, conProssimo) => elenco.length ? `
        <section class="scalette-group">
            <h3 class="scalette-group-title">${titolo}</h3>
            <div class="scalette-grid">${elenco.map((s, i) => card(s, conProssimo && i === 0)).join('')}</div>
        </section>` : '';
    const nuova = isAdmin ? '<button type="button" class="btn-apple" onclick="openScalettaModal()"><i class="ri-add-line"></i> Nuovo servizio</button>' : '';
    const totale = scaletteDB.length;

    list.innerHTML = totale ? `
        <div class="scalette-toolbar">
            <span class="scalette-count">${totale} ${totale === 1 ? 'servizio' : 'servizi'}</span>
            ${nuova}
        </div>
        ${gruppo('Prossimi', prossime, true)}
        ${gruppo('Passati', passate, false)}` : `
        <div class="scalette-empty">
            <span class="scalette-empty-icon"><i class="ri-list-ordered"></i></span>
            <h3>Nessun servizio</h3>
            <p>${isAdmin ? 'Crea il prossimo servizio e scegli i cantici.' : 'Qui troverai i cantici dei prossimi servizi.'}</p>
            ${nuova}
        </div>`;
}

// Tessera con giorno della settimana, giorno e mese
function tesseraData(iso, grande) {
    const d = dataLocale(iso);
    const giorno = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '');
    const mese = d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '');
    return `<span class="scaletta-date${grande ? ' is-large' : ''}"><small>${giorno}</small><b>${d.getDate()}</b><small>${mese}</small></span>`;
}

// "12 - Titolo" diventa { numero: "12", nome: "Titolo" }
function partiTitolo(titolo) {
    const m = String(titolo || '').match(/^\s*(\d+)\s*[-–.:)]?\s*(.*)$/);
    return m && m[2] ? { numero: m[1], nome: m[2] } : { numero: '', nome: String(titolo || '') };
}

function renderScalettaDettaglio(list, s) {
    const voci = s.voci || [];
    const righe = voci.map((v, i) => {
        const et = etichettaInfo(v.etichetta);
        const id = escapeHtml(v.cantico_id);
        const t = partiTitolo(titoloCantico(v.cantico_id));
        return `
        <li class="scaletta-voce">
            <span class="scaletta-num">${i + 1}</span>
            <button type="button" class="scaletta-voce-main" onclick="openHymnView('${id}')" title="Apri il cantico">
                <span class="scaletta-voce-title">${escapeHtml(t.nome)}</span>
                <span class="scaletta-voce-meta">
                    <span class="scaletta-tag ${et.tono}">${et.nome}</span>
                    ${t.numero ? `<span class="scaletta-hymn-no">Cantico n. ${escapeHtml(t.numero)}</span>` : ''}
                </span>
            </button>
            ${isAdmin ? `
            <div class="scaletta-voce-actions">
                <select class="apple-select scaletta-tag-select" title="Etichetta" onchange="cambiaEtichettaVoce(${i}, this.value)">
                    ${SCALETTA_ETICHETTE.map(e => `<option value="${e.id}" ${e.id === et.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
                </select>
                <button type="button" class="scaletta-mini-btn" title="Sposta su" ${i === 0 ? 'disabled' : ''} onclick="spostaVoce(${i}, -1)"><i class="ri-arrow-up-s-line"></i></button>
                <button type="button" class="scaletta-mini-btn" title="Sposta giù" ${i === voci.length - 1 ? 'disabled' : ''} onclick="spostaVoce(${i}, 1)"><i class="ri-arrow-down-s-line"></i></button>
                <button type="button" class="scaletta-mini-btn is-danger" title="Togli dal servizio" onclick="togliVoce(${i})"><i class="ri-close-line"></i></button>
            </div>` : '<i class="ri-arrow-right-s-line scaletta-voce-go"></i>'}
        </li>`;
    }).join('');
    const n = voci.length;

    list.innerHTML = `
        <div class="scaletta-detail">
            <button type="button" class="scaletta-back" onclick="chiudiScaletta()"><i class="ri-arrow-left-s-line"></i> Tutti i servizi</button>
            <div class="scaletta-hero">
                ${tesseraData(s.data, true)}
                <div class="scaletta-hero-text">
                    <h2>${escapeHtml(s.titolo || 'Servizio')}</h2>
                    <p>${escapeHtml(dataLunga(s.data))}</p>
                    <p class="scaletta-hero-count"><i class="ri-music-2-line"></i> ${n} ${n === 1 ? 'cantico' : 'cantici'}</p>
                </div>
                <div class="scaletta-hero-actions">
                    <button type="button" class="icon-btn" title="Condividi il servizio" onclick="condividiScaletta('${escapeHtml(s.id)}')"><i class="ri-share-line"></i></button>
                    ${isAdmin ? `
                    <button type="button" class="icon-btn" title="Modifica data e titolo" onclick="openScalettaModal('${escapeHtml(s.id)}')"><i class="ri-pencil-line"></i></button>
                    <button type="button" class="icon-btn icon-danger" title="Elimina servizio" onclick="eliminaScaletta('${escapeHtml(s.id)}')"><i class="ri-delete-bin-line"></i></button>` : ''}
                </div>
            </div>
            ${n ? `<ol class="scaletta-voci">${righe}</ol>` : `
            <div class="scalette-empty is-compact">
                <span class="scalette-empty-icon"><i class="ri-music-2-line"></i></span>
                <p>${isAdmin ? 'Nessun cantico ancora: aggiungi il primo qui sotto.' : 'Nessun cantico in questo servizio.'}</p>
            </div>`}
            ${isAdmin ? `
            <div class="scaletta-add">
                <div class="scaletta-add-title"><i class="ri-add-circle-line"></i> Aggiungi un cantico <small>sarà il n. ${n + 1}</small></div>
                <div class="scaletta-add-row">
                    <select id="scalettaEtichetta" class="apple-select" title="Etichetta">
                        ${SCALETTA_ETICHETTE.map(e => `<option value="${e.id}" ${e.id === scalettaEtichettaScelta ? 'selected' : ''}>${e.nome}</option>`).join('')}
                    </select>
                    <div class="search-bar scaletta-search">
                        <i class="ri-search-line"></i>
                        <input type="search" id="scalettaCerca" placeholder="Cerca per titolo o numero" autocomplete="off">
                    </div>
                </div>
                <div class="scaletta-risultati" id="scalettaRisultati"></div>
            </div>` : ''}
        </div>`;

    const cerca = document.getElementById('scalettaCerca');
    if (cerca) {
        cerca.addEventListener('input', () => mostraRisultatiScaletta(cerca.value));
        document.getElementById('scalettaEtichetta').addEventListener('change', (e) => { scalettaEtichettaScelta = e.target.value; });
    }
}

function mostraRisultatiScaletta(testo) {
    const box = document.getElementById('scalettaRisultati');
    if (!box) return;
    const q = testo.trim().toLowerCase();
    if (!q) { box.innerHTML = ''; return; }
    const trovati = hymnsDB.filter(h => String(h.title || '').toLowerCase().includes(q))
        .sort((a, b) => String(a.title).localeCompare(String(b.title), 'it', { numeric: true }))
        .slice(0, 8);
    box.innerHTML = trovati.length
        ? trovati.map(h => `<button type="button" class="scaletta-risultato" onclick="aggiungiVoce('${escapeHtml(h.id)}')"><i class="ri-add-circle-line"></i> ${escapeHtml(h.title)}</button>`).join('')
        : '<p class="scaletta-nessuno">Nessun cantico trovato</p>';
}

// ---------- azioni ----------
function apriScaletta(id) {
    scalettaApertaId = id;
    renderScalette();
    const main = document.querySelector('.main-content');
    if (main) main.scrollTop = 0;
}
function chiudiScaletta() {
    scalettaApertaId = null;
    renderScalette();
}

async function modificaVoci(trasforma) {
    if (!isAdmin) return;
    const s = scaletteDB.find(x => x.id === scalettaApertaId);
    if (!s) return;
    s.voci = trasforma([...(s.voci || [])]);
    renderScalette();
    await salvaScaletta(s);
}
function aggiungiVoce(canticoId) {
    const sel = document.getElementById('scalettaEtichetta');
    if (sel) scalettaEtichettaScelta = sel.value;
    modificaVoci(v => [...v, { cantico_id: canticoId, etichetta: scalettaEtichettaScelta }]).then(() => {
        showVerseToast('Cantico aggiunto');
        document.getElementById('scalettaCerca')?.focus();
    });
}
function togliVoce(i) {
    modificaVoci(v => { v.splice(i, 1); return v; });
}
function spostaVoce(i, dir) {
    modificaVoci(v => {
        const j = i + dir;
        if (j < 0 || j >= v.length) return v;
        [v[i], v[j]] = [v[j], v[i]];
        return v;
    });
}
function cambiaEtichettaVoce(i, etichetta) {
    modificaVoci(v => { v[i] = { ...v[i], etichetta }; return v; });
}

async function eliminaScaletta(id) {
    const s = scaletteDB.find(x => x.id === id);
    if (!s || !confirm(`Eliminare il servizio "${s.titolo || 'Servizio'}" del ${dataLunga(s.data)}?`)) return;
    const { error } = await supabaseClient.from('scalette').delete().eq('id', id);
    if (error) { alert('Eliminazione non riuscita: ' + error.message); return; }
    scaletteDB = scaletteDB.filter(x => x.id !== id);
    try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (e) { /* spazio pieno */ }
    scalettaApertaId = null;
    renderScalette();
    renderDashScaletta();
    showVerseToast('Servizio eliminato');
}

// ---------- finestra nuova / modifica ----------
function openScalettaModal(id) {
    scalettaModificaId = id || null;
    const s = id ? scaletteDB.find(x => x.id === id) : null;
    document.getElementById('scalettaModalTitle').textContent = s ? 'Modifica servizio' : 'Nuovo servizio';
    document.getElementById('scalettaData').value = s ? s.data : oggiIso();
    document.getElementById('scalettaTitolo').value = s ? (s.titolo || '') : '';
    document.getElementById('scalettaModal').classList.remove('hidden');
}
function closeScalettaModal() {
    document.getElementById('scalettaModal').classList.add('hidden');
    scalettaCanticoInAttesa = null;
}
document.getElementById('scalettaModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'scalettaModal') closeScalettaModal();
});
document.getElementById('saveScalettaBtn')?.addEventListener('click', (e) => withBusyButton(e.currentTarget, async () => {
    const data = document.getElementById('scalettaData').value;
    const titolo = document.getElementById('scalettaTitolo').value.trim();
    if (!data) { alert('Scegli la data del servizio'); return; }
    if (scalettaModificaId) {
        const s = scaletteDB.find(x => x.id === scalettaModificaId);
        if (!s) return;
        s.data = data; s.titolo = titolo;
        if (!(await salvaScaletta(s))) return;
    } else {
        // creata dalla finestra "Aggiungi alla scaletta": il cantico entra subito come n. 1
        const attesa = scalettaCanticoInAttesa;
        const voci = attesa ? [{ cantico_id: attesa.canticoId, etichetta: attesa.etichetta }] : [];
        const nuova = { id: crypto.randomUUID(), data, titolo, voci, updated_at: new Date().toISOString() };
        const { error } = await supabaseClient.from('scalette').insert([nuova]);
        if (error) { alert('Creazione non riuscita: ' + error.message); return; }
        scaletteDB.push(nuova);
        renderDashScaletta();
        try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (err) { /* spazio pieno */ }
        if (attesa) {
            scalettaCanticoInAttesa = null;
            closeScalettaModal();
            showVerseToast(`Aggiunto a "${nuova.titolo || 'Servizio'}" come n. 1`);
            if (currentTab === 'scalette') renderScalette();
            return;
        }
        scalettaApertaId = nuova.id;
    }
    closeScalettaModal();
    renderScalette();
}));

// ---------- dal cantico: "Aggiungi alla scaletta" ----------
let scalettaCanticoInAttesa = null;
let aggiungiCanticoId = null;

function openAggiungiAScaletta(canticoId) {
    if (!isAdmin) return;
    aggiungiCanticoId = canticoId;
    document.querySelectorAll('.mobile-menu-dropdown').forEach(d => d.classList.add('hidden'));
    document.getElementById('addToScalettaHymn').textContent = titoloCantico(canticoId);
    const sel = document.getElementById('addToScalettaEtichetta');
    sel.innerHTML = SCALETTA_ETICHETTE.map(e => `<option value="${e.id}" ${e.id === scalettaEtichettaScelta ? 'selected' : ''}>${e.nome}</option>`).join('');

    const oggi = oggiIso();
    const prossime = scaletteDB.filter(s => s.data >= oggi).sort((a, b) => a.data.localeCompare(b.data));
    const passate = scaletteDB.filter(s => s.data < oggi).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);
    const riga = s => {
        const n = (s.voci || []).length;
        const gia = (s.voci || []).some(v => String(v.cantico_id) === String(canticoId));
        return `
        <button type="button" class="add-to-scaletta-item" onclick="aggiungiAScaletta('${escapeHtml(s.id)}')">
            ${tesseraData(s.data)}
            <span class="scaletta-card-main">
                <span class="scaletta-card-title">${escapeHtml(s.titolo || 'Servizio')}</span>
                <span class="scaletta-card-sub">${gia ? '<i class="ri-check-line"></i> già presente · ' : ''}sarà il n. ${n + 1}</span>
            </span>
            <i class="ri-add-circle-line"></i>
        </button>`;
    };
    document.getElementById('addToScalettaList').innerHTML =
        (prossime.length ? prossime.map(riga).join('') : '<p class="add-to-scaletta-none">Nessun servizio in programma: creane uno nuovo.</p>') +
        (passate.length ? `<div class="scalette-group-title">Passati</div>${passate.map(riga).join('')}` : '');
    document.getElementById('addToScalettaModal').classList.remove('hidden');
}
function closeAddToScaletta() {
    document.getElementById('addToScalettaModal').classList.add('hidden');
}
async function aggiungiAScaletta(scalettaId) {
    const s = scaletteDB.find(x => x.id === scalettaId);
    if (!s || !aggiungiCanticoId) return;
    const etichetta = document.getElementById('addToScalettaEtichetta').value;
    scalettaEtichettaScelta = etichetta;
    if ((s.voci || []).some(v => String(v.cantico_id) === String(aggiungiCanticoId)) &&
        !confirm('Questo cantico è già in questo servizio. Aggiungerlo di nuovo?')) return;
    s.voci = [...(s.voci || []), { cantico_id: aggiungiCanticoId, etichetta }];
    closeAddToScaletta();
    if (await salvaScaletta(s)) {
        showVerseToast(`Aggiunto a "${s.titolo || 'Servizio'}" come n. ${s.voci.length}`);
        if (currentTab === 'scalette') renderScalette();
    }
}
document.getElementById('addToScalettaNew')?.addEventListener('click', () => {
    scalettaCanticoInAttesa = { canticoId: aggiungiCanticoId, etichetta: document.getElementById('addToScalettaEtichetta').value };
    scalettaEtichettaScelta = scalettaCanticoInAttesa.etichetta;
    closeAddToScaletta();
    openScalettaModal();
});
document.getElementById('addToScalettaModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'addToScalettaModal') closeAddToScaletta();
});
document.getElementById('addHymnToScalettaBtn')?.addEventListener('click', () => {
    if (window.currentHymnId) openAggiungiAScaletta(window.currentHymnId);
});

// ---------- condivisione ----------
// Testo con data, titolo e cantici numerati; il link apre direttamente questa scaletta nell'app
async function condividiScaletta(id) {
    const s = scaletteDB.find(x => x.id === id);
    if (!s) return;
    const voci = s.voci || [];
    const righe = voci.map((v, i) => {
        const t = partiTitolo(titoloCantico(v.cantico_id));
        return `${i + 1}. ${t.nome}${t.numero ? ` (n. ${t.numero})` : ''} — ${etichettaInfo(v.etichetta).nome}`;
    });
    const titolo = s.titolo ? `Servizio: ${s.titolo}` : 'Servizio';
    const testo = `${dataLunga(s.data)}\n\n${righe.length ? righe.join('\n') : 'Nessun cantico ancora.'}`;
    await shareContent(titolo, testo, `${APP_PUBLIC_URL}?scaletta=${encodeURIComponent(s.id)}`);
}

// Apertura dal link condiviso (?scaletta=ID): si ricorda anche dopo l'accesso con Google
(function scalettaDaLink() {
    const id = new URLSearchParams(location.search).get('scaletta');
    if (!id) return;
    try { sessionStorage.setItem('scalettaDaAprire', id); } catch (e) { /* ignora */ }
    history.replaceState(null, '', location.pathname);
})();
function apriScalettaDaLink() {
    let id = null;
    try { id = sessionStorage.getItem('scalettaDaAprire'); } catch (e) { return; }
    if (!id || !scaletteDB.some(s => s.id === id)) return;
    try { sessionStorage.removeItem('scalettaDaAprire'); } catch (e) { /* ignora */ }
    vaiAScaletta(id);
}

// Porta alla sezione Cantici, scheda Scaletta (e apre la scaletta indicata)
function vaiAScaletta(id) {
    document.querySelector('.nav-item[data-target="cantici"]')?.click();
    if (typeof closeHymnView === 'function' && !document.getElementById('hymnReaderView').classList.contains('hidden')) closeHymnView();
    scalettaApertaId = id || null;
    document.querySelector('#hymnsListView .favorites-tab[data-tab="scalette"]')?.click();
    if (id) apriScaletta(id);
}

// ---------- home: richiamo alla prossima scaletta ----------
function renderDashScaletta() {
    const box = document.getElementById('dashScaletta');
    if (!box) return;
    const oggi = oggiIso();
    const prossima = scaletteDB.filter(s => s.data >= oggi).sort((a, b) => a.data.localeCompare(b.data))[0];
    if (!prossima) {
        box.innerHTML = `
        <div class="dash-scaletta is-empty">
            <span class="dash-scaletta-icon"><i class="ri-list-ordered"></i></span>
            <span class="dash-scaletta-main">
                <span class="dash-scaletta-label">Servizi</span>
                <span class="dash-scaletta-title">Nessun servizio in programma</span>
            </span>
            ${isAdmin
                ? '<button type="button" class="btn-text" onclick="vaiAScaletta(); openScalettaModal()"><i class="ri-add-line"></i> Crea</button>'
                : (scaletteDB.length ? '<button type="button" class="btn-text" onclick="vaiAScaletta()">Vedi tutte <i class="ri-arrow-right-s-line"></i></button>' : '')}
        </div>`;
        return;
    }
    const voci = prossima.voci || [];
    const anteprima = voci.slice(0, 3).map((v, i) => `${i + 1}. ${partiTitolo(titoloCantico(v.cantico_id)).nome}`).join(' · ');
    const giorni = Math.round((dataLocale(prossima.data) - dataLocale(oggi)) / 864e5);
    const quando = giorni === 0 ? 'Oggi' : giorni === 1 ? 'Domani' : dataLocale(prossima.data).toLocaleDateString('it-IT', { weekday: 'long' });
    box.innerHTML = `
        <button type="button" class="dash-scaletta" onclick="vaiAScaletta('${escapeHtml(prossima.id)}')">
            ${tesseraData(prossima.data)}
            <span class="dash-scaletta-main">
                <span class="dash-scaletta-label">Prossimo servizio · ${escapeHtml(quando)}</span>
                <span class="dash-scaletta-title">${escapeHtml(prossima.titolo || 'Servizio')} <small>${voci.length} ${voci.length === 1 ? 'cantico' : 'cantici'}</small></span>
                <span class="dash-scaletta-songs">${voci.length ? escapeHtml(anteprima) + (voci.length > 3 ? ' …' : '') : 'Cantici non ancora scelti'}</span>
            </span>
            <i class="ri-arrow-right-s-line dash-scaletta-go"></i>
        </button>`;
}
