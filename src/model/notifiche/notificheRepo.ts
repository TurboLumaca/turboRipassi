/**
 * Model — scheduling of local reminders for ripassi.
 *
 * One notification per occurrence, identified by the occurrence's own id: the
 * OS-level scheduler is keyed the same way the app's own data is, so
 * "reschedule this occurrence" is just "schedule again with the same id" and
 * needs no separate mapping table.
 *
 * Interface + module default, same shape as RipassiRepo and AllegatiRepo: the
 * Controller depends on the contract, and a test can hand it a fake without
 * mocking expo-notifications.
 */
import * as Notifications from "expo-notifications";
import { CANALE_ANDROID } from "@/config/notifications";

export interface NotificheRepo {
  /**
   * Schedules (or reschedules, same id) a reminder for the given instant.
   *
   * `domanda` è il corpo: quel che rende la notifica leggibile senza aprire
   * l'app, e quindi un invito invece di un richiamo all'ordine.
   */
  pianifica(id: string, titolo: string, domanda: string, quando: Date): Promise<void>;
  /** Cancels a reminder. Safe to call for an id that was never scheduled. */
  cancella(id: string): Promise<void>;
  /** Cancels all scheduled reminders on the device (e.g. on sign-out). */
  cancellaTutte(): Promise<void>;
}

export const notificheRepo: NotificheRepo = {
  async pianifica(id, titolo, domanda, quando) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        // Il titolo del concetto in testa, la domanda nel corpo: sessanta
        // secondi dichiarati, e nessuna parola sul non aver ripassato ieri.
        title: titolo,
        body: `${domanda} — 60 secondi`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: quando,
        channelId: CANALE_ANDROID,
      },
    });
  },

  async cancella(id) {
    await Notifications.cancelScheduledNotificationAsync(id);
  },

  async cancellaTutte() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
