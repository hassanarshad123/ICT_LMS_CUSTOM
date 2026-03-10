import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useBranding } from '@/lib/contexts/branding-context';
import { useMutation } from '@/lib/hooks/use-mutation';
import { changePassword } from '@/lib/api/auth';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/lib/constants/colors';
import { showSuccess, showError } from '@/lib/utils/toast';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changePwMutation = useMutation(changePassword);

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!currentPassword) e.current = 'Current password is required';
    if (!newPassword) e.new = 'New password is required';
    else if (newPassword.length < 8) e.new = 'Password must be at least 8 characters';
    if (!confirmPassword) e.confirm = 'Please confirm your password';
    else if (newPassword !== confirmPassword) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    try {
      await changePwMutation.execute(currentPassword, newPassword);
      showSuccess('Password changed successfully');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      showError(msg);
    }
  }, [validate, changePwMutation, currentPassword, newPassword, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>Change Password</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextInput
            label="Current Password"
            icon="lock-closed-outline"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            error={errors.current}
            autoCapitalize="none"
          />
          <TextInput
            label="New Password"
            icon="key-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            error={errors.new}
            autoCapitalize="none"
          />
          <TextInput
            label="Confirm New Password"
            icon="key-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            error={errors.confirm}
            autoCapitalize="none"
          />
          <Button
            title="Change Password"
            onPress={handleSubmit}
            variant="primary"
            icon="checkmark-circle"
            fullWidth
            loading={changePwMutation.loading}
            accentColor={accent}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  submitBtn: {
    marginTop: 8,
  },
});
