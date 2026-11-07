import { useReducer as useSpacetimeReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { VerifyPanel } from '../components/VerifyPanel';
import { reducers, tables } from '../module_bindings';
import { useConnectionStatus } from '../spacetime/SpacetimeRoot';

export default function Index() {
  const { isActive, identity } = useSpacetimeDB();
  const { db, lastError } = useConnectionStatus();
  const [rows, ready] = useTable(tables.mySpikeRows);
  const seed = useSpacetimeReducer(reducers.spikeSeed);
  const touch = useSpacetimeReducer(reducers.spikeTouch);
  const clear = useSpacetimeReducer(reducers.spikeClear);
  const [error, setError] = useState<string | null>(null);

  // Never auto-retry: UnknownCallResultError means the reducer may have run.
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ConnectionBadge ready={ready} />
        <Text style={styles.meta}>
          {db} {identity ? identity.toHexString().slice(0, 12) : ''}
        </Text>
      </View>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
      <Text style={styles.count}>Rows: {rows.length}</Text>
      <View style={styles.buttons}>
        <Button title="Seed 150" disabled={!isActive} onPress={() => run(() => seed({ count: 150 }))} />
        <Button title="Touch a row" disabled={!isActive} onPress={() => run(() => touch())} />
        <Button title="Clear my rows" disabled={!isActive} onPress={() => run(() => clear())} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {/* VerifyPanel (sign & verify slice) */}
      <VerifyPanel />
      <FlatList
        data={sorted}
        keyExtractor={(row) => String(row.id)}
        renderItem={({ item }) => (
          <Text style={styles.row}>
            #{String(item.id)} n={item.n}
          </Text>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: '#666' },
  count: { fontSize: 18, fontWeight: '600', marginVertical: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around' },
  error: { color: '#c0392b', marginVertical: 4 },
  row: { paddingVertical: 2, fontFamily: 'Courier' },
});
