// --- CONNESSIONE SUPABASE CLOUD ---
const supabaseUrl = 'https://tgwiazgovhecxquvzzhn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd2lhemdvdmhlY3hxdXZ6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTA2NjcsImV4cCI6MjA5MDU2NjY2N30.srb3N0_csi4qBFBFyVeUMWueIWWidwV7vVcOLg0LJs8';

// ABBIAMO CAMBIATO IL NOME QUI IN "supabaseClient" PER NON ANDARE IN CONFLITTO!
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- DATABASE IN TEMPO REALE E LOCALE ---
let hymnsDB = [];
let sermonsDB = []; 
let avvisiDB = [];
let highlightsDB = JSON.parse(localStorage.getItem('highlightsDB')) || []; 

// --- LOGIN LOGIC CON SUPABASE ---
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');

// Controlla se l'utente è già loggato
async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        showApp();
    } else {
        loginScreen.style.opacity = '1';
    }
}
checkUser();

// Tasto Login Google con Debug
document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    console.log("Bottone cliccato! Tento il login con Supabase...");
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            console.error("Errore da Supabase:", error);
            alert("Errore durante il login: " + error.message);
        }
    } catch (err) {
        console.error("Errore critico di connessione:", err);
        alert("Errore di connessione. Controlla la Console!");
    }
});

// Logout
async function handleLogout() {
    await supabaseClient.auth.signOut();
    mainApp.classList.add('hidden');
    loginScreen.style.display = 'flex';
    setTimeout(() => loginScreen.style.opacity = '1', 50);
}
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('mobileLogoutBtn').addEventListener('click', handleLogout);

// --- AVVIO E CARICAMENTO DAL CLOUD ---
function showApp() {
    loginScreen.style.opacity = '0';
    setTimeout(async () => {
        loginScreen.style.display = 'none';
        mainApp.classList.remove('hidden');
        
        // Scarica i dati dal Cloud
        await loadCloudData();
        
        updateDashboard();
        renderHighlights();
    }, 400);
}

async function loadCloudData() {
    try {
        // Scarica Cantici
        const { data: cantici } = await supabaseClient.from('cantici').select('*');
        if(cantici) hymnsDB = cantici;
        renderHymns();

        // Scarica Avvisi
        const { data: avvisi } = await supabaseClient.from('avvisi').select('*');
        if(avvisi) avvisiDB = avvisi;
        renderAvvisi();

        // Scarica Sermoni
        const { data: sermoni } = await supabaseClient.from('sermoni').select('*');
        if(sermoni) sermonsDB = sermoni;
        renderSermons();
    } catch (err) {
        console.error("Errore nel caricamento dal Cloud: ", err);
    }
}

// --- NAVIGAZIONE TABS E ADMIN MODE ---
document.querySelectorAll('.nav-item[data-target]').forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        document.querySelectorAll('.nav-item[data-target]').forEach(nav => nav.classList.remove('active'));
        document.querySelectorAll(`.nav-item[data-target="${target}"]`).forEach(btn => btn.classList.add('active'));
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        if(target === 'dashboard') updateDashboard();
        if(target !== 'cantici') {
            document.getElementById('hymnReaderView').classList.add('hidden');
            document.getElementById('hymnsListView').classList.remove('hidden');
        }
    });
});

document.getElementById('adminToggle').addEventListener('change', (e) => {
    if(e.target.checked) document.body.classList.add('admin-mode-active');
    else document.body.classList.remove('admin-mode-active');
});

// --- DASHBOARD E AVVISI ---
const dailyVerses = [
    { text: "Poiché Dio ha tanto amato il mondo...", ref: "Giovanni 3:16" },
    { text: "Io posso ogni cosa in colui che mi fortifica.", ref: "Filippesi 4:13" },
    { text: "Il Signore è il mio pastore: nulla mi manca.", ref: "Salmi 23:1" },
    { text: "Or la fede è certezza di cose che si sperano...", ref: "Ebrei 11:1" }
];

