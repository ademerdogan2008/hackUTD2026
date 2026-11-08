import { Platform, type TextStyle } from 'react-native';

export const color = {
  bg: '#16181C',
  surface: '#1F2227',
  surfaceRaised: '#2A2E35',
  /** Segmented-control thumb / pressed key: one step above surfaceRaised. */
  control: '#343842',
  hairline: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  text: '#F3F4F6',
  textMuted: '#A8AEB8',
  textSecondary: '#A8AEB8',
  textTertiary: '#6E747E',
  primary: '#F3F4F6',
  onPrimary: '#111316',
  danger: '#E5484D',
  dangerText: '#F2777B',
  onDanger: '#FFFFFF',
  /** Full-screen alarm background: deep red, not neon. */
  alarm: '#C8363B',
  success: '#3DAA6F',
  warning: '#D4A13A',
  info: '#5B8DEF',
  scrim: 'rgba(0,0,0,0.7)',
  qrLight: '#FFFFFF',
  qrDark: '#000000',
} as const;

/** Loaded in app/_layout.tsx via useFonts. Use fontFamily, not fontWeight, for these. */
export const font = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

/** 4-pt grid. `screen` = screen gutter, `section` = gap between sections. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, screen: 20, section: 28 } as const;
export const radius = { sm: 10, button: 14, md: 16, lg: 16, pill: 999 } as const;

export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontFamily: font.display, letterSpacing: -0.5, color: color.text } as TextStyle,
  title: { fontSize: 20, lineHeight: 26, fontFamily: font.display, letterSpacing: -0.3, color: color.text } as TextStyle,
  body: { fontSize: 17, lineHeight: 24, fontFamily: font.regular, color: color.text } as TextStyle,
  bodyStrong: { fontSize: 17, lineHeight: 24, fontFamily: font.semibold, color: color.text } as TextStyle,
  callout: { fontSize: 15, lineHeight: 20, fontFamily: font.regular, color: color.textSecondary } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontFamily: font.medium, color: color.textSecondary } as TextStyle,
  /** Alias of caption (legacy name). */
  label: { fontSize: 13, lineHeight: 18, fontFamily: font.medium, color: color.textSecondary } as TextStyle,
  /** Alias of title (legacy name). */
  heading: { fontSize: 20, lineHeight: 26, fontFamily: font.display, letterSpacing: -0.3, color: color.text } as TextStyle,
  display: { fontSize: 40, lineHeight: 46, fontFamily: font.display, letterSpacing: -0.5, color: color.text } as TextStyle,
  /** Button / tab labels. */
  button: { fontSize: 17, lineHeight: 22, fontFamily: font.display, letterSpacing: -0.2 } as TextStyle,
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
  info: 'rgba(91,141,239,0.12)',
  success: 'rgba(61,170,111,0.12)',
  warning: 'rgba(212,161,58,0.12)',
  danger: 'rgba(229,72,77,0.14)',
};

export const colors = { ...color, surface2: color.surfaceRaised };
