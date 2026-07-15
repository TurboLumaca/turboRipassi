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

import { theme } from "@/theme/theme";
import { useAuth } from "@/controller/useAuth";
import { RipassiProvider } from "@/controller/RipassiContext";
import { LoginScreen } from "@/view/screens/LoginScreen";
import { HomeScreen } from "@/view/screens/HomeScreen";
import { FormRipassoScreen } from "@/view/screens/FormRipassoScreen";
import { DettaglioAllegatiScreen } from "@/view/screens/DettaglioAllegatiScreen";
import type { RootStackParamList } from "@/view/navigation";

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

export default function App() {
  const { session, loading } = useAuth();

  return (
    <SafeAreaProvider>
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
              <Stack.Screen name="FormRipasso" component={FormRipassoScreen} options={{ title: "Ripassa" }} />
              <Stack.Screen name="DettaglioAllegati" component={DettaglioAllegatiScreen} options={{ title: "Allegati" }} />
            </Stack.Navigator>
          </NavigationContainer>
        </RipassiProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
});
