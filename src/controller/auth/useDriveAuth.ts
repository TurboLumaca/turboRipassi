/**
 * Controller — authorization to write into the user's Google Drive.
 *
 * Separate from identity login even though both are "auth": signing in says
 * who the user is, this says the app may put files in their Drive. They have
 * different tokens, different lifetimes and different failure modes, and the
 * user grants the second one only when they first add an attachment.
 *
 * Kept as its own hook, composed by useAuth, so the shape the View sees is
 * unchanged while the two flows stop sharing one 300-line file.
 */
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { driveTokenManager } from "@/model/drive/driveAuth";
import { resetDriveFolderCache } from "@/model/drive/driveRepo";
import { messaggioErrore } from "@/model/shared/errorMessages";

/**
 * `segnalaErrore` is injected rather than owned: login and Drive authorization
 * surface through the same single error line in the UI, and the caller is the
 * one holding that state.
 */
export function useDriveAuth(
  segnalaErrore: (messaggio: string | null) => void,
  session: Session | null
) {
  const [driveAutorizzato, setDriveAutorizzato] = useState(false);

  // Re-checked per session: a different account has different tokens.
  useEffect(() => {
    driveTokenManager.isAuthorized().then(setDriveAutorizzato);
  }, [session]);

  /** Starts the consent flow. True when the app can now write to Drive. */
  const autorizzaDrive = useCallback(async (): Promise<boolean> => {
    segnalaErrore(null);
    try {
      const ok = await driveTokenManager.authorize();
      setDriveAutorizzato(ok);
      return ok;
    } catch (e) {
      segnalaErrore(messaggioErrore(e));
      return false;
    }
  }, [segnalaErrore]);

  /**
   * Finishes an authorization whose redirect arrived as a deep link. Returns
   * false when the url carried nothing usable, so the caller can keep looking.
   */
  const completaRedirectDrive = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        const completata = await driveTokenManager.completaAutorizzazione(url);
        if (completata) setDriveAutorizzato(true);
        return completata;
      } catch (e) {
        segnalaErrore(messaggioErrore(e));
        return false;
      }
    },
    [segnalaErrore]
  );

  /** Revokes the local Drive access. Part of signing out. */
  const dimenticaDrive = useCallback(async () => {
    try {
      await driveTokenManager.clear();
      resetDriveFolderCache();
    } catch {
      // Tokens already absent: proceed with logout.
    }
    setDriveAutorizzato(false);
  }, []);

  return { driveAutorizzato, autorizzaDrive, completaRedirectDrive, dimenticaDrive };
}
