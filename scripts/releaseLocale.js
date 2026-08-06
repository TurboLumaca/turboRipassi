#!/usr/bin/env node
/**
 * Build di release locale con lo stesso peso di quella EAS.
 *
 * `npx expo run:android` da solo produce una build di *debug*: dev client
 * incluso, niente minify, niente shrink. È giusto così — serve a sviluppare —
 * ma è anche il motivo per cui l'app installata da lì pesa tre volte quella
 * distribuita. Questo script esiste per l'altro caso: installare in locale
 * esattamente ciò che riceverebbe un utente.
 *
 * Fa le tre cose che su EAS fanno il profilo e l'hook `eas-build-post-install`,
 * e che in locale non farebbe nessuno:
 *
 * 1. esclude dall'autolinking la catena del dev client (e con essa ML Kit
 *    barcode scanning, `libbarhopper_v3.so`), scrivendo `expo.autolinking`
 *    in `package.json` — l'unica fonte che l'autolinking legge;
 * 2. rigenera `android/` con `prebuild --clean`, perché è `prebuild` a
 *    scrivere `android.enableMinifyInReleaseBuilds` in `gradle.properties`
 *    (da `expo-build-properties`) e ad applicare `plugins/withAbiRelease.js`:
 *    una cartella `android/` già esistente e generata prima di quelle voci
 *    resta indietro senza dirlo, ed è esattamente il caso che produceva un
 *    APK da 104 MB con `enableMinifyInReleaseBuilds=false`;
 * 3. **ripristina `package.json`** a fine corsa, riuscita o no. La modifica al
 *    punto 1 è un dettaglio di build, non un cambiamento del progetto: se
 *    restasse sul disco finirebbe in un commit, e il dev client sparirebbe
 *    anche a chi sviluppa.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RADICE = path.resolve(__dirname, "..");
const PACKAGE_JSON = path.join(RADICE, "package.json");

/** Solo Android: su iOS il peso non si tocca da qui (nessun autolinking da
 *  escludere, nessuno `splits.abi`, e la release si sceglie con
 *  `--configuration Release`). Vedi BUILD.md, sezione 2. */

const esegui = (comando, argomenti, ambiente = {}) =>
  execFileSync(comando, argomenti, {
    cwd: RADICE,
    stdio: "inherit",
    env: { ...process.env, ...ambiente },
  });

/** Il contenuto originale, byte per byte: il ripristino non deve reindentare
 *  né riordinare niente, altrimenti "ripristinare" sporca comunque il diff. */
const originale = fs.readFileSync(PACKAGE_JSON, "utf8");

process.on("exit", () => fs.writeFileSync(PACKAGE_JSON, originale));

// `preview` e non `production`: qui si produce un APK, non un app bundle.
// autolinkingPerProfilo.js legge EAS_BUILD_PROFILE e per qualunque valore
// diverso da `development` esclude il dev client, che è ciò che serve.
esegui("node", [path.join(__dirname, "autolinkingPerProfilo.js")], {
  EAS_BUILD_PROFILE: "preview",
});

// Qui invece EAS_BUILD_PROFILE resta fuori di proposito: con `preview`
// withAbiRelease.js terrebbe la sola `arm64-v8a`, mentre una build locale
// deve poter finire anche su un emulatore. Senza profilo genera un APK per
// ognuna delle quattro ABI e `expo run` installa quello del dispositivo.
esegui("npx", ["expo", "prebuild", "--clean", "--platform", "android"]);
esegui("npx", ["expo", "run:android", "--variant", "release"], {
  SENTRY_DISABLE_AUTO_UPLOAD: "true",
  ANDROID_HOME: `${process.env.HOME}/Library/Android/sdk`,
});
