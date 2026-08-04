# Ripassa — Specifica Tecnica di Progetto

> ## ⚠️ Documento storico — requisiti iniziali (luglio 2026)
>
> Questo file raccoglie i requisiti **come erano all'inizio del progetto** e va
> letto per capire da dove si è partiti e perché. **Non descrive lo stato
> attuale del sistema** e non è la fonte autorevole in caso di divergenza:
> quella è `docs/ripassa-documentazione.pdf`.
>
> Quattro punti sono stati superati consapevolmente — lo storage degli
> allegati (§2), il criterio di eliminazione dalla cache (§7.3), il numero di
> livelli architetturali (§4) e la completezza della Fase 0 su Expo Go (§8).
> Ognuno è elencato con la sua motivazione nel capitolo *Scostamenti dalla
> specifica iniziale* della documentazione. Seguire alla lettera i punti
> superati reintrodurrebbe difetti già corretti.

> Documento di riferimento originale. Chiunque (umano o modello AI) riprenda questo progetto deve poter leggere questo file e la documentazione tecnica e avere il contesto completo per implementare o proseguire il lavoro senza dover rifare domande già risposte qui sotto.

## 1. Obiettivo

App personale (utente singolo: Nikita) per gestire ripassi programmati con ripetizione temporale automatica, allegati (foto, PDF), note testuali, sincronizzati tra Android (Samsung), macOS (MacBook Air M2) e iPadOS, con cache locale limitata per uso offline in condizioni di rete scarsa (es. treno).

Sostituisce un'app esistente ("Genio in 21 Giorni") che ha lo stesso concetto ma soffre di frammentazione cloud (iCloud su iPad, Google Drive su Android, nessun account condiviso).

## 2. Decisioni vincolanti

- **Un solo account per tutti i dispositivi.** Nessuna dipendenza da iCloud o Google Drive per lo storage applicativo. Login unico via Supabase Auth (email/password o OAuth Google, per riuso delle credenziali esistenti).
- **Separazione Model / Controller / View obbligatoria.** Il livello dati (Model) non deve conoscere la UI. Il livello UI (View) non deve contenere logica di business. Un livello Controller (hook React) media tra i due.
- **Budget:** tutto gratuito dove possibile. Eccezione accettata: costo contenuto (~2 €/mese o poco più, anche una tantum) se necessario per un servizio specifico.
- **Codice scritto interamente da AI.** Nikita supervisiona, non scrive a mano. Le scelte tecniche devono quindi privilegiare stack maturi, ben documentati, con cui un modello AI generi codice corretto al primo tentativo.
- **App nativa, non web app.** Necessario per gestione file locale e cache offline.
- **Nessuna statistica o grafico di progresso.** Fuori scope, esplicitamente escluso.
- **Nessuna notifica push.** Non richiesta. Evitarla riduce dipendenze (le push su iOS richiedono account Apple Developer a pagamento).

## 3. Stack tecnologico

| Livello | Scelta | Motivo |
|---|---|---|
| Frontend | React Native + Expo (managed workflow) | Un solo codebase per Android + iPadOS. Vedi nota Mac in sezione 8. |
| Backend | Supabase (Postgres + Storage + Realtime + Auth) | Gratuito nei limiti dell'uso personale, un solo account, sync realtime nativo, niente Google Drive/iCloud. |
| Cache locale | expo-sqlite (metadati) + FileSystem di Expo (allegati) | Persistenza offline senza servizi esterni. |
| Autenticazione | Supabase Auth, provider Google OAuth | Riuso dell'account Google esistente, niente nuova password da gestire. |

### Limiti reali del piano gratuito Supabase (verificati, luglio 2026)
- Database: 500 MB
- File storage: 1 GB
- Banda in uscita: 5 GB/mese
- Connessioni realtime concorrenti: 200
- **Progetto messo in pausa dopo 7 giorni senza richieste API** — non è un problema con uso quotidiano, ma se il progetto resta inattivo per una settimana va riattivato manualmente dalla dashboard.

Il tetto di 1 GB di storage allegati è l'unico vincolo che collide con "nessun limite di dimensione" richiesto in sezione 2. Con foto e PDF di studio è plausibile superarlo in alcuni mesi. Mitigazione consigliata: compressione lato client delle immagini prima dell'upload (riduce peso senza perdita percettibile di leggibilità). Se il limite viene comunque superato, l'upgrade a Supabase Pro costa 25 $/mese — ben oltre il budget indicato, quindi da evitare o rivalutare arrivati a quel punto.

## 4. Architettura (Model / Controller / View)

