import { Text, type StyleProp, type TextStyle } from 'react-native';
import { color, mono, type } from './theme';

const tones = { default: color.text, muted: color.textMuted, danger: color.dangerText, success: color.success, warning: color.warning };

export function T({ variant = 'body', tone = 'default', style, children, numberOfLines }: { variant?: 'body' | 'label' | 'heading' | 'display' | 'mono'; tone?: keyof typeof tones; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number }) {
  const base = variant === 'mono' ? { ...type.body, fontFamily: mono } : type[variant];
  return (
    <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={variant === 'display' ? 1.3 : 1.5} style={[base, { color: tones[tone] }, style]}>
      {children}
    </Text>
  );
}
