"use client";

import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree";

interface FileExplorerProps {
  activeFile: string;
  onSelectFile: (path: string) => void;
}

export function FileExplorer({ activeFile, onSelectFile }: FileExplorerProps) {
  return (
    <div
      className="border-r border-border bg-sidebar"
      style={{
        display: "grid",
        gridTemplateRows: "2.25rem 1fr",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="flex items-center border-b border-border px-3">
        <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Explorer
        </span>
      </div>

      {/* Scrollable tree — 1fr row has definite height so overflow-y works */}
      <div style={{ overflow: "auto" }}>
        <FileTree
          className="rounded-none border-none bg-transparent font-sans text-[12px]"
          selectedPath={activeFile}
          onSelect={onSelectFile}
          defaultExpanded={new Set(["src", "tools"])}
        >
          <FileTreeFolder path="src" name="src">
            <FileTreeFile path="src/hero.tsx" name="hero.tsx" />
            <FileTreeFile path="src/App.tsx" name="App.tsx" />
            <FileTreeFolder path="src/components" name="components">
              <FileTreeFile
                path="src/components/Header.tsx"
                name="Header.tsx"
              />
              <FileTreeFile
                path="src/components/Footer.tsx"
                name="Footer.tsx"
              />
              <FileTreeFile
                path="src/components/HeroBullets.tsx"
                name="HeroBullets.tsx"
              />
            </FileTreeFolder>
          </FileTreeFolder>

          <FileTreeFolder path="tools" name="tools">
            <FileTreeFile path="tools/build.py" name="build.py" />
            <FileTreeFile path="tools/deploy.py" name="deploy.py" />
          </FileTreeFolder>

          <FileTreeFile path="tsconfig.json" name="tsconfig.json" />
          <FileTreeFile path="package.json" name="package.json" />
        </FileTree>
      </div>
    </div>
  );
}
