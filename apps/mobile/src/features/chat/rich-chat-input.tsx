import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ScrollView, View } from "react-native";
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "react-native-enriched-markdown";
import { AtSign, Bold, Italic, Link2, Underline, X } from "lucide-react-native";
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

export type ChatMentionSuggestion = {
  token: string;
  label: string;
  detail?: string;
};

type RichChatInputProps = {
  accessibilityLabel: string;
  placeholder: string;
  plainText: string;
  markdown: string;
  editable: boolean;
  nativeID?: string;
  suggestions: ChatMentionSuggestion[];
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
    <View style={{ minWidth: 0, flex: 1, gap: spacing.xs }}>
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
                accessibilityLabel={`Mention ${suggestion.label}, @${suggestion.token}`}
                haptic={false}
                onPress={() => {
                  inputRef.current?.insertMention(
                    `@${suggestion.token}`,
                    `user://${suggestion.token}`,
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
                  @{suggestion.token}
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
        style={{
          minHeight: 48,
          maxHeight: 140,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: color("border"),
          backgroundColor: color("background"),
          color: color("foreground"),
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          fontSize: 15,
          lineHeight: 21,
        }}
      />

      <View style={{ minWidth: 0, flexDirection: "row", alignItems: "center" }}>
        <ScrollView
          horizontal
          bounces={false}
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          style={{ minWidth: 0, flex: 1 }}
          contentContainerStyle={{ alignItems: "center", gap: 2 }}
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
          {toolbarActions}
        </ScrollView>
        {toolbarTrailing ? (
          <View style={{ marginLeft: spacing.xs }}>{toolbarTrailing}</View>
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
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
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
