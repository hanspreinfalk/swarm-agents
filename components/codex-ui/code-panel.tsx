"use client";

import {
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import {
  Terminal,
  TerminalActions,
  TerminalClearButton,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from "@/components/ai-elements/terminal";
import { CheckIcon, ExternalLinkIcon, FileIcon, RefreshCwIcon, TerminalIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { CodeEditor } from "./code-editor";
import { FileExplorer } from "./file-explorer";
import type { CodeFile } from "./types";

const DIFF_STATS: Record<string, { added: number; removed: number }> = {
  "src/hero.tsx": { added: 8, removed: 5 },
  "tools/build.py": { added: 1, removed: 1 },
};

interface CodePanelProps {
  activeFile: string;
  codeFiles: Record<string, CodeFile>;
  emptyFolders: Set<string>;
  onSelectFile: (file: string) => void;
  onCodeFileChange: (path: string, content: string) => void;
  onAddFile: (parentDir: string, name: string) => boolean;
  onAddFolder: (parentDir: string, name: string) => boolean;
  onDeletePath: (path: string, kind: "file" | "folder") => void;
  onRenamePath: (path: string, newBaseName: string, kind: "file" | "folder") => boolean;
  previewUrl: string | null;
  previewError: string | null;
  isPreviewLoading: boolean;
  previewStage: string;
  previewStatusMessage: string;
  previewFilesProcessed: number;
  previewFilesTotal: number;
  previewTerminalBuffer: string;
  onClearPreviewTerminal: () => void;
  onRequestPreview: () => void;
}

export function CodePanel({
  activeFile,
  codeFiles,
  emptyFolders,
  onSelectFile,
  onCodeFileChange,
  onAddFile,
  onAddFolder,
  onDeletePath,
  onRenamePath,
  previewUrl,
  previewError,
  isPreviewLoading,
  previewStage,
  previewStatusMessage,
  previewFilesProcessed,
  previewFilesTotal,
  previewTerminalBuffer,
  onClearPreviewTerminal,
  onRequestPreview,
}: CodePanelProps) {
  const currentFile = activeFile ? codeFiles[activeFile] : undefined;
  const stats = activeFile ? DIFF_STATS[activeFile] : undefined;
  const [fileTreeWidth, setFileTreeWidth] = useState(220);
  const [view, setView] = useState<"code" | "preview">("code");
  const [showTerminal, setShowTerminal] = useState(false);
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

  const handleOpenPreview = useCallback(() => {
    setView("preview");
    onRequestPreview();
  }, [onRequestPreview]);

  return (
    /*
     * Outer shell — already fills its Panel via the absolute wrapper in codex-app.
     * Grid gives a fixed top-bar row and a 1fr body row.
     */
    <div className="grid h-full w-full grid-rows-[2.5rem_1fr] overflow-hidden bg-background">
      {/* ── Top bar (2.5rem) ────────────────────────────── */}
      <div
        className="flex items-center justify-between border-b border-border px-3"
        style={{ overflow: "hidden" }}
      >
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium text-foreground">2 files changed</span>
          <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-inset ring-green-500/25 dark:text-green-300 dark:ring-green-400/30">
            +9
          </span>
          <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[11px] font-semibold text-destructive ring-1 ring-inset ring-destructive/25">
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
          <button
            type="button"
            aria-label={showTerminal ? "Hide terminal" : "Show terminal"}
            onClick={() => setShowTerminal((v) => !v)}
            className={[
              "rounded-md p-1.5 transition-colors",
              showTerminal
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <TerminalIcon size={14} />
          </button>
          <button
            type="button"
            aria-label="Refresh sandbox preview"
            onClick={onRequestPreview}
            disabled={isPreviewLoading}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCwIcon
              size={14}
              className={isPreviewLoading ? "animate-spin" : ""}
            />
          </button>
          <div className="flex rounded-md bg-muted p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setView("code")}
              className={[
                "rounded px-2 py-1 font-medium transition-colors",
                view === "code"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Code
            </button>
            <button
              type="button"
              onClick={handleOpenPreview}
              className={[
                "rounded px-2 py-1 font-medium transition-colors",
                view === "preview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* ── Body (1fr): flex-column so terminal docks at the bottom ── */}
      <div
        ref={bodyRef}
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* ── Main content area (code editor OR preview) ── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            ...(view === "code"
              ? {
                  display: "grid",
                  gridTemplateColumns: `${fileTreeWidth}px 7px minmax(0, 1fr)`,
                }
              : { display: "block" }),
          }}
        >
        {view === "code" ? (
          <>
            {/* ── File tree ───────────────────────────────────── */}
            <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
              <FileExplorer
                activeFile={activeFile}
                codeFiles={codeFiles}
                emptyFolders={emptyFolders}
                onSelectFile={onSelectFile}
                onAddFile={onAddFile}
                onAddFolder={onAddFolder}
                onDeletePath={onDeletePath}
                onRenamePath={onRenamePath}
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
                      onChange={(next) => onCodeFileChange(activeFile, next)}
                      readOnly={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-muted-foreground">
                      {activeFile
                        ? "This path is a folder. Select a file to edit."
                        : "Select a file to view or create one from the explorer."}
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
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              <WebPreview
                key={previewUrl ?? "preview-empty"}
                defaultUrl={previewUrl ?? ""}
                className="min-h-0 rounded-none border-0"
              >
                <WebPreviewNavigation className="shrink-0 bg-muted/20 px-3 py-2">
                  <WebPreviewNavigationButton
                    tooltip="Refresh preview"
                    onClick={onRequestPreview}
                    disabled={isPreviewLoading}
                  >
                    ↻
                  </WebPreviewNavigationButton>
                  <WebPreviewUrl className="h-8 text-[12px]" />
                  {previewUrl && (
                    <WebPreviewNavigationButton
                      tooltip="Open in new tab"
                      onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLinkIcon size={12} />
                    </WebPreviewNavigationButton>
                  )}
                </WebPreviewNavigation>

                {/* Always keep the iframe mounted when we have a URL so the
                    preview stays visible during refreshes and after errors. */}
                <div
                  className="relative min-h-0 flex-1 overflow-hidden"
                  style={{ display: "flex", flexDirection: "column" }}
                >
                  {previewUrl ? (
                    <WebPreviewBody className="border-0 bg-background" />
                  ) : null}

                  {/* Loading overlay — semi-transparent so user sees prior content */}
                  {isPreviewLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 px-6 text-center text-[13px] text-muted-foreground backdrop-blur-sm">
                      <p>{previewStatusMessage || "Starting E2B sandbox preview..."}</p>
                      <p className="font-mono text-[11px]">
                        Stage: {previewStage}
                        {previewFilesTotal > 0
                          ? ` · Files ${previewFilesProcessed}/${previewFilesTotal}`
                          : ""}
                      </p>
                    </div>
                  ) : previewError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center backdrop-blur-sm">
                      <p className="text-[13px] text-destructive">{previewError}</p>
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-primary underline underline-offset-2"
                        >
                          Open sandbox URL in new tab
                        </a>
                      )}
                    </div>
                  ) : !previewUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
                      Open Preview to run this project in E2B.
                    </div>
                  ) : null}
                </div>
              </WebPreview>
            </div>
          </div>
        )}
        </div>

        {/* ── Terminal panel — shown in both views when toggle is on ── */}
        {showTerminal && (
          <Terminal
            output={previewTerminalBuffer}
            isStreaming={isPreviewLoading}
            onClear={onClearPreviewTerminal}
            className="shrink-0 rounded-none border-x-0 border-b-0"
            style={{ height: 200 }}
          >
            <TerminalHeader className="px-3 py-2">
              <TerminalTitle className="text-[12px]">E2B sandbox terminal</TerminalTitle>
              <div className="flex items-center gap-1">
                <TerminalStatus className="text-[11px]">
                  {previewStage}
                </TerminalStatus>
                <TerminalActions>
                  <TerminalCopyButton />
                  <TerminalClearButton />
                </TerminalActions>
              </div>
            </TerminalHeader>
            <TerminalContent className="max-h-none min-h-0 flex-1 overflow-auto p-3 text-[12px]" />
          </Terminal>
        )}
      </div>
    </div>
  );
}
