/**
 * Controller — which Google account attachments are stored under, and in
 * which Drive folder.
 *
 * Loaded on demand rather than at startup: it is reference information the
 * user checks rarely, and fetching it eagerly would put two Drive calls on
 * every app launch for something normally not on screen.
 */
import { useCallback, useState } from "react";
import { driveClient } from "@/model/driveRepo";
import { driveTokenManager } from "@/config/driveAuth";
import { messaggioErrore } from "@/model/errorMessages";
import { reportError } from "@/config/crashReporting";
import type { DriveAccount } from "@/model/driveTypes";

export type StatoAccountDrive =
  | { stato: "ignoto" }
  | { stato: "caricamento" }
  | { stato: "nonCollegato" }
  | { stato: "collegato"; account: DriveAccount }
  | { stato: "errore"; messaggio: string };

export function useAccountDrive() {
  const [stato, setStato] = useState<StatoAccountDrive>({ stato: "ignoto" });

  const aggiorna = useCallback(async () => {
    setStato({ stato: "caricamento" });
    if (!(await driveTokenManager.isAuthorized())) {
      setStato({ stato: "nonCollegato" });
      return;
    }
    try {
      setStato({ stato: "collegato", account: await driveClient.account() });
    } catch (e) {
      reportError(e, { operazione: "driveAccount" });
      setStato({ stato: "errore", messaggio: messaggioErrore(e) });
    }
  }, []);

  const dimentica = useCallback(() => setStato({ stato: "ignoto" }), []);

  return { stato, aggiorna, dimentica };
}
