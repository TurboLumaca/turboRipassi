/**
 * View — the shell the four daily tabs live in: header, content, tab bar and
 * the drawer over all of it.
 *
 * The tabs are local state rather than a navigator on purpose. The header title
 * changes with the tab, the tab bar floats over the list instead of sitting
 * under it, and the lead-gen veil wraps whichever section is on screen — three
 * things that all read the same value, and the simplest way for them to agree
 * is for there to be one value.
 *
 * The screens the drawer opens are ordinary stack screens: they have a back
 * button and a title, and nothing about them needs the tab bar.
 */
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/view/theme/theme";
import { Icona } from "@/view/theme/icone";
import { Titolo } from "@/view/components/organic";
import { TabBar, type Tab } from "@/view/components/TabBar";
import { MenuLaterale, type GruppoMenu } from "@/view/components/MenuLaterale";
import { VeloLeadGen } from "@/view/components/VeloLeadGen";
import { HomeScreen } from "@/view/screens/HomeScreen";
import { AllenatiScreen } from "@/view/screens/AllenatiScreen";
import { RipassiScreen } from "@/view/screens/RipassiScreen";
import { ContenutiScreen } from "@/view/screens/ContenutiScreen";
import { usePercorso } from "@/controller/PercorsoContext";
import { useAuthCtx } from "@/controller/AuthContext";
import { DURATA_CORSO } from "@/model/percorso/fasi";
import type { RootStackParamList } from "@/view/navigation";

type Navigazione = NativeStackNavigationProp<RootStackParamList, "Principale">;

/**
 * The destinations the drawer can reach: every screen of the stack that takes
 * no parameters.
 *
 * Derived from the param list rather than written out again, so a new
 * parameterless screen is reachable from here without a second list to update —
 * and a screen that grows a parameter stops compiling instead of navigating
 * with `undefined`.
 */
type SchermataSenzaParametri = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never;
}[keyof RootStackParamList];

/** The header title, per tab. The Home carries the product name. */
const TITOLI: Record<Tab, string> = {
  home: "Genio in 21 giorni",
  allenati: "Allenati",
  ripassa: "TurboRipassi",
  contenuti: "Contenuti",
};

export function GuscioScreen() {
  const nav = useNavigation<Navigazione>();
  const insets = useSafeAreaInsets();
  const { fase, giorno, iscrizione } = usePercorso();
  const { session } = useAuthCtx();
  const [tab, setTab] = useState<Tab>("home");
  const [menu, setMenu] = useState(false);

  const ospite = fase === "ospite";
  /**
   * Ripassa is completely usable without a course, and the Home is where the
   * offer is made — so those two are never veiled. Everything else shows real
   * content, faded, with one way in.
   */
  const velato = ospite && tab !== "ripassa" && tab !== "home";

  const nome = session?.user.email?.split("@")[0] ?? "Corsista";
  const gruppi = useMemo<GruppoMenu[]>(
    () => [
      {
        label: "Il tuo percorso",
        voci: [
          {
            chiave: "programma",
            label: "Programma di studio",
            nota: "Il percorso che stai seguendo",
            icona: "contenuti",
            onPress: () => vaiA("Programma"),
          },
          {
            chiave: "appuntamenti",
            label: "Appuntamenti",
            nota: "Date in aula e colloqui col tutor",
            icona: "calendario",
            onPress: () => vaiA("Appuntamenti"),
          },
          {
            chiave: "corsi",
            label: "Corsi",
            nota: "Il tuo corso e quelli successivi",
            icona: "corsi",
            onPress: () => vaiA("Corsi"),
          },
          {
            chiave: "obiettivi",
            label: "Obiettivi",
            nota: "I traguardi che ti sei dato",
            icona: "obiettivi",
            onPress: () => vaiA("Obiettivi"),
          },
        ],
      },
      {
        label: "Strumenti",
        voci: [
          {
            chiave: "flashcard",
            label: "Flashcard",
            nota: "Vocaboli in 12 lingue, quando ti servono",
            icona: "flashcard",
            onPress: () => vaiA("Flashcard"),
            disabilitata: ospite,
          },
        ],
      },
      {
        label: "Account",
        voci: [
          {
            chiave: "profilo",
            label: "Profilo",
            nota: "Corso, accesso, Drive e uscita",
            icona: "profilo",
            onPress: () => vaiA("Profilo"),
          },
        ],
      },
    ],
    // `vaiA` closes over `nav`, which react-navigation keeps stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ospite, nav]
  );

  function vaiA(schermata: SchermataSenzaParametri) {
    setMenu(false);
    nav.navigate(schermata);
  }

  const contenuto =
    tab === "home" ? (
      <HomeScreen onVaiA={setTab} />
    ) : tab === "allenati" ? (
      <AllenatiScreen />
    ) : tab === "ripassa" ? (
      <RipassiScreen />
    ) : (
      <ContenutiScreen />
    );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.testata}>
        <Titolo size={theme.font.title} style={styles.titolo} numberOfLines={1}>
          {TITOLI[tab]}
        </Titolo>
        <Pressable
          onPress={() => setMenu(true)}
          accessibilityRole="button"
          accessibilityLabel="Menu"
          style={styles.bottoneMenu}
        >
          <Icona nome="menu" size={19} color={theme.colors.textOnInk} />
        </Pressable>
      </View>

      <View style={styles.corpo}>
        <VeloLeadGen
          sezione={tab}
          attivo={velato}
          onScopriIlCorso={() => nav.navigate("Corsi")}
          onUsaRipassi={() => setTab("ripassa")}
        >
          {contenuto}
        </VeloLeadGen>
      </View>

      <TabBar attiva={tab} onCambia={setTab} />

      <MenuLaterale
        aperto={menu}
        onChiudi={() => setMenu(false)}
        nome={nome}
        sottotitolo={sottotitolo(fase, giorno, iscrizione.inizio)}
        iniziali={(nome[0] ?? "?").toUpperCase()}
        gruppi={gruppi}
      />
    </View>
  );
}

/** The line under the name in the drawer: where in the journey this person is. */
function sottotitolo(fase: string, giorno: number, inizio: string | null): string {
  if (fase === "ospite") return "Non ancora iscritto";
  if (fase === "pre") return inizio ? `Corso dal ${inizio}` : "Corso in arrivo";
  if (fase === "durante") return `Giorno ${giorno} di ${DURATA_CORSO}`;
  return "Corso completato";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  testata: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.md,
  },
  titolo: { flex: 1 },
  bottoneMenu: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.inkSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  corpo: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: 2 },
});
