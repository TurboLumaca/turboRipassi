/**
 * Controller — whether to invite the user to connect Google Drive right after
 * signing in, and the action that does it.
 *
 * Reads the stored tokens rather than the context's `driveAutorizzato`: that
 * flag starts false before its own check resolves, and would flash the
 * invitation over an account that is already connected.
 */
import { useCallback, useEffect, useState } from "react";
import { driveTokenManager } from "@/model/drive/driveAuth";
import { useAuthCtx } from "@/controller/AuthContext";

export function useInvitoDrive() {
  const { autorizzaDrive, driveAutorizzato } = useAuthCtx();
  const [visibile, setVisibile] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    let vivo = true;
    void driveTokenManager
      .isAuthorized()
      .then((autorizzato) => {
        if (vivo && !autorizzato) setVisibile(true);
      })
      // Unreadable storage means "not connected": offering is the safe side.
      .catch(() => {
        if (vivo) setVisibile(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Closes the invitation as soon as the account is connected, whoever
   * connected it.
   *
   * `autorizzaDrive()` is not the only way the consent can finish: when Google
   * sends the user back through the app's deep link, the browser session
   * resolves as "dismiss" and that call returns false, while the redirect
   * handler completes the exchange and flips this flag. Without watching it,
   * the invitation stayed on screen over an account that had just been
   * connected, with no sign that anything had worked.
   *
   * It closes after a beat rather than instantly: a dialog that simply
   * vanishes leaves the user guessing whether the connection took, which is
   * the same doubt from the other side. The beat is the confirmation.
   */
  useEffect(() => {
    if (!driveAutorizzato) return;
    const t = setTimeout(() => setVisibile(false), 1400);
    return () => clearTimeout(t);
  }, [driveAutorizzato]);

  const collega = useCallback(async () => {
    setInCorso(true);
    try {
      // Either outcome is handled by the effect above, which watches the
      // connection itself: the consent may also have landed through the deep
      // link while this call was reporting a dismissed browser.
      if (await autorizzaDrive()) return;
      if (await driveTokenManager.isAuthorized().catch(() => false)) setVisibile(false);
    } finally {
      setInCorso(false);
    }
  }, [autorizzaDrive]);

  const rimanda = useCallback(() => setVisibile(false), []);

  // Derived, not stored: the connection itself is the confirmation, and a
  // second copy of it could only ever disagree with the first.
  return { visibile, inCorso, confermato: driveAutorizzato, collega, rimanda };
}
