import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, Sparkles } from 'lucide-react-native';
import { authApi } from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { AppButton, AppInput, Card, Screen } from '@/components/ui';
import { theme } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!uniqueId.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter your ID and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.login(uniqueId.trim().toUpperCase(), password);
      await setAuth(response.data.token, response.data.user);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login failed', getErrorMessage(error, 'Incorrect ID or password.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboard contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>IA</Text>
        </View>
        <Text style={styles.title}>IA School</Text>
        <Text style={styles.subtitle}>
          School announcements, clubs, events, and Flex Friday in one place.
        </Text>
      </View>

      <Card style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.sparkBadge}>
            <Sparkles size={16} color={theme.colors.accentDark} />
          </View>
          <Text style={styles.panelTitle}>Welcome back</Text>
          <Text style={styles.panelCopy}>
            Sign in with your school ID to open your dashboard.
          </Text>
        </View>

        <AppInput
          label="Student / Staff ID"
          placeholder="e.g. STU001"
          value={uniqueId}
          onChangeText={setUniqueId}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <AppInput
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.helper}>
          <ShieldCheck size={14} color={theme.colors.textMuted} />
          <Text style={styles.helperText}>First-time sign in usually uses your ID as the password.</Text>
        </View>

        <AppButton label="Sign In" onPress={handleLogin} loading={loading} />
      </Card>

      <Text style={styles.footer}>
        If you cannot access your account, contact an administrator or sponsor.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 24,
  },
  hero: {
    gap: 10,
  },
  mark: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.glow,
  },
  markText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  panel: {
    gap: 16,
  },
  panelHeader: {
    gap: 6,
  },
  sparkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  panelCopy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  helper: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    color: theme.colors.textFaint,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
