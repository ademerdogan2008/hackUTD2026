import { type TextStyle } from 'react-native';

/**
 * Ops-console palette (DESIGN.md v3). Cool slate ground, one signal red, status lamps.
 * Red means danger only; amber degraded; green contained/clear; cyan informational.
 */
export const color = {
  bg: '#0A0D10',
  surface: '#11161B',
  surfaceRaised: '#1A2128',
  /** Segmented-control thumb / pressed key: one step above surfaceRaised. */
  control: '#26303A',
  hairline: 'rgba(150,170,190,0.14)',
  border: 'rgba(150,170,190,0.14)',
  text: '#E6EBF0',
  textMuted: '#97A3AF',
  textSecondary: '#97A3AF',
  textTertiary: '#75818D',
  primary: '#E6EBF0',
  onPrimary: '#0A0D10',
  danger: '#EC3B30',
  dangerText: '#FF7B70',
  onDanger: '#FFFFFF',
  /** Full-screen alarm field: saturated signal red. */
  alarm: '#C8170E',
  success: '#34C27A',
  warning: '#F2A93B',
  info: '#4FB3E8',
  scrim: 'rgba(0,0,0,0.72)',
  qrLight: '#FFFFFF',
  qrDark: '#000000',
} as const;

/** Loaded in app/_layout.tsx via useFonts. Use fontFamily, not fontWeight, for these. */
export const font = {
  /** Condensed signage voice: screen titles, panel labels, buttons, statuses. */
  display: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  /** Data only: IPs, clocks, fingerprints, hashes. */
  mono: 'JetBrainsMono_500Medium',
} as const;

/** 4-pt grid. `screen` = screen gutter, `section` = gap between sections. */
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64, screen: 16, section: 24 } as const;
export const radius = { sm: 6, button: 10, md: 12, lg: 14, pill: 999 } as const;

export const mono = font.mono;

export const type = {
  largeTitle: { fontSize: 32, lineHeight: 36, fontFamily: font.display, letterSpacing: 0.6, textTransform: 'uppercase', color: color.text } as TextStyle,
  title: { fontSize: 22, lineHeight: 26, fontFamily: font.display, letterSpacing: 0.3, color: color.text } as TextStyle,
  body: { fontSize: 17, lineHeight: 24, fontFamily: font.regular, color: color.text } as TextStyle,
  bodyStrong: { fontSize: 17, lineHeight: 24, fontFamily: font.semibold, color: color.text } as TextStyle,
  callout: { fontSize: 15, lineHeight: 21, fontFamily: font.regular, color: color.textSecondary } as TextStyle,
  caption: { fontSize: 13, lineHeight: 18, fontFamily: font.medium, color: color.textSecondary } as TextStyle,
  /** Panel / group label: condensed caps, tracked. */
  label: { fontSize: 13, lineHeight: 16, fontFamily: font.displaySemi, letterSpacing: 1.2, textTransform: 'uppercase', color: color.textSecondary } as TextStyle,
  /** Alias of title (legacy name). */
  heading: { fontSize: 22, lineHeight: 26, fontFamily: font.display, letterSpacing: 0.3, color: color.text } as TextStyle,
  display: { fontSize: 44, lineHeight: 46, fontFamily: font.display, letterSpacing: 0.4, color: color.text } as TextStyle,
  /** Button / tab labels. */
  button: { fontSize: 18, lineHeight: 22, fontFamily: font.display, letterSpacing: 1, textTransform: 'uppercase' } as TextStyle,
  /** Tabular data: IPs, timers, fingerprints. */
  data: { fontSize: 14, lineHeight: 20, fontFamily: font.mono, color: color.text } as TextStyle,
};

export type Variant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export const variantColor: Record<Variant, string> = {
  neutral: color.textTertiary,
  info: color.info,
  success: color.success,
  warning: color.warning,
  danger: color.danger,
};

/** Subtle tinted fills for toned surfaces. */
export const variantTint: Record<Variant, string> = {
  neutral: color.surface,
  info: 'rgba(79,179,232,0.12)',
  success: 'rgba(52,194,122,0.12)',
  warning: 'rgba(242,169,59,0.12)',
  danger: 'rgba(236,59,48,0.16)',
};

export const colors = { ...color, surface2: color.surfaceRaised };
