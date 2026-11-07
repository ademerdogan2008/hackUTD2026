import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

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
  ghost: color.text,
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
        variant === 'primary' && { backgroundColor: color.primary },
        variant === 'secondary' && { borderWidth: 2, borderColor: color.border },
        variant === 'danger' && { backgroundColor: color.danger },
        variant === 'ghost' && { minHeight: 48 },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.4 },
        fullWidth ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={fg[variant]} /> : icon}
        <Text style={[type.bodyStrong, { color: fg[variant] }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: radius.lg, paddingHorizontal: space.lg, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
