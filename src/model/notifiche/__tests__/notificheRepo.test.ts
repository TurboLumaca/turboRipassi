/**
 * Tests for the reminder repository: the thin layer between the scheduling
 * policy and expo-notifications.
 *
 * The SDK is mocked, so what is checked is the contract the rest of the app
 * relies on — that a reminder is scheduled under the occurrence's own id, on
 * the Android channel config/notifications created, and that rescheduling the
 * same occurrence means calling again with the same id rather than keeping a
 * mapping table somewhere.
 */
jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue("id"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: "date" },
  // Il canale arriva da config/notifications, che al momento dell'import
  // registra anche il comportamento in primo piano: senza questo il mock non
  // regge la catena di import.
  setNotificationHandler: jest.fn(),
}));

import * as Notifications from "expo-notifications";
import { CANALE_ANDROID } from "@/config/notifications";
import { notificheRepo } from "../notificheRepo";

const pianificaSdk = Notifications.scheduleNotificationAsync as jest.Mock;
const cancellaSdk = Notifications.cancelScheduledNotificationAsync as jest.Mock;

const QUANDO = new Date("2026-09-01T09:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("pianifica", () => {
  it("programma il promemoria per l'istante richiesto", async () => {
    await notificheRepo.pianifica("occ-1", "Teorema di Bayes", QUANDO);

    expect(pianificaSdk).toHaveBeenCalledTimes(1);
    const richiesta = pianificaSdk.mock.calls[0][0];
    expect(richiesta.identifier).toBe("occ-1");
    expect(richiesta.trigger).toEqual({
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: QUANDO,
      channelId: CANALE_ANDROID,
    });
  });

  // Il titolo del ripasso è l'unica cosa che distingue un promemoria da un
  // altro nella tendina delle notifiche.
  it("mette il titolo del ripasso nel corpo", async () => {
    await notificheRepo.pianifica("occ-1", "Teorema di Bayes", QUANDO);

    expect(pianificaSdk.mock.calls[0][0].content).toEqual({
      title: "È ora di ripassare",
      body: "Teorema di Bayes",
    });
  });

  // Riprogrammare è chiamare di nuovo con lo stesso id: è quello che rende
  // superflua una tabella di corrispondenza fra occorrenze e notifiche.
  it("riprogramma la stessa occorrenza sotto lo stesso identificativo", async () => {
    const dopo = new Date("2026-09-02T09:00:00.000Z");

    await notificheRepo.pianifica("occ-1", "Teorema di Bayes", QUANDO);
    await notificheRepo.pianifica("occ-1", "Teorema di Bayes", dopo);

    expect(pianificaSdk.mock.calls.map((c) => c[0].identifier)).toEqual(["occ-1", "occ-1"]);
    expect(pianificaSdk.mock.calls[1][0].trigger.date).toBe(dopo);
  });
});

describe("cancella", () => {
  it("cancella per identificativo dell'occorrenza", async () => {
    await notificheRepo.cancella("occ-1");
    expect(cancellaSdk).toHaveBeenCalledWith("occ-1");
  });

  // Il Controller cancella anche id che questo dispositivo potrebbe non aver
  // mai programmato: non deve diventare un errore da mostrare.
  it("non fallisce su un id mai programmato", async () => {
    await expect(notificheRepo.cancella("mai-visto")).resolves.toBeUndefined();
  });
});
