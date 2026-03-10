import { Component, useEffect, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { NetInfoProvider } from '@/lib/contexts/net-info-context';
import { AuthProvider, useAuth } from '@/lib/contexts/auth-context';
import { BrandingProvider } from '@/lib/contexts/branding-context';
import { NotificationProvider } from '@/lib/contexts/notification-context';

SplashScreen.preventAutoHideAsync();

// Safety: hide splash after 5s no matter what
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {});
}, 5000);

// ── Error Boundary ──────────────────────────────────────────────────

interface EBState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <Text style={ebStyles.message}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12, color: '#1A1A1A' },
  message: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

// ── Auth Gate ───────────────────────────────────────────────────────

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/home');
    }
  }, [isLoading, isAuthenticated, segments, router]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return <>{children}</>;
}

// ── Root Layout ─────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <NetInfoProvider>
        <AuthProvider>
          <BrandingProvider>
            <NotificationProvider>
              <AuthGate>
                <StatusBar style="dark" />
                <Slot />
              </AuthGate>
              <Toast />
            </NotificationProvider>
          </BrandingProvider>
        </AuthProvider>
      </NetInfoProvider>
    </ErrorBoundary>
  );
}
