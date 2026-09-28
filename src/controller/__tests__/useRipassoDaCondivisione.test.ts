import { renderHook } from "@testing-library/react-native";

let mockContesto: {
  hasShareIntent: boolean;
  shareIntent: unknown;
  resetShareIntent: jest.Mock;
};
jest.mock("expo-share-intent", () => ({
  useShareIntentContext: () => mockContesto,
}));

import { useRipassoDaCondivisione } from "../useRipassoDaCondivisione";

const dispatch = jest.fn();
const nav = { dispatch };

beforeEach(() => {
  jest.clearAllMocks();
  mockContesto = {
    hasShareIntent: true,
    shareIntent: { text: "Ciclo di Krebs", webUrl: null, files: null },
    resetShareIntent: jest.fn(),
  };
});

describe("useRipassoDaCondivisione", () => {
  it("apre il form con la bozza e consuma la condivisione", async () => {
    await renderHook(() => useRipassoDaCondivisione(nav, true));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "PUSH",
      payload: {
        name: "FormRipasso",
        params: { bozza: { titolo: "Ciclo di Krebs", note: "", file: [] } },
      },
    });
    expect(mockContesto.resetShareIntent).toHaveBeenCalledTimes(1);
  });

  it("aspetta che la navigazione sia pronta senza consumare nulla", async () => {
    await renderHook(() => useRipassoDaCondivisione(nav, false));
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockContesto.resetShareIntent).not.toHaveBeenCalled();
  });

  it("non fa niente senza condivisione", async () => {
    mockContesto.hasShareIntent = false;
    await renderHook(() => useRipassoDaCondivisione(nav, true));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("una condivisione vuota si scarta senza aprire il form", async () => {
    mockContesto.shareIntent = { text: null, webUrl: null, files: null };
    await renderHook(() => useRipassoDaCondivisione(nav, true));
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockContesto.resetShareIntent).toHaveBeenCalledTimes(1);
  });
});
