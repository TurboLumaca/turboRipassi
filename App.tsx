/**
 * App root. Authentication gating (spec section 2/3) and stack navigation.
 * The authenticated area is wrapped in RipassiProvider (a single Realtime
 * subscription) and in PercorsoProvider (the phase of the journey, read once).
 */
import "react-native-url-polyfill/auto";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { Lora_400Regular_Italic } from "@expo-google-fonts/lora";

import { theme } from "@/view/theme/theme";
import { AuthProvider, useAuthCtx } from "@/controller/AuthContext";
import { RipassiProvider } from "@/controller/RipassiContext";
import { PercorsoProvider } from "@/controller/PercorsoContext";
import { LoginScreen } from "@/view/screens/LoginScreen";
import { GuscioScreen } from "@/view/screens/GuscioScreen";
import { FormRipassoScreen } from "@/view/screens/FormRipassoScreen";
import { DettaglioAllegatiScreen } from "@/view/screens/DettaglioAllegatiScreen";
import { AllenamentoScreen } from "@/view/screens/AllenamentoScreen";
import { FlashcardScreen } from "@/view/screens/FlashcardScreen";
import {
  AppuntamentiScreen,
  CorsiScreen,
  ObiettiviScreen,
  ProgrammaScreen,
} from "@/view/screens/PercorsoScreens";
import { ProfiloScreen } from "@/view/screens/ProfiloScreen";
import { ErrorBoundary } from "@/view/components/ErrorBoundary";
import { initCrashReporting, wrapWithCrashReporting } from "@/config/crashReporting";
import { initNotifications } from "@/config/notifications";
import type { RootStackParamList } from "@/view/navigation";

// Initialize crash reporting before anything renders (no-ops without a DSN).
initCrashReporting();
// Android channel setup; a no-op on iOS. Permission is asked later, only once
// there is an actual ripasso to remind about (see useNotificheRipassi).
void initNotifications();

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.accent,
    background: theme.colors.background,
    card: theme.colors.background,
    text: theme.colors.text,
    border: theme.colors.border,
  },
};

function App() {
  /**
   * Anton, Figtree and Lora's italic are the design system's three voices.
   * The app waits for them rather than rendering in the system face and
   * swapping a beat later: a display face changing under the reader is worse
   * than a moment of splash, and `error` is honoured too — a font that failed
   * to load must not leave the app on a blank screen for ever.
   */
  const [fontsPronti, erroreFont] = useFonts({
    Anton_400Regular,
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Lora_400Regular_Italic,
  });

  if (!fontsPronti && !erroreFont) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaProvider>
    );
  }

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
      {/* Dark glyphs: every screen sits on the light blue-grey ground. */}
      <StatusBar style="dark" />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : !session ? (
        <LoginScreen />
      ) : (
        <PercorsoProvider>
          <RipassiProvider>
            <NavigationContainer theme={navTheme}>
              <Stack.Navigator
                screenOptions={{
                  headerStyle: { backgroundColor: theme.colors.background },
                  headerTintColor: theme.colors.text,
                  headerTitleStyle: {
                    fontFamily: theme.family.heading,
                    fontSize: theme.font.title,
                  },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: theme.colors.background },
                }}
              >
                <Stack.Screen
                  name="Principale"
                  component={GuscioScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="FormRipasso"
                  component={FormRipassoScreen}
                  options={{ title: "TurboRipassi" }}
                />
                <Stack.Screen
                  name="DettaglioAllegati"
                  component={DettaglioAllegatiScreen}
                  options={{ title: "Allegati" }}
                />
                <Stack.Screen
                  name="Allenamento"
                  component={AllenamentoScreen}
                  options={{ title: "Allenamento" }}
                />
                <Stack.Screen
                  name="Flashcard"
                  component={FlashcardScreen}
                  options={{ title: "Flashcard" }}
                />
                <Stack.Screen
                  name="Programma"
                  component={ProgrammaScreen}
                  options={{ title: "Programma di studio" }}
                />
                <Stack.Screen
                  name="Appuntamenti"
                  component={AppuntamentiScreen}
                  options={{ title: "Appuntamenti" }}
                />
                <Stack.Screen name="Corsi" component={CorsiScreen} options={{ title: "Corsi" }} />
                <Stack.Screen
                  name="Obiettivi"
                  component={ObiettiviScreen}
                  options={{ title: "Obiettivi" }}
                />
                <Stack.Screen
                  name="Profilo"
                  component={ProfiloScreen}
                  options={{ title: "Profilo" }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </RipassiProvider>
        </PercorsoProvider>
      )}
    </>
  );
}

// Wrap the root with Sentry so native crashes and unhandled JS errors are
// captured even outside React's render tree (no-ops without a DSN).
export default wrapWithCrashReporting(App);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
});
