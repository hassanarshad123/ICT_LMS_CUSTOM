import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
  badgeCount?: number;
}

export function TabBarIcon({ name, color, size = 24, badgeCount }: TabBarIconProps) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badgeCount !== undefined && badgeCount > 0 && <View style={styles.badge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
});
