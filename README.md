# Ripassa

App personale per ripassi programmati con ripetizione temporale automatica, allegati (foto/PDF) e note, sincronizzati tra Android, iPadOS e macOS via Supabase, con cache locale per uso offline.

Implementazione della spec `ripassa-app-spec.md`. Architettura **Model / Controller / View** (sezione 4): nessuna View importa direttamente il client Supabase.

## Struttura

```
supabase/schema.sql          Schema Postgres + RLS + Realtime + bucket Storage
src/config/supabase.ts       Client Supabase (unico punto di istanza)
src/theme/theme.ts           Palette blu/giallo, isolata
src/model/                   Model: tipi + repository (query pure)
  types.ts, occorrenzeDates.ts, ripassiRepo.ts, allegatiRepo.ts, localCache.ts
src/controller/              Controller: hook React
  useAuth, useRipassi, useLocalCache, useAllegati, RipassiContext
src/view/                    View: schermate e componenti
  screens/ LoginScreen, HomeScreen, FormRipassoScreen, DettaglioAllegatiScreen
App.tsx                      Gating auth + navigazione
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

### 3. Dipendenze
```bash
npm install
```

## Avvio (Fase 0 — Expo Go)

```bash
npm start
```
Poi scansiona il QR con **Expo Go** su Android/iPad. Vedi sezione 8 della spec per la Fase 1 (build EAS/IPA).

## Note

- **Sync cross-device** (sezione 6): subscription Realtime unica in `RipassiContext`; last-write-wins su `updated_at`.
- **Cache locale** (sezione 7): finestra ieri/oggi/domani, rotazione a ogni apertura (max 1×/giorno), file su SQLite + FileSystem. Il dato remoto non viene mai cancellato.
- **Compressione immagini** prima dell'upload (sezione 3) per contenere il tetto di 1 GB.
- **Fuori scope MVP** (sezione 10): statistiche, push, scrittura offline, pubblicazione store, multi-utente (l'RLS è però già predisposto).
