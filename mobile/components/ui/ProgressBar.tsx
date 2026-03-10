import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/lib/constants/colors';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  color = Colors.accent,
  trackColor = Colors.borderLight,
  height = 6,
  style,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: color, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
  },
  fill: {},
});
