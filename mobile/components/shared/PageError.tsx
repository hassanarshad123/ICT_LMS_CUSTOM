import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/lib/constants/colors';

interface PageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function PageError({ message = 'Something went wrong', onRetry }: PageErrorProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button title="Retry" onPress={onRetry} variant="outline" icon="refresh-outline" style={styles.button} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
  },
});
