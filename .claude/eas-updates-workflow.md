# Flusso di sviluppo con EAS Updates

**Obiettivo:** Una sola build iniziale, poi aggiornamenti OTA per ogni cambio (senza reinstallare l'app).

## Configurazione attuale
- ✅ `app.json`: `updates.url` punta a Expo, `runtimeVersion` basato su versione app
- ✅ `eas.json`: profilo "preview" con `channel: "preview"`
- ✅ `package.json`: expo-updates ~29.0.20 installato

## Flusso di sviluppo

### 1️⃣ Build iniziale (una volta)
```bash
# Fare un build Android per preview (generi il QR code)
npx eas build --platform android --profile preview

# Scannerizza il QR con Expo Go, installa l'app
# L'app è pronta e rimane anche se chiudi il Mac
```

### 2️⃣ Per ogni cambio al codice
```bash
# Fare un aggiornamento OTA sul branch "preview"
npx eas update --branch preview

# L'app riceve l'update automaticamente (senza reinstallare!)
# Quando la riapri, scarica il nuovo codice
```

### 3️⃣ Sul telefono
- L'app controlla gli aggiornamenti ogni volta che si avvia
- Se ce ne sono, li scarica in background e applica
- Nessuna reinstallazione, nessun QR code nuovo

## Vantaggi
- **Fast:** Cambio codice → `eas update` (30 sec) vs rebuild completo (10 min)
- **Istantaneo:** Aggiornamento senza uscire da Expo Go
- **Persistente:** L'app rimane anche con Mac spento

## Quando fare una build nuova
- Cambio dipendenze native (npm install expo-...)
- Cambio icona, splash screen, plugin
- Aggiornamento versione minore/major (app.json > version)
- Reset completo: `npx eas build --platform android --profile preview`

## Workflow tipico (dev)
```bash
# Giorno 1: build iniziale
npx eas build --platform android --profile preview
# → Scannerizza QR, installa su telefono

# Giorno 2+: solo update
npm run ...  # sviluppa
git commit
npx eas update --branch preview
# → Refresha sul telefono
```

## Per testare localmente prima di publishare
```bash
npx expo start --dev-client  # o --web per testing rapido
# Scannerizza il QR da Expo Go Dev Client
```

## Note
- Channel "preview" è isolato dalla production
- Ogni update è versionato e può essere rollbackato da Expo dashboard
- Se qualcosa rompe, torna semplicemente alla versione precedente
