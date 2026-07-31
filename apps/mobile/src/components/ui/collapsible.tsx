import { type ComponentProps, type ReactNode } from "react";
import {
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as CollapsiblePrimitive from "@rn-primitives/collapsible";
import { useTheme } from "@/lib/theme";

const COMPACT_HIT_SLOP = { top: 2, right: 2, bottom: 2, left: 2 } as const;

export type CollapsibleProps = ComponentProps<typeof CollapsiblePrimitive.Root>;
export type CollapsibleTriggerProps = ComponentProps<
  typeof CollapsiblePrimitive.Trigger
>;
export type CollapsibleContentProps = ComponentProps<
  typeof CollapsiblePrimitive.Content
>;

/**
 * Accessible disclosure state. Supports both controlled (`open`) and
 * uncontrolled (`defaultOpen`) composition through rn-primitives.
 */
export function Collapsible(props: CollapsibleProps) {
  return <CollapsiblePrimitive.Root {...props} />;
}

/**
 * A visually compact trigger with a 44px interaction envelope. Compose the
 * label, chevron, and any metadata as children so feature layouts stay in
 * control of their hierarchy.
 */
export function CollapsibleTrigger({
  children,
  disabled,
  hitSlop = COMPACT_HIT_SLOP,
  style,
  ...props
}: CollapsibleTriggerProps) {
  const { color } = useTheme();

  return (
    <CollapsiblePrimitive.Trigger
      disabled={disabled}
      hitSlop={hitSlop}
      style={(state) => [
        {
          minHeight: 44,
          backgroundColor: state.pressed ? color("secondary") : "transparent",
          opacity: disabled ? 0.48 : 1,
        },
        resolvePressableStyle(style, state),
      ]}
      {...props}
    >
      {(state) => (
        <TriggerRow>
          {typeof children === "function" ? children(state) : children}
        </TriggerRow>
      )}
    </CollapsiblePrimitive.Trigger>
  );
}

export function CollapsibleContent({
  style,
  ...props
}: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.Content
      style={[{ overflow: "hidden" }, style]}
      {...props}
    />
  );
}

function resolvePressableStyle(
  style: CollapsibleTriggerProps["style"],
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === "function" ? style(state) : style;
}

function TriggerRow({ children }: { children: ReactNode }) {
  return (
    <View
      pointerEvents="none"
      style={{
        minHeight: 44,
        minWidth: 0,
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      {children}
    </View>
  );
}
