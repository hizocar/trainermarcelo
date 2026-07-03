import { Alert, Platform } from 'react-native';

// Alert.alert es un no-op en react-native-web: en web usamos los diálogos del navegador.

export function showAlert(title: string, message?: string, onDismiss?: () => void) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    onDismiss?.();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: onDismiss }]);
  }
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirmar',
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
