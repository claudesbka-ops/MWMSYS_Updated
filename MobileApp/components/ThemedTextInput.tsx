import React, { forwardRef } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { useThemeColor } from "@/components/Themed";

export type ThemedTextInputProps = TextInputProps & {
  lightBackgroundColor?: string;
  darkBackgroundColor?: string;
};

export const ThemedTextInput = forwardRef<TextInput, ThemedTextInputProps>(function ThemedTextInput(
  { style, lightBackgroundColor, darkBackgroundColor, placeholderTextColor, ...props },
  ref
) {
  const color = useThemeColor({ light: undefined, dark: undefined }, "text");
  const borderColor = useThemeColor({ light: undefined, dark: undefined }, "border");
  const backgroundColor = useThemeColor({ light: lightBackgroundColor, dark: darkBackgroundColor }, "card");
  const mutedText = useThemeColor({ light: undefined, dark: undefined }, "mutedText");

  return (
    <TextInput
      ref={ref}
      style={[styles.input, { color, borderColor, backgroundColor }, style]}
      placeholderTextColor={placeholderTextColor ?? mutedText}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
});
