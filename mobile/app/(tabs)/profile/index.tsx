import { useCallback } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { showSuccess } from '@/lib/utils/toast';
import { Colors } from '@/lib/constants/colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { accentColor, instituteName } = useBranding();
  const accent = accentColor || Colors.accent;
  const router = useRouter();

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            showSuccess('You have been signed out');
          },
        },
      ],
    );
  }, [logout]);

  const menuItems: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    route: string;
    color?: string;
  }[] = [
    { icon: 'create-outline', label: 'Edit Profile', route: '/(tabs)/profile/edit' },
    { icon: 'ribbon-outline', label: 'Certificates', route: '/(tabs)/profile/certificates' },
    { icon: 'briefcase-outline', label: 'Job Board', route: '/(tabs)/profile/jobs' },
    { icon: 'lock-closed-outline', label: 'Change Password', route: '/(tabs)/profile/change-password' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <View style={styles.header}>
          <Avatar uri={user?.avatarUrl} name={user?.name} size={72} />
          <Text style={styles.name}>{user?.name ?? 'Student'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>
          <Text style={styles.institute}>{instituteName}</Text>
        </View>

        {/* Info card */}
        <Card style={styles.infoCard}>
          <InfoRow icon="person-outline" label="Role" value={user?.role?.replace('_', ' ') ?? 'Student'} />
          <Divider style={styles.divider} />
          <InfoRow icon="shield-checkmark-outline" label="Status" value={user?.status ?? 'Active'} />
          <Divider style={styles.divider} />
          <InfoRow icon="call-outline" label="Phone" value={user?.phone ?? 'Not set'} />
          <Divider style={styles.divider} />
          <InfoRow icon="layers-outline" label="Batches" value={String(user?.batchIds?.length ?? 0)} />
        </Card>

        {/* Menu items */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <View key={item.route}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color={item.color ?? accent} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
              {index < menuItems.length - 1 && <Divider style={styles.menuDivider} />}
            </View>
          ))}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Sign Out"
            onPress={handleLogout}
            variant="outline"
            icon="log-out-outline"
            fullWidth
            style={styles.logoutButton}
            textStyle={{ color: Colors.error }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={Colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  email: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  institute: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  infoCard: {
    marginHorizontal: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textTransform: 'capitalize',
  },
  divider: {
    marginVertical: 12,
  },
  menuCard: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    marginLeft: 14,
  },
  menuDivider: {
    marginVertical: 8,
  },
  actions: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  logoutButton: {
    borderColor: Colors.error,
  },
});