```
View (componenti React Native, tema colori isolato in theme.ts)
   ↕ (props, callback)
Controller (custom hooks: useRipassi, useSync, useLocalCache)
   ↕ (funzioni pure, nessun JSX)
Model (client Supabase tipizzato, query, tipi TypeScript)
```

Regola pratica: nessun componente View importa direttamente il client Supabase. Ogni accesso ai dati passa da un hook del Controller.

## 5. Modello dati

### Tabella `ripassi` (contenuto)
| Campo | Tipo | Note |
|---|---|---|
| id | uuid | PK |
| account_id | uuid | FK → account. **Il proprietario.** Riempito da Postgres dalla sessione |
| user_id | uuid | FK auth.users, nullable. Solo audit: quale accesso ha creato la riga |
| titolo | text | |
| note | text | nullable, testo semplice |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Tabella `occorrenze` (date di ripasso)
| Campo | Tipo | Note |
|---|---|---|
| id | uuid | PK |
| ripasso_id | uuid | FK → ripassi |
| scheduled_at | timestamptz | |
| is_manual_1h | boolean | true solo per l'occorrenza +1 ora, se attivata manualmente |
| is_completed | boolean | default false |
| created_at | timestamptz | |

Alla creazione di un ripasso vengono inserite automaticamente le occorrenze a **+1 giorno, +1 settimana, +1 mese, +6 mesi**. L'occorrenza **+1 ora** viene creata solo se l'interruttore manuale (default disattivato) viene attivato in fase di creazione.

### Tabella `allegati`
| Campo | Tipo | Note |
|---|---|---|
| id | uuid | PK |
| ripasso_id | uuid | FK → ripassi |
| display_name | text | nome modificabile dall'utente |
| original_file_name | text | nome originale del file sul dispositivo |
| storage_path | text | path su Supabase Storage |
| order_index | integer | per il riordino manuale |
| mime_type | text | |
| size_bytes | bigint | |
| created_at | timestamptz | |

Nessun limite di numero o dimensione imposto lato app (vedi nota sul tetto storage in sezione 3).

### Tabella locale `cache_allegati` (solo SQLite on-device, non su Supabase)
| Campo | Tipo | Note |
|---|---|---|
| allegato_id | uuid | |
| local_uri | text | path nel filesystem del dispositivo |
| cached_at | date | |

### Account e identità di accesso

Le tre tabelle appartengono a un **account** (la persona), non a una riga di `auth.users` (che è *un modo di accedere*). Un account ha N **identità**: email/password, Google, e quante se ne aggiungeranno. Senza questa separazione la stessa persona registrata con la password e poi entrata con Google si ritrovava due insiemi di ripassi disgiunti, perché erano due proprietari diversi.

Un'identità entra in un account esistente solo a **email verificata da entrambe le parti**, e il database garantisce al massimo un account verificato per indirizzo. Motivazione, casi limite e procedura di migrazione: **[docs/account-identita.md](docs/account-identita.md)**.

