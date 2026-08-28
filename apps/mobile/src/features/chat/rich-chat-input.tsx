import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "react-native-enriched-markdown";
import {
  ALargeSmall,
  AtSign,
  Bold,
  Italic,
  Link2,
  Plus,
  Underline,
  X,
  type LucideIcon,
} from "lucide-react-native";
import {
  Button,
  IconButton,
  PressableScale,
  TextField,
  Txt,
} from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import {
  normalizeExternalChatLink,
  sanitizeChatMarkdown,
} from "./chat-markdown";
import { mentionInsertion, type ChatMentionSuggestion } from "./mention-format";

export type { ChatMentionSuggestion } from "./mention-format";

type ComposerPanel = "tools" | "formatting" | null;

type RichChatInputProps = {
  accessibilityLabel: string;
  placeholder: string;
  plainText: string;
  markdown: string;
  editable: boolean;
  nativeID?: string;
  suggestions: ChatMentionSuggestion[];
  onMentionIntent?: () => void;
  toolbarActions?: ReactNode;
  toolbarTrailing?: ReactNode;
  onChange: (plainText: string, markdown: string) => void;
};

export function RichChatInput({
  accessibilityLabel,
  placeholder,
  plainText,
  markdown,
  editable,
  nativeID,
  suggestions,
  onMentionIntent,
  toolbarActions,
  toolbarTrailing,
  onChange,
}: RichChatInputProps) {
  const { color } = useTheme();
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const nativePlainTextRef = useRef(plainText);
  const nativeMarkdownRef = useRef(sanitizeChatMarkdown(markdown));
  const [styleState, setStyleState] = useState<StyleState | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ComposerPanel>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const nextMarkdown = sanitizeChatMarkdown(markdown);
    if (nextMarkdown === nativeMarkdownRef.current) return;
    nativeMarkdownRef.current = nextMarkdown;
    nativePlainTextRef.current = plainText;
    inputRef.current?.setValue(nextMarkdown);
  }, [markdown, plainText]);

  const emitChange = useCallback(
    (nextPlainText: string, nextMarkdown: string) => {
      onChange(nextPlainText, nextMarkdown);
    },
    [onChange],
  );

  const filteredSuggestions = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    return suggestions
      .filter((suggestion) => {
        if (!query) return true;
        return `${suggestion.token} ${suggestion.label} ${suggestion.detail ?? ""}`
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 6);
  }, [mentionQuery, suggestions]);

  const togglePanel = useCallback(
    (panel: Exclude<ComposerPanel, null>) => {
      const next = activePanel === panel ? null : panel;
      setActivePanel(next);
      if (next !== "formatting") {
        setLinkOpen(false);
        setLinkError(null);
      }
    },
    [activePanel],
  );

  const applyLink = useCallback(() => {
    const normalized = normalizeExternalChatLink(linkUrl);
    if (!normalized) {
      setLinkError("Enter a valid http or https link.");
      return;
    }
    if (selection.end > selection.start) {
      inputRef.current?.setLink(normalized);
    } else {
      inputRef.current?.insertLink(linkText.trim() || normalized, normalized);
    }
    setLinkOpen(false);
    setLinkText("");
    setLinkUrl("");
    setLinkError(null);
    inputRef.current?.focus();
  }, [linkText, linkUrl, selection.end, selection.start]);

  return (
    <View style={{ minWidth: 0, width: "100%", gap: spacing.xs }}>
      {mentionOpen ? (
        <View
          accessibilityRole="menu"
          style={{
            overflow: "hidden",
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: color("border"),
            backgroundColor: color("card"),
          }}
        >
          {filteredSuggestions.length ? (
            filteredSuggestions.map((suggestion) => (
              <PressableScale
                key={suggestion.token}
                accessibilityRole="menuitem"
                accessibilityLabel={`Mention ${suggestion.label}`}
                haptic={false}
                onPressIn={() => inputRef.current?.focus()}
                onPress={() => {
                  const insertion = mentionInsertion(suggestion);
                  inputRef.current?.insertMention(
                    insertion.text,
                    insertion.url,
                  );
                  setMentionOpen(false);
                  setMentionQuery("");
                }}
                style={{
                  minHeight: 48,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                }}
              >
                <Txt
                  variant="label"
                  tone="primary"
                  style={{ fontWeight: "800" }}
                >
                  {suggestion.displayText}
                </Txt>
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Txt variant="label" numberOfLines={1}>
                    {suggestion.label}
                  </Txt>
                  {suggestion.detail ? (
                    <Txt variant="caption" tone="muted" numberOfLines={1}>
                      {suggestion.detail}
                    </Txt>
                  ) : null}
                </View>
              </PressableScale>
            ))
          ) : (
            <View
              style={{
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: spacing.md,
              }}
            >
              <Txt variant="caption" tone="muted">
                No matching people or groups
              </Txt>
            </View>
          )}
        </View>
      ) : null}

      <View
        style={{
          width: "100%",
          overflow: "hidden",
          borderRadius: radii.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor:
            focused || activePanel ? color("primary") : color("border"),
          backgroundColor: color("card"),
        }}
      >
        <View
          style={{
            minWidth: 0,
            minHeight: 46,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 2,
          }}
        >
          {toolbarActions ? (
            <CompactControl
              icon={Plus}
              label={
                activePanel === "tools"
                  ? "Hide message tools"
                  : "Add to message"
              }
              active={activePanel === "tools"}
              disabled={!editable}
              onPress={() => togglePanel("tools")}
            />
          ) : null}
          {!toolbarActions ? (
            <CompactControl
              icon={ALargeSmall}
              label={
                activePanel === "formatting"
                  ? "Hide formatting"
                  : "Show formatting"
              }
              active={activePanel === "formatting"}
              disabled={!editable}
              onPress={() => togglePanel("formatting")}
            />
          ) : null}
          <EnrichedMarkdownTextInput
            ref={inputRef}
            nativeID={nativeID}
            accessibilityLabel={accessibilityLabel}
            defaultValue={nativeMarkdownRef.current}
            placeholder={placeholder}
            placeholderTextColor={color("mutedForeground")}
            editable={editable}
            multiline
            scrollEnabled
            cursorColor={color("primary")}
            selectionColor={color("secondary")}
            mentionIndicators={["@"]}
            linkRegex={/https?:\/\/[^\s]+/i}
            formatMenuConfig={{
              bold: { enabled: true },
              italic: { enabled: true },
              underline: { enabled: true },
              // The native edit menu cannot constrain URI schemes. Keep links on
              // our validated toolbar so only http(s) URLs enter the document.
              link: { enabled: false },
              strikethrough: { enabled: false },
              spoiler: { enabled: false },
            }}
            markdownStyle={{
              strong: { color: color("foreground") },
              em: { color: color("foreground") },
              link: { color: color("primary"), underline: true },
              linkVariants: {
                "^user:": {
                  color: color("primary"),
                  backgroundColor: color("secondary"),
                  underline: false,
                },
              },
            }}
            onChangeText={(nextPlainText) => {
              nativePlainTextRef.current = nextPlainText;
              emitChange(nextPlainText, nativeMarkdownRef.current);
            }}
            onChangeMarkdown={(nextMarkdown) => {
              const sanitized = sanitizeChatMarkdown(nextMarkdown);
              nativeMarkdownRef.current = sanitized;
              emitChange(nativePlainTextRef.current, sanitized);
            }}
            onChangeSelection={setSelection}
            onChangeState={setStyleState}
            onStartMention={() => {
              onMentionIntent?.();
              setMentionOpen(true);
              setMentionQuery("");
            }}
            onChangeMention={({ text }) => {
              setMentionOpen(true);
              setMentionQuery(text);
            }}
            onEndMention={() => {
              setMentionOpen(false);
              setMentionQuery("");
            }}
            onFocus={() => {
              setFocused(true);
              onMentionIntent?.();
            }}
            onBlur={() => setFocused(false)}
            style={{
              minWidth: 0,
              flex: 1,
              minHeight: 44,
              maxHeight: 112,
              borderWidth: 0,
              backgroundColor: "transparent",
              color: color("foreground"),
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.sm,
              fontSize: 15,
              lineHeight: 21,
            }}
          />
          {toolbarTrailing}
        </View>

        {activePanel === "tools" && toolbarActions ? (
          <View
            accessibilityLabel="Message tools"
            style={{
              minHeight: 48,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: color("border"),
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <ComposerToolButton
              icon={ALargeSmall}
              label="Format"
              disabled={!editable}
              onPress={() => togglePanel("formatting")}
            />
            {toolbarActions}
          </View>
        ) : null}

        {activePanel === "formatting" ? (
          <ScrollView
            horizontal
            bounces={false}
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: color("border"),
            }}
            contentContainerStyle={{
              minHeight: 44,
              alignItems: "center",
              gap: 2,
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.xs,
            }}
          >
            <FormatButton
              icon={Bold}
              label="Bold"
              active={!!styleState?.bold.isActive}
              disabled={!editable}
              onPress={() => inputRef.current?.toggleBold()}
            />
            <FormatButton
              icon={Italic}
              label="Italic"
              active={!!styleState?.italic.isActive}
              disabled={!editable}
              onPress={() => inputRef.current?.toggleItalic()}
            />
            <FormatButton
              icon={Underline}
              label="Underline"
              active={!!styleState?.underline.isActive}
              disabled={!editable}
              onPress={() => inputRef.current?.toggleUnderline()}
            />
            <FormatButton
              icon={Link2}
              label={styleState?.link.isActive ? "Remove link" : "Add link"}
              active={!!styleState?.link.isActive || linkOpen}
              disabled={!editable}
              onPress={() => {
                if (styleState?.link.isActive) {
                  inputRef.current?.removeLink();
                } else {
                  setLinkOpen((open) => !open);
                  setLinkError(null);
                }
              }}
            />
            <FormatButton
              icon={AtSign}
              label="Mention someone"
              active={mentionOpen}
              disabled={!editable || suggestions.length === 0}
              onPress={() => {
                inputRef.current?.focus();
                inputRef.current?.startMention("@");
              }}
            />
          </ScrollView>
        ) : null}
      </View>

      {linkOpen ? (
        <View style={{ gap: spacing.xs }}>
          {selection.end === selection.start ? (
            <TextField
              accessibilityLabel="Link text"
              placeholder="Link text"
              value={linkText}
              onChangeText={setLinkText}
              autoCapitalize="sentences"
            />
          ) : null}
          <TextField
            accessibilityLabel="Link URL"
            placeholder="https://example.com"
            value={linkUrl}
            onChangeText={(value) => {
              setLinkUrl(value);
              setLinkError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {linkError ? (
            <Txt variant="caption" tone="destructive">
              {linkError}
            </Txt>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: spacing.sm,
            }}
          >
            <IconButton
              icon={X}
              label="Cancel link"
              size="sm"
              variant="ghost"
              onPress={() => setLinkOpen(false)}
            />
            <Button title="Apply link" size="sm" onPress={applyLink} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ComposerToolButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      disabled={disabled}
      haptic={false}
      onPress={onPress}
      style={{
        minHeight: 40,
        borderRadius: radii.sm,
        backgroundColor: color("muted"),
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon size={17} color={color("foreground")} strokeWidth={2} />
      <Txt variant="label" numberOfLines={1}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function CompactControl({
  icon: Icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ expanded: active, disabled }}
      disabled={disabled}
      haptic={false}
      hitSlop={4}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? color("secondary") : "transparent",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon
        size={18}
        color={active ? color("primary") : color("mutedForeground")}
        strokeWidth={2.1}
      />
    </PressableScale>
  );
}

function FormatButton({
  icon: Icon,
  label,
  active,
  disabled,
  onPress,
}: {
  icon: typeof Bold;
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      haptic={false}
      hitSlop={4}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? color("secondary") : "transparent",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon
        size={17}
        color={active ? color("primary") : color("mutedForeground")}
        strokeWidth={2.2}
      />
    </PressableScale>
  );
}
