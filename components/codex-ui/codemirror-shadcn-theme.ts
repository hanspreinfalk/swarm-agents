import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror 6 theme driven by shadcn CSS variables (:root / .dark).
 * Neutral foreground/muted/destructive — no separate “IDE blue” palette.
 */
const shadcnHighlight = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.operatorKeyword,
    ],
    color: "var(--foreground)",
    fontWeight: "600",
  },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  {
    tag: [t.string, t.docString, t.literal, t.regexp],
    color: "var(--muted-foreground)",
  },
  {
    tag: [t.number, t.bool, t.null, t.atom],
    color: "var(--muted-foreground)",
    fontWeight: "500",
  },
  {
    tag: [t.variableName, t.name, t.propertyName],
    color: "var(--foreground)",
  },
  {
    tag: [t.definition(t.variableName), t.function(t.variableName)],
    color: "var(--foreground)",
    fontWeight: "500",
  },
  {
    tag: [
      t.typeName,
      t.namespace,
      t.className,
      t.definition(t.typeName),
      t.tagName,
    ],
    color: "var(--foreground)",
    fontWeight: "500",
  },
  {
    tag: [t.attributeName, t.attributeValue],
    color: "var(--muted-foreground)",
    fontWeight: "500",
  },
  { tag: t.self, color: "var(--muted-foreground)", fontWeight: "600" },
  {
    tag: [t.operator, t.bracket, t.punctuation, t.derefOperator],
    color: "var(--muted-foreground)",
  },
  { tag: t.compareOperator, color: "var(--foreground)" },
  { tag: t.meta, color: "var(--muted-foreground)" },
  {
    tag: t.link,
    color: "var(--foreground)",
    textDecoration: "underline",
  },
  { tag: t.invalid, color: "var(--destructive)" },
]);

const shadcnChrome = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
      caretColor: "var(--foreground)",
    },
    ".cm-scroller": {
      overflow: "auto",
      lineHeight: "1.6",
      backgroundColor: "var(--background)",
    },
    ".cm-content": {
      padding: "12px 0",
      caretColor: "var(--foreground)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--foreground)",
    },
    ".cm-selectionBackground": {
      background: "color-mix(in oklch, var(--ring) 32%, transparent) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      background: "color-mix(in oklch, var(--ring) 40%, transparent) !important",
    },
    ".cm-gutters": {
      backgroundColor: "var(--muted)",
      color: "var(--muted-foreground)",
      border: "none",
      borderRight: "1px solid var(--border)",
      minWidth: "40px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "color-mix(in oklch, var(--accent) 40%, var(--muted))",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--accent) 16%, transparent)",
    },
    ".cm-focused": {
      outline: "none",
    },
    ".cm-matchingBracket, .cm-matchingBracket:hover": {
      backgroundColor: "color-mix(in oklch, var(--accent) 45%, transparent)",
      outline: "1px solid var(--border)",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "color-mix(in oklch, var(--destructive) 18%, transparent)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--muted)",
      color: "var(--muted-foreground)",
      border: "1px solid var(--border)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
  }
);

export function shadcnCodemirrorTheme(): Extension[] {
  return [shadcnChrome, syntaxHighlighting(shadcnHighlight)];
}
