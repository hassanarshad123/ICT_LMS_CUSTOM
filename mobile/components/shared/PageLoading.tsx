import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/lib/constants/colors';

interface PageLoadingProps {
  color?: string;
}

export function PageLoading({ color }: PageLoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={color || Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
