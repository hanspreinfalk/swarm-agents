"use client";

import {
  FileTree,
  FileTreeIcon,
  FileTreeName,
  useFileTree,
} from "@/components/ai-elements/file-tree";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { CodeFile } from "./types";
import {
  ancestorPaths,
  buildTrie,
  sortedTrieChildren,
  type TrieNode,
} from "./virtual-file-tree";

export interface FileExplorerProps {
  activeFile: string;
  codeFiles: Record<string, CodeFile>;
  emptyFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onAddFile: (parentDir: string, name: string) => boolean;
  onAddFolder: (parentDir: string, name: string) => boolean;
  onDeletePath: (path: string, kind: "file" | "folder") => void;
  onRenamePath: (path: string, newBaseName: string, kind: "file" | "folder") => boolean;
}

type NameDialogMode = "newFile" | "newFolder" | "rename";

interface NameDialogState {
  open: boolean;
  mode: NameDialogMode;
  parentDir: string;
  targetPath: string;
  kind: "file" | "folder";
  initialValue: string;
}

const closedDialog: NameDialogState = {
  open: false,
  mode: "newFile",
  parentDir: "",
  targetPath: "",
  kind: "file",
  initialValue: "",
};

function ExplorerFolderRow({
  node,
  children,
  trailing,
  contextMenu,
}: {
  node: TrieNode;
  children: ReactNode;
  trailing: ReactNode;
  contextMenu: ReactNode;
}) {
  const { expandedPaths, togglePath, selectedPath, onSelect } = useFileTree();
  const isExpanded = expandedPaths.has(node.fullPath);
  const isSelected = selectedPath === node.fullPath;

  const handleOpenChange = useCallback(() => {
    togglePath(node.fullPath);
  }, [togglePath, node.fullPath]);

  const handleSelect = useCallback(() => {
    onSelect?.(node.fullPath);
  }, [onSelect, node.fullPath]);

  return (
    <Collapsible onOpenChange={handleOpenChange} open={isExpanded}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div role="treeitem" aria-selected={isSelected} tabIndex={0}>
            <div
              className={cn(
                "flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50",
                isSelected && "bg-muted"
              )}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="flex shrink-0 cursor-pointer items-center border-none bg-transparent p-0"
                  type="button"
                >
                  <ChevronRightIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-90"
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <button
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-left"
                onClick={handleSelect}
                type="button"
              >
                <FileTreeIcon>
                  {isExpanded ? (
                    <FolderOpenIcon className="size-4 text-blue-500" />
                  ) : (
                    <FolderIcon className="size-4 text-blue-500" />
                  )}
                </FileTreeIcon>
                <FileTreeName>{node.name}</FileTreeName>
              </button>
              {trailing}
            </div>
            <CollapsibleContent>
              <div className="ml-4 border-l pl-2">{children}</div>
            </CollapsibleContent>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{contextMenu}</ContextMenuContent>
      </ContextMenu>
    </Collapsible>
  );
}

function ExplorerFileRow({
  node,
  trailing,
  contextMenu,
}: {
  node: TrieNode;
  trailing: ReactNode;
  contextMenu: ReactNode;
}) {
  const { selectedPath, onSelect } = useFileTree();
  const isSelected = selectedPath === node.fullPath;

  const handleClick = useCallback(() => {
    onSelect?.(node.fullPath);
  }, [onSelect, node.fullPath]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-muted/50",
            isSelected && "bg-muted"
          )}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect?.(node.fullPath);
          }}
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={0}
        >
          <span className="size-4 shrink-0" />
          <FileTreeIcon>
            <FileIcon className="size-4 text-muted-foreground" />
          </FileTreeIcon>
          <FileTreeName>{node.name}</FileTreeName>
          {trailing}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>{contextMenu}</ContextMenuContent>
    </ContextMenu>
  );
}

function TrieBranch({
  node,
  onOpenDialog,
  onDeletePath,
}: {
  node: TrieNode;
  onOpenDialog: (patch: Partial<NameDialogState> & { open: true }) => void;
  onDeletePath: (path: string, kind: "file" | "folder") => void;
}) {
  const deleteFile = useCallback(() => {
    if (typeof window !== "undefined" && window.confirm(`Delete file “${node.name}”?`)) {
      onDeletePath(node.fullPath, "file");
    }
  }, [node.fullPath, node.name, onDeletePath]);

  const deleteFolder = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      window.confirm(`Delete folder “${node.name}” and everything inside it?`)
    ) {
      onDeletePath(node.fullPath, "folder");
    }
  }, [node.fullPath, node.name, onDeletePath]);

  if (node.isFile) {
    const menu = (
      <>
        <ContextMenuItem
          onSelect={() =>
            onOpenDialog({
              open: true,
              mode: "rename",
              parentDir: "",
              targetPath: node.fullPath,
              kind: "file",
              initialValue: node.name,
            })
          }
        >
          <PencilIcon className="mr-2 size-3.5" />
          Rename…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={deleteFile}>
          <Trash2Icon className="mr-2 size-3.5" />
          Delete
        </ContextMenuItem>
      </>
    );
    return (
      <ExplorerFileRow
        key={node.fullPath}
        node={node}
        trailing={<span className="ml-auto w-6 shrink-0" />}
        contextMenu={menu}
      />
    );
  }

  const folderMenu = (
    <>
      <ContextMenuItem
        onSelect={() =>
          onOpenDialog({
            open: true,
            mode: "newFile",
            parentDir: node.fullPath,
            targetPath: "",
            kind: "file",
            initialValue: "",
          })
        }
      >
        <PlusIcon className="mr-2 size-3.5" />
        New file…
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() =>
          onOpenDialog({
            open: true,
            mode: "newFolder",
            parentDir: node.fullPath,
            targetPath: "",
            kind: "folder",
            initialValue: "",
          })
        }
      >
        <FolderPlusIcon className="mr-2 size-3.5" />
        New folder…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() =>
          onOpenDialog({
            open: true,
            mode: "rename",
            parentDir: "",
            targetPath: node.fullPath,
            kind: "folder",
            initialValue: node.name,
          })
        }
      >
        <PencilIcon className="mr-2 size-3.5" />
        Rename…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={deleteFolder}>
        <Trash2Icon className="mr-2 size-3.5" />
        Delete folder…
      </ContextMenuItem>
    </>
  );

  return (
    <ExplorerFolderRow
      key={node.fullPath}
      node={node}
      trailing={<span className="ml-auto w-6 shrink-0" />}
      contextMenu={folderMenu}
    >
      {sortedTrieChildren(node.children).map((ch) => (
        <TrieBranch
          key={ch.fullPath}
          node={ch}
          onOpenDialog={onOpenDialog}
          onDeletePath={onDeletePath}
        />
      ))}
    </ExplorerFolderRow>
  );
}