Riga per Row Level Security su tutte le tabelle Supabase: `account_id = public.account_corrente()`, dove la funzione traduce la sessione nel suo account (isolamento anche in previsione di un eventuale uso multi-utente futuro se il progetto verrà proposto all'azienda terza).

## 6. Sincronizzazione cross-device

- Ogni scrittura (titolo, note, allegati, date) passa da Supabase.
- Ogni dispositivo mantiene una subscription Realtime sulle tabelle `ripassi`, `occorrenze`, `allegati`.
- Alla ricezione di un evento di modifica, il Controller aggiorna la cache SQLite locale e la View si ri-renderizza.
- Conflitti: risoluzione **last-write-wins** basata su `updated_at`. Sufficiente per un solo utente su più dispositivi (non c'è mai scrittura concorrente reale sullo stesso campo).
- **Assunzione da confermare:** la creazione/modifica di un ripasso richiede connessione attiva. La cache locale serve per la *lettura* offline (allegati già scaricati), non per la scrittura offline. Se in treno vuoi anche poter creare un nuovo ripasso senza rete, serve una coda di scrittura offline (outbox pattern) — funzionalità aggiuntiva, non nell'MVP.

## 7. Cache locale e rotazione allegati

Finestra mantenuta in locale: **ieri, oggi, domani** (3 giorni).

Ad ogni apertura dell'app (o al massimo una volta al giorno):
1. Calcola la finestra `[oggi-1, oggi, oggi+1]`.
2. Per ogni occorrenza con `scheduled_at` in finestra: se i suoi allegati non sono già in `cache_allegati`, scaricali da Supabase Storage nel filesystem locale.
3. Per ogni riga in `cache_allegati` con `cached_at` fuori dalla finestra: elimina il file locale e la riga di cache.

Il contenuto resta sempre disponibile su Supabase Storage: la cancellazione locale non cancella mai il dato remoto.

## 8. Piattaforme e distribuzione

### Fase 0 — MVP (obiettivo: domani)
Uso di **Expo Go** (app gratuita disponibile su App Store, Play Store) per eseguire il progetto senza build nativa, senza firma, senza account developer:
- Android (Samsung): apri Expo Go, scansiona QR da `npx expo start`.
- iPad: stesso procedimento con Expo Go da App Store.
- Mac (Apple Silicon M2): da verificare se Expo Go stesso è installabile come app "Designed for iPad" — se sì, stesso procedimento; se no, in fase 0 il Mac può essere usato solo per lo sviluppo (terminale + simulatore), non come dispositivo di test finale.

Questo percorso evita completamente il problema di firma/account a pagamento per la fase di validazione rapida.

### Fase 1 — App installate stabilmente (dopo la validazione)
- **Android:** build APK con `eas build --platform android --profile preview` (piano gratuito Expo: 15 build Android/mese), installazione diretta sul Samsung. Nessun costo, nessun account Google Play necessario per uso privato.
- **iPad:** build IPA firmata con Apple ID gratuito (Personal Team). Limite reale: il profilo di provisioning scade ogni 7 giorni, serve ricollegare l'iPad al Mac e rieseguire il build per rinnovare. Alternativa: Apple Developer Program a 99 $/anno rimuove questo limite (profili non scadono, possibile anche TestFlight). **Nessuno sconto studenti esiste per l'Apple Developer Program** (verificato: il fee waiver è riservato a istituzioni/enti, non a singoli studenti).
- **macOS:** se un IPA "Designed for iPad" gira nativamente su Apple Silicon senza build separata (comportamento atteso su Mac M2, ma da testare concretamente con questo progetto — i moduli nativi di Expo come file picker e camera possono comportarsi diversamente su macOS). Se non funziona, resta l'opzione di eseguire l'app in modalità sviluppo dal Mac (Expo Go / dev client), sufficiente per uso personale.

**Punto critico da decidere:** l'obiettivo "tutto gratis" è compatibile con Android e con l'uso saltuario su iPad (accettando il fastidio del rinnovo settimanale). Per un uso quotidiano stabile su iPad senza reinstallare ogni settimana, i 99 $/anno Apple sono la soluzione pratica — è un costo ricorrente annuale, non una tantum, quindi fuori dal budget dichiarato in senso stretto. Da decidere consapevolmente: accettare il fastidio settimanale gratuito, oppure pagare per la stabilità.

## 9. Schermate MVP

Basate sugli screenshot dell'app attuale forniti come riferimento UX (non come codice o asset da riusare):

1. **Home / Lista Ripassi** — due sezioni: "Ripassi" (oggi e futuri) e "Storico" (passati), barra di ricerca, pulsante "+ Aggiungi ripasso".
2. **Form Ripassa** — campo Titolo, campo Note (testo semplice), tre pulsanti allegato (fotocamera, galleria, file/PDF), lista "Prossimi ripassi programmati" con le occorrenze generate e icona di modifica per ciascuna, interruttore manuale per l'occorrenza +1 ora (default disattivato).
3. **Dettaglio allegati** — visualizzazione foto/PDF, rinomina, riordino.

Tema colori: **blu e giallo**, isolato in un file `theme.ts` separato dai componenti, così è modificabile senza toccare la logica.

## 10. Fuori scope MVP

- Statistiche, grafici di progresso
- Notifiche push
- Scrittura offline (creazione/modifica senza connessione)
- Pubblicazione su App Store / Google Play
- Multi-utente / condivisione

## 11. Rischi tecnici da validare per primi

1. Expo Go installabile ed eseguibile sul Mac M2 come app iPad — verificare prima di tutto il resto.
2. Comportamento di file picker/camera di Expo su macOS via compatibilità iPad.
3. Consumo reale dello storage Supabase (1 GB) con foto non compresse — misurare dopo le prime settimane d'uso.

## 12. Ordine di implementazione consigliato

1. Progetto Supabase: schema tabelle (sezione 5) + RLS + bucket Storage.
2. Setup Expo, autenticazione Google OAuth via Supabase.
3. Model layer: client Supabase tipizzato.
4. Controller layer: hook `useRipassi` (CRUD + generazione occorrenze automatiche), `useSync` (subscription Realtime), `useLocalCache` (rotazione allegati sezione 7).
5. View layer: Home (lista), Form Ripassa, tema colori.
6. Test su Expo Go: Android + iPad in parallelo, verifica sync in tempo reale.
7. Verifica punto critico Mac (sezione 11.1).
8. Solo dopo validazione: build EAS per uso stabile (sezione 8, Fase 1).
