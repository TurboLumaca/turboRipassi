/**
 * Il progetto nativo Android deve appartenere all'app del branch corrente.
 *
 * `android/` è in `.gitignore`: non è versionato, è generato da prebuild ed è
 * uno solo, condiviso da tutti i branch. Ma i branch non descrivono la stessa
 * app: `main` è TurboRipassi (`com.turboLumaca.turboRipassi`), `app-intera` è
 * TurboGenio (`com.turboLumaca.turboGenio`). Sono due `applicationId` diversi,
 * quindi per Android sono due applicazioni distinte, che possono stare sullo
 * stesso dispositivo insieme.
 *
 * Il problema è che `expo run:android` non lo sa. `ensureNativeProjectAsync`
 * (in `@expo/cli`) lancia prebuild **solo se la cartella `android/` non
 * esiste**; se esiste la usa così com'è, senza confrontarla con l'app config.
 * Dopo un cambio di branch la cartella è quella dell'app precedente, e il
 * `run:android` successivo produce un APK con l'`applicationId` vecchio: il
 * dispositivo lo vede come aggiornamento dell'altra app e la **sostituisce**,
 * invece di affiancarla.
 *
 * Questo script chiude quel buco: confronta l'`applicationId` scritto in
 * `android/app/build.gradle` con `expo.android.package` di `app.json` e, se
 * divergono, rigenera il progetto nativo dalla config del branch su cui ci si
 * trova davvero. Quando coincidono non tocca niente, così il caso normale —
 * ricostruire la stessa app — resta veloce e conserva la cache di Gradle.
 *
 * La rigenerazione cancella la cartella invece di passare `--clean` a prebuild
 * perché `--clean` chiede conferma quando il repository ha modifiche non
 * committate, e questo script gira in mezzo a `npm run android`. Rigenerare
 * tutto è comunque inevitabile: cambiando package cambia anche il percorso dei
 * sorgenti Kotlin (`app/src/main/java/com/turboLumaca/<app>/`), e un prebuild
 * non pulito lascerebbe la cartella vecchia accanto alla nuova, con due
 * `MainActivity` nello stesso build.
 *
 * `local.properties` non è generato da prebuild ma serve a Gradle per trovare
 * l'SDK (qui `ANDROID_HOME` non è esportato), quindi va salvato prima di
 * cancellare e riscritto dopo.
 *
 * Lo stesso disallineamento vale per `ios/`, dove però il bundle identifier
 * sta nel `.pbxproj` e non c'è un punto altrettanto stabile da leggere: lì,
 * dopo un cambio di branch, serve ancora `npx expo prebuild -p ios --clean` a
 * mano.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const radice = path.resolve(__dirname, "..");
const cartellaNativa = path.join(radice, "android");
const buildGradle = path.join(cartellaNativa, "app", "build.gradle");
const localProperties = path.join(cartellaNativa, "local.properties");

const appConfig = JSON.parse(fs.readFileSync(path.join(radice, "app.json"), "utf8"));
const pacchettoAtteso = appConfig.expo?.android?.package;

if (!pacchettoAtteso) {
  console.error("[nativo] app.json non dichiara expo.android.package: non so quale app costruire.");
  process.exit(1);
}

const pacchettoPresente = fs.existsSync(buildGradle)
  ? fs.readFileSync(buildGradle, "utf8").match(/^\s*applicationId\s+['"]([^'"]+)['"]/m)?.[1]
  : undefined;

if (pacchettoPresente === pacchettoAtteso) {
  console.log(`[nativo] android/ è già di ${pacchettoAtteso}.`);
  process.exit(0);
}

if (pacchettoPresente) {
  console.log(
    `[nativo] android/ appartiene a ${pacchettoPresente}, ma questo branch è ` +
      `${pacchettoAtteso}: rigenero il progetto nativo così le due app restano distinte.`
  );
} else {
  console.log(`[nativo] Progetto Android assente o illeggibile: lo genero per ${pacchettoAtteso}.`);
}

const sdkSalvato = fs.existsSync(localProperties)
  ? fs.readFileSync(localProperties, "utf8")
  : undefined;

fs.rmSync(cartellaNativa, { recursive: true, force: true });

const prebuild = spawnSync("npx", ["expo", "prebuild", "-p", "android"], {
  cwd: radice,
  stdio: "inherit",
});
if (prebuild.status !== 0) process.exit(prebuild.status ?? 1);

const sdkDaRiscrivere = sdkSalvato ?? sdkPredefinito();
if (sdkDaRiscrivere && !fs.existsSync(localProperties)) {
  fs.writeFileSync(localProperties, sdkDaRiscrivere);
  console.log("[nativo] local.properties riscritto: Gradle sa di nuovo dov'è l'SDK.");
}

/** Percorso standard dell'SDK installato da Android Studio, se c'è. */
function sdkPredefinito() {
  const percorso = path.join(os.homedir(), "Library", "Android", "sdk");
  return fs.existsSync(percorso) ? `sdk.dir=${percorso}\n` : undefined;
}
