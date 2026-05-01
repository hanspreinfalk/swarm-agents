import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

/**
 * CodeMirror 6 theme driven by shadcn CSS variables for chrome, with
 * Cursor/VS Code-like syntax colors layered in through local CSS variables.
 */
const shadcnHighlight = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.operatorKeyword,
    ],
    color: "var(--cm-keyword)",
    fontWeight: "600",
  },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "var(--cm-comment)",
    fontStyle: "italic",
  },
  {
    tag: [t.string, t.docString],
    color: "var(--cm-string)",
  },
  {
    tag: [t.regexp, t.escape],
    color: "var(--cm-regexp)",
  },
  {
    tag: [t.number, t.bool, t.null, t.atom],
    color: "var(--cm-constant)",
    fontWeight: "500",
  },
  {
    tag: [t.variableName, t.name],
    color: "var(--cm-variable)",
  },
  {
    tag: t.propertyName,
    color: "var(--cm-property)",
  },
  {
    tag: [t.definition(t.variableName), t.function(t.variableName)],
    color: "var(--cm-function)",
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
    color: "var(--cm-type)",
    fontWeight: "500",
  },
  {
    tag: t.attributeName,
    color: "var(--cm-attribute)",
    fontWeight: "500",
  },
  {
    tag: t.attributeValue,
    color: "var(--cm-string)",
  },
  { tag: t.self, color: "var(--cm-variable)", fontWeight: "600" },
  {
    tag: [t.operator, t.bracket, t.punctuation, t.derefOperator],
    color: "var(--cm-punctuation)",
  },
  { tag: t.compareOperator, color: "var(--cm-operator)" },
  { tag: t.meta, color: "var(--cm-meta)" },
  {
    tag: t.link,
    color: "var(--cm-link)",
    textDecoration: "underline",
  },
  { tag: t.invalid, color: "var(--destructive)" },
]);

const shadcnChrome = EditorView.theme(
  {
    "&": {
      "--cm-keyword": "#0000ff",
      "--cm-comment": "#008000",
      "--cm-string": "#a31515",
      "--cm-regexp": "#811f3f",
      "--cm-constant": "#098658",
      "--cm-variable": "#001080",
      "--cm-property": "#001080",
      "--cm-function": "#795e26",
      "--cm-type": "#267f99",
      "--cm-attribute": "#800000",
      "--cm-punctuation": "#393a34",
      "--cm-operator": "#000000",
      "--cm-meta": "#af00db",
      "--cm-link": "#0000ff",
      height: "100%",
      fontSize: "13px",
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      backgroundColor: "var(--background)",
      color: "var(--foreground)",
      caretColor: "var(--foreground)",
    },
    ".dark &": {
      "--cm-keyword": "#c586c0",
      "--cm-comment": "#6a9955",
      "--cm-string": "#ce9178",
      "--cm-regexp": "#d16969",
      "--cm-constant": "#b5cea8",
      "--cm-variable": "#9cdcfe",
      "--cm-property": "#9cdcfe",
      "--cm-function": "#dcdcaa",
      "--cm-type": "#4ec9b0",
      "--cm-attribute": "#92c5f8",
      "--cm-punctuation": "#d4d4d4",
      "--cm-operator": "#d4d4d4",
      "--cm-meta": "#c586c0",
      "--cm-link": "#4fc1ff",
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
