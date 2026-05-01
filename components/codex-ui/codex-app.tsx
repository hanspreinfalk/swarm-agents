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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const REPOSITORIES = [
  "hanspreinfalk/swarm-agents",
  "hanspreinfalk/agent-runtime",
  "openai/codex",
  "vercel/ai-chatbot",
];

const BRANCHES = ["main", "feature/codex-ui", "preview/webview", "fix/sidebar"];
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
  const setMessageSentimentMutation = useMutation(api.likedMessages.setSentiment);

  const likedMessagesQuery = useQuery(
    api.likedMessages.listForThread,
    activeThreadId ? { threadId: activeThreadId as Id<"threads"> } : "skip"
  );
  const likedRows = likedMessagesQuery ?? [];

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

  const handleCodeFileChange = useCallback((path: string, content: string) => {
    setCodeFiles((prev) => {
      const cur = prev[path];
      if (!cur) return prev;
      return { ...prev, [path]: { ...cur, content } };
    });
  }, []);

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
  const [selectedRepo, setSelectedRepo] = useState(REPOSITORIES[0]);
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [chatPanelSize, setChatPanelSize] = useState(DEFAULT_CHAT_PANEL_SIZE);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [terminals, setTerminals] = useState(INITIAL_TERMINALS);
  const [activeTerminalId, setActiveTerminalId] = useState(INITIAL_TERMINALS[0].id);
  const [terminalCommandDraft, setTerminalCommandDraft] = useState("");
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  const activeTerminal =
    terminals.find((terminal) => terminal.id === activeTerminalId) ?? terminals[0];

  useEffect(() => {
    if (terminals.length === 0) return;
    if (!terminals.some((t) => t.id === activeTerminalId)) {
      setActiveTerminalId(terminals[0].id);
    }
  }, [terminals, activeTerminalId]);

  // Auto-select the first thread when threads load
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0]._id);
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

  // ── Active thread title ──────────────────────────────────────────
  const activeThread = threads.find((t) => t._id === activeThreadId);

  // ── Thread management ────────────────────────────────────────────
  const handleNewThread = useCallback(async () => {
    const threadId = await createThreadMutation({
      title: "New thread",
      model: selectedModel,
    });
    setActiveThreadId(threadId);
    setStreamingContent("");
  }, [createThreadMutation, selectedModel]);

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
        });
        setActiveThreadId(threadId);
      } else if (dbMessages.length === 0) {
        // Update thread title from first message
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          title: text.slice(0, 60),
          model: selectedModel,
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

        <SidebarInset
          style={{
            display: "grid",
            gridTemplateRows: "2.75rem 1fr",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* ── App header ────────────────────────────────────────── */}
          <header className="flex items-center gap-2 border-b border-border px-3">
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
                    GitHub · {selectedRepo}
                    <ChevronDownIcon size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>Repositories</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={selectedRepo} onValueChange={setSelectedRepo}>
                    {REPOSITORIES.map((repo) => (
                      <DropdownMenuRadioItem key={repo} value={repo}>
                        <span className="truncate">{repo}</span>
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
                    {selectedBranch}
                    <ChevronDownIcon size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  <DropdownMenuLabel>Branches</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup value={selectedBranch} onValueChange={setSelectedBranch}>
                    {BRANCHES.map((branch) => (
                      <DropdownMenuRadioItem key={branch} value={branch}>
                        <span className="truncate">{branch}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCwIcon size={12} />
                Sync
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setCommitDialogOpen(true)}
                className="rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-colors hover:opacity-85"
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
                              className="flex shrink-0 items-stretch rounded-md ring-1 ring-zinc-800/80"
                            >
                              <button
                                type="button"
                                onClick={() => setActiveTerminalId(terminal.id)}
                                className={[
                                  "rounded-l-md px-2 py-1 text-[11px] font-medium transition-colors",
                                  activeTerminalId === terminal.id
                                    ? "bg-zinc-800 text-zinc-100"
                                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
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
                                  className="rounded-r-md border-l border-zinc-800 px-1.5 text-zinc-500 transition-colors hover:bg-red-950/40 hover:text-red-300"
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
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
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
                        className="flex shrink-0 items-center gap-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2"
                      >
                        <span className="shrink-0 font-mono text-[12px] text-zinc-500">$</span>
                        <input
                          type="text"
                          value={terminalCommandDraft}
                          onChange={(e) => setTerminalCommandDraft(e.target.value)}
                          placeholder="Run a command…"
                          autoComplete="off"
                          spellCheck={false}
                          className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600"
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
      <CommitDialog
        open={commitDialogOpen}
        onOpenChange={setCommitDialogOpen}
      />
    </TooltipProvider>
  );
}
