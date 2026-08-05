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
/**
 * What this hook offers its caller. The consumer is useAuth, not the View:
 * `completaRedirectDrive` and `dimenticaDrive` exist for the composition and
 * never reach a screen, so the contract is written for that reader.
 */
export interface StatoDriveAuth {
  /** True when the app currently holds Drive authorization. */
  driveAutorizzato: boolean;
  /** Starts the consent flow. True when the app can now write to Drive. */
  autorizzaDrive: () => Promise<boolean>;
  /** Single entry point for "I am about to touch Drive". */
  assicuraAccesso: () => Promise<boolean>;
  /** Finishes an authorization whose redirect arrived as a deep link. */
  completaRedirectDrive: (url: string) => Promise<boolean>;
  /** Revokes the local Drive access. Part of signing out. */
  dimenticaDrive: () => Promise<void>;
}

export function useDriveAuth(
  segnalaErrore: (messaggio: string | null) => void,
  session: Session | null
): StatoDriveAuth {
  const [driveAutorizzato, setDriveAutorizzato] = useState(false);

  // Re-checked per session: a different account has different tokens.
  useEffect(() => {
    // Unreadable storage means "not authorized": the consent flow will ask
    // again, which is the right outcome and better than an unhandled rejection.
    void driveTokenManager
      .isAuthorized()
      .then(setDriveAutorizzato)
      .catch(() => setDriveAutorizzato(false));
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
   * Makes sure the app can actually write to the user's Drive, asking for
   * consent when it can't. This is the single entry point for "I am about to
   * touch Drive": the attachment controller used to call the token manager
   * itself, which authorized correctly but left `driveAutorizzato` stale, so
   * the account panel kept saying "non collegato" after a successful upload.
   *
   * Checks for a usable access token rather than isAuthorized(): stored tokens
   * whose refresh Google has revoked still count as authorized but yield no
   * access token, so every upload failed deep inside the Drive client.
   *
   * Tokens are deliberately not cleared on failure — a refresh also comes back
   * empty when the device is offline, and discarding a good refresh token over
   * a dropped connection would force a pointless re-authorization.
   */
  const assicuraAccesso = useCallback(async (): Promise<boolean> => {
    if (await driveTokenManager.getValidAccessToken()) {
      setDriveAutorizzato(true);
      return true;
    }
    return autorizzaDrive();
  }, [autorizzaDrive]);

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

  return {
    driveAutorizzato,
    autorizzaDrive,
    assicuraAccesso,
    completaRedirectDrive,
    dimenticaDrive,
  };
}
