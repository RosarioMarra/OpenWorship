// =====================================================================
// RIFERIMENTI INCROCIATI DELLA BIBBIA
// Dati: OpenBible.info "Cross References" (licenza CC BY), preparati in
// riferimenti/<libro>.json: per ogni versetto ("capitolo.versetto") fino a
// 5 riferimenti, i più votati. Formato: "45.5.8", "62.4.9-10", "43.3.16-4.2".
// Dopo ogni versetto che ne ha compare un piccolo segno ↗: toccandolo si
// vedono i riferimenti e si può andare al passo (con "Torna a…").
// =====================================================================

const ABBR_LIBRI = ['Gn', 'Es', 'Lv', 'Nm', 'Dt', 'Gs', 'Gdc', 'Rt', '1 Sam', '2 Sam', '1 Re', '2 Re', '1 Cr', '2 Cr', 'Esd', 'Ne', 'Est', 'Gb', 'Sal', 'Pr', 'Ec', 'Ct', 'Is', 'Ger', 'La', 'Ez', 'Da', 'Os', 'Gle', 'Am', 'Abd', 'Gna', 'Mi', 'Na', 'Ab', 'Sof', 'Ag', 'Za', 'Mal', 'Mt', 'Mr', 'Lu', 'Gv', 'At', 'Ro', '1 Co', '2 Co', 'Ga', 'Ef', 'Fl', 'Cl', '1 Te', '2 Te', '1 Ti', '2 Ti', 'Tt', 'Fm', 'Eb', 'Gc', '1 Pi', '2 Pi', '1 Gv', '2 Gv', '3 Gv', 'Gd', 'Ap'];
const riferimentiCache = new Map();
let rifProvenienza = null;      // da dove si è partiti per tornare indietro
let rifInArrivo = false;        // il capitolo che si sta aprendo arriva da un riferimento

async function caricaRiferimentiLibro(bookId) {
    if (riferimentiCache.has(bookId)) return riferimentiCache.get(bookId);
    try {
        const r = await fetch(`riferimenti/${bookId}.json`);
        const data = r.ok ? await r.json() : {};
        riferimentiCache.set(bookId, data);
        return data;
    } catch (e) { return {}; }
}

function leggiCodiceRif(code) {
    const [inizio, fine] = code.split('-');
    const [b, c, v] = inizio.split('.').map(Number);
    let etichetta = `${ABBR_LIBRI[b - 1] || '?'} ${c}:${v}`;
    if (fine) etichetta += fine.includes('.') ? `–${fine.replace('.', ':')}` : `-${fine}`;
    return { b, c, v, etichetta };
}

// Chiamata dopo aver disegnato un capitolo
async function aggiungiRiferimenti(reader, bookId, chapter) {
    const arrivo = rifInArrivo;
    rifInArrivo = false;
    if (arrivo && rifProvenienza) {
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'xref-back';
        back.innerHTML = `<i class="ri-arrow-left-line"></i> Torna a ${escapeHtml(rifProvenienza.etichetta)}`;
        back.onclick = () => {
            const p = rifProvenienza;
            rifProvenienza = null;
            apriPassoBibbia(p.b, p.c, p.v);
        };
        reader.prepend(back);
    } else if (!arrivo) {
        rifProvenienza = null;
    }

    const data = await caricaRiferimentiLibro(String(bookId));
    if (!reader.isConnected) return;
    let quanti = 0;
    reader.querySelectorAll('.bible-verse').forEach(el => {
        const refs = data[`${chapter}.${el.dataset.verse}`];
        if (!refs || !refs.length || el.querySelector('.xref-mark')) return;
        const mark = document.createElement('button');
        mark.type = 'button';
        mark.className = 'xref-mark';
        mark.dataset.refs = refs.join(',');
        mark.title = 'Riferimenti: ' + refs.map(r => leggiCodiceRif(r).etichetta).join(', ');
        mark.setAttribute('aria-label', mark.title);
        mark.innerHTML = '<i class="ri-arrow-right-up-line"></i>';
        el.appendChild(mark);
        quanti++;
    });
    if (quanti && !reader.querySelector('.xref-credit')) {
        const credit = document.createElement('p');
        credit.className = 'xref-credit';
        credit.innerHTML = 'Riferimenti incrociati: <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noopener">OpenBible.info</a> (CC BY)';
        reader.appendChild(credit);
    }
}

// Va a un passo: imposta libro, capitolo e versetto e lo apre (con evidenziazione)
function apriPassoBibbia(b, c, v) {
    bookSelect.value = String(b);
    bookSelect.dispatchEvent(new Event('change'));
    chapterSelect.value = String(c);
    chapterSelect.dispatchEvent(new Event('change'));
    verseSelect.value = String(v);
    document.getElementById('fetchBibleBtn').click();
}

// Finestrella con i riferimenti di un versetto
function chiudiRiferimenti() {
    document.getElementById('xrefPopover')?.remove();
}
function mostraRiferimenti(mark) {
    chiudiRiferimenti();
    const verseEl = mark.closest('.bible-verse');
    const da = `${verseEl.dataset.bookname} ${verseEl.dataset.chapter}:${verseEl.dataset.verse}`;
    const pop = document.createElement('div');
    pop.id = 'xrefPopover';
    pop.className = 'xref-popover';
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = `
        <div class="xref-pop-head"><span>Riferimenti · ${escapeHtml(da)}</span><button type="button" class="xref-pop-close" title="Chiudi"><i class="ri-close-line"></i></button></div>
        <div class="xref-pop-list">${mark.dataset.refs.split(',').map(code => {
            const r = leggiCodiceRif(code);
            return `<button type="button" class="xref-go" data-b="${r.b}" data-c="${r.c}" data-v="${r.v}">${escapeHtml(r.etichetta)}</button>`;
        }).join('')}</div>`;
    document.body.appendChild(pop);
    // posizione: sotto il segno, dentro lo schermo (sul telefono in basso a tutta larghezza)
    if (window.innerWidth > 768) {
        const r = mark.getBoundingClientRect();
        const w = pop.offsetWidth;
        pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left - w / 2)) + 'px';
        const sotto = r.bottom + 8;
        pop.style.top = (sotto + pop.offsetHeight > window.innerHeight - 12 ? r.top - pop.offsetHeight - 8 : sotto) + 'px';
    }
    pop.querySelector('.xref-pop-close').onclick = chiudiRiferimenti;
    pop.querySelectorAll('.xref-go').forEach(btn => {
        btn.onclick = () => {
            rifProvenienza = { b: verseEl.dataset.book, c: verseEl.dataset.chapter, v: verseEl.dataset.verse, etichetta: da };
            rifInArrivo = true;
            chiudiRiferimenti();
            apriPassoBibbia(btn.dataset.b, btn.dataset.c, btn.dataset.v);
        };
    });
}

// Il tocco sul segno non seleziona il versetto
document.addEventListener('click', (e) => {
    const mark = e.target.closest('.xref-mark');
    if (mark) {
        e.stopPropagation();
        e.preventDefault();
        mostraRiferimenti(mark);
        return;
    }
    if (!e.target.closest('#xrefPopover')) chiudiRiferimenti();
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiRiferimenti(); });
document.querySelector('.main-content')?.addEventListener('scroll', chiudiRiferimenti, { passive: true });
