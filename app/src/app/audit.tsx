import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTable } from 'spacetimedb/react';
import { verifyChain } from '@redphone/shared';
import { humanizeAction } from '../features/audit/humanize';
import { tables } from '../module_bindings';
import { useMemberNames } from '../state/hooks';
import { Badge, Button, EmptyState, ListRow, Screen, T } from '../ui';

export default function AuditScreen() {
  const router = useRouter();
  const [rows] = useTable(tables.auditLog);
  const names = useMemberNames();
  const result = useMemo(() => verifyChain(rows), [rows]);
  const newest = useMemo(() => [...rows].sort((a, b) => (a.seq < b.seq ? 1 : -1)), [rows]);

  return (
    <Screen title="Audit" headerRight={<Button label="Back" variant="ghost" fullWidth={false} onPress={() => router.back()} />}>
      <View style={{ flexDirection: 'row' }}>
        {result.ok ? (
          <Badge variant="success" label={`Chain verified · ${rows.length} entries`} />
        ) : (
          <Badge variant="danger" label={`Chain broken at #${result.brokenAt}`} />
        )}
      </View>
      {newest.length === 0 ? <EmptyState title="No entries" /> : null}
      <View>
        {newest.map((r) => {
          const actor = names.get(r.actor.toHexString())?.name ?? 'Unknown';
          const when = r.at.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
          return (
            <ListRow
              key={r.seq.toString()}
              title={humanizeAction(r.action)}
              subtitle={`${when} · ${actor}`}
              trailing={<T variant="mono" tone="muted" style={{ fontSize: 14 }}>{r.hash.slice(0, 8)}</T>}
            />
          );
        })}
      </View>
    </Screen>
  );
}
