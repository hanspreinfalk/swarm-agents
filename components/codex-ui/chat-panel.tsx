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
  CopyIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { ModelSelectorInput_ } from "./model-selector-input";
import type {
  AssistantMessage,
  ChatMessage,
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
  running: "bg-blue-50 text-blue-600 ring-blue-200",
  reviewing: "bg-amber-50 text-amber-700 ring-amber-200",
  done: "bg-green-50 text-green-600 ring-green-200",
  stopped: "bg-red-50 text-red-600 ring-red-200",
};

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

function AgentConversation({ agent }: { agent: CodingAgentRun }) {
  const finalUpdate = agent.updates[agent.updates.length - 1];

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {agent.name}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {agent.elapsed} elapsed · {agent.files.length} files scoped
            </p>
          </div>
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

      <div className="space-y-4 p-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
            M
          </div>
          <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2.5">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              Main agent assigned task
            </div>
            <p className="text-[13px] leading-relaxed text-foreground">
              {agent.task}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-600 ring-1 ring-blue-200">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="rounded-xl border border-border bg-white px-3 py-2.5">
              <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                {agent.name}
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">
                I’ll take this slice independently, inspect the relevant files,
                and report progress back to the main agent.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {agent.activity.map((entry) => (
                <div
                  key={`${entry.time}-${entry.title}`}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <SearchIcon
                      size={13}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {entry.time}
                    </span>
                    <span className="truncate text-[12px] font-medium text-foreground">
                      {entry.title}
                    </span>
                  </div>
                  <p className="mt-1 pl-10 text-[12px] leading-relaxed text-muted-foreground">
                    {entry.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border bg-white px-3 py-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {agent.files.map((file) => (
                  <span
                    key={file}
                    className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {file}
                  </span>
                ))}
              </div>
              <p className="text-[12px] leading-relaxed text-foreground">
                {agent.status === "stopped"
                  ? "Stopped before finishing. The partial activity above is preserved for review."
                  : finalUpdate}
              </p>
            </div>
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
  const completedCount = agents.filter((agent) => agent.status === "done").length;

  return (
    <div className="mt-4 rounded-xl border border-border bg-white shadow-sm">
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              Parallel coding agents
            </p>
            <p className="text-[11px] text-muted-foreground">
              Main agent spawned {agents.length} coding agents across the task.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {completedCount}/{agents.length} done
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {agents.map((agent, index) => {
          const canStop =
            agent.status === "running" || agent.status === "reviewing";

          return (
            <Collapsible key={agent.id}>
              <div className="relative px-3 py-2.5">
              {index < agents.length - 1 && (
                <span className="absolute left-[21px] top-8 h-[calc(100%-1rem)] w-px bg-border" />
              )}

                <div className="relative flex items-start gap-2">
                  <CollapsibleTrigger className="group flex min-w-0 flex-1 items-start gap-3 text-left outline-none">
                    <span className="z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-border">
                      <AgentStatusIcon status={agent.status} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">
                          {agent.name} · {agent.task}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                              statusClasses[agent.status],
                            ].join(" ")}
                          >
                            {statusLabels[agent.status]}
                          </span>
                          <ChevronDownIcon
                            size={14}
                            className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                          />
                        </span>
                      </span>

                      <span className="mt-2 flex items-center gap-2">
                        <Progress value={agent.progress} className="h-1.5" />
                        <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">
                          {agent.progress}%
                        </span>
                      </span>
                    </span>
                  </CollapsibleTrigger>

                  {canStop && (
                    <button
                      type="button"
                      onClick={() => onStopAgent(agent.id)}
                      className="mt-0.5 shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50"
                    >
                      Stop
                    </button>
                  )}
                </div>

              <CollapsibleContent className="ml-7 mt-3">
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

  if (attachments.files.length === 0) {
    return null;
  }

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

// ─── Chat panel ───────────────────────────────────────────────────

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSubmit: (text: string) => void;
  onStopAgent: (messageId: string, agentId: string) => void;
}

export function ChatPanel({
  messages,
  isStreaming,
  onSubmit,
  onStopAgent,
}: ChatPanelProps) {
  const [selectedModel, setSelectedModel] = useState("gpt-4.1");

  const handleSubmit = useCallback(
    ({ text }: { text: string; files: unknown[] }) => {
      if (text.trim()) onSubmit(text);
    },
    [onSubmit]
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "1fr auto",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "white",
      }}
    >
      {/* Messages — fills the 1fr grid row */}
      <Conversation
        initial="instant"
        resize="instant"
        style={{ overflow: "hidden" }}
      >
        <ConversationContent className="mx-auto w-full max-w-2xl px-4 py-6">
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
                {(a.reasoning || a.isThinkingStreaming) && (
                  <Reasoning
                    isStreaming={a.isThinkingStreaming}
                    duration={a.thinkingDuration}
                  >
                    <ReasoningTrigger />
                    {a.reasoning && (
                      <ReasoningContent>{a.reasoning}</ReasoningContent>
                    )}
                  </Reasoning>
                )}

                <MessageContent>
                  {a.isThinkingStreaming && !a.text ? (
                    <Shimmer duration={1.5}>Thinking...</Shimmer>
                  ) : (
                    <MessageResponse isAnimating={isStreaming}>
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

                {!a.isThinkingStreaming && (
                  <MessageActions>
                    <MessageAction tooltip="Copy" size="icon-sm" variant="ghost">
                      <CopyIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip="Regenerate"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <RefreshCwIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip="Good response"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <ThumbsUpIcon size={13} />
                    </MessageAction>
                    <MessageAction
                      tooltip="Bad response"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <ThumbsDownIcon size={13} />
                    </MessageAction>
                  </MessageActions>
                )}
              </Message>
            );
          })}

          {/* Live shimmer when waiting for first response token */}
          {isStreaming && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer duration={1.5}>Thinking...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Prompt bar — auto-height grid row, sticks to bottom */}
      <div className="border-t border-border bg-white p-4">
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

                {/* Model selector — sits in the tools row */}
                <ModelSelectorInput_
                  value={selectedModel}
                  onChange={setSelectedModel}
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
