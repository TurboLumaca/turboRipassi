# Ripassa

App personale per ripassi programmati con ripetizione temporale automatica, allegati (foto/PDF) e note, sincronizzati tra Android, iPadOS e macOS via Supabase, con cache locale per uso offline.

Implementazione della spec `ripassa-app-spec.md`. Architettura **Model / Controller / View** (sezione 4): nessuna View importa direttamente il client Supabase.

## Struttura

```
supabase/schema.sql          Schema Postgres + RLS + Realtime + bucket Storage
src/config/supabase.ts       Client Supabase (unico punto di istanza)
src/config/crashReporting.ts Sentry: init, DSN, reportError (unico punto di accesso all'SDK)
src/theme/theme.ts           Palette blu/giallo, isolata
src/model/                   Model: tipi + repository (query pure)
  types.ts, occorrenzeDates.ts, ripassiRepo.ts, allegatiRepo.ts,
  localCache.ts (I/O cache), cacheLogic.ts + fileUtils.ts (logica pura, testata)
  ripassiLogic.ts (classificazione/ordinamento), errorMessages.ts (errori → italiano),
  retry.ts (backoff per errori transitori)
src/controller/              Controller: hook React
  useAuth, useRipassi, useLocalCache, useAllegati, useConnettivita, RipassiContext
src/view/                    View: schermate e componenti
  screens/ LoginScreen, HomeScreen, FormRipassoScreen, DettaglioAllegatiScreen
  components/ ui.tsx, OccorrenzaEditor.tsx, ErrorBoundary.tsx (fallback anti-crash)
src/**/__tests__/            Test jest-expo della logica pura (npm test)
App.tsx                      Gating auth + navigazione + init crash reporting
```

## Setup (una volta)

### 1. Progetto Supabase
1. Crea un progetto su [supabase.com](https://supabase.com) (piano gratuito).
2. **SQL Editor** → incolla `supabase/schema.sql` → **Run**. Crea tabelle, RLS, Realtime e il bucket `allegati`.
3. **Authentication → Providers → Google**: abilita e configura l'OAuth (Client ID/Secret dalla Google Cloud Console). Aggiungi il redirect `ripassa://` agli URL consentiti.

### 2. Variabili d'ambiente
```bash
cp .env.example .env
```
Inserisci `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).

### 3. Sentry (crash reporting) — facoltativo in sviluppo
Crea un progetto su [sentry.io](https://sentry.io) e copia il DSN
(Settings → Client Keys) in `EXPO_PUBLIC_SENTRY_DSN`.

Senza DSN il crash reporting resta **disattivato** e l'app funziona
normalmente: il modulo fa no-op e logga un warning. È invece consigliato
configurarlo prima di distribuire build a utenti reali (vedi
[BUILD.md](BUILD.md) per la registrazione della variabile su EAS).

### 4. Dipendenze
```bash
npm install
```

## Avvio (Fase 0 — Expo Go)

```bash
npm start
```
Poi scansiona il QR con **Expo Go** su Android/iPad. Mac e dispositivo devono
stare sulla **stessa rete Wi-Fi**. La modalità `--tunnel` (ngrok) è attualmente
inaffidabile: se la LAN non funziona, il router probabilmente isola i
dispositivi tra loro (AP isolation) — in quel caso conviene passare
direttamente alla build installata.

## Test e typecheck

```bash
npm test           # test jest-expo sulla logica pura (date, cache, base64)
npm run typecheck  # tsc --noEmit
```

## Build come app installata (Fase 1)

Vedi **[BUILD.md](BUILD.md)**: APK Android via EAS (gratis), iPad via Xcode con
Apple ID gratuito (rinnovo 7 giorni), Mac M2 come app "Designed for iPad".
Con l'app installata il login persiste sul dispositivo.

## Note

- **Sync cross-device** (sezione 6): subscription Realtime unica in `RipassiContext`; last-write-wins su `updated_at`.
- **Cache locale** (sezione 7): finestra ieri/oggi/domani, rotazione a ogni apertura (max 1×/giorno), file su SQLite + FileSystem. Il dato remoto non viene mai cancellato.
- **Compressione immagini** prima dell'upload (sezione 3) per contenere il tetto di 1 GB.
- **Errori leggibili**: nessun messaggio tecnico raggiunge l'utente. `errorMessages.ts`
  traduce gli errori Supabase/Postgres in italiano per categoria (rete, autenticazione,
  permessi, duplicato, spazio); le View mostrano solo il risultato di `traduciErrore`.
- **Offline e retry**: `useConnettivita` (NetInfo) distingue "sei offline" da un errore
  generico, con banner dedicato su Home e Login. `retry.ts` ritenta con backoff
  esponenziale **solo** gli errori transitori (rete, 5xx) e **solo** le operazioni
  idempotenti: creazione ripasso e upload allegato sono esclusi di proposito perché
  un retry dopo una risposta persa creerebbe duplicati.
- **Crash reporting e resilienza**: `src/config/crashReporting.ts` è l'unico punto
  che importa l'SDK Sentry (stessa regola del client Supabase). L'intero albero è
  avvolto in un `ErrorBoundary` che, in caso di errore di render, invia l'evento e
  mostra una schermata di fallback con "Riprova" invece di crashare in silenzio.
  L'export di `App.tsx` è avvolto in `Sentry.wrap` per intercettare anche i crash
  nativi. Reporting disattivato in `__DEV__` e senza DSN.
- **Fuori scope MVP** (sezione 10): statistiche, push, scrittura offline, pubblicazione store, multi-utente (l'RLS è però già predisposto).
