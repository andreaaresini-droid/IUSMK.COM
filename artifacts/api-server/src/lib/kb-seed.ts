import { db } from "@workspace/db";
import { knowledgeBaseTable } from "@workspace/db/schema";
import { count, sql } from "drizzle-orm";

const KB_STALE_TITLES = [
  "Chiamate o messaggi a IUSMK",
  "Contatti IUSMK - numero telefono",
  "Recupero password",
  "Problemi di accesso account",
  "Dove vedere le notifiche del proprio account",
  "Cosa fare dopo l'acquisto di un corso",
  "Dove trovare il codice del corso",
  "Se non trovo il codice del corso",
  "Cosa si può acquistare sul sito",
  // superseded by dedicated iPhone/Android entries + better keyword versions
  "Come aggiungere IUSMK alla schermata Home",
  "Come installare il sito IUSMK sul telefono",
  "Come rispondere su notifiche push e home screen",
  "Come attivare le notifiche push",
  "Si può usare IUSMK come un'app?",
  // informazione falsa — IUSMK non ha studio fisico pubblico a Milano né Londra
  "Sedi: Milano e Londra",
  // contiene "con base a Milano e Londra" — rimossa e sostituita
  "Contatti IUSMK (informazioni generali)",
  // contiene "tariffe e sede" — rimossa e sostituita
  "Prezzi servizi",
  // sostituite da voci più precise e aggiornate
  "Chi è IUSMK",
  "Servizi offerti",
  "A cosa serve il sito IUSMK",
  "Il sito IUSMK vende servizi in presenza",
  "Assistenza clienti IUSMK",
  // duplicati o outdated
  "Se l assistente AI non conosce una risposta",
  "Se l'assistente AI non conosce una risposta",
];

