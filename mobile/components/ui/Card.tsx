import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/lib/constants/colors';

interface CardProps {
  children: React.ReactNode;
  variant?: 'shadow' | 'outlined';
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, variant = 'shadow', onPress, style }: CardProps) {
  const cardStyle = [
    styles.base,
    variant === 'shadow' ? styles.shadow : styles.outlined,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
