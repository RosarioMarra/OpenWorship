<p align="center">
  <img src="immagini/icon-192.png" alt="Open Worship" width="96" height="96">
</p>

<h1 align="center">Open Worship</h1>

<p align="center">
  Cantici, Bibbia, avvisi e appunti della tua chiesa, in un'unica app.<br>
  <a href="https://rosariomarra.github.io/OpenWorship/"><strong>Apri l'app »</strong></a>
</p>

---

## Cos'è

**Open Worship** è un'app web installabile (PWA) pensata per la vita della chiesa: raccoglie l'archivio dei cantici, la lettura della Bibbia, gli avvisi della comunità e gli appunti personali. Funziona da computer, tablet e smartphone, e si può aggiungere alla schermata Home come una normale app.

L'accesso avviene con l'account Google; i dati sono salvati su [Supabase](https://supabase.com).

## Funzionalità

### Dashboard
- Versetto del giorno, condivisibile come immagine (quadrato, post, storia)
- Ultimo avviso in evidenza, cantici recenti e preferiti
- Ricerca rapida dei cantici

### Cantici
- Archivio con ricerca per titolo, numero o parole del testo
- Preferiti, cantici recenti, dimensione del testo regolabile
- Metronomo con BPM e tempo del cantico, scorrimento automatico
- Accordi con cambio di tonalità e capotasto *(in arrivo)*

### Proiezione (amministratore)
- Proiezione su questo dispositivo o su un secondo schermo con **regia**: anteprima, diretta, schermo nero
- Sfondi a tinta unita, foto, **sfondi animati** o immagine personale
- Scelta del carattere, grandezza, grassetto, maiuscolo
- Transizioni (dissolvenza, scorrimento, zoom, sfocatura) e comandi da tastiera

### Bibbia
- Nuova Riveduta (2006), Riveduta Luzzi (1927), Diodati (1649)
- Lettura a paragrafo come in una Bibbia stampata, modalità a schermo pieno
- Impostazioni di lettura: carattere, grandezza, interlinea, colore della pagina
- Selezione dei versetti: evidenziazione a colori, copia, condivisione, immagine, appunto

### Avvisi e notifiche
- Avvisi della chiesa pubblicati dall'amministratore
- Notifiche push sul telefono, anche con l'app chiusa

### Appunti
- Appunti personali per prediche, studi biblici e riunioni
- Ricerca, filtri per categoria, editor con formattazione, bozza automatica
- Stampa o salvataggio in PDF

### Generale
- Tema chiaro, scuro o automatico
- Grafica responsive per telefono, tablet e computer
- Funzionamento offline delle parti già caricate

## Struttura del progetto

```
OpenWorship/
├── index.html                     Pagina dell'app
├── style.css                      Grafica
├── script.js                      Logica principale (accesso, cantici, Bibbia, avvisi, appunti, notifiche)
├── dashboard.js                   Dashboard e versetto del giorno
├── projection.js                  Proiezione e regia
├── chords.js                      Accordi, metronomo, scorrimento
├── sw.js                          Service worker (offline e notifiche push)
├── manifest.json                  Dati per l'installazione come app
├── immagini/                      Logo e icone
├── supabase-sicurezza.sql         Regole di accesso ai dati (Supabase)
├── supabase-notifiche-push.sql    Tabella dei dispositivi per le notifiche
└── supabase/functions/
    └── notifica-avviso/           Funzione che invia le notifiche push
```

## Configurazione di Supabase

1. **Accesso con Google** – in *Authentication → Providers* attivare Google; in *Authentication → URL Configuration* aggiungere l'indirizzo dell'app tra i *Redirect URLs*.
2. **Regole di sicurezza** – eseguire `supabase-sicurezza.sql` nel *SQL Editor* (cantici e avvisi modificabili solo dagli amministratori, appunti privati per ogni utente).
3. **Notifiche push**
   - eseguire `supabase-notifiche-push.sql`;
   - in *Edge Functions → Secrets* inserire `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (la chiave privata non va mai pubblicata);
   - creare una Edge Function con il codice di `supabase/functions/notifica-avviso/index.ts`;
   - creare un *Database Webhook* sulla tabella `avvisi`, evento *Insert*, che chiama la funzione.

## Pubblicazione

L'app è statica: non richiede compilazione. È pubblicata con **GitHub Pages** dal ramo `main`; ogni modifica inviata su `main` viene messa online in pochi minuti.

## Autore

Realizzata da **Rosario Marra** – [www.rosariomarra.it](https://www.rosariomarra.it)