function updateDashboard() {
    const hour = new Date().getHours();
    document.getElementById('greetingMessage').textContent = hour < 12 ? "Buongiorno" : (hour < 18 ? "Buon pomeriggio" : "Buonasera");
    document.getElementById('currentDateDisplay').textContent = new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const verse = dailyVerses[dayOfYear % dailyVerses.length];
    document.getElementById('dailyVerseText').textContent = `"${verse.text}"`;
    document.getElementById('dailyVerseRef').textContent = `- ${verse.ref}`;

    document.getElementById('dashHymnsCount').textContent = hymnsDB.length;
    document.getElementById('dashSermonsCount').textContent = sermonsDB.length;

    const sortedAvvisi = avvisiDB.sort((a,b) => new Date(b.date) - new Date(a.date));
    if(sortedAvvisi.length > 0) {
        document.getElementById('dashNextEvent').textContent = sortedAvvisi[0].title;
        document.getElementById('dashNextEventDate').textContent = new Date(sortedAvvisi[0].date).toLocaleDateString('it-IT', {day:'numeric', month:'long'});
    } else {
        document.getElementById('dashNextEvent').textContent = "Nessuno";
        document.getElementById('dashNextEventDate').textContent = "Nessuna comunicazione recente";
    }
}

let editingAvvisoId = null;

function renderAvvisi() {
    const list = document.getElementById('avvisiList');
    list.innerHTML = '';
    const sortedAvvisi = avvisiDB.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(sortedAvvisi.length === 0) {
        list.innerHTML = '<p class="text-muted">Nessun avviso presente al momento.</p>';
        return;
    }
    
    sortedAvvisi.forEach(avviso => {
        const dateObj = new Date(avviso.date);
        const card = document.createElement('div');
        card.className = 'avviso-card';
        card.innerHTML = `
            <div class="admin-list-controls" style="position: absolute; top: 15px; right: 15px;">
                <button class="btn-edit" onclick="openAvvisoModal('${avviso.id}')"><i class="ri-pencil-line"></i></button>
                <button class="btn-delete" onclick="deleteAvviso('${avviso.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
            <div class="avviso-date">${dateObj.toLocaleDateString('it-IT', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
            <div class="avviso-title">${avviso.title}</div>
            <div class="avviso-desc">${avviso.desc}</div>
        `;
        list.appendChild(card);
    });
}

