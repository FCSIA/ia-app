import { Children, Fragment, createContext, use, type ReactNode } from "react";
import {
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Divider } from "@/components/ui/layout";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { densityMetrics, type Density } from "@/lib/tokens";

export type CompactListItemState =
  | "default"
  | "selected"
  | "unread"
  | "disabled"
  | "destructive";

type CompactListProps = ViewProps & {
  density?: Density;
  separation?: "none" | "full" | "leading";
};

type CompactListSectionHeaderProps = ViewProps & {
  title: string;
  count?: number;
  action?: ReactNode;
  density?: Density;
};

type CompactListItemBaseProps = Omit<
  PressableProps,
  "children" | "disabled" | "style"
> & {
  title: string;
  detail?: string;
  trailing?: ReactNode;
  state?: CompactListItemState;
  density?: Density;
  style?: StyleProp<ViewStyle>;
  titleNumberOfLines?: number;
  detailNumberOfLines?: number;
};

type CompactListItemLeadingProps =
  | { icon?: LucideIcon; leading?: never }
  | { icon?: never; leading?: ReactNode };

export type CompactListItemProps = CompactListItemBaseProps &
  CompactListItemLeadingProps;

const CompactListDensityContext = createContext<Density>("compact");

export function CompactList({
  density = "compact",
  separation = "none",
  children,
  className,
  ...props
}: CompactListProps) {
  const items = Children.toArray(children);
  const metrics = densityMetrics[density];
  const leadingInset =
    metrics.horizontalInset + metrics.iconSize + metrics.contentGap;

  return (
    <CompactListDensityContext value={density}>
      <View
        accessibilityRole="list"
        className={joinClassNames("w-full", className)}
        {...props}
      >
        {items.map((child, index) => (
          <Fragment key={getChildKey(child, index)}>
            {index > 0 && separation !== "none" ? (
              <Divider
                style={
                  separation === "leading"
                    ? { marginLeft: leadingInset }
                    : undefined
                }
              />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
    </CompactListDensityContext>
  );
}

export function CompactListSectionHeader({
  title,
  count,
  action,
  density,
  className,
  style,
  ...props
}: CompactListSectionHeaderProps) {
  const inheritedDensity = use(CompactListDensityContext);
  const metrics = densityMetrics[density ?? inheritedDensity];

  return (
    <View
      accessibilityRole="header"
      className={joinClassNames(
        "flex-row items-center justify-between",
        className,
      )}
      style={[
        {
          minHeight: metrics.sectionHeaderHeight,
          paddingHorizontal: metrics.horizontalInset,
          gap: metrics.contentGap,
        },
        style,
      ]}
      {...props}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <Txt variant="overline" tone="muted" numberOfLines={1}>
          {title}
        </Txt>
        {count !== undefined ? (
          <Txt variant="caption" tone="muted">
            {count}
          </Txt>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function CompactListItem({
  icon: Icon,
  leading,
  title,
  detail,
  trailing,
  state = "default",
  density,
  style,
  titleNumberOfLines = 1,
  detailNumberOfLines = 1,
  onPress,
  onLongPress,
  accessibilityRole,
  accessibilityState,
  hitSlop,
  className,
  ...props
}: CompactListItemProps) {
  const { color, name } = useTheme();
  const inheritedDensity = use(CompactListDensityContext);
  const resolvedDensity = density ?? inheritedDensity;
  const metrics = densityMetrics[resolvedDensity];
  const isDisabled = state === "disabled";
  const isSelected = state === "selected";
  const isUnread = state === "unread";
  const isDestructive = state === "destructive";
  const isInteractive = Boolean(onPress || onLongPress);
  const interactionInset = Math.max(
    0,
    (metrics.touchTarget - metrics.rowMinHeight) / 2,
  );
  const foregroundColor = isDestructive
    ? color("destructive")
    : isDisabled
      ? color("mutedForeground")
      : isSelected || isUnread
        ? color("foreground")
        : color("mutedForeground");
  const selectedBackground = isSelected ? color("accent") : "transparent";
  const resolvedAccessibilityState = {
    ...accessibilityState,
    ...(isDisabled ? { disabled: true } : {}),
    ...(isSelected ? { selected: true } : {}),
  };
  const content = (
    <>
      {isSelected || isUnread ? (
        <View
          accessibilityElementsHidden
          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full"
          style={{ backgroundColor: color("primary") }}
        />
      ) : null}
      {Icon ? (
        <Icon
          size={metrics.iconSize}
          color={foregroundColor}
          strokeWidth={isUnread ? 2.4 : 2}
        />
      ) : (
        leading
      )}
      <View className="min-w-0 flex-1">
        <Txt
          variant="body"
          numberOfLines={titleNumberOfLines}
          style={{
            color: foregroundColor,
            fontWeight: isSelected || isUnread ? "700" : "600",
            lineHeight: resolvedDensity === "comfortable" ? 22 : 19,
          }}
        >
          {title}
        </Txt>
        {detail ? (
          <Txt
            variant="caption"
            tone="muted"
            numberOfLines={detailNumberOfLines}
            style={{ lineHeight: 16 }}
          >
            {detail}
          </Txt>
        ) : null}
      </View>
      {isUnread ? (
        <View
          accessibilityElementsHidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color("primary") }}
        />
      ) : null}
      {trailing}
    </>
  );
  const baseStyle: StyleProp<ViewStyle> = [
    {
      minHeight: metrics.rowMinHeight,
      paddingHorizontal: metrics.horizontalInset,
      paddingVertical: metrics.verticalGap,
      gap: metrics.contentGap,
      borderRadius: metrics.radius,
      borderWidth: isSelected && name === "high-contrast" ? 1 : 0,
      borderColor: color("border"),
      backgroundColor: selectedBackground,
      opacity: isDisabled ? 0.5 : 1,
    },
    style,
  ];

  if (!isInteractive) {
    return (
      <View
        accessibilityRole={accessibilityRole}
        accessibilityState={resolvedAccessibilityState}
        className={joinClassNames("relative flex-row items-center", className)}
        style={baseStyle}
        {...props}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={resolvedAccessibilityState}
      disabled={isDisabled}
      hitSlop={hitSlop ?? interactionInset}
      onLongPress={onLongPress}
      onPress={onPress}
      className={joinClassNames("relative flex-row items-center", className)}
      style={({ pressed }) => [
        baseStyle,
        pressed && !isDisabled
          ? { backgroundColor: color("accent"), opacity: 0.74 }
          : null,
      ]}
      {...props}
    >
      {content}
    </Pressable>
  );
}

function getChildKey(child: ReactNode, index: number) {
  if (
    typeof child === "object" &&
    child !== null &&
    "key" in child &&
    child.key !== null
  ) {
    return String(child.key);
  }
  return String(index);
}

function joinClassNames(...names: Array<string | undefined>) {
  return names.filter(Boolean).join(" ");
}
