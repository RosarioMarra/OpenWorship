// --- CONNESSIONE SUPABASE CLOUD ---
const supabaseUrl = 'https://tgwiazgovhecxquvzzhn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd2lhemdvdmhlY3hxdXZ6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTA2NjcsImV4cCI6MjA5MDU2NjY2N30.srb3N0_csi4qBFBFyVeUMWueIWWidwV7vVcOLg0LJs8';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- LISTA EMAIL AMMINISTRATORI ---
const adminEmails = ["marraros11@gmail.com", "secondaemail@gmail.com"];

// --- DATABASE IN TEMPO REALE E LOCALE ---
let hymnsDB = [];
let notesDB = [];
let avvisiDB = [];
let highlightsDB = [];
let favoritesDB = [];
let isAdmin = false;
let currentTab = "all";
let searchTerm = "";
let showChords = false;
let currentUser = null;
let avvisiSubscription = null;

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

function toggleFavorite(hymnId) {
    const index = favoritesDB.indexOf(hymnId);
    if (index === -1) {
        favoritesDB.push(hymnId);
    } else {
        favoritesDB.splice(index, 1);
    }
    saveFavorites();
    renderHymns();
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
async function shareContent(title, text, url) {
    const shareData = {
        title: title,
        text: text,
        url: url || window.location.href
    };
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return true;
        } catch (err) {
            console.log('Condivisione annullata o fallita:', err);
            return false;
        }
    } else {
        const fullText = `${title}\n\n${text}`;
        await navigator.clipboard.writeText(fullText);
        alert('Testo copiato negli appunti! Puoi incollarlo dove vuoi.');
        return true;
    }
}

// --- LOGIN LOGIC CON SUPABASE ---
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');

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

document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) alert("Errore durante il login: " + error.message);
    } catch (err) {
        alert("Errore di connessione a Google.");
    }
});

async function handleLogout() {
    if (avvisiSubscription) {
        supabaseClient.removeSubscription(avvisiSubscription);
        avvisiSubscription = null;
    }
    await supabaseClient.auth.signOut();
    document.body.classList.remove('admin-mode-active');
    mainApp.classList.add('hidden');
    loginScreen.style.display = 'flex';
    loginScreen.style.opacity = '1';
    // Chiudi eventuali modali aperti
    const accountModal = document.getElementById('accountModal');
    if (accountModal) accountModal.classList.add('hidden');
}
document.getElementById('logoutBtn').addEventListener('click', handleLogout);

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

// Funzione Bibbia
async function fetchBibleData(version, bookId, chapter) {
    const directUrl = `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`;
    try {
        const response = await fetch(directUrl);
        if (!response.ok) throw new Error("API limit");
        const data = await response.json();
        if (data && data.length > 0) return data;
        throw new Error("Nessun dato");
    } catch (e) {
        console.error("Errore fetch Bibbia:", e);
        throw new Error("Impossibile caricare la Bibbia. Verifica la connessione.");
    }
}

// --- NOTIFICHE IN TEMPO REALE PER NUOVI AVVISI ---
function setupRealtimeAvvisi() {
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
    if (!notificationsEnabled) return;

    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return;

    if (avvisiSubscription) {
        supabaseClient.removeSubscription(avvisiSubscription);
    }

    avvisiSubscription = supabaseClient
        .channel('avvisi-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avvisi' }, (payload) => {
            const newAvviso = payload.new;
            showAvvisoNotification(newAvviso);
        })
        .subscribe();
}

function showAvvisoNotification(avviso) {
    if (!avviso) return;
    const title = `📢 Nuovo avviso: ${avviso.title}`;
    const body = `${avviso.desc.substring(0, 100)}${avviso.desc.length > 100 ? '…' : ''}\nData: ${new Date(avviso.date).toLocaleDateString('it-IT')}`;
    const icon = '/icon-192.png';

    const notification = new Notification(title, { body, icon });
    notification.onclick = () => {
        window.focus();
        document.querySelector('.nav-item[data-target="avvisi"]').click();
        openAvvisoDetailModal(avviso.id);
        notification.close();
    };
}

