"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleDotIcon,
  Clock3Icon,
  CopyIcon,
  HashIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
  BrainIcon,
  CodeIcon,
  FileIcon,
  TerminalIcon,
  WrenchIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModelSelectorInput_ } from "./model-selector-input";
import type {
  AssistantMessage,
  ChatMessage,
  CodingAgentActivity,
  CodingAgentActivityKind,
  CodingAgentRun,
  CodingAgentStatus,
  ToolEntry,
} from "./types";
// ─── Tool call list ───────────────────────────────────────────────

function ToolCallList({ tools }: { tools: ToolEntry[] }) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {tools.map((tool) => (
        <div
          key={tool.label}
          className="flex items-center gap-2 text-[13px] text-muted-foreground"
        >
          {tool.done ? (
            <CheckIcon size={13} className="shrink-0 text-green-500" />
          ) : (
            <SearchIcon size={13} className="shrink-0" />
          )}
          <span>{tool.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Parallel agent timeline ───────────────────────────────────────

const statusLabels: Record<CodingAgentStatus, string> = {
  queued: "Queued",
  running: "Running",
  reviewing: "Reviewing",
  done: "Done",
  stopped: "Stopped",
};

const statusClasses: Record<CodingAgentStatus, string> = {
  queued: "bg-muted text-muted-foreground ring-border",
  running:
    "bg-blue-500/15 text-blue-700 ring-blue-500/25 dark:text-blue-300 dark:ring-blue-400/30",
  reviewing:
    "bg-amber-500/15 text-amber-800 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-400/30",
  done: "bg-green-500/15 text-green-700 ring-green-500/25 dark:text-green-300 dark:ring-green-400/30",
  stopped:
    "bg-destructive/15 text-destructive ring-destructive/25 dark:ring-destructive/40",
};

function formatAgentDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatTokenCount(n: number): string {
  if (n <= 0) return "—";
  if (n < 1000) return n.toLocaleString();
  const k = n / 1000;
  const text = k >= 10 ? k.toFixed(0) : k.toFixed(1);
  return `${text.replace(/\.0$/, "")}k`;
}

function SandboxIdBadge({ sandboxId }: { sandboxId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`E2B sandbox: ${sandboxId}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(sandboxId).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
    >
      <span className="opacity-60">sandbox</span>
      {sandboxId.slice(0, 16)}…
      {copied ? (
        <CheckIcon size={10} className="text-green-600" />
      ) : (
        <CopyIcon size={10} className="opacity-50" />
      )}
    </button>
  );
}

function AgentStatusIcon({ status }: { status: CodingAgentStatus }) {
  if (status === "done") {
    return <CheckIcon size={13} className="text-green-600" />;
  }
  if (status === "running" || status === "reviewing") {
    return <LoaderCircleIcon size={13} className="animate-spin text-blue-600" />;
  }
  if (status === "stopped") {
    return <XIcon size={13} className="text-red-600" />;
  }
  return <CircleDotIcon size={13} className="text-muted-foreground" />;
}

// ─── Per-kind icon + colours ──────────────────────────────────────

const kindMeta: Record<
  CodingAgentActivityKind,
  { Icon: React.ElementType; iconCls: string; rowCls: string; labelCls: string }
> = {
  system:   { Icon: ZapIcon,      iconCls: "text-muted-foreground", rowCls: "border-border/60 bg-muted/20",           labelCls: "text-muted-foreground" },
  thinking: { Icon: BrainIcon,    iconCls: "text-violet-500",       rowCls: "border-violet-200/60 bg-violet-50/40 dark:border-violet-500/20 dark:bg-violet-500/5", labelCls: "text-violet-700 dark:text-violet-300" },
  tool:     { Icon: WrenchIcon,   iconCls: "text-amber-500",        rowCls: "border-amber-200/60 bg-amber-50/40 dark:border-amber-500/20 dark:bg-amber-500/5",     labelCls: "text-amber-700 dark:text-amber-300" },
  file:     { Icon: FileIcon,     iconCls: "text-blue-500",         rowCls: "border-blue-200/60 bg-blue-50/40 dark:border-blue-500/20 dark:bg-blue-500/5",         labelCls: "text-blue-700 dark:text-blue-300" },
  command:  { Icon: TerminalIcon, iconCls: "text-emerald-500",      rowCls: "border-emerald-200/60 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-500/5", labelCls: "text-emerald-700 dark:text-emerald-300" },
  text:     { Icon: CodeIcon,     iconCls: "text-foreground/50",    rowCls: "border-border/60 bg-muted/10",           labelCls: "text-foreground/80" },
  result:   { Icon: CheckIcon,    iconCls: "text-green-600",        rowCls: "border-green-200/60 bg-green-50/40 dark:border-green-500/20 dark:bg-green-500/5",     labelCls: "text-green-700 dark:text-green-300" },
  error:    { Icon: XCircleIcon,  iconCls: "text-red-500",          rowCls: "border-red-200/60 bg-red-50/40 dark:border-red-500/20 dark:bg-red-500/5",             labelCls: "text-red-700 dark:text-red-300" },
};

function ActivityRow({ entry }: { entry: CodingAgentActivity }) {
  const kind = entry.kind ?? "text";
  const { Icon, iconCls, rowCls, labelCls } = kindMeta[kind];

  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${rowCls}`}>
      <div className="flex items-start gap-2">
        <Icon size={12} className={`mt-0.5 shrink-0 ${iconCls}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`text-[11px] font-semibold leading-tight ${labelCls}`}>
              {entry.title}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
              {entry.time}
            </span>
          </div>
          {entry.detail && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground break-all">
              {entry.detail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentConversation({ agent }: { agent: CodingAgentRun }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRunning = agent.status === "running" || agent.status === "reviewing";

  // Auto-scroll to bottom while agent is running
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.activity.length, isRunning]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/30 to-background shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-background/80 px-3 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {agent.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {agent.files.length} file{agent.files.length === 1 ? "" : "s"} scoped
              {isRunning && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-blue-600" />
                  </span>
                  live
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
              <Clock3Icon size={11} className="shrink-0 opacity-70" />
              {formatAgentDuration(agent.durationSeconds)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
              <HashIcon size={11} className="shrink-0 opacity-70" />
              {formatTokenCount(agent.tokensUsed)} tok
            </span>
            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                statusClasses[agent.status],
              ].join(" ")}
            >
              {statusLabels[agent.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {/* Task assignment bubble */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[9px] font-bold text-background">
            M
          </div>
          <div className="min-w-0 flex-1 rounded-lg bg-muted/60 px-3 py-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Main agent assigned task
            </p>
            <p className="text-[12px] leading-relaxed text-foreground">{agent.task}</p>
          </div>
        </div>

        {/* Activity log */}
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[9px] font-bold text-blue-700 ring-1 ring-blue-500/25 dark:text-blue-300 dark:ring-blue-400/30">
            A
          </div>
          <div className="min-w-0 flex-1">
            {/* Scrollable log area */}
            <div
              ref={scrollRef}
              className="max-h-[420px] space-y-1 overflow-y-auto pr-0.5"
              style={{ scrollbarWidth: "thin" }}
            >
              {agent.activity.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
                  <LoaderCircleIcon size={11} className="animate-spin" />
                  Starting up…
                </div>
              ) : (
                agent.activity.map((entry, i) => (
                  <ActivityRow key={`${entry.time}-${entry.title}-${i}`} entry={entry} />
                ))
              )}

              {/* Blinking cursor while running */}
              {isRunning && (
                <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-2.5 py-1.5">
                  <span className="inline-block h-3 w-px animate-[blink_1s_step-end_infinite] bg-foreground/70" />
                  <span className="text-[10px] text-muted-foreground italic">agent is working…</span>
                </div>
              )}
            </div>

            {/* File scope */}
            {agent.files.length > 0 && (
              <div className="mt-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  File scope
                </p>
                <div className="flex flex-wrap gap-1">
                  {agent.files.map((file) => (
                    <span
                      key={file}
                      className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParallelAgentTimeline({
  agents,
  onStopAgent,
}: {
  agents: CodingAgentRun[];
  onStopAgent: (agentId: string) => void;
}) {
  const doneCount = agents.filter((a) => a.status === "done").length;
  const activeCount = agents.filter(
    (a) => a.status === "running" || a.status === "reviewing"
  ).length;
  const stoppedCount = agents.filter((a) => a.status === "stopped").length;
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);
  const maxDurationSeconds = Math.max(0, ...agents.map((a) => a.durationSeconds));

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-muted/40 via-background to-background shadow-sm ring-1 ring-border/60">
      <div className="border-b border-border bg-background/90 px-3 py-3 backdrop-blur-sm sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-foreground">
              Parallel coding agents
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Spawned workers report back here. Expand any row for a full trace.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
              <HashIcon size={11} className="opacity-70" />
              {formatTokenCount(totalTokens)} tok total
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-1 text-[10px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
              <Clock3Icon size={11} className="opacity-70" />
              Slowest {formatAgentDuration(maxDurationSeconds)}
            </span>
            <span className="inline-flex items-center rounded-md bg-foreground/5 px-2 py-1 text-[10px] font-medium text-foreground ring-1 ring-border">
              {doneCount} done
              {activeCount > 0 ? ` · ${activeCount} active` : ""}
              {stoppedCount > 0 ? ` · ${stoppedCount} stopped` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border bg-background/60">
        {agents.map((agent, index) => {
          const canStop =
            agent.status === "running" || agent.status === "reviewing";

          return (
            <Collapsible key={agent.id}>
              <div className="relative px-3 py-2.5 sm:px-4 sm:py-3">
                {index < agents.length - 1 && (
                  <span className="absolute left-[22px] top-10 hidden h-[calc(100%-1.25rem)] w-px bg-border sm:block" />
                )}
                <div className="relative flex items-start gap-2 sm:gap-3">
                  <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-2.5 text-left outline-none sm:gap-3">
                    <span className="z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                      <AgentStatusIcon status={agent.status} />
                    </span>
                    <span className="min-w-0 flex-1 pb-0.5">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[12px] font-semibold text-foreground">
                          {agent.name}
                        </span>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                            statusClasses[agent.status],
                          ].join(" ")}
                        >
                          {statusLabels[agent.status]}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                          <Clock3Icon size={11} />
                          {formatAgentDuration(agent.durationSeconds)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
                          <HashIcon size={11} />
                          {formatTokenCount(agent.tokensUsed)} tok
                        </span>
                        <ChevronDownIcon
                          size={14}
                          className="ml-auto shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 sm:ml-0"
                        />
                      </span>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                        {agent.task}
                      </p>
                      <span className="mt-2 flex items-center gap-2">
                        <Progress value={agent.progress} className="h-1.5" />
                        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                          {agent.progress}%
                        </span>
                      </span>
                    </span>
                  </CollapsibleTrigger>

                  {agent.sandboxId && (
                    <SandboxIdBadge sandboxId={agent.sandboxId} />
                  )}

                  {canStop && (
                    <button
                      type="button"
                      onClick={() => onStopAgent(agent.id)}
                      className="mt-1 shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-red-600 ring-1 ring-red-200/80 transition-colors hover:bg-red-50"
                    >
                      Stop
                    </button>
                  )}
                </div>

                <CollapsibleContent className="ml-0 mt-3 sm:ml-10 sm:pl-0">
                  <AgentConversation agent={agent} />
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// ─── Prompt attachments ───────────────────────────────────────────

function PromptAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) return null;

  return (
    <Attachments className="w-full" variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

// ─── Conversation loading skeleton ───────────────────────────────

function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Loading messages">
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
        <Skeleton className="h-4 w-[min(100%,18rem)] rounded-lg" />
        <Skeleton className="h-4 w-[min(100%,12rem)] rounded-lg" />
      </div>
      <div className="mr-auto flex max-w-[90%] flex-col items-start gap-2">
        <Skeleton className="h-4 w-[min(100%,22rem)] rounded-lg" />
        <Skeleton className="h-4 w-[min(100%,20rem)] rounded-lg" />
        <Skeleton className="h-4 w-[min(100%,14rem)] rounded-lg" />
      </div>
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
        <Skeleton className="h-4 w-[min(100%,16rem)] rounded-lg" />
      </div>
      <div className="mr-auto flex max-w-[90%] flex-col items-start gap-2">
        <Skeleton className="h-4 w-[min(100%,24rem)] rounded-lg" />
        <Skeleton className="h-4 w-[min(100%,10rem)] rounded-lg" />
      </div>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────

interface ChatPanelProps {
  /** Persisted messages from Convex + optional streaming message */
  messages: ChatMessage[];
  /** Convex messages query is still in flight for the active thread */
  isConversationLoading?: boolean;
  isStreaming: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSubmit: (text: string) => void;
  onStopAgent: (messageId: string, agentId: string) => void;
  onCopyAssistantText: (text: string) => void;
  onRegenerate: (messageId: string) => void;
  onFeedback: (messageId: string, sentiment: "up" | "down") => void;
}

export function ChatPanel({
  messages,
  isConversationLoading = false,
  isStreaming,
  selectedModel,
  onModelChange,
  onSubmit,
  onStopAgent,
  onCopyAssistantText,
  onRegenerate,
  onFeedback,
}: ChatPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleSubmit = useCallback(
    ({ text }: { text: string; files: unknown[] }) => {
      if (text.trim()) onSubmit(text);
    },
    [onSubmit]
  );

  return (
    <div className="grid h-full w-full grid-rows-[1fr_auto] overflow-hidden bg-background">
      {/* Messages */}
      <Conversation
        initial="instant"
        resize="instant"
        style={{ overflow: "hidden" }}
      >
        <ConversationContent className="mx-auto w-full max-w-2xl px-4 py-6">
          {isConversationLoading ? (
            <ConversationSkeleton />
          ) : (
            <>
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[15px] font-semibold text-foreground">
                How can SwarmAgents help?
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Ask anything. Plan, implement, review, or ship software.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <Message key={msg.id} from="user">
                  <MessageContent>
                    <p className="text-[14px] leading-relaxed">{msg.text}</p>
                  </MessageContent>
                </Message>
              );
            }

            const a = msg as AssistantMessage;
            return (
              <Message key={a.id} from="assistant">
                {a.reasoning && (
                  <Reasoning
                    isStreaming={a.isThinkingStreaming}
                    duration={a.thinkingDuration}
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>{a.reasoning}</ReasoningContent>
                  </Reasoning>
                )}

                <MessageContent>
                  {a.isThinkingStreaming && !a.text ? (
                    <Shimmer duration={1.5}>Thinking...</Shimmer>
                  ) : (
                    <MessageResponse isAnimating={isStreaming && a.isThinkingStreaming === false && a.id === "streaming"}>
                      {a.text}
                    </MessageResponse>
                  )}
                  {a.tools.length > 0 && <ToolCallList tools={a.tools} />}
                  {a.subAgents && a.subAgents.length > 0 && (
                    <ParallelAgentTimeline
                      agents={a.subAgents}
                      onStopAgent={(agentId) => onStopAgent(a.id, agentId)}
                    />
                  )}
                </MessageContent>

                {!a.isThinkingStreaming && a.id !== "streaming" && (
                  <MessageActions>
                    <MessageAction
                      tooltip={copiedId === a.id ? "Copied" : "Copy"}
                      size="icon-sm"
                      variant={copiedId === a.id ? "secondary" : "ghost"}
                      onClick={() => {
                        onCopyAssistantText(a.text);
                        setCopiedId(a.id);
                        window.setTimeout(() => setCopiedId((id) => (id === a.id ? null : id)), 2000);
                      }}
                    >
                      <CopyIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip={
                        a.canRegenerate
                          ? "Regenerate"
                          : "Only the latest assistant reply can be regenerated"
                      }
                      size="icon-sm"
                      variant="ghost"
                      disabled={!a.canRegenerate || isStreaming}
                      onClick={() => {
                        if (a.canRegenerate && !isStreaming) onRegenerate(a.id);
                      }}
                    >
                      <RefreshCwIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip="Good response"
                      size="icon-sm"
                      variant={a.feedback === "up" ? "secondary" : "ghost"}
                      onClick={() => onFeedback(a.id, "up")}
                    >
                      <ThumbsUpIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip="Bad response"
                      size="icon-sm"
                      variant={a.feedback === "down" ? "secondary" : "ghost"}
                      onClick={() => onFeedback(a.id, "down")}
                    >
                      <ThumbsDownIcon size={13} />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            );
          })}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt bar */}
      <div className="border-t border-border bg-background p-4">
        <div className="mx-auto w-full max-w-2xl">
          <PromptInput
            onSubmit={handleSubmit}
            multiple
            className="rounded-xl border border-border bg-muted/30 shadow-sm"
          >
            <PromptInputHeader className="px-3 pt-3 pb-0">
              <PromptAttachments />
            </PromptInputHeader>
            <PromptInputTextarea
              placeholder="Ask SwarmAgents anything..."
              className="min-h-12 bg-transparent px-4 py-3 text-[14px] placeholder:text-muted-foreground"
            />
            <PromptInputFooter className="px-3 py-2">
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger tooltip="Add attachment" />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments label="Attach files" />
                    <PromptInputActionMenuItem>
                      <SearchIcon size={14} className="mr-2" />
                      Search codebase
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>

                <ModelSelectorInput_
                  value={selectedModel}
                  onChange={onModelChange}
                />
              </PromptInputTools>
              <PromptInputSubmit
                status={isStreaming ? "streaming" : "ready"}
                className="h-7 w-7 rounded-lg"
              />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            SwarmAgents may make mistakes. Always review generated code.
          </p>
        </div>
      </div>
    </div>
  );
}