function dialogTitle(mode: NameDialogMode): string {
  switch (mode) {
    case "newFile":
      return "New file";
    case "newFolder":
      return "New folder";
    default:
      return "Rename";
  }
}

export function FileExplorer({
  activeFile,
  codeFiles,
  emptyFolders,
  onSelectFile,
  onAddFile,
  onAddFolder,
  onDeletePath,
  onRenamePath,
}: FileExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState(
    () => new Set(["src", "tools", "src/components"])
  );
  const [dialog, setDialog] = useState<NameDialogState>(closedDialog);
  const [nameInput, setNameInput] = useState("");

  const filePaths = useMemo(() => Object.keys(codeFiles).sort(), [codeFiles]);

  const trie = useMemo(
    () => buildTrie(filePaths, emptyFolders),
    [filePaths, emptyFolders]
  );

  const mergedExpandedPaths = useMemo(() => {
    const s = new Set(expandedPaths);
    if (activeFile) {
      for (const a of ancestorPaths(activeFile)) {
        s.add(a);
      }
    }
    return s;
  }, [expandedPaths, activeFile]);

  const openDialog = useCallback((patch: Partial<NameDialogState> & { open: true }) => {
    setNameInput(patch.initialValue ?? "");
    setDialog((d) => ({
      ...d,
      ...patch,
      open: true,
    }));
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(closedDialog);
  }, []);

  const submitNameDialog = useCallback(() => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed.includes("/") || trimmed === "." || trimmed === "..") {
      toast.error("Enter a valid name (no slashes).");
      return;
    }
    let ok = false;
    if (dialog.mode === "newFile") {
      ok = onAddFile(dialog.parentDir, trimmed);
    } else if (dialog.mode === "newFolder") {
      ok = onAddFolder(dialog.parentDir, trimmed);
    } else if (dialog.mode === "rename") {
      ok = onRenamePath(dialog.targetPath, trimmed, dialog.kind);
    }
    if (ok) closeDialog();
  }, [closeDialog, dialog, nameInput, onAddFile, onAddFolder, onRenamePath]);

  const rootContextMenu = (
    <>
      <ContextMenuItem
        onSelect={() =>
          openDialog({
            open: true,
            mode: "newFile",
            parentDir: "",
            targetPath: "",
            kind: "file",
            initialValue: "",
          })
        }
      >
        <PlusIcon className="mr-2 size-3.5" />
        New file…
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() =>
          openDialog({
            open: true,
            mode: "newFolder",
            parentDir: "",
            targetPath: "",
            kind: "folder",
            initialValue: "",
          })
        }
      >
        <FolderPlusIcon className="mr-2 size-3.5" />
        New folder…
      </ContextMenuItem>
    </>
  );

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
      <div className="flex items-center justify-between gap-1 border-b border-border px-2">
        <span className="truncate pl-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Explorer
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label="New file or folder"
            >
              <PlusIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onSelect={() =>
                openDialog({
                  open: true,
                  mode: "newFile",
                  parentDir: "",
                  targetPath: "",
                  kind: "file",
                  initialValue: "",
                })
              }
            >
              <PlusIcon className="mr-2 size-3.5" />
              New file…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                openDialog({
                  open: true,
                  mode: "newFolder",
                  parentDir: "",
                  targetPath: "",
                  kind: "folder",
                  initialValue: "",
                })
              }
            >
              <FolderPlusIcon className="mr-2 size-3.5" />
              New folder…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div style={{ overflow: "auto" }} className="min-h-0 outline-none">
            <FileTree
              className="rounded-none border-none bg-transparent font-sans text-[12px]"
              expanded={mergedExpandedPaths}
              onExpandedChange={setExpandedPaths}
              selectedPath={activeFile}
              onSelect={onSelectFile}
            >
              {sortedTrieChildren(trie).map((node) => (
                <TrieBranch
                  key={node.fullPath}
                  node={node}
                  onOpenDialog={openDialog}
                  onDeletePath={onDeletePath}
                />
              ))}
            </FileTree>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{rootContextMenu}</ContextMenuContent>
      </ContextMenu>

      <Dialog open={dialog.open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle(dialog.mode)}</DialogTitle>
            <DialogDescription>
              {dialog.mode === "rename"
                ? "Enter a new name. Paths cannot contain slashes."
                : dialog.parentDir
                  ? `Inside “${dialog.parentDir}”. Use a single name (no slashes).`
                  : "At project root. Use a single name (no slashes)."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={dialog.mode === "newFolder" ? "folder-name" : "filename.tsx"}
            className="font-mono text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNameDialog();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="button" onClick={submitNameDialog}>
              {dialog.mode === "rename" ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
