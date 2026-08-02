# Ripassa — Build come app vera e propria (Fase 1, sezione 8 della spec)

Guida per installare Ripassa in modo **stabile** su Android, iPad e Mac, senza
Expo Go. Con l'app installata la sessione di login **persiste** (SecureStore:
Keychain/Keystore del dispositivo) e non dipende più da Expo Go né dalla rete
del Mac.

> Ordine consigliato: prima Android (tutto gratis e in cloud, zero requisiti),
> poi iPad (serve un Mac con Xcode), infine il Mac stesso.

---

## ⚠️ Requisito critico: percorso del progetto SENZA spazi

**La build iOS nativa fallisce se il percorso del progetto contiene spazi.**
La cartella attuale è `~/Documents/Side hustle/ripassiProgrammati`: lo spazio
in `Side hustle` rompe uno script interno di Expo (`get-app-config-ios.sh`,
invocato senza virgolette), con questo errore durante la compilazione:

```
bash: /Users/nikitapiraino/Documents/Side: No such file or directory
Command PhaseScriptExecution failed with a nonzero exit code
```

Verificato il 14/07/2026: spostando una copia del progetto in un percorso
senza spazi la stessa build arriva a **`** BUILD SUCCEEDED **`** e produce
`Ripassa.app` (binario universale arm64+x86_64, bundle id `com.nikita.ripassa`).
Il codice quindi compila: l'unico ostacolo era lo spazio.

**Prima di qualsiasi build iOS** (`expo prebuild`, `expo run:ios`, EAS local)
sposta il progetto in un percorso senza spazi, per esempio:

```bash
mv "$HOME/Documents/Side hustle/ripassiProgrammati" "$HOME/Documents/SideHustle/ripassa"
# oppure, più semplice:
mv "$HOME/Documents/Side hustle/ripassiProgrammati" "$HOME/ripassa"
```

Poi rigenera la cartella nativa (`ios/` è comunque gitignorata e rigenerabile):

```bash
cd "$HOME/ripassa"        # nuovo percorso senza spazi
rm -rf ios
npx expo prebuild --platform ios
```

Android via cloud EAS (sezione 1) **non** è sensibile allo spazio: la build
gira sui server Expo. Il vincolo riguarda solo le build iOS *locali*.

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

   **Crash reporting (consigliato per le build distribuite).** Senza DSN l'app
   funziona ma non segnala i crash: su build installate da altri utenti resti
   cieco sugli errori. Registra anche:

   ```bash
   npx eas-cli env:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn_del_progetto_sentry> --visibility plaintext --environment production --environment preview
   ```

   Il DSN si trova su [sentry.io](https://sentry.io) → progetto → **Settings →
   Client Keys (DSN)**. Il config plugin `@sentry/react-native` è già in
   `app.json`, quindi la build lo include senza altri passaggi. In sviluppo il
   reporting è disattivato di proposito (`__DEV__`), per non sporcare la
   dashboard con errori locali.

4. **Redirect OAuth per l'app standalone** (solo se usi "Continua con Google"):
   nella dashboard Supabase → **Authentication → URL Configuration → Redirect
   URLs** aggiungi:

   ```
   ripassa://
   ```

   Con Expo Go il redirect è `exp://...` e cambia con la rete; con l'app
   installata lo scheme è stabile (`ripassa://`) — altro vantaggio della build.
   Il login email/password funziona invece senza alcuna configurazione.

5. **Accesso a Google Drive** (allegati). È un OAuth separato dal login: usa un
   client Google **nativo** e il redirect

   ```
   com.turboLumaca.turboRipassi:/oauthredirect
   ```

   cioè `<applicationId>:/oauthredirect`, la convenzione del provider Google di
   `expo-auth-session`. Serve che, nella Google Cloud Console:

   - il client OAuth sia di tipo **Android**, con package name e SHA-1 della
     firma usata da EAS (`npx eas-cli credentials`);
   - sia attiva l'opzione **Custom URI scheme** sul client, altrimenti Google
     rifiuta con `Error 400: invalid_request`;
   - il tuo account sia fra i **Test users** finché l'app resta in *Testing*,
     altrimenti Google risponde `Error 403: access_denied`;
   - la **Google Drive API** sia abilitata nello stesso progetto.

   Lato app quello scheme va dichiarato in `app.json` → `expo.scheme` (è già
   presente, sia in minuscolo sia con le maiuscole originali). Senza la voce in
   elenco `expo prebuild` non genera l'intent filter, il redirect non trova
   nessuna app che lo gestisca e l'autorizzazione non si conclude mai.
   Modificando `scheme` serve una nuova build: è configurazione nativa, non
   codice JS.

6. **Se il consenso va a buon fine ma l'app torna alla schermata di login**,
   senza errori: Android ha ucciso il processo mentre il browser era in primo
   piano, e il redirect ha *riavviato* l'app invece di riportarla in primo
   piano. In quel caso l'url non arriva come evento `url` ma solo da
   `Linking.getInitialURL()`, e la promise che aspettava il browser è morta col
   processo. Entrambi i flussi ora leggono l'url di avvio (`useAuth.ts`) e il
   verifier PKCE di Drive è persistito in SecureStore prima di aprire il
   browser, così sopravvive al riavvio.

   Per distinguere questo caso dallo scheme non registrato, senza rifare una
   build: scrivi `ripassa://test` nella barra degli indirizzi del browser. Se
   Android propone di aprire Ripassa, gli intent filter ci sono e il problema è
   il ciclo di vita del processo, non la configurazione.

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

**Prerequisiti del Mac verificati il 14/07/2026** (installali una volta sola —
su questa macchina mancavano entrambi):

```bash
# a. CocoaPods (gestore dipendenze iOS)
brew install cocoapods

# b. Piattaforma iOS di Xcode (SDK + simulatore, ~8,5 GB).
#    Senza, xcodebuild dà: "iOS 26.5 is not installed".
xcodebuild -downloadPlatform iOS
```

Poi (dal progetto in un percorso **senza spazi**, vedi avviso in cima):

```bash
# 1. Genera il progetto nativo ios/ (rigenerabile, è gitignorato)
npx expo prebuild --platform ios

# 2. Collega l'iPad via cavo e lancialo sul dispositivo
npx expo run:ios --device --configuration Release
```

> Compilazione già validata: con percorso senza spazi il progetto raggiunge
> `** BUILD SUCCEEDED **` e produce `Ripassa.app`. Sul Mac attuale resta solo
> da collegare l'iPad e configurare la firma (i due passi qui sotto), che
> richiedono il dispositivo fisico e il tuo Apple ID.

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
