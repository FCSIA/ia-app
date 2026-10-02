import { useState } from "react";
import { Alert, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useAction, useConvex, useMutation } from "@/lib/convex-react";
import { Bell, Camera, KeyRound, Palette, Trash2 } from "lucide-react-native";
import { authClient } from "@/lib/auth-client";
import {
  discardPreparedAvatarImage,
  prepareAvatarImage,
  type PreparedAvatarImage,
} from "@/lib/avatar-image";
import { unregisterStoredNativePushToken } from "@/lib/push";
import { clearOfflineCache } from "@/lib/offline-cache";
import { useCurrentUser } from "@/lib/auth";
import { Screen } from "@/components/screen";
import { Avatar, Button, ListRow, Section, Sheet, TextField, Txt, useToast } from "@/components/ui";
import { DeveloperBadge } from "@/components/ui/developer-badge";
import { warning } from "@/lib/haptics";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

export default function ProfileScreen() {
  const user = useCurrentUser();
  const convex = useConvex();
  const saveImage = useAction(api.users.me.saveUserImage);
  const clearImage = useMutation(api.users.me.clearUserImage);
  const changePassword = useMutation(api.users.auth.changePassword);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const { showToast } = useToast();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  async function pickAvatar() {
    let prepared: PreparedAvatarImage | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setAvatarUploading(true);
      prepared = await prepareAvatarImage(asset.uri);
      const { uploadUrl, uploadIntentId } = await generateUploadUrl({
        purpose: "USER_IMAGE",
      });
      const upload = await prepared.file.upload(uploadUrl, {
        httpMethod: "POST",
        headers: { "Content-Type": prepared.mimeType },
        mimeType: prepared.mimeType,
      });
      if (upload.status < 200 || upload.status >= 300) {
        throw new Error("The image could not be uploaded.");
      }
      const { storageId } = JSON.parse(upload.body) as { storageId: Id<"_storage"> };
      await saveImage({
        kind: "avatar",
        uploadIntentId,
        storageId,
        mimeType: prepared.mimeType,
        size: prepared.size,
      });
      showToast({ title: "Photo updated", tone: "success" });
    } catch (error) {
      showToast({ title: "Photo wasn't updated", body: error instanceof Error ? error.message : "Try again.", tone: "warning" });
    } finally {
      discardPreparedAvatarImage(prepared);
      setAvatarUploading(false);
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
          await clearOfflineCache();
          router.replace("/login");
        },
      },
    ]);
  }

  async function submitPassword() {
    if (!passwordForm.currentPassword || passwordForm.newPassword.length < 6 || passwordForm.newPassword !== passwordForm.confirmPassword) return;
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Txt variant="title" style={{ flexShrink: 1 }} numberOfLines={1}>
              {fullName || "Innovation Academy"}
            </Txt>
            <DeveloperBadge user={user} size={16} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Button
          title="Change photo"
          icon={Camera}
          variant="secondary"
          loading={avatarUploading}
          onPress={() => void pickAvatar()}
        />
        {user?.avatarUrl ? (
          <Button
            title="Remove"
            variant="ghost"
            disabled={avatarUploading}
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
          hint="At least 6 characters"
        />
        <PasswordField
          label="Confirm password"
          value={passwordForm.confirmPassword}
          onChangeText={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))}
        />
        <Button
          title="Change password"
          disabled={!passwordForm.currentPassword || passwordForm.newPassword.length < 6 || passwordForm.newPassword !== passwordForm.confirmPassword}
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
