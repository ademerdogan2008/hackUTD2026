import { useReducer as useSpacetimeReducer, useSpacetimeDB, useTable } from 'spacetimedb/react';
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { reducers, tables } from '../module_bindings';
import { makeSpikeSignature } from '../spike/signAndVerify';

interface Attempt {
  expectOk: boolean;
  signMs: number;
  sentAt: number;
}

export function VerifyPanel() {
  const { isActive } = useSpacetimeDB();
  const verify = useSpacetimeReducer(reducers.spikeVerify);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  // Server verdict observed AFTER the latest tap (set by insert/update callbacks).
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const onRow = (row: { ok: boolean }) => {
    if (pending.current) {
      pending.current = false;
      setServerOk(row.ok);
    }
  };
  useTable(tables.myVerifyResults, {
    onInsert: onRow,
    onUpdate: (_old, row) => onRow(row),
  });

  const tap = async (tamper: boolean) => {
    setError(null);
    setServerOk(null);
    const { args, signMs, expectOk } = makeSpikeSignature({ tamper });
    setAttempt({ expectOk, signMs, sentAt: Date.now() });
    pending.current = true;
    try {
      await verify(args);
    } catch (e) {
      pending.current = false;
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const match = attempt && serverOk !== null ? serverOk === attempt.expectOk : null;

  return (
    <View style={styles.panel}>
      <View style={styles.buttons}>
        <Button title="Sign & verify" disabled={!isActive} onPress={() => tap(false)} />
        <Button title="Send tampered (expect false)" disabled={!isActive} onPress={() => tap(true)} />
      </View>
      {attempt ? <Text>Signed in {attempt.signMs} ms</Text> : null}
      {attempt ? (
        <Text>{serverOk === null ? 'Waiting for server…' : `Server verified: ${String(serverOk)}`}</Text>
      ) : null}
      {match === null ? null : (
        <Text style={{ color: match ? '#1f9d55' : '#c0392b', fontWeight: '700' }}>
          {match ? 'MATCH' : 'MISMATCH'}
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginVertical: 8, gap: 4 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around' },
  error: { color: '#c0392b' },
});
