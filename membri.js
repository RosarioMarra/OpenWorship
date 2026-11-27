// =====================================================================
// MEMBRI: richieste di accesso e membri approvati (solo amministratori)
// I controlli veri sono nel database (supabase-membri.sql): qui si mostra
// l'elenco e si chiamano le funzioni list_membri / decidi_membro.
// =====================================================================

let membriDB = [];
let membriRichiesteNotificate = false;

function inizialeMembro(m) {
    return escapeHtml(String(m.nome || m.email || '?').trim().charAt(0).toUpperCase());
}
function dataBreve(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function caricaMembri() {
    const { data, error } = await supabaseClient.rpc('list_membri');
    if (error) return { error };
    membriDB = data || [];
    aggiornaPallinoMembri();
    return { data: membriDB };
}

// Pallino rosso su Account quando ci sono richieste in attesa
function aggiornaPallinoMembri() {
    const n = membriDB.filter(m => m.stato === 'in_attesa').length;
    document.body.classList.toggle('membri-in-attesa', isAdmin && n > 0);
    document.querySelectorAll('.members-count').forEach(el => { el.textContent = n ? String(n) : ''; });
    return n;
}

// All'ingresso di un amministratore: pallino e avviso se ci sono richieste nuove
async function aggiornaRichiesteMembri() {
    if (!isAdmin) return;
    const { error } = await caricaMembri();
    if (error) return;
    const n = aggiornaPallinoMembri();
    if (n && !membriRichiesteNotificate && typeof showVerseToast === 'function') {
        membriRichiesteNotificate = true;
        showVerseToast(n === 1 ? '1 nuova richiesta di accesso' : `${n} nuove richieste di accesso`);
    }
}

async function loadMembri() {
    const box = document.getElementById('membersPanelBody');
    if (!box || !isAdmin) return;
    box.innerHTML = '<p class="admins-empty">Caricamento…</p>';
    const { error } = await caricaMembri();
    if (error) {
        box.innerHTML = '<p class="admins-empty">Elenco non disponibile: esegui supabase-membri.sql su Supabase.</p>';
        return;
    }
    renderMembri();
}

function rigaMembro(m) {
    const avatar = m.avatar
        ? `<img src="${escapeHtml(m.avatar)}" alt="" referrerpolicy="no-referrer">`
        : `<span>${inizialeMembro(m)}</span>`;
    const id = escapeHtml(m.user_id);
    let azioni = '';
    if (m.amministratore) azioni = '<b class="admins-badge">Amministratore</b>';
    else if (m.stato === 'in_attesa') azioni = `
        <button type="button" class="member-btn is-ok" data-decidi="approvato" data-membro="${id}"><i class="ri-check-line"></i> Approva</button>
        <button type="button" class="member-btn is-no" data-decidi="rifiutato" data-membro="${id}" title="Rifiuta"><i class="ri-close-line"></i></button>`;
    else if (m.stato === 'approvato') azioni = `
        <button type="button" class="member-btn is-no" data-decidi="rifiutato" data-membro="${id}" title="Togli l'accesso"><i class="ri-user-unfollow-line"></i></button>`;
    else azioni = `
        <button type="button" class="member-btn is-ok" data-decidi="approvato" data-membro="${id}"><i class="ri-check-line"></i> Approva</button>`;
    const quando = m.stato === 'in_attesa' ? `richiesta del ${dataBreve(m.richiesto_il)}` : '';
    return `
        <li class="member-item" data-cerca="${escapeHtml((m.nome + ' ' + m.email).toLowerCase())}">
            <span class="member-avatar">${avatar}</span>
            <span class="member-info">
                <span class="member-name">${escapeHtml(m.nome || m.email)}</span>
                <span class="member-email">${escapeHtml(m.nome ? m.email : '')}${m.nome && quando ? ' · ' : ''}${quando}</span>
            </span>
            <span class="member-actions">${azioni}</span>
        </li>`;
}

function renderMembri() {
    const box = document.getElementById('membersPanelBody');
    if (!box) return;
    const attesa = membriDB.filter(m => m.stato === 'in_attesa');
    const approvati = membriDB.filter(m => m.stato === 'approvato');
    const rifiutati = membriDB.filter(m => m.stato === 'rifiutato');
    box.innerHTML = `
        ${attesa.length ? `
            <div class="members-group-title is-pending">Richieste in attesa (${attesa.length})</div>
            <ul class="members-list">${attesa.map(rigaMembro).join('')}</ul>`
            : '<p class="members-none"><i class="ri-checkbox-circle-line"></i> Nessuna richiesta in attesa</p>'}
        <details class="members-details">
            <summary>Membri approvati (${approvati.length})</summary>
            ${approvati.length > 6 ? '<input type="search" class="apple-select field members-search" placeholder="Cerca per nome o email" autocomplete="off">' : ''}
            <ul class="members-list">${approvati.map(rigaMembro).join('')}</ul>
        </details>
        ${rifiutati.length ? `
        <details class="members-details">
            <summary>Rifiutati (${rifiutati.length})</summary>
            <ul class="members-list">${rifiutati.map(rigaMembro).join('')}</ul>
        </details>` : ''}`;
    box.querySelector('.members-search')?.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        e.target.closest('details').querySelectorAll('.member-item').forEach(li => {
            li.hidden = q && !li.dataset.cerca.includes(q);
        });
    });
    aggiornaPallinoMembri();
}

document.getElementById('membersPanelBody')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-decidi]');
    if (!btn) return;
    const m = membriDB.find(x => String(x.user_id) === btn.dataset.membro);
    if (!m) return;
    const stato = btn.dataset.decidi;
    const chi = m.nome || m.email;
    if (stato === 'rifiutato' && m.stato === 'approvato' &&
        !confirm(`Togliere l'accesso a ${chi}? Non potrà più usare l'app finché non lo riapprovi.`)) return;
    await withBusyButton(btn, async () => {
        const { error } = await supabaseClient.rpc('decidi_membro', { membro: m.user_id, nuovo_stato: stato });
        if (error) { alert(error.message || 'Operazione non riuscita'); return; }
        m.stato = stato;
        renderMembri();
        showVerseToast(stato === 'approvato' ? `${chi} può entrare` : (m.stato === 'rifiutato' ? `Accesso negato a ${chi}` : 'Fatto'));
    });
});
