import { StyleSheet, Text, View } from 'react-native';
import { useTable } from 'spacetimedb/react';
import { tables } from '../../module_bindings';
import { color, font, radius, space } from '../../ui';
import { Section, tx } from '../incident/parts';
import { evidenceLines, jevHeadline, localTime } from './format';
import { MachineTag } from './JevAlarm';

/** Tripwire hits Jev tied to this incident, newest first, with cited evidence. */
export function EvidenceSection({ incidentId }: { incidentId: bigint }) {
  const [triage] = useTable(tables.jevTriage);
  const [hits] = useTable(tables.tripwireHit);
  const mine = triage.filter((t) => t.incidentId === incidentId).sort((a, b) => (a.id > b.id ? -1 : 1));
  if (!mine.length) return null;
  return (
    <Section title="Evidence">
      <View style={{ gap: space.sm }}>
        {mine.map((t) => {
          const hit = hits.find((h) => h.id === t.hitId);
          return (
            <View key={t.id.toString()} style={s.card}>
              <View style={s.head}>
                <Text style={[tx.bodyStrong, { flex: 1 }]} maxFontSizeMultiplier={1.4}>
                  {hit ? hit.label || hit.fileName : 'Tripwire hit'}
                </Text>
                <Text style={tx.caption}>{localTime(t.at)}</Text>
              </View>
              {hit ? (
                <Text style={tx.caption}>
                  {hit.systemName}
                  {hit.fileName ? ` · ${hit.fileName}` : ''}
                </Text>
              ) : null}
              <Text style={s.prob} maxFontSizeMultiplier={1.4}>
                {jevHeadline(t.probability, t.incidentType)}
              </Text>
              <MachineTag dark />
              {evidenceLines(t.evidence).map((l, i) => (
                <View key={i} style={s.row}>
                  <Text style={[tx.callout, { color: color.textTertiary }]}>{i + 1}.</Text>
                  <Text style={[tx.callout, { color: color.text, flex: 1 }]}>{l}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </Section>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, gap: space.sm, borderLeftWidth: 3, borderLeftColor: color.danger },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  prob: { fontFamily: font.display, fontSize: 17, lineHeight: 22, color: color.dangerText },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
