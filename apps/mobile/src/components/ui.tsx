import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';

type ButtonTone = 'accent' | 'secondary' | 'ghost' | 'danger';
type PillTone = 'accent' | 'blue' | 'green' | 'amber' | 'red' | 'neutral';

const pillPalette: Record<PillTone, { backgroundColor: string; borderColor: string; color: string }> = {
  accent: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: 'rgba(249, 115, 22, 0.2)',
    color: theme.colors.accentDark,
  },
  blue: {
    backgroundColor: theme.colors.blueSoft,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    color: theme.colors.blue,
  },
  green: {
    backgroundColor: theme.colors.greenSoft,
    borderColor: 'rgba(22, 163, 74, 0.2)',
    color: theme.colors.green,
  },
  amber: {
    backgroundColor: theme.colors.amberSoft,
    borderColor: 'rgba(217, 119, 6, 0.2)',
    color: theme.colors.amber,
  },
  red: {
    backgroundColor: theme.colors.redSoft,
    borderColor: 'rgba(220, 38, 38, 0.18)',
    color: theme.colors.red,
  },
  neutral: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderColor: 'rgba(107, 114, 128, 0.12)',
    color: theme.colors.textSoft,
  },
};

function DecorativeBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <View style={styles.blobMiddle} />
    </View>
  );
}

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
};

export function Screen({
  children,
  scroll = false,
  style,
  contentContainerStyle,
  keyboard = false,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, styles.flex, contentContainerStyle]}>{children}</View>
  );

  const wrappedContent = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, style]}>
      <DecorativeBackground />
      {wrappedContent}
    </SafeAreaView>
  );
}

export function TopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarText}>
        <Text style={styles.topBarTitle}>{title}</Text>
        {subtitle ? <Text style={styles.topBarSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.topBarActions}>{right}</View> : null}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  tone = 'accent',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const toneStyle = {
    accent: styles.buttonAccent,
    secondary: styles.buttonSecondary,
    ghost: styles.buttonGhost,
    danger: styles.buttonDanger,
  }[tone];

  const textStyle = {
    accent: styles.buttonAccentText,
    secondary: styles.buttonSecondaryText,
    ghost: styles.buttonGhostText,
    danger: styles.buttonDangerText,
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        toneStyle,
        style,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === 'accent' ? '#ffffff' : theme.colors.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, textStyle]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: PillTone;
}) {
  const palette = pillPalette[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.pillText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  tone = 'accent',
}: {
  label: string;
  value: string;
  tone?: PillTone;
}) {
  const palette = pillPalette[tone];
  return (
    <Card style={styles.metricCard}>
      <View
        style={[
          styles.metricIcon,
          { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        ]}
      />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

export function AppInput({
  label,
  multiline,
  style,
  ...props
}: {
  label?: string;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
} & TextInputProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        multiline={multiline}
        style={[styles.input, multiline && styles.textArea, style]}
        placeholderTextColor={theme.colors.textFaint}
      />
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action}
    </Card>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function Avatar({ label }: { label: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

export function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboard}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export const uiStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  split: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muted: {
    color: theme.colors.textMuted,
  },
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenContent: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: 32,
    paddingTop: 8,
    gap: theme.spacing.section,
  },
  blobTop: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 160,
    backgroundColor: 'rgba(249, 115, 22, 0.09)',
  },
  blobBottom: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 160,
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
  },
  blobMiddle: {
    position: 'absolute',
    top: '38%',
    right: 12,
    width: 140,
    height: 140,
    borderRadius: 100,
    backgroundColor: 'rgba(249, 115, 22, 0.05)',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  topBarText: {
    flex: 1,
  },
  topBarTitle: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  topBarSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    ...theme.shadow.card,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  button: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonAccent: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accentDark,
    ...theme.shadow.glow,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: theme.colors.redSoft,
    borderColor: 'rgba(220, 38, 38, 0.16)',
  },
  buttonAccentText: {
    color: '#ffffff',
  },
  buttonSecondaryText: {
    color: theme.colors.text,
  },
  buttonGhostText: {
    color: theme.colors.textSoft,
  },
  buttonDangerText: {
    color: theme.colors.red,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricCard: {
    flex: 1,
    minWidth: 100,
    gap: 6,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: theme.colors.textSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyDescription: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.accentDark,
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalKeyboard: {
    width: '100%',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    marginTop: 10,
  },
  modalHeader: {
    paddingHorizontal: theme.spacing.screen,
    paddingTop: 14,
    paddingBottom: 10,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalContent: {
    paddingHorizontal: theme.spacing.screen,
    paddingBottom: 32,
    paddingTop: 4,
    gap: 16,
  },
});
