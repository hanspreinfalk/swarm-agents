"use client";

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
import { Button } from "@/components/ui/button";
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ChevronDownIcon,
  EraserIcon,
  GitBranchIcon,
  GitBranchPlusIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppSidebar } from "./app-sidebar";
import { ChatPanel } from "./chat-panel";
import { CommitDialog } from "./commit-dialog";
import { CodePanel } from "./code-panel";
import { CODE_FILES } from "./data";
import type { AssistantMessage, ChatMessage, CodeFile, UserMessage } from "./types";
import {
  fileCreateConflict,
  folderCreateConflict,
  inferLanguage,
  joinPath,
  parentDirOf,
} from "./virtual-file-tree";

const DEFAULT_CHAT_PANEL_SIZE = 44;
const MIN_CHAT_PANEL_SIZE = 25;
const MIN_CODE_PANEL_SIZE = 20;
const DEFAULT_TERMINAL_HEIGHT = 220;
const MIN_TERMINAL_HEIGHT = 120;
const MIN_EDITOR_HEIGHT = 260;

const TERMINAL_OUTPUT = `$ npm run dev

> swarm-agents@0.1.0 dev
> next dev

▲ Next.js 16.2.4 (Turbopack)
- Local:        http://localhost:3000
- Network:      http://10.107.0.144:3000

✓ Ready in 174ms
○ Compiling / ...
✓ Compiled / in 612ms
GET / 200 in 38ms
`;

const INITIAL_TERMINALS = [
  {
    id: "terminal-1",
    name: "Terminal 1",
    output: TERMINAL_OUTPUT,
  },
];

const CLEAR_SENTINEL = "__CLEAR__";

type GithubRepository = {
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  private: boolean;
};

type GithubBranch = {
  name: string;
  sha: string;
};

type GithubFilePayload = {
  path: string;
  content: string;
  language: CodeFile["language"];
  sha?: string;
  size?: number;
};

function simulateShellResponse(cmd: string): string {
  const trimmed = cmd.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) return "";
  if (lower === "clear") return CLEAR_SENTINEL;
  if (lower === "help") {
    return [
      "Demo shell — try:",
      "  help, clear, pwd, ls, echo <text>, npm run dev",
    ].join("\n");
  }
  if (lower === "pwd") {
    return "/Users/hanspreinfalk/Documents/NextJs/swarm-agents";
  }
  if (lower === "ls" || lower === "ls -la" || lower === "ls -l") {
    return ["README.md", "app/", "components/", "package.json", "tsconfig.json"].join("\n");
  }
  if (lower.startsWith("echo ")) {
    return trimmed.slice(5).trim();
  }
  if (lower === "npm run dev" || lower === "npm start") {
    return [
      "> swarm-agents@0.1.0 dev",
      "> next dev",
      "",
      "✓ Ready — open http://localhost:3000",
    ].join("\n");
  }
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return `sh: ${first}: command not found (demo shell)`;
}

function appendTerminalOutput(
  previous: string,
  cmd: string,
  response: string
): string {
  if (response === CLEAR_SENTINEL) {
    return "$ ";
  }
  const body = response ? `${response}\n` : "";
  if (previous.endsWith("$ ")) {
    return `${previous.slice(0, -2)}${cmd}\n${body}$ `;
  }
  return `${previous}\n$ ${cmd}\n${body}$ `;
}

async function postGithub<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `GitHub request failed: ${response.status}`);
  }
  return payload;
}

