import { useMemo } from "react";
import { Linking } from "react-native";
import {
  EnrichedMarkdownText,
  type MarkdownStyle,
} from "react-native-enriched-markdown";
import { Txt, useToast } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { classifyChatLink, sanitizeChatMarkdown } from "./chat-markdown";

type RichMessageBodyProps = {
  body: string;
  bodyMarkdown?: string;
};

export function RichMessageBody({ body, bodyMarkdown }: RichMessageBodyProps) {
  const { color } = useTheme();
  const { showToast } = useToast();
  const markdown = useMemo(
    () => sanitizeChatMarkdown(bodyMarkdown?.trim() || ""),
    [bodyMarkdown],
  );
  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      paragraph: {
        color: color("foreground"),
        fontSize: 15,
        lineHeight: 21,
        marginTop: 0,
        marginBottom: 0,
      },
      strong: { color: color("foreground") },
      em: { color: color("foreground") },
      underline: { color: color("foreground") },
      link: { color: color("primary"), underline: true },
      linkVariants: {
        "^user:": {
          color: color("primary"),
          backgroundColor: color("secondary"),
          underline: false,
        },
      },
      blockquote: {
        color: color("mutedForeground"),
        borderColor: color("border"),
        borderWidth: 2,
        gapWidth: 10,
        marginTop: 4,
        marginBottom: 4,
      },
      code: {
        color: color("foreground"),
        backgroundColor: color("muted"),
        borderColor: color("border"),
        fontSize: 14,
      },
      codeBlock: {
        color: color("foreground"),
        backgroundColor: color("muted"),
        borderColor: color("border"),
        borderRadius: 10,
        borderWidth: 1,
        padding: 10,
        marginTop: 4,
        marginBottom: 4,
      },
      list: {
        color: color("foreground"),
        fontSize: 15,
        lineHeight: 21,
        markerColor: color("mutedForeground"),
        bulletColor: color("mutedForeground"),
        marginTop: 2,
        marginBottom: 2,
      },
    }),
    [color],
  );
  const canRenderAsPlainText = !markdown || markdown === body.trim();

  if (canRenderAsPlainText) {
    return body ? (
      <Txt
        selectable
        style={{ fontSize: 15, fontWeight: "500", lineHeight: 21 }}
      >
        {body}
      </Txt>
    ) : null;
  }

  return (
    <EnrichedMarkdownText
      markdown={markdown}
      flavor="github"
      selectable
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      enableLinkPreview={false}
      containerStyle={{ width: "100%", alignSelf: "stretch" }}
      md4cFlags={{
        underline: true,
        superscript: false,
        subscript: false,
        highlight: false,
        latexMath: false,
      }}
      markdownStyle={markdownStyle}
      selectionColor={color("secondary")}
      onLinkPress={({ url }) => {
        const link = classifyChatLink(url);
        if (!link || link.kind === "mention") return;
        Linking.openURL(link.url).catch(() => {
          showToast({ title: "Link couldn’t be opened", tone: "warning" });
        });
      }}
    />
  );
}
