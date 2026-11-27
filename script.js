// --- CONNESSIONE SUPABASE CLOUD ---
const supabaseUrl = 'https://tgwiazgovhecxquvzzhn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd2lhemdvdmhlY3hxdXZ6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTA2NjcsImV4cCI6MjA5MDU2NjY2N30.srb3N0_csi4qBFBFyVeUMWueIWWidwV7vVcOLg0LJs8';
// --- CARICAMENTO VISIBILE ---
// Ogni richiesta verso Supabase o la Bibbia online accende la barra di caricamento in alto
// (solo se l'attesa supera un attimo, per non farla lampeggiare).
const AppLoading = (() => {
    let pending = 0, timer = null;
    const bar = () => document.getElementById('loadingBar');
    const update = () => {
        clearTimeout(timer);
        if (pending > 0) timer = setTimeout(() => { bar() && bar().classList.add('active'); document.body.classList.add('is-loading'); }, 180);
        else { bar() && bar().classList.remove('active'); document.body.classList.remove('is-loading'); }
    };
    return {
        start() { pending++; update(); },
        stop() { pending = Math.max(0, pending - 1); update(); }
    };
})();
(function trackNetworkWaits() {
    const originalFetch = window.fetch.bind(window);
    const tracked = /supabase\.co|bolls\.life|getbible\.net/;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        // il canale in tempo reale e le richieste lunghe non accendono la barra
        if (!tracked.test(url) || /realtime/.test(url)) return originalFetch(input, init);
        AppLoading.start();
        return originalFetch(input, init).finally(() => AppLoading.stop());
    };
})();

// Pulsante con rotellina mentre l'operazione è in corso
async function withBusyButton(btn, task) {
    if (!btn) return task();
    if (btn.classList.contains('is-busy')) return;
    btn.classList.add('is-busy');
    btn.disabled = true;
    try { return await task(); }
    finally { btn.classList.remove('is-busy'); btn.disabled = false; }
}

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- DATABASE IN TEMPO REALE E LOCALE ---
let hymnsDB = [];
let notesDB = [];
let avvisiDB = [];
let highlightsDB = [];
let favoritesDB = [];
let isAdmin = false;
let currentTab = "all";
let searchTerm = "";
let lastHymnsSignature = "";
let currentUser = null;
let avvisiChannel = null;
let presentationWindow = null;

// Caricamento dati locali
try {
    highlightsDB = JSON.parse(localStorage.getItem('highlightsDB')) || [];
    favoritesDB = JSON.parse(localStorage.getItem('favoritesDB')) || [];
    const storedNotes = localStorage.getItem('notesDB');
    if (storedNotes) notesDB = JSON.parse(storedNotes);
    else notesDB = [];
} catch (e) {
    highlightsDB = [];
    favoritesDB = [];
    notesDB = [];
}

// Funzioni preferiti
function saveFavorites() {
    localStorage.setItem('favoritesDB', JSON.stringify(favoritesDB));
}

// I preferiti sono salvati anche online (tabella "preferiti"), così si ritrovano su ogni dispositivo
async function toggleFavorite(hymnId) {
    const index = favoritesDB.indexOf(hymnId);
    const adding = index === -1;
    if (adding) favoritesDB.push(hymnId);
    else favoritesDB.splice(index, 1);
    saveFavorites();
    renderHymns();
    if (typeof updateDashboard === 'function') updateDashboard();
    if (!currentUser) return;
    const { error } = adding
        ? await supabaseClient.from('preferiti').insert([{ user_id: currentUser.id, cantico_id: hymnId }])
        : await supabaseClient.from('preferiti').delete().eq('user_id', currentUser.id).eq('cantico_id', hymnId);
    // 23505 = era già tra i preferiti online
    if (error && error.code !== '23505') {
        console.error('Preferito non salvato online', error);
        if (typeof showVerseToast === 'function') showVerseToast('Preferito salvato solo su questo dispositivo');
    }
}

// Scarica i preferiti dell'utente. Al primo accesso con questa versione
// si caricano online anche quelli già salvati sul dispositivo.
async function syncFavorites() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient.from('preferiti').select('cantico_id').eq('user_id', currentUser.id);
    if (error || !data) { console.error('Errore download preferiti', error); return; }
    const cloud = data.map(r => String(r.cantico_id));
    let merged = cloud;
    const syncedKey = 'favoritesSynced_' + currentUser.id;
    if (!localStorage.getItem(syncedKey)) {
        const esistenti = new Set(hymnsDB.map(h => String(h.id)));
        const soloLocali = favoritesDB.map(String).filter(id => !cloud.includes(id) && esistenti.has(id));
        if (soloLocali.length) {
            const { error: upErr } = await supabaseClient.from('preferiti')
                .insert(soloLocali.map(id => ({ user_id: currentUser.id, cantico_id: id })));
            if (upErr && upErr.code !== '23505') { console.error('Caricamento preferiti non riuscito', upErr); return; }
        }
        merged = [...cloud, ...soloLocali];
        localStorage.setItem(syncedKey, '1');
    }
    const changed = JSON.stringify([...merged].sort()) !== JSON.stringify(favoritesDB.map(String).sort());
    favoritesDB = merged;
    saveFavorites();
    if (changed) {
        renderHymns();
        if (typeof updateDashboard === 'function') updateDashboard();
    }
}

function isFavorite(hymnId) {
    return favoritesDB.includes(hymnId);
}

// Salvataggio appunti su Supabase (per utente)
async function saveNotesToCloud() {
    if (!currentUser) return;
    for (const note of notesDB) {
        const { error } = await supabaseClient.from('appunti').upsert([{
            id: note.id,
            user_id: currentUser.id,
            title: note.title,
            speaker: note.speaker,
            category: note.category,
            refs: note.refs,
            body: note.body,
            updated_at: new Date()
        }]);
        if (error) console.error("Errore salvataggio appunto su cloud:", error);
    }
}

function saveNotes() {
    localStorage.setItem('notesDB', JSON.stringify(notesDB));
    saveNotesToCloud();
}

// --- FUNZIONE CONDIVISIONE SOCIAL ---
// Indirizzo pubblico dell'app: ogni condivisione porta questo link, che nelle chat
// mostra l'anteprima con logo, titolo e descrizione (vedi i tag og: in index.html)
const APP_PUBLIC_URL = 'https://rosariomarra.github.io/OpenWorship/';

async function shareContent(title, text, url) {
    const link = url || APP_PUBLIC_URL;
    const shareData = { title: title, text: text, url: link };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return true;
        } catch (err) {
            console.log('Condivisione annullata o fallita:', err);
            return false;
        }
    }
    // Senza condivisione di sistema: testo + link copiati negli appunti
    const fullText = `${title}\n\n${text}\n\n${link}`;
    const ok = typeof copyText === 'function' ? await copyText(fullText) : false;
    alert(ok ? 'Testo copiato: puoi incollarlo dove vuoi.' : 'Copia non riuscita.');
    return ok;
}

// --- LOGIN LOGIC CON SUPABASE ---
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');

// Accesso completato in un'altra finestra (finestra di Google, Chrome) mentre l'app
// installata è rimasta sulla schermata di accesso: appena l'app torna in primo piano,
// o quando Supabase segnala l'accesso, si entra senza ripetere il login.
let appShown = false;
function loginScreenVisible() {
    return mainApp.classList.contains('hidden');
}
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && loginScreenVisible() && !appShown) {
        currentUser = session.user;
        showApp();
    }
});
async function recheckSessionOnReturn() {
    if (!loginScreenVisible() || appShown) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && !appShown) {
        currentUser = session.user;
        showApp();
    }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') recheckSessionOnReturn(); });
window.addEventListener('focus', recheckSessionOnReturn);
window.addEventListener('pageshow', recheckSessionOnReturn);

async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        showApp();
    } else {
        loginScreen.style.opacity = '1';
    }
}
checkUser();

document.getElementById('googleLoginBtn').addEventListener('click', (e) => withBusyButton(e.currentTarget, async () => {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            // Sempre lo stesso indirizzo di ritorno (anche se l'app è aperta come .../index.html),
            // così Supabase lo riconosce tra quelli consentiti
            options: { redirectTo: window.location.origin + window.location.pathname.replace(/index\.html$/, '') }
        });
        if (error) alert("Errore durante il login: " + error.message);
    } catch (err) {
        alert("Errore di connessione a Google.");
    }
}));

// --- ACCESSO SU APPROVAZIONE ---
// Il database decide (funzione stato_accesso, vedi supabase-membri.sql): al primo ingresso
// registra la richiesta e risponde "in_attesa", "approvato" o "rifiutato".
async function statoAccesso() {
    try {
        const { data, error } = await supabaseClient.rpc('stato_accesso');
        if (!error && typeof data === 'string') return data;
        // funzione non ancora creata: l'app funziona come prima (i permessi veri sono nel database)
        if (error && (error.code === 'PGRST202' || error.code === '42883')) return 'approvato';
        console.warn('Stato accesso non disponibile', error);
    } catch (e) { /* senza rete: si prova con i dati salvati */ }
    return 'approvato';
}
let accessRecheckTimer = null;
function mostraAttesaAccesso(user, stato) {
    const meta = user.user_metadata || {};
    const rifiutato = stato === 'rifiutato';
    document.getElementById('loginScreen').querySelector('.login-card:not(.access-card)').classList.add('hidden');
    document.getElementById('accessPendingCard').classList.remove('hidden');
    document.getElementById('accessTitle').textContent = rifiutato ? 'Accesso non autorizzato' : 'Richiesta inviata';
    document.getElementById('accessWho').textContent = [meta.full_name || meta.name, user.email].filter(Boolean).join(' · ');
    document.getElementById('accessText').textContent = rifiutato
        ? "Questo account non è stato approvato. Se pensi che sia un errore, parla con un responsabile della chiesa."
        : "Un amministratore della chiesa deve approvare il tuo accesso. Appena succede, l'app si apre da sola.";
    document.getElementById('accessRecheckBtn').classList.toggle('hidden', rifiutato);
    if (meta.avatar_url) document.getElementById('accessAvatar').src = meta.avatar_url;
    loginScreen.style.display = 'flex';
    loginScreen.style.opacity = '1';
    mainApp.classList.add('hidden');
    clearInterval(accessRecheckTimer);
    if (!rifiutato) accessRecheckTimer = setInterval(() => { if (!appShown) showApp(); }, 30000);
}
function nascondiAttesaAccesso() {
    clearInterval(accessRecheckTimer);
    accessRecheckTimer = null;
    document.getElementById('accessPendingCard')?.classList.add('hidden');
    document.getElementById('loginScreen')?.querySelector('.login-card:not(.access-card)')?.classList.remove('hidden');
}
document.getElementById('accessRecheckBtn').addEventListener('click', (e) => withBusyButton(e.currentTarget, async () => {
    await showApp();
    // la schermata è fuori dall'app: il riscontro compare sul pulsante stesso
    if (!appShown) {
        const btn = document.getElementById('accessRecheckBtn');
        btn.innerHTML = '<i class="ri-time-line"></i> Non ancora approvato';
        setTimeout(() => { btn.innerHTML = '<i class="ri-refresh-line"></i> Controlla di nuovo'; }, 2500);
    }
}));
document.getElementById('accessLogoutBtn').addEventListener('click', () => handleLogout());

// --- FUNZIONE LOGOUT CORRETTA E ROBUSTA ---
async function handleLogout() {
    console.log("Logout chiamato");
    const accountModal = document.getElementById('accountModal');
    if (accountModal) accountModal.classList.add('hidden');

    if (avvisiChannel) {
        try {
            await avvisiChannel.unsubscribe();
        } catch (e) {
            console.warn("Errore nella rimozione del canale:", e);
        }
        avvisiChannel = null;
    }

    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.error("Errore durante logout:", error);
    } catch (err) {
        console.error("Eccezione in signOut:", err);
    }

    document.body.classList.remove('is-admin');
    isAdmin = false;
    if (isReaderOpen()) closeHymnView();
    closeProjection();
    notesDB = [];
    localStorage.removeItem('notesDB');
    // i preferiti appartengono all'account: chi entra dopo su questo dispositivo non li eredita
    favoritesDB = [];
    localStorage.removeItem('favoritesDB');
    mainApp.classList.add('hidden');
    nascondiAttesaAccesso();
    loginScreen.style.display = 'flex';
    loginScreen.style.opacity = '1';
    appShown = false;
}

const mobileLogoutBtn = document.getElementById('mobileLogoutBtnModal');
if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', handleLogout);
}

// --- FUNZIONE PER ORDINAMENTO NUMERICO ---
function sortByNumber(a, b) {
    const numA = parseInt(a.title.match(/\d+/));
    const numB = parseInt(b.title.match(/\d+/));
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }
    return a.title.localeCompare(b.title);
}

// Immagini per il versetto del giorno
const verseImages = [
    'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800',
    'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800',
    'https://images.unsplash.com/photo-1444084316824-dc26d6657664?w=800',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800'
];

// Funzione Bibbia (con timeout e migliore gestione errori)
// Versioni disponibili: Nuova Riveduta da bolls.life, le versioni storiche
// (di pubblico dominio) da getbible.net. Entrambe numerano i libri da 1 a 66.
const GETBIBLE_VERSIONS = { RIV1927: 'riveduta', DIODATI: 'giovanni' };