function openAvvisoModal(id = null) {
    if(id) {
        editingAvvisoId = id;
        const avv = avvisiDB.find(a => a.id === id);
        document.getElementById('avvisoModalTitle').textContent = "Modifica Avviso";
        document.getElementById('avvisoDate').value = avv.date;
        document.getElementById('avvisoTitle').value = avv.title;
        document.getElementById('avvisoDesc').value = avv.desc;
        document.getElementById('deleteAvvisoBtn').style.display = 'block';
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

function closeAvvisoModal() { document.getElementById('avvisoModal').classList.add('hidden'); }

document.getElementById('saveAvvisoBtn').onclick = async () => {
    const title = document.getElementById('avvisoTitle').value.trim();
    const date = document.getElementById('avvisoDate').value;
    const desc = document.getElementById('avvisoDesc').value.trim();
    if(!title || !date) return;
    
    const newAvviso = { id: editingAvvisoId || Date.now().toString(), date, title, desc };
    
    // Salva l'avviso su Supabase Cloud
    await supabaseClient.from('avvisi').upsert([newAvviso]);
    
    if(editingAvvisoId) {
        const index = avvisiDB.findIndex(a => a.id === editingAvvisoId);
        avvisiDB[index] = newAvviso;
    } else {
        avvisiDB.push(newAvviso);
    }
    closeAvvisoModal(); renderAvvisi(); updateDashboard();
};

async function deleteAvviso(id) {
    if(confirm("Sicuro di voler eliminare questo avviso?")) {
        await supabaseClient.from('avvisi').delete().eq('id', id);
        avvisiDB = avvisiDB.filter(a => a.id !== id);
        closeAvvisoModal(); renderAvvisi(); updateDashboard();
    }
}


// --- CANTICI: XML PARSER E CLOUD SYNC ---
document.getElementById('deleteAllHymnsBtn').addEventListener('click', async () => {
    if(hymnsDB.length === 0) return alert("Non ci sono cantici da cancellare.");
    if(confirm("ATTENZIONE! Sei sicuro di voler cancellare TUTTI i cantici dal cloud?\nQuesta azione è irreversibile.")) {
        // Rimuove tutti i cantici dal database Cloud
        for (let hymn of hymnsDB) {
            await supabaseClient.from('cantici').delete().eq('id', hymn.id);
        }
        hymnsDB = [];
        renderHymns(); updateDashboard();
    }
});

document.getElementById('xmlUpload').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    document.getElementById('hymnSearch').placeholder = "Caricamento nel Cloud in corso...";
    
    for (let file of files) {
        let text = await file.text();
        let title = file.name.replace(/\.[^/.]+$/, "");
        let content = text;
        
        if(file.name.endsWith('.xml')) {
            let safeText = text.replace(/xmlns(:\w+)?="[^"]*"/g, '');
            safeText = safeText.replace(/<br\s*\/?>/gi, '\n');
            const xmlDoc = new DOMParser().parseFromString(safeText, "text/xml");
            if(xmlDoc.querySelector("title")) title = xmlDoc.querySelector("title").textContent;
            
            let versesNodes = xmlDoc.querySelectorAll("verse, chorus, stanza");
            if(versesNodes.length === 0) versesNodes = xmlDoc.querySelectorAll("lines"); 
            
            if(versesNodes.length > 0) {
                let parsed = "";
                let lastBlockText = "";
                
                versesNodes.forEach(v => {
                    let vName = v.getAttribute("name") || v.tagName;
                    let isChorus = vName.toLowerCase().startsWith("c") || vName.toLowerCase().includes("chorus");
                    
                    let linesNodes = v.querySelectorAll("lines");
                    let blockText = "";
                    if(linesNodes.length > 0) {
                        linesNodes.forEach(line => { blockText += line.innerHTML.replace(/<[^>]+>/g, '').trim() + "\n"; });
                    } else {
                        blockText = v.innerHTML.replace(/<[^>]+>/g, '').trim();
                    }
                    
                    blockText = blockText.trim();
                    let normalizedCurrent = blockText.replace(/\s+/g, ' ');
                    let normalizedLast = lastBlockText.replace(/\s+/g, ' ');

                    if(blockText.length > 0 && normalizedCurrent !== normalizedLast) {
                        lastBlockText = blockText; 
                        if(isChorus) blockText = "Coro:\n" + blockText;
                        parsed += blockText + "\n\n";
                    }
                });
                content = parsed.trim();
            } else {
                let lyricsNode = xmlDoc.querySelector("lyrics") || xmlDoc.documentElement;
                content = lyricsNode.textContent.trim();
            }
        }
        
        const newHymn = { id: Date.now().toString() + Math.random().toString().slice(2,8), title: title, content: content };
        
        // Salva in Cloud su Supabase
        await supabaseClient.from('cantici').insert([newHymn]);
        hymnsDB.push(newHymn);
    }
    
    document.getElementById('hymnSearch').placeholder = "Cerca cantico...";
    renderHymns(); updateDashboard();
});

function renderHymns(hymnsArray = hymnsDB) {
    const list = document.getElementById('hymnsList'); list.innerHTML = '';
    const sorted = [...hymnsArray].sort((a, b) => a.title.localeCompare(b.title));
    
    sorted.forEach((hymn) => {
        const card = document.createElement('div'); card.className = 'hymn-card';
        card.innerHTML = `
            <div style="flex:1" onclick="openHymnSlides('${hymn.id}')">
                <span style="font-weight:600;">${hymn.title}</span>
            </div>
            <div class="admin-list-controls">
                <button class="btn-edit" onclick="openEditModal('${hymn.id}')"><i class="ri-pencil-line"></i></button>
                <button class="btn-delete" onclick="deleteHymn('${hymn.id}')"><i class="ri-delete-bin-line"></i></button>
            </div>
        `;
        list.appendChild(card);
    });
}

document.getElementById('hymnSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = hymnsDB.filter(h => h.title.toLowerCase().includes(term));
    renderHymns(filtered);
});

