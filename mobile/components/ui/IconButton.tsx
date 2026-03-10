import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants/colors';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function IconButton({
  name,
  onPress,
  size = 22,
  color = Colors.text,
  backgroundColor = 'transparent',
  style,
  disabled,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor }, disabled && styles.disabled, style]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
      hitSlop={8}
    >
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
});