async function fetchBibleData(version, bookId, chapter) {
    const getbible = GETBIBLE_VERSIONS[version];
    const directUrl = getbible
        ? `https://api.getbible.net/v2/${getbible}/${bookId}/${chapter}.json`
        : `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(directUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const json = await response.json();
        // getbible.net restituisce { verses: [{ verse, text }] }: stesso formato di bolls
        const data = getbible
            ? (json && Array.isArray(json.verses) ? json.verses.map(v => ({ verse: v.verse, text: String(v.text || '').trim() })) : [])
            : json;
        if (data && Array.isArray(data) && data.length > 0) {
            return data;
        } else {
            throw new Error("Nessun dato ricevuto");
        }
    } catch (e) {
        clearTimeout(timeoutId);
        console.error("Errore fetch Bibbia:", e);
        let errorMessage = "Impossibile caricare la Bibbia. ";
        if (e.name === 'AbortError') {
            errorMessage += "Timeout della richiesta (10s). Riprova.";
        } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
            errorMessage += "Verifica la connessione internet e riprova.";
        } else {
            errorMessage += "Errore di rete o del server. Riprova più tardi.";
        }
        throw new Error(errorMessage);
    }
}

// ========== NOTIFICHE (computer, Android, iPhone) ==========
// Su telefono le notifiche vanno mostrate tramite il service worker:
// Android non permette "new Notification()" e iPhone le mostra solo
// se l'app è installata nella schermata Home (iOS 16.4 o successivo).
let notificationsSupported = false;
let isPWA = false;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function checkNotificationSupport() {
    isPWA = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    notificationsSupported = 'Notification' in window;
    return notificationsSupported;
}

// Service worker pronto (con limite di attesa, per non bloccarsi se manca)
function getServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise(resolve => setTimeout(() => resolve(null), 4000))
    ]).catch(() => null);
}

// Mostra una notifica: prima tramite service worker (necessario su telefono),
// altrimenti direttamente dalla pagina (computer)
async function showAppNotification(title, options = {}, onPageClick) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    // Su Android il logo c'è già a sinistra (icona dell'app): l'immagine grande a destra lo ripeterebbe
    const isAndroid = /Android/i.test(navigator.userAgent);
    const opts = { badge: 'immagini/icon-badge.png', lang: 'it', ...(isAndroid ? {} : { icon: 'immagini/icon-192.png' }), ...options };
    const reg = await getServiceWorkerRegistration();
    if (reg && reg.showNotification) {
        try { await reg.showNotification(title, opts); return true; } catch (e) { console.warn('Notifica dal service worker non riuscita:', e); }
    }
    try {
        const n = new Notification(title, opts);
        n.onclick = () => { window.focus(); if (onPageClick) onPageClick(); n.close(); };
        return true;
    } catch (e) {
        console.error('Notifica non riuscita:', e);
        return false;
    }
}

async function requestNotificationPermission() {
    checkNotificationSupport();
    // iPhone: senza installazione nella Home le notifiche web non esistono
    if (isIOS && !isPWA) {
        alert('Su iPhone le notifiche funzionano solo con l\'app installata:\n\n1. In Safari tocca Condividi (il quadrato con la freccia)\n2. Scegli "Aggiungi alla schermata Home"\n3. Apri Open Worship dall\'icona nella Home e attiva di nuovo le notifiche');
        return false;
    }
    if (!notificationsSupported) {
        alert('Questo browser non supporta le notifiche.');
        return false;
    }
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await showAppNotification('Notifiche attivate', { body: 'Riceverai gli avvisi della chiesa.', tag: 'ow-welcome' });
            return true;
        }
        alert(permission === 'denied'
            ? 'Le notifiche sono bloccate per questo sito. Per attivarle: impostazioni del browser → Siti → Notifiche → consenti Open Worship.'
            : 'Permesso per le notifiche non concesso.');
        return false;
    } catch (err) {
        console.error('Errore richiesta permesso:', err);
        alert('Impossibile richiedere il permesso per le notifiche.');
        return false;
    }
}

function setupRealtimeAvvisi() {
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
    if (!notificationsEnabled) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (avvisiChannel) {
        avvisiChannel.unsubscribe();
        avvisiChannel = null;
    }
    avvisiChannel = supabaseClient
        .channel('avvisi-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avvisi' }, (payload) => {
            if (payload.new && payload.new.id) markAvvisiSeen([payload.new.id]);
            showAvvisoNotification(payload.new);
        })
        .subscribe((status) => {
            console.log('Canale realtime avvisi:', status);
        });
}

function showAvvisoNotification(avviso) {
    if (!avviso) return;
    const desc = String(avviso.desc || '');
    const body = `${desc.substring(0, 120)}${desc.length > 120 ? '…' : ''}${avviso.date ? `\n${new Date(avviso.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}`;
    showAppNotification(`Nuovo avviso: ${avviso.title}`, {
        body,
        tag: 'avviso-' + avviso.id,
        data: { avvisoId: avviso.id }
    }, () => openAvvisoFromNotification(avviso.id));
}

function openAvvisoFromNotification(id) {
    document.querySelector('.nav-item[data-target="avvisi"]')?.click();
    if (id) setTimeout(() => openAvvisoDetailModal(id), 300);
}

// Tocco su una notifica mostrata dal service worker: il service worker
// riporta l'app in primo piano e chiede di aprire l'avviso
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'open-avviso') openAvvisoFromNotification(e.data.id);
        if (e.data && e.data.type === 'open-membri' && typeof apriMembriDaNotifica === 'function') apriMembriDaNotifica();
    });
}
// Apertura dell'app da una notifica quando era chiusa (?avviso=ID)
(function openAvvisoFromUrl() {
    const id = new URLSearchParams(location.search).get('avviso');
    if (!id) return;
    window.__pendingAvvisoId = id;
    history.replaceState(null, '', location.pathname);
})();

// Avvisi pubblicati mentre l'app era chiusa: alla riapertura si avvisa
function getSeenAvvisi() {
    try { return JSON.parse(localStorage.getItem('seenAvvisi') || 'null'); } catch (e) { return null; }
}
function markAvvisiSeen(ids) {
    const seen = new Set(getSeenAvvisi() || []);
    ids.forEach(id => seen.add(id));
    try { localStorage.setItem('seenAvvisi', JSON.stringify([...seen].slice(-300))); } catch (e) { /* ignora */ }
}
function notifyMissedAvvisi(list) {
    const seen = getSeenAvvisi();
    const ids = list.map(a => a.id);
    if (seen === null) { markAvvisiSeen(ids); return; } // primo avvio: niente notifiche sugli avvisi vecchi
    const nuovi = list.filter(a => !seen.includes(a.id));
    if (!nuovi.length) return;
    markAvvisiSeen(nuovi.map(a => a.id));
    if (localStorage.getItem('notificationsEnabled') !== 'true') return;
    if (nuovi.length === 1) showAvvisoNotification(nuovi[0]);
    else showAppNotification(`${nuovi.length} nuovi avvisi`, {
        body: nuovi.slice(0, 3).map(a => '• ' + a.title).join('\n'),
        tag: 'avvisi-nuovi',
        data: { avvisoId: null }
    }, () => openAvvisoFromNotification(null));
}

// --- NOTIFICHE PUSH (arrivano anche con l'app chiusa) ---
// Chiave pubblica: quella privata resta solo nei Secrets di Supabase
const VAPID_PUBLIC_KEY = 'BI4K-MUso9vixB1-24VvZEplay0GiMVydYnJZiVoWF8-GEYeznXwBaUwF6j6wvHaWhzLrlWaFTfQ1OtzJSNWv68';

function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Registra questo dispositivo per le push e lo salva su Supabase
async function subscribePush() {
    if (!('PushManager' in window)) return { ok: false, motivo: 'Questo browser non supporta le notifiche push.' };
    if (!currentUser) return { ok: false, motivo: 'Accesso non effettuato.' };
    const reg = await getServiceWorkerRegistration();
    if (!reg || !reg.pushManager) return { ok: false, motivo: 'Service worker non attivo: ricarica la pagina e riprova.' };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    }
    const j = sub.toJSON();
    const { error } = await supabaseClient.from('push_subscriptions').upsert({
        user_id: currentUser.id,
        endpoint: j.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200)
    }, { onConflict: 'endpoint' });
    if (error) return { ok: false, motivo: 'Registrazione su Supabase non riuscita: ' + error.message };
    return { ok: true };
}

async function unsubscribePush() {
    const reg = await getServiceWorkerRegistration();
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (!sub) return;
    await supabaseClient.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
}

// Stato delle notifiche, mostrato sotto l'interruttore (aiuta a capire cosa non va)
async function getNotificationStatus() {
    checkNotificationSupport();
    const s = { supportate: 'Notification' in window, permesso: 'Notification' in window ? Notification.permission : 'non disponibile', installata: isPWA, serviceWorker: false, push: false, pushSupportate: 'PushManager' in window };
    const reg = await getServiceWorkerRegistration();
    s.serviceWorker = !!(reg && reg.active);
    if (reg && reg.pushManager) { try { s.push = !!(await reg.pushManager.getSubscription()); } catch (e) { s.push = false; } }
    return s;
}

async function updateNotificationStatus() {
    const el = document.getElementById('notificationStatus');
    if (!el) return;
    const s = await getNotificationStatus();
    const enabled = localStorage.getItem('notificationsEnabled') === 'true';
    let msg = '';
    if (isIOS && !s.installata) msg = 'Su iPhone installa l\'app nella schermata Home per ricevere le notifiche.';
    else if (!s.supportate) msg = 'Questo browser non supporta le notifiche.';
    else if (s.permesso === 'denied') msg = 'Notifiche bloccate: consentile nelle impostazioni del browser per questo sito.';
    else if (!enabled) msg = 'Disattivate.';
    else if (!s.serviceWorker) msg = 'Attive solo con l\'app aperta (ricarica la pagina per completare l\'attivazione).';
    else if (s.push) msg = 'Attive anche con l\'app chiusa.';
    else msg = 'Attive con l\'app aperta. Con l\'app chiusa non ancora.';
    el.textContent = msg;
    el.dataset.ok = enabled && s.push ? 'true' : 'false';
}

async function testNotification() {
    const btn = document.getElementById('testNotificationBtn');
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        const ok = await requestNotificationPermission();
        if (!ok) { updateNotificationStatus(); return; }
    }
    const shown = await showAppNotification('Prova notifica', { body: 'Se vedi questo messaggio, le notifiche funzionano su questo dispositivo.', tag: 'ow-test' });
    if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = shown ? '<i class="ri-check-line"></i> Inviata' : '<i class="ri-error-warning-line"></i> Non riuscita';
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    }
    updateNotificationStatus();
}

// --- LOADER APPLE STYLE ---
function showSpinner(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;
    container.innerHTML = '<div class="apple-spinner"></div>';
}

// Chi è amministratore lo decide il database (funzione is_admin, vedi supabase-amministratori.sql).
// Se il database non risponde i pulsanti di modifica restano nascosti:
// i permessi veri sono comunque quelli delle regole di sicurezza su Supabase.
async function resolveAdmin(user) {
    try {
        const { data, error } = await supabaseClient.rpc('is_admin');
        if (!error && typeof data === 'boolean') return data;
    } catch (e) { /* database non raggiungibile */ }
    return false;
}

let appInitialized = false;

// Mostra app principale dopo login
async function showApp() {
    if (appShown) return;         // evita di aprire l'app due volte (più segnali di accesso insieme)
    appShown = true;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { appShown = false; loginScreen.style.opacity = '1'; return; }
    currentUser = user;
    isAdmin = await resolveAdmin(user);
    // Accesso su approvazione: chi non è ancora approvato resta sulla schermata di attesa
    if (!isAdmin) {
        const stato = await statoAccesso();
        if (stato !== 'approvato') {
            mostraAttesaAccesso(user, stato);
            appShown = false;
            return;
        }
    }
    nascondiAttesaAccesso();

    loginScreen.style.opacity = '0';
    setTimeout(async () => {
        loginScreen.style.display = 'none';
        mainApp.classList.remove('hidden');

        document.body.classList.toggle('is-admin', isAdmin);
        renderHymns();
        renderAvvisi();

        // Profilo utente
        const profileImg = document.getElementById('userProfileImg');
        const profileName = document.getElementById('userProfileName');
        const mobileAvatar = document.getElementById('mobileAvatarImg');
        const modalAvatar = document.getElementById('modalAvatarImg');
        const modalUserName = document.getElementById('modalUserName');

        if (user.user_metadata.avatar_url) {
            profileImg.src = user.user_metadata.avatar_url;
            profileImg.classList.remove('hidden');
            if (mobileAvatar) mobileAvatar.src = user.user_metadata.avatar_url;
            if (modalAvatar) modalAvatar.src = user.user_metadata.avatar_url;
        } else {
            if (mobileAvatar) mobileAvatar.src = 'immagini/icon-192.png';
            if (modalAvatar) modalAvatar.src = 'immagini/icon-192.png';
        }
        const fullName = user.user_metadata.full_name || user.email;
        profileName.textContent = fullName;
        if (modalUserName) modalUserName.textContent = fullName;

        const greetingEl = document.getElementById('greetingMessage');
        const hourNow = new Date().getHours();
        const greetingText = hourNow < 12 ? "Buongiorno" : (hourNow < 18 ? "Buon pomeriggio" : "Buonasera");
        greetingEl.textContent = `${greetingText}, ${(user.user_metadata.full_name || user.email || 'Amico').split(' ')[0]}!`;

        await loadCloudData();
        updateDashboard();
        renderHighlights();
        updateVerseOfDayImage();
        if (appInitialized) return;
        appInitialized = true;
        setupFavoritesTabs();
        setupDashboardCards();

        // Inizializza supporto notifiche
        checkNotificationSupport();

        // Rendi cliccabile il box profilo desktop
        const desktopProfileBox = document.getElementById('desktopProfileBox');
        if (desktopProfileBox) {
            desktopProfileBox.addEventListener('click', () => {
                openAccountModal();
            });
        }

        // Refresh periodico
        setInterval(() => {
            loadCloudData();
        }, 30000);

        // Eventi vari
        document.getElementById('newNoteTopBtn').addEventListener('click', () => {
            openNoteModal();
        });

        document.getElementById('hymnSearch').addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderHymns();
        });

        setupExportButton();
        setupShareButtons();

        // Proiezione avvisi
        const projectAvvisiBtn = document.getElementById('projectAvvisiBtn');
        if (projectAvvisiBtn) {
            projectAvvisiBtn.addEventListener('click', () => {
                askPresentationMode('avvisi');
            });
        }

        // Proiezione cantico
        const projectHymnBtn = document.getElementById('projectHymnBtn');
        if (projectHymnBtn) {
            projectHymnBtn.addEventListener('click', () => {
                const currentHymnId = window.currentHymnId;
                if (currentHymnId) askPresentationMode('cantico', currentHymnId);
            });
        }

        // Account mobile
        const mobileAccountBtn = document.getElementById('mobileAccountBtn');
        if (mobileAccountBtn) {
            mobileAccountBtn.addEventListener('click', () => {
                openAccountModal();
            });
        }

        // Gestione switch notifiche (migliorata per mobile)
        const notificationsSwitch = document.getElementById('notificationsSwitch');
        if (notificationsSwitch) {
            const saved = localStorage.getItem('notificationsEnabled') === 'true';
            notificationsSwitch.checked = saved;

            // Già attive: si riattiva il canale in tempo reale e si rinnova la registrazione push
            if (saved && 'Notification' in window && Notification.permission === 'granted') {
                setupRealtimeAvvisi();
                subscribePush().catch(() => {});
            }

            notificationsSwitch.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                localStorage.setItem('notificationsEnabled', enabled);

                if (enabled) {
                    const alreadyGranted = 'Notification' in window && Notification.permission === 'granted';
                    const granted = alreadyGranted || await requestNotificationPermission();
                    if (!granted) {
                        notificationsSwitch.checked = false;
                        localStorage.setItem('notificationsEnabled', false);
                        updateNotificationStatus();
                        return;
                    }
                    setupRealtimeAvvisi();
                    // Push: avvisi anche con l'app chiusa
                    const push = await subscribePush().catch(err => ({ ok: false, motivo: err.message }));
                    if (alreadyGranted) {
                        await showAppNotification('Notifiche attivate', { body: 'Riceverai gli avvisi della chiesa.', tag: 'ow-welcome' });
                    }
                    if (!push.ok) console.warn('Registrazione push non riuscita:', push.motivo);
                } else {
                    if (avvisiChannel) {
                        avvisiChannel.unsubscribe();
                        avvisiChannel = null;
                    }
                    await unsubscribePush().catch(() => {});
                }
                updateNotificationStatus();
            });
        }
        const testBtn = document.getElementById('testNotificationBtn');
        if (testBtn) testBtn.onclick = testNotification;
        updateNotificationStatus();


    }, 400);
}

function openAccountModal() {
    document.getElementById('accountModal').classList.remove('hidden');
    if (isAdmin) loadAdmins();
    if (isAdmin && typeof loadMembri === 'function') loadMembri();
}

