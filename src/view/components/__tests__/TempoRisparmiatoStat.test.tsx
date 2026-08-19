import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  SPIEGAZIONE_RISPARMIO,
  TempoRisparmiatoStat,
} from "../TempoRisparmiatoStat";
import type { RisparmioTempoResult } from "@/model/ripassi/savingsLogic";

jest.mock("@/controller/ripassi/useStatisticheRipassi", () => ({
  useStatisticheRipassi: () => ({
    risparmioTempo: {
      minutiTotaliRisparmiati: 1080,
      oreFormattate: "18 ore",
      dettaglioPerVoce: {},
    },
  }),
}));

describe("TempoRisparmiatoStat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("renderizza correttamente il tempo risparmiato di default", async () => {
    await render(<TempoRisparmiatoStat />);

    expect(screen.getByText(/Efficienza Studio/i)).toBeTruthy();
    expect(screen.getByText("~18 ore risparmiate")).toBeTruthy();
    expect(screen.getByText(/Tocca per capire come viene calcolato/)).toBeTruthy();
  });

  it("renderizza con statistiche custom passate come props", async () => {
    const custom: RisparmioTempoResult = {
      minutiTotaliRisparmiati: 45,
      oreFormattate: "45 min",
      dettaglioPerVoce: {},
    };

    await render(<TempoRisparmiatoStat risparmioTempo={custom} />);

    expect(screen.getByText("~45 min risparmiate")).toBeTruthy();
  });

  it("mostra l'alert esplicativo al tocco se nessun onPress personalizzato è fornito", async () => {
    await render(<TempoRisparmiatoStat />);

    await fireEvent.press(screen.getByRole("button"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Tempo di Studio Risparmiato",
      SPIEGAZIONE_RISPARMIO,
      expect.any(Array)
    );
  });

  it("invoca onPress personalizzato se fornito", async () => {
    const customOnPress = jest.fn();
    await render(<TempoRisparmiatoStat onPress={customOnPress} />);

    await fireEvent.press(screen.getByRole("button"));

    expect(customOnPress).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
