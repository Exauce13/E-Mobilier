import { Alert, Platform } from 'react-native';

/**
 * Affiche un message informatif compatible Web (window.alert) et Mobile natif (Alert.alert).
 */
export function showMessage(title: string, message?: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Demande une confirmation utilisateur de façon fiable sur Web ET sur iOS/Android.
 * Résout `true` si confirmé, `false` si annulé.
 */
export function confirmDialog(
  title: string,
  message: string,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler'
): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
