import { Pressable, Text, View } from "react-native";
import { themes, type ThemeName } from "@ia/design-tokens";
import { Screen } from "@/components/screen";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";

const names = Object.keys(themes) as ThemeName[];

export default function ThemeScreen() {
  const theme = useTheme();
  return (
    <Screen title="Theme" subtitle="Same shipped themes as the web app.">
      <View style={{ gap: 12 }}>
        {names.map((name) => (
          <Pressable key={name} onPress={() => theme.setTheme(name)}>
            <Card
              style={{
                gap: 8,
                borderColor: theme.name === name ? theme.color("primary") : theme.color("border")
              }}
            >
              <Text style={{ color: theme.color("foreground"), fontSize: 18, fontWeight: "900" }}>
                {name.replace("-", " ")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["background", "primary", "accent", "foreground"] as const).map((key) => (
                  <View
                    key={key}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: theme.color("border"),
                      backgroundColor: `hsl(${themes[name][key]})`
                    }}
                  />
                ))}
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