let editHymnId = null;
async function deleteHymn(id) { 
    if(confirm("Eliminare cantico?")) { 
        await supabaseClient.from('cantici').delete().eq('id', id);
        hymnsDB = hymnsDB.filter(h => h.id !== id); 
        renderHymns(); updateDashboard();
    } 
}
function openEditModal(id) { editHymnId = id; const hymn = hymnsDB.find(h => h.id === id); document.getElementById('editHymnTitle').value = hymn.title; document.getElementById('editHymnBody').value = hymn.content; document.getElementById('editModal').classList.remove('hidden'); }
function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); }
document.getElementById('saveEditHymnBtn').onclick = async () => { 
    const i = hymnsDB.findIndex(h => h.id === editHymnId); 
    hymnsDB[i].title = document.getElementById('editHymnTitle').value; 
    hymnsDB[i].content = document.getElementById('editHymnBody').value; 
    
    await supabaseClient.from('cantici').update({ title: hymnsDB[i].title, content: hymnsDB[i].content }).eq('id', editHymnId);
    
    renderHymns(); closeEditModal(); 
};


// --- LETTORE SLIDE CANTICI (AUTO-FIT MATEMATICO) ---
let currentHymnFontSize = 40; 
let isGridView = false;
const slidesContainer = document.getElementById('hymnSlidesContainer');
const gridContainer = document.getElementById('hymnGridContainer');
const dotsContainer = document.getElementById('slideDots');

document.getElementById('toggleGridViewBtn').onclick = () => {
    isGridView = !isGridView;
    if(isGridView) {
        document.getElementById('slidesWrapperView').classList.add('hidden');
        dotsContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-slideshow-line" style="font-size:18px;"></i>';
    } else {
        document.getElementById('slidesWrapperView').classList.remove('hidden');
        dotsContainer.classList.remove('hidden');
        gridContainer.classList.add('hidden');
        document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-grid-fill" style="font-size:18px;"></i>';
        setTimeout(autoFitHymn, 50);
    }
};

