import { StyleSheet, View, type ViewProps } from "react-native";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";

export type LayoutSpacing = "none" | keyof typeof spacing;
type LayoutAlignment = "stretch" | "start" | "center" | "end";
type InlineDistribution = "start" | "center" | "end" | "between";

type StackProps = ViewProps & {
  gap?: LayoutSpacing;
  align?: LayoutAlignment;
};

type InlineProps = ViewProps & {
  gap?: LayoutSpacing;
  align?: LayoutAlignment;
  distribution?: InlineDistribution;
  wrap?: "none" | "wrap";
};

type InsetProps = ViewProps & {
  size?: LayoutSpacing;
  axis?: "all" | "horizontal" | "vertical";
};

type DividerProps = Omit<ViewProps, "children"> & {
  orientation?: "horizontal" | "vertical";
  inset?: LayoutSpacing;
};

const gapClasses: Record<LayoutSpacing, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
  xl: "gap-6",
  "2xl": "gap-8",
};

const alignmentClasses: Record<LayoutAlignment, string> = {
  stretch: "items-stretch",
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

const distributionClasses: Record<InlineDistribution, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};

const wrapClasses: Record<NonNullable<InlineProps["wrap"]>, string> = {
  none: "flex-nowrap",
  wrap: "flex-wrap",
};

const insetClasses: Record<
  NonNullable<InsetProps["axis"]>,
  Record<LayoutSpacing, string>
> = {
  all: {
    none: "p-0",
    xs: "p-1",
    sm: "p-2",
    md: "p-3",
    lg: "p-4",
    xl: "p-6",
    "2xl": "p-8",
  },
  horizontal: {
    none: "px-0",
    xs: "px-1",
    sm: "px-2",
    md: "px-3",
    lg: "px-4",
    xl: "px-6",
    "2xl": "px-8",
  },
  vertical: {
    none: "py-0",
    xs: "py-1",
    sm: "py-2",
    md: "py-3",
    lg: "py-4",
    xl: "py-6",
    "2xl": "py-8",
  },
};

const spacingValues: Record<LayoutSpacing, number> = {
  none: 0,
  ...spacing,
};

export function Stack({
  gap = "md",
  align = "stretch",
  className,
  ...props
}: StackProps) {
  return (
    <View
      className={joinClassNames(
        "flex-col",
        gapClasses[gap],
        alignmentClasses[align],
        className,
      )}
      {...props}
    />
  );
}

export function Inline({
  gap = "sm",
  align = "center",
  distribution = "start",
  wrap = "none",
  className,
  ...props
}: InlineProps) {
  return (
    <View
      className={joinClassNames(
        "flex-row",
        gapClasses[gap],
        alignmentClasses[align],
        distributionClasses[distribution],
        wrapClasses[wrap],
        className,
      )}
      {...props}
    />
  );
}

export function Inset({
  size = "md",
  axis = "all",
  className,
  ...props
}: InsetProps) {
  return (
    <View
      className={joinClassNames(insetClasses[axis][size], className)}
      {...props}
    />
  );
}

export function Divider({
  orientation = "horizontal",
  inset = "none",
  className,
  style,
  ...props
}: DividerProps) {
  const { color, name } = useTheme();
  const thickness = name === "high-contrast" ? 1 : StyleSheet.hairlineWidth;
  const insetValue = spacingValues[inset];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={joinClassNames("shrink-0 self-stretch", className)}
      style={[
        orientation === "horizontal"
          ? { height: thickness, marginHorizontal: insetValue }
          : { width: thickness, marginVertical: insetValue },
        { backgroundColor: color("border") },
        style,
      ]}
      {...props}
    />
  );
}

function joinClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}
