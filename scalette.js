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
    const card = s => {
        const d = dataLocale(s.data);
        const n = (s.voci || []).length;
        return `
        <button type="button" class="scaletta-card" onclick="apriScaletta('${escapeHtml(s.id)}')">
            <span class="scaletta-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString('it-IT', { month: 'short' })}</small></span>
            <span class="scaletta-card-main">
                <span class="scaletta-card-title">${escapeHtml(s.titolo || 'Servizio')}</span>
                <span class="scaletta-card-sub">${escapeHtml(dataLunga(s.data))} · ${n} ${n === 1 ? 'cantico' : 'cantici'}</span>
            </span>
            <i class="ri-arrow-right-s-line"></i>
        </button>`;
    };
    list.innerHTML = `
        <div class="scalette-head">
            <p>Le scalette dei cantici per ogni servizio.</p>
            ${isAdmin ? '<button type="button" class="btn-apple" onclick="openScalettaModal()"><i class="ri-add-line"></i> Nuova scaletta</button>' : ''}
        </div>
        ${!scaletteDB.length ? '<p class="empty-state"><i class="ri-list-ordered"></i>Nessuna scaletta</p>' : ''}
        ${prossime.length ? `<div class="scalette-group-title">Prossime</div>${prossime.map(card).join('')}` : ''}
        ${passate.length ? `<div class="scalette-group-title">Passate</div>${passate.map(card).join('')}` : ''}`;
}

function renderScalettaDettaglio(list, s) {
    const voci = s.voci || [];
    const righe = voci.map((v, i) => {
        const et = etichettaInfo(v.etichetta);
        const id = escapeHtml(v.cantico_id);
        return `
        <li class="scaletta-voce">
            <span class="scaletta-num">${i + 1}</span>
            <div class="scaletta-voce-main" onclick="openHymnView('${id}')">
                <span class="scaletta-tag ${et.tono}">${et.nome}</span>
                <span class="scaletta-voce-title">${escapeHtml(titoloCantico(v.cantico_id))}</span>
            </div>
            ${isAdmin ? `
            <div class="scaletta-voce-actions">
                <select class="apple-select scaletta-tag-select" title="Etichetta" onchange="cambiaEtichettaVoce(${i}, this.value)">
                    ${SCALETTA_ETICHETTE.map(e => `<option value="${e.id}" ${e.id === et.id ? 'selected' : ''}>${e.nome}</option>`).join('')}
                </select>
                <button type="button" class="icon-btn" title="Sposta su" ${i === 0 ? 'disabled' : ''} onclick="spostaVoce(${i}, -1)"><i class="ri-arrow-up-line"></i></button>
                <button type="button" class="icon-btn" title="Sposta giù" ${i === voci.length - 1 ? 'disabled' : ''} onclick="spostaVoce(${i}, 1)"><i class="ri-arrow-down-line"></i></button>
                <button type="button" class="icon-btn icon-danger" title="Togli dalla scaletta" onclick="togliVoce(${i})"><i class="ri-close-line"></i></button>
            </div>` : ''}
        </li>`;
    }).join('');

    list.innerHTML = `
        <div class="scaletta-detail">
            <button type="button" class="btn-text back-btn" onclick="chiudiScaletta()"><i class="ri-arrow-left-s-line"></i><span>Tutte le scalette</span></button>
            <div class="scaletta-detail-head">
                <div>
                    <h2>${escapeHtml(s.titolo || 'Servizio')}</h2>
                    <p>${escapeHtml(dataLunga(s.data))}</p>
                </div>
                ${isAdmin ? `
                <div class="scaletta-detail-actions">
                    <button type="button" class="icon-btn" title="Modifica data e titolo" onclick="openScalettaModal('${escapeHtml(s.id)}')"><i class="ri-pencil-line"></i></button>
                    <button type="button" class="icon-btn icon-danger" title="Elimina scaletta" onclick="eliminaScaletta('${escapeHtml(s.id)}')"><i class="ri-delete-bin-line"></i></button>
                </div>` : ''}
            </div>
            ${voci.length ? `<ol class="scaletta-voci">${righe}</ol>` : '<p class="empty-state"><i class="ri-music-2-line"></i>Nessun cantico in questa scaletta</p>'}
            ${isAdmin ? `
            <div class="scaletta-add">
                <div class="scaletta-add-title">Aggiungi un cantico <small>diventerà il n. ${voci.length + 1}</small></div>
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
    if (!s || !confirm(`Eliminare la scaletta "${s.titolo || 'Servizio'}" del ${dataLunga(s.data)}?`)) return;
    const { error } = await supabaseClient.from('scalette').delete().eq('id', id);
    if (error) { alert('Eliminazione non riuscita: ' + error.message); return; }
    scaletteDB = scaletteDB.filter(x => x.id !== id);
    try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (e) { /* spazio pieno */ }
    scalettaApertaId = null;
    renderScalette();
    showVerseToast('Scaletta eliminata');
}

// ---------- finestra nuova / modifica ----------
function openScalettaModal(id) {
    scalettaModificaId = id || null;
    const s = id ? scaletteDB.find(x => x.id === id) : null;
    document.getElementById('scalettaModalTitle').textContent = s ? 'Modifica scaletta' : 'Nuova scaletta';
    document.getElementById('scalettaData').value = s ? s.data : oggiIso();
    document.getElementById('scalettaTitolo').value = s ? (s.titolo || '') : '';
    document.getElementById('scalettaModal').classList.remove('hidden');
}
function closeScalettaModal() {
    document.getElementById('scalettaModal').classList.add('hidden');
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
        const nuova = { id: crypto.randomUUID(), data, titolo, voci: [], updated_at: new Date().toISOString() };
        const { error } = await supabaseClient.from('scalette').insert([nuova]);
        if (error) { alert('Creazione non riuscita: ' + error.message); return; }
        scaletteDB.push(nuova);
        try { localStorage.setItem('scaletteDB', JSON.stringify(scaletteDB)); } catch (err) { /* spazio pieno */ }
        scalettaApertaId = nuova.id;
    }
    closeScalettaModal();
    renderScalette();
}));