export function CodexApp() {
  // ── Convex data ─────────────────────────────────────────────────
  const threadsQuery = useQuery(api.threads.listThreads);
  const threads = threadsQuery ?? [];
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const messagesQuery = useQuery(
    api.threads.listMessages,
    activeThreadId ? { threadId: activeThreadId as Id<"threads"> } : "skip"
  );
  const dbMessages = messagesQuery ?? [];
  const isConversationLoading =
    activeThreadId !== null && messagesQuery === undefined;

  const createThreadMutation = useMutation(api.threads.createThread);
  const addMessageMutation = useMutation(api.threads.addMessage);
  const updateThreadMutation = useMutation(api.threads.updateThread);
  const deleteThreadMutation = useMutation(api.threads.deleteThread);
  const deleteAssistantMessageMutation = useMutation(api.threads.deleteAssistantMessage);
  const replaceRepositoryFilesMutation = useMutation(api.threads.replaceRepositoryFiles);
  const saveRepositoryFileMutation = useMutation(api.threads.saveRepositoryFile);
  const setMessageSentimentMutation = useMutation(api.likedMessages.setSentiment);

  const likedMessagesQuery = useQuery(
    api.likedMessages.listForThread,
    activeThreadId ? { threadId: activeThreadId as Id<"threads"> } : "skip"
  );
  const likedRows = likedMessagesQuery ?? [];

  const activeThread = threads.find((t) => t._id === activeThreadId);

  const feedbackByMessageId = useMemo(() => {
    const map = new Map<string, "up" | "down">();
    for (const row of likedRows) {
      map.set(row.messageId, row.sentiment);
    }
    return map;
  }, [likedRows]);

  const lastAssistantMessageId = useMemo(() => {
    for (let i = dbMessages.length - 1; i >= 0; i--) {
      const m = dbMessages[i];
      if (m.role === "assistant") return m._id;
    }
    return null;
  }, [dbMessages]);

  // ── Streaming state ──────────────────────────────────────────────
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Model selection ──────────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState("gpt-4.1");

  // ── UI state ─────────────────────────────────────────────────────
  const [activeFile, setActiveFile] = useState("src/hero.tsx");
  const [codeFiles, setCodeFiles] = useState<Record<string, CodeFile>>(() => ({
    ...CODE_FILES,
  }));
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(() => new Set());
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const saveTimersRef = useRef<Record<string, number>>({});

  const handleCodeFileChange = useCallback(
    (path: string, content: string) => {
      let nextFile: CodeFile | undefined;
      setCodeFiles((prev) => {
        const cur = prev[path];
        if (!cur) return prev;
        nextFile = { ...cur, content };
        return { ...prev, [path]: nextFile };
      });

      if (!activeThreadId || !selectedRepo || !selectedBranch || !nextFile) return;
      window.clearTimeout(saveTimersRef.current[path]);
      saveTimersRef.current[path] = window.setTimeout(() => {
        saveRepositoryFileMutation({
          threadId: activeThreadId as Id<"threads">,
          repositoryFullName: selectedRepo,
          branch: selectedBranch,
          file: {
            path,
            content,
            language: nextFile!.language,
            size: new TextEncoder().encode(content).byteLength,
          },
        }).catch(() => {
          toast.error(`Could not save ${path} to the thread.`);
        });
      }, 450);
    },
    [activeThreadId, saveRepositoryFileMutation, selectedBranch, selectedRepo]
  );

  const handleAddFile = useCallback(
    (parentDir: string, name: string): boolean => {
      const path = joinPath(parentDir, name);
      const err = fileCreateConflict(path, codeFiles, emptyFolders);
      if (err) {
        toast.error(err);
        return false;
      }
      setCodeFiles((prev) => ({
        ...prev,
        [path]: { content: "", language: inferLanguage(path) },
      }));
      setEmptyFolders((prev) => {
        const n = new Set(prev);
        if (parentDir) n.delete(parentDir);
        return n;
      });
      setActiveFile(path);
      return true;
    },
    [codeFiles, emptyFolders]
  );

  const handleAddFolder = useCallback(
    (parentDir: string, name: string): boolean => {
      const path = joinPath(parentDir, name);
      const err = folderCreateConflict(path, codeFiles, emptyFolders);
      if (err) {
        toast.error(err);
        return false;
      }
      setEmptyFolders((prev) => new Set(prev).add(path));
      return true;
    },
    [codeFiles, emptyFolders]
  );

  const handleDeletePath = useCallback((path: string, kind: "file" | "folder") => {
    if (kind === "file") {
      let fallback = "";
      setCodeFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        fallback = Object.keys(next).sort()[0] ?? "";
        return next;
      });
      setEmptyFolders((prev) => {
        const n = new Set(prev);
        n.delete(path);
        return n;
      });
      setActiveFile((ac) => (ac === path ? fallback : ac));
      return;
    }
    let fallback = "";
    setCodeFiles((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(path + "/")) delete next[k];
      }
      fallback = Object.keys(next).sort()[0] ?? "";
      return next;
    });
    setEmptyFolders((prev) => {
      const n = new Set<string>();
      for (const f of prev) {
        if (f === path || f.startsWith(path + "/")) continue;
        n.add(f);
      }
      return n;
    });
    setActiveFile((ac) => {
      if (ac === path || ac.startsWith(path + "/")) return fallback;
      return ac;
    });
  }, []);

  const handleRenamePath = useCallback(
    (path: string, newBaseName: string, kind: "file" | "folder"): boolean => {
      const trimmed = newBaseName.trim();
      if (!trimmed || trimmed.includes("/")) {
        toast.error("Invalid name.");
        return false;
      }

      if (kind === "file") {
        const parent = parentDirOf(path);
        const newPath = joinPath(parent, trimmed);
        if (newPath === path) return true;
        const err = fileCreateConflict(newPath, codeFiles, emptyFolders);
        if (err) {
          toast.error(err);
          return false;
        }
        const cur = codeFiles[path];
        if (!cur) {
          toast.error("File not found.");
          return false;
        }
        setCodeFiles((prev) => {
          const next = { ...prev };
          delete next[path];
          next[newPath] = cur;
          return next;
        });
        setActiveFile((ac) => (ac === path ? newPath : ac));
        return true;
      }

      const parent = parentDirOf(path);
      const newPath = joinPath(parent, trimmed);
      if (newPath === path) return true;

      if (newPath.startsWith(path + "/") || path.startsWith(newPath + "/")) {
        toast.error("Cannot move a folder into itself.");
        return false;
      }

      const keys = Object.keys(codeFiles);
      const moves = keys
        .filter((k) => k.startsWith(path + "/"))
        .map((from) => ({ from, to: newPath + from.slice(path.length) }));

      for (const { to } of moves) {
        if (codeFiles[to] !== undefined && !moves.some((m) => m.from === to)) {
          toast.error(`Cannot rename: “${to}” already exists.`);
          return false;
        }
      }

      if (codeFiles[newPath] !== undefined && !moves.some((m) => m.to === newPath)) {
        toast.error(`A file is in the way: “${newPath}”.`);
        return false;
      }

      const emptyMoves = [...emptyFolders]
        .filter((f) => f === path || f.startsWith(path + "/"))
        .map((from) => ({
          from,
          to: from === path ? newPath : newPath + from.slice(path.length),
        }));

      const emptyDestCounts = new Map<string, number>();
      for (const { to } of emptyMoves) {
        emptyDestCounts.set(to, (emptyDestCounts.get(to) ?? 0) + 1);
      }
      for (const [, count] of emptyDestCounts) {
        if (count > 1) {
          toast.error("That rename would merge two folders with the same path.");
          return false;
        }
      }

      const emptyFromSet = new Set(emptyMoves.map((m) => m.from));
      for (const { to } of emptyMoves) {
        if (emptyFolders.has(to) && !emptyFromSet.has(to)) {
          toast.error(`Folder “${to}” already exists.`);
          return false;
        }
      }

      setCodeFiles((prev) => {
        const next = { ...prev };
        for (const { from } of moves) delete next[from];
        for (const { from, to } of moves) next[to] = prev[from];
        return next;
      });

      setEmptyFolders((prev) => {
        const n = new Set<string>();
        for (const f of prev) {
          if (f === path || f.startsWith(path + "/")) continue;
          n.add(f);
        }
        for (const { to } of emptyMoves) n.add(to);
        return n;
      });

      setActiveFile((ac) => {
        if (ac === path) return newPath;
        if (ac.startsWith(path + "/")) return newPath + ac.slice(path.length);
        return ac;
      });

      return true;
    },
    [codeFiles, emptyFolders]
  );
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [newBranchDialogOpen, setNewBranchDialogOpen] = useState(false);
  const [newBranchNameDraft, setNewBranchNameDraft] = useState("");
  const [chatPanelSize, setChatPanelSize] = useState(DEFAULT_CHAT_PANEL_SIZE);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [terminals, setTerminals] = useState(INITIAL_TERMINALS);
  const [activeTerminalId, setActiveTerminalId] = useState(INITIAL_TERMINALS[0].id);
  const [terminalCommandDraft, setTerminalCommandDraft] = useState("");
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  const repositoryFilesQuery = useQuery(
    api.threads.listRepositoryFiles,
    activeThreadId && selectedBranch
      ? {
          threadId: activeThreadId as Id<"threads">,
          branch: selectedBranch,
        }
      : "skip"
  );
  const repositoryFiles = repositoryFilesQuery ?? [];

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoadingRepos(true);
    });
    postGithub<{ repositories: GithubRepository[] }>({ action: "listRepos" })
      .then(({ repositories: nextRepositories }) => {
        if (cancelled) return;
        setRepositories(nextRepositories);
        setSelectedRepo((current) => {
          if (current) return current;
          return nextRepositories[0]?.fullName ?? null;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load GitHub repositories.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRepos(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setIsLoadingBranches(true);
    });
    postGithub<{ branches: GithubBranch[] }>({
      action: "listBranches",
      repositoryFullName: selectedRepo,
    })
      .then(({ branches: nextBranches }) => {
        if (cancelled) return;
        setBranches(nextBranches);
        setSelectedBranch((current) => {
          const currentStillExists = current && nextBranches.some((branch) => branch.name === current);
          if (currentStillExists) return current;
          const repo = repositories.find((repository) => repository.fullName === selectedRepo);
          return activeThread?.branch ?? repo?.defaultBranch ?? nextBranches[0]?.name ?? null;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load branches.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBranches(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeThread?.branch, repositories, selectedRepo]);

  useEffect(() => {
    if (!activeThread) return;
    const repositoryFullName = activeThread.repositoryFullName ?? repositories[0]?.fullName ?? null;
    queueMicrotask(() => {
      setSelectedRepo(repositoryFullName);
      setSelectedBranch(
        activeThread.branch ??
          repositories.find((repo) => repo.fullName === repositoryFullName)?.defaultBranch ??
          null
      );
    });
  }, [activeThread, repositories]);

  useEffect(() => {
    if (!activeThreadId || !selectedBranch || repositoryFilesQuery === undefined) return;
    const nextFiles: Record<string, CodeFile> = {};
    for (const file of repositoryFiles) {
      nextFiles[file.path] = {
        content: file.content,
        language: file.language,
      };
    }
    queueMicrotask(() => {
      setCodeFiles(nextFiles);
      setEmptyFolders(new Set());
      setActiveFile(Object.keys(nextFiles).sort()[0] ?? "");
    });
  }, [activeThreadId, repositoryFiles, repositoryFilesQuery, selectedBranch]);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const activeTerminal =
    terminals.find((terminal) => terminal.id === activeTerminalId) ?? terminals[0];

  const syncRepositoryForThread = useCallback(
    async (threadId: string, repositoryFullName: string, branch: string) => {
      const result = await postGithub<{
        files: GithubFilePayload[];
        truncated: boolean;
      }>({
        action: "sync",
        repositoryFullName,
        branch,
      });

      await replaceRepositoryFilesMutation({
        threadId: threadId as Id<"threads">,
        repositoryFullName,
        branch,
        files: result.files,
      });

      const nextFiles = result.files.reduce<Record<string, CodeFile>>((acc, file) => {
        acc[file.path] = {
          content: file.content,
          language: file.language,
        };
        return acc;
      }, {});
      setCodeFiles(nextFiles);
      setEmptyFolders(new Set());
      setActiveFile(Object.keys(nextFiles).sort()[0] ?? "");

      if (result.truncated) {
        toast.warning("Synced the first text files from a large repository.");
      } else {
        toast.success(`Synced ${result.files.length} files from GitHub.`);
      }
    },
    [replaceRepositoryFilesMutation]
  );

  const ensureActiveThread = useCallback(
    async (title = "New thread") => {
      if (!selectedRepo || !selectedBranch) {
        toast.error("Choose a GitHub repository first.");
        return null;
      }
      if (activeThreadId) return activeThreadId;

      const threadId = await createThreadMutation({
        title,
        model: selectedModel,
        repositoryFullName: selectedRepo,
        branch: selectedBranch,
      });
      setActiveThreadId(threadId);
      return threadId;
    },
    [activeThreadId, createThreadMutation, selectedBranch, selectedModel, selectedRepo]
  );

  const handleNewBranchDialogOpenChange = useCallback((open: boolean) => {
    setNewBranchDialogOpen(open);
    if (!open) setNewBranchNameDraft("");
  }, []);

  const handleCreateBranch = useCallback(async () => {
    const name = newBranchNameDraft.trim();
    if (!name) {
      toast.error("Enter a branch name");
      return;
    }
    if (!selectedRepo || !selectedBranch) {
      toast.error("Choose a repository and branch first");
      return;
    }
    if (branches.some((branch) => branch.name === name)) {
      toast.error("A branch with that name already exists");
      return;
    }
    const threadId = await ensureActiveThread();
    if (!threadId) return;

    try {
      const branch = await postGithub<GithubBranch>({
        action: "createBranch",
        repositoryFullName: selectedRepo,
        sourceBranch: selectedBranch,
        newBranch: name,
      });
      setBranches((prev) => [...prev, branch]);
      setSelectedBranch(name);
      await updateThreadMutation({
        threadId: threadId as Id<"threads">,
        repositoryFullName: selectedRepo,
        branch: name,
      });
      setNewBranchDialogOpen(false);
      setNewBranchNameDraft("");
      toast.success(`Created and checked out ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create branch.");
    }
  }, [
    branches,
    ensureActiveThread,
    newBranchNameDraft,
    selectedBranch,
    selectedRepo,
    updateThreadMutation,
  ]);

  const handleSelectRepository = useCallback(
    async (repositoryFullName: string) => {
      const repo = repositories.find((item) => item.fullName === repositoryFullName);
      const nextBranch = repo?.defaultBranch ?? null;
      setSelectedRepo(repositoryFullName);
      setSelectedBranch(nextBranch);
      setCodeFiles({});
      setActiveFile("");

      if (activeThreadId) {
        await updateThreadMutation({
          threadId: activeThreadId as Id<"threads">,
          repositoryFullName,
          ...(nextBranch ? { branch: nextBranch } : {}),
        });
      }
    },
    [activeThreadId, repositories, updateThreadMutation]
  );

  const handleSelectBranch = useCallback(
    async (branch: string) => {
      if (!selectedRepo) return;
      const threadId = await ensureActiveThread();
      if (!threadId) return;

      setSelectedBranch(branch);
      setIsSyncing(true);
      try {
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          repositoryFullName: selectedRepo,
          branch,
        });
        await syncRepositoryForThread(threadId, selectedRepo, branch);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not switch branches.");
      } finally {
        setIsSyncing(false);
      }
    },
    [ensureActiveThread, selectedRepo, syncRepositoryForThread, updateThreadMutation]
  );

  const handleSyncRepository = useCallback(async () => {
    if (!selectedRepo || !selectedBranch) {
      toast.error("Choose a GitHub repository first.");
      return;
    }
    const threadId = await ensureActiveThread();
    if (!threadId) return;

    setIsSyncing(true);
    try {
      await syncRepositoryForThread(threadId, selectedRepo, selectedBranch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync repository.");
    } finally {
      setIsSyncing(false);
    }
  }, [ensureActiveThread, selectedBranch, selectedRepo, syncRepositoryForThread]);

  const handleOpenRepository = useCallback(() => {
    if (!selectedRepo) {
      toast.error("Choose a GitHub repository first.");
      return;
    }
    window.open(`https://github.com/${selectedRepo}`, "_blank", "noopener,noreferrer");
  }, [selectedRepo]);

  const handleCommit = useCallback(
    async (message: string) => {
      if (!selectedRepo || !selectedBranch) {
        toast.error("Choose a GitHub repository first.");
        return;
      }
      const threadId = await ensureActiveThread();
      if (!threadId) return;

      const files = Object.entries(codeFiles).map(([path, file]) => ({
        path,
        content: file.content,
        language: file.language,
      }));
      if (files.length === 0) {
        toast.error("There are no files to commit.");
        return;
      }

      setIsCommitting(true);
      try {
        const result = await postGithub<{ sha: string; htmlUrl: string }>({
          action: "commit",
          repositoryFullName: selectedRepo,
          branch: selectedBranch,
          message: message.trim(),
          files,
        });
        await replaceRepositoryFilesMutation({
          threadId: threadId as Id<"threads">,
          repositoryFullName: selectedRepo,
          branch: selectedBranch,
          files,
        });
        setCommitDialogOpen(false);
        toast.success(`Committed ${result.sha.slice(0, 7)} to ${selectedBranch}.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not commit changes.");
      } finally {
        setIsCommitting(false);
      }
    },
    [
      codeFiles,
      ensureActiveThread,
      replaceRepositoryFilesMutation,
      selectedBranch,
      selectedRepo,
    ]
  );

  useEffect(() => {
    if (terminals.length === 0) return;
    if (!terminals.some((t) => t.id === activeTerminalId)) {
      queueMicrotask(() => setActiveTerminalId(terminals[0].id));
    }
  }, [terminals, activeTerminalId]);

  // Auto-select the first thread when threads load
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      queueMicrotask(() => setActiveThreadId(threads[0]._id));
    }
  }, [threads, activeThreadId]);

  // ── Build the chat messages for display ──────────────────────────
  const chatMessages: ChatMessage[] = [
    ...dbMessages.map((m): ChatMessage => {
      if (m.role === "user") {
        const userMsg: UserMessage = {
          id: m._id,
          role: "user",
          text: m.content,
        };
        return userMsg;
      }
      const assistantMsg: AssistantMessage = {
        id: m._id,
        role: "assistant",
        isThinkingStreaming: false,
        text: m.content,
        tools: [],
        feedback: feedbackByMessageId.get(m._id),
        canRegenerate: m._id === lastAssistantMessageId,
      };
      return assistantMsg;
    }),
    // In-progress streaming message
    ...(isStreaming || streamingContent
      ? ([
          {
            id: "streaming",
            role: "assistant",
            isThinkingStreaming: isStreaming && !streamingContent,
            text: streamingContent,
            tools: [],
          } as AssistantMessage,
        ] as ChatMessage[])
      : []),
  ];

  // ── Thread management ────────────────────────────────────────────
  const handleNewThread = useCallback(async () => {
    if (!selectedRepo || !selectedBranch) {
      toast.error("Choose a GitHub repository first.");
      return;
    }
    const threadId = await createThreadMutation({
      title: "New thread",
      model: selectedModel,
      repositoryFullName: selectedRepo,
      branch: selectedBranch,
    });
    setActiveThreadId(threadId);
    setStreamingContent("");
    setCodeFiles({});
    setActiveFile("");
  }, [createThreadMutation, selectedBranch, selectedModel, selectedRepo]);

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
    setStreamingContent("");
    setIsStreaming(false);
    abortControllerRef.current?.abort();
  }, []);

  const handleRenameThread = useCallback(
    async (threadId: string, title: string) => {
      const trimmed = title.trim();
      await updateThreadMutation({
        threadId: threadId as Id<"threads">,
        title: trimmed.length > 0 ? trimmed : "Untitled",
      });
    },
    [updateThreadMutation]
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      const nextActiveId =
        activeThreadId === threadId
          ? (threads.find((t) => t._id !== threadId)?._id ?? null)
          : activeThreadId;
      await deleteThreadMutation({ threadId: threadId as Id<"threads"> });
      if (activeThreadId === threadId) {
        setActiveThreadId(nextActiveId);
        setStreamingContent("");
        setIsStreaming(false);
        abortControllerRef.current?.abort();
      }
    },
    [deleteThreadMutation, activeThreadId, threads]
  );

  const streamAssistantReply = useCallback(
    async (
      threadId: Id<"threads">,
      apiMessages: Array<{ role: "user" | "assistant"; content: string }>
    ) => {
      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, model: selectedModel }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }

        await addMessageMutation({
          threadId,
          role: "assistant",
          content: fullContent,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Streaming error:", err);
          toast.error("The assistant could not finish this reply. Try again.");
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortControllerRef.current = null;
      }
    },
    [addMessageMutation, selectedModel]
  );

  // ── Message submit + streaming ───────────────────────────────────
  const handleSubmit = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      let threadId = activeThreadId;

      // Create thread if none is active
      if (!threadId) {
        threadId = await createThreadMutation({
          title: text.slice(0, 60),
          model: selectedModel,
          ...(selectedRepo ? { repositoryFullName: selectedRepo } : {}),
          ...(selectedBranch ? { branch: selectedBranch } : {}),
        });
        setActiveThreadId(threadId);
      } else if (dbMessages.length === 0) {
        // Update thread title from first message
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          title: text.slice(0, 60),
          model: selectedModel,
          ...(selectedRepo ? { repositoryFullName: selectedRepo } : {}),
          ...(selectedBranch ? { branch: selectedBranch } : {}),
        });
      }

      // Save user message to Convex
      await addMessageMutation({
        threadId: threadId as Id<"threads">,
        role: "user",
        content: text,
      });

      const apiMessages = [
        ...dbMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text },
      ];

      await streamAssistantReply(threadId as Id<"threads">, apiMessages);
    },
    [
      activeThreadId,
      dbMessages,
      selectedModel,
      selectedRepo,
      selectedBranch,
      createThreadMutation,
      addMessageMutation,
      updateThreadMutation,
      streamAssistantReply,
    ]
  );

  const handleCopyAssistantText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard", { duration: 3500 });
    } catch {
      toast.error("Could not copy to clipboard", { duration: 4000 });
    }
  }, []);

  const handleFeedback = useCallback(
    async (messageId: string, sentiment: "up" | "down") => {
      try {
        await setMessageSentimentMutation({
          messageId: messageId as Id<"messages">,
          sentiment,
        });
      } catch {
        toast.error("Could not save feedback");
      }
    },
    [setMessageSentimentMutation]
  );

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!activeThreadId || isStreaming) return;
      const idx = dbMessages.findIndex((m) => m._id === messageId);
      if (idx < 0) return;
      const target = dbMessages[idx];
      if (target.role !== "assistant") return;
      if (idx !== dbMessages.length - 1) {
        toast.error("Only the latest assistant reply can be regenerated.");
        return;
      }
      const prev = dbMessages[idx - 1];
      if (!prev || prev.role !== "user") {
        toast.error("Nothing to regenerate from.");
        return;
      }
      const apiMessages = dbMessages.slice(0, idx).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      try {
        await deleteAssistantMessageMutation({
          messageId: messageId as Id<"messages">,
        });
      } catch {
        toast.error("Could not remove the old reply.");
        return;
      }
      await streamAssistantReply(activeThreadId as Id<"threads">, apiMessages);
    },
    [
      activeThreadId,
      dbMessages,
      deleteAssistantMessageMutation,
      isStreaming,
      streamAssistantReply,
    ]
  );

  const handleStopAgent = useCallback(
    (_messageId: string, _agentId: string) => {
      // Stub — agent stop logic will be added with tool execution
    },
    []
  );

  // ── Panel resizing ───────────────────────────────────────────────
  const handleMainSplitResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const container = splitContainerRef.current;
      if (!container) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0) return;
      const maxChatPanelSize = 100 - MIN_CODE_PANEL_SIZE;

      const updateChatPanelSize = (clientX: number) => {
        const nextSize = ((clientX - containerRect.left) / containerRect.width) * 100;
        setChatPanelSize(Math.min(Math.max(nextSize, MIN_CHAT_PANEL_SIZE), maxChatPanelSize));
      };

      const handlePointerMove = (moveEvent: PointerEvent) => updateChatPanelSize(moveEvent.clientX);
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    []
  );

  const handleTerminalResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const panel = rightPanelRef.current;
      if (!panel) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startHeight = terminalHeight;
      const panelHeight = panel.getBoundingClientRect().height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextHeight = startHeight + startY - moveEvent.clientY;
        const maxHeight = Math.max(MIN_TERMINAL_HEIGHT, panelHeight - MIN_EDITOR_HEIGHT);
        setTerminalHeight(Math.min(Math.max(nextHeight, MIN_TERMINAL_HEIGHT), maxHeight));
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [terminalHeight]
  );

  const handleCreateTerminal = useCallback(() => {
    const id = `terminal-${Date.now()}`;
    setTerminals((currentTerminals) => [
      ...currentTerminals,
      { id, name: `Terminal ${currentTerminals.length + 1}`, output: "$ " },
    ]);
    setActiveTerminalId(id);
    setIsTerminalVisible(true);
  }, []);

  const handleDeleteTerminal = useCallback(
    (event: React.MouseEvent, terminalId: string) => {
      event.preventDefault();
      event.stopPropagation();
      setTerminals((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t.id !== terminalId);
      });
    },
    []
  );

  const handleClearActiveTerminal = useCallback(() => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === activeTerminalId ? { ...t, output: "$ " } : t))
    );
  }, [activeTerminalId]);

  const handleTerminalSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const cmd = terminalCommandDraft.trim();
      setTerminalCommandDraft("");
      if (!cmd) return;
      const id = activeTerminalId;
      const response = simulateShellResponse(cmd);
      setTerminals((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          return { ...t, output: appendTerminalOutput(t.output, cmd, response) };
        })
      );
    },
    [activeTerminalId, terminalCommandDraft]
  );

  return (
    <TooltipProvider>
      <SidebarProvider className="h-screen overflow-hidden">
        <AppSidebar
          activeThread={activeThreadId}
          threads={threads}
          onSelectThread={handleSelectThread}
          onNewThread={handleNewThread}
          onRenameThread={handleRenameThread}
          onDeleteThread={handleDeleteThread}
        />

        <SidebarInset className="grid h-full grid-rows-[2.75rem_1fr] overflow-hidden bg-background">
          {/* ── App header ────────────────────────────────────────── */}
          <header className="flex items-center gap-2 border-b border-border bg-background px-3">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-foreground">
                {activeThread?.title ?? "SwarmAgents"}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    GitHub · {selectedRepo ?? (isLoadingRepos ? "Loading..." : "Select repo")}
                    <ChevronDownIcon size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>Repositories</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedRepo ?? ""}
                    onValueChange={handleSelectRepository}
                  >
                    {repositories.map((repo) => (
                      <DropdownMenuRadioItem key={repo.fullName} value={repo.fullName}>
                        <span className="truncate">{repo.fullName}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
                  >
                    <GitBranchIcon size={12} />
                    {selectedBranch ?? (isLoadingBranches ? "Loading..." : "Select branch")}
                    <ChevronDownIcon size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  <DropdownMenuLabel>Branches</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={selectedBranch ?? ""}
                    onValueChange={handleSelectBranch}
                  >
                    {branches.map((branch) => (
                      <DropdownMenuRadioItem key={branch.name} value={branch.name}>
                        <span className="truncate">{branch.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={() => setNewBranchDialogOpen(true)}
                disabled={!selectedRepo || !selectedBranch}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <GitBranchPlusIcon size={12} />
                New branch
              </button>

              <button
                type="button"
                onClick={handleSyncRepository}
                disabled={!selectedRepo || !selectedBranch || isSyncing}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCwIcon
                  className={isSyncing ? "animate-spin" : undefined}
                  size={12}
                />
                {isSyncing ? "Syncing" : "Sync"}
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenRepository}
                disabled={!selectedRepo}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setCommitDialogOpen(true)}
                disabled={!selectedRepo || !selectedBranch || Object.keys(codeFiles).length === 0}
                className="rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Commit
              </button>
            </div>
          </header>

          {/* ── Resizable: Chat | Code panel ──────────────────────── */}
          <div
            ref={splitContainerRef}
            style={{
              display: "grid",
              gridTemplateColumns: `${chatPanelSize}% 7px minmax(0, 1fr)`,
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <div style={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
              <ChatPanel
                messages={chatMessages}
                isConversationLoading={isConversationLoading}
                isStreaming={isStreaming}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                onSubmit={handleSubmit}
                onStopAgent={handleStopAgent}
                onCopyAssistantText={handleCopyAssistantText}
                onRegenerate={handleRegenerate}
                onFeedback={handleFeedback}
              />
            </div>

            <button
              type="button"
              aria-label="Resize conversation panel"
              onPointerDown={handleMainSplitResizeStart}
              className="group relative cursor-col-resize bg-border outline-none transition-colors hover:bg-border/80 focus-visible:bg-border/80"
            >
              <span className="absolute left-1/2 top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-muted-foreground/20 transition-colors group-hover:bg-muted-foreground/40" />
            </button>

            <div
              ref={rightPanelRef}
              style={{
                display: "grid",
                gridTemplateRows: isTerminalVisible
                  ? `minmax(0, 1fr) 7px ${terminalHeight}px`
                  : "minmax(0, 1fr)",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <CodePanel
                activeFile={activeFile}
                codeFiles={codeFiles}
                emptyFolders={emptyFolders}
                onSelectFile={setActiveFile}
                onCodeFileChange={handleCodeFileChange}
                onAddFile={handleAddFile}
                onAddFolder={handleAddFolder}
                onDeletePath={handleDeletePath}
                onRenamePath={handleRenamePath}
                isTerminalVisible={isTerminalVisible}
                onToggleTerminal={() => setIsTerminalVisible((visible) => !visible)}
              />

              {isTerminalVisible && (
                <>
                  <button
                    type="button"
                    aria-label="Resize terminal"
                    onPointerDown={handleTerminalResizeStart}
                    className="group relative cursor-row-resize bg-border/80 outline-none transition-colors hover:bg-border focus-visible:bg-border"
                  >
                    <span className="absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/20 transition-colors group-hover:bg-muted-foreground/40" />
                  </button>

                  <Terminal
                    output={activeTerminal?.output ?? ""}
                    onClear={handleClearActiveTerminal}
                    className="h-full rounded-none border-x-0 border-b-0"
                  >
                    <TerminalHeader className="gap-2 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TerminalTitle className="shrink-0" />
                        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                          {terminals.map((terminal) => (
                            <div
                              key={terminal.id}
                              className="flex shrink-0 items-stretch rounded-md ring-1 ring-border"
                            >
                              <button
                                type="button"
                                onClick={() => setActiveTerminalId(terminal.id)}
                                className={[
                                  "rounded-l-md px-2 py-1 text-[11px] font-medium transition-colors",
                                  activeTerminalId === terminal.id
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                ].join(" ")}
                              >
                                {terminal.name}
                              </button>
                              {terminals.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Close ${terminal.name}`}
                                  title="Close terminal"
                                  onClick={(e) => handleDeleteTerminal(e, terminal.id)}
                                  className="rounded-r-md border-l border-border px-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2Icon size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <TerminalStatus />
                        <TerminalActions>
                          <button
                            type="button"
                            aria-label="Create terminal"
                            onClick={handleCreateTerminal}
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <PlusIcon size={14} />
                          </button>
                          <TerminalCopyButton />
                          <TerminalClearButton aria-label="Clear output">
                            <EraserIcon size={14} />
                          </TerminalClearButton>
                        </TerminalActions>
                      </div>
                    </TerminalHeader>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <TerminalContent className="max-h-none min-h-0 flex-1 overflow-auto p-3 text-[12px]" />
                      <form
                        onSubmit={handleTerminalSubmit}
                        className="flex shrink-0 items-center gap-2 border-t border-border bg-muted px-3 py-2"
                      >
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">$</span>
                        <input
                          type="text"
                          value={terminalCommandDraft}
                          onChange={(e) => setTerminalCommandDraft(e.target.value)}
                          placeholder="Run a command…"
                          autoComplete="off"
                          spellCheck={false}
                          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
                        />
                      </form>
                    </div>
                  </Terminal>
                </>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Dialog open={newBranchDialogOpen} onOpenChange={handleNewBranchDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateBranch();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create new branch</DialogTitle>
              <DialogDescription>
                Name the branch and switch to it. This updates the workspace preview only.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <label className="sr-only" htmlFor="new-branch-name">
                Branch name
              </label>
              <Input
                id="new-branch-name"
                value={newBranchNameDraft}
                onChange={(e) => setNewBranchNameDraft(e.target.value)}
                placeholder="e.g. feature/my-change"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="font-mono text-[13px]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleNewBranchDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CommitDialog
        branch={selectedBranch}
        files={Object.keys(codeFiles).sort()}
        isCommitting={isCommitting}
        onCommit={handleCommit}
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
        repositoryFullName={selectedRepo}
      />
    </TooltipProvider>
  );
}
