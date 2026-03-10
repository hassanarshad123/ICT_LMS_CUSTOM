import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants/colors';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accentColor?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  textStyle,
  accentColor,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const accent = accentColor || Colors.accent;

  const variantStyle = getVariantStyle(variant, accent);

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={variantStyle.textColor} style={styles.icon} />}
          <Text style={[styles.text, { color: variantStyle.textColor }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function getVariantStyle(variant: ButtonVariant, accent: string): { container: ViewStyle; textColor: string } {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: accent },
        textColor: Colors.textOnAccent,
      };
    case 'secondary':
      return {
        container: { backgroundColor: Colors.primary },
        textColor: Colors.textOnPrimary,
      };
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.border },
        textColor: Colors.text,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        textColor: Colors.text,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  icon: {
    marginRight: -4,
  },
});
