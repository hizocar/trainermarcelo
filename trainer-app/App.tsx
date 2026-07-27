import { Platform, View, ActivityIndicator } from 'react-native';
if (Platform.OS !== 'web') require('react-native-gesture-handler');
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider } from './src/context/AuthContext';
import { startSync } from './src/lib/offline';
import AppNavigator from './src/navigation';
import { colors } from './src/theme';

export default function App() {
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
