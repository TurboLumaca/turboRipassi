# Ripassa — Build come app vera e propria (Fase 1, sezione 8 della spec)

Guida per installare Ripassa in modo **stabile** su Android, iPad e Mac, senza
Expo Go. Con l'app installata la sessione di login **persiste** (AsyncStorage
del dispositivo) e non dipende più da Expo Go né dalla rete del Mac.

> Ordine consigliato: prima Android (tutto gratis e in cloud, zero requisiti),
> poi iPad (serve un Mac con Xcode), infine il Mac stesso.

---

## 0. Prerequisiti una tantum

1. **Account Expo gratuito**: [expo.dev/signup](https://expo.dev/signup).
2. Login e collegamento del progetto (dalla cartella del progetto):

   ```bash
   npx eas-cli login
   npx eas-cli init        # crea il progetto su expo.dev e scrive projectId in app.json
   ```

3. **Variabili d'ambiente su EAS** — il file `.env` locale è gitignorato e NON
   viene caricato nelle build cloud. Vanno registrate una volta sola:

   ```bash
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://rbiaknblwcjxexkyhgez.supabase.co --visibility plaintext --environment production --environment preview --environment development
   npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <chiave_publishable> --visibility plaintext --environment production --environment preview --environment development
   ```

   (In alternativa: dashboard [expo.dev](https://expo.dev) → progetto *ripassa* →
   **Environment variables**. La chiave publishable non è un segreto: è la
   stessa che finisce dentro l'app.)

4. **Redirect OAuth per l'app standalone** (solo se usi "Continua con Google"):
   nella dashboard Supabase → **Authentication → URL Configuration → Redirect
   URLs** aggiungi:

   ```
   ripassa://
   ```

   Con Expo Go il redirect è `exp://...` e cambia con la rete; con l'app
   installata lo scheme è stabile (`ripassa://`) — altro vantaggio della build.
   Il login email/password funziona invece senza alcuna configurazione.

---

## 1. Android (Samsung) — APK via EAS, gratis

```bash
npx eas-cli build --platform android --profile preview
```

- La build gira nel cloud Expo (piano gratuito: ~15 build Android/mese), dura
  10–20 minuti. Non serve Android Studio.
- A fine build il terminale (e la pagina expo.dev) mostra un **link/QR**:
  aprilo dal Samsung e scarica l'`.apk`.
- Alla prima installazione Android chiede di consentire le "app da origini
  sconosciute" per il browser: conferma e installa.
- Login una volta sola: la sessione resta salvata sul dispositivo.

Per aggiornare l'app in futuro: rilancia lo stesso comando e installa il nuovo
APK sopra il vecchio (i dati e il login restano).

## 2. iPad — build locale con Apple ID gratuito (Personal Team)

I profili gratuiti Apple **non** si possono usare nelle build cloud EAS: la
firma va fatta in locale con Xcode. Serve: Mac con **Xcode** installato
(gratuito dal Mac App Store), iPad e cavo USB.

```bash
# 1. Genera il progetto nativo ios/ (rigenerabile, è gitignorato)
npx expo prebuild --platform ios

# 2. Collega l'iPad via cavo e lancialo sul dispositivo
npx expo run:ios --device --configuration Release
```

Al primo giro:
- Xcode → Settings → Accounts → aggiungi il tuo Apple ID (team "Personal Team").
- Se la firma fallisce da CLI: apri `ios/Ripassa.xcworkspace` in Xcode,
  target *Ripassa* → **Signing & Capabilities** → spunta *Automatically manage
  signing* e scegli il tuo Personal Team, poi rilancia il comando.
- Sull'iPad: Impostazioni → Generali → **Gestione VPN e dispositivo** →
  autorizza il tuo Apple ID (solo la prima volta).

**Limite reale (spec, sezione 8):** il profilo gratuito scade dopo **7 giorni**.
L'app resta installata ma smette di aprirsi: ricollega l'iPad e rilancia
`npx expo run:ios --device --configuration Release` (1 comando, pochi minuti).
La sessione di login e i dati locali NON si perdono al rinnovo.

> Alternativa senza scadenza: Apple Developer Program (99 $/anno) → a quel
> punto anche l'iPad si può servire dal cloud con
> `npx eas-cli build --platform ios --profile preview` e installazione via link,
> come per Android. Da valutare solo se il rinnovo settimanale diventa
> insostenibile (decisione consapevole richiesta dalla spec).

## 3. Mac (Apple Silicon M2) — l'app iPad gira nativamente

Dopo il prebuild della sezione 2:

1. Apri `ios/Ripassa.xcworkspace` in Xcode.
2. In alto scegli come destinazione **My Mac (Designed for iPad)**.
3. `Run` (⌘R): l'app si installa in `/Applications` e si apre come app Mac.

Vale lo stesso limite dei 7 giorni del Personal Team. Se qualche modulo nativo
(fotocamera, picker) si comportasse male su macOS (rischio segnalato in spec,
sezione 11.2), il Mac può ripiegare sull'uso in sviluppo (`npx expo start`).

---

## Riepilogo comandi rapidi

| Obiettivo | Comando |
|---|---|
| APK Android (cloud, gratis) | `npx eas-cli build -p android --profile preview` |
| iPad (locale, Apple ID gratuito) | `npx expo run:ios --device --configuration Release` |
| Mac M2 | Xcode → destinazione *My Mac (Designed for iPad)* → Run |
| Test | `npm test` |
| Typecheck | `npm run typecheck` |

## Domande frequenti

**Il login resta?** Sì: la sessione Supabase è salvata in AsyncStorage del
dispositivo e si auto-rinnova quando l'app torna in foreground. Si perde solo
disinstallando l'app (o con "Esci").

**Devo rifare la build quando cambio il codice?** Sì per le app installate
(Android: nuovo APK; iPad/Mac: nuovo run). Expo Go resta comodo per lo sviluppo
quotidiano.

**Quanto costa?** Android: zero. iPad/Mac: zero con il fastidio del rinnovo
settimanale, altrimenti 99 $/anno. Nessun altro costo (Supabase resta nel piano
gratuito).
