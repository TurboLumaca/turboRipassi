/**
 * View — the three ways to attach a file: camera, gallery, document.
 *
 * Both the ripasso form and the attachment detail screen offer exactly these
 * three actions, and each used to wire and style them on its own. The caller
 * only says what to do with the chosen file; which pickers exist, and how they
 * look, is decided once here.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/view/theme/theme";
import {
  scegliDaFotocamera,
  scegliDaGalleria,
  scegliDocumento,
  type FileScelto,
} from "@/controller/allegati/fileDispositivo";

interface Props {
  /**
   * Receives the picker the user chose, not the file: the caller runs it and
   * decides whether the result is uploaded now or held until the ripasso has
   * an id.
   */
  onScegli: (scegli: () => Promise<FileScelto | null>) => void;
}

export function PulsantiAllegato({ onScegli }: Props) {
  return (
    <View style={styles.riga}>
      <PulsanteAllegato icona="📷" etichetta="Foto" onPress={() => onScegli(scegliDaFotocamera)} />
      <PulsanteAllegato
        icona="🖼️"
        etichetta="Galleria"
        onPress={() => onScegli(scegliDaGalleria)}
      />
      <PulsanteAllegato
        icona="📄"
        etichetta="File / PDF"
        onPress={() => onScegli(scegliDocumento)}
      />
    </View>
  );
}

function PulsanteAllegato({
  icona,
  etichetta,
  onPress,
}: {
  icona: string;
  etichetta: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.pulsante} onPress={onPress}>
      <Text style={styles.icona}>{icona}</Text>
      <Text style={styles.etichetta}>{etichetta}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  riga: { flexDirection: "row", gap: theme.spacing.sm },
  pulsante: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  icona: { fontSize: 22 },
  etichetta: { fontSize: theme.font.small, color: theme.colors.text, fontWeight: "600" },
});
