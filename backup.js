// =====================================================================
// COPIA DI SICUREZZA (solo il proprietario)
// Scarica: un file con cantici, avvisi, servizi, membri, amministratori
//          e i propri appunti.
// Ripristina: rimette cantici, avvisi e servizi del file (aggiunge quelli
//          mancanti e riporta quelli esistenti com'erano). Non cancella niente.
//          Membri e amministratori si gestiscono dalle loro sezioni.
// =====================================================================

async function tuttiIRecord(tabella) {
    // a pagine da 1000 (limite di Supabase per richiesta)
    const out = [];
    for (let da = 0; ; da += 1000) {
        const q = supabaseClient.from(tabella).select('*');
        const { data, error } = typeof q.range === 'function' ? await q.range(da, da + 999) : await q;
        if (error) throw new Error(`${tabella}: ${error.message}`);
        out.push(...(data || []));
        if (!data || data.length < 1000 || typeof q.range !== 'function') break;
    }
    return out;
}

async function scaricaCopiaSicurezza(btn) {
    await withBusyButton(btn, async () => {
        try {
            const [cantici, avvisi, scalette] = await Promise.all([tuttiIRecord('cantici'), tuttiIRecord('avvisi'), tuttiIRecord('scalette')]);
            const [{ data: amministratori }, { data: membri }] = await Promise.all([
                supabaseClient.rpc('list_admins'),
                supabaseClient.rpc('list_membri')
            ]);
            const { data: appunti } = await supabaseClient.from('appunti').select('*').eq('user_id', currentUser.id);
            const copia = {
                app: 'Open Worship',
                formato: 1,
                creata_il: new Date().toISOString(),
                cantici, avvisi, scalette,
                amministratori: amministratori || [],
                membri: membri || [],
                appunti_del_proprietario: appunti || []
            };
            const oggi = new Date().toISOString().slice(0, 10);
            const blob = new Blob([JSON.stringify(copia, null, 1)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `open-worship-copia-${oggi}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            try { localStorage.setItem('owUltimaCopia', new Date().toISOString()); } catch (e) { /* ignora */ }
            aggiornaInfoCopia();
            showVerseToast(`Copia scaricata: ${cantici.length} cantici, ${avvisi.length} avvisi, ${scalette.length} servizi`);
        } catch (e) {
            alert('Copia non riuscita: ' + e.message);
        }
    });
}

async function ripristinaCopiaSicurezza(file) {
    let copia;
    try {
        copia = JSON.parse(await file.text());
    } catch (e) {
        alert('Il file non è una copia di Open Worship leggibile.');
        return;
    }
    if (!copia || copia.app !== 'Open Worship' || !Array.isArray(copia.cantici)) {
        alert('Il file non è una copia di sicurezza di Open Worship.');
        return;
    }
    const cantici = copia.cantici || [], avvisi = copia.avvisi || [], scalette = copia.scalette || [];
    const quando = copia.creata_il ? new Date(copia.creata_il).toLocaleString('it-IT') : 'data sconosciuta';
    if (!confirm(`Ripristinare la copia del ${quando}?\n\n${cantici.length} cantici, ${avvisi.length} avvisi, ${scalette.length} servizi.\n\nQuelli mancanti vengono aggiunti, quelli esistenti tornano come nella copia. Non viene cancellato niente.`)) return;

    const totale = cantici.length + avvisi.length + scalette.length;
    const av = apriAvanzamento({ titolo: 'Ripristino della copia', totale, fatto: 'ripristinati', icona: 'ri-history-line' });
    const gruppi = [
        ['cantici', cantici, 'Cantici'],
        // gli avvisi ripristinati non devono rimandare la notifica a tutti
        ['avvisi', avvisi.map(a => ({ ...a, notificato_il: a.notificato_il || new Date().toISOString() })), 'Avvisi'],
        ['scalette', scalette, 'Servizi']
    ];
    for (const [tabella, righe, nome] of gruppi) {
        for (let i = 0; i < righe.length && !av.fermato; i += 100) {
            const blocco = righe.slice(i, i + 100);
            av.corrente(`${nome}: ${i + 1}–${i + blocco.length} di ${righe.length}`);
            const { error } = await supabaseClient.from(tabella).upsert(blocco);
            if (error) av.errore(`${nome} ${i + 1}–${i + blocco.length}`, error.message, blocco.length);
            else av.riuscito(blocco.length);
        }
        if (av.fermato) break;
    }
    if (typeof loadCloudData === 'function') await loadCloudData();
    const r = av.risultato;
    av.fine(av.fermato ? `Interrotto: ripristinati ${r.ok} elementi.`
        : r.err ? `Fatto: ripristinati ${r.ok} elementi, ${r.err} con errori.` : `Fatto: ripristinati tutti i ${r.ok} elementi.`);
}

function aggiornaInfoCopia() {
    const el = document.getElementById('backupInfo');
    if (!el) return;
    let ultima = null;
    try { ultima = localStorage.getItem('owUltimaCopia'); } catch (e) { /* ignora */ }
    el.textContent = ultima
        ? `Ultima copia scaricata da questo dispositivo: ${new Date(ultima).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Non hai ancora scaricato una copia da questo dispositivo. Conviene farlo ogni tanto, per esempio una volta al mese.';
}

(function setupCopiaSicurezza() {
    const scarica = document.getElementById('backupDownloadBtn');
    if (!scarica) return;
    scarica.onclick = (e) => scaricaCopiaSicurezza(e.currentTarget);
    document.getElementById('backupRestoreBtn').onclick = () => document.getElementById('backupFile').click();
    document.getElementById('backupFile').onchange = (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) ripristinaCopiaSicurezza(f);
    };
    aggiornaInfoCopia();
})();