function openHymnSlides(id) {
    const hymn = hymnsDB.find(h => h.id === id);
    document.getElementById('hymnsListView').classList.add('hidden');
    document.getElementById('hymnReaderView').classList.remove('hidden');
    document.getElementById('currentHymnTitle').textContent = hymn.title;
    
    isGridView = false;
    document.getElementById('slidesWrapperView').classList.remove('hidden');
    dotsContainer.classList.remove('hidden');
    gridContainer.classList.add('hidden');
    document.getElementById('toggleGridViewBtn').innerHTML = '<i class="ri-grid-fill" style="font-size:18px;"></i>';

    slidesContainer.innerHTML = ''; dotsContainer.innerHTML = ''; gridContainer.innerHTML = '';
    
    const blocks = hymn.content.split(/\n\s*\n/);
    
    blocks.forEach((block, index) => {
        const cleanBlock = block.trim(); if(!cleanBlock) return;
        
        const isChorus = /coro|chorus|rit|ritornello/i.test(cleanBlock);
        const textToDisplay = cleanBlock.replace(/^(Coro|Chorus|Rit|Ritornello)\s*[:\-]?\s*/i, '').trim();
        
        const formattedLines = textToDisplay.split('\n').map(line => {
            return `<div class="hymn-line">${line || '&nbsp;'}</div>`;
        }).join('');
        
        const slide = document.createElement('div'); 
        slide.className = 'hymn-slide';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = `slide-content ${isChorus ? 'slide-chorus' : ''}`;
        contentDiv.innerHTML = formattedLines; 
        
        slide.appendChild(contentDiv);
        slidesContainer.appendChild(slide);
        
        const gridCard = document.createElement('div');
        gridCard.className = 'hymn-grid-card';
        gridCard.innerHTML = `
            <div class="grid-card-title">${isChorus ? 'Coro' : 'Strofa ' + (index+1)}</div>
            <div class="grid-card-preview ${isChorus ? 'slide-chorus' : ''}">${textToDisplay}</div>
        `;
        gridCard.onclick = () => {
            document.getElementById('toggleGridViewBtn').click(); 
            slidesContainer.scrollLeft = index * slidesContainer.clientWidth;
        };
        gridContainer.appendChild(gridCard);
        
        const dot = document.createElement('div');
        dot.className = `slide-dot ${index === 0 ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
    });
    
    slidesContainer.scrollLeft = 0;
    setTimeout(autoFitHymn, 50);
}

function autoFitHymn() {
    if(slidesContainer.clientWidth === 0) {
        setTimeout(autoFitHymn, 50);
        return;
    }

    const isMobile = window.innerWidth < 768;
    let fontSize = isMobile ? 60 : 90; 
    updateHymnFontSize(fontSize);
    void slidesContainer.offsetHeight;

    const maxWidth = slidesContainer.clientWidth - (isMobile ? 40 : 160); 
    const maxHeight = slidesContainer.clientHeight - (isMobile ? 40 : 80);

    let isFitting = false;

    while(!isFitting && fontSize > 14) {
        let overflow = false;
        
        document.querySelectorAll('.slide-content').forEach(slide => {
            if(slide.getBoundingClientRect().height > maxHeight) overflow = true;
            slide.querySelectorAll('.hymn-line').forEach(line => {
                if(line.getBoundingClientRect().width > maxWidth) overflow = true;
            });
        });
        
        if(overflow) {
            fontSize -= 2;
            updateHymnFontSize(fontSize);
            void slidesContainer.offsetHeight;
        } else {
            isFitting = true;
        }
    }
    
    currentHymnFontSize = Math.max(14, fontSize - 2);
    updateHymnFontSize(currentHymnFontSize);
}

document.getElementById('increaseHymnFont').onclick = () => { 
    if(isGridView) return;
    const isMobile = window.innerWidth < 768;
    const maxWidth = slidesContainer.clientWidth - (isMobile ? 40 : 160);
    const maxHeight = slidesContainer.clientHeight - (isMobile ? 40 : 80);
    
    let canIncrease = true;
    document.querySelectorAll('.slide-content').forEach(slide => {
        if(slide.getBoundingClientRect().height >= maxHeight) canIncrease = false;
        slide.querySelectorAll('.hymn-line').forEach(line => {
            if(line.getBoundingClientRect().width >= maxWidth) canIncrease = false;
        });
    });
    
    if(!canIncrease) return; 
    if(currentHymnFontSize < 120) { 
        currentHymnFontSize += 2; 
        updateHymnFontSize(currentHymnFontSize); 
    }
};

document.getElementById('decreaseHymnFont').onclick = () => { 
    if(isGridView) return;
    if(currentHymnFontSize > 14) { currentHymnFontSize -= 2; updateHymnFontSize(currentHymnFontSize); }
};

function updateHymnFontSize(size) { document.querySelectorAll('.slide-content').forEach(el => el.style.fontSize = `${size}px`); }

document.getElementById('nextSlideBtn').onclick = () => slidesContainer.scrollBy({ left: slidesContainer.clientWidth, behavior: 'smooth' });
document.getElementById('prevSlideBtn').onclick = () => slidesContainer.scrollBy({ left: -slidesContainer.clientWidth, behavior: 'smooth' });

slidesContainer.addEventListener('scroll', () => {
    const slideWidth = slidesContainer.clientWidth;
    if(slideWidth === 0) return;
    const currentSlide = Math.round(slidesContainer.scrollLeft / slideWidth);
    document.querySelectorAll('.slide-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });
});

document.getElementById('backToHymns').onclick = () => { document.getElementById('hymnReaderView').classList.add('hidden'); document.getElementById('hymnsListView').classList.remove('hidden'); };


// --- BIBBIA E EVIDENZIATURA ---
const bibleBooks = [
    {id: 1, name: "Genesi", ch: 50}, {id: 2, name: "Esodo", ch: 40}, {id: 3, name: "Levitico", ch: 27}, {id: 4, name: "Numeri", ch: 36}, {id: 5, name: "Deuteronomio", ch: 34},
    {id: 6, name: "Giosuè", ch: 24}, {id: 7, name: "Giudici", ch: 21}, {id: 8, name: "Rut", ch: 4}, {id: 9, name: "1 Samuele", ch: 31}, {id: 10, name: "2 Samuele", ch: 24},
    {id: 11, name: "1 Re", ch: 22}, {id: 12, name: "2 Re", ch: 25}, {id: 13, name: "1 Cronache", ch: 29}, {id: 14, name: "2 Cronache", ch: 36}, {id: 15, name: "Esdra", ch: 10},
    {id: 16, name: "Neemia", ch: 13}, {id: 17, name: "Ester", ch: 10}, {id: 18, name: "Giobbe", ch: 42}, {id: 19, name: "Salmi", ch: 150}, {id: 20, name: "Proverbi", ch: 31},
    {id: 21, name: "Ecclesiaste", ch: 12}, {id: 22, name: "Cantico", ch: 8}, {id: 23, name: "Isaia", ch: 66}, {id: 24, name: "Geremia", ch: 52}, {id: 25, name: "Lamentazioni", ch: 5},
    {id: 26, name: "Ezechiele", ch: 48}, {id: 27, name: "Daniele", ch: 12}, {id: 28, name: "Osea", ch: 14}, {id: 29, name: "Gioele", ch: 3}, {id: 30, name: "Amos", ch: 9},
    {id: 31, name: "Abdia", ch: 1}, {id: 32, name: "Giona", ch: 4}, {id: 33, name: "Michea", ch: 7}, {id: 34, name: "Naum", ch: 3}, {id: 35, name: "Abacuc", ch: 3},
    {id: 36, name: "Sofonia", ch: 3}, {id: 37, name: "Aggeo", ch: 2}, {id: 38, name: "Zaccaria", ch: 14}, {id: 39, name: "Malachia", ch: 4},
    {id: 40, name: "Matteo", ch: 28}, {id: 41, name: "Marco", ch: 16}, {id: 42, name: "Luca", ch: 24}, {id: 43, name: "Giovanni", ch: 21}, {id: 44, name: "Atti", ch: 28},
    {id: 45, name: "Romani", ch: 16}, {id: 46, name: "1 Corinzi", ch: 16}, {id: 47, name: "2 Corinzi", ch: 13}, {id: 48, name: "Galati", ch: 6}, {id: 49, name: "Efesini", ch: 6},
    {id: 50, name: "Filippesi", ch: 4}, {id: 51, name: "Colossesi", ch: 4}, {id: 52, name: "1 Tessalonicesi", ch: 5}, {id: 53, name: "2 Tessalonicesi", ch: 3},
    {id: 54, name: "1 Timoteo", ch: 6}, {id: 55, name: "2 Timoteo", ch: 4}, {id: 56, name: "Tito", ch: 3}, {id: 57, name: "Filemone", ch: 1}, {id: 58, name: "Ebrei", ch: 13},
    {id: 59, name: "Giacomo", ch: 5}, {id: 60, name: "1 Pietro", ch: 5}, {id: 61, name: "2 Pietro", ch: 3}, {id: 62, name: "1 Giovanni", ch: 5}, {id: 63, name: "2 Giovanni", ch: 1},
    {id: 64, name: "3 Giovanni", ch: 1}, {id: 65, name: "Giuda", ch: 1}, {id: 66, name: "Apocalisse", ch: 22}
];

const bookSelect = document.getElementById('bibleBook');
const chapterSelect = document.getElementById('bibleChapter');
const verseSelect = document.getElementById('bibleVerse');

bibleBooks.forEach(b => bookSelect.add(new Option(b.name, b.id)));
bookSelect.addEventListener('change', () => {
    chapterSelect.innerHTML = '<option value="">Cap</option>';
    const selectedBook = bibleBooks.find(b => b.id.toString() === bookSelect.value);
    for(let i = 1; i <= selectedBook.ch; i++) chapterSelect.add(new Option(i, i));
    chapterSelect.dispatchEvent(new Event('change'));
});

chapterSelect.addEventListener('change', () => {
    verseSelect.innerHTML = '<option value="">Vers</option>';
    if(!chapterSelect.value) return;
    for(let i = 1; i <= 150; i++) verseSelect.add(new Option(i, i)); 
});
bookSelect.dispatchEvent(new Event('change'));

let currentBibleFontSize = 22;

window.changeChapter = function(direction) {
    const current = parseInt(chapterSelect.value);
    const max = chapterSelect.options.length - 1;
    const next = current + direction;
    if(next >= 1 && next <= max) {
        chapterSelect.value = next;
        verseSelect.value = ""; 
        document.getElementById('fetchBibleBtn').click();
    }
};

async function fetchBibleData(version, bookId, chapter) {
    const directUrl = `https://bolls.life/get-chapter/${version}/${bookId}/${chapter}/`;
    try {
        const response = await fetch(directUrl);
        if(!response.ok) throw new Error("API limit");
        return await response.json();
    } catch (e) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;
        const res = await fetch(proxyUrl);
        if(res.ok) {
            const data = await res.json();
            return JSON.parse(data.contents);
        }
        throw new Error("Connessione fallita");
    }
}

document.getElementById('fetchBibleBtn').addEventListener('click', async () => {
    const version = document.getElementById('bibleVersion').value;
    const bookId = bookSelect.value;
    const bookName = bookSelect.options[bookSelect.selectedIndex].text;
    const chapter = chapterSelect.value;
    const verse = verseSelect.value;
    const reader = document.getElementById('bibleReaderContent');
    
    if(!chapter) return alert("Seleziona almeno un capitolo.");
    
    reader.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="ri-loader-4-line ri-spin" style="font-size: 32px; color: var(--accent-color);"></i><p style="margin-top:10px; color:var(--text-muted)">Connessione server in corso...</p></div>';
    document.getElementById('bibleControlsArea').classList.add('hidden');
    document.getElementById('showBibleControlsArea').classList.remove('hidden');
    
    try {
        const data = await fetchBibleData(version, bookId, chapter);
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
                <button class="btn-icon-small" onclick="changeChapter(-1)"><i class="ri-arrow-left-s-line"></i></button>
                <h2 style="font-weight:800; font-size:32px; color: var(--text-main); margin:0;">${bookName} ${chapter}</h2>
                <button class="btn-icon-small" onclick="changeChapter(1)"><i class="ri-arrow-right-s-line"></i></button>
            </div>
        `;
        
        data.forEach(v => {
            const cleanText = v.text.replace(/<\/?(?:span|i|b|div)[^>]*>/g, ''); 
            const isHighlight = highlightsDB.some(h => h.book === bookId && h.chapter === chapter && h.verse == v.verse);
            
            html += `<span class="bible-verse ${isHighlight ? 'highlighted' : ''}" id="verse-${v.verse}" data-book="${bookId}" data-bookname="${bookName}" data-chapter="${chapter}" data-verse="${v.verse}" data-text="${cleanText.replace(/"/g, '&quot;')}">
                        <sup style="color:var(--accent-color); font-weight:bold; font-size: 14px; margin-right:6px;">${v.verse}</sup>
                        ${cleanText}
                     </span>`;
        });
        
        reader.innerHTML = html;
        updateBibleFontSize();
        
        document.querySelectorAll('.bible-verse').forEach(el => {
            el.addEventListener('click', function() {
                const bId = this.dataset.book;
                const bName = this.dataset.bookname;
                const ch = this.dataset.chapter;
                const ve = this.dataset.verse;
                const txt = this.dataset.text;
                
                const existingIndex = highlightsDB.findIndex(h => h.book === bId && h.chapter === ch && h.verse == ve);
                
                if(existingIndex >= 0) {
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
        
        if(verse) {
            setTimeout(() => {
                const targetVerse = document.getElementById(`verse-${verse}`);
                if(targetVerse) {
                    targetVerse.scrollIntoView({behavior: "smooth", block: "center"});
                    const originalBg = targetVerse.style.background;
                    targetVerse.style.background = "rgba(0, 122, 255, 0.2)";
                    setTimeout(() => targetVerse.style.background = originalBg, 1500);
                }
            }, 200);
        }
        
    } catch (error) {
        reader.innerHTML = `<div style="text-align:center;"><p style="color:var(--danger-color); font-weight:bold;">Errore di Rete.</p><p style="color:var(--text-muted); font-size:16px;">Controlla la tua connessione e riprova.</p></div>`;
    }
});

document.getElementById('showBibleControlsBtn').addEventListener('click', () => {
    document.getElementById('bibleControlsArea').classList.remove('hidden');
    document.getElementById('showBibleControlsArea').classList.add('hidden');
});

function updateBibleFontSize() { document.getElementById('bibleReaderContent').style.fontSize = `${currentBibleFontSize}px`; }
document.getElementById('increaseBibleFont').onclick = () => { currentBibleFontSize += 2; updateBibleFontSize(); };
document.getElementById('decreaseBibleFont').onclick = () => { if(currentBibleFontSize > 14) currentBibleFontSize -= 2; updateBibleFontSize(); };


// --- SERMONI ---
const sTitle = document.getElementById('sermonTitle');
const sSpeaker = document.getElementById('sermonSpeaker');
const sCategory = document.getElementById('sermonCategory');
const sRefs = document.getElementById('sermonRefs');
const sBody = document.getElementById('sermonBody');
let activeSermonId = null;

function renderSermons() {
    const ul = document.getElementById('sermonsUl');
    ul.innerHTML = '<li onclick="newSermon()" style="color:var(--accent-color); font-weight:700; cursor:pointer; padding:15px;"><i class="ri-add-circle-line" style="font-size:20px; vertical-align:middle; margin-right:5px;"></i> Nuovo Appunto</li>';
    
    sermonsDB.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="sermon-badge">${s.category || 'Sermone'}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <i class="ri-file-list-3-line text-muted"></i> 
                <span style="font-size:15px;">${s.title || "Senza titolo"}</span>
            </div>
        `;
        li.style.padding = "15px"; li.style.borderBottom = "1px solid var(--border-color)"; li.style.cursor = "pointer"; li.style.display = "flex"; li.style.flexDirection = "column"; li.style.gap = "6px";
        li.onclick = () => {
            activeSermonId = s.id;
            sTitle.value = s.title; sSpeaker.value = s.speaker; sCategory.value = s.category || "Sermone"; sRefs.value = s.refs || ""; sBody.value = s.body;
            document.getElementById('deleteSermonBtn').style.display = 'block';
        };
        ul.appendChild(li);
    });
}

