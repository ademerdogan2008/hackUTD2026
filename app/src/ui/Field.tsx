import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { color, radius, space, type } from './theme';

export function Field({ label, error, ...rest }: TextInputProps & { label: string; error?: string | null }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.textMuted}
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
        style={[styles.input, { borderColor: error ? color.dangerText : focus ? color.info : color.border, borderWidth: focus ? 2 : 1 }, rest.style]}
      />
      {error ? <Text style={[type.label, { color: color.dangerText }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 56, backgroundColor: color.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: space.md, ...type.body },
});
