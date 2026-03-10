import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="certificates/index" />
      <Stack.Screen name="jobs/index" />
    </Stack>
  );
}