// --- AMMINISTRATORI ---
// Il proprietario aggiunge o toglie gli amministratori; nessuno può togliere il proprietario.
// I controlli veri sono nel database (supabase-amministratori.sql): qui si mostra solo l'elenco.
let isOwner = false;
async function loadAdmins() {
    const list = document.getElementById('adminsList');
    const form = document.getElementById('adminsAddForm');
    const hint = document.getElementById('adminsHint');
    if (!list) return;
    list.innerHTML = '<li class="admins-empty">Caricamento…</li>';
    const [{ data: owner }, { data, error }] = await Promise.all([
        supabaseClient.rpc('is_owner'),
        supabaseClient.rpc('list_admins')
    ]);
    if (error) {
        list.innerHTML = '<li class="admins-empty">Elenco non disponibile: esegui supabase-amministratori.sql su Supabase.</li>';
        form.classList.add('hidden');
        return;
    }
    isOwner = owner === true;
    form.classList.toggle('hidden', !isOwner);
    const backupBox = document.getElementById('backupBox');
    if (backupBox) backupBox.hidden = !isOwner;
    hint.textContent = isOwner
        ? "Aggiungi l'email Google della persona: al prossimo accesso potrà modificare cantici e avvisi e usare la proiezione."
        : 'Solo il proprietario può aggiungere o togliere amministratori.';
    list.innerHTML = (data || []).map(a => `
        <li class="admins-item">
            <span class="admins-email">${escapeHtml(a.email)}</span>
            ${a.proprietario
                ? '<b class="admins-badge">Proprietario</b>'
                : (isOwner ? `<button type="button" class="icon-btn icon-danger" title="Togli amministratore" data-remove-admin="${escapeHtml(a.email)}"><i class="ri-user-unfollow-line"></i></button>` : '')}
        </li>`).join('') || '<li class="admins-empty">Nessun amministratore</li>';
}
document.getElementById('adminsAddForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('adminsEmailInput');
    const email = input.value.trim().toLowerCase();
    if (!email) return;
    return withBusyButton(document.getElementById('adminsAddBtn'), async () => {
        const { error } = await supabaseClient.rpc('add_admin', { new_email: email });
        if (error) { alert(error.message || 'Impossibile aggiungere'); return; }
        input.value = '';
        showVerseToast('Amministratore aggiunto');
        await loadAdmins();
    });
});
document.getElementById('adminsList')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-admin]');
    if (!btn) return;
    const email = btn.dataset.removeAdmin;
    if (!confirm(`Togliere ${email} dagli amministratori?`)) return;
    await withBusyButton(btn, async () => {
        const { error } = await supabaseClient.rpc('remove_admin', { old_email: email });
        if (error) { alert(error.message || 'Impossibile togliere'); return; }
        showVerseToast('Amministratore tolto');
        await loadAdmins();
    });
});
function closeAccountModal() {
    document.getElementById('accountModal').classList.add('hidden');
}

function setupShareButtons() {
    const shareHymnBtn = document.getElementById('shareHymnBtn');
    if (shareHymnBtn) {
        shareHymnBtn.addEventListener('click', shareCurrentHymn);
    }
}

function shareCurrentHymn() {
    const hymn = hymnsDB.find(h => h.id === window.currentHymnId);
    if (!hymn) return;
    shareContent(hymn.title, SongTools.lyricsText(hymn.content));
}

let firstDataLoaded = false;
function hideAppSplash() {
    const s = document.getElementById('appSplash');
    if (s) s.classList.add('hidden');
}
async function loadCloudData() {
    if (!firstDataLoaded) document.getElementById('appSplash')?.classList.remove('hidden');
    try { return await loadCloudDataInner(); }
    finally { if (!firstDataLoaded) { firstDataLoaded = true; hideAppSplash(); } }
}
async function loadCloudDataInner() {
    try {
        const { data: cantici, error: canticiErr } = await supabaseClient.from('cantici').select('*');
        if (!canticiErr && cantici) {
            // Ridisegna la lista solo se i cantici sono cambiati davvero:
            // il refresh periodico non deve riportare la pagina all'inizio
            const signature = JSON.stringify([...cantici].sort((a, b) => String(a.id).localeCompare(String(b.id))));
            if (signature !== lastHymnsSignature) {
                lastHymnsSignature = signature;
                hymnsDB = cantici;
                renderHymns();
            }
        } else console.error("Errore download cantici", canticiErr);

        const { data: avvisi, error: avvisiErr } = await supabaseClient.from('avvisi').select('*');
        if (!avvisiErr && avvisi) {
            avvisiDB = avvisi;
            notifyMissedAvvisi(avvisi);
            // app aperta da una notifica: si mostra l'avviso
            if (window.__pendingAvvisoId) { const id = window.__pendingAvvisoId; window.__pendingAvvisoId = null; openAvvisoFromNotification(id); }
        }
        else console.error("Errore download avvisi", avvisiErr);
        renderAvvisi();

        if (currentUser) {
            const { data: appunti, error: appuntiErr } = await supabaseClient
                .from('appunti')
                .select('*')
                .eq('user_id', currentUser.id);
            if (!appuntiErr && appunti) {
                notesDB = appunti;
                localStorage.setItem('notesDB', JSON.stringify(notesDB));
            } else {
                console.error("Errore download appunti", appuntiErr);
            }
        }
        await syncFavorites();
        if (typeof loadScalette === 'function') await loadScalette();
        if (isAdmin && typeof aggiornaRichiesteMembri === 'function') aggiornaRichiesteMembri();
        renderNotes();
        updateDashboard();
    } catch (err) {
        console.error("Errore di rete generale", err);
    }
}

// --- NAVIGAZIONE ---
document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        document.querySelectorAll('.nav-item[data-target]').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll(`.nav-item[data-target="${target}"]`).forEach(btn => btn.classList.add('active'));
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        if (target === 'dashboard') updateDashboard();
        if (target !== 'cantici' && isReaderOpen()) {
            closeHymnView();
        }
        setReadingImmersive(false);
        if (target === 'bibbia') {
            updateBibleControlsVisibility();
        }
        if (target === 'utenti' && isAdmin) {
            if (typeof loadMembri === 'function') loadMembri();
            loadAdmins();
        }
    });
});

// --- DASHBOARD E AVVISI ---
const dailyVerses = [
    { text: "Poiché Dio ha tanto amato il mondo...", ref: "Giovanni 3:16" },
    { text: "Io posso ogni cosa in colui che mi fortifica.", ref: "Filippesi 4:13" },
    { text: "Il Signore è il mio pastore: nulla mi manca.", ref: "Salmi 23:1" },
    { text: "Or la fede è certezza di cose che si sperano...", ref: "Ebrei 11:1" },
    { text: "Non preoccupatevi di nulla, ma in ogni cosa fate conoscere le vostre richieste a Dio.", ref: "Filippesi 4:6" },
    { text: "Il Signore ti benedica e ti custodisca.", ref: "Numeri 6:24" },
    { text: "Gustate e vedete quanto il Signore è buono!", ref: "Salmi 34:9" }
];

let editingAvvisoId = null;

