import type { ReactNode } from "react";
import { View } from "react-native";
import { Txt } from "@/components/ui/typography";
import { spacing } from "@/lib/tokens";

type SectionProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ title, action, children }: SectionProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
        <Txt variant="section">{title}</Txt>
        {action}
      </View>
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}
