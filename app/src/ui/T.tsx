import { Text, type StyleProp, type TextStyle } from 'react-native';
import { color, mono, type } from './theme';

const tones = { default: color.text, muted: color.textSecondary, tertiary: color.textTertiary, danger: color.dangerText, success: color.success, warning: color.warning, info: color.info };

type TVariant = 'body' | 'bodyStrong' | 'callout' | 'caption' | 'label' | 'title' | 'heading' | 'largeTitle' | 'display' | 'mono';

export function T({ variant = 'body', tone, style, children, numberOfLines }: { variant?: TVariant; tone?: keyof typeof tones; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number }) {
  const base = variant === 'mono' ? { ...type.body, fontSize: 15, fontFamily: mono } : type[variant];
  return (
    <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={variant === 'display' || variant === 'largeTitle' ? 1.3 : 1.5} style={[base, tone ? { color: tones[tone] } : null, style]}>
      {children}
    </Text>
  );
}
