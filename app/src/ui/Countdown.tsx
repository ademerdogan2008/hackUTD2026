import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, mono, type } from './theme';

/** expiresAt: epoch millis. */
export function Countdown({ expiresAt, onExpire }: { expiresAt: number; onExpire?: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (left === 0) onExpire?.();
  }, [left, onExpire]);
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, '0');
  const a11yBucket = left <= 10 ? left : left <= 60 ? Math.floor(left / 10) * 10 : Math.floor(left / 30) * 30;
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{left === 0 ? '' : 'Expires in'}</Text>
      <Text
        accessibilityRole="timer"
        accessibilityLabel={left === 0 ? 'Expired' : `Expires in about ${Math.floor(a11yBucket / 60)} minutes ${a11yBucket % 60} seconds`}
        maxFontSizeMultiplier={1.3}
        style={[type.display, { fontFamily: mono, color: left === 0 || left >= 120 ? color.text : color.warning }]}
      >
        {left === 0 ? 'Expired' : `${m}:${s}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center' } });
