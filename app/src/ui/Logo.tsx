import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { color, type } from './theme';

export interface LogoProps {
  /** Cap height driver: font size of the wordmark. Streak scales with it. */
  size?: number;
}

/** Flare wordmark: condensed caps "FLARE" followed by a red streak that brightens to a hot head. */
export function Logo({ size = 32 }: LogoProps) {
  const h = size * 0.44;
  const w = size * 1.32;
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Flare">
      <Text style={[type.largeTitle, { fontSize: size, lineHeight: size * 1.12 }]} maxFontSizeMultiplier={1.3}>
        Flare
      </Text>
      <Svg width={w} height={h} viewBox="0 0 60 20" style={{ marginLeft: size * 0.08 }}>
        <Defs>
          <LinearGradient id="flareStreak" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color.danger} stopOpacity="0.25" />
            <Stop offset="0.5" stopColor={color.danger} stopOpacity="0.85" />
            <Stop offset="1" stopColor={color.danger} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Path d="M0 7 L50 2 A8 8 0 0 1 50 18 L0 13 Z" fill="url(#flareStreak)" />
        <Circle cx="50" cy="10" r="3.2" fill="#FFD9D4" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
