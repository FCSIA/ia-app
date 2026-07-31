import { useState } from "react";
import { Alert, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useConvex, useMutation } from "convex/react";
import {
  Bell,
  Camera,
  ChevronRight,
  KeyRound,
  LogOut,
  Palette,
  Trash2,
} from "lucide-react-native";
import { AppDetailHeader, FormScreen } from "@/components/screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CompactList,
  CompactListItem,
  CompactListSectionHeader,
} from "@/components/ui/compact-list";
import { Field } from "@/components/ui/field";
import { AdaptivePane, AdaptiveSplit } from "@/components/ui/layout";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { Txt } from "@/components/ui/typography";
import { authClient } from "@/lib/auth-client";
import {
  discardPreparedAvatarImage,
  prepareAvatarImage,
  type PreparedAvatarImage,
} from "@/lib/avatar-image";
import { useCurrentUser } from "@/lib/auth";
import { warning } from "@/lib/haptics";
import { unregisterStoredNativePushToken } from "@/lib/push";
import { spacing } from "@/lib/tokens";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";

const EMPTY_PASSWORD_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ProfileScreen() {
  const user = useCurrentUser();
  const convex = useConvex();
  const { color } = useTheme();
  const saveImage = useMutation(api.users.me.saveUserImage);
  const clearImage = useMutation(api.users.me.clearUserImage);
  const changePassword = useMutation(api.users.auth.changePassword);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const { showToast } = useToast();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const newPasswordIsShort =
    passwordForm.newPassword.length > 0 && passwordForm.newPassword.length < 8;
  const confirmationDoesNotMatch =
    passwordForm.confirmPassword.length > 0 &&
    passwordForm.newPassword !== passwordForm.confirmPassword;
  const passwordIsValid =
    Boolean(passwordForm.currentPassword) &&
    passwordForm.newPassword.length >= 8 &&
    passwordForm.newPassword === passwordForm.confirmPassword;
  const navigationChevron = (
    <ChevronRight
      accessibilityElementsHidden
      color={color("mutedForeground")}
      size={17}
      strokeWidth={2}
    />
  );

  async function pickAvatar() {
    let prepared: PreparedAvatarImage | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setAvatarUploading(true);
      prepared = await prepareAvatarImage(asset.uri);
      const uploadUrl = await generateUploadUrl({});
      const upload = await prepared.file.upload(uploadUrl, {
        httpMethod: "POST",
        headers: { "Content-Type": prepared.mimeType },
        mimeType: prepared.mimeType,
      });
      if (upload.status < 200 || upload.status >= 300) {
        throw new Error("The image could not be uploaded.");
      }
      const { storageId } = JSON.parse(upload.body) as {
        storageId: Id<"_storage">;
      };
      await saveImage({
        kind: "avatar",
        storageId,
        mimeType: prepared.mimeType,
        size: prepared.size,
      });
      showToast({ title: "Photo updated", tone: "success" });
    } catch (error) {
      showToast({
        title: "Photo wasn't updated",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
    } finally {
      discardPreparedAvatarImage(prepared);
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    try {
      await clearImage({ kind: "avatar" });
      showToast({ title: "Photo removed", tone: "success" });
    } catch (error) {
      showToast({
        title: "Photo wasn't removed",
        body: error instanceof Error ? error.message : "Try again.",
        tone: "warning",
      });
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
    if (!passwordIsValid) return;

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(EMPTY_PASSWORD_FORM);
      setPasswordOpen(false);
      showToast({ title: "Password updated", tone: "success" });
    } catch (error) {
      showToast({
        title: "Password",
        body: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  return (
    <FormScreen navigation={<AppDetailHeader title="Profile" />}>
      <AdaptiveSplit gap="md" style={{ paddingHorizontal: spacing.sm }}>
        <AdaptivePane priority="primary">
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Avatar uri={user?.avatarUrl} name={fullName} size={64} />
            <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
              <Txt variant="title" numberOfLines={2}>
                {fullName || "Innovation Academy"}
              </Txt>
              {user?.uniqueId ? (
                <Txt variant="label" tone="muted" numberOfLines={1}>
                  {user.uniqueId}
                </Txt>
              ) : null}
            </View>
          </View>
        </AdaptivePane>
        <AdaptivePane priority="secondary">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Change photo"
              icon={Camera}
              size="sm"
              variant="secondary"
              loading={avatarUploading}
              style={{ flex: 1 }}
              onPress={() => void pickAvatar()}
            />
            {user?.avatarUrl ? (
              <Button
                title="Remove"
                size="sm"
                variant="ghost"
                disabled={avatarUploading}
                onPress={() => void removeAvatar()}
              />
            ) : null}
          </View>
        </AdaptivePane>
      </AdaptiveSplit>

      <View>
        <CompactListSectionHeader title="Preferences" />
        <CompactList separation="leading">
          <CompactListItem
            icon={Palette}
            title="Appearance"
            detail="Theme and colors"
            trailing={navigationChevron}
            onPress={() => router.push("/settings/theme" as never)}
          />
          <CompactListItem
            icon={Bell}
            title="Notifications"
            detail="Push alerts and topics"
            trailing={navigationChevron}
            onPress={() => router.push("/settings/notifications" as never)}
          />
        </CompactList>
      </View>

      <View>
        <CompactListSectionHeader title="Security" />
        <CompactList>
          <CompactListItem
            icon={KeyRound}
            title="Password"
            detail="Change your account password"
            trailing={navigationChevron}
            onPress={() => setPasswordOpen(true)}
          />
        </CompactList>
      </View>

      <View>
        <CompactListSectionHeader title="Account" />
        <CompactList separation="leading">
          <CompactListItem
            icon={Trash2}
            title="Delete account"
            detail="Contact IA support to request deletion"
            state="destructive"
            onPress={() =>
              showToast({
                title: "Delete account",
                body: "Contact IA support or the front office to request account removal or deactivation.",
              })
            }
          />
          <CompactListItem
            icon={LogOut}
            title="Sign out"
            state="destructive"
            onPress={() => void logout()}
          />
        </CompactList>
      </View>

      {__DEV__ ? (
        <Txt
          variant="caption"
          tone="muted"
          style={{ textAlign: "center" }}
          onLongPress={() => router.push("/design-system" as never)}
        >
          IA Mobile v0.0.1
        </Txt>
      ) : null}

      <Sheet
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change password"
      >
        <Field.Root>
          <Field.Label required>Current password</Field.Label>
          <TextField
            accessibilityLabel="Current password"
            autoCapitalize="none"
            autoCorrect={false}
            density="compact"
            secureTextEntry
            textContentType="password"
            value={passwordForm.currentPassword}
            onChangeText={(currentPassword) =>
              setPasswordForm((current) => ({
                ...current,
                currentPassword,
              }))
            }
          />
        </Field.Root>
        <Field.Root>
          <Field.Label required>New password</Field.Label>
          <TextField
            accessibilityLabel="New password"
            autoCapitalize="none"
            autoCorrect={false}
            density="compact"
            secureTextEntry
            state={newPasswordIsShort ? "invalid" : "default"}
            textContentType="newPassword"
            value={passwordForm.newPassword}
            onChangeText={(newPassword) =>
              setPasswordForm((current) => ({ ...current, newPassword }))
            }
          />
          {newPasswordIsShort ? (
            <Field.Error>Use at least 8 characters.</Field.Error>
          ) : (
            <Field.Description>At least 8 characters.</Field.Description>
          )}
        </Field.Root>
        <Field.Root>
          <Field.Label required>Confirm password</Field.Label>
          <TextField
            accessibilityLabel="Confirm password"
            autoCapitalize="none"
            autoCorrect={false}
            density="compact"
            secureTextEntry
            state={confirmationDoesNotMatch ? "invalid" : "default"}
            textContentType="newPassword"
            value={passwordForm.confirmPassword}
            onChangeText={(confirmPassword) =>
              setPasswordForm((current) => ({
                ...current,
                confirmPassword,
              }))
            }
          />
          {confirmationDoesNotMatch ? (
            <Field.Error>Passwords do not match.</Field.Error>
          ) : null}
        </Field.Root>
        <Button
          title="Change password"
          size="sm"
          disabled={!passwordIsValid}
          onPress={() => void submitPassword()}
        />
      </Sheet>
    </FormScreen>
  );
}
