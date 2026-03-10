import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/lib/constants/colors';

interface DividerProps {
  style?: ViewStyle;
  color?: string;
}

export function Divider({ style, color }: DividerProps) {
  return <View style={[styles.divider, color ? { backgroundColor: color } : undefined, style]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    width: '100%',
  },
});
