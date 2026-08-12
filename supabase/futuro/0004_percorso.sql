-- ---------------------------------------------------------------------------
-- 0004 — percorso: lo stato del percorso sul server. NON APPLICATA.
--
-- Questo file sta in `supabase/futuro/` e non in `supabase/migrations/` per una
-- ragione sola: non è stata eseguita su nessun progetto, `npm run test:db` non
-- la carica e nessuna riga di TypeScript la legge. È la specifica scritta di un
-- lavoro che si farà se e solo se il prodotto verrà venduto a Genio in 21
-- giorni; finché resta una dimostrazione del redesign, iscrizione, padronanze,
-- lingua e programma vivono in `percorso.json` sul dispositivo
-- (`src/model/percorso/percorsoRepo.ts`).
--
-- Perché scriverla adesso, allora. Perché il difetto che colma è noto e
-- documentato — lo stato del percorso è l'unica cosa che due dispositivi dello
-- stesso account vedono diversa — e perché la forma della soluzione decide
-- oggi la forma del codice: `PercorsoRepo` è un'interfaccia iniettata nel
-- provider proprio perché questa tabella possa sostituire il file senza che il
-- Controller se ne accorga. Una specifica che resta un'idea non vincola niente;
-- questa vincola già l'interfaccia.
--
-- Convenzioni identiche al resto dello schema: `create ... if not exists`,
-- policy `drop`/`create` per essere rieseguibile, RLS attiva prima delle
-- policy, `user_id` con `default auth.uid()`.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Tabella
--
-- Una riga per utente, non una per campo: lo stato del percorso si legge e si
-- scrive sempre intero (il provider tiene un unico oggetto in memoria e lo
-- riscrive a ogni cambiamento), quindi normalizzarlo in quattro tabelle
-- costerebbe quattro query per disegnare la Home senza rendere possibile
-- nessuna interrogazione che serva a qualcuno.
--
-- `jsonb` e non colonne tipizzate per la stessa ragione per cui oggi è un file:
-- la forma dello stato è ancora quella del redesign, non quella di un contratto
-- concordato con il committente, e cambiarla non deve costare una migrazione a
-- ogni schermata nuova. Il prezzo — nessun vincolo del database sul contenuto —
-- è già pagato dalla funzione `normalizza` del repository, che tratta il
-- payload come non fidato e fa ricadere ogni campo non valido sul proprio
-- valore iniziale, uno per uno.
--
-- `primary key (user_id)` è ciò che rende `upsert` senza `onConflict` la
-- scrittura giusta: un account ha esattamente un percorso.
-- ---------------------------------------------------------------------------
create table if not exists public.percorso (
  user_id      uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  stato        jsonb not null default '{}'::jsonb,
  aggiornato_a timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Stessa forma di `ripassi_owner`: l'unica riga visibile è la propria, sia in
-- lettura sia in scrittura. Qui non serve il controllo di secondo livello sul
-- genitore che hanno `occorrenze` e `allegati`, perché non c'è genitore: la
-- chiave primaria è già l'identità.
-- ---------------------------------------------------------------------------
alter table public.percorso enable row level security;

drop policy if exists percorso_owner on public.percorso;
create policy percorso_owner on public.percorso
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Cosa resterebbe da fare nell'app, per intero
--
--   1. `percorsoRepoRemoto`, accanto a quello locale: `select stato` +
--      `upsert({ stato })`, con lo stesso `normalizza` e lo stesso
--      `reportError` (il codice esatto è nel commento in testa a
--      percorsoRepo.ts).
--   2. `<PercorsoProvider repo={percorsoRepoRemoto}>` in App.tsx.
--   3. Una decisione che questa migrazione non prende: cosa fare offline. Il
--      repository locale non andrebbe cancellato ma usato come cache — leggere
--      dal server e riscrivere il file, e in assenza di rete partire dal file —
--      esattamente come `localCache` fa per i ripassi. È il lavoro vero, e non
--      sono le due query qui sopra.
--   4. Un test SQL in `supabase/tests/` sul modello di 0001: un secondo utente
--      non deve vedere né sovrascrivere il percorso del primo.
-- ---------------------------------------------------------------------------
