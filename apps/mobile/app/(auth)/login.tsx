import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, TextField, Txt } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

export default function LoginScreen() {
  const { color } = useTheme();
  const [uniqueId, setUniqueId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = !!uniqueId.trim() && !!password;

  async function signIn() {
    if (!canSubmit || loading) return;
    setLoading(true);
    try {
      const result = await authClient.signIn.username({
        username: uniqueId.trim().toUpperCase(),
        password,
      } as any);
      if (result.error) {
        Alert.alert("Unable to sign in", result.error.message ?? "Check your ID and password.");
        return;
      }
      router.replace("/dashboard" as never);
    } catch {
      Alert.alert("Unable to sign in", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color("background") }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
          }}
        >
          <View style={{ width: "100%", maxWidth: 460, alignSelf: "center", gap: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radii.md,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.sm,
                }}
              >
                <Image
                  source={require("../../assets/logo.png")}
                  accessibilityLabel="Innovation Academy phoenix"
                  style={{ width: 48, height: 48, borderRadius: radii.md }}
                  resizeMode="contain"
                />
              </View>
              <Txt variant="display">Sign in</Txt>
              <Txt tone="muted">Use your school ID and password.</Txt>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <Txt variant="label">School ID</Txt>
                <TextField
                  accessibilityLabel="School ID"
                  autoCapitalize="characters"
                  autoComplete="username"
                  autoCorrect={false}
                  placeholder="School ID"
                  value={uniqueId}
                  onChangeText={setUniqueId}
                  returnKeyType="next"
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <Txt variant="label">Password</Txt>
                <TextField
                  accessibilityLabel="Password"
                  autoComplete="current-password"
                  placeholder="Password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={() => void signIn()}
                />
              </View>
              <Button title="Sign in" loading={loading} disabled={!canSubmit} onPress={() => void signIn()} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
