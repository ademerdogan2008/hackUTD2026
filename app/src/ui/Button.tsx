import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'alarm';

export interface ButtonProps {
  title?: string;
  label?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const fg: Record<ButtonVariant, string> = {
  primary: color.onPrimary,
  secondary: color.text,
  danger: color.onDanger,
  ghost: color.textSecondary,
  alarm: color.alarm,
};

const bg: Record<ButtonVariant, string> = {
  primary: color.primary,
  secondary: color.surfaceRaised,
  danger: color.danger,
  ghost: 'transparent',
  alarm: '#FFFFFF',
};

export function Button({ title, label: labelProp, accessibilityLabel, onPress, variant = 'primary', loading, disabled, icon, fullWidth = true, testID, style }: ButtonProps) {
  const label = title ?? labelProp ?? '';
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        if (!off) onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg[variant] },
        variant === 'ghost' && styles.ghost,
        variant === 'secondary' && styles.secondary,
        pressed && !off && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={fg[variant]} /> : icon}
        <Text style={[styles.text, { color: fg[variant] }]} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, borderRadius: radius.button, paddingHorizontal: space.screen, justifyContent: 'center', alignItems: 'center' },
  ghost: { minHeight: 44, paddingHorizontal: space.sm },
  secondary: { borderWidth: 1, borderColor: color.hairline },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { ...type.button },
});
