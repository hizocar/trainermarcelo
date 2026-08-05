import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Preferencia por usuario (no global): si dos personas comparten el mismo
// teléfono con cuentas distintas, activar Face ID en una no afecta a la otra.
const KEY_PREFIX = 'biometric_lock_enabled_';

export async function isBiometricSupported(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function isBiometricEnabled(userId: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY_PREFIX + userId);
  return v === '1';
}

export async function setBiometricEnabled(userId: string, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + userId, enabled ? '1' : '0');
}

// disableDeviceFallback: false → si Face ID falla varias veces, iOS ofrece
// el passcode del teléfono como respaldo (igual que hace cualquier app).
export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquea EliteFitness',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false,
  });
  return result.success;
}
