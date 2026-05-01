import type { CodeEditorLanguage } from "./code-editor";

export interface TrieNode {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: Map<string, TrieNode>;
}

export function inferLanguage(path: string): CodeEditorLanguage {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "typescript";
  const ext = path.slice(dot).toLowerCase();
  if (ext === ".py") return "python";
  if (ext === ".tsx" || ext === ".ts") return "typescript";
  return "javascript";
}

export function joinPath(parentDir: string, name: string): string {
  const n = name.trim();
  if (!parentDir) return n;
  return `${parentDir}/${n}`;
}

export function parentDirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function baseNameOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function ancestorPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean);
  const out: string[] = [];
  let acc = "";
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i]!;
    out.push(acc);
  }
  return out;
}

export function buildTrie(
  filePaths: string[],
  emptyFolders: Set<string>
): Map<string, TrieNode> {
  const root = new Map<string, TrieNode>();
  for (const p of filePaths) {
    insertFilePath(root, p);
  }
  for (const f of emptyFolders) {
    if (f) insertEmptyFolderPath(root, f);
  }
  return root;
}

function insertFilePath(root: Map<string, TrieNode>, filePath: string): void {
  const parts = filePath.split("/");
  const fileName = parts.pop()!;
  let map = root;
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (!map.has(part)) {
      map.set(part, {
        name: part,
        fullPath: acc,
        isFile: false,
        children: new Map(),
      });
    }
    const node = map.get(part)!;
    if (node.isFile) return;
    map = node.children;
  }
  map.set(fileName, {
    name: fileName,
    fullPath: filePath,
    isFile: true,
    children: new Map(),
  });
}

function insertEmptyFolderPath(root: Map<string, TrieNode>, folderPath: string): void {
  const parts = folderPath.split("/").filter(Boolean);
  if (parts.length === 0) return;
  let map = root;
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    if (!map.has(part)) {
      map.set(part, {
        name: part,
        fullPath: acc,
        isFile: false,
        children: new Map(),
      });
    } else {
      const n = map.get(part)!;
      if (n.isFile) return;
    }
    map = map.get(part)!.children;
  }
}

export function sortedTrieChildren(map: Map<string, TrieNode>): TrieNode[] {
  return [...map.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function fileCreateConflict(
  path: string,
  codeFiles: Record<string, unknown>,
  emptyFolders: Set<string>
): string | null {
  if (codeFiles[path]) return "A file already exists at this path.";
  if (emptyFolders.has(path)) return "A folder with this name already exists.";
  const prefix = path + "/";
  for (const k of Object.keys(codeFiles)) {
    if (k.startsWith(prefix)) return "That name is already used as a folder (it contains files).";
  }
  return null;
}

export function folderCreateConflict(
  path: string,
  codeFiles: Record<string, unknown>,
  emptyFolders: Set<string>
): string | null {
  if (emptyFolders.has(path)) return "This folder already exists.";
  if (codeFiles[path]) return "A file exists with this path.";
  const prefix = path + "/";
  for (const k of Object.keys(codeFiles)) {
    if (k.startsWith(prefix)) return "Files already exist under this path.";
  }
  return null;
}
