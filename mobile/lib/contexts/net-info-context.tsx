import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/lib/constants/colors';

interface NetInfoContextType {
  isConnected: boolean;
}

const NetInfoContext = createContext<NetInfoContextType>({ isConnected: true });

export function NetInfoProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <NetInfoContext.Provider value={{ isConnected }}>
      {children}
      {!isConnected && <OfflineOverlay />}
    </NetInfoContext.Provider>
  );
}

export function useNetInfo() {
  return useContext(NetInfoContext);
}

function OfflineOverlay() {
  const [, setRetry] = useState(0);

  const handleRetry = useCallback(() => {
    NetInfo.refresh();
    setRetry((r) => r + 1);
  }, []);

  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <Ionicons name="cloud-offline-outline" size={64} color={Colors.textSecondary} />
        <Text style={styles.title}>No Internet Connection</Text>
        <Text style={styles.subtitle}>Please check your connection and try again</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  retryText: {
    color: Colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
