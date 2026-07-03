import { Platform, View, ActivityIndicator } from 'react-native';
if (Platform.OS !== 'web') require('react-native-gesture-handler');
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({ Anton_400Regular });

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
