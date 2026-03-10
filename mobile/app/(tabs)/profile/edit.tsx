import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBranding } from '@/lib/contexts/branding-context';
import { useMutation } from '@/lib/hooks/use-mutation';
import { updateUser } from '@/lib/api/users';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Colors } from '@/lib/constants/colors';
import { showSuccess, showError } from '@/lib/utils/toast';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { accentColor } = useBranding();
  const accent = accentColor || Colors.accent;

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateMutation = useMutation(updateUser);

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [name]);

  const handleSubmit = useCallback(async () => {
    if (!validate() || !user) return;
    try {
      await updateMutation.execute(user.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      await refreshUser();
      showSuccess('Profile updated successfully');
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      showError(msg);
    }
  }, [validate, user, updateMutation, name, phone, refreshUser, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton name="arrow-back" onPress={() => router.back()} />
        <Text style={styles.title}>Edit Profile</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextInput
            label="Email"
            icon="mail-outline"
            value={user?.email ?? ''}
            editable={false}
            containerStyle={styles.readOnly}
          />
          <TextInput
            label="Name"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
          />
          <TextInput
            label="Phone"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
          <Button
            title="Save Changes"
            onPress={handleSubmit}
            variant="primary"
            icon="checkmark-circle"
            fullWidth
            loading={updateMutation.loading}
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
  readOnly: {
    opacity: 0.6,
  },
  submitBtn: {
    marginTop: 8,
  },
});
