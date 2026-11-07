import { Platform, type TextStyle } from 'react-native';

export const color = {
  bg: '#0B0D10',
  surface: '#161A20',
  surfaceRaised: '#1F252D',
  border: '#2B323C',
  text: '#F5F7FA',
  textMuted: '#A3ADBA',
  primary: '#F5F7FA',
  onPrimary: '#0B0D10',
  danger: '#D92D20',
  dangerText: '#FF6B5E',
  onDanger: '#FFFFFF',
  success: '#3DD68C',
  warning: '#FFB020',
  info: '#6CB6FF',
  scrim: 'rgba(0,0,0,0.7)',
  qrLight: '#FFFFFF',
  qrDark: '#000000',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 } as const;
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const type = {
  body: { fontSize: 18, lineHeight: 27, fontWeight: '400', color: color.text } as TextStyle,
  bodyStrong: { fontSize: 18, lineHeight: 27, fontWeight: '600', color: color.text } as TextStyle,
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: color.textMuted } as TextStyle,
  heading: { fontSize: 24, lineHeight: 29, fontWeight: '600', color: color.text } as TextStyle,
  display: { fontSize: 40, lineHeight: 48, fontWeight: '600', color: color.text } as TextStyle,
};

export type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export const variantColor: Record<Variant, string> = {
  neutral: color.border,
  info: color.info,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
};
