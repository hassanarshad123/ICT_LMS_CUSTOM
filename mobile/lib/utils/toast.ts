import Toast from 'react-native-toast-message';

export function showSuccess(message: string, title = 'Success') {
  Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 3000 });
}

export function showError(message: string, title = 'Error') {
  Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 4000 });
}

export function showInfo(message: string, title = 'Info') {
  Toast.show({ type: 'info', text1: title, text2: message, visibilityTime: 3000 });
}