const KB_ALL_ENTRIES = [
  // ── Chi è IUSMK ──────────────────────────────────────────────────────────────
  { title: "Chi è IUSMK", category: "sito", keywords: "chi è iusmk, barber, artista, formazione, giuseppe musto, chi è giuseppe", content: "IUSMK è un barber artist. Il sito serve a presentare il suo lavoro e a mettere a disposizione videocorsi professionali dedicati al settore barber." },
  // "Sedi: Milano e Londra" RIMOSSA — informazione non verificata/falsa
  { title: "Servizi offerti", category: "sito", keywords: "servizi, taglio, fade, barba, capelli, styling, cosa fa iusmk", content: "IUSMK è un barber artist specializzato. Il sito non è strutturato come piattaforma di prenotazione: serve principalmente per presentare il lavoro e per acquistare i videocorsi Academy." },
  { title: "Academy e Corsi", category: "corsi", keywords: "academy, corsi, formazione, video, lezioni, barber, tecnica", content: "L'IUSMK Academy offre corsi video professionali per barber. Acquistabili via Stripe oppure accessibili con codice a 6 cifre. I video sono disponibili nell'area personale dopo acquisto o attivazione codice." },
  { title: "Prenotazioni: il sito non gestisce appuntamenti", category: "sito", keywords: "prenotazioni, appuntamenti, tagli, taglio, barba, booking, prenotare, prenotazione", content: "Il sito IUSMK non è un sistema per prenotare tagli o appuntamenti. Non è possibile prenotare sessioni in presenza tramite il sito. Il sito serve principalmente per conoscere IUSMK e acquistare i suoi videocorsi." },
  { title: "Contatti IUSMK (informazioni generali)", category: "contatti", keywords: "contatti, dove, indirizzo, email, instagram, dove si trova, studio, sede", content: "Per contattare IUSMK usa email, Instagram o la sezione Contatto del menu del sito. Il sito non indica uno studio fisico aperto al pubblico." },
  { title: "Prezzi servizi", category: "prezzi", keywords: "prezzi, costo, quanto costa, tariffe, listino", content: "I prezzi dei corsi sono indicati nelle pagine dei corsi sul sito. Per qualsiasi altra informazione sui prezzi contatta IUSMK direttamente tramite la sezione Contatto." },
  { title: "Account e acquisto corsi", category: "corsi", keywords: "account, registrazione, login, acquisto, pagamento, stripe", content: "Per acquistare i corsi crea un account gratuito sul sito (sezione Registrati). Dopo il login puoi acquistare via Stripe. I contenuti video sono accessibili subito dopo il pagamento." },
  { title: "Codice di accesso a 6 cifre", category: "corsi", keywords: "codice, accesso, 6 cifre, attivare, codice segreto, inserire", content: "Alcuni corsi possono essere attivati con un codice a 6 cifre fornito da Giuseppe Musto. Vai alla sezione Accesso del sito, digita il codice ricevuto e avrai accesso immediato al corso." },
  { title: "Password dimenticata - come resettarla", category: "password", keywords: "password dimenticata, reset password, recupero password, non ricordo password, email reset, link reset, spam", content: "Se hai dimenticato la password: vai su \"Accedi\", clicca su \"Password dimenticata\", inserisci la tua email e attendi l'email con il link per il reset. Se l'email non arriva controlla la cartella spam." },
  { title: "A cosa serve il sito IUSMK", category: "sito", keywords: "sito iusmk, a cosa serve, giuseppe, barber artist, informazioni, presentazione", content: "Il sito IUSMK serve per mostrare chi è Giuseppe, cosa fa e per permettere agli utenti di acquistare i suoi corsi. Il sito non è un sistema di prenotazione appuntamenti." },
  { title: "Prenotazioni tagli", category: "sito", keywords: "prenotazioni, appuntamenti, tagli, taglio, barba, booking, prenotare, prenotazione", content: "Al momento il sito IUSMK non è pensato per prenotare tagli o appuntamenti. Serve soprattutto per conoscere IUSMK e acquistare i suoi videocorsi." },
  { title: "Il sito serve per acquistare corsi", category: "corsi", keywords: "masterclass, corsi, formazione, acquisto corsi, comprare corso, cosa si compra", content: "Il sito IUSMK permette di acquistare i corsi dedicati ai contenuti di Giuseppe. I corsi si trovano nella sezione \"Corsi\" del menu." },
  { title: "Contenuti dei corsi IUSMK", category: "corsi", keywords: "corsi, tagli, sfumature, colori, formazione, barber", content: "I corsi IUSMK sono contenuti formativi che insegnano tecniche barber, come tagli, sfumature, colori e lavorazioni simili. I contenuti possono variare in base al corso acquistato." },
  { title: "Come si sbloccano i corsi acquistati", category: "accesso", keywords: "sbloccare corso, codice, accesso corso, notifiche, acquisto, sblocco, sblocca, trovare", content: "Dopo l'acquisto, il corso si sblocca tramite un codice. Il codice viene inviato nella sezione notifiche del cliente all'interno del sito." },
  { title: "Dove arriva il codice del corso", category: "notifiche", keywords: "codice corso, dove arriva il codice, notifiche, sbloccare corso, dove trovare codice", content: "Dopo l'acquisto, il codice arriva nella sezione \"Notifiche\" del menu, all'interno del tuo account. Devi essere connesso per vederlo." },
  { title: "Cosa fare se non trovo il codice del corso", category: "supporto", keywords: "non trovo codice, codice assente, notifiche, corso bloccato, codice mancante", content: "Se non trovi il codice del corso: verifica di aver effettuato l'accesso al tuo account e poi controlla la sezione \"Notifiche\" nel menu." },
  { title: "Politica resi", category: "policy", keywords: "resi, rimborso, restituzione, acquisto, policy", content: "Per eventuali richieste di reso o rimborso, il cliente deve contattare personalmente Giuseppe. Sarà Giuseppe a valutare caso per caso se effettuare o meno il reso." },
  { title: "Come richiedere un reso", category: "policy", keywords: "richiedere reso, rimborso, giuseppe, supporto", content: "Le richieste di reso non sono automatiche. Il cliente deve contattare direttamente Giuseppe e spiegare la situazione. La decisione finale sul reso viene presa personalmente da Giuseppe." },
  { title: "Contatti IUSMK", category: "contatti", keywords: "contatti, email, instagram, modulo contatto, come contattare", content: "I contatti ufficiali di Giuseppe sono: email, Instagram e la sezione Contatto del menu del sito. Non è previsto contatto tramite telefono o WhatsApp." },
  { title: "Come contattare Giuseppe", category: "contatti", keywords: "contattare giuseppe, contatti, email, instagram, modulo contatto, assistenza", content: "Per contattare Giuseppe non si usa WhatsApp o telefono. I contatti disponibili sono: email, Instagram e la sezione Contatto nel menu del sito." },
  { title: "Come accedere al proprio account", category: "accesso", keywords: "accedi, login, entrare, account, profilo, accesso", content: "Per accedere al proprio account usa il tasto \"Accedi\" in alto a destra del sito. Se non hai ancora un account clicca su \"Registrati ora\"." },
  { title: "Dove trovare le notifiche", category: "notifiche", keywords: "notifiche, menu notifiche, dove sono le notifiche, account, codice corso", content: "Le notifiche si trovano nella sezione \"Notifiche\" del menu, dopo aver effettuato l'accesso al proprio account." },
  { title: "Il sito IUSMK vende servizi in presenza", category: "sito", keywords: "servizi, presenza, taglio, tagli, barber shop, appuntamento, prenotare", content: "Il sito IUSMK non è pensato come sistema di prenotazione di servizi in presenza. È principalmente una piattaforma informativa e formativa dedicata all'attività di IUSMK e ai suoi corsi." },
  { title: "Assistenza clienti IUSMK", category: "supporto", keywords: "assistenza, aiuto, supporto, clienti, contatti", content: "Per assistenza su accesso, corsi, codici, resi o informazioni generali, il cliente può usare le informazioni presenti sul sito oppure contattare direttamente Giuseppe quando necessario." },
  { title: "Codici di accesso ai corsi", category: "accesso", keywords: "codici accesso, corsi, sblocco, notifiche, sbloccare, trovare, dove", content: "I codici di accesso servono a sbloccare i corsi acquistati. Dopo l'acquisto, il cliente deve controllare la sezione notifiche del proprio account per trovare il codice ricevuto." },
  { title: "Se l assistente AI non conosce una risposta", category: "supporto", keywords: "assistente ai, risposta mancante, informazione mancante", content: "Se l'assistente AI non trova una risposta certa nelle informazioni disponibili, informerà il cliente che al momento non può dare quell'informazione con certezza e segnalerà la richiesta all'admin per aggiornare la Knowledge Base." },
  { title: "Cosa succede dopo l'acquisto di un corso", category: "corsi", keywords: "dopo acquisto, dopo aver comprato, corso acquistato, notifiche, cosa succede", content: "Dopo aver acquistato un corso, riceverai una notifica nella sezione \"Notifiche\" del menu del tuo account con il codice per sbloccare il corso." },
  { title: "Se l'assistente AI non conosce una risposta", category: "supporto", keywords: "assistente ai, risposta mancante, informazione mancante", content: "Se l'assistente AI non trova una risposta certa nelle informazioni disponibili, informerà il cliente che al momento non può dare quell'informazione con certezza e segnalerà la richiesta all'admin per aggiornare la Knowledge Base." },
  { title: "Come acquistare un corso", category: "corsi", keywords: "acquisto corso, comprare corso, comprare, acquistare, corsi menu, dove acquistare, come compro, come acquisto", content: "Per acquistare un corso bisogna entrare nella sezione \"Corsi\" dal menu del sito e completare l'acquisto da lì. Dopo il pagamento ricevi un codice nella sezione Notifiche." },
  { title: "Come prenotare un taglio con IUSMK", category: "prenotazioni", keywords: "prenotare taglio, appuntamento, booking, come prenotare, prenotazione online", content: "Il sito IUSMK non gestisce prenotazioni online per tagli o appuntamenti. Per prenotare un appuntamento con Giuseppe usa email, Instagram o la sezione Contatto del menu del sito." },
  { title: "Si possono prenotare appuntamenti dal sito?", category: "prenotazioni", keywords: "prenotare, appuntamento, booking, taglio, barba, prenotazione, posso prenotare", content: "No, dal sito IUSMK non è possibile effettuare prenotazioni. Il sito serve solo per mostrare chi è Giuseppe, cosa fa e per acquistare i corsi disponibili." },
  { title: "Come prenotare un appuntamento", category: "prenotazioni", keywords: "come prenoto, appuntamento, prenotazione, taglio, barba, come si prenota", content: "Al momento il sito IUSMK non permette di prenotare appuntamenti. Per qualsiasi richiesta di appuntamento usa email, Instagram o la sezione Contatto del menu." },
  { title: "Dove si comprano i corsi", category: "corsi", keywords: "comprare corso, acquistare corso, corsi, dove comprare, menu corsi, sezione corsi", content: "I corsi si acquistano dal sito nella sezione \"Corsi\" presente nel menu." },
  { title: "A cosa serve il codice del corso", category: "corsi", keywords: "codice corso, sbloccare corso, accesso corso, codice accesso, a cosa serve il codice", content: "Il codice ricevuto dopo l'acquisto serve per sbloccare il corso acquistato." },
  { title: "Per vedere il codice bisogna accedere all account", category: "accesso", keywords: "account, accedere, login, notifiche, codice corso, bisogna entrare", content: "Sì, per vedere la notifica con il codice del corso bisogna prima effettuare l'accesso al proprio account." },
  { title: "Come creare un account", category: "account", keywords: "creare account, registrazione, registrarsi, accedi, registrati ora, nuovo account", content: "Per creare un account bisogna premere in alto a destra su \"Accedi\" e poi su \"Registrati ora\"." },
  { title: "Come registrarsi al sito", category: "account", keywords: "registrati, registrazione, creare profilo, nuovo account, come mi registro, iscriversi", content: "Chi non ha ancora un account può registrarsi cliccando su \"Accedi\" in alto a destra e poi su \"Registrati ora\"." },
  { title: "Si può contattare Giuseppe su WhatsApp?", category: "contatti", keywords: "whatsapp, telefono, numero, chiamare, messaggio, whatsapp giuseppe", content: "No, Giuseppe non si contatta tramite WhatsApp o numero di telefono. I contatti disponibili sono email, Instagram e la sezione Contatto del sito." },
  { title: "Si può chiamare Giuseppe al telefono?", category: "contatti", keywords: "telefono, chiamare, numero, contatto telefonico, numero telefono giuseppe", content: "No, il contatto telefonico non è previsto. Per contattare Giuseppe usa email, Instagram oppure la sezione Contatto del menu del sito." },
  { title: "Contattare Giuseppe tramite sezione Contatto", category: "contatti", keywords: "contatto, menu contatto, richiesta, messaggio sito, modulo contatto", content: "Per qualsiasi richiesta puoi contattare Giuseppe tramite la sezione Contatto presente nel menu del sito." },
  { title: "Contatti ufficiali di Giuseppe", category: "contatti", keywords: "email, instagram, contatti ufficiali, supporto, come si contatta", content: "I contatti ufficiali di Giuseppe sono: email, Instagram e la sezione Contatto del menu del sito. Non è previsto contatto telefonico o via WhatsApp." },
  { title: "Link Instagram di Giuseppe", category: "contatti", keywords: "instagram, profilo instagram, link instagram, social, instagram giuseppe", content: "Per contattare Giuseppe tramite Instagram usa questo link: [INSERIRE_LINK_INSTAGRAM_REALE]" },
  { title: "Email di contatto di Giuseppe", category: "contatti", keywords: "email, mail, contatto email, supporto email, email giuseppe", content: "Per contattare Giuseppe tramite email usa questo indirizzo: [INSERIRE_EMAIL_REALE]" },
  { title: "Bisogna avere un account per notifiche e codici?", category: "account", keywords: "account notifiche, login, codice corso, accesso utente, bisogna essere loggati", content: "Sì, per visualizzare notifiche e codici bisogna essere connessi al proprio account." },
  { title: "Domande su funzioni non disponibili", category: "supporto", keywords: "funzione non disponibile, prenotazione, whatsapp, telefono, non disponibile", content: "Se un utente chiede una funzione non disponibile (come prenotazioni dal sito o contatto via WhatsApp/telefono), l'assistente deve chiarire che quella funzione non è prevista e indicare il metodo corretto disponibile." },
  { title: "Come rispondere sulle prenotazioni", category: "supporto", keywords: "prenotazione, appuntamento, taglio, risposta assistente, come rispondo", content: "Se un utente chiede come prenotare, la risposta è: dal sito non si effettuano prenotazioni. Il sito serve solo a mostrare chi è Giuseppe, cosa fa e a vendere i corsi." },
  { title: "Come rispondere sui contatti", category: "supporto", keywords: "contatti assistente, email, instagram, contatto menu, risposta contatti", content: "Se un utente chiede come contattare Giuseppe: non si usa WhatsApp o telefono. I contatti disponibili sono email, Instagram e la sezione Contatto del menu." },
  { title: "Come rispondere su login e password", category: "supporto", keywords: "login, password, registrazione, reset, email spam, accesso problemi", content: "Per problemi di accesso: per registrarsi cliccare su Accedi poi Registrati ora. Per password dimenticata: cliccare su Password dimenticata nella schermata di accesso, inserire email, attendere email di reset e controllare anche lo spam." },

  // ── Push notifications ────────────────────────────────────────────────────
  {
    title: "Come attivare le notifiche push",
    category: "notifiche",
    keywords: "notifiche push, attivare notifiche, push notification, come attivo le notifiche, come attivo notifiche push, come posso attivare le notifiche, come faccio ad attivare le notifiche, come ricevo le notifiche, dove attivo le notifiche, come abilito le notifiche push, abilitare notifiche, notifiche sito, attivo notifiche, attivare push",
    content: "Per attivare le notifiche push devi:\n1. Accedere al tuo account sul sito IUSMK\n2. Aprire il menu del sito\n3. Entrare nella sezione \"Notifiche\"\n4. Premere il tasto per attivare le notifiche push\n\nDopo l'attivazione potrai ricevere notifiche su messaggi, corsi e aggiornamenti del sito.",
  },

  // ── Home screen iPhone ────────────────────────────────────────────────────
  {
    title: "Come aggiungere IUSMK alla schermata Home su iPhone",
    category: "sito",
    keywords: "home screen iphone, aggiungere sito alla home iphone, aggiungo sito alla home, schermata home iphone, usare sito come app iphone, installare sito iphone, aggiungere iusmk alla schermata iniziale, icona sito telefono, safari aggiungi a home, metto il sito sulla home, app iphone, installare iusmk iphone",
    content: "Su iPhone puoi aggiungere IUSMK alla schermata Home così:\n1. Apri il sito con Safari\n2. Premi il tasto Condividi (icona con freccia in alto)\n3. Scorri e seleziona \"Aggiungi a Home\"\n4. Conferma\n\nDopo averlo aggiunto, potrai aprire IUSMK dalla schermata Home come se fosse un'app.",
  },

  // ── Home screen Android ───────────────────────────────────────────────────
  {
    title: "Come aggiungere IUSMK alla schermata Home su Android",
    category: "sito",
    keywords: "home screen android, aggiungere sito alla home android, aggiungo sito alla home android, schermata home android, usare sito come app android, installare sito android, aggiungere iusmk alla schermata iniziale android, chrome aggiungi a schermata home, installa app android, metto il sito sulla home android, app android, installare iusmk android",
    content: "Su Android puoi aggiungere IUSMK alla schermata Home così:\n1. Apri il sito con Chrome\n2. Premi il menu del browser (tre puntini in alto a destra)\n3. Seleziona \"Aggiungi a schermata Home\" oppure \"Installa app\" se disponibile\n4. Conferma\n\nDopo averlo aggiunto, potrai aprire IUSMK dalla schermata Home come se fosse un'app.",
  },

  // ── Home + notifiche combinato ─────────────────────────────────────────────
  {
    title: "Come aggiungere IUSMK alla Home e attivare le notifiche",
    category: "sito",
    keywords: "aggiungere sito e attivare notifiche, usare come app e notifiche, installare iusmk e attivare notifiche, home e notifiche, schermata home e push, iusmk app notifiche, aggiungo sito attivo notifiche, entrambe le cose app e notifiche",
    content: "Per usare IUSMK come un'app e attivare le notifiche:\n1. Aggiungi il sito alla schermata Home (su iPhone con Safari → Condividi → Aggiungi a Home; su Android con Chrome → menu → Aggiungi a schermata Home)\n2. Apri IUSMK dalla schermata Home\n3. Accedi al tuo account\n4. Apri il menu del sito\n5. Entra nella sezione \"Notifiche\"\n6. Premi il tasto per attivare le notifiche push",
  },

  // ── Usare come app (generico) ─────────────────────────────────────────────
  {
    title: "Si può usare IUSMK come un'app?",
    category: "sito",
    keywords: "usare come app, applicazione iusmk, iusmk app, app giuseppe, installare come app, sito come app, app telefono, app iphone android, pwa, web app, installare iusmk, iusmk sul telefono, aggiungere iusmk al telefono",
    content: "Sì, puoi usare IUSMK come un'app aggiungendolo alla schermata Home del tuo telefono.\n\nSu iPhone: apri il sito con Safari, premi il tasto Condividi e seleziona \"Aggiungi a Home\".\nSu Android: apri il sito con Chrome, premi il menu del browser e scegli \"Aggiungi a schermata Home\" o \"Installa app\".\n\nDopo averlo aggiunto, IUSMK si apre dalla schermata Home come una normale app.",
  },

  // ── Download / salvataggio video (policy) ─────────────────────────────────
  {
    title: "I corsi non possono essere scaricati o registrati",
    category: "download",
    keywords: "scaricare corso, download video, salvare video, registrare video, offline, come scaricare, posso scaricare, posso registrare, salvare corso, posso salvare, vedere offline, guardare offline, scarico corso, video offline, download corso, salva video, registrare schermo, screen recording, copiare video, portare offline, salvare sul telefono, scaricare sul telefono, mettere sul telefono, scaricare i corsi, download dei corsi, scaricarlo",
    content: "I videocorsi acquistati su IUSMK non possono essere scaricati, salvati o registrati sul proprio dispositivo. I contenuti sono protetti da diritti d'autore e sono accessibili esclusivamente all'interno della piattaforma, tramite il proprio account. Qualsiasi tentativo di download, registrazione o condivisione non autorizzata è vietato. Puoi accedere ai corsi in qualsiasi momento effettuando il login e andando nella sezione \"I miei corsi\".",
  },

  // ── FAQ 01–06: Studio / sede / dove si trova ─────────────────────────────
  { title: "Dove si trova lo studio di IUSMK", category: "sede", keywords: "dove si trova, studio iusmk, sede, indirizzo, dove è, dove lavora, dov è iusmk, studio fisico, trova iusmk, posizione, dove abita giuseppe, dove vive iusmk", content: "Sul sito non è indicato uno studio fisico aperto al pubblico. Se hai bisogno di informazioni precise o vuoi metterti in contatto con IUSMK, usa la sezione Contatto." },
  { title: "IUSMK ha uno studio a Milano", category: "sede", keywords: "studio milano, sede milano, iusmk milano, giuseppe milano, barber milano, dove milano, lavora a milano, apre a milano, appuntamento milano", content: "No, il sito non indica uno studio pubblico a Milano. Per informazioni ufficiali aggiornate, contatta IUSMK tramite la sezione Contatto." },
  { title: "IUSMK ha uno studio a Londra", category: "sede", keywords: "studio londra, sede londra, iusmk londra, giuseppe londra, barber londra, dove londra, lavora a londra, apre a londra, appuntamento londra", content: "No, questa informazione non è presente sul sito. Per chiarimenti ufficiali, usa la sezione Contatto." },
  { title: "IUSMK è in Italia", category: "sede", keywords: "italia, italiano, in italia, paese, dove opera, è italiano, nazionalità iusmk", content: "Sì, IUSMK è in Italia. Se ti servono dettagli specifici sulla sede, usa la sezione Contatto del sito." },
  { title: "IUSMK lavora anche all'estero", category: "sede", keywords: "estero, londra, internazionale, altro paese, lavora fuori, fuori italia, all estero, estero iusmk", content: "Questa informazione non è specificata sul sito. Per dettagli aggiornati, usa la sezione Contatto." },
  { title: "Indirizzo preciso di IUSMK", category: "sede", keywords: "indirizzo, via, civico, cap, dove esattamente, indirizzo iusmk, dove si trova esattamente", content: "L'indirizzo non è indicato sul sito. Se non è presente nella sezione Contatto, non trovo questa informazione qui. Ti consiglio di contattare IUSMK direttamente tramite la sezione Contatto." },

  // ── FAQ 07–10: A cosa serve il sito ──────────────────────────────────────
  { title: "A cosa serve il sito IUSMK", category: "sito", keywords: "sito iusmk, a cosa serve, cosa fa il sito, presentazione sito, cosa trovo, perché esiste il sito", content: "Il sito serve a presentare IUSMK, mostrare la galleria dei lavori, permettere l'acquisto dei videocorsi Academy e mettere gli utenti in contatto tramite la sezione Contatto." },
  { title: "Il sito serve per prenotare servizi barber", category: "sito", keywords: "prenotare barber, sito prenotazione, barber shop online, prenoto taglio, taglio dal sito, sito per taglio", content: "No, il sito non è impostato come piattaforma di prenotazione per servizi barber. Serve principalmente per presentare IUSMK e per acquistare i videocorsi Academy." },
  { title: "Assistenza clienti IUSMK", category: "supporto", keywords: "assistenza, aiuto, supporto, clienti, ho un problema, non funziona, aiutami", content: "Per assistenza su accesso, corsi, codici o informazioni generali, usa la sezione Contatto del sito oppure i canali ufficiali indicati. L'assistente risponde in base alle informazioni presenti sul sito." },
  { title: "Il sito IUSMK vende servizi in presenza", category: "sito", keywords: "servizi presenza, presenza, in persona, sessione fisica, lavoro dal vivo, salone", content: "Il sito non è pensato per la vendita o la prenotazione di servizi in presenza. È una piattaforma informativa e formativa dedicata ai videocorsi e alla presentazione di IUSMK." },

  // ── FAQ 11–14: Comprare corsi ─────────────────────────────────────────────
  { title: "Posso comprare videocorsi sul sito", category: "corsi", keywords: "comprare videocorsi, acquistare corsi online, vendono corsi, sito vende corsi, corsi disponibili, acquisto corsi", content: "Sì, sul sito puoi acquistare i videocorsi disponibili nella sezione Academy." },
  { title: "Dove trovo i corsi sul sito", category: "corsi", keywords: "dove sono i corsi, sezione corsi, menu corsi, academy, dove trovo i corsi, sezione academy", content: "Puoi trovare i corsi nella sezione Academy del sito." },
  { title: "Come faccio ad acquistare un corso", category: "corsi", keywords: "come compro, acquistare corso, procedura acquisto, steps acquisto, processo acquisto, comprare corso steps", content: "Entra nella sezione Academy, scegli il corso disponibile e completa l'acquisto tramite il sito." },
  { title: "Devo registrarmi per comprare un corso", category: "corsi", keywords: "registrazione necessaria, account per comprare, devo registrarmi, serve account per comprare, login prima di acquistare", content: "Sì, per acquistare i corsi è prevista la registrazione con nome, cognome, email e password." },

  // ── FAQ 15–18: Codice e accesso ai corsi ─────────────────────────────────
  { title: "Come ricevo l'accesso al corso dopo l'acquisto", category: "accesso", keywords: "accesso dopo acquisto, dopo pagamento, ricevo accesso, quando accedo, come accedo al corso dopo aver pagato", content: "Dopo l'acquisto, il codice di accesso viene inviato nell'area notifiche del sito, all'interno del tuo account." },
  { title: "Dove trovo il codice del corso acquistato", category: "notifiche", keywords: "dove codice corso, codice dove, trovare codice, area notifiche codice, dove arrivo il codice", content: "Il codice viene inviato nell'area notifiche del tuo account sul sito. Devi essere connesso per vederlo." },
  { title: "Il codice del corso arriva via email", category: "notifiche", keywords: "codice via email, email codice, manda email codice, ricezione codice email, codice nella mail", content: "La procedura principale prevista sul sito è la ricezione del codice nell'area notifiche dell'account. Controlla lì prima di tutto." },
  { title: "Posso usare un codice corso più di una volta", category: "corsi", keywords: "usare codice più volte, riusare codice, codice riutilizzabile, stesso codice due volte, codice già usato", content: "I codici sono pensati come codici di accesso singolo, salvo eventuali impostazioni diverse gestite dall'amministrazione del sito." },

  // ── FAQ 19–22: Corsi acquistati e condivisione ────────────────────────────
  { title: "Dove posso vedere i corsi che ho comprato", category: "corsi", keywords: "vedere corsi acquistati, i miei corsi, dove sono i corsi comprati, sezione miei corsi, corsi nel profilo", content: "I corsi acquistati sono visibili nella sezione \"I miei corsi\" del tuo account." },
  { title: "Posso vedere solo i corsi che ho acquistato", category: "corsi", keywords: "solo corsi acquistati, limitato ai miei corsi, accesso limitato, vedere solo i miei", content: "Sì, nella sezione \"I miei corsi\" trovi i corsi acquistati collegati al tuo account." },
  { title: "Posso condividere il mio codice corso con altre persone", category: "download", keywords: "condividere codice, codice ad altri, dare codice amico, codice personale, trasferire codice", content: "No, il codice è personale e l'accesso ai contenuti è riservato all'utente che ha acquistato il corso." },
  { title: "Posso condividere i video acquistati con un amico", category: "download", keywords: "condividere video, video ad altri, mostrare video amico, trasferire video, video personale, condivisione corsi", content: "No, i contenuti acquistati sono personali e non possono essere condivisi con altri." },

  // ── FAQ 23–26: Download / registrazione schermo ───────────────────────────
  { title: "Posso salvare un videocorso sul telefono", category: "download", keywords: "salvare videocorso telefono, salva video telefono, scarica video telefono, metti video su telefono", content: "No, i videocorsi non possono essere salvati, scaricati o registrati. I contenuti sono protetti e destinati esclusivamente alla visione autorizzata sul sito." },
  { title: "Posso scaricare i video dei corsi", category: "download", keywords: "scaricare video corsi, download video corsi, come scarico i video, video scaricabili", content: "No, i video non sono scaricabili dal sito." },
  { title: "Posso registrare lo schermo mentre guardo un corso", category: "download", keywords: "registrare schermo, screen recording, screencast, registrazione video corso, catturare video", content: "No, non è consentito registrare o copiare i contenuti. I videocorsi sono protetti e soggetti ai diritti d'autore." },
  { title: "I video si aprono su un altro sito", category: "download", keywords: "video su altro sito, video esterno, aprire video fuori, link video esterno, video embed", content: "No, la visione dei videocorsi è prevista direttamente all'interno del sito, tramite il proprio account." },

  // ── FAQ 27–29: Password / accesso account ────────────────────────────────
  { title: "Come funziona la password dimenticata", category: "password", keywords: "password dimenticata, recupero password, come resetto, reset funzionamento, funzione password dimenticata", content: "Se hai dimenticato la password, usa la funzione \"Password dimenticata\" presente nel sito. Inserisci la tua email e segui le istruzioni per il recupero." },
  { title: "Ho dimenticato la password cosa devo fare", category: "password", keywords: "ho dimenticato password, dimentico password, non ricordo password, aiuto password, password persa", content: "Usa la funzione di recupero password presente nel sito. Trovi il link \"Password dimenticata\" nella schermata di accesso." },
  { title: "Come accedo all'area personale", category: "accesso", keywords: "area personale, area riservata, profilo personale, area cliente, come accedo, entrare area personale", content: "Devi registrarti o accedere con il tuo account dal sito. Il tasto \"Accedi\" si trova in alto a destra." },

  // ── FAQ 30–36: Contatti ───────────────────────────────────────────────────
  { title: "Posso contattare IUSMK dal sito", category: "contatti", keywords: "contattare iusmk, come contatto, contatto dal sito, scrivere a iusmk, modulo contatto", content: "Sì, puoi contattare IUSMK tramite la sezione Contatto del sito." },
  { title: "Dove trovo i contatti", category: "contatti", keywords: "dove contatti, dove sono i contatti, sezione contatto, trovare contatti, link contatti", content: "Trovi i contatti nella sezione Contatto del menu del sito." },
  { title: "Posso scrivere direttamente a IUSMK", category: "contatti", keywords: "scrivere a iusmk, messaggio diretto, mandare messaggio, scrivere modulo, inviare richiesta", content: "Sì, usa la sezione Contatto del sito per inviare la tua richiesta." },
  { title: "Posso chiedere informazioni sui corsi prima di comprarli", category: "contatti", keywords: "info corsi prima acquisto, chiedere prima di comprare, informazioni preventive, domande su corso, chiedere corso", content: "Sì, puoi usare la sezione Contatto per chiedere informazioni prima dell'acquisto." },
  { title: "Posso chiedere assistenza se ho problemi con un corso", category: "supporto", keywords: "problemi corso, assistenza corso, aiuto corso, non funziona corso, problema con corso", content: "Sì, per assistenza puoi usare la sezione Contatto o i canali previsti dal sito." },
  { title: "Prendere appuntamento per un taglio", category: "prenotazioni", keywords: "appuntamento taglio, prendere appuntamento, fissare taglio, prenoto taglio, voglio un taglio", content: "Il sito non è strutturato per prenotare appuntamenti di taglio. Per richieste specifiche usa la sezione Contatto." },
  { title: "Posso prenotare un taglio dal sito", category: "prenotazioni", keywords: "prenotare taglio sito, booking taglio, taglio dal sito, prenotazione taglio online, taglio online", content: "No, il sito IUSMK non è pensato per prenotare tagli o appuntamenti da barber. Il sito è dedicato principalmente alla presentazione del barber artist e all'acquisto dei videocorsi Academy." },

  // ── FAQ 37–40: Rimborsi ───────────────────────────────────────────────────
  { title: "Ci sono rimborsi per i corsi acquistati", category: "policy", keywords: "rimborso corso, restituzione soldi, reso corso, voglio rimborso, rimborsare corso", content: "I rimborsi vengono valutati caso per caso da Giuseppe. Non sono automatici." },
  { title: "La politica di rimborso è automatica", category: "policy", keywords: "rimborso automatico, reso automatico, rimborso immediato, refund automatico", content: "No, i rimborsi non sono automatici: vengono valutati caso per caso da Giuseppe." },
  { title: "Chi decide i rimborsi", category: "policy", keywords: "chi decide rimborso, chi valuta rimborso, chi gestisce rimborso, rimborso decisione", content: "Eventuali rimborsi vengono valutati caso per caso direttamente da Giuseppe." },
  { title: "Come chiedere un rimborso", category: "policy", keywords: "come chiedere rimborso, richiedere rimborso, procedura rimborso, come faccio rimborso, dove chiedo rimborso", content: "Per richiedere un rimborso contatta Giuseppe direttamente tramite la sezione Contatto del sito. Sarà lui a valutare la richiesta caso per caso." },

  // ── FAQ 41–45: Galleria e corsi online ───────────────────────────────────
  { title: "Cosa mostra la galleria", category: "sito", keywords: "galleria, cosa c'è in galleria, foto galleria, lavori galleria, cosa vedo in galleria, sezione galleria", content: "La galleria mostra i lavori e lo stile artistico di IUSMK." },
  { title: "Posso vedere i lavori di IUSMK sul sito", category: "sito", keywords: "vedere lavori, lavori iusmk, stile iusmk, portfolio, foto lavori, esempi lavori", content: "Sì, puoi vedere i lavori nella sezione Galleria del sito." },
  { title: "IUSMK vende corsi online", category: "corsi", keywords: "corsi online, vendono corsi online, corsi su internet, corsi web, videocorsi online", content: "Sì, il sito include una sezione Academy dedicata ai videocorsi online." },
  { title: "I corsi sono online", category: "corsi", keywords: "corsi online, fruibili online, si vedono online, corsi in streaming, watch online", content: "Sì, i corsi sono fruibili online tramite il sito." },
  { title: "Posso comprare più di un corso", category: "corsi", keywords: "più corsi, due corsi, acquistare più corsi, comprare altri corsi, corsi multipli", content: "Sì, puoi acquistare i corsi disponibili sul sito e consultarli poi nella sezione \"I miei corsi\"." },

  // ── FAQ 46–50: Account / mobile / assistente ──────────────────────────────
  { title: "Serve un account per vedere i miei acquisti", category: "account", keywords: "account acquisti, vedere acquisti, accesso acquisti, profilo acquisti, collegati all account", content: "Sì, i tuoi acquisti e i tuoi corsi sono collegati al tuo account. Devi essere connesso per accedervi." },
  { title: "Dove vedo le notifiche del mio account", category: "notifiche", keywords: "notifiche account, dove notifiche, area notifiche, sezione notifiche account, trovare notifiche account", content: "Le notifiche sono disponibili nella sezione Notifiche del sito, nell'area personale." },
  { title: "Posso usare il sito anche da telefono", category: "sito", keywords: "sito da telefono, mobile, da smartphone, iphone sito, android sito, usare da telefono, sito mobile", content: "Sì, il sito è utilizzabile anche da dispositivi mobili." },
  { title: "L'assistente risponde a tutto", category: "supporto", keywords: "assistente risponde tutto, ai sa tutto, ai conosce tutto, chatbot risponde, assistente virtuale", content: "L'assistente risponde in base alle informazioni realmente presenti sul sito e nella knowledge base. Se un'informazione non è disponibile, invita a usare la sezione Contatto." },
  { title: "Se l'assistente non sa una cosa cosa deve dire", category: "supporto", keywords: "assistente non sa, risposta mancante, assistente non conosce, cosa risponde se non sa, informazione non disponibile", content: "Se l'informazione non è disponibile, l'assistente dice: \"Non trovo questa informazione sul sito. Ti consiglio di usare la sezione Contatto per ricevere una risposta diretta.\" Non inventa mai." },
];

