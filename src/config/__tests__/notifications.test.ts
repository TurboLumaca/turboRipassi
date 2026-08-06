/**
 * Tests for the notification plumbing: the Android channel, the foreground
 * behaviour registered at import time, and the permission question.
 *
 * expo-notifications is mocked, so the assertions are on what this module asks
 * of the SDK — the same reasoning as crashReporting.test.ts. Which occurrences
 * deserve a reminder is not tested here: that is pure logic and lives in
 * model/notifiche/notificheLogic.ts, tested there without a device.
 *
 * The module reads Platform.OS and registers the foreground handler while it
 * is being imported, so every test loads a fresh copy under a chosen platform,
 * the way driveConfig.test.ts does.
 */

interface FintoSdk {
  setNotificationHandler: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  AndroidImportance: { DEFAULT: number };
}

/** Loads notifications.ts fresh on a given platform, with the SDK mocked. */
function caricaModulo(platform: string): {
  modulo: typeof import("../notifications");
  sdk: FintoSdk;
} {
  let modulo!: typeof import("../notifications");
  let sdk!: FintoSdk;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-notifications", () => ({
      setNotificationHandler: jest.fn(),
      setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
      AndroidImportance: { DEFAULT: 3 },
    }));
    sdk = require("expo-notifications");
    modulo = require("../notifications");
  });
  return { modulo, sdk };
}

describe("comportamento in primo piano", () => {
  // Un promemoria che si vede solo ad app chiusa sarebbe inaffidabile a
  // seconda di dove si trova l'utente quando scade: il banner deve uscire
  // comunque.
  it("mostra comunque la notifica quando l'app è aperta", async () => {
    const { sdk } = caricaModulo("android");

    expect(sdk.setNotificationHandler).toHaveBeenCalledTimes(1);
    const { handleNotification } = sdk.setNotificationHandler.mock.calls[0][0];

    await expect(handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    });
  });
});

describe("initNotifications", () => {
  it("crea il canale su Android, che senza non può programmare nulla", async () => {
    const { modulo, sdk } = caricaModulo("android");

    await modulo.initNotifications();

    expect(sdk.setNotificationChannelAsync).toHaveBeenCalledWith(modulo.CANALE_ANDROID, {
      name: "Ripassi",
      importance: sdk.AndroidImportance.DEFAULT,
    });
  });

  it("non tocca i canali su iOS, dove non esistono", async () => {
    const { modulo, sdk } = caricaModulo("ios");

    await modulo.initNotifications();

    expect(sdk.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  // Viene chiamata a ogni avvio: ricreare lo stesso canale non deve rompere.
  it("è ripetibile", async () => {
    const { modulo, sdk } = caricaModulo("android");

    await modulo.initNotifications();
    await modulo.initNotifications();

    expect(sdk.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
  });
});

describe("assicuraPermessoNotifiche", () => {
  it("non richiede nulla quando il permesso c'è già", async () => {
    const { modulo, sdk } = caricaModulo("android");
    sdk.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });

    await expect(modulo.assicuraPermessoNotifiche()).resolves.toBe(true);
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  // Un rifiuto resta valido finché non è l'utente a cambiarlo dalle
  // impostazioni: richiedere a ogni ricarica sarebbe insistere al posto suo.
  it("non richiede di nuovo dopo un rifiuto definitivo", async () => {
    const { modulo, sdk } = caricaModulo("android");
    sdk.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(modulo.assicuraPermessoNotifiche()).resolves.toBe(false);
    expect(sdk.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("chiede il permesso quando non è ancora stato deciso", async () => {
    const { modulo, sdk } = caricaModulo("android");
    sdk.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    sdk.requestPermissionsAsync.mockResolvedValue({ granted: true });

    await expect(modulo.assicuraPermessoNotifiche()).resolves.toBe(true);
    expect(sdk.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("riporta il rifiuto appena espresso", async () => {
    const { modulo, sdk } = caricaModulo("android");
    sdk.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    sdk.requestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(modulo.assicuraPermessoNotifiche()).resolves.toBe(false);
  });
});
