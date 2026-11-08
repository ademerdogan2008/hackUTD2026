import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseSteps, splitEvidence } from '../jev/format';
import { color, space, T, type } from '../../ui';

/**
 * Task detail. Jev tasks put their cited evidence on its own line; "- " lines are plain-language
 * substeps, shown as a tappable checklist on the next-step card and as a count in the list.
 */
export function TaskDetail({ detail, jev, small, checklist }: { detail: string; jev?: boolean; small?: boolean; checklist?: boolean }) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  if (!detail) return null;
  const variant = small ? 'caption' : 'body';
  if (!jev) return <T variant={variant} tone="muted">{detail}</T>;
  const { action, evidence } = splitEvidence(detail);
  const { why, steps } = parseSteps(action);
  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <View style={{ gap: checklist ? space.sm : 2 }}>
      {why ? <T variant={variant} tone="muted">{why}</T> : null}
      {checklist && steps.length ? (
        <View style={{ gap: space.xs }}>
          {steps.map((st, i) => {
            const on = checked.has(i);
            return (
              <Pressable
                key={i}
                onPress={() => toggle(i)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.step, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? color.success : color.textSecondary} />
                <Text style={[type.body, { color: color.text, flex: 1 }, on && { color: color.textTertiary, textDecorationLine: 'line-through' }]}>
                  {`${i + 1}. ${st}`}
                </Text>
              </Pressable>
            );
          })}
          <T variant="caption" tone="tertiary">{`${checked.size} of ${steps.length} done · tap a step to tick it off`}</T>
        </View>
      ) : null}
      {!checklist && steps.length ? <T variant="caption" tone="tertiary">{`${steps.length} steps`}</T> : null}
      {evidence ? <T variant={variant} style={{ color: color.dangerText }}>{`Evidence: ${evidence}`}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 6, minHeight: 44 },
});
