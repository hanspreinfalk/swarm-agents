"use client";

import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { CheckIcon, FileIcon, TerminalIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { CodeEditor } from "./code-editor";
import { CODE_FILES } from "./data";
import { FileExplorer } from "./file-explorer";

const DIFF_STATS: Record<string, { added: number; removed: number }> = {
  "src/hero.tsx": { added: 8, removed: 5 },
  "tools/build.py": { added: 1, removed: 1 },
};

interface CodePanelProps {
  activeFile: string;
  isTerminalVisible: boolean;
  onSelectFile: (file: string) => void;
  onToggleTerminal: () => void;
}

export function CodePanel({
  activeFile,
  isTerminalVisible,
  onSelectFile,
  onToggleTerminal,
}: CodePanelProps) {
  const currentFile = CODE_FILES[activeFile];
  const stats = DIFF_STATS[activeFile];
  const [fileTreeWidth, setFileTreeWidth] = useState(220);
  const [view, setView] = useState<"code" | "preview">("code");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const body = bodyRef.current;
      if (!body) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startWidth = fileTreeWidth;
      const containerWidth = body.getBoundingClientRect().width;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + moveEvent.clientX - startX;
        const maxWidth = Math.max(160, containerWidth - 320);
        setFileTreeWidth(Math.min(Math.max(nextWidth, 150), maxWidth));
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [fileTreeWidth]
  );

  return (
    /*
     * Outer shell — already fills its Panel via the absolute wrapper in codex-app.
     * Grid gives a fixed top-bar row and a 1fr body row.
     */
    <div
      style={{
        display: "grid",
        gridTemplateRows: "2.5rem 1fr",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "white",
      }}
    >
      {/* ── Top bar (2.5rem) ────────────────────────────── */}
      <div
        className="flex items-center justify-between border-b border-border px-3"
        style={{ overflow: "hidden" }}
      >
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium text-foreground">2 files changed</span>
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-600 ring-1 ring-inset ring-green-200">
            +9
          </span>
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-500 ring-1 ring-inset ring-red-200">
            -6
          </span>
          <button
            type="button"
            aria-label="Reject changes"
            className="ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
          >
            <XIcon size={13} />
          </button>
          <button
            type="button"
            aria-label="Accept changes"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-green-600"
          >
            <CheckIcon size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md bg-muted p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setView("code")}
              className={[
                "rounded px-2 py-1 font-medium transition-colors",
                view === "code"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              className={[
                "rounded px-2 py-1 font-medium transition-colors",
                view === "preview"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            aria-pressed={isTerminalVisible}
            onClick={onToggleTerminal}
            className={[
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium ring-1 ring-border transition-colors",
              isTerminalVisible
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <TerminalIcon size={12} />
            Terminal
          </button>
        </div>
      </div>

      {/* ── Body (1fr): explicit grid prevents editor/file-tree overlap ── */}
      <div
        ref={bodyRef}
        style={{
          display: view === "code" ? "grid" : "block",
          gridTemplateColumns:
            view === "code" ? `${fileTreeWidth}px 7px minmax(0, 1fr)` : undefined,
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {view === "code" ? (
          <>
            {/* ── File tree ───────────────────────────────────── */}
            <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
              <FileExplorer
                activeFile={activeFile}
                onSelectFile={onSelectFile}
              />
            </div>

            {/* ── Splitter ────────────────────────────────────── */}
            <button
              type="button"
              aria-label="Resize file explorer"
              onPointerDown={handleResizeStart}
              className="group relative cursor-col-resize bg-border/80 outline-none transition-colors hover:bg-border focus-visible:bg-border"
            >
              <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/40" />
            </button>

            {/* ── Editor ──────────────────────────────────────── */}
            <div
              style={{
                minWidth: 0,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Breadcrumb */}
              <div
                className="flex shrink-0 items-center gap-1.5 border-b border-border bg-muted/20 px-3"
                style={{ height: "2rem" }}
              >
                <FileIcon
                  size={11}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                  {activeFile}
                </span>
                {stats && (
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <span className="text-[10px] font-semibold text-green-600">
                      +{stats.added}
                    </span>
                    <span className="text-[10px] font-semibold text-red-500">
                      -{stats.removed}
                    </span>
                  </span>
                )}
              </div>

              {/* CodeMirror — flex-1 then absolute-fill for guaranteed height */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", inset: 0 }}>
                  {currentFile ? (
                    <CodeEditor
                      key={activeFile}
                      value={currentFile.content}
                      language={currentFile.language}
                      readOnly
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                      Select a file to view
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              height: "100%",
              overflow: "hidden",
            }}
          >
            <WebPreview
              defaultUrl="https://example.com"
              className="min-h-0 rounded-none border-0"
            >
              <WebPreviewNavigation className="shrink-0 bg-muted/20 px-3 py-2">
                <WebPreviewNavigationButton tooltip="Refresh preview">
                  ↻
                </WebPreviewNavigationButton>
                <WebPreviewUrl className="h-8 text-[12px]" />
              </WebPreviewNavigation>
              <WebPreviewBody className="border-0 bg-white" />
            </WebPreview>
          </div>
        )}
      </div>
    </div>
  );
}