function renderAvvisi() {
    const list = document.getElementById('avvisiList');
    list.innerHTML = '';
    const oggi = new Date().toISOString().slice(0,10);
    const sortedAvvisi = [...avvisiDB].sort((a,b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        const diffA = Math.abs(da - new Date());
        const diffB = Math.abs(db - new Date());
        return diffA - diffB;
    });
    if (sortedAvvisi.length === 0) {
        list.innerHTML = '<p class="text-muted">Nessun avviso presente al momento.</p>';
        return;
    }
    sortedAvvisi.forEach(avviso => {
        const dateObj = new Date(avviso.date);
        const card = document.createElement('div');
        card.className = 'avviso-card';
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            card.innerHTML = `
                <div class="avviso-date">${dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="avviso-title">${escapeHtml(avviso.title)}</div>
                <div class="avviso-desc">${escapeHtml(avviso.desc.substring(0, 150))}${avviso.desc.length > 150 ? '...' : ''}</div>
                <div style="margin-top: 12px;">
                    <button class="btn-text" onclick="event.stopPropagation(); openAvvisoDetailModal('${avviso.id}')">Leggi tutto <i class="ri-arrow-right-s-line"></i></button>
                </div>
                <div class="mobile-menu">
                    <button class="mobile-menu-btn" onclick="event.stopPropagation(); toggleMobileMenu(this)"><i class="ri-more-2-fill"></i></button>
                    <div class="mobile-menu-dropdown hidden">
                        <button onclick="event.stopPropagation(); shareAvviso('${avviso.id}')"><i class="ri-share-line"></i> Condividi</button>
                        ${isAdmin ? `<button onclick="event.stopPropagation(); openAvvisoModal('${avviso.id}')"><i class="ri-pencil-line"></i> Modifica</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); deleteAvviso('${avviso.id}')"><i class="ri-delete-bin-line"></i> Elimina</button>` : ''}
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 8px; z-index: 10;">
                    <button class="icon-btn" onclick="event.stopPropagation(); shareAvviso('${avviso.id}')"><i class="ri-share-line"></i></button>
                    ${isAdmin ? `<button class="icon-btn" onclick="event.stopPropagation(); openAvvisoModal('${avviso.id}')"><i class="ri-pencil-line"></i></button>` : ''}
                    ${isAdmin ? `<button class="icon-btn icon-danger" onclick="event.stopPropagation(); deleteAvviso('${avviso.id}')"><i class="ri-delete-bin-line"></i></button>` : ''}
                </div>
                <div class="avviso-date">${dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="avviso-title">${escapeHtml(avviso.title)}</div>
                <div class="avviso-desc">${escapeHtml(avviso.desc.substring(0, 150))}${avviso.desc.length > 150 ? '...' : ''}</div>
                <div style="margin-top: 12px;">
                    <button class="btn-text" onclick="event.stopPropagation(); openAvvisoDetailModal('${avviso.id}')">Leggi tutto <i class="ri-arrow-right-s-line"></i></button>
                </div>
            `;
        }
        card.onclick = () => openAvvisoDetailModal(avviso.id);
        list.appendChild(card);
    });
}

function toggleMobileMenu(btn) {
    const dropdown = btn.nextElementSibling;
    document.querySelectorAll('.mobile-menu-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('.mobile-menu')) {
        document.querySelectorAll('.mobile-menu-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

function openAvvisoDetailModal(id) {
    const avviso = avvisiDB.find(a => a.id === id);
    if (!avviso) return;
    document.getElementById('detailAvvisoTitle').textContent = avviso.title;
    const dateObj = new Date(avviso.date);
    document.getElementById('detailAvvisoDate').textContent = dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('detailAvvisoDesc').textContent = avviso.desc;
    const shareBtn = document.getElementById('shareAvvisoDetailBtn');
    shareBtn.onclick = () => shareAvviso(id);
    document.getElementById('avvisoDetailModal').classList.remove('hidden');
}

function closeAvvisoDetailModal() {
    document.getElementById('avvisoDetailModal').classList.add('hidden');
}

async function shareAvviso(id) {
    const avviso = avvisiDB.find(a => a.id === id);
    if (!avviso) return;
    const title = avviso.title;
    const text = `${avviso.desc}\n\nData: ${new Date(avviso.date).toLocaleDateString('it-IT')}`;
    await shareContent(title, text);
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function openAvvisoModal(id = null) {
    if (id) {
        editingAvvisoId = id;
        const avv = avvisiDB.find(a => a.id === id);
        document.getElementById('avvisoModalTitle').textContent = "Modifica Avviso";
        document.getElementById('avvisoDate').value = avv.date;
        document.getElementById('avvisoTitle').value = avv.title;
        document.getElementById('avvisoDesc').value = avv.desc;
        document.getElementById('deleteAvvisoBtn').style.display = 'flex';
        document.getElementById('deleteAvvisoBtn').onclick = () => deleteAvviso(id);
    } else {
        editingAvvisoId = null;
        document.getElementById('avvisoModalTitle').textContent = "Nuovo Avviso";
        document.getElementById('avvisoDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('avvisoTitle').value = "";
        document.getElementById('avvisoDesc').value = "";
        document.getElementById('deleteAvvisoBtn').style.display = 'none';
    }
    document.getElementById('avvisoModal').classList.remove('hidden');
}

function closeAvvisoModal() {
    document.getElementById('avvisoModal').classList.add('hidden');
}

document.getElementById('saveAvvisoBtn').onclick = (e) => withBusyButton(e.currentTarget, async () => {
    const title = document.getElementById('avvisoTitle').value.trim();
    const date = document.getElementById('avvisoDate').value;
    const desc = document.getElementById('avvisoDesc').value.trim();
    if (!title || !date) return;
    const newAvviso = {
        id: editingAvvisoId || crypto.randomUUID(),
        date,
        title,
        desc
    };
    try {
        const { error } = await supabaseClient.from('avvisi').upsert([newAvviso]);
        if (error) throw error;
        if (editingAvvisoId) {
            const index = avvisiDB.findIndex(a => a.id === editingAvvisoId);
            avvisiDB[index] = newAvviso;
        } else {
            avvisiDB.push(newAvviso);
        }
        closeAvvisoModal();
        renderAvvisi();
        updateDashboard();
    } catch (e) {
        alert("Errore nel salvataggio dell'avviso: " + e.message);
    }
});

async function deleteAvviso(id) {
    if (confirm("Sicuro di voler eliminare questo avviso?")) {
        try {
            const { error } = await supabaseClient.from('avvisi').delete().eq('id', id);
            if (error) throw error;
            avvisiDB = avvisiDB.filter(a => a.id !== id);
            closeAvvisoModal();
            renderAvvisi();
            updateDashboard();
        } catch (e) {
            alert("Errore durante l'eliminazione: " + e.message);
        }
    }
}

// La proiezione (sfondi, stile, transizioni, regia) è in projection.js

// --- CANTICI: XML PARSER E CLOUD SYNC ---
// --- AVANZAMENTO IN TEMPO REALE (caricamento ed eliminazione dei cantici) ---
function apriAvanzamento({ titolo, totale, fatto, icona }) {
    const box = document.createElement('div');
    box.className = 'modal progress-modal';
    box.innerHTML = `
        <div class="modal-content progress-card" role="status" aria-live="polite">
            <div class="progress-head">
                <span class="progress-icon"><i class="${icona}"></i></span>
                <h2>${escapeHtml(titolo)}</h2>
            </div>
            <div class="progress-count"><b class="pc-done">0</b><span> di ${totale}</span></div>
            <div class="progress-track"><span class="pc-bar"></span></div>
            <p class="progress-current pc-current">Preparazione…</p>
            <div class="progress-stats">
                <span class="ps-ok"><i class="ri-checkbox-circle-fill"></i> <b class="pc-ok">0</b> ${escapeHtml(fatto)}</span>
                <span class="ps-err"><i class="ri-error-warning-fill"></i> <b class="pc-err">0</b> errori</span>
            </div>
            <details class="progress-errors" hidden><summary>Vedi gli errori</summary><ul></ul></details>
            <div class="progress-actions">
                <button type="button" class="btn-secondary pc-stop">Interrompi</button>
                <button type="button" class="btn-apple pc-close" hidden>Chiudi</button>
            </div>
        </div>`;
    document.body.appendChild(box);
    const q = sel => box.querySelector(sel);
    const stato = { ok: 0, err: 0, done: 0, fermato: false };
    q('.pc-stop').onclick = () => {
        stato.fermato = true;
        q('.pc-stop').disabled = true;
        q('.pc-stop').textContent = 'Interruzione…';
    };
    q('.pc-close').onclick = () => box.remove();
    const ridisegna = () => {
        q('.pc-done').textContent = stato.done;
        q('.pc-ok').textContent = stato.ok;
        q('.pc-err').textContent = stato.err;
        q('.pc-bar').style.width = (totale ? Math.round(stato.done / totale * 100) : 100) + '%';
        box.querySelector('.ps-err').classList.toggle('has-errors', stato.err > 0);
    };
    return {
        get fermato() { return stato.fermato; },
        corrente(nome) { q('.pc-current').textContent = nome; },
        riuscito(n = 1) { stato.ok += n; stato.done += n; ridisegna(); },
        errore(nome, motivo, n = 1) {
            stato.err += n; stato.done += n; ridisegna();
            const det = q('.progress-errors');
            det.hidden = false;
            const li = document.createElement('li');
            li.textContent = nome + (motivo ? ': ' + motivo : '');
            det.querySelector('ul').appendChild(li);
        },
        fine(messaggio) {
            ridisegna();
            box.querySelector('.progress-card').classList.add('is-done', stato.err ? 'with-errors' : 'all-ok');
            q('.pc-current').textContent = messaggio;
            q('.pc-stop').hidden = true;
            q('.pc-close').hidden = false;
            q('.pc-close').focus();
        },
        get risultato() { return { ...stato }; }
    };
}

document.getElementById('deleteAllHymnsBtn').addEventListener('click', async () => {
    if (hymnsDB.length === 0) return alert("Non ci sono cantici da cancellare.");
    if (!confirm(`ATTENZIONE! Vuoi cancellare TUTTI i ${hymnsDB.length} cantici dal cloud? Non si potranno recuperare.`)) return;
    const daEliminare = [...hymnsDB];
    const av = apriAvanzamento({ titolo: 'Eliminazione dei cantici', totale: daEliminare.length, fatto: 'eliminati', icona: 'ri-delete-bin-line' });
    const eliminati = new Set();
    // a gruppi di 25: molto più veloce che uno alla volta
    for (let i = 0; i < daEliminare.length && !av.fermato; i += 25) {
        const gruppo = daEliminare.slice(i, i + 25);
        av.corrente(gruppo[0].title + (gruppo.length > 1 ? ` … ${gruppo[gruppo.length - 1].title}` : ''));
        try {
            const { error } = await supabaseClient.from('cantici').delete().in('id', gruppo.map(h => h.id));
            if (error) throw error;
            gruppo.forEach(h => eliminati.add(h.id));
            av.riuscito(gruppo.length);
        } catch (e) {
            av.errore(`Cantici ${i + 1}–${i + gruppo.length}`, e.message, gruppo.length);
        }
    }
    hymnsDB = hymnsDB.filter(h => !eliminati.has(h.id));
    favoritesDB = favoritesDB.filter(id => !eliminati.has(id));
    saveFavorites();
    renderHymns();
    updateDashboard();
    const r = av.risultato;
    av.fine(av.fermato
        ? `Interrotto: eliminati ${r.ok} cantici, ${hymnsDB.length} restano.`
        : r.err ? `Fatto, ma ${r.err} cantici non sono stati eliminati.` : `Fatto: eliminati tutti i ${r.ok} cantici.`);
});

document.getElementById('xmlUpload').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = ''; // così si possono ricaricare gli stessi file
    if (!files.length) return;
    const av = apriAvanzamento({ titolo: 'Caricamento dei cantici', totale: files.length, fatto: 'caricati', icona: 'ri-upload-cloud-2-line' });
    for (let file of files) {
        if (av.fermato) break;
        av.corrente(file.name);
        try {
            let text = await file.text();
            let title = file.name.replace(/\.[^/.]+$/, "");
            let content = text;
            if (/\.(cho|chordpro|chopro|pro|txt)$/i.test(file.name)) {
                // ChordPro o testo semplice: si tiene così com'è (accordi compresi)
                const meta = SongTools.splitMeta(text).meta;
                if (meta.title) title = meta.title;
                content = text.replace(/^\s*\{\s*(title|t)\s*:[^}]*\}\s*$/gim, '').trim();
            } else if (file.name.endsWith('.xml')) {
                let safeText = text.replace(/xmlns(:\w+)?="[^"]*"/g, '');
                safeText = safeText.replace(/<br\s*\/?>/gi, '\n');
                const xmlDoc = new DOMParser().parseFromString(safeText, "text/xml");
                if (xmlDoc.querySelector("title")) title = xmlDoc.querySelector("title").textContent;
                let versesNodes = xmlDoc.querySelectorAll("verse, chorus, stanza");
                if (versesNodes.length === 0) versesNodes = xmlDoc.querySelectorAll("lines");
                if (versesNodes.length > 0) {
                    let parsed = "";
                    let lastBlockText = "";
                    versesNodes.forEach(v => {
                        let vName = v.getAttribute("name") || v.tagName;
                        let isChorus = vName.toLowerCase().startsWith("c") || vName.toLowerCase().includes("chorus");
                        let linesNodes = v.querySelectorAll("lines");
                        let blockText = "";
                        if (linesNodes.length > 0) {
                            linesNodes.forEach(line => {
                                blockText += decodeXmlEntities(chordTagsToInline(line.innerHTML).replace(/<[^>]+>/g, '')).trim() + "\n";
                            });
                        } else {
                            blockText = decodeXmlEntities(chordTagsToInline(v.innerHTML).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
                        }
                        blockText = blockText.trim();
                        let normalizedCurrent = blockText.replace(/\s+/g, ' ');
                        let normalizedLast = lastBlockText.replace(/\s+/g, ' ');
                        if (blockText.length > 0 && normalizedCurrent !== normalizedLast) {
                            lastBlockText = blockText;
                            if (isChorus) blockText = "Coro:\n" + blockText;
                            parsed += blockText + "\n\n";
                        }
                    });
                    content = parsed.trim();
                } else {
                    let lyricsNode = xmlDoc.querySelector("lyrics") || xmlDoc.documentElement;
                    content = lyricsNode.textContent.trim();
                }
            }
            if (!String(content || '').trim()) throw new Error('il file non contiene il testo del cantico');
            const newHymn = { id: crypto.randomUUID(), title: title, content: content };
            const { error } = await supabaseClient.from('cantici').insert([newHymn]);
            if (error) {
                av.errore(title, error.message);
            } else {
                hymnsDB.push(newHymn);
                av.riuscito();
            }
        } catch (e) {
            console.error("Errore lettura file:", e);
            av.errore(file.name, e.message || 'file non leggibile');
        }
    }
    renderHymns();
    updateDashboard();
    const r = av.risultato;
    av.fine(av.fermato
        ? `Interrotto: caricati ${r.ok} cantici su ${files.length}.`
        : r.err ? `Fatto: caricati ${r.ok} cantici, ${r.err} con errori.` : `Fatto: caricati tutti i ${r.ok} cantici.`);
});

function normalizeSearch(text) {
    return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ');
}

// OpenLyrics: <chord name="G"/> oppure <chord root="G" .../> diventano [G]
function chordTagsToInline(html) {
    return String(html).replace(/<chord\b([^>]*)\/?>/gi, (m, attrs) => {
        const name = attrs.match(/\bname="([^"]+)"/i) || attrs.match(/\broot="([^"]+)"/i);
        if (!name) return '';
        const bass = attrs.match(/\bbass="([^"]+)"/i);
        const structure = attrs.match(/\bstructure="([^"]+)"/i);
        let chord = name[1];
        if (structure && !attrs.match(/\bname=/i)) chord += structure[1].replace(/^major$/, '').replace(/^minor$/, 'm');
        if (bass) chord += '/' + bass[1];
        return SongTools.parseChord(chord) ? '[' + chord + ']' : '';
    }).replace(/<\/chord>/gi, '');
}

function decodeXmlEntities(text) {
    const ta = document.createElement('textarea');
    ta.innerHTML = text;
    return ta.value;
}

function getFilteredHymns() {
    let filtered = [...hymnsDB];
    const term = normalizeSearch(searchTerm).trim();
    if (term) {
        filtered = filtered.filter(h => normalizeSearch(h.title).includes(term) || normalizeSearch(h.content).includes(term));
    }
    if (currentTab === "favorites") {
        filtered = filtered.filter(h => isFavorite(h.id));
    }
    return filtered.sort(sortByNumber);
}

function renderHymns() {
    const list = document.getElementById('hymnsList');
    // Conserva la posizione di scorrimento quando la lista viene ridisegnata
    const mainScroller = document.querySelector('.main-content');
    const savedMain = mainScroller ? mainScroller.scrollTop : 0;
    requestAnimationFrame(() => {
        if (mainScroller) mainScroller.scrollTop = savedMain;
    });
    // Scheda "Scaletta": al posto dell'elenco dei cantici si mostrano le scalette del servizio
    document.querySelector('.hymns-toolbar .search-bar')?.classList.toggle('hidden', currentTab === 'scalette');
    list.classList.toggle('scalette-mode', currentTab === 'scalette');
    if (currentTab === 'scalette') { if (typeof renderScalette === 'function') renderScalette(); return; }
    list.innerHTML = '';
    const filtered = getFilteredHymns();
    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state"><i class="ri-music-2-line"></i>Nessun cantico trovato</p>';
        return;
    }
    const isMobile = window.innerWidth <= 768;
    const fragment = document.createDocumentFragment();
    filtered.forEach((hymn) => {
        const card = document.createElement('div');
        card.className = 'hymn-card';
        const id = escapeHtml(hymn.id);
        const favActive = isFavorite(hymn.id);
        // "12 - Titolo" diventa numero in evidenza + titolo
        const m = String(hymn.title || '').match(/^\s*(\d+)\s*[-–.:)]?\s*(.*)$/);
        const number = m && m[2] ? m[1] : '';
        const name = m && m[2] ? m[2] : (hymn.title || '');
        const chordsIcon = CHORDS_ENABLED && hymnHasChords(hymn) ? '<i class="ri-music-2-line hymn-badge-chords" title="Con accordi"></i>' : '';
        const main = `
            <div class="hymn-main" onclick="openHymnView('${id}')">
                ${number ? `<span class="hymn-number">${escapeHtml(number)}</span>` : ''}
                <span class="hymn-name">${escapeHtml(name)}</span>
                ${chordsIcon}
            </div>`;
        if (isMobile) {
            card.innerHTML = `${main}
                <button class="favorite-btn ${favActive ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${id}')" title="Preferito">
                    <i class="ri-heart-${favActive ? 'fill' : 'line'}"></i>
                </button>
                <div class="mobile-menu">
                    <button class="mobile-menu-btn" onclick="event.stopPropagation(); toggleMobileMenu(this)" title="Altro"><i class="ri-more-2-fill"></i></button>
                    <div class="mobile-menu-dropdown hidden">
                        <button onclick="event.stopPropagation(); shareHymn('${id}')"><i class="ri-share-line"></i> Condividi</button>
                        ${isAdmin ? `<button onclick="event.stopPropagation(); askPresentationMode('cantico', '${id}')"><i class="ri-projector-line"></i> Proietta</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); openAggiungiAScaletta('${id}')"><i class="ri-play-list-add-line"></i> Aggiungi a un servizio</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); openEditModal('${id}')"><i class="ri-pencil-line"></i> Modifica</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); deleteHymn('${id}')"><i class="ri-delete-bin-line"></i> Elimina</button>` : ''}
                    </div>
                </div>`;
        } else {
            card.innerHTML = `${main}
                <div class="hymn-actions">
                    <button class="favorite-btn ${favActive ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${id}')" title="Preferito">
                        <i class="ri-heart-${favActive ? 'fill' : 'line'}"></i>
                    </button>
                    <button class="icon-btn" onclick="event.stopPropagation(); shareHymn('${id}')" title="Condividi"><i class="ri-share-line"></i></button>
                    ${isAdmin ? `
                    <div class="admin-list-controls">
                        <button class="icon-btn" onclick="event.stopPropagation(); askPresentationMode('cantico', '${id}')" title="Proietta"><i class="ri-projector-line"></i></button>
                        <button class="icon-btn" onclick="event.stopPropagation(); openAggiungiAScaletta('${id}')" title="Aggiungi a un servizio"><i class="ri-play-list-add-line"></i></button>
                        <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('${id}')" title="Modifica"><i class="ri-pencil-line"></i></button>
                        <button class="icon-btn icon-danger" onclick="event.stopPropagation(); deleteHymn('${id}')" title="Elimina"><i class="ri-delete-bin-line"></i></button>
                    </div>` : ''}
                </div>`;
        }
        fragment.appendChild(card);
    });
    list.appendChild(fragment);
}

// Riconosce anche gli accordi scritti sopra il testo (risultato memorizzato per contenuto)
const chordsCache = new Map();
function hymnHasChords(hymn) {
    const content = hymn.content || '';
    if (!chordsCache.has(content)) chordsCache.set(content, SongTools.hasChords(content));
    return chordsCache.get(content);
}

// Ridisegna la lista se si passa da telefono a computer (o si ruota il tablet)
let lastLayoutMobile = window.innerWidth <= 768;
window.addEventListener('resize', () => {
    const nowMobile = window.innerWidth <= 768;
    if (nowMobile !== lastLayoutMobile) {
        lastLayoutMobile = nowMobile;
        renderHymns();
        renderAvvisi();
    }
});

function toggleReaderMobileMenu(btn) {
    const dropdown = btn.nextElementSibling;
    document.querySelectorAll('.mobile-menu-reader-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('.mobile-menu-reader')) {
        document.querySelectorAll('.mobile-menu-reader-dropdown').forEach(d => d.classList.add('hidden'));
    }
});

async function shareHymn(id) {
    const hymn = hymnsDB.find(h => h.id === id);
    if (!hymn) return;
    await shareContent(hymn.title, SongTools.lyricsText(hymn.content).substring(0, 500));
}

function setupFavoritesTabs() {
    const tabs = document.querySelectorAll('.favorites-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.getAttribute('data-tab');
            renderHymns();
        });
    });
}

let editHymnId = null;
async function deleteHymn(id) {
    if (confirm("Eliminare cantico?")) {
        try {
            const { error } = await supabaseClient.from('cantici').delete().eq('id', id);
            if (error) throw error;
            hymnsDB = hymnsDB.filter(h => h.id !== id);
            favoritesDB = favoritesDB.filter(favId => favId !== id);
            saveFavorites();
            renderHymns();
            updateDashboard();
        } catch (e) {
            alert("Errore di eliminazione: " + e.message);
        }
    }
}
function openEditModal(id = null) {
    if (!isAdmin) return;
    editHymnId = id;
    const hymn = id ? hymnsDB.find(h => h.id === id) : null;
    if (id && !hymn) return;
    const { meta, body } = SongTools.splitMeta(hymn ? hymn.content : '');
    document.getElementById('editModalHeading').textContent = hymn ? 'Modifica Cantico' : 'Nuovo Cantico';
    document.getElementById('editHymnTitle').value = hymn ? hymn.title : '';
    document.getElementById('editHymnKey').value = meta.key || '';
    document.getElementById('editHymnTempo').value = meta.tempo || '';
    document.getElementById('editHymnTime').value = meta.time || '';
    document.getElementById('editHymnBody').value = body;
    updateEditPreview();
    document.getElementById('editModal').classList.remove('hidden');
}
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}
function getEditedContent() {
    const key = document.getElementById('editHymnKey').value.trim();
    const tempo = parseInt(document.getElementById('editHymnTempo').value, 10);
    const time = document.getElementById('editHymnTime').value;
    return SongTools.buildContent({
        key: key && SongTools.parseChord(key) ? key : '',
        tempo: tempo >= 30 && tempo <= 240 ? tempo : null,
        time
    }, document.getElementById('editHymnBody').value);
}
function updateEditPreview() {
    const preview = document.getElementById('editHymnPreview');
    if (!preview) return;
    SongTools.render(preview, getEditedContent(), { showChords: true, notation: appSettings.notation });
}
['editHymnBody', 'editHymnKey'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateEditPreview);
});
document.getElementById('newHymnBtn').addEventListener('click', () => openEditModal(null));
document.getElementById('saveEditHymnBtn').onclick = (e) => withBusyButton(e.currentTarget, async () => {
    if (!isAdmin) return;
    const updatedTitle = document.getElementById('editHymnTitle').value.trim();
    const updatedContent = getEditedContent();
    if (!updatedTitle) { alert("Inserisci il titolo del cantico."); return; }
    try {
        if (editHymnId) {
            const { error } = await supabaseClient.from('cantici').update({ title: updatedTitle, content: updatedContent }).eq('id', editHymnId);
            if (error) throw error;
            const i = hymnsDB.findIndex(h => h.id === editHymnId);
            if (i !== -1) { hymnsDB[i].title = updatedTitle; hymnsDB[i].content = updatedContent; }
        } else {
            const newHymn = { id: crypto.randomUUID(), title: updatedTitle, content: updatedContent };
            const { error } = await supabaseClient.from('cantici').insert([newHymn]);
            if (error) throw error;
            hymnsDB.push(newHymn);
            updateDashboard();
        }
        renderHymns();
        if (isReaderOpen() && window.currentHymnId === editHymnId) {
            document.getElementById('currentHymnTitle').textContent = updatedTitle;
            renderCurrentHymn();
        }
        closeEditModal();
    } catch (e) {
        alert("Errore salvataggio cantico: " + e.message);
    }
});

// --- ESPORTAZIONE CANTICI ---
function setupExportButton() {
    const exportBtn = document.getElementById('exportHymnsBtn');
    if (!exportBtn) return;
    exportBtn.addEventListener('click', () => {
        if (hymnsDB.length === 0) {
            alert("Nessun cantico da esportare.");
            return;
        }
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 350px; text-align: center;">
                <h3 style="margin-bottom: 20px;">Esporta Cantici</h3>
                <p style="margin-bottom: 20px; color: var(--text-muted);">Esporta ogni cantico come file XML individuale in uno ZIP</p>
                <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: center;">
                    <button class="btn-secondary" id="cancelExportBtn">Annulla</button>
                    <button class="btn-apple" id="confirmExportBtn">Esporta ZIP</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#cancelExportBtn').onclick = () => modal.remove();
        modal.querySelector('#confirmExportBtn').onclick = () => {
            exportHymnsToZip();
            modal.remove();
        };
    });
}

function exportHymnsToZip() {
    const zip = new JSZip();
    const filtered = getFilteredHymns();
    filtered.forEach((hymn) => {
        // Esportazione del solo testo (senza accordi)
        const blocks = SongTools.lyricSections(hymn.content);
        let formattedContent = '';
        blocks.forEach((section, blockIdx) => {
            const isChorus = section.isChorus;
            const cleanBlock = section.lines.join('\n');
            if (isChorus) {
                formattedContent += `[chór]\n${cleanBlock}\n[/chór]\n\n`;
            } else {
                formattedContent += `[v${blockIdx + 1}]\n${cleanBlock}\n[/v${blockIdx + 1}]\n\n`;
            }
        });
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<song version="1.0">
  <title>${escapeXml(hymn.title)}</title>
  <lyrics>${escapeXml(formattedContent)}</lyrics>
</song>`;
        const filename = `${sanitizeFilename(hymn.title)}.xml`;
        zip.file(filename, xmlContent);
    });
    zip.generateAsync({ type: "blob" }).then(function (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `cantici_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

function sanitizeFilename(filename) {
    return filename.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
}

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        if (c === '<') return '&lt;';
        if (c === '>') return '&gt;';
        if (c === '&') return '&amp;';
        if (c === "'") return '&apos;';
        if (c === '"') return '&quot;';
        return c;
    });
}

// --- IMPOSTAZIONI APP (salvate sul dispositivo) ---
// Accordi: funzione pronta ma in pausa finché i cantici non hanno gli accordi.
// Per attivarla basta mettere true.
const CHORDS_ENABLED = false;
if (!CHORDS_ENABLED) document.body.classList.add('chords-coming-soon');

const DEFAULT_SETTINGS = { theme: 'auto', chordsOn: false, notation: 'it', fontSize: 18, wakeLock: true, metroSound: true, scrollSpeed: 3, toolsOpen: false, hymnColumns: false };

function applyTheme() {
    const root = document.documentElement;
    if (appSettings.theme === 'light' || appSettings.theme === 'dark') root.setAttribute('data-theme', appSettings.theme);
    else root.removeAttribute('data-theme');
}
let appSettings = { ...DEFAULT_SETTINGS };
try { appSettings = { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem('appSettings')) || {}) }; } catch (e) { /* valori predefiniti */ }
let transposeMap = {};
try { transposeMap = JSON.parse(localStorage.getItem('transposeMap')) || {}; } catch (e) { transposeMap = {}; }

function saveSettings() {
    try { localStorage.setItem('appSettings', JSON.stringify(appSettings)); } catch (e) { /* ignora */ }
}
function saveTransposeMap() {
    try { localStorage.setItem('transposeMap', JSON.stringify(transposeMap)); } catch (e) { /* ignora */ }
}

function setupSettingsPanel() {
    const bind = (id, key, type) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (type === 'check') el.checked = !!appSettings[key];
        else el.value = String(appSettings[key]);
        el.addEventListener(type === 'range' ? 'input' : 'change', () => {
            appSettings[key] = type === 'check' ? el.checked : (type === 'text' ? el.value : Number(el.value));
            saveSettings();
            applySettings(key);
        });
    };
    bind('setTheme', 'theme', 'text');
    bind('setChordsOn', 'chordsOn', 'check');
    bind('setNotation', 'notation', 'text');
    bind('setFontSize', 'fontSize', 'number');
    bind('setWakeLock', 'wakeLock', 'check');
    bind('setMetroSound', 'metroSound', 'check');
    bind('setScrollSpeed', 'scrollSpeed', 'range');
    bind('setHymnColumns', 'hymnColumns', 'check');
    applySettings();
}

function applySettings(changedKey) {
    applyTheme();
    Metronome.state.sound = appSettings.metroSound;
    AutoScroll.setSpeed(appSettings.scrollSpeed);
    const speedEl = document.getElementById('scrollSpeed');
    if (speedEl) speedEl.value = appSettings.scrollSpeed;
    const chordsToggle = document.getElementById('chordsToggle');
    if (chordsToggle) chordsToggle.checked = appSettings.chordsOn;
    const setChords = document.getElementById('setChordsOn');
    if (setChords) setChords.checked = appSettings.chordsOn;
    if (changedKey === 'fontSize' || changedKey === undefined) {
        currentHymnFontSize = appSettings.fontSize;
        updateHymnFontSize();
    }
    if (changedKey === 'wakeLock') {
        if (appSettings.wakeLock && isReaderOpen()) requestWakeLock(); else releaseWakeLock();
    }
    if (isReaderOpen()) renderCurrentHymn();
}

// --- SCHERMO SEMPRE ACCESO DURANTE LA LETTURA ---
let wakeLockSentinel = null;
async function requestWakeLock() {
    if (!appSettings.wakeLock || !('wakeLock' in navigator)) return;
    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
    } catch (e) { wakeLockSentinel = null; }
}
function releaseWakeLock() {
    if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isReaderOpen()) requestWakeLock();
});

// --- LETTORE CANTICO CON ACCORDI ---
let currentHymnFontSize = appSettings.fontSize;
window.currentHymnId = null;

function isReaderOpen() {
    const reader = document.getElementById('hymnReaderView');
    return reader && !reader.classList.contains('hidden') && window.currentHymnId;
}

function getHymnTranspose(id) {
    return transposeMap[id] || { t: 0, capo: 0 };
}

function renderCurrentHymn() {
    const hymn = hymnsDB.find(h => h.id === window.currentHymnId);
    if (!hymn) return;
    const textView = document.getElementById('hymnTextView');
    const tr = getHymnTranspose(hymn.id);
    const info = SongTools.render(textView, hymn.content, {
        showChords: CHORDS_ENABLED && appSettings.chordsOn,
        transpose: tr.t,
        capo: tr.capo,
        notation: appSettings.notation
    });
    const reader = document.getElementById('hymnReaderView');
    const chordsShown = CHORDS_ENABLED && appSettings.chordsOn;
    reader.classList.toggle('chords-on', chordsShown && info.hasChords);
    textView.classList.toggle('chords-on', chordsShown && info.hasChords);
    textView.classList.toggle('two-columns', !!appSettings.hymnColumns);
    const colToggle = document.getElementById('hymnColumnsToggle');
    if (colToggle) colToggle.checked = !!appSettings.hymnColumns;
    document.getElementById('chordsMissing').classList.toggle('hidden', !(chordsShown && !info.hasChords));
    document.getElementById('keyDisplay').textContent = info.keyLabel
        ? info.keyLabel + (tr.t ? ` (${tr.t > 0 ? '+' : ''}${tr.t})` : '')
        : '—';
    document.getElementById('capoSelect').value = String(tr.capo);
    return info;
}

function openHymnView(id) {
    const hymn = hymnsDB.find(h => h.id === id);
    if (!hymn) return;
    stopReaderTools();
    window.currentHymnId = id;
    if (typeof trackRecentHymn === 'function') trackRecentHymn(id);
    document.getElementById('hymnsListView').classList.add('hidden');
    document.getElementById('hymnReaderView').classList.remove('hidden');
    document.getElementById('currentHymnTitle').textContent = hymn.title;

    const info = renderCurrentHymn();
    // Il metronomo parte dal BPM e dal tempo indicati nel cantico
    const meta = (info && info.meta) || {};
    Metronome.setBpm(meta.tempo || 80);
    const beats = meta.time ? parseInt(String(meta.time).split('/')[0], 10) : 4;
    Metronome.setBeats([2, 3, 4, 6].includes(beats) ? beats : 4);
    document.getElementById('bpmInput').value = Metronome.state.bpm;
    document.getElementById('timeSelect').value = String(Metronome.state.beats);
    renderBeatDots();

    updateHymnFontSize();
    const textView = document.getElementById('hymnTextView');
    textView.scrollTop = 0;
    const main = document.querySelector('.main-content');
    if (main) main.scrollTop = 0;
    requestWakeLock();
}

function closeHymnView() {
    setToolsMenu(false);
    stopReaderTools();
    releaseWakeLock();
    window.currentHymnId = null;
    document.getElementById('hymnReaderView').classList.add('hidden');
    document.getElementById('hymnsListView').classList.remove('hidden');
}

function stopReaderTools() {
    if (Metronome.state.playing) Metronome.stop();
    if (AutoScroll.state.running) AutoScroll.stop();
    updateMetroButton();
    updateScrollButton();
}

function changeTranspose(delta, reset) {
    const id = window.currentHymnId;
    if (!id) return;
    const tr = { ...getHymnTranspose(id) };
    tr.t = reset ? 0 : ((tr.t + delta + 18) % 12) - 6; // da -6 a +5
    if (reset) tr.capo = 0;
    if (tr.t === 0 && tr.capo === 0) delete transposeMap[id]; else transposeMap[id] = tr;
    saveTransposeMap();
    renderCurrentHymn();
}

function renderBeatDots() {
    const wrap = document.getElementById('metroBeats');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < Metronome.state.beats; i++) {
        const dot = document.createElement('span');
        dot.className = 'metro-dot' + (i === 0 ? ' first' : '');
        wrap.appendChild(dot);
    }
}

function updateMetroButton() {
    const btn = document.getElementById('metroToggle');
    if (!btn) return;
    btn.innerHTML = Metronome.state.playing ? '<i class="ri-stop-fill"></i>' : '<i class="ri-play-fill"></i>';
    btn.classList.toggle('active', Metronome.state.playing);
    if (!Metronome.state.playing) document.querySelectorAll('.metro-dot').forEach(d => d.classList.remove('on'));
}

function updateScrollButton() {
    const btn = document.getElementById('scrollToggle');
    if (!btn) return;
    btn.classList.toggle('active', AutoScroll.state.running);
    btn.innerHTML = AutoScroll.state.running ? '<i class="ri-pause-fill"></i>' : '<i class="ri-arrow-down-double-line"></i>';
}

Metronome.state.onBeat = (beat) => {
    const dots = document.querySelectorAll('#metroBeats .metro-dot');
    dots.forEach((d, i) => d.classList.toggle('on', i === beat));
};
AutoScroll.state.onStop = updateScrollButton;

// Menu "Strumenti musicali" (pulsante ♪ in alto a destra)
let toolsMenuOpen = false;
function applyToolsVisibility() {
    document.getElementById('readerToolbar').classList.toggle('hidden', !toolsMenuOpen);
    const btn = document.getElementById('toolsToggleBtn');
    btn.classList.toggle('is-on', toolsMenuOpen);
    btn.setAttribute('aria-expanded', String(toolsMenuOpen));
}
function setToolsMenu(open) {
    toolsMenuOpen = open;
    applyToolsVisibility();
}

function setupReaderTools() {
    document.getElementById('toolsToggleBtn').onclick = (e) => {
        e.stopPropagation();
        setToolsMenu(!toolsMenuOpen);
    };
    document.getElementById('toolsMenuClose').onclick = () => setToolsMenu(false);
    // Chiude il menu toccando fuori o con Esc (metronomo e scorrimento continuano)
    document.addEventListener('click', (e) => {
        if (toolsMenuOpen && !e.target.closest('.tools-menu-wrap')) setToolsMenu(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && toolsMenuOpen) setToolsMenu(false);
    });
    applyToolsVisibility();
    document.getElementById('hymnColumnsToggle').addEventListener('change', (e) => {
        appSettings.hymnColumns = e.target.checked;
        saveSettings();
        const s = document.getElementById('setHymnColumns');
        if (s) s.checked = appSettings.hymnColumns;
        renderCurrentHymn();
    });
    document.getElementById('chordsToggle').addEventListener('change', (e) => {
        appSettings.chordsOn = e.target.checked;
        saveSettings();
        applySettings('chordsOn');
    });
    document.getElementById('transposeUp').onclick = () => changeTranspose(1);
    document.getElementById('transposeDown').onclick = () => changeTranspose(-1);
    document.getElementById('transposeReset').onclick = () => changeTranspose(0, true);
    document.getElementById('capoSelect').addEventListener('change', (e) => {
        const id = window.currentHymnId;
        if (!id) return;
        const tr = { ...getHymnTranspose(id), capo: parseInt(e.target.value, 10) || 0 };
        if (tr.t === 0 && tr.capo === 0) delete transposeMap[id]; else transposeMap[id] = tr;
        saveTransposeMap();
        renderCurrentHymn();
    });

    document.getElementById('metroToggle').onclick = () => {
        if (Metronome.state.playing) Metronome.stop(); else Metronome.start();
        updateMetroButton();
    };
    const bpmInput = document.getElementById('bpmInput');
    const setBpm = (v) => { Metronome.setBpm(v); bpmInput.value = Metronome.state.bpm; };
    bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
    document.getElementById('bpmUp').onclick = () => setBpm(Metronome.state.bpm + 1);
    document.getElementById('bpmDown').onclick = () => setBpm(Metronome.state.bpm - 1);
    document.getElementById('timeSelect').addEventListener('change', (e) => {
        Metronome.setBeats(e.target.value);
        renderBeatDots();
    });
    let taps = [];
    document.getElementById('tapTempo').onclick = () => {
        const now = performance.now();
        taps = taps.filter(t => now - t < 3000);
        taps.push(now);
        if (taps.length >= 2) {
            const intervals = taps.slice(1).map((t, i) => t - taps[i]).slice(-4);
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            setBpm(60000 / avg);
        }
    };

    document.getElementById('scrollToggle').onclick = () => {
        if (AutoScroll.state.running) AutoScroll.stop();
        else AutoScroll.start(document.getElementById('hymnTextView'));
        updateScrollButton();
    };
    document.getElementById('scrollSpeed').addEventListener('input', (e) => {
        AutoScroll.setSpeed(e.target.value);
        appSettings.scrollSpeed = AutoScroll.state.speed;
        saveSettings();
        const s = document.getElementById('setScrollSpeed');
        if (s) s.value = appSettings.scrollSpeed;
    });

    document.getElementById('addChordsBtn').onclick = () => {
        if (window.currentHymnId) ChordEditor.open(window.currentHymnId);
    };
    document.getElementById('editChordsBtn').onclick = () => {
        if (window.currentHymnId) ChordEditor.open(window.currentHymnId);
    };
}

document.getElementById('increaseHymnFont').onclick = () => {
    if (currentHymnFontSize < 48) {
        currentHymnFontSize += 2;
        updateHymnFontSize();
    }
};
document.getElementById('decreaseHymnFont').onclick = () => {
    if (currentHymnFontSize > 14) {
        currentHymnFontSize -= 2;
        updateHymnFontSize();
    }
};

function updateHymnFontSize() {
    document.getElementById('hymnTextView').style.fontSize = `${currentHymnFontSize}px`;
}

document.getElementById('backToHymns').onclick = closeHymnView;

setupReaderTools();
setupSettingsPanel();

// --- BIBBIA ---
const bibleBooks = [
    { id: 1, name: "Genesi", ch: 50 }, { id: 2, name: "Esodo", ch: 40 }, { id: 3, name: "Levitico", ch: 27 }, { id: 4, name: "Numeri", ch: 36 }, { id: 5, name: "Deuteronomio", ch: 34 },
    { id: 6, name: "Giosuè", ch: 24 }, { id: 7, name: "Giudici", ch: 21 }, { id: 8, name: "Rut", ch: 4 }, { id: 9, name: "1 Samuele", ch: 31 }, { id: 10, name: "2 Samuele", ch: 24 },
    { id: 11, name: "1 Re", ch: 22 }, { id: 12, name: "2 Re", ch: 25 }, { id: 13, name: "1 Cronache", ch: 29 }, { id: 14, name: "2 Cronache", ch: 36 }, { id: 15, name: "Esdra", ch: 10 },
    { id: 16, name: "Neemia", ch: 13 }, { id: 17, name: "Ester", ch: 10 }, { id: 18, name: "Giobbe", ch: 42 }, { id: 19, name: "Salmi", ch: 150 }, { id: 20, name: "Proverbi", ch: 31 },
    { id: 21, name: "Ecclesiaste", ch: 12 }, { id: 22, name: "Cantico", ch: 8 }, { id: 23, name: "Isaia", ch: 66 }, { id: 24, name: "Geremia", ch: 52 }, { id: 25, name: "Lamentazioni", ch: 5 },
    { id: 26, name: "Ezechiele", ch: 48 }, { id: 27, name: "Daniele", ch: 12 }, { id: 28, name: "Osea", ch: 14 }, { id: 29, name: "Gioele", ch: 3 }, { id: 30, name: "Amos", ch: 9 },
    { id: 31, name: "Abdia", ch: 1 }, { id: 32, name: "Giona", ch: 4 }, { id: 33, name: "Michea", ch: 7 }, { id: 34, name: "Naum", ch: 3 }, { id: 35, name: "Abacuc", ch: 3 },
    { id: 36, name: "Sofonia", ch: 3 }, { id: 37, name: "Aggeo", ch: 2 }, { id: 38, name: "Zaccaria", ch: 14 }, { id: 39, name: "Malachia", ch: 4 },
    { id: 40, name: "Matteo", ch: 28 }, { id: 41, name: "Marco", ch: 16 }, { id: 42, name: "Luca", ch: 24 }, { id: 43, name: "Giovanni", ch: 21 }, { id: 44, name: "Atti", ch: 28 },
    { id: 45, name: "Romani", ch: 16 }, { id: 46, name: "1 Corinzi", ch: 16 }, { id: 47, name: "2 Corinzi", ch: 13 }, { id: 48, name: "Galati", ch: 6 }, { id: 49, name: "Efesini", ch: 6 },
    { id: 50, name: "Filippesi", ch: 4 }, { id: 51, name: "Colossesi", ch: 4 }, { id: 52, name: "1 Tessalonicesi", ch: 5 }, { id: 53, name: "2 Tessalonicesi", ch: 3 },
    { id: 54, name: "1 Timoteo", ch: 6 }, { id: 55, name: "2 Timoteo", ch: 4 }, { id: 56, name: "Tito", ch: 3 }, { id: 57, name: "Filemone", ch: 1 }, { id: 58, name: "Ebrei", ch: 13 },
    { id: 59, name: "Giacomo", ch: 5 }, { id: 60, name: "1 Pietro", ch: 5 }, { id: 61, name: "2 Pietro", ch: 3 }, { id: 62, name: "1 Giovanni", ch: 5 }, { id: 63, name: "2 Giovanni", ch: 1 },
    { id: 64, name: "3 Giovanni", ch: 1 }, { id: 65, name: "Giuda", ch: 1 }, { id: 66, name: "Apocalisse", ch: 22 }
];

const bookSelect = document.getElementById('bibleBook');
const chapterSelect = document.getElementById('bibleChapter');
const verseSelect = document.getElementById('bibleVerse');

bibleBooks.forEach(b => bookSelect.add(new Option(b.name, b.id)));
bookSelect.addEventListener('change', () => {
    chapterSelect.innerHTML = '<option value="">Cap</option>';
    const selectedBook = bibleBooks.find(b => b.id.toString() === bookSelect.value);
    for (let i = 1; i <= selectedBook.ch; i++) chapterSelect.add(new Option(i, i));
    chapterSelect.dispatchEvent(new Event('change'));
});
chapterSelect.addEventListener('change', () => {
    verseSelect.innerHTML = '<option value="">Vers</option>';
    if (!chapterSelect.value) return;
    for (let i = 1; i <= 150; i++) verseSelect.add(new Option(i, i));
});
bookSelect.dispatchEvent(new Event('change'));

window.changeChapter = function (direction) {
    const current = parseInt(chapterSelect.value);
    const max = chapterSelect.options.length - 1;
    const next = current + direction;
    if (next >= 1 && next <= max) {
        chapterSelect.value = next;
        verseSelect.value = "";
        document.getElementById('fetchBibleBtn').click();
    }
};

function updateBibleControlsVisibility() {
    const bottomControls = document.getElementById('bibleBottomControls');
    const currentChapterDisplay = document.getElementById('bibleCurrentChapterDisplay').textContent;
    if (currentChapterDisplay && currentChapterDisplay !== 'Capitolo') {
        bottomControls.classList.remove('hidden');
    } else {
        bottomControls.classList.add('hidden');
    }
}

document.getElementById('fetchBibleBtn').addEventListener('click', async () => {
    const version = document.getElementById('bibleVersion').value;
    const bookId = bookSelect.value;
    const bookName = bookSelect.options[bookSelect.selectedIndex].text;
    const chapter = chapterSelect.value;
    const verse = verseSelect.value;
    const reader = document.getElementById('bibleReaderContent');
    if (!chapter) return alert("Seleziona almeno un capitolo.");

    showSpinner(reader);

    try {
        const data = await fetchBibleData(version, bookId, chapter);
        reader.innerHTML = renderBibleChapter(data, { bookId, bookName, chapter, version });
        setReadingImmersive(false);
        if (!verse) document.querySelector('.main-content').scrollTo({ top: 0 });
        updateBibleFontSize();
        document.getElementById('bibleCurrentChapterDisplay').textContent = `${bookName} ${chapter}`;
        updateBibleControlsVisibility();
        // Tocco su un versetto: lo seleziona (sottolineato) e apre la barra delle azioni
        clearVerseSelection();
        bibleChapterInfo = { bookId, bookName, chapter, version };
        reader.querySelectorAll('.bible-verse').forEach(el => {
            el.addEventListener('click', () => toggleVerseSelection(el));
        });
        if (typeof aggiungiRiferimenti === 'function') aggiungiRiferimenti(reader, bookId, chapter);
        if (verse) {
            setTimeout(() => {
                const targetVerse = document.getElementById(`verse-${verse}`);
                if (targetVerse) {
                    targetVerse.scrollIntoView({ behavior: "smooth", block: "center" });
                    const originalBg = targetVerse.style.background;
                    targetVerse.style.background = "rgba(0, 122, 255, 0.2)";
                    setTimeout(() => targetVerse.style.background = originalBg, 1500);
                }
            }, 200);
        }
    } catch (error) {
        console.error("Errore Bibbia:", error);
        reader.innerHTML = `<div style="text-align:center;"><p style="color:var(--danger-color); font-weight:bold;">Errore di Rete.</p><p style="color:var(--text-muted); font-size:16px;">${error.message}</p></div>`;
    }
});

// --- LETTURA DELLA BIBBIA: versetti di seguito, come in una Bibbia stampata ---
// Dal testo di un versetto separa: titolo di paragrafo, riferimenti/note e testo.
// Le fonti attuali danno solo il testo; titoli e riferimenti compaiono se una fonte li fornisce.
function splitBibleVerse(v) {
    const raw = String(v.text || '');
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    let heading = String(v.title || v.heading || '').trim();
    doc.body.querySelectorAll('h, h1, h2, h3, h4, title, .heading, [class*="title"]').forEach(el => {
        if (!heading) heading = el.textContent.trim();
        el.remove();
    });
    const refs = [];
    doc.body.querySelectorAll('sup, .footnote, .crossref, note, [class*="ref"]').forEach(el => {
        const t = el.textContent.trim();
        if (t && !/^\d+$/.test(t)) refs.push(t);
        el.remove();
    });
    if (v.comment) {
        const c = new DOMParser().parseFromString(String(v.comment), 'text/html').body.textContent.trim();
        if (c) refs.push(c);
    }
    // Un "a capo" nel testo indica l'inizio di un nuovo paragrafo
    const newParagraph = /^\s*<br\s*\/?>/i.test(raw) || /¶/.test(raw);
    const text = doc.body.textContent.replace(/¶/g, '').replace(/\s+/g, ' ').trim();
    return { heading, refs, text, newParagraph };
}

function renderBibleChapter(data, { bookId, bookName, chapter, version }) {
    const versionName = document.querySelector(`#bibleVersion option[value="${version}"]`)?.textContent || '';
    let html = `<header class="bible-chapter-head"><h2>${escapeHtml(bookName)} ${escapeHtml(String(chapter))}</h2><span>${escapeHtml(versionName)}</span></header>`;
    let paragraphOpen = false;
    const openParagraph = () => { html += '<p class="bible-paragraph">'; paragraphOpen = true; };
    const closeParagraph = () => { if (paragraphOpen) html += '</p>'; paragraphOpen = false; };

    data.forEach((v, i) => {
        const part = splitBibleVerse(v);
        if (part.heading) {
            closeParagraph();
            html += `<h3 class="bible-heading">${escapeHtml(part.heading)}</h3>`;
        }
        if (!paragraphOpen || (part.newParagraph && i > 0)) { closeParagraph(); openParagraph(); }
        const text = escapeHtml(part.text);
        const hl = highlightsDB.find(h => h.book == bookId && h.chapter == chapter && h.verse == v.verse);
        html += `<span class="bible-verse${hl ? ' highlighted' : ''}"${hl ? ` data-hl="${escapeHtml(hl.color || 'yellow')}"` : ''} id="verse-${v.verse}" data-book="${bookId}" data-bookname="${escapeHtml(bookName)}" data-chapter="${chapter}" data-verse="${v.verse}" data-text="${text}">`
            + `<sup class="bible-verse-num">${escapeHtml(String(v.verse))}</sup>${text}`
            + (part.refs.length ? `<span class="bible-refs">${part.refs.map(escapeHtml).join(' · ')}</span>` : '')
            + `</span> `;
    });
    closeParagraph();
    return `<div class="bible-text">${html}</div>`;
}

// --- SELEZIONE DEI VERSETTI ---
// Tocco: il versetto viene sottolineato; si possono sceglierne altri.
// La barra in basso permette di evidenziare (5 colori), copiare, condividere,
// creare un'immagine o aggiungere i versetti a un appunto.
const HIGHLIGHT_COLORS = [
    { id: 'yellow', name: 'Giallo' },
    { id: 'green', name: 'Verde' },
    { id: 'blue', name: 'Azzurro' },
    { id: 'pink', name: 'Rosa' },
    { id: 'orange', name: 'Arancio' }
];
let bibleChapterInfo = null;
const selectedVerses = new Set();

function selectedVerseEls() {
    return [...selectedVerses]
        .map(v => document.getElementById(`verse-${v}`))
        .filter(Boolean)
        .sort((a, b) => Number(a.dataset.verse) - Number(b.dataset.verse));
}

// "16-18, 20" a partire dai numeri dei versetti
function formatVerseRanges(nums) {
    const sorted = [...nums].map(Number).sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
        i = j;
    }
    return parts.join(', ');
}

function selectionInfo() {
    const els = selectedVerseEls();
    if (!els.length || !bibleChapterInfo) return null;
    const ref = `${bibleChapterInfo.bookName} ${bibleChapterInfo.chapter}:${formatVerseRanges(els.map(e => e.dataset.verse))}`;
    const text = els.map(e => new DOMParser().parseFromString(e.dataset.text, 'text/html').body.textContent).join(' ');
    const versionName = document.querySelector(`#bibleVersion option[value="${bibleChapterInfo.version}"]`)?.textContent || '';
    return { els, ref, text, versionName };
}

function toggleVerseSelection(el) {
    const v = el.dataset.verse;
    if (selectedVerses.has(v)) selectedVerses.delete(v); else selectedVerses.add(v);
    el.classList.toggle('selected', selectedVerses.has(v));
    updateVerseActionBar();
}

function clearVerseSelection() {
    selectedVerses.clear();
    document.querySelectorAll('.bible-verse.selected').forEach(e => e.classList.remove('selected'));
    updateVerseActionBar();
}

function updateVerseActionBar() {
    const bar = document.getElementById('verseActionBar');
    if (!bar) return;
    const info = selectionInfo();
    const open = !!info;
    bar.classList.toggle('open', open);
    document.body.classList.toggle('verse-selecting', open);
    if (!open) return;
    document.getElementById('verseActionRef').textContent = info.ref;
    // colore attivo se tutti i versetti scelti hanno lo stesso
    const colors = new Set(info.els.map(e => e.dataset.hl || ''));
    const current = colors.size === 1 ? [...colors][0] : '';
    bar.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color === current));
    bar.querySelector('[data-act="unhighlight"]').hidden = ![...colors].some(Boolean);
}

