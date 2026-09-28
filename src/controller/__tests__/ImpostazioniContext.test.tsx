/**
 * Tests for the settings Controller: reads the saved preferences on mount and
 * writes a change through the repo as soon as it is asked for.
 *
 * Same probe pattern as PercorsoContext: the repo is injected, not mocked, and
 * a probe component publishes the context value instead of a hook runner.
 */
import React, { useEffect } from "react";
import { Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import type { ImpostazioniRepo } from "@/model/impostazioni/impostazioniRepo";
import { ImpostazioniProvider, useImpostazioniCtx, type ContestoImpostazioni } from "../ImpostazioniContext";

const leggi = jest.fn();
const scrivi = jest.fn();
const repo: ImpostazioniRepo = {
  leggi: () => leggi(),
  scrivi: (...a) => scrivi(...a),
};

const spia: { ctx: ContestoImpostazioni | null } = { ctx: null };

function Sonda() {
  const corrente = useImpostazioniCtx();
  useEffect(() => {
    spia.ctx = corrente;
  });
  // Il valore anche come testo: il testo è quello che il renderer garantisce
  // di aver flushato, e non dipende dal momento in cui girano gli effetti.
  return <Text>richiamo:{String(corrente.impostazioni.chiediDomandaAlRichiamo)}</Text>;
}

async function monta() {
  await render(
    <ImpostazioniProvider repo={repo}>
      <Sonda />
    </ImpostazioniProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  spia.ctx = null;
  leggi.mockResolvedValue({ chiediDomandaAlRichiamo: true });
  scrivi.mockResolvedValue(undefined);
});

describe("ImpostazioniProvider", () => {
  it("carica le impostazioni salvate all'avvio", async () => {
    leggi.mockResolvedValue({ chiediDomandaAlRichiamo: false });
    await monta();

    await waitFor(() => expect(spia.ctx).not.toBeNull());
    await waitFor(() =>
      expect(spia.ctx?.impostazioni.chiediDomandaAlRichiamo).toBe(false)
    );
  });

  it("aggiorna lo stato e persiste la modifica", async () => {
    await monta();
    await waitFor(() =>
      expect(spia.ctx?.impostazioni.chiediDomandaAlRichiamo).toBe(true)
    );

    await act(async () => {
      spia.ctx?.salvaImpostazioni({ chiediDomandaAlRichiamo: false });
    });

    expect(scrivi).toHaveBeenCalledWith({ chiediDomandaAlRichiamo: false });
    await waitFor(() => expect(screen.getByText("richiamo:false")).toBeTruthy());
  });
});
