import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";

export default function LoginScreen() {
  const { color } = useTheme();
  const [uniqueId, setUniqueId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const result = await authClient.signIn.username({
      username: uniqueId.trim().toUpperCase(),
      password
    } as any);
    setLoading(false);

    if (result.error) {
      Alert.alert("Unable to sign in", result.error.message ?? "Check your ID and password.");
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: color("background")
      }}
    >
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: color("foreground"), fontSize: 32, fontWeight: "900" }}>
            Innovation Academy
          </Text>
          <Text style={{ color: color("mutedForeground"), fontSize: 15 }}>
            Sign in with your school ID.
          </Text>
        </View>
        <Card style={{ gap: 12 }}>
          <TextField
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Unique ID"
            value={uniqueId}
            onChangeText={setUniqueId}
            returnKeyType="next"
          />
          <TextField
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={signIn}
          />
          <Button title="Sign in" loading={loading} disabled={!uniqueId || !password} onPress={signIn} />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}