function highlightSelection(color) {
    const info = selectionInfo();
    if (!info) return;
    const { bookId, bookName, chapter } = bibleChapterInfo;
    info.els.forEach(el => {
        const v = el.dataset.verse;
        highlightsDB = highlightsDB.filter(h => !(h.book == bookId && h.chapter == chapter && h.verse == v));
        if (color) {
            highlightsDB.push({ book: String(bookId), bookName, chapter: String(chapter), verse: String(v),
                text: new DOMParser().parseFromString(el.dataset.text, 'text/html').body.textContent, color, id: Date.now() + Number(v) });
            el.classList.add('highlighted');
            el.dataset.hl = color;
        } else {
            el.classList.remove('highlighted');
            delete el.dataset.hl;
        }
    });
    localStorage.setItem('highlightsDB', JSON.stringify(highlightsDB));
    renderHighlights();
    updateDashboard();
    clearVerseSelection();
}

async function handleVerseAction(act) {
    const info = selectionInfo();
    if (!info) return;
    const quoted = `“${info.text}”\n— ${info.ref}${info.versionName ? ` (${info.versionName})` : ''}`;
    if (act === 'copy') {
        showVerseToast(await copyText(quoted) ? 'Copiato' : 'Copia non riuscita');
        clearVerseSelection();
    } else if (act === 'share') {
        await shareContent(info.ref, quoted);
        clearVerseSelection();
    } else if (act === 'image') {
        clearVerseSelection();
        if (typeof openShareVerseModal === 'function') openShareVerseModal({ text: info.text, ref: info.ref, kicker: 'Parola di Dio' });
    } else if (act === 'note') {
        clearVerseSelection();
        insertIntoNote(`> "${info.text}"\n> [${info.ref}]`);
    } else if (act === 'project') {
        // un versetto per diapositiva, con sfondi e stile della proiezione
        const verses = info.els.map(e => ({ num: e.dataset.verse, text: new DOMParser().parseFromString(e.dataset.text, 'text/html').body.textContent.trim() }));
        clearVerseSelection();
        askPresentationMode('bibbia', null, { verses, book: bibleChapterInfo.bookName, chapter: bibleChapterInfo.chapter, version: info.versionName, title: info.ref });
    } else if (act === 'unhighlight') {
        highlightSelection(null);
    } else if (act === 'close') {
        clearVerseSelection();
    }
}

