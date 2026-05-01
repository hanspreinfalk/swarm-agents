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

export interface CodingAgentActivity {
  time: string;
  title: string;
  detail: string;
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
