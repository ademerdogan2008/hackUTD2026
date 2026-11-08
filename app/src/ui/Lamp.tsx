import { View } from 'react-native';

/** Status lamp: solid core inside a tinted bezel. The one status mark across the app. */
export function Lamp({ tone, size = 10 }: { tone: string; size?: number }) {
  const ring = Math.max(2, Math.round(size * 0.3));
  const outer = size + ring * 2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: outer, height: outer, borderRadius: outer / 2, backgroundColor: `${tone}33`, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone }} />
    </View>
  );
}
