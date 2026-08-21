import "react-native-url-polyfill/auto";
import * as Crypto from "expo-crypto";
import { registerRootComponent } from "expo";
import App from "./App";

if (typeof globalThis.crypto !== "object" || !globalThis.crypto) {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.getRandomValues !== "function") {
  (globalThis.crypto as any).getRandomValues = (array: ArrayBufferView) => {
    return Crypto.getRandomValues(array as any);
  };
}

registerRootComponent(App);
