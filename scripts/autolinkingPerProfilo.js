/**
 * expo-dev-client fuori dalle build che non sono di sviluppo.
 *
 * `expo-dev-client` porta con sé il menu sviluppatore e il suo scanner di QR
 * per Metro, e con esso `com.google.mlkit:barcode-scanning`, cioè
 * `libbarhopper_v3.so`: quasi 8 MB di libreria nativa (4,7 su arm64-v8a, 3,1
 * su armeabi-v7a) per una funzione che questa app non ha. L'autolinking di
 * Expo lo collega senza condizioni, produzione compresa.
 *
 * L'esclusione è condizionale e non permanente perché il modulo serve davvero:
 * `expo run:android` in locale e il profilo `development` di `eas.json`
 * esistono per averlo. Toglierlo da `package.json` una volta per tutte
 * significherebbe rinunciare al dev client, non alleggerire la release.
 *
 * L'unica fonte che l'autolinking legge per l'esclusione è `package.json`
 * (`expo.autolinking.exclude`): non l'app config, che infatti non viene
 * consultata: quindi la sezione va scritta lì, e va scritta al momento
 * giusto. Questo script gira come `eas-build-post-install`, cioè dopo
 * l'installazione delle dipendenze e prima di prebuild e Gradle, che sono i
 * due passaggi che quella sezione la leggono.
 *
 * Fuori da EAS non fa niente: `package.json` resta com'è nel repository, con
 * il dev client incluso, che è ciò che serve a chi sviluppa in locale.
 */
const fs = require("fs");
const path = require("path");

/**
 * Tutta la catena, non solo `expo-dev-client`: da SDK 54 l'autolinking
 * collega anche i moduli transitivi, e `libbarhopper_v3.so` arriva da
 * `expo-dev-launcher`. Escludendo la sola dipendenza diretta i tre moduli
 * sotto restavano collegati, ML Kit compreso — verificato con
 * `expo-modules-autolinking resolve -p android`.
 */
const MODULI = [
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
];
const PROFILO_SVILUPPO = "development";

const profilo = process.env.EAS_BUILD_PROFILE;
if (!profilo) {
  console.log("[autolinking] Nessun profilo EAS: package.json resta com'è.");
  process.exit(0);
}

const percorso = path.resolve(__dirname, "..", "package.json");
const pacchetto = JSON.parse(fs.readFileSync(percorso, "utf8"));
const escludi = profilo !== PROFILO_SVILUPPO;

const expo = pacchetto.expo ?? {};
const autolinking = expo.autolinking ?? {};
const esclusi = new Set(autolinking.exclude ?? []);

for (const modulo of MODULI) {
  if (escludi) esclusi.add(modulo);
  else esclusi.delete(modulo);
}

pacchetto.expo = { ...expo, autolinking: { ...autolinking, exclude: [...esclusi] } };
fs.writeFileSync(percorso, `${JSON.stringify(pacchetto, null, 2)}\n`);

console.log(
  escludi
    ? `[autolinking] Profilo «${profilo}»: escluso il dev client (${MODULI.join(", ")}), e con esso libbarhopper_v3.so di ML Kit.`
    : `[autolinking] Profilo «${profilo}»: dev client incluso, è il motivo per cui questo profilo esiste.`
);
