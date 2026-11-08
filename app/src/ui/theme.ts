import { Platform, type TextStyle } from 'react-native';

export const color = {
  bg: '#0A0A0B',
  surface: '#141416',
  surfaceRaised: '#1C1C1F',
  /** Segmented-control thumb / pressed key: one step above surfaceRaised. */
  control: '#2C2C30',
  hairline: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  text: '#F2F2F3',
  textMuted: '#9A9AA1',
  textSecondary: '#9A9AA1',
  textTertiary: '#5E5E66',
  primary: '#F2F2F3',
  onPrimary: '#0A0A0B',
  danger: '#FF453A',
  dangerText: '#FF453A',
  onDanger: '#FFFFFF',
  success: '#30D158',
  warning: '#FFB340',
  info: '#64A8FF',
  scrim: 'rgba(0,0,0,0.7)',
  qrLight: '#FFFFFF',
  qrDark: '#000000',
} as const;

/** 4-pt grid. `screen` = screen gutter, `section` = gap between sections. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, screen: 20, section: 28 } as const;
export const radius = { sm: 10, button: 14, md: 16, lg: 16, pill: 999 } as const;

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5, color: color.text } as TextStyle,
  title: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: color.text } as TextStyle,
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400', color: color.text } as TextStyle,
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: color.text } as TextStyle,
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400', color: color.textSecondary } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: color.textSecondary } as TextStyle,
  /** Alias of caption (legacy name). */
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: color.textSecondary } as TextStyle,
  /** Alias of title (legacy name). */
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: color.text } as TextStyle,
  display: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -0.5, color: color.text } as TextStyle,
};

export type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export const variantColor: Record<Variant, string> = {
  neutral: color.textTertiary,
  info: color.info,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
};

/** Subtle tinted fills for toned surfaces (cards). */
export const variantTint: Record<Variant, string> = {
  neutral: color.surface,
  info: 'rgba(100,168,255,0.10)',
  success: 'rgba(48,209,88,0.10)',
  warning: 'rgba(255,179,64,0.10)',
  danger: 'rgba(255,69,58,0.12)',
};

export const colors = { ...color, surface2: color.surfaceRaised };