function renderHighlights() {
    const ul = document.getElementById('highlightsUl');
    ul.innerHTML = '';
    if(highlightsDB.length === 0) {
        ul.innerHTML = '<li style="padding: 15px; font-size:12px; color:var(--text-muted); text-align:center;">Nessun versetto evidenziato.</li>';
        return;
    }
    
    [...highlightsDB].reverse().forEach(h => {
        const li = document.createElement('li');
        li.className = 'highlight-item';
        li.innerHTML = `<strong style="color:#ff9500;">${h.bookName} ${h.chapter}:${h.verse}</strong><br>"${h.text}"`;
        
        li.onclick = () => {
            const currentText = sBody.value;
            const textToInsert = `\n\n[${h.bookName} ${h.chapter}:${h.verse}] "${h.text}"\n`;
            sBody.value = currentText + textToInsert;
            sBody.focus();
            
            li.style.background = "#34c759";
            li.style.color = "white";
            setTimeout(() => { li.style.background = ""; li.style.color = ""; }, 500);
        };
        ul.appendChild(li);
    });
}

function newSermon() { 
    activeSermonId = null; sTitle.value = ""; sSpeaker.value = ""; sCategory.value = "Sermone"; sRefs.value = ""; sBody.value = ""; 
    document.getElementById('deleteSermonBtn').style.display = 'none';
}