// Copia negli appunti: metodo moderno, con quello classico come riserva
async function copyText(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) { /* si prova il metodo classico */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
}

let verseToastTimer = null;
function showVerseToast(message) {
    const t = document.getElementById('verseToast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(verseToastTimer);
    verseToastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

(function setupVerseActionBar() {
    const bar = document.getElementById('verseActionBar');
    if (!bar) return;
    const colors = bar.querySelector('.verse-colors');
    colors.innerHTML = HIGHLIGHT_COLORS.map(c => `<button type="button" class="hl-dot hl-${c.id}" data-color="${c.id}" title="Evidenzia: ${c.name}" aria-label="Evidenzia in ${c.name}"></button>`).join('');
    colors.querySelectorAll('[data-color]').forEach(b => { b.onclick = () => highlightSelection(b.dataset.color); });
    bar.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => handleVerseAction(b.dataset.act); });
    // Esc o cambio di sezione: si annulla la selezione
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selectedVerses.size) clearVerseSelection(); });
    document.querySelectorAll('.nav-item[data-target]').forEach(n => n.addEventListener('click', () => { if (selectedVerses.size) clearVerseSelection(); }));
})();

// --- IMPOSTAZIONI DI LETTURA DELLA BIBBIA ---
const BIBLE_FONTS = [
    { id: 'serif', name: 'Classico (con grazie)', css: '"Lora", Georgia, "Times New Roman", serif' },
    { id: 'system', name: 'Sistema (stile Apple)', css: 'var(--font)' },
    { id: 'playfair', name: 'Elegante', css: '"Playfair Display", Georgia, serif' },
    { id: 'montserrat', name: 'Moderno', css: '"Montserrat", "Inter", sans-serif' }
];
const BIBLE_THEMES = [
    { id: 'default', name: 'Normale' },
    { id: 'sepia', name: 'Carta' },
    { id: 'night', name: 'Notte' }
];
const DEFAULT_BIBLE_PREFS = { font: 'serif', size: 20, lineHeight: 1.75, numbers: true, justify: false, theme: 'default', crossrefs: true };
function getBiblePrefs() {
    return { ...DEFAULT_BIBLE_PREFS, ...(appSettings.bible || {}) };
}
function saveBiblePrefs(prefs) {
    appSettings.bible = prefs;
    saveSettings();
}
let currentBibleFontSize = getBiblePrefs().size;

