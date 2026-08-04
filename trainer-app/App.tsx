import { Platform, View, ActivityIndicator } from 'react-native';
if (Platform.OS !== 'web') require('react-native-gesture-handler');
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider } from './src/context/AuthContext';
import { startSync } from './src/lib/offline';
import AppNavigator from './src/navigation';
import { colors } from './src/theme';

// No hace nada si no hay DSN (desarrollo, o hasta cargar el secret en EAS).
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

function App() {
  const [fontsLoaded] = useFonts({ Anton_400Regular, JetBrainsMono_600SemiBold });

  // sube los entrenamientos que quedaron guardados sin señal
  React.useEffect(() => startSync(), []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default SENTRY_DSN ? Sentry.wrap(App) : App;
