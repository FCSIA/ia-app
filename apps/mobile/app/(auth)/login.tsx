import { useEffect, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { pickNavigationLoadingFact } from "@ia/fun-facts";
import { Button, LoadingFact, TextField, Txt } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useConvexAuth } from "@/lib/convex-react";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { iaOrbitForTheme } from "@/components/ui/ia-orbit";

const SESSION_PICKUP_TIMEOUT_MS = 10_000;
const MAX_SESSION_REFETCHES = 3;

/**
 * Refetches through the session atom itself. After a sign-out in the same app
 * run, the `$sessionSignal` refetch that Better Auth fires on sign-in often
 * never updates `useSession()`, so Convex never receives a token.
 */
function refetchSession() {
  const state = authClient.$store.atoms.session.get();
  void state.refetch();
}

export default function LoginScreen() {
  const { color, name } = useTheme();
  const [uniqueId, setUniqueId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingFact, setLoadingFact] = useState(pickNavigationLoadingFact);
  const [signedIn, setSignedIn] = useState(false);
  const auth = useConvexAuth();
  const session = authClient.useSession();
  const sessionRetriesRef = useRef(0);
  const canSubmit = !!uniqueId.trim() && !!password;

  // Navigate only once Convex has picked up the new session. Replacing to the
  // tabs earlier lets their auth guard see the stale signed-out state and
  // bounce back here mid-transition, which crashes Fabric on Android.
  useEffect(() => {
    if (!signedIn) return;
    if (auth.isAuthenticated) {
      router.replace("/dashboard" as never);
      return;
    }
    const timeout = setTimeout(() => {
      setSignedIn(false);
      setLoading(false);
      Alert.alert("Unable to sign in", "Your account didn’t finish loading. Try again.");
    }, SESSION_PICKUP_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [auth.isAuthenticated, signedIn]);

  // If a refetch still settles without a session, ask again a few times
  // before the timeout above gives up.
  const sessionSettledEmpty =
    signedIn && !session.isPending && !session.isRefetching && !session.data;
  useEffect(() => {
    if (!sessionSettledEmpty) return;
    if (sessionRetriesRef.current >= MAX_SESSION_REFETCHES) return;
    sessionRetriesRef.current += 1;
    refetchSession();
  }, [sessionSettledEmpty]);

  async function signIn() {
    if (!canSubmit || loading) return;
    setLoadingFact(pickNavigationLoadingFact());
    setLoading(true);
    try {
      const result = await authClient.signIn.username({
        username: uniqueId.trim().toUpperCase(),
        password,
      } as any);
      if (result.error) {
        setLoading(false);
        Alert.alert("Unable to sign in", result.error.message ?? "Check your ID and password.");
        return;
      }
      // The new session cookie is stored once signIn resolves.
      sessionRetriesRef.current = 0;
      refetchSession();
      // Stay in the loading state until the effect above navigates.
      setSignedIn(true);
    } catch {
      setLoading(false);
      Alert.alert("Unable to sign in", "Check your connection and try again.");
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
                  source={iaOrbitForTheme(name)}
                  accessibilityLabel="IA Orbit"
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
              {loading ? <LoadingFact fact={loadingFact} /> : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
