import type { CodeEditorLanguage } from "./code-editor";

export type { CodeEditorLanguage };

// ─── Chat message types ───────────────────────────────────────────

export interface ToolEntry {
  label: string;
  done: boolean;
}

export type CodingAgentStatus =
  | "queued"
  | "running"
  | "reviewing"
  | "done"
  | "stopped";

export type CodingAgentActivityKind =
  | "system"
  | "thinking"
  | "tool"
  | "file"
  | "command"
  | "text"
  | "result"
  | "error";

export interface CodingAgentActivity {
  time: string;
  title: string;
  detail: string;
  kind?: CodingAgentActivityKind;
}

export interface CodingAgentRun {
  id: string;
  name: string;
  task: string;
  status: CodingAgentStatus;
  progress: number;
  /** Wall time for this agent run (seconds). */
  durationSeconds: number;
  /** Total tokens consumed (input + output) for this agent. */
  tokensUsed: number;
  files: string[];
  updates: string[];
  activity: CodingAgentActivity[];
  /** E2B sandbox ID — set once the sandbox has started */
  sandboxId?: string;
}

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  reasoning?: string;
  isThinkingStreaming: boolean;
  thinkingDuration?: number;
  text: string;
  tools: ToolEntry[];
  subAgents?: CodingAgentRun[];
  /** Current user's thumbs feedback from `likedMessages`, if any */
  feedback?: "up" | "down";
  /** Only the latest persisted assistant turn can be regenerated */
  canRegenerate?: boolean;
}

export type ChatMessage = UserMessage | AssistantMessage;

// ─── Thread types ─────────────────────────────────────────────────

export interface ThreadItem {
  id: string;
  title: string;
  time: string;
}

export interface ThreadGroup {
  id: string;
  label: string;
  items: ThreadItem[];
}

// ─── Code file types ──────────────────────────────────────────────

export interface CodeFile {
  content: string;
  language: CodeEditorLanguage;
}
