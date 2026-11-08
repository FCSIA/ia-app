// Semantic styling roles. Commands never write raw ANSI; they ask for a role.
// Wording carries meaning, so stripping every style must leave the same text.

type Style = readonly [open: number, close: number];

const STYLES = {
  bold: [1, 22],
  faint: [2, 22],
  underline: [4, 24],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  magenta: [35, 39],
  cyan: [36, 39],
} as const satisfies Record<string, Style>;

export interface Glyphs {
  success: string;
  warning: string;
  error: string;
  prompt: string;
  ellipsis: string;
}

const RICH_GLYPHS: Glyphs = {
  success: "✓",
  warning: "!",
  error: "✗",
  prompt: "?",
  ellipsis: "…",
};

const PLAIN_GLYPHS: Glyphs = {
  success: "",
  warning: "Warning:",
  error: "Error:",
  prompt: "?",
  ellipsis: "...",
};

export interface Theme {
  color: boolean;
  rich: boolean;
  glyphs: Glyphs;
  bold(text: string): string;
  faint(text: string): string;
  underline(text: string): string;
  success(text: string): string;
  warning(text: string): string;
  error(text: string): string;
  heading(text: string): string;
  command(text: string): string;
}

export function createTheme(color: boolean, rich: boolean): Theme {
  const paint =
    (...styles: Style[]) =>
    (text: string) => {
      if (!color || text === "") return text;
      return styles.reduceRight(
        (inner, [open, close]) => `\u001b[${open}m${inner}\u001b[${close}m`,
        text,
      );
    };

  return {
    color,
    rich,
    glyphs: rich ? RICH_GLYPHS : PLAIN_GLYPHS,
    bold: paint(STYLES.bold),
    faint: paint(STYLES.faint),
    underline: paint(STYLES.underline),
    success: paint(STYLES.green),
    warning: paint(STYLES.yellow),
    error: paint(STYLES.red),
    heading: paint(STYLES.bold, STYLES.magenta),
    command: paint(STYLES.cyan),
  };
}

// Display width ignoring ANSI sequences. Wide characters count as one column,
// which holds for the ASCII and box glyphs this CLI prints.
export function visibleLength(text: string) {
  return text.replace(/\u001b\[[0-9;]*m/g, "").length;
}

// Remote text is data. Strip terminal control sequences and other control
// characters so a message body cannot move the cursor or restyle the terminal.
export function sanitizeRemoteText(text: string) {
  return text
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}
