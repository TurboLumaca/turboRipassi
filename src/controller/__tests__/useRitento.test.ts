/**
 * Test del segnale "sto ritentando".
 *
 * La logica di ritento è del Model ed è testata là: qui interessa solo il
 * ponte verso la View — che il flag si accenda quando un tentativo va a vuoto,
 * che si spenga a operazione finita comunque sia andata, e che due operazioni
 * insieme non se lo spengano a vicenda, che è l'unico modo in cui un contatore
 * si comporta diversamente da un booleano.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useRitento } from "../useRitento";

/** Un errore che conRetry considera transitorio, quindi da ritentare. */
function transitorio() {
  return new Error("Network request failed");
}

/** Fallisce le prime `quante` volte, poi riesce. */
function azioneCheFallisce(quante: number) {
  let chiamate = 0;
  return jest.fn(async () => {
    chiamate += 1;
    if (chiamate <= quante) throw transitorio();
    return "ok";
  });
}

describe("useRitento", () => {
  it("non segnala niente finché niente fallisce", async () => {
    const { result } = await renderHook(() => useRitento());

    await act(async () => {
      await result.current.conRitentoVisibile(async () => "ok");
    });

    expect(result.current.ritentando).toBe(false);
  });

  // L'operazione non è attesa subito: il segnale interessa mentre è ancora in
  // volo, che è l'unico momento in cui la schermata lo mostra.
  it("si accende fra un tentativo e il successivo", async () => {
    const { result } = await renderHook(() => useRitento());

    const operazione = result.current.conRitentoVisibile(azioneCheFallisce(1));
    await waitFor(() => expect(result.current.ritentando).toBe(true));

    await act(async () => {
      await operazione;
    });

    expect(result.current.ritentando).toBe(false);
  });

  it("si spegne quando l'operazione riesce", async () => {
    const { result } = await renderHook(() => useRitento());

    await act(async () => {
      await result.current.conRitentoVisibile(azioneCheFallisce(1));
    });

    await waitFor(() => expect(result.current.ritentando).toBe(false));
  });

  // Anche l'operazione che alla fine fallisce deve spegnerlo: un indicatore
  // rimasto acceso direbbe che l'app sta ancora lavorando quando ha smesso.
  it("si spegne anche quando l'operazione fallisce del tutto", async () => {
    const { result } = await renderHook(() => useRitento());

    await act(async () => {
      await expect(result.current.conRitentoVisibile(azioneCheFallisce(99))).rejects.toThrow();
    });

    expect(result.current.ritentando).toBe(false);
  });

  // Il gancio scatta a ogni tentativo: contarli tutti lascerebbe il contatore
  // sopra lo zero e l'indicatore acceso per sempre.
  it("conta l'operazione una volta sola, non un tentativo alla volta", async () => {
    const { result } = await renderHook(() => useRitento());

    await act(async () => {
      await result.current.conRitentoVisibile(azioneCheFallisce(2));
    });

    await waitFor(() => expect(result.current.ritentando).toBe(false));
  });

  // Una scrittura e il ricaricamento che ne segue sono in volo insieme: con un
  // booleano la prima che finisce spegnerebbe l'indicatore mentre la seconda
  // sta ancora aspettando.
  it("resta acceso finché la seconda operazione non ha finito", async () => {
    const { result } = await renderHook(() => useRitento());
    let sblocca: (v: string) => void = () => {};
    let tentativi = 0;

    // Fallisce una volta — così viene contata — e poi resta appesa.
    const lenta = result.current.conRitentoVisibile(async () => {
      tentativi += 1;
      if (tentativi === 1) throw transitorio();
      return new Promise<string>((risolvi) => {
        sblocca = risolvi;
      });
    });
    const veloce = result.current.conRitentoVisibile(azioneCheFallisce(1));

    await waitFor(() => expect(result.current.ritentando).toBe(true));
    await act(async () => {
      await veloce;
    });

    expect(result.current.ritentando).toBe(true);

    sblocca("ok");
    await act(async () => {
      await lenta;
    });

    await waitFor(() => expect(result.current.ritentando).toBe(false));
  });
});
