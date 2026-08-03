/**
 * View — root error boundary.
 * Catches render/lifecycle errors from the whole tree, reports them to crash
 * reporting, and shows a themed fallback with a retry action instead of a
 * blank/crashed screen. React error boundaries must be class components.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { reportError } from "@/config/crashReporting";

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Qualcosa è andato storto</Text>
          <Text style={styles.body}>
            {"Si è verificato un errore imprevisto. Puoi riprovare; se il problema persiste, riavvia l'app."}
          </Text>
          <Button label="Riprova" onPress={this.handleRetry} style={styles.button} />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    fontSize: theme.font.heading,
    fontWeight: "800",
    color: theme.colors.primary,
    textAlign: "center",
    marginBottom: theme.spacing.md,
  },
  body: {
    fontSize: theme.font.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
  },
  button: {
    alignSelf: "stretch",
  },
});
