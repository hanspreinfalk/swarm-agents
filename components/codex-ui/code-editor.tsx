"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { githubLight } from "@uiw/codemirror-theme-github";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useMemo } from "react";

const baseTheme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "1.6",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    border: "none",
    borderRight: "1px solid #eaecef",
    color: "#8b949e",
    minWidth: "40px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#f0f4f8",
  },
  ".cm-activeLine": {
    backgroundColor: "#f0f4f8",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#dbeafe !important",
  },
});

export type CodeEditorLanguage = "typescript" | "javascript" | "python";

interface CodeEditorProps {
  value: string;
  language?: CodeEditorLanguage;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  language = "typescript",
  onChange,
  readOnly = false,
}: CodeEditorProps) {
  const extensions = useMemo<Extension[]>(() => {
    const exts: Extension[] = [baseTheme];
    if (language === "python") {
      exts.push(python());
    } else {
      exts.push(
        javascript({ jsx: true, typescript: language === "typescript" })
      );
    }
    return exts;
  }, [language]);

  return (
    <CodeMirror
      value={value}
      extensions={extensions}
      theme={githubLight}
      onChange={onChange}
      readOnly={readOnly}
      height="100%"
      style={{ height: "100%", overflow: "hidden" }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        history: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        syntaxHighlighting: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        defaultKeymap: true,
        searchKeymap: true,
        historyKeymap: true,
        foldKeymap: true,
        completionKeymap: true,
        lintKeymap: true,
      }}
    />
  );
}