// Mostra app principale dopo login
async function showApp() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user;
    isAdmin = adminEmails.includes(user.email);
    
    loginScreen.style.opacity = '0';
    setTimeout(async () => {
        loginScreen.style.display = 'none';
        mainApp.classList.remove('hidden');
        
        if (isAdmin) {
            document.body.classList.add('is-admin');
        }

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
            if (mobileAvatar) mobileAvatar.src = 'icon-192.png';
            if (modalAvatar) modalAvatar.src = 'icon-192.png';
        }
        const fullName = user.user_metadata.full_name || user.email;
        profileName.textContent = fullName;
        if (modalUserName) modalUserName.textContent = fullName;

        await loadCloudData();
        updateDashboard();
        renderHighlights();
        updateVerseOfDayImage();
        setupFavoritesTabs();
        setupDashboardCards();
        setupRealtimeAvvisi();
        
        // Ascolta cambiamenti real-time su avvisi e cantici (semplice refresh periodico)
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
        
        // Pulsante proietta avvisi
        const projectAvvisiBtn = document.getElementById('projectAvvisiBtn');
        if (projectAvvisiBtn) {
            projectAvvisiBtn.addEventListener('click', () => {
                startAvvisiPresentation();
            });
        }
        
        // Pulsante proietta cantico
        const projectHymnBtn = document.getElementById('projectHymnBtn');
        if (projectHymnBtn) {
            projectHymnBtn.addEventListener('click', () => {
                const currentHymnId = window.currentHymnId;
                if (currentHymnId) startHymnPresentation(currentHymnId);
            });
        }
        
        // Toggle accordi
        const toggleChordsBtn = document.getElementById('toggleChordsBtn');
        if (toggleChordsBtn) {
            toggleChordsBtn.addEventListener('click', () => {
                showChords = !showChords;
                const currentHymnId = window.currentHymnId;
                if (currentHymnId) openHymnSlides(currentHymnId);
            });
        }
        
        // Account mobile
        const mobileAccountBtn = document.getElementById('mobileAccountBtn');
        if (mobileAccountBtn) {
            mobileAccountBtn.addEventListener('click', () => {
                openAccountModal();
            });
        }
        
        const mobileLogoutModal = document.getElementById('mobileLogoutBtnModal');
        if (mobileLogoutModal) {
            mobileLogoutModal.addEventListener('click', async () => {
                // Chiudi il modale prima di eseguire il logout
                const accountModal = document.getElementById('accountModal');
                if (accountModal) accountModal.classList.add('hidden');
                await handleLogout();
            });
        }
        
        const notificationsSwitch = document.getElementById('notificationsSwitch');
        if (notificationsSwitch) {
            const saved = localStorage.getItem('notificationsEnabled') === 'true';
            notificationsSwitch.checked = saved;
            notificationsSwitch.addEventListener('change', (e) => {
                localStorage.setItem('notificationsEnabled', e.target.checked);
                if (e.target.checked) {
                    if ('Notification' in window && Notification.permission === 'default') {
                        Notification.requestPermission().then(perm => {
                            if (perm === 'granted') setupRealtimeAvvisi();
                        });
                    } else if (Notification.permission === 'granted') {
                        setupRealtimeAvvisi();
                    }
                } else {
                    if (avvisiSubscription) {
                        supabaseClient.removeSubscription(avvisiSubscription);
                        avvisiSubscription = null;
                    }
                }
            });
        }
        
        const greetingMsg = document.getElementById('greetingMessage');
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Buongiorno" : (hour < 18 ? "Buon pomeriggio" : "Buonasera");
        const firstName = (user.user_metadata.full_name || user.email || 'Amico').split(' ')[0];
        greetingMsg.innerHTML = `${greeting}, ${firstName}!`;
        
    }, 400);
}

function openAccountModal() {
    document.getElementById('accountModal').classList.remove('hidden');
}
function closeAccountModal() {
    document.getElementById('accountModal').classList.add('hidden');
}

function setupShareButtons() {
    const shareHymnBtn = document.getElementById('shareHymnBtn');
    if (shareHymnBtn) {
        shareHymnBtn.addEventListener('click', () => {
            const title = document.getElementById('currentHymnTitle')?.textContent || 'Cantico';
            const activeSlide = document.querySelector('.hymn-slide .slide-content');
            const text = activeSlide ? activeSlide.innerText : 'Cantico spirituale';
            shareContent(title, text);
        });
    }
}

function shareCurrentHymn() {
    const title = document.getElementById('currentHymnTitle')?.textContent || 'Cantico';
    const activeSlide = document.querySelector('.hymn-slide .slide-content');
    const text = activeSlide ? activeSlide.innerText : 'Cantico spirituale';
    shareContent(title, text);
}

function updateVerseOfDayImage() {
    const bgImageDiv = document.querySelector('.verse-bg-image');
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const imageIndex = dayOfYear % verseImages.length;
    if (bgImageDiv) {
        bgImageDiv.style.backgroundImage = `url('${verseImages[imageIndex]}')`;
    }
}

function setupDashboardCards() {
    document.querySelectorAll('.clickable-card').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.getAttribute('data-section');
            const targetBtn = document.querySelector(`.nav-item[data-target="${section}"]`);
            if (targetBtn) targetBtn.click();
        });
    });
}

