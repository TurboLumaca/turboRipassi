# Account e identità di accesso

## Il problema

Registrandosi con email e password e poi entrando con Google — **stesso indirizzo** — si ottenevano due insiemi di ripassi separati.

Non era un bug dell'app: era il modello dati. La proprietà di ogni riga era `auth.users.id`, e un utente di `auth.users` non è una persona, è **un modo di accedere**. Supabase identifica un accesso con la coppia `(provider, subject)`:

| Accesso | Identità | Riga in `auth.users` |
|---|---|---|
| Email + password | `("email", "tizio@gmail.com")` | `U1` |
| Google | `("google", "sub=118273…")` | `U2` |

L'email è solo un *attributo* delle due identità, non la chiave. Con `ripassi.user_id` che puntava a `auth.users(id)`, `U1` e `U2` avevano ripassi diversi perché erano due proprietari diversi.

## La soluzione: due concetti, non uno

```
account        la persona.        Possiede ripassi, occorrenze, allegati.
identita       un modo di entrare. N per account, 1 per riga di auth.users.
```

```
auth.users U1 ──▶ identita(provider=email)  ─┐
                                             ├──▶ account A ──▶ ripassi, occorrenze, allegati
auth.users U2 ──▶ identita(provider=google) ─┘
```

Qualunque identità risolve allo stesso `account`, quindi i dati seguono la persona e non il pulsante di login premuto. Le policy RLS non guardano più `auth.uid()` ma `public.account_corrente()`, che traduce la sessione nel suo account.

Le due righe in `auth.users` **possono continuare a esistere**: non è un problema, perché non sono più loro a possedere niente.

## La regola di collegamento

Un'identità entra in un account esistente **solo a email verificata da entrambe le parti**. Senza questo vincolo il modello sarebbe peggiore del bug che risolve:

1. Un attaccante registra `vittima@gmail.com` con una password scelta da sé. Non ha accesso alla casella.
2. Mesi dopo la vittima entra con Google.
3. Se il sistema unisse "a parità di email", la vittima finirebbe **nell'account dell'attaccante**, che ne ha la password.

In pratica:

- **Google** arriva già verificato da Google → può collegarsi in fase di `INSERT`.
- **Email + password** non si collega mai in `INSERT`, ma solo quando il link di conferma viene davvero cliccato (trigger su `email_confirmed_at`).

Questa seconda regola vale anche se qualcuno disattiva *Confirm email* nella dashboard: in quel caso la registrazione con password nasce "verificata" senza che nessuno abbia provato niente, quindi non le si concede di collegarsi. Il peggio che può succedere è un account duplicato, mai un account rubato.

L'invariante è imposta dal database, non dal codice applicativo:

```sql
create unique index account_email_verificata_uniq
  on public.account (email_canonica)
  where email_verificata;
```

Al massimo **un account verificato per indirizzo**. Quelli non verificati possono convivere: è esattamente ciò che rende innocua una registrazione mai confermata fatta sull'indirizzo di un altro.

## Cosa succede nei casi concreti

| Situazione | Risultato |
|---|---|
| Entro con Google, mai usato prima | Nuovo account |
| Ho già l'account Google, mi registro con password (stessa mail) e confermo | La password entra **nello stesso account**: stessi ripassi |
| Ho l'account con password (confermato), entro con Google | Google entra **nello stesso account**: stessi ripassi |
| Qualcuno registra la mia mail con password e non conferma mai | Account separato e inerte. Il mio resta mio |
| Collego Google dal pannello in Home | Un solo `auth.users` con due metodi. I ripassi erano già gli stessi |
| Cambio indirizzo email dopo la prima conferma | L'account resta dov'è. I dati appartengono alla persona, non all'indirizzo |

## Normalizzazione dell'indirizzo

`email_canonica` è `lower(trim(email))`. **Niente di più**, deliberatamente: togliere i punti o le parti dopo il `+` è una regola specifica di Gmail, e applicarla a tutti i domini unirebbe account di persone diverse. Su un dominio aziendale `mario.rossi@` e `mariorossi@` possono essere due colleghi.

## `user_id` non è sparito

Resta sulle tre tabelle come colonna di **audit**: dice quale accesso ha creato la riga. È nullable, e la sua foreign key è passata da `on delete cascade` a `on delete set null` — scollegare un accesso non deve portarsi via i ripassi che ha creato. Non va mai letta per decidere a chi appartiene qualcosa: per quello c'è `account_id`.

Il client non invia più nessuna delle due colonne: le riempie Postgres dalla sessione (`default public.account_corrente()` e `default auth.uid()`). Un client che le mandasse starebbe dichiarando una proprietà che non è lui a decidere.

## Migrazione dei dati esistenti

`supabase/migrations/0001_account_identita.sql` fa tutto in un colpo, ed è idempotente:

1. Crea `account` e `identita`.
2. Crea un account per ogni riga esistente di `auth.users`, dalla più vecchia alla più recente — così l'accesso usato da più tempo possiede l'account e i successivi vi si aggiungono.
3. Riporta `ripassi`, `occorrenze` e `allegati` sul nuovo `account_id`.
4. Impone l'indice unico, i vincoli e le nuove policy RLS.
5. Installa i due trigger su `auth.users`.

Note pratiche:

- **Fai un backup prima.** Riscrive le colonne di proprietà.
- Se restano righe senza account (un `user_id` orfano) la migrazione **si ferma con un errore** invece di indovinare: le righe vanno guardate, non cancellate in silenzio.
- I ripassi duplicati fra due account fusi restano duplicati. Due account della stessa persona possono legittimamente contenere due ripassi con lo stesso titolo su scadenze diverse, e sceglierne uno da buttare significherebbe distruggere dati per fare ordine in una lista. Vanno eliminati a mano dall'app.
- I trigger vengono creati su `auth.users`: l'SQL Editor gira come `postgres` e ne ha il diritto. Un errore di permessi lì significa che lo script è stato lanciato con un ruolo più debole.

## Perché non le altre strade

**Togliere il login con email e password** funziona, ma esclude chi non ha (o non vuole usare) un account Google, lega tutto a un solo identity provider, e soprattutto non risolve la causa: il giorno in cui si aggiunge "Accedi con Apple" il problema si ripresenta identico.

**Attivare il linking automatico di Supabase** è la via rapida, ma agisce su `auth.users`: continuerebbe a esistere un solo concetto dove ne servono due, e la proprietà dei dati resterebbe agganciata a un modo di accedere.

**Fondere gli account a posteriori** serve solo per i duplicati già esistenti — infatti la migrazione lo fa una volta sola, con `public.unisci_account`. Come meccanismo a regime non serve: con la separazione account/identità i duplicati non si creano più.
