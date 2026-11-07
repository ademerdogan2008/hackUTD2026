import { SpacetimeDBProvider } from 'spacetimedb/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SPACETIME_DB, SPACETIME_HOST } from '../config';
import { loadSavedToken, makeBuilder } from './connection';

export interface ConnectionStatus {
  phase: 'connecting' | 'connected' | 'reconnecting';
  lastError?: string;
  db: string;
}

const ConnectionStatusContext = createContext<ConnectionStatus>({ phase: 'connecting', db: SPACETIME_DB });

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionStatusContext);
}

export function SpacetimeRoot({ children }: { children: ReactNode }) {
  const [tokenState, setTokenState] = useState<{ token: string | undefined } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSavedToken()
      .catch(() => undefined)
      .then((token) => {
        if (!cancelled) setTokenState({ token });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tokenState) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.text}>Connecting…</Text>
      </View>
    );
  }
  return <Connected savedToken={tokenState.token}>{children}</Connected>;
}

function Connected({ savedToken, children }: { savedToken: string | undefined; children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>({ phase: 'connecting', db: SPACETIME_DB });
  // Built exactly once (stable across renders).
  const [builder] = useState(() =>
    makeBuilder(SPACETIME_HOST, SPACETIME_DB, savedToken, {
      onConnected: () => setStatus((s) => ({ ...s, phase: 'connected', lastError: undefined })),
      onDisconnected: () => setStatus((s) => ({ ...s, phase: 'reconnecting' })),
      onError: (message) => setStatus((s) => ({ ...s, phase: 'reconnecting', lastError: message })),
    }),
  );
  return (
    <SpacetimeDBProvider connectionBuilder={builder}>
      <ConnectionStatusContext.Provider value={status}>{children}</ConnectionStatusContext.Provider>
    </SpacetimeDBProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { fontSize: 16 },
});
