# TurboRipassi

App personale per ripassi programmati con ripetizione temporale automatica, allegati (foto/PDF) e note, sincronizzati tra Android, iPadOS e macOS. Metadati e sincronizzazione su Supabase, binari degli allegati sul Google Drive dell'utente, cache locale per la lettura offline.

Implementazione della spec `ripassa-app-spec.md` (requisiti iniziali, documento storico). Lo **stato attuale** del sistema è documentato in [`docs/ripassa-documentazione.pdf`](docs/ripassa-documentazione.pdf), che è la fonte autorevole in caso di divergenza.

Architettura **Model / Controller / View** più un livello trasversale `config`. Le regole di dipendenza fra i livelli non sono solo scritte: sono verificate da ESLint e falliscono la build (`npm run lint`).

## Struttura

```
App.tsx                      Gating auth, navigazione, ErrorBoundary, init crash reporting

src/config/                  Infrastruttura trasversale (non dipende dai livelli applicativi)
  env.ts                     unico lettore di configurazione: env → app.json/extra
  supabase.ts                unica istanza del client (PKCE, refresh in foreground)
  secureAuthStorage.ts       sessione cifrata in Keychain/Keystore
  crashReporting.ts          unico punto di accesso a Sentry
  driveConfig.ts             client ID per piattaforma, scope drive.file

src/model/                   Dominio, dati, I/O. Non conosce né UI né React
  types.ts
  ripassi/                   occorrenzeDates (puro), ripassiLogic (puro), ripassiRepo
  allegati/                  allegatiRepo (Drive + metadati Postgres)
  drive/                     driveTypes (interfacce), driveRepo (REST), driveAuth (OAuth)
  cache/                     cacheLogic (puro), localCache (SQLite + filesystem)
  auth/                      oauthRedirect, codiciUsati
  shared/                    errorMessages, retry, fileUtils, account

src/controller/              Hook: stato e orchestrazione. Nessun JSX
  AuthContext, RipassiContext, avvisoErrore, useConnettivita, useLocalCache
  auth/                      useAuth, useDriveAuth, oauthLogin, useAccountDrive
  ripassi/                   useRipassi, useFormRipasso
  allegati/                  useAllegati, fileDispositivo

src/view/                    Interfaccia
  theme/, lib/ (format, calendarUtils), components/, screens/

supabase/schema.sql          Tabelle, trigger, RLS, Realtime, funzione di riordino (idempotente)
supabase/migrations/         Modifiche allo schema, da eseguire in ordine
docs/account-identita.md     Perché i ripassi seguono la persona e non il login
eslint.config.js             Regole Expo + confini fra i livelli
.github/workflows/ci.yml     lint, typecheck, test e copertura a ogni push
src/**/__tests__/            328 test su 25 suite (vedi cap. 14 della relazione)
```

## Setup (una volta)

Serve **Node 22** (vedi `.nvmrc`; `npm ci` rispetta `engines`).