function applyBiblePrefs() {
    const prefs = getBiblePrefs();
    currentBibleFontSize = prefs.size;
    const card = document.querySelector('#bibbia .bible-card');
    const reader = document.getElementById('bibleReaderContent');
    if (!card || !reader) return;
    if (prefs.font !== 'system') {
        // Carica i caratteri solo quando servono
        if (typeof ensureProjFonts === 'function') ensureProjFonts();
    }
    reader.style.setProperty('--bible-font', (BIBLE_FONTS.find(f => f.id === prefs.font) || BIBLE_FONTS[0]).css);
    reader.style.setProperty('--bible-line', String(prefs.lineHeight));
    reader.style.fontSize = `${prefs.size}px`;
    reader.classList.toggle('no-verse-numbers', !prefs.numbers);
    reader.classList.toggle('justify', !!prefs.justify);
    reader.classList.toggle('no-xrefs', prefs.crossrefs === false);
    card.dataset.theme = prefs.theme;
}

function updateBibleFontSize() {
    const prefs = getBiblePrefs();
    prefs.size = currentBibleFontSize;
    saveBiblePrefs(prefs);
    applyBiblePrefs();
    const range = document.querySelector('#bibleSettingsMenu [data-b="size"]');
    if (range) { range.value = String(prefs.size); const l = document.querySelector('#bibleSettingsMenu [data-size-label]'); if (l) l.textContent = prefs.size + 'px'; }
}
document.getElementById('increaseBibleFont').onclick = () => { if (currentBibleFontSize < 40) currentBibleFontSize += 2; updateBibleFontSize(); };
document.getElementById('decreaseBibleFont').onclick = () => { if (currentBibleFontSize > 14) currentBibleFontSize -= 2; updateBibleFontSize(); };

function renderBibleSettings(menu) {
    const p = getBiblePrefs();
    menu.innerHTML = `
        <div class="bible-menu-title">Impostazioni di lettura</div>
        <label class="ps-field"><span>Carattere</span>
            <select class="apple-select" data-b="font">${BIBLE_FONTS.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}</select>
        </label>
        <label class="ps-field"><span>Grandezza <b data-size-label>${p.size}px</b></span>
            <input type="range" min="14" max="40" step="1" data-b="size">
        </label>
        <div class="ps-field"><span>Interlinea</span>
            <div class="segmented bible-seg" data-b="lineHeight">
                <button type="button" class="favorites-tab" data-v="1.5">Stretta</button>
                <button type="button" class="favorites-tab" data-v="1.75">Normale</button>
                <button type="button" class="favorites-tab" data-v="2.05">Ampia</button>
            </div>
        </div>
        <div class="ps-field"><span>Pagina</span>
            <div class="segmented bible-seg" data-b="theme">
                ${BIBLE_THEMES.map(t => `<button type="button" class="favorites-tab" data-v="${t.id}">${t.name}</button>`).join('')}
            </div>
        </div>
        <div class="ps-toggles">
            <label class="ps-check"><input type="checkbox" data-b="numbers"> Numeri dei versetti</label>
            <label class="ps-check"><input type="checkbox" data-b="justify"> Giustificato</label>
            <label class="ps-check"><input type="checkbox" data-b="crossrefs"> Riferimenti incrociati</label>
        </div>`;
    const set = (key, value) => {
        const prefs = getBiblePrefs();
        prefs[key] = value;
        saveBiblePrefs(prefs);
        applyBiblePrefs();
    };
    const font = menu.querySelector('[data-b="font"]');
    font.value = p.font;
    font.onchange = () => set('font', font.value);
    const size = menu.querySelector('[data-b="size"]');
    size.value = String(p.size);
    size.oninput = () => { menu.querySelector('[data-size-label]').textContent = size.value + 'px'; set('size', Number(size.value)); };
    menu.querySelectorAll('.bible-seg').forEach(seg => {
        const key = seg.dataset.b;
        const current = String(p[key]);
        seg.querySelectorAll('[data-v]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.v === current);
            btn.onclick = () => {
                seg.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('active', b === btn));
                set(key, key === 'lineHeight' ? Number(btn.dataset.v) : btn.dataset.v);
            };
        });
    });
    ['numbers', 'justify', 'crossrefs'].forEach(key => {
        const box = menu.querySelector(`[data-b="${key}"]`);
        box.checked = !!p[key];
        box.onchange = () => set(key, box.checked);
    });
}

(function setupBibleSettings() {
    const btn = document.getElementById('bibleSettingsBtn');
    const menu = document.getElementById('bibleSettingsMenu');
    if (!btn || !menu) return;
    const close = () => { menu.classList.add('hidden'); btn.classList.remove('is-on'); btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = (e) => {
        e.stopPropagation();
        if (menu.classList.contains('hidden')) {
            renderBibleSettings(menu);
            menu.classList.remove('hidden');
            btn.classList.add('is-on');
            btn.setAttribute('aria-expanded', 'true');
        } else close();
    };
    menu.onclick = (e) => e.stopPropagation();
    document.addEventListener('click', () => { if (!menu.classList.contains('hidden')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.classList.contains('hidden')) close(); });
    applyBiblePrefs();
    // i caratteri vengono caricati da projection.js: si riapplica a pagina pronta
    window.addEventListener('load', applyBiblePrefs);
})();

// --- LETTURA A SCHERMO PIENO ---
// Scorrendo in giù si nascondono intestazione, barra di navigazione e barra del capitolo;
// scorrendo in su (o arrivando in cima / in fondo al capitolo) ricompaiono.
function setReadingImmersive(on) {
    if (document.body.classList.contains('reading-immersive') === on) return;
    document.body.classList.toggle('reading-immersive', on);
    if (on) {
        const menu = document.getElementById('bibleSettingsMenu');
        if (menu && !menu.classList.contains('hidden')) document.body.click();
    }
}
(function setupImmersiveBible() {
    const main = document.querySelector('.main-content');
    const section = document.getElementById('bibbia');
    const bar = document.querySelector('#bibleProgress span');
    if (!main || !section) return;
    let lastY = main.scrollTop;
    const update = () => {
        const y = main.scrollTop;
        const max = main.scrollHeight - main.clientHeight;
        const hasText = !!document.querySelector('#bibleReaderContent .bible-verse');
        if (!section.classList.contains('active') || !hasText) {
            setReadingImmersive(false);
            if (bar) bar.style.transform = 'scaleX(0)';
            lastY = y;
            return;
        }
        const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        if (bar) bar.style.transform = 'scaleX(' + progress + ')';
        const dy = y - lastY;
        if (y < 80 || y > max - 60) setReadingImmersive(false);      // in cima o in fondo: comandi visibili
        else if (dy > 6) setReadingImmersive(true);                  // scorre in giù: solo testo
        else if (dy < -10) setReadingImmersive(false);               // scorre in su: tornano i comandi
        if (Math.abs(dy) > 6 || y < 80 || y > max - 60) lastY = y;
    };
    main.addEventListener('scroll', update, { passive: true });
    window.updateReadingImmersive = update;
})();

// --- APPUNTI ---
let activeNoteId = null;
let currentEditingNoteId = null;
let notesSearch = '';
let notesFilter = 'all';

const NOTE_CATEGORIES = [
    { id: 'Predica', icon: 'ri-mic-line', tone: 'blue' },
    { id: 'Studio Biblico', icon: 'ri-book-open-line', tone: 'green' },
    { id: 'Riunione Giovani', icon: 'ri-group-line', tone: 'orange' },
    { id: 'Nota', icon: 'ri-sticky-note-line', tone: 'purple' }
];
function noteCategory(name) {
    return NOTE_CATEGORIES.find(c => c.id === name) || NOTE_CATEGORIES[NOTE_CATEGORIES.length - 1];
}
function noteCatId(n) {
    return NOTE_CATEGORIES.some(c => c.id === n.category) ? n.category : 'Nota';
}
function noteDate(n) {
    const d = n.updated_at ? new Date(n.updated_at) : null;
    return d && !isNaN(d) ? d : null;
}
function formatNoteDate(d, long) {
    if (!d) return '';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (!long && sameDay) return 'Oggi, ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('it-IT', long
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
// Testo semplice senza simboli di formattazione (per anteprima, ricerca, condivisione)
function notePlainText(body) {
    return String(body || '')
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/^>\s?/gm, '')
        .replace(/^[-•]\s+/gm, '• ');
}

// Formattazione leggera: # titolo, **grassetto**, *corsivo*, - elenco, > citazione, [Giovanni 3:16]
function renderNoteBody(body) {
    const lines = escapeHtml(String(body || '')).split('\n');
    let html = '';
    let list = false;
    const inline = s => s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]\n]{3,40}?\s\d{1,3}:\d{1,3}(?:-\d{1,3})?)\]/g, '<span class="note-verse-ref"><i class="ri-book-open-line"></i> $1</span>');
    const closeList = () => { if (list) { html += '</ul>'; list = false; } };
    lines.forEach(line => {
        if (/^###?\s+/.test(line)) { closeList(); html += `<h4>${inline(line.replace(/^###?\s+/, ''))}</h4>`; }
        else if (/^#\s+/.test(line)) { closeList(); html += `<h3>${inline(line.replace(/^#\s+/, ''))}</h3>`; }
        else if (/^(-|•)\s+/.test(line)) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(line.replace(/^(-|•)\s+/, ''))}</li>`; }
        else if (/^&gt;\s?/.test(line)) { closeList(); html += `<blockquote>${inline(line.replace(/^&gt;\s?/, ''))}</blockquote>`; }
        else if (!line.trim()) { closeList(); html += '<div class="note-gap"></div>'; }
        else { closeList(); html += `<p>${inline(line)}</p>`; }
    });
    closeList();
    return html;
}

function getFilteredNotes() {
    const term = normalizeSearch(notesSearch).trim();
    return [...notesDB]
        .filter(n => notesFilter === 'all' || noteCatId(n) === notesFilter)
        .filter(n => !term || normalizeSearch([n.title, n.speaker, n.refs, n.body, n.category].join(' ')).includes(term))
        .sort((a, b) => (noteDate(b) || 0) - (noteDate(a) || 0));
}

function renderNotes() {
    const ul = document.getElementById('notesUl');
    if (!ul) return;
    // Conteggi per i filtri
    document.querySelectorAll('#notesFilters [data-filter]').forEach(btn => {
        const f = btn.dataset.filter;
        const count = f === 'all' ? notesDB.length : notesDB.filter(n => noteCatId(n) === f).length;
        const badge = btn.querySelector('.count');
        if (badge) badge.textContent = count;
        btn.classList.toggle('active', f === notesFilter);
    });
    const countEl = document.getElementById('notesCount');
    if (countEl) countEl.textContent = notesDB.length === 1 ? '1 appunto' : `${notesDB.length} appunti`;

    const notes = getFilteredNotes();
    ul.innerHTML = '';
    if (!notes.length) {
        ul.innerHTML = notesDB.length
            ? '<li class="notes-empty"><i class="ri-search-line"></i><strong>Nessun risultato</strong><span>Prova con un\'altra parola o cambia filtro.</span></li>'
            : '<li class="notes-empty"><i class="ri-quill-pen-line"></i><strong>Nessun appunto</strong><span>Prendi nota di prediche e studi biblici: li ritrovi qui, su tutti i tuoi dispositivi.</span><button class="btn-apple" onclick="openNoteModal()"><i class="ri-add-line"></i> Nuovo appunto</button></li>';
        return;
    }
    notes.forEach(n => {
        const cat = noteCategory(n.category);
        const li = document.createElement('li');
        li.className = 'note-card';
        li.tabIndex = 0;
        const preview = notePlainText(n.body).replace(/\s+/g, ' ').trim();
        const meta = [n.speaker ? `<span><i class="ri-user-voice-line"></i> ${escapeHtml(n.speaker)}</span>` : '',
                      n.refs ? `<span><i class="ri-book-mark-line"></i> ${escapeHtml(n.refs)}</span>` : ''].join('');
        li.innerHTML = `
            <div class="note-card-top">
                <span class="note-cat tone-${cat.tone}"><i class="${cat.icon}"></i> ${escapeHtml(n.category || 'Nota')}</span>
                <span class="note-date">${escapeHtml(formatNoteDate(noteDate(n)))}</span>
            </div>
            <h3 class="note-card-title">${escapeHtml(n.title || 'Senza titolo')}</h3>
            ${meta ? `<div class="note-card-meta">${meta}</div>` : ''}
            ${preview ? `<p class="note-card-preview">${escapeHtml(preview.slice(0, 220))}</p>` : ''}
            <button class="note-card-delete" title="Elimina" onclick="event.stopPropagation(); deleteNoteFromList('${escapeHtml(n.id)}')"><i class="ri-delete-bin-line"></i></button>`;
        li.onclick = () => openNoteViewModal(n);
        li.onkeydown = (e) => { if (e.key === 'Enter') openNoteViewModal(n); };
        ul.appendChild(li);
    });
}

async function deleteNoteFromList(id) {
    const note = notesDB.find(n => n.id === id);
    if (!confirm(`Eliminare l'appunto "${note && note.title ? note.title : 'Senza titolo'}"? Non si potrà recuperare.`)) return false;
    const { error } = await supabaseClient.from('appunti').delete().eq('id', id);
    if (error) { alert('Errore durante l\'eliminazione: ' + error.message); return false; }
    notesDB = notesDB.filter(n => n.id !== id);
    localStorage.setItem('notesDB', JSON.stringify(notesDB));
    if (activeNoteId === id) activeNoteId = null;
    renderNotes();
    updateDashboard();
    return true;
}

function setupNotesToolbar() {
    const search = document.getElementById('notesSearch');
    if (search) search.addEventListener('input', () => { notesSearch = search.value; renderNotes(); });
    document.querySelectorAll('#notesFilters [data-filter]').forEach(btn => {
        btn.onclick = () => { notesFilter = btn.dataset.filter; renderNotes(); };
    });
}

// --- VERSETTI EVIDENZIATI ---
function renderHighlights() {
    const ul = document.getElementById('highlightsUl');
    if (!ul) return;
    ul.innerHTML = '';
    const countEl = document.getElementById('highlightsCount');
    if (countEl) countEl.textContent = highlightsDB.length;
    if (highlightsDB.length === 0) {
        ul.innerHTML = '<li class="notes-empty notes-empty-small"><i class="ri-mark-pen-line"></i><span>Tocca un versetto nella Bibbia per evidenziarlo: lo ritrovi qui.</span></li>';
        return;
    }
    [...highlightsDB].reverse().forEach(h => {
        const li = document.createElement('li');
        li.className = 'highlight-card';
        li.dataset.hl = h.color || 'yellow';
        const ref = `${h.bookName} ${h.chapter}:${h.verse}`;
        li.innerHTML = `
            <div class="highlight-ref">${escapeHtml(ref)}</div>
            <p class="highlight-text">${escapeHtml(h.text)}</p>
            <div class="highlight-actions">
                <button data-act="insert" class="hl-insert" title="Inserisci nell'appunto aperto"><i class="ri-add-line"></i> Inserisci</button>
                <button data-act="copy" title="Copia"><i class="ri-file-copy-line"></i></button>
                <button data-act="open" title="Apri nella Bibbia"><i class="ri-book-open-line"></i></button>
                <button data-act="remove" title="Rimuovi"><i class="ri-close-line"></i></button>
            </div>`;
        li.querySelectorAll('[data-act]').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const act = btn.dataset.act;
                if (act === 'insert') insertIntoNote(`> "${h.text}"\n> [${ref}]`);
                if (act === 'copy') {
                    try { await navigator.clipboard.writeText(`"${h.text}" — ${ref}`); flashHighlight(btn); } catch (err) { /* ignora */ }
                }
                if (act === 'open') openHighlightInBible(h);
                if (act === 'remove') {
                    highlightsDB = highlightsDB.filter(x => !(x.book == h.book && x.chapter == h.chapter && x.verse == h.verse));
                    localStorage.setItem('highlightsDB', JSON.stringify(highlightsDB));
                    document.getElementById(`verse-${h.verse}`)?.classList.remove('highlighted');
                    renderHighlights();
                    updateDashboard();
                }
            };
        });
        ul.appendChild(li);
    });
}
function flashHighlight(btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="ri-check-line"></i>';
    setTimeout(() => { btn.innerHTML = original; }, 1200);
}
function openHighlightInBible(h) {
    document.querySelector('.nav-item[data-target="bibbia"]')?.click();
    bookSelect.value = String(h.book);
    bookSelect.dispatchEvent(new Event('change'));
    chapterSelect.value = String(h.chapter);
    chapterSelect.dispatchEvent(new Event('change'));
    verseSelect.value = String(h.verse);
    document.getElementById('fetchBibleBtn').click();
}

