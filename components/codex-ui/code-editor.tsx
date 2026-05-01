"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import CodeMirror, { type Extension } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { shadcnCodemirrorTheme } from "./codemirror-shadcn-theme";

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
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const extensions = useMemo<Extension[]>(() => {
    const isDark = mounted && resolvedTheme === "dark";
    const exts: Extension[] = [
      EditorView.darkTheme.of(isDark),
      ...shadcnCodemirrorTheme(),
    ];
    if (language === "python") {
      exts.push(python());
    } else {
      exts.push(
        javascript({ jsx: true, typescript: language === "typescript" })
      );
    }
    return exts;
  }, [language, mounted, resolvedTheme]);

  return (
    <CodeMirror
      value={value}
      theme="none"
      extensions={extensions}
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
