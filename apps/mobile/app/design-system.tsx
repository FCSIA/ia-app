import { Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useTheme } from "@/lib/theme";

export default function DesignSystemScreen() {
  const { color } = useTheme();
  return (
    <Screen title="Design System" subtitle="Native primitive parity gallery.">
      <Card style={{ gap: 12 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Buttons</Text>
        <Button title="Primary" />
        <Button title="Secondary" variant="secondary" />
        <Button title="Tertiary" variant="tertiary" />
        <Button title="Ghost" variant="ghost" />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Badges</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge label="School Wide" color="blue" />
          <Badge label="Club" color="amber" />
          <Badge label="Saved" color="emerald" variant="dot" />
          <Badge label="Needs review" color="red" />
        </View>
      </Card>
      <Card style={{ gap: 12 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Inputs</Text>
        <TextField placeholder="Search IA" />
        <TextField placeholder="Message" multiline />
      </Card>
    </Screen>
  );
}
