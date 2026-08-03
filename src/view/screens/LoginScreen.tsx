/**
 * View — login screen (spec section 2/3).
 * Google OAuth as the primary method; email/password as a fallback.
 */
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { theme } from "@/view/theme/theme";
import { Button } from "@/view/components/ui";
import { useAuthCtx } from "@/controller/AuthContext";
import { useConnettivita } from "@/controller/useConnettivita";

export function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, error } = useAuthCtx();
  const { online } = useConnettivita();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Image
          source={require("../../../assets/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logo}>Ripassa</Text>
        <Text style={styles.tagline}>I tuoi ripassi, sincronizzati ovunque.</Text>
      </View>

      <View style={styles.form}>
        {!online ? (
          <Text style={styles.offline}>
            Sei offline: per accedere serve una connessione a internet.
          </Text>
        ) : null}

        <Button label="Continua con Google" variant="accent" onPress={signInWithGoogle} />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>oppure</Text>
          <View style={styles.line} />
        </View>

        <TextInput
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={mode === "login" ? "Accedi" : "Registrati"}
          onPress={() =>
            mode === "login"
              ? signInWithEmail(email.trim(), password)
              : signUpWithEmail(email.trim(), password)
          }
        />
        <Button
          label={mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          variant="ghost"
          onPress={() => setMode(mode === "login" ? "signup" : "login")}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  header: { alignItems: "center", marginBottom: theme.spacing.xxl },
  logoImage: {
    width: 96,
    height: 96,
    marginBottom: theme.spacing.sm,
  },
  logo: {
    fontSize: 44,
    fontWeight: "900",
    color: theme.colors.accent,
    letterSpacing: 1,
  },
  tagline: {
    color: theme.colors.textOnPrimary,
    fontSize: theme.font.body,
    marginTop: theme.spacing.sm,
    opacity: 0.9,
  },
  form: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.font.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: theme.font.small },
  error: { color: theme.colors.danger, fontSize: theme.font.small },
  offline: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
});