document.getElementById('saveSermonBtn').onclick = async () => {
    if(!sTitle.value && !sBody.value) return;
    const data = { id: activeSermonId || Date.now().toString(), title: sTitle.value, speaker: sSpeaker.value, category: sCategory.value, refs: sRefs.value, body: sBody.value };
    
    // Salva su Supabase Cloud
    await supabaseClient.from('sermoni').upsert([data]);
    
    if(activeSermonId) {
        const idx = sermonsDB.findIndex(s => s.id === activeSermonId);
        sermonsDB[idx] = data;
    } else {
        sermonsDB.unshift(data);
        activeSermonId = data.id;
    }
    renderSermons(); updateDashboard();
    document.getElementById('deleteSermonBtn').style.display = 'block';
    
    const btn = document.getElementById('saveSermonBtn'); 
    btn.innerHTML = "<i class='ri-check-line'></i> Salvato"; 
    setTimeout(() => btn.innerHTML = "<i class='ri-save-3-line'></i> Salva", 2000);
};

document.getElementById('deleteSermonBtn').onclick = async () => {
    if(confirm("Sei sicuro di voler eliminare questo appunto?")) {
        await supabaseClient.from('sermoni').delete().eq('id', activeSermonId);
        sermonsDB = sermonsDB.filter(s => s.id !== activeSermonId);
        newSermon(); renderSermons(); updateDashboard();
    }
};

renderSermons();