export async function autoSeedKB(): Promise<void> {
  try {
    const [{ total }] = await db.select({ total: count() }).from(knowledgeBaseTable);
    const currentCount = Number(total);

    console.log(`[KB_SEED] DB con ${currentCount} voci — controllo voci mancanti...`);

    // Remove old/wrong stale entries
    let removed = 0;
    for (const staleTitle of KB_STALE_TITLES) {
      const existing = await db
        .select({ id: knowledgeBaseTable.id })
        .from(knowledgeBaseTable)
        .where(sql`lower(trim(${knowledgeBaseTable.title})) = ${staleTitle.toLowerCase().trim()}`);
      if (existing.length > 0) {
        await db.delete(knowledgeBaseTable).where(sql`lower(trim(${knowledgeBaseTable.title})) = ${staleTitle.toLowerCase().trim()}`);
        removed += existing.length;
      }
    }

    const existingRows = await db.select({ title: knowledgeBaseTable.title }).from(knowledgeBaseTable);
    const existingTitles = new Set(existingRows.map((e) => e.title.toLowerCase().trim()));

    let created = 0;
    for (const entry of KB_ALL_ENTRIES) {
      if (existingTitles.has(entry.title.toLowerCase().trim())) continue;
      await db.insert(knowledgeBaseTable).values({
        title:         entry.title,
        content:       entry.content,
        category:      entry.category,
        keywords:      entry.keywords,
        sourceType:    "manual_entry",
        isPublished:   true,
        isActive:      true,
        createdBy:     "auto-seed",
        lastUpdatedBy: "auto-seed",
      });
      existingTitles.add(entry.title.toLowerCase().trim());
      created++;
    }

    console.log(`[KB_SEED] Auto-seed completato: ${created} voci inserite, ${removed} voci stale rimosse`);
  } catch (err) {
    console.error("[KB_SEED] Auto-seed fallito (non fatale):", err);
  }
}
