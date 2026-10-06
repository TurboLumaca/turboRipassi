/**
 * View — full-screen PDF reader for iOS.
 *
 * iOS has no "open with" for a local file: the only system route, the share
 * sheet, lets you send the PDF somewhere but not read it. So the PDF is shown
 * here, in a WKWebView, which renders PDFs natively with scrolling and
 * pinch-to-zoom. Sharing stays one tap away for who wants to send or save it.
 *
 * Android never gets here: a VIEW intent opens the installed PDF reader.
 */
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { theme } from "@/view/theme/theme";

export function VisualizzatorePdf({
  uri,
  nome,
  onChiudi,
  onCondividi,
}: {
  uri: string | null;
  nome?: string;
  onChiudi: () => void;
  onCondividi: (uri: string) => void;
}) {
  return (
    <Modal
      visible={uri !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={onChiudi}
    >
      <SafeAreaView style={styles.root}>
        <View style={styles.barra}>
          <Pressable onPress={onChiudi} hitSlop={12} accessibilityRole="button">
            <Text style={styles.azione}>Chiudi</Text>
          </Pressable>
          <Text style={styles.nome} numberOfLines={1}>
            {nome ?? "PDF"}
          </Text>
          <Pressable
            onPress={() => uri && onCondividi(uri)}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.azione}>Condividi</Text>
          </Pressable>
        </View>
        {uri ? (
          <WebView
            source={{ uri }}
            style={styles.pdf}
            originWhitelist={["file://*"]}
            // Without read access to the folder, WKWebView refuses a file:// PDF.
            allowFileAccess
            allowingReadAccessToURL={uri.slice(0, uri.lastIndexOf("/") + 1)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  azione: {
    fontSize: theme.font.body,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  nome: {
    flex: 1,
    textAlign: "center",
    fontSize: theme.font.body,
    color: theme.colors.text,
  },
  pdf: { flex: 1 },
});
