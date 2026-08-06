/**
 * Quante architetture native porta l'APK distribuito a mano.
 *
 * Senza filtro sono quattro — `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` —
 * perché le librerie native arrivano come AAR già compilati per tutte, e nel
 * modulo `app` non c'è niente che ne scarti nessuna: la property
 * `reactNativeArchitectures` di `gradle.properties` vale solo per i moduli
 * compilati da sorgente (expo-sqlite, safe-area-context), non per
 * `libreactnative.so` e compagnia, che pesano quasi tutto. Su 61 MB di `lib/`,
 * 34 sono le due ABI degli emulatori, che nessun telefono aprirà mai.
 *
 * Il filtro passa da `splits.abi` e non da `ndk.abiFilters`: quest'ultimo è
 * stato provato per primo e non toglie niente dall'APK — non si applica alle
 * `.so` che arrivano già compilate dalle dipendenze, che qui sono tutte.
 *
 * Vale solo per il profilo `preview`, cioè l'unico che produce un APK da
 * installare a mano, e solo `arm64-v8a`: è un file unico, e ogni telefono a
 * 64 bit usa quella. Un dispositivo solo a 32 bit non lo installa — per
 * quello c'è il Play Store, e infatti l'app bundle di `production` resta
 * intatto: là le ABI le tiene tutte apposta, perché è il Play Store a
 * consegnare a ciascun dispositivo solo la sua, quindi tenerle non pesa sul
 * download di nessuno ed è ciò che mantiene installabile anche un telefono a
 * 32 bit.
 *
 * Fuori da EAS non tocca niente: `splits` varrebbe anche per le build di
 * debug, e un APK senza `x86` non si installa sull'emulatore.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const PROFILO_APK = "preview";
const ABI = "arm64-v8a";

/** Un secondo blocco `android { }` configura la stessa estensione del primo:
 *  aggiungerlo in fondo evita di riscrivere per posizione un file generato. */
const BLOCCO = `
// Aggiunto da plugins/withAbiRelease.js — vedi lì il perché di questo elenco.
android {
    splits {
        abi {
            enable true
            reset()
            include "${ABI}"
            universalApk false
        }
    }
}
`;

module.exports = function withAbiRelease(config) {
  if (process.env.EAS_BUILD_PROFILE !== PROFILO_APK) return config;

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    cfg.modResults.contents += BLOCCO;
    return cfg;
  });
};
