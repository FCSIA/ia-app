/** Every AsyncStorage / SecureStore key the app owns. */
export const STORAGE_KEYS = {
  user: "ia_user",
  theme: "ia_theme",
  customTheme: "ia_custom_theme",
  gifAutoplay: "ia_gif_autoplay",
  chatDraftPrefix: "ia_chat_draft",
  expoPushToken: "ia_expo_push_token",
  offlineCachePrefix: "ia_offline_",
} as const;
