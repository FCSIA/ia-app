import { Alert, Image, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useConvex, useMutation } from "convex/react";
import { authClient } from "@/lib/auth-client";
import { useCurrentUser } from "@/lib/auth";
import { Screen } from "@/components/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function ProfileScreen() {
  const user = useCurrentUser();
  const convex = useConvex();
  const saveImage = useMutation(api.users.me.saveUserImage);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const { color } = useTheme();

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uploadUrl = await generateUploadUrl({});
    const blob = await (await fetch(asset.uri)).blob();
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": asset.mimeType ?? "image/jpeg" },
      body: blob
    });
    const { storageId } = await upload.json();
    await saveImage({
      kind: "avatar",
      storageId,
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize ?? blob.size
    });
  }

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
  }

  return (
    <Screen title="Profile" subtitle="Account settings stay lightweight on mobile.">
      <Card style={{ alignItems: "center", gap: 12 }}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={{ width: 84, height: 84, borderRadius: 999 }} />
        ) : (
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 999,
              backgroundColor: color("accent"),
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: color("foreground"), fontSize: 28, fontWeight: "900" }}>
              {user?.firstName?.[0] ?? "I"}
            </Text>
          </View>
        )}
        <Text style={{ color: color("foreground"), fontSize: 22, fontWeight: "900" }}>
          {[user?.firstName, user?.lastName].filter(Boolean).join(" ")}
        </Text>
        <Text style={{ color: color("mutedForeground") }}>{user?.uniqueId}</Text>
        <Button title="Update avatar" variant="secondary" onPress={pickAvatar} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ color: color("foreground"), fontSize: 18, fontWeight: "900" }}>Account deletion</Text>
        <Text style={{ color: color("mutedForeground"), lineHeight: 20 }}>
          School-managed accounts are handled by IA support. Submit a deletion request through the front office or district account support.
        </Text>
        <Button
          title="Show deletion path"
          variant="tertiary"
          onPress={() => Alert.alert("Account deletion", "Contact IA support or the front office to request account removal or deactivation.")}
        />
      </Card>

      <Button title="Sign out" variant="ghost" onPress={logout} />
    </Screen>
  );
}