async function loadCloudData() {
    try {
        const { data: cantici, error: canticiErr } = await supabaseClient.from('cantici').select('*');
        if (!canticiErr && cantici) hymnsDB = cantici;
        else console.error("Errore download cantici", canticiErr);
        renderHymns();

        const { data: avvisi, error: avvisiErr } = await supabaseClient.from('avvisi').select('*');
        if (!avvisiErr && avvisi) avvisiDB = avvisi;
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
        if (target !== 'cantici') {
            document.getElementById('hymnReaderView').classList.add('hidden');
            document.getElementById('hymnsListView').classList.remove('hidden');
        }
        if (target === 'bibbia') {
            updateBibleControlsVisibility();
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

function updateDashboard() {
    document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const verse = dailyVerses[dayOfYear % dailyVerses.length];
    document.getElementById('dailyVerseText').innerHTML = `"${verse.text}"`;
    document.getElementById('dailyVerseRef').innerHTML = `- ${verse.ref}`;
    document.getElementById('dashHymnsCount').textContent = hymnsDB.length;
    document.getElementById('dashNotesCount').textContent = notesDB.length;

    const sortedAvvisi = [...avvisiDB].sort((a, b) => new Date(a.date) - new Date(b.date));
    const oggi = new Date().toISOString().slice(0,10);
    let prossimo = sortedAvvisi.find(a => a.date >= oggi);
    if (!prossimo && sortedAvvisi.length) prossimo = sortedAvvisi[0];
    if (prossimo) {
        document.getElementById('dashNextEvent').textContent = prossimo.title;
        document.getElementById('dashNextEventDate').textContent = new Date(prossimo.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    } else {
        document.getElementById('dashNextEvent').textContent = "Nessuno";
        document.getElementById('dashNextEventDate').textContent = "Nessuna comunicazione recente";
    }
}

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
                <div class="mobile-avvisi-menu">
                    <button class="mobile-avvisi-menu-btn" onclick="event.stopPropagation(); toggleAvvisiMobileMenu(this)"><i class="ri-more-2-fill"></i></button>
                    <div class="mobile-avvisi-menu-dropdown hidden">
                        <button onclick="event.stopPropagation(); shareAvviso('${avviso.id}')"><i class="ri-share-line"></i> Condividi</button>
                        ${isAdmin ? `<button onclick="event.stopPropagation(); openAvvisoModal('${avviso.id}')"><i class="ri-pencil-line"></i> Modifica</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); deleteAvviso('${avviso.id}')"><i class="ri-delete-bin-line"></i> Elimina</button>` : ''}
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="admin-list-controls" style="position: absolute; top: 15px; right: 15px; display:flex; gap:8px; z-index:10;">
                    <button class="icon-btn" onclick="event.stopPropagation(); openAvvisoModal('${avviso.id}')"><i class="ri-pencil-line"></i></button>
                    <button class="icon-btn icon-danger" onclick="event.stopPropagation(); deleteAvviso('${avviso.id}')"><i class="ri-delete-bin-line"></i></button>
                </div>
                <div class="avviso-date">${dateObj.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="avviso-title">${escapeHtml(avviso.title)}</div>
                <div class="avviso-desc">${escapeHtml(avviso.desc.substring(0, 150))}${avviso.desc.length > 150 ? '...' : ''}</div>
                <div style="margin-top: 12px; display: flex; gap: 12px;">
                    <button class="btn-text" onclick="event.stopPropagation(); openAvvisoDetailModal('${avviso.id}')">Leggi tutto <i class="ri-arrow-right-s-line"></i></button>
                    <button class="icon-btn" onclick="event.stopPropagation(); shareAvviso('${avviso.id}')"><i class="ri-share-line"></i></button>
                </div>
            `;
        }
        card.onclick = () => openAvvisoDetailModal(avviso.id);
        list.appendChild(card);
    });
}

function toggleAvvisiMobileMenu(btn) {
    const dropdown = btn.nextElementSibling;
    document.querySelectorAll('.mobile-avvisi-menu-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
    });
    dropdown.classList.toggle('hidden');
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('.mobile-avvisi-menu')) {
        document.querySelectorAll('.mobile-avvisi-menu-dropdown').forEach(d => d.classList.add('hidden'));
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
    return text.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
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

document.getElementById('saveAvvisoBtn').onclick = async () => {
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
};

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

// --- PRESENTAZIONE AVVISI ---
function startAvvisiPresentation() {
    if (avvisiDB.length === 0) {
        alert("Nessun avviso da proiettare.");
        return;
    }
    const sorted = [...avvisiDB].sort((a,b) => new Date(a.date) - new Date(b.date));
    showPresentation('avvisi', sorted);
}

function startHymnPresentation(hymnId) {
    const hymn = hymnsDB.find(h => h.id === hymnId);
    if (!hymn) {
        console.error("Cantico non trovato");
        return;
    }
    const blocks = hymn.content.split(/\n\s*\n/).filter(b => b.trim());
    const slides = blocks.map((block, idx) => {
        const clean = block.replace(/^(Coro|Chorus|Rit|Ritornello)\s*[:\-]?\s*/i, '').trim();
        return { title: idx === 0 ? hymn.title : `Strofa ${idx+1}`, content: clean };
    });
    showPresentation('cantico', slides, hymn.title);
}

function showPresentation(type, items, hymnTitle = '') {
    const overlay = document.getElementById('presentationOverlay');
    const container = document.getElementById('presentationSlidesContainer');
    const counterSpan = document.getElementById('presCounter');
    const prevBtn = document.getElementById('presPrevBtn');
    const nextBtn = document.getElementById('presNextBtn');
    const exitBtn = document.getElementById('exitPresentationBtn');
    const previewPrev = document.getElementById('presPreviewPrev');
    const previewNext = document.getElementById('presPreviewNext');
    
    container.innerHTML = '';
    let currentIndex = 0;
    
    items.forEach((item, idx) => {
        const slide = document.createElement('div');
        slide.className = 'presentation-slide';
        if (type === 'avvisi') {
            slide.innerHTML = `
                <h1>${escapeHtml(item.title)}</h1>
                <div class="date">${new Date(item.date).toLocaleDateString('it-IT')}</div>
                <div class="desc">${escapeHtml(item.desc).replace(/\n/g, '<br>')}</div>
            `;
        } else {
            slide.innerHTML = `
                <h1>${escapeHtml(item.title)}</h1>
                <div class="desc">${escapeHtml(item.content).replace(/\n/g, '<br>')}</div>
            `;
        }
        container.appendChild(slide);
    });
    
    function updateCounter() {
        counterSpan.textContent = `${currentIndex+1} / ${items.length}`;
        const slides = document.querySelectorAll('.presentation-slide');
        slides.forEach((slide, i) => {
            slide.style.transform = i === currentIndex ? 'scale(1)' : 'scale(0.95)';
            slide.style.opacity = i === currentIndex ? '1' : '0.5';
        });
        if (currentIndex > 0) {
            const prevItem = items[currentIndex-1];
            previewPrev.innerHTML = type === 'avvisi' ? 
                `<strong>${escapeHtml(prevItem.title)}</strong><br>${new Date(prevItem.date).toLocaleDateString()}` :
                `<strong>${escapeHtml(prevItem.title)}</strong>`;
            previewPrev.style.display = 'block';
            previewPrev.onclick = () => { currentIndex--; scrollToSlide(currentIndex); updateCounter(); };
        } else {
            previewPrev.style.display = 'none';
        }
        if (currentIndex < items.length-1) {
            const nextItem = items[currentIndex+1];
            previewNext.innerHTML = type === 'avvisi' ? 
                `<strong>${escapeHtml(nextItem.title)}</strong><br>${new Date(nextItem.date).toLocaleDateString()}` :
                `<strong>${escapeHtml(nextItem.title)}</strong>`;
            previewNext.style.display = 'block';
            previewNext.onclick = () => { currentIndex++; scrollToSlide(currentIndex); updateCounter(); };
        } else {
            previewNext.style.display = 'none';
        }
    }
    
    function scrollToSlide(index) {
        const slideWidth = container.clientWidth;
        container.scrollLeft = index * slideWidth;
        currentIndex = index;
        updateCounter();
    }
    
    container.addEventListener('scroll', () => {
        const slideWidth = container.clientWidth;
        const newIndex = Math.round(container.scrollLeft / slideWidth);
        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            updateCounter();
        }
    });
    
    prevBtn.onclick = () => {
        if (currentIndex > 0) {
            currentIndex--;
            scrollToSlide(currentIndex);
        }
    };
    nextBtn.onclick = () => {
        if (currentIndex < items.length-1) {
            currentIndex++;
            scrollToSlide(currentIndex);
        }
    };
    exitBtn.onclick = () => {
        overlay.classList.add('hidden');
    };
    
    overlay.classList.remove('hidden');
    setTimeout(() => {
        scrollToSlide(0);
        updateCounter();
    }, 100);
}

// --- CANTICI: XML PARSER E CLOUD SYNC ---
document.getElementById('deleteAllHymnsBtn').addEventListener('click', async () => {
    if (hymnsDB.length === 0) return alert("Non ci sono cantici da cancellare.");
    if (confirm("ATTENZIONE! Sei sicuro di voler cancellare TUTTI i cantici dal cloud?")) {
        try {
            for (let hymn of hymnsDB) {
                await supabaseClient.from('cantici').delete().eq('id', hymn.id);
            }
            hymnsDB = [];
            favoritesDB = [];
            saveFavorites();
            renderHymns();
            updateDashboard();
        } catch (e) {
            alert("Errore durante l'eliminazione dei cantici: " + e.message);
        }
    }
});

document.getElementById('xmlUpload').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    document.getElementById('hymnSearch').placeholder = "Caricamento in Cloud in corso...";
    for (let file of files) {
        try {
            let text = await file.text();
            let title = file.name.replace(/\.[^/.]+$/, "");
            let content = text;
            if (file.name.endsWith('.xml')) {
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
                                blockText += line.innerHTML.replace(/<[^>]+>/g, '').trim() + "\n";
                            });
                        } else {
                            blockText = v.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
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
            const newHymn = { id: crypto.randomUUID(), title: title, content: content };
            const { error } = await supabaseClient.from('cantici').insert([newHymn]);
            if (error) {
                alert(`Supabase ha bloccato il cantico '${title}'. Errore: ` + error.message);
            } else {
                hymnsDB.push(newHymn);
            }
        } catch (e) {
            console.error("Errore lettura file:", e);
            alert("Errore nella lettura del file " + file.name);
        }
    }
    document.getElementById('hymnSearch').placeholder = "Cerca cantico...";
    renderHymns();
    updateDashboard();
});

function getFilteredHymns() {
    let filtered = [...hymnsDB];
    if (searchTerm) {
        filtered = filtered.filter(h => h.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (currentTab === "favorites") {
        filtered = filtered.filter(h => isFavorite(h.id));
    }
    return filtered.sort(sortByNumber);
}

function renderHymns() {
    const list = document.getElementById('hymnsList');
    list.innerHTML = '';
    const filtered = getFilteredHymns();
    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-muted" style="text-align:center; padding:40px;">Nessun cantico trovato</p>';
        return;
    }
    filtered.forEach((hymn) => {
        const card = document.createElement('div');
        card.className = 'hymn-card';
        const favActive = isFavorite(hymn.id);
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            card.innerHTML = `
                <div style="flex:1" onclick="openHymnSlides('${hymn.id}')">
                    <span style="font-weight:600;">${escapeHtml(hymn.title)}</span>
                </div>
                <div class="mobile-menu" style="position:relative;">
                    <button class="mobile-menu-btn" onclick="event.stopPropagation(); toggleMobileMenu(this)"><i class="ri-more-2-fill"></i></button>
                    <div class="mobile-menu-dropdown hidden">
                        <button onclick="event.stopPropagation(); shareHymn('${hymn.id}')"><i class="ri-share-line"></i> Condividi</button>
                        <button onclick="event.stopPropagation(); toggleFavorite('${hymn.id}')"><i class="ri-heart-${favActive ? 'fill' : 'line'}"></i> Preferito</button>
                        ${isAdmin ? `<button onclick="event.stopPropagation(); openEditModal('${hymn.id}')"><i class="ri-pencil-line"></i> Modifica</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); deleteHymn('${hymn.id}')"><i class="ri-delete-bin-line"></i> Elimina</button>` : ''}
                        ${isAdmin ? `<button onclick="event.stopPropagation(); startHymnPresentation('${hymn.id}')"><i class="ri-projector-line"></i> Proietta</button>` : ''}
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div style="flex:1" onclick="openHymnSlides('${hymn.id}')">
                    <span style="font-weight:600;">${escapeHtml(hymn.title)}</span>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="icon-btn" onclick="event.stopPropagation(); shareHymn('${hymn.id}')"><i class="ri-share-line"></i></button>
                    <button class="favorite-btn ${favActive ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${hymn.id}')">
                        <i class="ri-heart-${favActive ? 'fill' : 'line'}"></i>
                    </button>
                    <div class="admin-list-controls" style="display:flex; gap:8px;">
                        <button class="icon-btn" onclick="event.stopPropagation(); openEditModal('${hymn.id}')"><i class="ri-pencil-line"></i></button>
                        <button class="icon-btn icon-danger" onclick="event.stopPropagation(); deleteHymn('${hymn.id}')"><i class="ri-delete-bin-line"></i></button>
                        ${isAdmin ? `<button class="icon-btn" onclick="event.stopPropagation(); startHymnPresentation('${hymn.id}')"><i class="ri-projector-line"></i></button>` : ''}
                    </div>
                </div>
            `;
        }
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
    await shareContent(hymn.title, hymn.content.substring(0, 500));
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
function openEditModal(id) {
    editHymnId = id;
    const hymn = hymnsDB.find(h => h.id === id);
    document.getElementById('editHymnTitle').value = hymn.title;
    document.getElementById('editHymnBody').value = hymn.content;
    document.getElementById('editModal').classList.remove('hidden');
}
function closeEditModal() {
    document.getElementById('editModal').classList.add('hidden');
}
document.getElementById('saveEditHymnBtn').onclick = async () => {
    try {
        const i = hymnsDB.findIndex(h => h.id === editHymnId);
        const updatedTitle = document.getElementById('editHymnTitle').value;
        const updatedContent = document.getElementById('editHymnBody').value;
        const { error } = await supabaseClient.from('cantici').update({ title: updatedTitle, content: updatedContent }).eq('id', editHymnId);
        if (error) throw error;
        hymnsDB[i].title = updatedTitle;
        hymnsDB[i].content = updatedContent;
        renderHymns();
        closeEditModal();
    } catch (e) {
        alert("Errore aggiornamento cantico: " + e.message);
    }
};

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
        const blocks = hymn.content.split(/\n\s*\n/);
        let formattedContent = '';
        blocks.forEach((block, blockIdx) => {
            const isChorus = /coro|chorus|rit|ritornello/i.test(block);
            let cleanBlock = block.replace(/^(Coro|Chorus|Rit|Ritornello)\s*[:\-]?\s*/i, '').trim();
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

// --- LETTORE SLIDE CANTICI ---
let currentHymnFontSize = 40;
let isGridView = false;
window.currentHymnId = null;
const slidesContainer = document.getElementById('hymnSlidesContainer');
const gridContainer = document.getElementById('hymnGridContainer');

document.getElementById('toggleGridViewBtn').onclick = () => {
    isGridView = !isGridView;
    if (isGridView) {
        document.getElementById('slidesWrapperView').classList.add('hidden');
        gridContainer.classList.remove('hidden');
        document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-slideshow-line" style="font-size:18px;"></i>';
        const previews = document.getElementById('slidePreviews');
        if (previews) previews.style.display = 'none';
    } else {
        document.getElementById('slidesWrapperView').classList.remove('hidden');
        gridContainer.classList.add('hidden');
        document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-grid-fill" style="font-size:18px;"></i>';
        const previews = document.getElementById('slidePreviews');
        if (previews) previews.style.display = 'flex';
        setTimeout(autoFitHymn, 50);
        setTimeout(updateSlidePreviews, 100);
    }
};

function openHymnSlides(id) {
    const hymn = hymnsDB.find(h => h.id === id);
    if (!hymn) return;
    window.currentHymnId = id;
    document.getElementById('hymnsListView').classList.add('hidden');
    document.getElementById('hymnReaderView').classList.remove('hidden');
    document.getElementById('currentHymnTitle').textContent = hymn.title;
    
    isGridView = false;
    document.getElementById('slidesWrapperView').classList.remove('hidden');
    gridContainer.classList.add('hidden');
    document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-grid-fill" style="font-size:18px;"></i>';
    const previewsContainer = document.getElementById('slidePreviews');
    if (previewsContainer) previewsContainer.style.display = 'flex';
    
    slidesContainer.innerHTML = '';
    document.getElementById('slideDots').innerHTML = '';
    gridContainer.innerHTML = '';
    
    const blocks = hymn.content.split(/\n\s*\n/);
    blocks.forEach((block, index) => {
        const cleanBlock = block.trim();
        if (!cleanBlock) return;
        const isChorus = /coro|chorus|rit|ritornello/i.test(cleanBlock);
        let textToDisplay = cleanBlock.replace(/^(Coro|Chorus|Rit|Ritornello)\s*[:\-]?\s*/i, '').trim();
        
        const chords = ['Do', 'Sol', 'Lam', 'Mi', 'Fa', 'Do', 'Sol', 'Do'];
        const lines = textToDisplay.split('\n');
        let formattedLines = '';
        if (showChords) {
            lines.forEach((line, idx) => {
                const chord = chords[idx % chords.length];
                formattedLines += `<div class="chord-line">${chord}</div>`;
                formattedLines += `<div class="hymn-line">${escapeHtml(line) || '&nbsp;'}</div>`;
            });
        } else {
            formattedLines = lines.map(line => `<div class="hymn-line">${escapeHtml(line) || '&nbsp;'}</div>`).join('');
        }
        
        const slide = document.createElement('div');
        slide.className = 'hymn-slide';
        const contentDiv = document.createElement('div');
        contentDiv.className = `slide-content ${isChorus ? 'slide-chorus' : ''}`;
        contentDiv.innerHTML = formattedLines;
        slide.appendChild(contentDiv);
        slidesContainer.appendChild(slide);
        
        const gridCard = document.createElement('div');
        gridCard.className = 'hymn-grid-card';
        gridCard.innerHTML = `<div class="grid-card-title">${isChorus ? 'Coro' : 'Strofa ' + (index + 1)}</div><div class="grid-card-preview ${isChorus ? 'slide-chorus' : ''}">${escapeHtml(textToDisplay.substring(0, 100))}${textToDisplay.length > 100 ? '...' : ''}</div>`;
        gridCard.onclick = () => {
            document.getElementById('toggleGridViewBtn').click();
            scrollToSlide(index);
        };
        gridContainer.appendChild(gridCard);
        
        const dot = document.createElement('div');
        dot.className = `slide-dot ${index === 0 ? 'active' : ''}`;
        document.getElementById('slideDots').appendChild(dot);
    });
    
    slidesContainer.scrollLeft = 0;
    updateSlideVisibility();
    setTimeout(autoFitHymn, 50);
    setTimeout(updateSlidePreviews, 100);
}

function scrollToSlide(index) {
    const slideWidth = slidesContainer.clientWidth;
    slidesContainer.scrollLeft = index * slideWidth;
    setTimeout(() => {
        updateSlideVisibility();
        updateSlidePreviews();
    }, 100);
}

function updateSlideVisibility() {
    const slides = document.querySelectorAll('.hymn-slide');
    const containerRect = slidesContainer.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    slides.forEach(slide => {
        const slideRect = slide.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        const distance = Math.abs(slideCenter - center);
        const maxDistance = containerRect.width / 2;
        const opacity = Math.max(0.3, 1 - (distance / maxDistance) * 0.7);
        const scale = Math.max(0.7, 1 - (distance / maxDistance) * 0.3);
        slide.style.opacity = opacity;
        slide.style.transform = `scale(${scale})`;
    });
    updateSlidePreviews();
}

function updateSlidePreviews() {
    const slides = document.querySelectorAll('.hymn-slide');
    if (slides.length === 0) return;
    const containerRect = slidesContainer.getBoundingClientRect();
    const center = containerRect.left + containerRect.width / 2;
    let currentIndex = -1;
    slides.forEach((slide, idx) => {
        const slideRect = slide.getBoundingClientRect();
        const slideCenter = slideRect.left + slideRect.width / 2;
        if (Math.abs(slideCenter - center) < 10) currentIndex = idx;
    });
    const prevContent = document.getElementById('previewPrevContent');
    const nextContent = document.getElementById('previewNextContent');
    const previewPrev = document.getElementById('previewPrev');
    const previewNext = document.getElementById('previewNext');
    if (!prevContent || !nextContent) return;
    if (currentIndex > 0) {
        const prevSlide = slides[currentIndex - 1];
        const prevText = prevSlide ? prevSlide.querySelector('.slide-content')?.innerText || '—' : '—';
        prevContent.innerHTML = prevText.substring(0, 100) + (prevText.length > 100 ? '...' : '');
        previewPrev.style.opacity = '1';
        previewPrev.style.pointerEvents = 'auto';
        previewPrev.onclick = () => {
            slidesContainer.scrollLeft = (currentIndex - 1) * slidesContainer.clientWidth;
            setTimeout(() => { updateSlideVisibility(); updateSlidePreviews(); }, 100);
        };
    } else {
        prevContent.innerHTML = '—';
        previewPrev.style.opacity = '0.5';
        previewPrev.style.pointerEvents = 'none';
    }
    if (currentIndex < slides.length - 1 && currentIndex !== -1) {
        const nextSlide = slides[currentIndex + 1];
        const nextText = nextSlide ? nextSlide.querySelector('.slide-content')?.innerText || '—' : '—';
        nextContent.innerHTML = nextText.substring(0, 100) + (nextText.length > 100 ? '...' : '');
        previewNext.style.opacity = '1';
        previewNext.style.pointerEvents = 'auto';
        previewNext.onclick = () => {
            slidesContainer.scrollLeft = (currentIndex + 1) * slidesContainer.clientWidth;
            setTimeout(() => { updateSlideVisibility(); updateSlidePreviews(); }, 100);
        };
    } else {
        nextContent.innerHTML = '—';
        previewNext.style.opacity = '0.5';
        previewNext.style.pointerEvents = 'none';
    }
}

function autoFitHymn() {
    if (slidesContainer.clientWidth === 0) { setTimeout(autoFitHymn, 50); return; }
    const isMobile = window.innerWidth < 768;
    let fontSize = isMobile ? 60 : 90;
    updateHymnFontSize(fontSize);
    void slidesContainer.offsetHeight;
    const maxWidth = slidesContainer.clientWidth - (isMobile ? 40 : 160);
    const maxHeight = slidesContainer.clientHeight - (isMobile ? 40 : 80);
    let isFitting = false;
    while (!isFitting && fontSize > 14) {
        let overflow = false;
        document.querySelectorAll('.slide-content').forEach(slide => {
            if (slide.getBoundingClientRect().height > maxHeight) overflow = true;
            slide.querySelectorAll('.hymn-line').forEach(line => {
                if (line.getBoundingClientRect().width > maxWidth) overflow = true;
            });
        });
        if (overflow) { fontSize -= 2; updateHymnFontSize(fontSize); void slidesContainer.offsetHeight; }
        else isFitting = true;
    }
    currentHymnFontSize = Math.max(14, fontSize - 2);
    updateHymnFontSize(currentHymnFontSize);
}

document.getElementById('increaseHymnFont').onclick = () => {
    if (isGridView) return;
    if (currentHymnFontSize < 120) { currentHymnFontSize += 2; updateHymnFontSize(currentHymnFontSize); }
};
document.getElementById('decreaseHymnFont').onclick = () => {
    if (isGridView) return;
    if (currentHymnFontSize > 14) { currentHymnFontSize -= 2; updateHymnFontSize(currentHymnFontSize); }
};

function updateHymnFontSize(size) {
    document.querySelectorAll('.slide-content').forEach(el => el.style.fontSize = `${size}px`);
}

slidesContainer.addEventListener('scroll', () => {
    const slideWidth = slidesContainer.clientWidth;
    if (slideWidth === 0) return;
    const currentSlide = Math.round(slidesContainer.scrollLeft / slideWidth);
    document.querySelectorAll('.slide-dot').forEach((dot, index) => { dot.classList.toggle('active', index === currentSlide); });
    updateSlideVisibility();
    updateSlidePreviews();
});

document.getElementById('backToHymns').onclick = () => {
    document.getElementById('hymnReaderView').classList.add('hidden');
    document.getElementById('hymnsListView').classList.remove('hidden');
    const previews = document.getElementById('slidePreviews');
    if (previews) previews.style.display = 'none';
};

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

let currentBibleFontSize = 22;
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
    reader.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="ri-loader-4-line ri-spin" style="font-size: 32px; color: var(--accent-color);"></i><p style="margin-top:10px; color:var(--text-muted)">Connessione in corso...</p></div>';
    try {
        const data = await fetchBibleData(version, bookId, chapter);
        let html = `<div style="text-align: center; margin-bottom: 30px;"><h2 style="font-weight:800; font-size:32px; color: var(--text-main); margin:0;">${escapeHtml(bookName)} ${chapter}</h2></div><div style="margin-bottom: 20px;">`;
        data.forEach(v => {
            const cleanText = v.text.replace(/<\/?(?:span|i|b|div)[^>]*>/g, '');
            const isHighlight = highlightsDB.some(h => h.book == bookId && h.chapter == chapter && h.verse == v.verse);
            html += `<span class="bible-verse ${isHighlight ? 'highlighted' : ''}" id="verse-${v.verse}" data-book="${bookId}" data-bookname="${escapeHtml(bookName)}" data-chapter="${chapter}" data-verse="${v.verse}" data-text="${escapeHtml(cleanText).replace(/"/g, '&quot;')}">
                        <sup style="color:var(--accent-color); font-weight:bold; font-size: 14px; margin-right:6px;">${v.verse}</sup>
                        ${cleanText}
                     </span>`;
        });
        html += `</div>`;
        reader.innerHTML = html;
        updateBibleFontSize();
        document.getElementById('bibleCurrentChapterDisplay').textContent = `${bookName} ${chapter}`;
        updateBibleControlsVisibility();
        document.querySelectorAll('.bible-verse').forEach(el => {
            el.addEventListener('click', function () {
                const bId = this.dataset.book;
                const bName = this.dataset.bookname;
                const ch = this.dataset.chapter;
                const ve = this.dataset.verse;
                const txt = this.dataset.text;
                const existingIndex = highlightsDB.findIndex(h => h.book === bId && h.chapter === ch && h.verse == ve);
                if (existingIndex >= 0) {
                    highlightsDB.splice(existingIndex, 1);
                    this.classList.remove('highlighted');
                } else {
                    highlightsDB.push({ book: bId, bookName: bName, chapter: ch, verse: ve, text: txt, id: Date.now() });
                    this.classList.add('highlighted');
                }
                localStorage.setItem('highlightsDB', JSON.stringify(highlightsDB));
                renderHighlights();
            });
        });
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
        reader.innerHTML = `<div style="text-align:center;"><p style="color:var(--danger-color); font-weight:bold;">Errore di Rete.</p><p style="color:var(--text-muted); font-size:16px;">Controlla la tua connessione e riprova.</p></div>`;
    }
});

function updateBibleFontSize() {
    document.getElementById('bibleReaderContent').style.fontSize = `${currentBibleFontSize}px`;
}
document.getElementById('increaseBibleFont').onclick = () => { currentBibleFontSize += 2; updateBibleFontSize(); };
document.getElementById('decreaseBibleFont').onclick = () => { if (currentBibleFontSize > 14) currentBibleFontSize -= 2; updateBibleFontSize(); };

// --- APPUNTI (ex Prediche) ---
let activeNoteId = null;
let currentEditingNoteId = null;

function renderNotes() {
    const ul = document.getElementById('notesUl');
    ul.innerHTML = '';
    const sortedNotes = [...notesDB].reverse();
    sortedNotes.forEach(n => {
        const li = document.createElement('li');
        li.className = 'sermon-card';
        li.innerHTML = `
            <span class="sermon-badge">${escapeHtml(n.category || 'Appunto')}</span>
            <div style="display:flex; align-items:center; gap:8px; padding-right: 60px;">
                <i class="ri-file-list-3-line text-muted"></i> 
                <span style="font-size:15px; font-weight:500;">${escapeHtml(n.title || "Senza titolo")}</span>
            </div>
            <button class="delete-sermon-from-list" onclick="event.stopPropagation(); deleteNoteFromList('${n.id}')">
                <i class="ri-delete-bin-line"></i>
            </button>
        `;
        li.onclick = () => {
            openNoteViewModal(n);
        };
        ul.appendChild(li);
    });
}

async function deleteNoteFromList(id) {
    if (confirm("Sei sicuro di voler eliminare questo appunto?")) {
        await supabaseClient.from('appunti').delete().eq('id', id);
        notesDB = notesDB.filter(n => n.id !== id);
        saveNotes();
        if (activeNoteId === id) activeNoteId = null;
        renderNotes();
        updateDashboard();
    }
}

function renderHighlights() {
    const ul = document.getElementById('highlightsUl');
    ul.innerHTML = '';
    if (highlightsDB.length === 0) {
        ul.innerHTML = '<li style="padding: 15px; font-size:12px; color:var(--text-muted); text-align:center;">Nessun versetto evidenziato.</li>';
        return;
    }
    [...highlightsDB].reverse().forEach(h => {
        const li = document.createElement('li');
        li.className = 'highlight-item';
        li.innerHTML = `<strong style="color:#ff9500;">${escapeHtml(h.bookName)} ${h.chapter}:${h.verse}</strong><br>"${escapeHtml(h.text.substring(0, 80))}${h.text.length > 80 ? '...' : ''}"`;
        li.onclick = () => {
            const modalBody = document.getElementById('modalNoteBody');
            if (modalBody && document.getElementById('noteModal').classList.contains('hidden') === false) {
                const currentText = modalBody.value;
                modalBody.value = currentText + `\n\n[${h.bookName} ${h.chapter}:${h.verse}] "${h.text}"\n`;
                modalBody.focus();
            } else {
                const textToCopy = `[${h.bookName} ${h.chapter}:${h.verse}] "${h.text}"`;
                navigator.clipboard.writeText(textToCopy);
                alert("Versetto copiato negli appunti!");
            }
            li.style.background = "#34c759";
            li.style.color = "white";
            setTimeout(() => { li.style.background = ""; li.style.color = ""; }, 500);
        };
        ul.appendChild(li);
    });
}

function openNoteViewModal(note) {
    document.getElementById('viewNoteTitle').textContent = note.title || "Senza titolo";
    document.getElementById('viewNoteCategory').textContent = note.category || "Appunto";
    document.getElementById('viewNoteSpeaker').innerHTML = note.speaker ? `<i class="ri-user-voice-line"></i> ${escapeHtml(note.speaker)}` : '';
    document.getElementById('viewNoteRefs').innerHTML = note.refs ? `<i class="ri-book-mark-line"></i> ${escapeHtml(note.refs)}` : '';
    document.getElementById('viewNoteBody').textContent = note.body || "";
    const editBtn = document.getElementById('editNoteFromViewBtn');
    const printBtn = document.getElementById('printNoteFromViewBtn');
    editBtn.onclick = () => {
        closeNoteViewModal();
        openNoteModal(note);
    };
    printBtn.onclick = () => {
        printNote(note);
    };
    document.getElementById('noteViewModal').classList.remove('hidden');
}

function closeNoteViewModal() {
    document.getElementById('noteViewModal').classList.add('hidden');
}

function printNote(note) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Stampa Appunto - ${escapeHtml(note.title)}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #007aff; }
            .meta { color: #666; margin-bottom: 20px; }
            .content { white-space: pre-wrap; line-height: 1.6; }
        </style>
        </head>
        <body>
            <h1>${escapeHtml(note.title)}</h1>
            <div class="meta">${note.category || 'Appunto'}${note.speaker ? ' · ' + escapeHtml(note.speaker) : ''}${note.refs ? ' · ' + escapeHtml(note.refs) : ''}</div>
            <div class="content">${escapeHtml(note.body).replace(/\n/g, '<br>')}</div>
            <p style="margin-top: 40px; font-size: 12px; color: #999;">Generato da Open Worship</p>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function openNoteModal(note = null) {
    const modal = document.getElementById('noteModal');
    const titleEl = document.getElementById('noteModalTitle');
    const inputTitle = document.getElementById('modalNoteTitle');
    const inputCategory = document.getElementById('modalNoteCategory');
    const inputSpeaker = document.getElementById('modalNoteSpeaker');
    const inputRefs = document.getElementById('modalNoteRefs');
    const inputBody = document.getElementById('modalNoteBody');
    if (note) {
        currentEditingNoteId = note.id;
        titleEl.textContent = "Modifica Appunto";
        inputTitle.value = note.title || "";
        inputCategory.value = note.category || "Appunto";
        inputSpeaker.value = note.speaker || "";
        inputRefs.value = note.refs || "";
        inputBody.value = note.body || "";
    } else {
        currentEditingNoteId = null;
        titleEl.textContent = "Nuovo Appunto";
        inputTitle.value = "";
        inputCategory.value = "Appunto";
        inputSpeaker.value = "";
        inputRefs.value = "";
        inputBody.value = "";
    }
    modal.classList.remove('hidden');
    inputTitle.focus();
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
    currentEditingNoteId = null;
}

document.getElementById('closeNoteModalBtn').addEventListener('click', closeNoteModal);
document.getElementById('saveNoteModalBtn').addEventListener('click', async () => {
    const title = document.getElementById('modalNoteTitle').value.trim();
    const category = document.getElementById('modalNoteCategory').value;
    const speaker = document.getElementById('modalNoteSpeaker').value.trim();
    const refs = document.getElementById('modalNoteRefs').value.trim();
    const body = document.getElementById('modalNoteBody').value.trim();
    if (!title && !body) { alert("Inserisci almeno un titolo o del contenuto."); return; }
    const data = {
        id: currentEditingNoteId || crypto.randomUUID(),
        user_id: currentUser.id,
        title: title,
        speaker: speaker,
        category: category,
        refs: refs,
        body: body,
        updated_at: new Date()
    };
    const { error } = await supabaseClient.from('appunti').upsert([data]);
    if (error) {
        alert("Errore salvataggio: " + error.message);
        return;
    }
    if (currentEditingNoteId) {
        const idx = notesDB.findIndex(n => n.id === currentEditingNoteId);
        if (idx !== -1) notesDB[idx] = data;
        else notesDB.unshift(data);
    } else {
        notesDB.unshift(data);
        activeNoteId = data.id;
    }
    saveNotes();
    renderNotes();
    updateDashboard();
    closeNoteModal();
    const saveBtn = document.getElementById('saveNoteModalBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = "<i class='ri-check-line'></i> Salvato";
    setTimeout(() => saveBtn.innerHTML = originalText, 1500);
});

// Funzioni globali esposte
window.openAvvisoModal = openAvvisoModal;
window.closeAvvisoModal = closeAvvisoModal;
window.deleteAvviso = deleteAvviso;
window.openHymnSlides = openHymnSlides;
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
window.startHymnPresentation = startHymnPresentation;
window.closeAccountModal = closeAccountModal;
window.toggleReaderMobileMenu = toggleReaderMobileMenu;
window.shareCurrentHymn = shareCurrentHymn;
window.toggleAvvisiMobileMenu = toggleAvvisiMobileMenu;

renderNotes();