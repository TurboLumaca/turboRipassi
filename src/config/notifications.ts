/**
 * Config — local notification infrastructure (device permission, foreground
 * behaviour, Android channel). Only local notifications: nothing here talks
 * to a push service or needs a token, so there is no server component and no
 * secret to configure.
 *
 * For now the app reminds about one thing only: a ripasso whose time has
 * come. The scheduling policy itself lives in the Model
 * (model/notifiche/notificheRepo.ts); this file is just the device plumbing
 * that policy depends on.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Android requires a channel before any notification can be scheduled on it. */
const CANALE_ANDROID = "ripassi";

/**
 * Foreground behaviour: a notification whose time comes while the app is open
 * still shows, same as a push would. Nothing in this app already tells the
 * user "it's time" while they're looking at the Home list themselves, so
 * suppressing it here would just make the reminder unreliable depending on
 * whether the app happened to be open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * One-time device setup: called at startup, like initCrashReporting. Safe to
 * call on every launch; creating the same channel twice is a no-op.
 */
export async function initNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANALE_ANDROID, {
      name: "Ripassi",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Asks for permission if it hasn't been decided yet. Never asks again after a
 * refusal — that decision belongs to the user until they change it themselves
 * in system settings, not to a screen re-asking on every reload.
 */
export async function assicuraPermessoNotifiche(): Promise<boolean> {
  const attuale = await Notifications.getPermissionsAsync();
  if (attuale.granted) return true;
  if (!attuale.canAskAgain) return false;
  const richiesto = await Notifications.requestPermissionsAsync();
  return richiesto.granted;
}

export { CANALE_ANDROID };
