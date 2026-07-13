import { useState } from "react";
import { Alert, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useConvex, useMutation } from "convex/react";
import { Bell, Camera, KeyRound, Palette, Trash2 } from "lucide-react-native";
import { authClient } from "@/lib/auth-client";
import { unregisterStoredNativePushToken } from "@/lib/push";
import { useCurrentUser } from "@/lib/auth";
import { Screen } from "@/components/screen";
import { Avatar, Button, ListRow, Section, Sheet, TextField, Txt, useToast } from "@/components/ui";
import { warning } from "@/lib/haptics";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function ProfileScreen() {
  const user = useCurrentUser();
  const convex = useConvex();
  const saveImage = useMutation(api.users.me.saveUserImage);
  const clearImage = useMutation(api.users.me.clearUserImage);
  const changePassword = useMutation(api.users.auth.changePassword);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const { showToast } = useToast();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  async function pickAvatar() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const uploadUrl = await generateUploadUrl({});
      const blob = await (await fetch(asset.uri)).blob();
      const upload = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
        body: blob,
      });
      if (!upload.ok) throw new Error("The image could not be uploaded.");
      const { storageId } = await upload.json();
      await saveImage({
        kind: "avatar",
        storageId,
        mimeType: asset.mimeType ?? "image/jpeg",
        size: asset.fileSize ?? blob.size,
      });
      showToast({ title: "Photo updated", tone: "success" });
    } catch (error) {
      showToast({ title: "Photo wasn't updated", body: error instanceof Error ? error.message : "Try again.", tone: "warning" });
    }
  }

  async function logout() {
    await warning();
    Alert.alert("Sign out?", "You can sign back in with your school account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await unregisterStoredNativePushToken(convex).catch(() => {});
          await authClient.signOut();
          router.replace("/login");
        },
      },
    ]);
  }

  async function submitPassword() {
    if (!passwordForm.currentPassword || passwordForm.newPassword.length < 8 || passwordForm.newPassword !== passwordForm.confirmPassword) return;
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordOpen(false);
      showToast({ title: "Password updated", tone: "success" });
    } catch (error) {
      showToast({ title: "Password", body: error instanceof Error ? error.message : "Try again." });
    }
  }

  return (
    <Screen title="Profile">
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar uri={user?.avatarUrl} name={fullName} size={72} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Txt variant="title">{fullName || "Innovation Academy"}</Txt>
          <Txt tone="muted">{user?.uniqueId}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Button title="Change photo" icon={Camera} variant="secondary" onPress={() => void pickAvatar()} />
        {user?.avatarUrl ? (
          <Button
            title="Remove"
            variant="ghost"
            onPress={() => clearImage({ kind: "avatar" }).then(() => showToast({ title: "Photo removed", tone: "success" })).catch((error) => showToast({ title: "Photo wasn't removed", body: error instanceof Error ? error.message : "Try again.", tone: "warning" }))}
          />
        ) : null}
      </View>

      <Section title="Preferences">
        <ListRow icon={Palette} title="Appearance" subtitle="Theme and colors" onPress={() => router.push("/settings/theme" as never)} />
        <ListRow icon={Bell} title="Notifications" subtitle="Push alerts and topics" onPress={() => router.push("/settings/notifications" as never)} />
      </Section>

      <Section title="Security">
        <ListRow icon={KeyRound} title="Password" subtitle="Change your account password" onPress={() => setPasswordOpen(true)} />
      </Section>

      <Section title="Account">
        <ListRow
          icon={Trash2}
          title="Delete account"
          subtitle="Contact IA support to request deletion"
          onPress={() => showToast({ title: "Delete account", body: "Contact IA support or the front office to request account removal or deactivation." })}
        />
        <Button title="Sign out" variant="ghost" onPress={logout} />
      </Section>

      {__DEV__ ? (
        <Txt variant="caption" tone="muted" style={{ textAlign: "center" }} onLongPress={() => router.push("/design-system" as never)}>
          IA Mobile v0.0.1
        </Txt>
      ) : null}

      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change password">
        <PasswordField
          label="Current password"
          value={passwordForm.currentPassword}
          onChangeText={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))}
        />
        <PasswordField
          label="New password"
          value={passwordForm.newPassword}
          onChangeText={(newPassword) => setPasswordForm((current) => ({ ...current, newPassword }))}
          hint="At least 8 characters"
        />
        <PasswordField
          label="Confirm password"
          value={passwordForm.confirmPassword}
          onChangeText={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))}
        />
        <Button
          title="Change password"
          disabled={!passwordForm.currentPassword || passwordForm.newPassword.length < 8 || passwordForm.newPassword !== passwordForm.confirmPassword}
          onPress={() => void submitPassword()}
        />
      </Sheet>
    </Screen>
  );
}

function PasswordField({ label, hint, value, onChangeText }: { label: string; hint?: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
        <Txt variant="label">{label}</Txt>
        {hint ? <Txt variant="caption" tone="muted">{hint}</Txt> : null}
      </View>
      <TextField accessibilityLabel={label} value={value} onChangeText={onChangeText} secureTextEntry />
    </View>
  );
}