// --- LETTURA DI UN APPUNTO ---
function openNoteViewModal(note) {
    activeNoteId = note.id;
    const cat = noteCategory(note.category);
    document.getElementById('viewNoteTitle').textContent = note.title || 'Senza titolo';
    document.getElementById('viewNoteCategory').innerHTML = `<span class="note-cat tone-${cat.tone}"><i class="${cat.icon}"></i> ${escapeHtml(note.category || 'Nota')}</span>`
        + (noteDate(note) ? `<span class="note-view-date">${escapeHtml(formatNoteDate(noteDate(note), true))}</span>` : '');
    document.getElementById('viewNoteSpeaker').innerHTML = note.speaker ? `<i class="ri-user-voice-line"></i> ${escapeHtml(note.speaker)}` : '';
    document.getElementById('viewNoteRefs').innerHTML = note.refs ? `<i class="ri-book-mark-line"></i> ${escapeHtml(note.refs)}` : '';
    const body = document.getElementById('viewNoteBody');
    body.innerHTML = note.body ? renderNoteBody(note.body) : '<p class="text-muted">Nessun contenuto.</p>';
    document.getElementById('editNoteFromViewBtn').onclick = () => { closeNoteViewModal(); openNoteModal(note); };
    document.getElementById('printNoteFromViewBtn').onclick = () => printNote(note);
    document.getElementById('shareNoteFromViewBtn').onclick = () => {
        const parts = [note.title, [note.speaker, note.refs].filter(Boolean).join(' · '), notePlainText(note.body)].filter(Boolean);
        shareContent(note.title || 'Appunto', parts.slice(1).join('\n\n'));
    };
    document.getElementById('deleteNoteFromViewBtn').onclick = async () => {
        if (await deleteNoteFromList(note.id)) closeNoteViewModal();
    };
    document.getElementById('noteViewModal').classList.remove('hidden');
}

function closeNoteViewModal() {
    document.getElementById('noteViewModal').classList.add('hidden');
}

// Stampa / salva come PDF con impaginazione pulita
function printNote(note) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Il popup è stato bloccato. Consenti i popup per stampare.'); return; }
    const meta = [escapeHtml(note.category || 'Nota'), note.speaker ? escapeHtml(note.speaker) : '', note.refs ? escapeHtml(note.refs) : '',
                  noteDate(note) ? escapeHtml(formatNoteDate(noteDate(note), true)) : ''].filter(Boolean).join(' · ');
    printWindow.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>${escapeHtml(note.title || 'Appunto')}</title>
        <style>
            @page { margin: 22mm 20mm; }
            body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 24px; line-height: 1.65; font-size: 12pt; }
            header { border-bottom: 2px solid #007aff; padding-bottom: 12px; margin-bottom: 22px; }
            .kicker { font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #007aff; font-weight: 700; }
            h1 { font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 22pt; margin: 6px 0 6px; }
            .meta { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #666; font-size: 10pt; }
            h3 { font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 14pt; margin: 18px 0 6px; }
            h4 { font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 12pt; margin: 14px 0 4px; }
            p { margin: 0 0 6px; }
            ul { margin: 4px 0 8px 20px; padding: 0; }
            blockquote { margin: 8px 0; padding: 6px 14px; border-left: 3px solid #ff9500; background: #fff7ec; font-style: italic; }
            .note-gap { height: 8px; }
            .note-verse-ref { font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 10pt; color: #007aff; font-weight: 600; }
            .note-verse-ref i { display: none; }
            footer { margin-top: 36px; padding-top: 10px; border-top: 1px solid #ddd; font-family: -apple-system, "Segoe UI", Arial, sans-serif; font-size: 9pt; color: #999; }
        </style></head><body>
        <header><div class="kicker">Appunto</div><h1>${escapeHtml(note.title || 'Senza titolo')}</h1><div class="meta">${meta}</div></header>
        <main>${renderNoteBody(note.body)}</main>
        <footer>Open Worship</footer>
        </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
    setTimeout(() => { try { printWindow.print(); } catch (e) { /* già stampato */ } }, 600);
}

// --- EDITOR ---
const NOTE_DRAFT_KEY = 'noteDraft';
function noteFields() {
    return {
        title: document.getElementById('modalNoteTitle'),
        category: document.getElementById('modalNoteCategory'),
        speaker: document.getElementById('modalNoteSpeaker'),
        refs: document.getElementById('modalNoteRefs'),
        body: document.getElementById('modalNoteBody')
    };
}
function updateNoteWordCount() {
    const f = noteFields();
    const words = (f.body.value.match(/\S+/g) || []).length;
    const el = document.getElementById('noteWordCount');
    if (el) el.textContent = words === 1 ? '1 parola' : `${words} parole`;
}
function saveNoteDraft() {
    const f = noteFields();
    const draft = { id: currentEditingNoteId, title: f.title.value, category: f.category.value, speaker: f.speaker.value, refs: f.refs.value, body: f.body.value, at: Date.now() };
    try { localStorage.setItem(NOTE_DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignora */ }
    const st = document.getElementById('noteSaveState');
    if (st) st.textContent = 'Bozza salvata sul dispositivo';
}
function clearNoteDraft() {
    try { localStorage.removeItem(NOTE_DRAFT_KEY); } catch (e) { /* ignora */ }
}

function openNoteModal(note = null) {
    const modal = document.getElementById('noteModal');
    const f = noteFields();
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem(NOTE_DRAFT_KEY) || 'null'); } catch (e) { draft = null; }
    const draftMatches = draft && (draft.id || null) === (note ? note.id : null) && (draft.body || draft.title);
    currentEditingNoteId = note ? note.id : null;
    document.getElementById('noteModalTitle').textContent = note ? 'Modifica appunto' : 'Nuovo appunto';
    const src = draftMatches ? draft : (note || {});
    f.title.value = src.title || '';
    f.category.value = NOTE_CATEGORIES.some(c => c.id === src.category) ? src.category : 'Predica';
    f.speaker.value = src.speaker || '';
    f.refs.value = src.refs || '';
    f.body.value = src.body || '';
    const st = document.getElementById('noteSaveState');
    if (st) st.textContent = draftMatches ? 'Bozza recuperata' : '';
    updateNoteWordCount();
    modal.classList.remove('hidden');
    setTimeout(() => (note ? f.body : f.title).focus(), 50);
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
    currentEditingNoteId = null;
}

// Inserisce testo nell'appunto aperto, oppure ne apre uno nuovo con quel testo
function insertIntoNote(text) {
    const modal = document.getElementById('noteModal');
    if (modal.classList.contains('hidden')) {
        openNoteModal();
        clearNoteDraft();
        noteFields().body.value = text + '\n';
        updateNoteWordCount();
        return;
    }
    const body = noteFields().body;
    const start = body.selectionStart ?? body.value.length;
    const before = body.value.slice(0, start);
    const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    body.setRangeText(pad + text + '\n', start, body.selectionEnd ?? start, 'end');
    body.focus();
    updateNoteWordCount();
    saveNoteDraft();
}

// Pulsanti di formattazione
function applyNoteFormat(kind) {
    const body = noteFields().body;
    const s = body.selectionStart, e = body.selectionEnd;
    const sel = body.value.slice(s, e);
    const wrap = (l, r, placeholder) => {
        const inner = sel || placeholder;
        body.setRangeText(l + inner + r, s, e, 'select');
        body.setSelectionRange(s + l.length, s + l.length + inner.length);
    };
    const linePrefix = (prefix) => {
        const lineStart = body.value.lastIndexOf('\n', s - 1) + 1;
        const block = body.value.slice(lineStart, e);
        const lines = block.split('\n').map(l => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l));
        body.setRangeText(lines.join('\n'), lineStart, e, 'end');
    };
    if (kind === 'bold') wrap('**', '**', 'testo in grassetto');
    if (kind === 'italic') wrap('*', '*', 'testo in corsivo');
    if (kind === 'heading') linePrefix('# ');
    if (kind === 'list') linePrefix('- ');
    if (kind === 'quote') linePrefix('> ');
    if (kind === 'verse') wrap('[', ']', 'Giovanni 3:16');
    body.focus();
    updateNoteWordCount();
    saveNoteDraft();
}

async function saveCurrentNote() {
    const f = noteFields();
    const title = f.title.value.trim();
    const body = f.body.value.trim();
    if (!title && !body) { alert("Inserisci almeno un titolo o del contenuto."); return; }
    const saveBtn = document.getElementById('saveNoteModalBtn');
    saveBtn.disabled = true;
    const data = {
        id: currentEditingNoteId || crypto.randomUUID(),
        user_id: currentUser.id,
        title,
        speaker: f.speaker.value.trim(),
        category: f.category.value,
        refs: f.refs.value.trim(),
        body,
        updated_at: new Date()
    };
    const { error } = await supabaseClient.from('appunti').upsert([data]);
    saveBtn.disabled = false;
    if (error) {
        alert("Errore salvataggio: " + error.message + "\nLa bozza resta salvata sul dispositivo.");
        return;
    }
    const idx = notesDB.findIndex(n => n.id === data.id);
    if (idx !== -1) notesDB[idx] = data; else notesDB.unshift(data);
    activeNoteId = data.id;
    localStorage.setItem('notesDB', JSON.stringify(notesDB));
    clearNoteDraft();
    renderNotes();
    updateDashboard();
    closeNoteModal();
}

(function setupNoteEditor() {
    document.getElementById('closeNoteModalBtn').addEventListener('click', closeNoteModal);
    document.getElementById('saveNoteModalBtn').addEventListener('click', (e) => withBusyButton(e.currentTarget, saveCurrentNote));
    const f = noteFields();
    let draftTimer = null;
    [f.title, f.speaker, f.refs, f.body].forEach(el => el.addEventListener('input', () => {
        updateNoteWordCount();
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveNoteDraft, 600);
    }));
    f.category.addEventListener('change', saveNoteDraft);
    document.querySelectorAll('#noteFormatBar [data-format]').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault()); // non perde la selezione
        btn.addEventListener('click', () => applyNoteFormat(btn.dataset.format));
    });
    document.getElementById('noteModal').addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrentNote(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); applyNoteFormat('bold'); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); applyNoteFormat('italic'); }
    });
    setupNotesToolbar();
})();

// Funzioni globali esposte
window.openAvvisoModal = openAvvisoModal;
window.closeAvvisoModal = closeAvvisoModal;
window.deleteAvviso = deleteAvviso;
window.openHymnView = openHymnView;
window.toggleFavorite = toggleFavorite;
window.deleteHymn = deleteHymn;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.changeChapter = changeChapter;
window.deleteNoteFromList = deleteNoteFromList;
window.openAvvisoDetailModal = openAvvisoDetailModal;
window.closeAvvisoDetailModal = closeAvvisoDetailModal;
window.shareAvviso = shareAvviso;
window.shareHymn = shareHymn;
window.closeAccountModal = closeAccountModal;
window.toggleReaderMobileMenu = toggleReaderMobileMenu;
window.shareCurrentHymn = shareCurrentHymn;
window.toggleMobileMenu = toggleMobileMenu;

renderNotes();