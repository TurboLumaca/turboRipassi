import React from "react";
import { render, screen } from "@testing-library/react-native";
import { CapitaleMentaleCard } from "../CapitaleMentaleCard";
import type { StatisticheCapitaleMentale } from "@/model/ripassi/capitaleMentaleLogic";

jest.mock("@/controller/ripassi/useCapitaleMentale", () => ({
  useCapitaleMentale: () => ({
    totaleVoci: 10,
    totalePermanenti: 4,
    totaleInConsolidamento: 3,
    totaleNuovi: 3,
    percentualePermanente: 40,
    statistiche: {
      totaleVoci: 10,
      totalePermanenti: 4,
      totaleInConsolidamento: 3,
      totaleNuovi: 3,
      percentualePermanente: 40,
    },
  }),
}));

describe("CapitaleMentaleCard", () => {
  it("renderizza correttamente i conteggi e le etichette di default", async () => {
    await render(<CapitaleMentaleCard />);

    expect(screen.getByText(/Patrimonio di Conoscenza/i)).toBeTruthy();
    expect(screen.getByText("4 concetti permanenti")).toBeTruthy();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getByText("4 nozioni stabili a lungo termine")).toBeTruthy();
    expect(
      screen.getByText("La conoscenza che hai reso parte permanente di te.")
    ).toBeTruthy();

    expect(screen.getByText("Iniziale")).toBeTruthy();
    expect(screen.getByText("In Consolidamento")).toBeTruthy();
    expect(screen.getByText("Permanente")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Distribuzione consolidamento: 3 iniziali, 3 in consolidamento, 4 permanenti"
      )
    ).toBeTruthy();
  });

  it("renderizza con statistiche custom passate come props", async () => {
    const stats: StatisticheCapitaleMentale = {
      totaleVoci: 50,
      totalePermanenti: 48,
      totaleInConsolidamento: 2,
      totaleNuovi: 0,
      percentualePermanente: 96,
    };

    await render(<CapitaleMentaleCard statistiche={stats} />);

    expect(screen.getByText("48 concetti permanenti")).toBeTruthy();
    expect(screen.getAllByText("48").length).toBeGreaterThan(0);
    expect(screen.getByText("48 nozioni stabili a lungo termine")).toBeTruthy();
  });

  it("gestisce lo stato singolare con 1 concetto permanente", async () => {
    const stats: StatisticheCapitaleMentale = {
      totaleVoci: 1,
      totalePermanenti: 1,
      totaleInConsolidamento: 0,
      totaleNuovi: 0,
      percentualePermanente: 100,
    };

    await render(<CapitaleMentaleCard statistiche={stats} />);

    expect(screen.getByText("1 concetto permanente")).toBeTruthy();
    expect(screen.getByText("1 nozione stabile a lungo termine")).toBeTruthy();
  });

  it("gestisce lo stato vuoto quando non ci sono concetti permanenti", async () => {
    const stats: StatisticheCapitaleMentale = {
      totaleVoci: 0,
      totalePermanenti: 0,
      totaleInConsolidamento: 0,
      totaleNuovi: 0,
      percentualePermanente: 0,
    };

    await render(<CapitaleMentaleCard statistiche={stats} />);

    expect(screen.getByText("La tua cassaforte mentale")).toBeTruthy();
    expect(screen.getByText("0 nozioni stabili a lungo termine")).toBeTruthy();
  });
});
