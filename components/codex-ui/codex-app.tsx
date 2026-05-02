"use client";

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
  GitBranchIcon,
  GitBranchPlusIcon,
  PlusIcon,
  RefreshCwIcon,
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
import { NewThreadDialog } from "./new-thread-dialog";
import type { ExistingProject } from "./new-thread-dialog";
import { CODE_FILES } from "./data";
import type {
  AssistantMessage,
  ChatMessage,
  CodeFile,
  CodingAgentRun,
  UserMessage,
} from "./types";
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

type PreviewStreamEvent =
  | {
      type: "progress";
      stage: string;
      message: string;
      filesProcessed?: number;
      filesTotal?: number;
    }
  | {
      type: "ready";
      url: string;
      sandboxId: string;
    }
  | {
      type: "error";
      error: string;
    }
  | {
      type: "terminal";
      chunk: string;
    };

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
  const upsertProjectMutation = useMutation(api.threads.upsertProject);
  const replaceProjectFilesMutation = useMutation(api.threads.replaceProjectFiles);
  const saveProjectFileMutation = useMutation(api.threads.saveProjectFile);
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
  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [newThreadDialogOpen, setNewThreadDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewStage, setPreviewStage] = useState<string>("idle");
  const [previewStatusMessage, setPreviewStatusMessage] = useState<string>("");
  const [previewFilesProcessed, setPreviewFilesProcessed] = useState<number>(0);
  const [previewFilesTotal, setPreviewFilesTotal] = useState<number>(0);
  const [previewTerminalBuffer, setPreviewTerminalBuffer] = useState<string>("");
  const saveTimersRef = useRef<Record<string, number>>({});
  const projectsQuery = useQuery(api.threads.listProjects);
  const projects = (projectsQuery ?? []) as ExistingProject[];
  const isLoadingProjects = projectsQuery === undefined;

  // ── Swarm runs ───────────────────────────────────────────────────
  const swarmRunsQuery = useQuery(
    api.swarm.listSwarmRuns,
    activeThreadId ? { threadId: activeThreadId as Id<"threads"> } : "skip"
  );
  const latestSwarmRun = swarmRunsQuery?.[0] ?? null;

  const spawnedAgentsQuery = useQuery(
    api.swarm.listSpawnedAgents,
    latestSwarmRun ? { swarmRunId: latestSwarmRun._id } : "skip"
  );
  const spawnedAgents = spawnedAgentsQuery ?? [];

  // Subscribe to project files so swarm results auto-apply to the editor
  const projectFilesQuery = useQuery(
    api.threads.listProjectFiles,
    selectedProjectId ? { projectId: selectedProjectId as Id<"projects"> } : "skip"
  );

  // When a swarm run completes, sync project files to the code editor
  const prevSwarmStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const currentStatus = latestSwarmRun?.status ?? null;
    const prevStatus = prevSwarmStatusRef.current;
    prevSwarmStatusRef.current = currentStatus;

    if (
      currentStatus === "done" &&
      (prevStatus === "merging" || prevStatus === "running") &&
      projectFilesQuery &&
      projectFilesQuery.length > 0
    ) {
      setCodeFiles((prev) => {
        const next = { ...prev };
        for (const f of projectFilesQuery) {
          next[f.path] = { content: f.content, language: f.language };
        }
        return next;
      });
      toast.success(
        `Swarm complete — ${projectFilesQuery.length} files updated in editor.`
      );
    }
  }, [latestSwarmRun?.status, projectFilesQuery]);

  // Map Convex spawnedAgents to CodingAgentRun[] for the chat UI
  const swarmAgentRuns: CodingAgentRun[] = useMemo(() => {
    if (!latestSwarmRun) return [];
    return spawnedAgents.map((agent) => {
      const durationSeconds =
        agent.startedAt && agent.completedAt
          ? Math.round((agent.completedAt - agent.startedAt) / 1000)
          : agent.startedAt
            ? Math.round((Date.now() - agent.startedAt) / 1000)
            : 0;
      const uiStatus =
        agent.status === "queued"
          ? "queued"
          : agent.status === "running"
            ? "running"
            : agent.status === "done"
              ? "done"
              : "stopped";
      return {
        id: agent._id,
        name: agent.name,
        task: agent.task,
        status: uiStatus,
        progress: agent.progress,
        durationSeconds,
        tokensUsed: agent.tokensUsed,
        files: agent.assignedFiles,
        updates: agent.result ? [agent.result] : [],
        activity: agent.activity,
        sandboxId: agent.sandboxId,
      } satisfies CodingAgentRun;
    });
  }, [latestSwarmRun, spawnedAgents]);

  const handleCodeFileChange = useCallback(
    (path: string, content: string) => {
      let nextFile: CodeFile | undefined;
      setCodeFiles((prev) => {
        const cur = prev[path];
        if (!cur) return prev;
        nextFile = { ...cur, content };
        return { ...prev, [path]: nextFile };
      });

      if (!selectedProjectId || !nextFile) return;
      window.clearTimeout(saveTimersRef.current[path]);
      saveTimersRef.current[path] = window.setTimeout(() => {
        saveProjectFileMutation({
          projectId: selectedProjectId as Id<"projects">,
          file: {
            path,
            content,
            language: nextFile!.language,
            size: new TextEncoder().encode(content).byteLength,
          },
        }).catch(() => {
          toast.error(`Could not save ${path} to the project.`);
        });
      }, 450);
    },
    [saveProjectFileMutation, selectedProjectId]
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

  const handleRequestPreview = useCallback(async () => {
    const files = Object.entries(codeFiles).map(([path, file]) => ({
      path,
      content: file.content,
    }));
    if (files.length === 0) {
      setPreviewError("No files available to preview.");
      setPreviewUrl(null);
      return;
    }

    setIsPreviewLoading(true);
    setPreviewStage("preparing");
    setPreviewStatusMessage("Preparing preview request...");
    setPreviewFilesProcessed(0);
    setPreviewFilesTotal(files.length);
    setPreviewTerminalBuffer("$ preview start\n");
    setPreviewError(null);
    let resolvedPreviewUrl: string | null = null;
    try {
      const response = await fetch("/api/e2b/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectKey: selectedProjectId ?? `${selectedRepo ?? "local"}:${selectedBranch ?? "main"}`,
          files,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not start preview sandbox.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Preview response stream was not available.");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: PreviewStreamEvent;
          try {
            event = JSON.parse(trimmed) as PreviewStreamEvent;
          } catch {
            continue;
          }

          if (event.type === "progress") {
            setPreviewStage(event.stage);
            setPreviewStatusMessage(event.message);
            if (typeof event.filesProcessed === "number") {
              setPreviewFilesProcessed(event.filesProcessed);
            }
            if (typeof event.filesTotal === "number") {
              setPreviewFilesTotal(event.filesTotal);
            }
            continue;
          }

          if (event.type === "terminal") {
            setPreviewTerminalBuffer((previous) => {
              const next = `${previous}${event.chunk}`;
              const maxChars = 80_000;
              return next.length > maxChars ? next.slice(next.length - maxChars) : next;
            });
            continue;
          }

          if (event.type === "ready") {
            resolvedPreviewUrl = event.url;
            setPreviewUrl(event.url);
            setPreviewStage("ready");
            setPreviewStatusMessage("Preview is ready.");
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.error || "Could not start preview sandbox.");
          }
        }
      }

      if (!resolvedPreviewUrl) {
        throw new Error("Preview did not return a URL.");
      }

      setPreviewError(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start preview sandbox.";
      setPreviewStage("error");
      setPreviewStatusMessage("");
      setPreviewError(message);
      // Only clear the URL if this attempt never produced one — if the
      // sandbox was already running and the stream just got interrupted,
      // keep the existing URL so the iframe stays visible.
      if (!resolvedPreviewUrl) {
        setPreviewUrl(null);
      }
      toast.error(message);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [codeFiles, selectedBranch, selectedProjectId, selectedRepo]);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [newBranchDialogOpen, setNewBranchDialogOpen] = useState(false);
  const [newBranchNameDraft, setNewBranchNameDraft] = useState("");
  const [chatPanelSize, setChatPanelSize] = useState(DEFAULT_CHAT_PANEL_SIZE);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const repositoryFilesQuery = useQuery(
    api.threads.listProjectFiles,
    selectedProjectId
      ? {
          projectId: selectedProjectId as Id<"projects">,
        }
      : "skip"
  );
  const repositoryFiles = repositoryFilesQuery ?? [];

  const loadRepos = useCallback(() => {
    setIsLoadingRepos(true);
    setRepoError(null);
    postGithub<{ authenticatedAs: string; hasRepoScope: boolean; repositories: GithubRepository[] }>({ action: "listRepos" })
      .then(({ authenticatedAs, hasRepoScope, repositories: nextRepositories }) => {
        setGithubUser(authenticatedAs);
        if (!hasRepoScope && nextRepositories.length === 0) {
          setRepoError(
            `@${authenticatedAs} is connected but the GitHub token is missing the "repo" scope. ` +
            `Go to your Clerk Dashboard → Configure → GitHub → add "repo" to Scopes, then re-login.`
          );
        }
        setRepositories(nextRepositories);
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : "Could not load GitHub repositories.";
        setRepoError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setIsLoadingRepos(false);
      });
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
          return repo?.defaultBranch ?? nextBranches[0]?.name ?? null;
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
  }, [repositories, selectedRepo]);

  useEffect(() => {
    if (!activeThread) return;
    const activeProject = projects.find((project) => project._id === activeThread.projectId);
    queueMicrotask(() => {
      setSelectedProjectId(activeProject?._id ?? null);
      setSelectedRepo(activeProject?.repositoryFullName ?? null);
      setSelectedBranch(activeProject?.branch ?? null);
    });
  }, [activeThread, projects]);

  useEffect(() => {
    if (!selectedProjectId || repositoryFilesQuery === undefined) return;
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
  }, [activeThreadId, repositoryFiles, repositoryFilesQuery, selectedProjectId]);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const syncRepositoryForProject = useCallback(
    async (projectId: string, repositoryFullName: string, branch: string) => {
      const result = await postGithub<{
        files: GithubFilePayload[];
        truncated: boolean;
      }>({
        action: "sync",
        repositoryFullName,
        branch,
      });

      await replaceProjectFilesMutation({
        projectId: projectId as Id<"projects">,
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
        toast.warning("GitHub returned a truncated tree. Some files may be missing.");
      } else {
        toast.success(`Synced ${result.files.length} files from GitHub.`);
      }
    },
    [replaceProjectFilesMutation]
  );

  const ensureActiveThread = useCallback(
    async (title = "New thread") => {
      if (activeThreadId) return activeThreadId;

      const threadId = await createThreadMutation({
        title,
        model: selectedModel,
        ...(selectedProjectId ? { projectId: selectedProjectId as Id<"projects"> } : {}),
      });
      setActiveThreadId(threadId);
      return threadId;
    },
    [activeThreadId, createThreadMutation, selectedModel, selectedProjectId]
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
      const projectId = await upsertProjectMutation({
        name: selectedRepo.split("/")[1] ?? selectedRepo,
        repositoryFullName: selectedRepo,
        branch: name,
      });
      setSelectedProjectId(projectId);
      await updateThreadMutation({
        threadId: threadId as Id<"threads">,
        projectId: projectId as Id<"projects">,
      });
      await syncRepositoryForProject(projectId, selectedRepo, name);
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
    syncRepositoryForProject,
    updateThreadMutation,
    upsertProjectMutation,
  ]);

  const handleSelectBranch = useCallback(
    async (branch: string) => {
      if (!selectedRepo) return;
      const threadId = await ensureActiveThread();
      if (!threadId) return;

      setIsSyncing(true);
      try {
        const projectId = await upsertProjectMutation({
          name: selectedRepo.split("/")[1] ?? selectedRepo,
          repositoryFullName: selectedRepo,
          branch,
        });
        setSelectedProjectId(projectId);
        setSelectedBranch(branch);
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          projectId: projectId as Id<"projects">,
        });
        await syncRepositoryForProject(projectId, selectedRepo, branch);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not switch branches.");
      } finally {
        setIsSyncing(false);
      }
    },
    [
      ensureActiveThread,
      selectedRepo,
      syncRepositoryForProject,
      updateThreadMutation,
      upsertProjectMutation,
    ]
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
      const projectId =
        selectedProjectId ??
        (await upsertProjectMutation({
          name: selectedRepo.split("/")[1] ?? selectedRepo,
          repositoryFullName: selectedRepo,
          branch: selectedBranch,
        }));
      if (!selectedProjectId) {
        setSelectedProjectId(projectId);
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          projectId: projectId as Id<"projects">,
        });
      }
      await syncRepositoryForProject(projectId, selectedRepo, selectedBranch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync repository.");
    } finally {
      setIsSyncing(false);
    }
  }, [
    ensureActiveThread,
    selectedBranch,
    selectedProjectId,
    selectedRepo,
    syncRepositoryForProject,
    updateThreadMutation,
    upsertProjectMutation,
  ]);

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
        const projectId =
          selectedProjectId ??
          (await upsertProjectMutation({
            name: selectedRepo.split("/")[1] ?? selectedRepo,
            repositoryFullName: selectedRepo,
            branch: selectedBranch,
          }));
        if (!selectedProjectId) setSelectedProjectId(projectId);
        await replaceProjectFilesMutation({
          projectId: projectId as Id<"projects">,
          files,
        });
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          projectId: projectId as Id<"projects">,
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
      replaceProjectFilesMutation,
      selectedProjectId,
      selectedBranch,
      selectedRepo,
      upsertProjectMutation,
      updateThreadMutation,
    ]
  );

  // Auto-select the first thread when threads load
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      queueMicrotask(() => setActiveThreadId(threads[0]._id));
    }
  }, [threads, activeThreadId]);

  // ── Build the chat messages for display ──────────────────────────
  const isSwarmActive =
    latestSwarmRun !== null &&
    (latestSwarmRun.status === "running" || latestSwarmRun.status === "merging");

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
      const isLast = m._id === lastAssistantMessageId;
      const assistantMsg: AssistantMessage = {
        id: m._id,
        role: "assistant",
        isThinkingStreaming: false,
        text: m.content,
        tools: [],
        // Attach swarm agents to the last persisted assistant message when swarm is done
        subAgents:
          isLast && !isStreaming && swarmAgentRuns.length > 0
            ? swarmAgentRuns
            : undefined,
        feedback: feedbackByMessageId.get(m._id),
        canRegenerate: isLast,
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
            // Show swarm agents while streaming (swarm is running in parallel)
            subAgents: swarmAgentRuns.length > 0 ? swarmAgentRuns : undefined,
          } as AssistantMessage,
        ] as ChatMessage[])
      : []),
  ];

  void isSwarmActive;

  // ── Thread management ────────────────────────────────────────────
  const handleNewThread = useCallback(() => {
    setNewThreadDialogOpen(true);
  }, []);

  const handleCreateThreadWithRepo = useCallback(
    async (repoFullName: string, branch: string) => {
      const projectId = await upsertProjectMutation({
        name: repoFullName.split("/")[1] ?? repoFullName,
        repositoryFullName: repoFullName,
        branch,
      });
      await syncRepositoryForProject(projectId, repoFullName, branch);
      const threadId = await createThreadMutation({
        title: "New thread",
        model: selectedModel,
        projectId: projectId as Id<"projects">,
      });
      setActiveThreadId(threadId);
      setSelectedProjectId(projectId);
      setSelectedRepo(repoFullName);
      setSelectedBranch(branch);
      setStreamingContent("");
      setCodeFiles({});
      setActiveFile("");
    },
    [createThreadMutation, selectedModel, syncRepositoryForProject, upsertProjectMutation]
  );

  const handleCreateThreadWithProject = useCallback(
    async (projectId: string) => {
      const project = projects.find((item) => item._id === projectId);
      if (!project) {
        toast.error("Project not found.");
        return;
      }
      const threadId = await createThreadMutation({
        title: project.name,
        model: selectedModel,
        projectId: projectId as Id<"projects">,
      });
      setActiveThreadId(threadId);
      setSelectedProjectId(projectId);
      setSelectedRepo(project.repositoryFullName);
      setSelectedBranch(project.branch);
      setStreamingContent("");
    },
    [createThreadMutation, projects, selectedModel]
  );

  const handleCreateThreadWithNewRepo = useCallback(
    async (repoName: string, description: string, isPrivate: boolean) => {
      const newRepo = await postGithub<GithubRepository>({
        action: "createRepo",
        repoName,
        description: description || undefined,
        isPrivate,
      });
      setRepositories((prev) => [newRepo, ...prev]);
      const projectId = await upsertProjectMutation({
        name: repoName,
        repositoryFullName: newRepo.fullName,
        branch: newRepo.defaultBranch,
      });
      const threadId = await createThreadMutation({
        title: repoName,
        model: selectedModel,
        projectId: projectId as Id<"projects">,
      });
      setActiveThreadId(threadId);
      setSelectedProjectId(projectId);
      setSelectedRepo(newRepo.fullName);
      setSelectedBranch(newRepo.defaultBranch);
      setStreamingContent("");
      setCodeFiles({});
      setActiveFile("");
      toast.success(`Created repository ${newRepo.fullName}`);
    },
    [createThreadMutation, selectedModel, upsertProjectMutation]
  );

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
      apiMessages: Array<{ role: "user" | "assistant"; content: string }>,
      currentProjectId: string | null,
      currentProjectFiles: Array<{ path: string; content: string; language: string }>
    ) => {
      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            model: selectedModel,
            threadId,
            projectId: currentProjectId ?? undefined,
            projectFiles: currentProjectFiles,
          }),
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
          content: fullContent || "(Swarm agents completed — see the agent timeline above.)",
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
          ...(selectedProjectId ? { projectId: selectedProjectId as Id<"projects"> } : {}),
        });
        setActiveThreadId(threadId);
      } else if (dbMessages.length === 0) {
        // Update thread title from first message
        await updateThreadMutation({
          threadId: threadId as Id<"threads">,
          title: text.slice(0, 60),
          model: selectedModel,
          ...(selectedProjectId ? { projectId: selectedProjectId as Id<"projects"> } : {}),
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

      // Build project files array to send for swarm context
      const currentProjectFiles = Object.entries(codeFiles).map(([path, file]) => ({
        path,
        content: file.content,
        language: file.language,
      }));

      await streamAssistantReply(
        threadId as Id<"threads">,
        apiMessages,
        selectedProjectId,
        currentProjectFiles
      );
    },
    [
      activeThreadId,
      codeFiles,
      dbMessages,
      selectedModel,
      selectedProjectId,
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
      const currentProjectFiles = Object.entries(codeFiles).map(([path, file]) => ({
        path,
        content: file.content,
        language: file.language,
      }));
      await streamAssistantReply(
        activeThreadId as Id<"threads">,
        apiMessages,
        selectedProjectId,
        currentProjectFiles
      );
    },
    [
      activeThreadId,
      codeFiles,
      dbMessages,
      deleteAssistantMessageMutation,
      isStreaming,
      selectedProjectId,
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
              {selectedRepo && (
                <span className="inline-flex max-w-[180px] items-center gap-1.5 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <svg
                    viewBox="0 0 16 16"
                    width={12}
                    height={12}
                    fill="currentColor"
                    aria-hidden="true"
                    className="shrink-0"
                  >
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  <span className="truncate">{selectedRepo}</span>
                </span>
              )}

              {selectedRepo && (
                <>
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
                    disabled={!selectedBranch}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitBranchPlusIcon size={12} />
                    New branch
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncRepository}
                    disabled={!selectedBranch || isSyncing}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCwIcon
                      className={isSyncing ? "animate-spin" : undefined}
                      size={12}
                    />
                    {isSyncing ? "Syncing" : "Sync"}
                  </button>
                </>
              )}
            </div>
            {selectedRepo && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenRepository}
                  className="rounded-md px-3 py-1.5 text-[13px] font-medium text-foreground ring-1 ring-border transition-colors hover:bg-muted"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => setCommitDialogOpen(true)}
                  disabled={!selectedBranch || Object.keys(codeFiles).length === 0}
                  className="rounded-md bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-colors hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Commit
                </button>
              </div>
            )}
          </header>

          {/* ── Empty state: no repo selected ─────────────────────── */}
          {!selectedRepo && (
            <div className="flex h-full flex-col items-center justify-center gap-6 bg-background">
              <img
                src="/logo.svg"
                alt="SwarmAgents"
                width={72}
                height={72}
                className="opacity-90"
              />
              <div className="text-center">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  SwarmAgents
                </h2>
                <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
                  Create a new thread and connect a GitHub repository to get started.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewThread}
                className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background transition-opacity hover:opacity-85"
              >
                <PlusIcon size={14} />
                New thread
              </button>
            </div>
          )}

          {/* ── Resizable: Chat | Code panel ──────────────────────── */}
          {selectedRepo && <div
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
              style={{
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
                previewUrl={previewUrl}
                previewError={previewError}
                isPreviewLoading={isPreviewLoading}
                previewStage={previewStage}
                previewStatusMessage={previewStatusMessage}
                previewFilesProcessed={previewFilesProcessed}
                previewFilesTotal={previewFilesTotal}
                previewTerminalBuffer={previewTerminalBuffer}
                onClearPreviewTerminal={() => setPreviewTerminalBuffer("")}
                onRequestPreview={handleRequestPreview}
              />
            </div>
          </div>}
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

      <NewThreadDialog
        open={newThreadDialogOpen}
        onOpenChange={setNewThreadDialogOpen}
        repos={repositories}
        projects={projects}
        isLoadingRepos={isLoadingRepos}
        isLoadingProjects={isLoadingProjects}
        repoError={repoError}
        githubUser={githubUser}
        onRefreshRepos={loadRepos}
        onCreateWithExisting={handleCreateThreadWithRepo}
        onCreateWithProject={handleCreateThreadWithProject}
        onCreateWithNew={handleCreateThreadWithNewRepo}
      />

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
