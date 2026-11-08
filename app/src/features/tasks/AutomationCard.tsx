// Shows an emulated automation run step by step, then what (if anything) is left to do by hand.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, color, haptics, space, T } from '../../ui';

const STEP_MS = 650;

export function parseRunLog(log: string): { done: string[]; manual: string[] } {
  const lines = log.split('\n').filter(Boolean);
  return {
    done: lines.filter((l) => l.startsWith('ok: ')).map((l) => l.slice(4)),
    manual: lines.filter((l) => l.startsWith('todo: ')).map((l) => l.slice(6)),
  };
}

/** Result card for a finished run. Steps appear one by one so the user sees what was done for them. */
export function AutomationCard({ title, log, onNext }: { title: string; log: string; onNext: () => void }) {
  const { done, manual } = parseRunLog(log);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= done.length) {
      if (done.length) haptics.success();
      return;
    }
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [shown, done.length]);

  const finished = shown >= done.length;
  return (
    <Card title={finished ? 'Automation complete' : 'Automation running'} tone={finished ? 'success' : 'warning'}>
      <T variant="bodyStrong">{title}</T>
      <View style={{ gap: space.xs }}>
        {done.slice(0, shown).map((line, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Ionicons name="checkmark-circle" size={22} color={color.success} />
            <T style={{ flex: 1 }}>{line}</T>
          </View>
        ))}
        {!finished ? <T variant="mono" tone="muted">{`step ${String(shown + 1).padStart(2, '0')}/${String(done.length).padStart(2, '0')}`}</T> : null}
      </View>
      {finished && manual.length ? (
        <View style={{ gap: space.xs }}>
          <T variant="label">Still to do by hand</T>
          {manual.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Ionicons name="hand-left-outline" size={20} color={color.textSecondary} />
              <T style={{ flex: 1 }}>{m}</T>
            </View>
          ))}
        </View>
      ) : null}
      {finished ? <T variant="caption" tone="muted">Posted to the team chat. Simulated for the demo: no real systems were changed.</T> : null}
      {finished ? <Button label="Next step" onPress={onNext} /> : null}
    </Card>
  );
}