### 1. Progetto Supabase
1. Crea un progetto su [supabase.com](https://supabase.com) (piano gratuito).
2. **SQL Editor** → incolla `supabase/schema.sql` → **Run**. Crea tabelle, trigger, RLS, Realtime e le funzioni `riordina_allegati` e `sposta_occorrenze`. Lo script è idempotente: **va rieseguito dopo ogni aggiornamento del codice** (l'ultima revisione aggiunge `sposta_occorrenze`, senza la quale riprogrammare un ripasso fallisce).
3. **SQL Editor** → incolla `supabase/migrations/0001_account_identita.sql` → **Run**. Non è facoltativo: sposta la proprietà dei dati dall'utente di login all'**account**, così la stessa persona che entra con la password e con Google vede un solo insieme di ripassi. Anche questo è idempotente. Vedi **[docs/account-identita.md](docs/account-identita.md)**.
4. **Authentication → Providers → Email**: lascia **Confirm email** attivo (lo è di default). È la prova che l'indirizzo è davvero tuo, ed è ciò che autorizza il collegamento automatico fra un accesso con password e uno con Google.
5. **Authentication → Providers → Google**: abilita e configura l'OAuth (Client ID/Secret dalla Google Cloud Console). Aggiungi il redirect `ripassa://` agli URL consentiti.
6. **Authentication → Settings → Manual linking**: abilitalo se vuoi il pulsante «Collega Google» dentro l'app. Senza, l'accesso con Google continua a funzionare e i ripassi restano comunque gli stessi: cambia solo che restano due accessi distinti invece di uno solo con due metodi.

> Nota: gli allegati **non** usano Supabase Storage. Non c'è nessun bucket da creare; se ne esiste uno da versioni precedenti può essere svuotato ed eliminato a mano.

### 2. Google Drive (allegati)
I binari degli allegati vanno sul Drive dell'utente, in una cartella `ripassiProgrammati`, con lo scope minimo `drive.file` (l'app vede solo i file che ha creato). Serve, nella [Google Cloud Console](https://console.cloud.google.com):

1. **Google Drive API** abilitata nel progetto.
2. Un **OAuth client ID nativo** (tipo Android e/o iOS) con l'opzione *Custom URI scheme* attiva.
3. Il proprio account fra i **Test users** finché l'app resta in *Testing*.

Il redirect è `<applicationId>:/oauthredirect`, cioè `com.turboLumaca.turboRipassi:/oauthredirect`. Procedura completa e diagnostica degli errori in [BUILD.md](BUILD.md), sezione 5.

**Expo Go non basta per gli allegati**: non può registrare quello schema di redirect (lì diventa `exp://…`, che Google rifiuta). Tutto il resto funziona; per lavorare sugli allegati serve una development build.

### 3. Variabili d'ambiente
```bash
cp .env.example .env
```
Inserisci `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API) e i client ID Google. La chiave *publishable* non è un segreto: finisce comunque dentro l'app, ed è la stessa registrata in `app.json → extra` come fallback.

### 4. Sentry (crash reporting) — facoltativo in sviluppo
Crea un progetto su [sentry.io](https://sentry.io) e copia il DSN (Settings → Client Keys) in `EXPO_PUBLIC_SENTRY_DSN`.

Senza DSN il crash reporting resta **disattivato** e l'app funziona normalmente: il modulo fa no-op e logga un warning. È invece consigliato configurarlo prima di distribuire build a utenti reali (vedi [BUILD.md](BUILD.md) per la registrazione della variabile su EAS).

### 5. Dipendenze
```bash
npm install
```

## Avvio (Fase 0 — Expo Go)

```bash
npm start
```
Poi scansiona il QR con **Expo Go** su Android/iPad. Mac e dispositivo devono stare sulla **stessa rete Wi-Fi**. La modalità `--tunnel` (ngrok) si era rivelata inaffidabile e il pacchetto `@expo/ngrok` è stato rimosso dalle dipendenze (era anche l'unica vulnerabilità senza patch disponibile). Se la LAN non funziona, il router probabilmente isola i dispositivi tra loro (AP isolation) — in quel caso conviene passare direttamente alla build installata.

## Verifica

```bash
npm run verifica
```
Esegue in sequenza:

```bash
npm run lint        # ESLint: regole Expo + confini fra i livelli MCV
npm run typecheck   # tsc --noEmit (strict, noUnusedLocals, noUnusedParameters)
npm test            # 328 test su 25 suite
```

Copertura: `npm run test:coverage` (soglie **per livello** in `package.json`; la CI fallisce se scendono). Gli stessi comandi girano su GitHub Actions a ogni push.

I test SQL su RLS e modello account/identità sono una suite a parte e **non** girano in CI: sono scritti contro lo schema `auth` di un progetto Supabase reale e finiscono in `rollback`. Vanno eseguiti a mano dopo ogni modifica allo schema o alle policy:

```bash
SUPABASE_DB_URL='postgresql://...' npm run test:db
```

## Build come app installata (Fase 1)

Vedi **[BUILD.md](BUILD.md)**: APK Android via EAS (gratis), iPad via Xcode con Apple ID gratuito (rinnovo 7 giorni), Mac M2 come app "Designed for iPad". Con l'app installata il login persiste sul dispositivo e il redirect OAuth di Drive funziona.

## Note

- **Confini di architettura**: nessuna View importa il client Supabase, un repository, la cache o il client Drive; il Model non conosce UI né hook; `config` non dipende da nessun livello applicativo. Le quattro regole sono in `eslint.config.js`.
- **Sync cross-device**: subscription Realtime unica in `RipassiContext`; last-write-wins su `updated_at`.
- **Allegati su Drive**: upload in due passi con rollback su entrambi i lati (se l'insert dei metadati fallisce, il file su Drive viene cancellato). Il riordino è una singola chiamata transazionale (`riordina_allegati`). `size_bytes` registra la dimensione del file *compresso*, cioè quella realmente caricata.
- **Cache locale**: finestra ieri/oggi/domani, rotazione a ogni apertura (max 1×/giorno), file su SQLite + FileSystem. Il dato remoto non viene mai cancellato. Un download fallito non blocca gli altri, ma viene contato: la Home lo segnala e i fallimenti anomali finiscono su Sentry.
- **Errori leggibili**: `errorMessages.ts` traduce gli errori tecnici in italiano per categoria, con una tabella di regole ordinata. Il messaggio tradotto è sempre la voce principale; il testo originale viene allegato **solo** quando la traduzione non riesce a classificare l'errore, perché lì senza di esso l'utente non ha nulla da riferire.
- **Offline e retry**: `useConnettivita` (NetInfo) distingue "sei offline" da un errore generico. `retry.ts` ritenta con backoff esponenziale **solo** gli errori transitori e **solo** le operazioni idempotenti: creazione ripasso e caricamento allegato sono esclusi perché un retry dopo una risposta persa creerebbe duplicati; il download in rotazione cache è escluso perché bloccherebbe l'avvio quando la rete è cattiva.
- **Crash reporting e resilienza**: `src/config/crashReporting.ts` è l'unico punto che importa l'SDK Sentry. L'intero albero è avvolto in un `ErrorBoundary`; l'export di `App.tsx` è avvolto in `Sentry.wrap`. Reporting disattivato in `__DEV__` e senza DSN.
- **Sicurezza delle dipendenze**: `npm audit` riporta 0 vulnerabilità. Le quattro segnalate in origine (`brace-expansion`, `postcss`, `tar`, `uuid`) erano tutte transitive del solo toolchain di build e sono fissate con `overrides` in `package.json` invece che con `npm audit fix --force` (che avrebbe prodotto un set di versioni incoerente). Gli override vanno rimossi man mano che Expo aggiorna a monte.
- **Fuori scope MVP**: statistiche, push, scrittura offline, pubblicazione store, multi-utente (l'RLS è però già predisposto).
