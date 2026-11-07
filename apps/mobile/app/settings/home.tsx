import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useMutation } from "@/lib/convex-react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react-native";
import { Screen } from "@/components/screen";
import { Button, IconButton, ListRow, Section, Txt, useToast } from "@/components/ui";
import {
  HOME_WIDGET_LABELS,
  DEFAULT_HOME_WIDGETS,
  homeLayoutsEqual,
  moveHomeWidget,
  resolveHomeLayout,
  type HomeWidgetId,
} from "@/features/dashboard/home-layout";
import { useLiveCurrentUser } from "@/lib/auth";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function HomeSettingsScreen() {
  const user = useLiveCurrentUser();
  const updateLayout = useMutation(api.users.me.updateDashboardLayout);
  const [layout, setLayout] = useState<HomeWidgetId[]>([...DEFAULT_HOME_WIDGETS]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (user === undefined) return;
    const normalized = resolveHomeLayout(user?.dashboardLayout);
    setLayout((current) =>
      homeLayoutsEqual(current, normalized) ? current : normalized,
    );
  }, [user, user?.dashboardLayout]);

  const hiddenWidgets = useMemo(
    () => DEFAULT_HOME_WIDGETS.filter((id) => !layout.includes(id)),
    [layout],
  );

  async function saveLayout(nextLayout: readonly string[]) {
    if (savingRef.current) return;
    const next = resolveHomeLayout(nextLayout);
    const previous = layout;
    savingRef.current = true;
    setLayout(next);
    setSaving(true);
    try {
      await updateLayout({ layout: next });
    } catch (error) {
      setLayout(previous);
      showToast({
        title: "Home not updated",
        body: errorMessage(error),
        tone: "warning",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Screen title="Customize home" contentContainerStyle={{ gap: spacing.xl }}>
      <Section title="Shown">
        <View style={{ gap: spacing.sm }}>
          {layout.map((id, index) => (
            <ListRow
              key={id}
              title={HOME_WIDGET_LABELS[id]}
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <IconButton
                    icon={ArrowUp}
                    label={`Move ${HOME_WIDGET_LABELS[id]} up`}
                    size="sm"
                    variant="ghost"
                    disabled={saving || index === 0}
                    onPress={() => void saveLayout(moveHomeWidget(layout, index, index - 1))}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={`Move ${HOME_WIDGET_LABELS[id]} down`}
                    size="sm"
                    variant="ghost"
                    disabled={saving || index === layout.length - 1}
                    onPress={() => void saveLayout(moveHomeWidget(layout, index, index + 1))}
                  />
                  <IconButton
                    icon={EyeOff}
                    label={`Hide ${HOME_WIDGET_LABELS[id]}`}
                    size="sm"
                    variant="ghost"
                    disabled={saving || layout.length === 1}
                    onPress={() => void saveLayout(layout.filter((widget) => widget !== id))}
                  />
                </View>
              }
            />
          ))}
        </View>
      </Section>

      {hiddenWidgets.length ? (
        <Section title="Hidden">
          <View style={{ gap: spacing.sm }}>
            {hiddenWidgets.map((id) => (
              <Button
                key={id}
                icon={Eye}
                title={`Show ${HOME_WIDGET_LABELS[id]}`}
                variant="tertiary"
                disabled={saving}
                onPress={() => void saveLayout([...layout, id])}
              />
            ))}
          </View>
        </Section>
      ) : (
        <Txt tone="muted">All sections are shown.</Txt>
      )}
    </Screen>
  );
}
