// =====================================================================
// TASTO E GESTO "INDIETRO" (telefono e tablet)
// Ogni cosa aperta (finestra, cantico, servizio, sezione) è un "livello".
// Il tasto Indietro di Android, il gesto dal bordo e il pulsante indietro
// del browser chiudono il livello più in alto invece di uscire dall'app:
//   finestra → lettore del cantico → servizio → sezione → Home → esce.
// Su iPhone (app installata non c'è il gesto di sistema) si scorre dal
// bordo sinistro verso destra.
// La cronologia del browser resta allineata: un livello aperto = una voce.
// =====================================================================

(function tastoIndietro() {
    const sezioneAttiva = () => document.querySelector('.content-section.active')?.id || 'dashboard';
    const visibile = el => !!el && !el.classList.contains('hidden') && !el.hidden;

    function modaliAperte() {
        return [...document.querySelectorAll('.modal')]
            .filter(m => !m.classList.contains('hidden') && !m.classList.contains('progress-modal') && m.isConnected);
    }

    function contaLivelli() {
        if (!document.getElementById('mainApp') || document.getElementById('mainApp').classList.contains('hidden')) return 0;
        let n = 0;
        if (sezioneAttiva() !== 'dashboard') n++;
        if (visibile(document.getElementById('hymnReaderView'))) n++;
        if (typeof scalettaApertaId !== 'undefined' && scalettaApertaId && typeof currentTab !== 'undefined' && currentTab === 'scalette' && sezioneAttiva() === 'cantici') n++;
        n += modaliAperte().length;
        if (document.getElementById('chordEditor')) n++;
        if (document.getElementById('xrefPopover')) n++;
        if (visibile(document.getElementById('presentationOverlay'))) n++;
        if (visibile(document.getElementById('readerToolbar'))) n++;
        if (visibile(document.getElementById('bibleSettingsMenu'))) n++;
        if (document.body.classList.contains('verse-selecting')) n++;
        return n;
    }

    // Chiude la cosa più in alto; true se ha chiuso qualcosa
    function chiudiLivelloSuperiore() {
        if (document.getElementById('xrefPopover')) { chiudiRiferimenti(); return true; }
        if (document.getElementById('chordEditor')) { ChordEditor.close(false); return true; }
        const modali = modaliAperte();
        if (modali.length) {
            const m = modali[modali.length - 1];
            const chiusure = {
                accountModal: () => closeAccountModal(),
                scalettaModal: () => closeScalettaModal(),
                addToScalettaModal: () => closeAddToScaletta(),
                avvisoModal: () => closeAvvisoModal(),
                avvisoDetailModal: () => closeAvvisoDetailModal(),
                noteModal: () => closeNoteModal(),
                noteViewModal: () => closeNoteViewModal(),
                editModal: () => closeEditModal()
            };
            if (chiusure[m.id]) { chiusure[m.id](); return true; }
            // finestre create al volo: si usa il loro pulsante Annulla/Chiudi
            const btn = m.querySelector('#cancelProjectBtn, [data-close], .modal-close, .proj-cancel') ||
                [...m.querySelectorAll('button')].find(b => /^(annulla|chiudi)$/i.test(b.textContent.trim()));
            if (btn) btn.click(); else m.remove();
            return true;
        }
        if (visibile(document.getElementById('presentationOverlay'))) { closeProjection(); return true; }
        if (visibile(document.getElementById('readerToolbar'))) { setToolsMenu(false); return true; }
        const bibleMenu = document.getElementById('bibleSettingsMenu');
        if (visibile(bibleMenu)) { bibleMenu.classList.add('hidden'); document.getElementById('bibleSettingsBtn')?.classList.remove('is-on'); return true; }
        if (document.body.classList.contains('verse-selecting')) { clearVerseSelection(); return true; }
        if (visibile(document.getElementById('hymnReaderView'))) { closeHymnView(); return true; }
        if (typeof scalettaApertaId !== 'undefined' && scalettaApertaId && currentTab === 'scalette') { chiudiScaletta(); return true; }
        if (sezioneAttiva() !== 'dashboard') {
            document.querySelector('.nav-item[data-target="dashboard"]')?.click();
            return true;
        }
        return false;
    }

    // ---------- cronologia allineata ai livelli aperti ----------
    let livelliNoti = 0;
    let popDaIgnorare = 0;
    let attesa = null;
    function sincronizza() {
        const n = contaLivelli();
        while (n > livelliNoti) {
            history.pushState({ ow: true }, '');
            livelliNoti++;
        }
        if (n < livelliNoti) {
            // chiuso con un pulsante dell'app: si tolgono le voci in più senza effetti
            const diff = livelliNoti - n;
            livelliNoti = n;
            popDaIgnorare += diff;
            history.go(-diff);
        }
    }
    function programma() {
        clearTimeout(attesa);
        attesa = setTimeout(sincronizza, 60);
    }

    window.addEventListener('popstate', () => {
        if (popDaIgnorare > 0) { popDaIgnorare--; return; }
        // l'utente ha premuto Indietro: la voce è già stata tolta dal browser
        livelliNoti = Math.max(0, livelliNoti - 1);
        chiudiLivelloSuperiore();
        programma(); // se la chiusura è stata annullata (es. accordi non salvati) la voce torna
    });

    // Qualsiasi apertura o chiusura cambia classi o elementi della pagina
    new MutationObserver(programma).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'hidden']
    });

    // ---------- iPhone e iPad: scorrere dal bordo sinistro = Indietro ----------
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) {
        let start = null;
        document.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            start = e.touches.length === 1 && t.clientX < 24 && livelliNoti > 0 ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!start) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - start.x, dy = Math.abs(t.clientY - start.y);
            if (dx > 70 && dy < 60 && Date.now() - start.at < 800) history.back();
            start = null;
        }, { passive: true });
    }

    // utile per le prove
    window.__indietro = { contaLivelli, chiudiLivelloSuperiore, get livelli() { return livelliNoti; } };
})();
