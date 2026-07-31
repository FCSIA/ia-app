import type { ReactNode } from "react";
import {
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

function FieldRoot({ children }: { children: ReactNode }) {
  return <View className="w-full gap-1">{children}</View>;
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <Txt variant="label" style={{ fontWeight: "700" }}>
      {children}
      {required ? (
        <Txt variant="label" tone="destructive">
          {" *"}
        </Txt>
      ) : null}
    </Txt>
  );
}

function FieldDescription({ children }: { children: ReactNode }) {
  return (
    <Txt variant="caption" tone="muted">
      {children}
    </Txt>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <Txt accessibilityRole="alert" variant="caption" tone="destructive">
      {children}
    </Txt>
  );
}

export const Field = {
  Root: FieldRoot,
  Label: FieldLabel,
  Description: FieldDescription,
  Error: FieldError,
} as const;

type CompactSearchFieldProps = Omit<TextInputProps, "style"> & {
  accessibilityLabel: string;
  containerStyle?: StyleProp<ViewStyle>;
  onClear?: () => void;
};

export function CompactSearchField({
  accessibilityLabel,
  containerStyle,
  onClear,
  value,
  ...props
}: CompactSearchFieldProps) {
  const { color } = useTheme();
  const canClear = typeof value === "string" && value.length > 0 && !!onClear;

  return (
    <View
      className="w-full flex-row items-center"
      style={[
        {
          minHeight: 40,
          gap: spacing.xs,
          borderRadius: radii.pill,
          backgroundColor: color("secondary"),
          paddingLeft: 10,
          paddingRight: canClear ? spacing.xs : 10,
        },
        containerStyle,
      ]}
    >
      <Search size={17} color={color("mutedForeground")} strokeWidth={2} />
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel}
        value={value}
        hitSlop={{ top: 2, bottom: 2 }}
        placeholderTextColor={color("mutedForeground")}
        selectionColor={color("primary")}
        className="min-w-0 flex-1 py-0 text-[15px]"
        style={{
          minHeight: 40,
          color: color("foreground"),
        }}
      />
      {canClear ? (
        <PressableScale
          accessibilityLabel="Clear search"
          haptic={false}
          hitSlop={6}
          onPress={onClear}
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <X size={15} color={color("mutedForeground")} strokeWidth={2.2} />
        </PressableScale>
      ) : null}
    </View>
  );
}
