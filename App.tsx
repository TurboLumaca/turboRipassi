/**
 * App root. Authentication gating (spec section 2/3) and stack navigation.
 * The authenticated area is wrapped in RipassiProvider (a single Realtime subscription).
 */
import "react-native-url-polyfill/auto";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { theme } from "@/view/theme/theme";
import { AuthProvider, useAuthCtx } from "@/controller/AuthContext";
import { RipassiProvider } from "@/controller/RipassiContext";
import { LoginScreen } from "@/view/screens/LoginScreen";
import { HomeScreen } from "@/view/screens/HomeScreen";
import { FormRipassoScreen } from "@/view/screens/FormRipassoScreen";
import { DettaglioAllegatiScreen } from "@/view/screens/DettaglioAllegatiScreen";
import { ErrorBoundary } from "@/view/components/ErrorBoundary";
import { initCrashReporting, wrapWithCrashReporting } from "@/config/crashReporting";
import type { RootStackParamList } from "@/view/navigation";

// Initialize crash reporting before anything renders (no-ops without a DSN).
initCrashReporting();

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.primary,
    text: theme.colors.textOnPrimary,
    border: theme.colors.border,
  },
};

function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AreaAutenticata />
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/** Login gating: needs to sit inside AuthProvider to read the session. */
function AreaAutenticata() {
  const { session, loading } = useAuthCtx();

  return (
    <>
      <StatusBar style="light" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !session ? (
        <LoginScreen />
      ) : (
        <RipassiProvider>
          <NavigationContainer theme={navTheme}>
            <Stack.Navigator
              screenOptions={{
                headerStyle: { backgroundColor: theme.colors.primary },
                headerTintColor: theme.colors.textOnPrimary,
                headerTitleStyle: { fontWeight: "800" },
                contentStyle: { backgroundColor: theme.colors.background },
              }}
            >
              <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
              <Stack.Screen name="FormRipasso" component={FormRipassoScreen} options={{ title: "TurboRipassi" }} />
              <Stack.Screen name="DettaglioAllegati" component={DettaglioAllegatiScreen} options={{ title: "Allegati" }} />
            </Stack.Navigator>
          </NavigationContainer>
        </RipassiProvider>
      )}
    </>
  );
}

// Wrap the root with Sentry so native crashes and unhandled JS errors are
// captured even outside React's render tree (no-ops without a DSN).
export default wrapWithCrashReporting(App);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
});
