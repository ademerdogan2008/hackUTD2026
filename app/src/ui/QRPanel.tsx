import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { color, radius, space, type } from './theme';

export function QRPanel({ value, expired, label, size: sizeProp }: { value: string; expired?: boolean; label?: string; size?: number }) {
  const { width } = useWindowDimensions();
  const size = sizeProp ?? Math.min(width - 2 * space.md, 340);
  const inner = size - 2 * space.md;
  return (
    <View
      style={[styles.panel, { width: size, height: size }, expired && styles.expired]}
      accessibilityLabel={label ?? 'Invite QR code. Show it to the person joining.'}
    >
      {expired ? (
        <Text style={type.callout}>Invite expired</Text>
      ) : (
        <QRCode value={value} size={inner} ecl="M" backgroundColor={color.qrLight} color={color.qrDark} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: color.qrLight, borderRadius: radius.md, padding: space.md },
  expired: { backgroundColor: color.surface },
});
