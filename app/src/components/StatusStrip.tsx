import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSpacetimeDB } from 'spacetimedb/react';
import { useConnectionStatus } from '../spacetime/SpacetimeRoot';
import { useCurrentIncident } from '../state/hooks';
import { color, font, Lamp, Tag, variantTint } from '../ui';

const STATE: Record<string, { label: string; tone: string; tint?: string }> = {
  possible: { label: 'Possible attack', tone: color.warning, tint: variantTint.warning },
  active: { label: 'Attack active', tone: color.danger, tint: variantTint.danger },
  contained: { label: 'Contained', tone: color.warning },
  recovered: { label: 'Recovered', tone: color.info },
};

function elapsed(fromMs: number, now: number) {
  const t = Math.max(0, Math.floor((now - fromMs) / 1000));
  const h = String(Math.floor(t / 3600)).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return `T+${h}:${m}:${s}`;
}

/**
 * Console strip on every tab: incident state lamp, elapsed clock since the alert, link status.
 * The same line on every phone, so responders can read each other's screens at a glance.
 */
export function StatusStrip() {
  const { incident } = useCurrentIncident();
  const { isActive } = useSpacetimeDB();
  const { phase } = useConnectionStatus();
  const live = isActive && phase === 'connected';
  const [now, setNow] = useState(Date.now());
  const running = !!incident;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const st = incident ? (STATE[incident.status] ?? { label: incident.status, tone: color.textSecondary }) : { label: 'All clear', tone: color.success };
  const clock = incident ? elapsed(incident.createdAt.toDate().getTime(), now) : null;

  return (
    <View style={[s.strip, st.tint ? { backgroundColor: st.tint } : null]} accessibilityRole="summary" accessibilityLabel={`${st.label}${incident?.isDrill ? ', drill' : ''}. ${live ? 'Connected' : 'Reconnecting'}`}>
      <View style={s.left}>
        <Lamp tone={st.tone} size={8} />
        <Text style={[s.state, { color: st.tone === color.danger ? color.dangerText : st.tone }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {st.label}
        </Text>
        {incident?.isDrill ? <Tag label="Drill" /> : null}
      </View>
      <View style={s.right}>
        {clock ? (
          <Text style={s.clock} maxFontSizeMultiplier={1.2}>
            {clock}
          </Text>
        ) : null}
        <View style={s.link}>
          <Lamp tone={live ? color.success : color.warning} size={6} />
          <Text style={s.linkText} maxFontSizeMultiplier={1.2}>
            {live ? 'Link' : 'Retry'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  strip: {
    minHeight: 38,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  state: { fontFamily: font.display, fontSize: 15, lineHeight: 18, letterSpacing: 1.2, textTransform: 'uppercase', flexShrink: 1 },
  clock: { fontFamily: font.mono, fontSize: 13, lineHeight: 18, color: color.text, fontVariant: ['tabular-nums'] },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkText: { fontFamily: font.displaySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: color.textSecondary },
});
