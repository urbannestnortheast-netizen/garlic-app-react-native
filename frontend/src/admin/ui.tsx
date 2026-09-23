import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useAdminTheme } from "@/src/admin/theme";

// ============================================================================
// Card — rounded, elevated surface for grouping content
// ============================================================================
export function AdminCard({
  children,
  style,
  padded = true,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  testID?: string;
}) {
  const t = useAdminTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: padded ? t.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// Button — primary / secondary / ghost / danger
// ============================================================================
type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";
export function AdminButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  disabled,
  loading,
  fullWidth,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useAdminTheme();
  const heights = { sm: 36, md: 44, lg: 52 };
  const bg =
    variant === "primary"
      ? t.colors.primary
      : variant === "danger"
      ? t.colors.danger
      : variant === "secondary"
      ? t.colors.surfaceAlt
      : "transparent";
  const fg =
    variant === "primary" || variant === "danger"
      ? "#FFFFFF"
      : variant === "secondary"
      ? t.colors.onSurface
      : t.colors.primary;
  const borderColor = variant === "ghost" ? "transparent" : variant === "secondary" ? t.colors.border : "transparent";
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      testID={testID}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          height: heights[size],
          minHeight: heights[size],
          minWidth: 44,
          paddingHorizontal: size === "sm" ? t.spacing.md : t.spacing.xl,
          borderRadius: t.radius.pill,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          borderWidth: 1,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Feather name={icon as any} size={size === "sm" ? 14 : 16} color={fg} /> : null}
          <Text
            style={{
              ...t.type.button,
              color: fg,
              fontSize: size === "sm" ? 11 : 12,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ============================================================================
// Badge — pill for statuses. Combines dot + label so status isn't color-only.
// ============================================================================
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";
export function AdminBadge({ label, tone = "neutral", icon }: { label: string; tone?: BadgeTone; icon?: string }) {
  const t = useAdminTheme();
  const map: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
    neutral: { bg: t.colors.surfaceAlt, fg: t.colors.onSurfaceSecondary, dot: t.colors.mutedText },
    success: { bg: t.colors.successSoft, fg: t.colors.success, dot: t.colors.success },
    warning: { bg: t.colors.warningSoft, fg: t.colors.warning, dot: t.colors.warning },
    danger: { bg: t.colors.dangerSoft, fg: t.colors.danger, dot: t.colors.danger },
    info: { bg: t.colors.infoSoft, fg: t.colors.info, dot: t.colors.info },
    primary: { bg: t.colors.primarySoft, fg: t.colors.primarySoftText, dot: t.colors.primary },
  };
  const c = map[tone];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        backgroundColor: c.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: t.radius.pill,
        gap: 6,
      }}
    >
      {icon ? (
        <Feather name={icon as any} size={11} color={c.fg} />
      ) : (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />
      )}
      <Text style={{ ...t.type.bodySm, fontFamily: "DMSansBold", fontSize: 11, color: c.fg }}>{label}</Text>
    </View>
  );
}

// ============================================================================
// Section header
// ============================================================================
export function AdminSectionHeader({
  title,
  action,
  onActionPress,
  actionAccessibilityLabel,
}: {
  title: string;
  action?: string;
  onActionPress?: () => void;
  actionAccessibilityLabel?: string;
}) {
  const t = useAdminTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
      }}
    >
      <Text style={{ ...t.type.h2, color: t.colors.onSurface }}>{title}</Text>
      {action && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionAccessibilityLabel || action}
          hitSlop={12}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ ...t.type.body, color: t.colors.primary, fontFamily: "DMSansBold" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ============================================================================
// Empty state
// ============================================================================
export function AdminEmpty({
  icon = "package",
  title,
  subtitle,
  actionLabel,
  onAction,
  testID,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const t = useAdminTheme();
  return (
    <View
      testID={testID}
      style={{
        padding: t.spacing.xxl,
        alignItems: "center",
        justifyContent: "center",
        gap: t.spacing.md,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: t.colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon as any} size={28} color={t.colors.mutedText} />
      </View>
      <Text style={{ ...t.type.h2, color: t.colors.onSurface, textAlign: "center" }}>{title}</Text>
      {subtitle ? (
        <Text style={{ ...t.type.body, color: t.colors.onSurfaceSecondary, textAlign: "center", maxWidth: 260 }}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? <AdminButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

// ============================================================================
// Skeleton — animated shimmer placeholder
// ============================================================================
export function AdminSkeleton({ height = 16, width, radius, style }: { height?: number; width?: number | string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useAdminTheme();
  return (
    <View
      style={[
        { backgroundColor: t.colors.surfaceMuted, height, width: (width as any) ?? "100%", borderRadius: radius ?? t.radius.sm },
        style,
      ]}
    />
  );
}

// ============================================================================
// Row — pressable list row with left icon + title + right chevron
// ============================================================================
export function AdminRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
  destructive,
  disabled,
  testID,
  accessibilityHint,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
}) {
  const t = useAdminTheme();
  const fg = destructive ? t.colors.danger : t.colors.onSurface;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.md,
        paddingVertical: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        minHeight: 56,
        backgroundColor: pressed ? t.colors.surfaceMuted : "transparent",
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: t.radius.md,
            backgroundColor: destructive ? t.colors.dangerSoft : t.colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={icon as any} size={16} color={fg} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.type.bodyLg, color: fg, fontFamily: "DMSansMedium" }}>{title}</Text>
        {subtitle ? (
          <Text style={{ ...t.type.bodySm, color: t.colors.onSurfaceSecondary, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={18} color={t.colors.mutedText} /> : null)}
    </Pressable>
  );
}

// ============================================================================
// Text input row
// ============================================================================
export const adminSharedStyles = StyleSheet.create({
  fill: { flex: 1 },
});
