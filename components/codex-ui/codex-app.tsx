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
  GitBranchIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { ChatPanel } from "./chat-panel";
import { CommitDialog } from "./commit-dialog";
import { CodePanel } from "./code-panel";
import { INITIAL_MESSAGES, PARALLEL_CODING_AGENTS } from "./data";
import type {
  AssistantMessage,
  ChatMessage,
  CodingAgentStatus,
  UserMessage,
} from "./types";

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

export function CodexApp() {
  const [activeThread, setActiveThread] = useState("t2");
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeFile, setActiveFile] = useState("src/hero.tsx");
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(REPOSITORIES[0]);
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [chatPanelSize, setChatPanelSize] = useState(DEFAULT_CHAT_PANEL_SIZE);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [terminals, setTerminals] = useState(INITIAL_TERMINALS);
  const [activeTerminalId, setActiveTerminalId] = useState(
    INITIAL_TERMINALS[0].id
  );
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const activeTerminal =
    terminals.find((terminal) => terminal.id === activeTerminalId) ??
    terminals[0];

  const handleSubmit = useCallback((text: string) => {
    const timestamp = Date.now();
    const spawnedAgents = PARALLEL_CODING_AGENTS.map((agent, index) => {
      const status: CodingAgentStatus = index < 8 ? "running" : "queued";

      return {
        ...agent,
        id: `${agent.id}-${timestamp}`,
        status,
        progress: status === "running" ? Math.min(agent.progress, 72) : 0,
        elapsed: "0s",
      };
    });

    const userMsg: UserMessage = { id: `u-${Date.now()}`, role: "user", text };
    const thinkingMsg: AssistantMessage = {
      id: `a-${timestamp}`,
      role: "assistant",
      isThinkingStreaming: true,
      text: "",
      tools: [],
      subAgents: spawnedAgents,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsStreaming(true);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.role === "assistant" && m.id === thinkingMsg.id
            ? ({
                ...m,
                isThinkingStreaming: false,
                thinkingDuration: 3,
                text: "I've split the work across 10 parallel coding agents. Each agent handled a focused slice, reported progress back to me, and I merged their findings into the final change set.",
                tools: [
                  { label: "Spawned 10 coding agents", done: true },
                  { label: "Merged parallel agent results", done: true },
                  { label: "Prepared final review summary", done: true },
                ],
                subAgents: m.subAgents?.map((agent) => ({
                  ...agent,
                  status:
                    agent.status === "stopped"
                      ? agent.status
                      : ("done" as CodingAgentStatus),
                  progress: agent.status === "stopped" ? agent.progress : 100,
                  elapsed: agent.status === "stopped" ? agent.elapsed : "2m 30s",
                  updates:
                    agent.status === "stopped"
                      ? agent.updates
                      : [
                          ...agent.updates,
                          "Completed assigned task and reported back to main agent",
                        ],
                  activity:
                    agent.status === "stopped"
                      ? agent.activity
                      : [
                          ...agent.activity,
                          {
                            time: "02:30",
                            title: "Completed task",
                            detail:
                              "Finished assigned work and reported the result back to the main agent.",
                          },
                        ],
                })),
              } as AssistantMessage)
            : m
        )
      );
      setIsStreaming(false);
    }, 2500);
  }, []);

  const handleStopAgent = useCallback((messageId: string, agentId: string) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.role !== "assistant" || message.id !== messageId) {
          return message;
        }

        return {
          ...message,
          subAgents: message.subAgents?.map((agent) => {
            if (agent.id !== agentId) return agent;

            return {
              ...agent,
              status: "stopped" as CodingAgentStatus,
              updates: [...agent.updates, "Stopped by user"],
              activity: [
                ...agent.activity,
                {
                  time: "now",
                  title: "Stopped by user",
                  detail:
                    "The main agent received a stop request and halted this coding agent before it could continue.",
                },
              ],
            };
          }),
        };
      })
    );
  }, []);

  const handleMainSplitResizeStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const container = splitContainerRef.current;
      if (!container) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0) return;

      const maxChatPanelSize = 100 - MIN_CODE_PANEL_SIZE;

      const updateChatPanelSize = (clientX: number) => {
        const nextSize =
          ((clientX - containerRect.left) / containerRect.width) * 100;

        setChatPanelSize(
          Math.min(
            Math.max(nextSize, MIN_CHAT_PANEL_SIZE),
            maxChatPanelSize
          )
        );
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updateChatPanelSize(moveEvent.clientX);
      };

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
        const maxHeight = Math.max(
          MIN_TERMINAL_HEIGHT,
          panelHeight - MIN_EDITOR_HEIGHT
        );

        setTerminalHeight(
          Math.min(Math.max(nextHeight, MIN_TERMINAL_HEIGHT), maxHeight)
        );
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
      {
        id,
        name: `Terminal ${currentTerminals.length + 1}`,
        output: "$ ",
      },
    ]);
    setActiveTerminalId(id);
    setIsTerminalVisible(true);
  }, []);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-screen overflow-hidden">
        <AppSidebar
          activeThread={activeThread}
          onSelectThread={setActiveThread}
        />

        <SidebarInset
          style={{
            display: "grid",
            gridTemplateRows: "2.75rem 1fr",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* ── App header (2.75rem row) ────────────────────── */}
          <header className="flex items-center gap-2 border-b border-border px-3">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-foreground">
                Create landing hero
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
                  <DropdownMenuRadioGroup
                    value={selectedRepo}
                    onValueChange={setSelectedRepo}
                  >
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
                  <DropdownMenuRadioGroup
                    value={selectedBranch}
                    onValueChange={setSelectedBranch}
                  >
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

          {/* ── Resizable: Chat | Code panel (1fr grid row) ── */}
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
                messages={messages}
                isStreaming={isStreaming}
                onSubmit={handleSubmit}
                onStopAgent={handleStopAgent}
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
                isTerminalVisible={isTerminalVisible}
                onSelectFile={setActiveFile}
                onToggleTerminal={() =>
                  setIsTerminalVisible((visible) => !visible)
                }
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
                    output={activeTerminal.output}
                    className="h-full rounded-none border-x-0 border-b-0"
                  >
                    <TerminalHeader className="gap-2 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <TerminalTitle className="shrink-0" />
                        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                          {terminals.map((terminal) => (
                            <button
                              type="button"
                              key={terminal.id}
                              onClick={() => setActiveTerminalId(terminal.id)}
                              className={[
                                "shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                                activeTerminalId === terminal.id
                                  ? "bg-zinc-800 text-zinc-100"
                                  : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200",
                              ].join(" ")}
                            >
                              {terminal.name}
                            </button>
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
                          <TerminalClearButton />
                        </TerminalActions>
                      </div>
                    </TerminalHeader>
                    <TerminalContent className="max-h-none flex-1 p-3 text-[12px]" />
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
