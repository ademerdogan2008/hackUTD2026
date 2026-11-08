import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { color, radius, space, type } from './theme';

export function Field({ label, error, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.label, { paddingHorizontal: 2 }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.textTertiary}
        autoCorrect={false}
        {...rest}
        onFocus={(e) => {
          setFocus(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, { borderColor: error ? color.dangerText : focus ? color.textSecondary : color.hairline }, rest.style]}
      />
      {error ? <Text style={[type.caption, { color: color.dangerText, paddingHorizontal: 4 }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, backgroundColor: color.surface, borderRadius: radius.button, borderWidth: 1, paddingHorizontal: space.md, ...type.body },
});
