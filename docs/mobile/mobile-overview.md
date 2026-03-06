---
tags: [mobile, expo, react-native]
---

# Mobile Overview — Expo

← [[index|Home]]

---

## What Is the Mobile App?

The mobile app is a separate program that runs natively on iOS and Android phones. It talks to the **same backend API** as the web app — only the presentation layer is different.

It lives in `apps/mobile/`.

---

## React Native

**React Native** is a framework that lets you write React code that renders as native mobile UI components instead of HTML:

| Web (HTML) | React Native | What it renders |
|-----------|--------------|-----------------|
| `<div>` | `<View>` | A container |
| `<p>` | `<Text>` | Text |
| `<button>` | `<TouchableOpacity>` | A pressable element |
| `<input>` | `<TextInput>` | A text input field |
| `<img>` | `<Image>` | An image |

The logic (state, API calls, auth) is nearly identical to the web app. Only the UI primitives differ.

---

## Expo

**Expo** is a toolkit on top of React Native that:
- Simplifies the iOS/Android build process (no Xcode/Android Studio required to start)
- Provides pre-built packages for device features (camera, notifications, secure storage)
- Runs a development server with live reload (`expo start`)

This app uses **Expo SDK 52**.

---

## Expo Router

**Expo Router v4** is file-based routing for mobile — the same concept as Next.js App Router:

```
apps/mobile/app/
├── _layout.tsx           ← root layout + auth check
├── login.tsx             ← /login screen
└── (tabs)/
    ├── _layout.tsx       ← tab bar layout
    ├── index.tsx         ← Home tab (Dashboard)
    ├── announcements.tsx ← Announcements tab
    ├── clubs.tsx         ← Clubs tab
    ├── calendar.tsx      ← Calendar tab
    └── flex.tsx          ← Flex Friday tab
```

`(tabs)/` is a **route group** — the parentheses mean it doesn't appear in the URL/path. It just groups the tab-bar screens together.

---

## Key Difference: SecureStore

The biggest difference from the web app is token storage. The web uses `localStorage`. The mobile app uses **Expo SecureStore**:

```typescript
// Mobile: apps/mobile/src/lib/auth.ts
import * as SecureStore from 'expo-secure-store';

export const setAuth = async (token: string, user: any) => {
  await SecureStore.setItemAsync('ia_token', token);
  await SecureStore.setItemAsync('ia_user', JSON.stringify(user));
};

export const getToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync('ia_token');
};
```

`SecureStore` encrypts data using the device's **secure enclave** (a dedicated hardware chip for cryptographic operations). Even if someone extracts the app's data, the token can't be read without the device's hardware key.

Notice `await` — SecureStore is **asynchronous** (it takes time to encrypt/decrypt), unlike `localStorage` which is synchronous.

---

## Mobile vs Web — Feature Comparison

| Feature | Web | Mobile |
|---------|-----|--------|
| Announcements | ✅ | ✅ |
| Clubs | ✅ | ✅ |
| Events | ✅ | ✅ |
| Calendar | ✅ | ✅ |
| Flex Friday | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Admin Panel | ✅ | ❌ |
| Profile Settings | ✅ | ✅ |
| PWA installable | ✅ | Native |

---

## Running the Mobile App

```bash
# Start Expo development server
pnpm dev:mobile

# Then in the terminal output, press:
# i → open iOS Simulator (requires Xcode on Mac)
# a → open Android Emulator (requires Android Studio)
# Scan QR code → open on physical device with Expo Go app
```

---

## Related

- [[frontend-overview]] — Web app (same patterns, different rendering)
- [[api-layer]] — The same API is called from mobile
- [[backend-auth]] — The JWT the mobile app stores in SecureStore
