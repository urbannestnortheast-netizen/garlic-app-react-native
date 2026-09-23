import React, { useState } from "react";
import { View, Text, TextInput, TextInputProps, Pressable, StyleProp, ViewStyle } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useAdminTheme } from "@/src/admin/theme";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  secureTextEntry?: boolean;
  showToggle?: boolean;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  testID?: string;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function AdminField(props: FieldProps) {
  const t = useAdminTheme();
  const [secure, setSecure] = useState(!!props.secureTextEntry);
  const [focused, setFocused] = useState(false);
  const showToggle = props.secureTextEntry && props.showToggle !== false;
  const borderColor = props.error ? t.colors.danger : focused ? t.colors.primary : t.colors.border;

  const inputId = `admin-field-${props.label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <View style={[{ gap: 6 }, props.style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text
          nativeID={inputId + "-label"}
          style={{ ...t.type.label, color: t.colors.onSurfaceSecondary }}
        >
          {props.label}
        </Text>
        {props.required ? (
          <Text
            accessibilityLabel="required"
            style={{ ...t.type.label, color: t.colors.danger }}
          >
            *
          </Text>
        ) : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.surface,
          minHeight: 48,
          paddingHorizontal: t.spacing.md,
          opacity: props.disabled ? 0.55 : 1,
        }}
      >
        {props.prefix ? (
          <Text style={{ ...t.type.body, color: t.colors.mutedText, marginRight: 4 }}>{props.prefix}</Text>
        ) : null}
        <TextInput
          testID={props.testID}
          accessibilityLabel={props.accessibilityLabel || props.label}
          accessibilityHint={props.hint}
          accessibilityLabelledBy={inputId + "-label"}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={t.colors.mutedText}
          multiline={!!props.multiline}
          numberOfLines={props.numberOfLines}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          autoComplete={props.autoComplete as any}
          secureTextEntry={secure}
          editable={!props.disabled}
          maxLength={props.maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            color: t.colors.onSurface,
            fontFamily: "DMSans",
            fontSize: 15,
            paddingVertical: props.multiline ? 12 : 12,
            minHeight: props.multiline ? 24 * (props.numberOfLines || 3) : undefined,
            textAlignVertical: props.multiline ? "top" : "center",
          }}
        />
        {props.suffix ? (
          <Text style={{ ...t.type.body, color: t.colors.mutedText, marginLeft: 4 }}>{props.suffix}</Text>
        ) : null}
        {showToggle ? (
          <Pressable
            onPress={() => setSecure((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={secure ? "Show password" : "Hide password"}
            hitSlop={12}
            style={{ padding: 6, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Feather name={secure ? "eye" : "eye-off"} size={18} color={t.colors.mutedText} />
          </Pressable>
        ) : null}
      </View>
      {props.error ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          accessibilityLiveRegion="polite"
        >
          <Feather name="alert-circle" size={12} color={t.colors.danger} />
          <Text style={{ ...t.type.bodySm, color: t.colors.danger }}>{props.error}</Text>
        </View>
      ) : props.hint ? (
        <Text style={{ ...t.type.bodySm, color: t.colors.mutedText }}>{props.hint}</Text>
      ) : null}
    </View>
  );
}
