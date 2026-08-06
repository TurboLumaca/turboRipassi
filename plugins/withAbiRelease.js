/**
 * Una sola architettura nativa per APK, in ogni build che produce un APK.
 *
 * Senza filtro l'APK ne porta quattro — `arm64-v8a`, `armeabi-v7a`, `x86`,
 * `x86_64` — perché le librerie native arrivano come AAR già compilati per
 * tutte, e nel modulo `app` non c'è niente che ne scarti nessuna: la property
 * `reactNativeArchitectures` di `gradle.properties` vale solo per i moduli
 * compilati da sorgente (expo-sqlite, safe-area-context), non per
 * `libreactnative.so` e compagnia, che pesano quasi tutto. Su 81 MB di `lib/`
 * misurati in una release locale, 45 sono le due ABI degli emulatori.
 *
 * Il filtro passa da `splits.abi` e non da `ndk.abiFilters`: quest'ultimo è
 * stato provato per primo e non toglie niente dall'APK — non si applica alle
 * `.so` che arrivano già compilate dalle dipendenze, che qui sono tutte.
 *
 * `splits` non produce un APK più piccolo: ne produce **uno per ABI**
 * (`app-arm64-v8a-release.apk`, `app-x86_64-debug.apk`, …), ciascuno con la
 * sola architettura che serve. Per questo può restare acceso anche in debug,
 * cosa che la versione precedente di questo file evitava: `expo run:android`
 * cerca l'APK per nome, prima nella variante che corrisponde alle ABI del
 * dispositivo collegato e solo dopo quella generica
 * (`resolveInstallApkNameAsync` di @expo/cli), quindi installa da sé quello
 * giusto — emulatore x86_64 compreso.
 *
 * Chi riceve l'elenco completo:
 *
 * - **EAS `preview`** → solo `arm64-v8a`. È l'unico profilo che produce un APK
 *   da installare a mano passandolo da un link: un file unico, e ogni telefono
 *   a 64 bit usa quella. Un dispositivo solo a 32 bit non lo installa — per
 *   quello c'è il Play Store.
 * - **EAS `production`** → nessuno `splits`. Produce un app bundle, dove le
 *   ABI vanno tenute tutte apposta: è il Play Store a consegnare a ciascun
 *   dispositivo solo la sua, quindi tenerle non pesa sul download di nessuno
 *   ed è ciò che mantiene installabile anche un telefono a 32 bit.
 * - **tutto il resto** (build locali: `expo run:android`, `./gradlew
 *   assembleRelease`) → tutte e quattro, ma una per APK. È il caso che prima
 *   restava scoperto, ed è il motivo per cui l'app installata da `expo run`
 *   pesava quanto quattro architetture invece che una.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const TUTTE_LE_ABI = ["arm64-v8a", "armeabi-v7a", "x86", "x86_64"];
const PROFILO_APK_A_MANO = "preview";
const PROFILO_APP_BUNDLE = "production";

/** Un secondo blocco `android { }` configura la stessa estensione del primo:
 *  aggiungerlo in fondo evita di riscrivere per posizione un file generato. */
const blocco = (abi) => `
// Aggiunto da plugins/withAbiRelease.js — vedi lì il perché di questo elenco.
android {
    splits {
        abi {
            enable true
            reset()
            include ${abi.map((a) => `"${a}"`).join(", ")}
            universalApk false
        }
    }
}
`;

module.exports = function withAbiRelease(config) {
  const profilo = process.env.EAS_BUILD_PROFILE;
  if (profilo === PROFILO_APP_BUNDLE) return config;

  const abi = profilo === PROFILO_APK_A_MANO ? ["arm64-v8a"] : TUTTE_LE_ABI;

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    cfg.modResults.contents += blocco(abi);
    return cfg;
  });
};
