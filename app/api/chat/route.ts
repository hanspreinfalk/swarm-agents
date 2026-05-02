import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateText, stepCountIs, streamText, tool } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { Sandbox } from "e2b";

// Agent sandboxes run in the background via after() — keep the route open for
// the initial LLM round-trip only (a few seconds), not the full sandbox run.
export const maxDuration = 60;

// ── Provider model mapping ────────────────────────────────────────────────

function getProviderModelId(modelId: string): string {
  if (!process.env.AI_GATEWAY_BASE_URL) return modelId;

  if (modelId.startsWith("gpt") || modelId.startsWith("o3") || modelId.startsWith("o4")) {
    return `openai/${modelId}`;
  }
  if (modelId.startsWith("claude")) {
    return `anthropic/${modelId}`;
  }
  if (modelId.startsWith("gemini")) {
    return `google/${modelId}`;
  }
  if (modelId.startsWith("deepseek")) {
    return `deepseek/${modelId}`;
  }
  if (modelId.startsWith("mistral")) {
    return `mistral/${modelId}`;
  }
  return modelId;
}

// ── Convex HTTP helper ────────────────────────────────────────────────────

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
const SWARM_SECRET = process.env.SWARM_INTERNAL_SECRET ?? "";

async function convexSwarm(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${CONVEX_SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SWARM_SECRET ? { "x-swarm-secret": SWARM_SECRET } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex swarm call failed (${path}): ${text}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────

type AgentTemplate = "opencode" | "claude";

type AgentTask = {
  name: string;
  task: string;
  assignedFiles: string[];
  agentTemplate: AgentTemplate;
};

type ProjectFile = {
  path: string;
  content: string;
  language?: string;
};

type AgentResult = {
  name: string;
  changedFiles: ProjectFile[];
  summary: string;
};

function inferLang(path: string): "typescript" | "javascript" | "python" {
  if (path.endsWith(".py")) return "python";
  if (
    path.endsWith(".js") ||
    path.endsWith(".jsx") ||
    path.endsWith(".mjs") ||
    path.endsWith(".cjs")
  )
    return "javascript";
  return "typescript";
}

// ── Write project files to sandbox workspace ─────────────────────────────

async function writeProjectFiles(
  sandbox: Sandbox,
  allFiles: ProjectFile[],
  workspace: string
): Promise<void> {
  // Write files in batches
  const batchSize = 25;
  for (let i = 0; i < allFiles.length; i += batchSize) {
    const batch = allFiles.slice(i, i + batchSize);
    await Promise.all(
      batch.map((f) => sandbox.files.write(`${workspace}/${f.path}`, f.content))
    );
  }
}

// ── Get changed files via git diff ───────────────────────────────────────

async function getChangedFiles(
  sandbox: Sandbox,
  workspace: string
): Promise<ProjectFile[]> {
  // Modified tracked files
  const diffResult = await sandbox.commands.run(
    `cd ${workspace} && git diff HEAD --name-only 2>/dev/null || true`
  );
  // New untracked files
  const untrackedResult = await sandbox.commands.run(
    `cd ${workspace} && git ls-files --others --exclude-standard 2>/dev/null || true`
  );

  const changedPaths = [
    ...diffResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean),
    ...untrackedResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean),
  ];

  const changedFiles: ProjectFile[] = [];
  for (const filePath of changedPaths) {
    try {
      const content = await sandbox.files.read(`${workspace}/${filePath}`);
      changedFiles.push({
        path: filePath,
        content: typeof content === "string" ? content : String(content),
        language: inferLang(filePath),
      });
    } catch {
      // Skip unreadable files
    }
  }
  return changedFiles;
}

// ── Connect to existing paused sandbox or create a fresh one ─────────────

async function getOrCreateSandbox(
  template: AgentTemplate,
  envs: Record<string, string>,
  existingSandboxId?: string
): Promise<Sandbox> {
  // Try to resume a paused sandbox first (faster, ~1s vs sandbox cold start)
  if (existingSandboxId) {
    try {
      const resumed = await Sandbox.connect(existingSandboxId, {
        timeoutMs: 8 * 60 * 1000,
      });
      return resumed;
    } catch {
      // Paused sandbox no longer available — fall through to create
    }
  }

  return await Sandbox.create(template, {
    envs,
    timeoutMs: 8 * 60 * 1000,
    requestTimeoutMs: 30_000,
    // Auto-pause instead of kill on timeout — preserves sandbox state cheaply
    lifecycle: {
      onTimeout: "pause",
    },
  });
}

// ── Typed activity kind ───────────────────────────────────────────────────

type ActivityKind =
  | "system"
  | "thinking"
  | "tool"
  | "file"
  | "command"
  | "text"
  | "result"
  | "error";

// ── Rate-limited activity emitter ─────────────────────────────────────────
// Keeps a local queue and flushes at most once per interval to avoid
// flooding Convex with hundreds of tiny mutations per second.

function makeActivityEmitter(agentId: string, intervalMs = 1200) {
  const queue: Array<{
    title: string;
    detail: string;
    kind: ActivityKind;
    progress?: number;
  }> = [];

  let flushing = false;

  async function flush() {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const entry = queue.shift()!;
    try {
      await convexSwarm("/swarm/update-agent", {
        agentId,
        ...(entry.progress !== undefined ? { progress: entry.progress } : {}),
        activityEntry: {
          time: new Date().toLocaleTimeString(),
          title: entry.title,
          detail: entry.detail,
          kind: entry.kind,
        },
      });
    } catch {
      // best-effort; never let a failed activity update crash the agent
    }
    flushing = false;
  }

  const timer = setInterval(() => void flush(), intervalMs);

  return {
    emit(title: string, detail: string, kind: ActivityKind, progress?: number) {
      // Replace the last entry if same kind+title (de-duplicate rapid same-type bursts)
      const last = queue[queue.length - 1];
      if (last && last.kind === kind && last.title === title) {
        last.detail = detail;
        if (progress !== undefined) last.progress = progress;
      } else {
        queue.push({ title, detail, kind, progress });
      }
    },
    async flush() {
      clearInterval(timer);
      // Drain remaining queue
      while (queue.length > 0) {
        await flush();
        await new Promise((r) => setTimeout(r, 100));
      }
    },
  };
}

// ── OpenCode agent (Gemini 2.5 Flash via opencode template) ──────────────

async function runOpenCodeAgent(
  task: AgentTask,
  agentId: string,
  allFiles: ProjectFile[],
  agentContext: string
): Promise<AgentResult> {
  const workspace = "/home/user/workspace";

  const sandbox = await getOrCreateSandbox("opencode", {
    GEMINI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
  });

  const sandboxId = sandbox.sandboxId;
  const { emit, flush } = makeActivityEmitter(agentId, 1000);

  await convexSwarm("/swarm/update-agent", {
    agentId,
    sandboxId,
    status: "running",
    progress: 5,
    activityEntry: {
      time: new Date().toLocaleTimeString(),
      title: "Sandbox ready",
      detail: `opencode · gemini-2.5-flash · ${sandboxId.slice(0, 12)}…`,
      kind: "system",
    },
  });

  try {
    // Init workspace
    await sandbox.commands.run(
      `mkdir -p ${workspace} && cd ${workspace} ` +
        `&& git init -q && git config user.email "agent@swarm" ` +
        `&& git config user.name "Swarm Agent"`
    );

    emit("Writing project files", `${allFiles.length} files…`, "system", 8);
    await writeProjectFiles(sandbox, allFiles, workspace);

    await sandbox.files.write(
      `${workspace}/SWARM_CONTEXT.md`,
      `# Agent Context\n\n${agentContext}\n\n## Your assigned files\n${task.assignedFiles.join("\n") || "Any files needed"}`
    );

    await sandbox.commands.run(
      `cd ${workspace} && git add -A && git commit -m "initial state" -q --allow-empty`
    );

    // Pin model to gemini-2.5-flash via OpenCode config
    await sandbox.files.write(
      "/home/user/.config/opencode/config.json",
      JSON.stringify({ model: "google/gemini-2.5-flash" }, null, 2)
    );

    emit("Workspace ready", `${allFiles.length} files committed, gemini-2.5-flash configured`, "system", 15);

    const assignedScope =
      task.assignedFiles.length > 0
        ? `Focus only on these files/directories: ${task.assignedFiles.join(", ")}.`
        : "You may work on any files needed.";

    const instruction =
      `${task.task}\n\n${assignedScope}\n\n` +
      `Read SWARM_CONTEXT.md for coordination context. ` +
      `Do not modify files outside your assigned scope.`;

    // OpenCode stdout is mostly human-readable lines that look like:
    //   ✓ Read file: src/api/handler.ts
    //   ✓ Wrote file: src/api/handler.ts
    //   > Running: npm test
    //   Thinking: …
    const opencodeLine = (line: string) => {
      const t = line.trim();
      if (!t || t.length < 3) return;

      // Classify the line by prefix/keyword
      const lower = t.toLowerCase();
      let kind: ActivityKind = "text";
      let title = "OpenCode";

      if (lower.includes("read") && (lower.includes("file") || lower.includes("src") || lower.includes("/"))) {
        kind = "file";
        title = "Reading file";
      } else if (lower.includes("writ") && (lower.includes("file") || lower.includes("src") || lower.includes("/"))) {
        kind = "file";
        title = "Writing file";
      } else if (lower.startsWith(">") || lower.includes("running") || lower.includes("exec") || lower.includes("$ ")) {
        kind = "command";
        title = "Running command";
      } else if (lower.includes("think") || lower.includes("plan") || lower.includes("analyz") || lower.includes("consider")) {
        kind = "thinking";
        title = "Thinking";
      } else if (lower.includes("error") || lower.includes("failed") || lower.includes("exception")) {
        kind = "error";
        title = "Error";
      } else if (t.length > 20) {
        kind = "text";
        title = "OpenCode";
      }

      emit(title, t.slice(0, 200), kind);
    };

    const cmdResult = await sandbox.commands.run(
      `cd ${workspace} && opencode run "${instruction.replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
      {
        timeoutMs: 6 * 60 * 1000,
        onStdout: (data) => {
          for (const line of data.split("\n")) opencodeLine(line);
        },
        onStderr: (data) => {
          for (const line of data.split("\n")) {
            const t = line.trim();
            if (t.length > 3) emit("stderr", t.slice(0, 200), "error");
          }
        },
      }
    );

    emit("Collecting changes", "Running git diff…", "system", 87);

    const changedFiles = await getChangedFiles(sandbox, workspace);

    // Flush remaining queued activity before finalising
    await flush();

    await sandbox.pause();

    const summary =
      `OpenCode (gemini-2.5-flash): ${changedFiles.length} file(s) changed. ` +
      (cmdResult.stdout.slice(-300) || "Task completed.");

    await convexSwarm("/swarm/update-agent", {
      agentId,
      status: "done",
      progress: 100,
      result: summary.slice(0, 500),
      activityEntry: {
        time: new Date().toLocaleTimeString(),
        title: `Done — sandbox paused`,
        detail: `${changedFiles.length} file(s) changed · sandbox ${sandboxId.slice(0, 12)}… paused`,
        kind: "result",
      },
    });

    return { name: task.name, changedFiles, summary: summary.slice(0, 500) };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await flush();
    await sandbox.kill().catch(() => undefined);
    await convexSwarm("/swarm/update-agent", {
      agentId,
      status: "error",
      error: errorMsg,
      activityEntry: {
        time: new Date().toLocaleTimeString(),
        title: "Error — sandbox killed",
        detail: errorMsg.slice(0, 200),
        kind: "error",
      },
    });
    return { name: task.name, changedFiles: [], summary: `Error: ${errorMsg}` };
  }
}

// ── Claude Code agent (Anthropic via claude template) ───────────────────

// Claude Code stream-json event shapes
type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

type ClaudeEvent =
  | { type: "system"; subtype: "init"; session_id: string }
  | { type: "assistant"; message: { content: ClaudeContentBlock[] } }
  | { type: "tool_result"; content: Array<{ type: string; text?: string }> }
  | { type: "result"; subtype: string; duration_ms: number; usage?: { input_tokens: number; output_tokens: number } };

async function runClaudeCodeAgent(
  task: AgentTask,
  agentId: string,
  allFiles: ProjectFile[],
  agentContext: string
): Promise<AgentResult> {
  const workspace = "/home/user/workspace";

  const sandbox = await getOrCreateSandbox("claude", {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  });

  const sandboxId = sandbox.sandboxId;
  const { emit, flush } = makeActivityEmitter(agentId, 800);

  await convexSwarm("/swarm/update-agent", {
    agentId,
    sandboxId,
    status: "running",
    progress: 5,
    activityEntry: {
      time: new Date().toLocaleTimeString(),
      title: "Sandbox ready",
      detail: `claude-code · Anthropic · ${sandboxId.slice(0, 12)}…`,
      kind: "system",
    },
  });

  try {
    await sandbox.commands.run(
      `mkdir -p ${workspace} && cd ${workspace} ` +
        `&& git init -q && git config user.email "agent@swarm" ` +
        `&& git config user.name "Swarm Agent"`
    );

    emit("Writing project files", `${allFiles.length} files…`, "system", 8);
    await writeProjectFiles(sandbox, allFiles, workspace);

    // SWARM_CONTEXT.md: shared coordination context
    await sandbox.files.write(
      `${workspace}/SWARM_CONTEXT.md`,
      `# Agent Context\n\n${agentContext}\n\n## Assigned files\n${task.assignedFiles.join("\n") || "Any files needed"}`
    );

    // CLAUDE.md: project instructions Claude Code reads automatically
    await sandbox.files.write(
      `${workspace}/CLAUDE.md`,
      `# Swarm Agent\n\n${agentContext}\n\n## Task\n${task.task}\n\n## Scope\n${task.assignedFiles.join("\n") || "Any"}\n\nDo NOT modify files outside your scope.`
    );

    await sandbox.commands.run(
      `cd ${workspace} && git add -A && git commit -m "initial state" -q --allow-empty`
    );

    emit("Workspace ready", `${allFiles.length} files committed, CLAUDE.md injected`, "system", 15);

    const assignedScope =
      task.assignedFiles.length > 0
        ? `Focus only on: ${task.assignedFiles.join(", ")}.`
        : "";

    const instruction =
      `${task.task} ${assignedScope}`.trim().replace(/"/g, '\\"').replace(/\n/g, " ");

    let tokensUsed = 0;

    const cmdResult = await sandbox.commands.run(
      `cd ${workspace} && claude --dangerously-skip-permissions ` +
        `--output-format stream-json -p "${instruction}"`,
      {
        timeoutMs: 6 * 60 * 1000,
        onStdout: (data) => {
          for (const rawLine of data.split("\n")) {
            const line = rawLine.trim();
            if (!line) continue;
            let event: ClaudeEvent;
            try {
              event = JSON.parse(line) as ClaudeEvent;
            } catch {
              // plain-text fallback
              if (line.length > 5) emit("Claude Code", line.slice(0, 200), "text");
              continue;
            }

            if (event.type === "system" && event.subtype === "init") {
              emit("Session started", `session ${event.session_id.slice(0, 12)}…`, "system");
            } else if (event.type === "assistant" && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "thinking" && block.thinking?.trim()) {
                  emit("Thinking", block.thinking.slice(0, 250), "thinking");
                } else if (block.type === "text" && block.text?.trim()) {
                  emit("Claude Code", block.text.slice(0, 250), "text");
                } else if (block.type === "tool_use") {
                  const toolName = block.name ?? "unknown";
                  // Classify by tool name
                  let kind: ActivityKind = "tool";
                  let title = `Tool: ${toolName}`;
                  if (toolName === "Read" || toolName === "read_file" || toolName === "view") {
                    kind = "file";
                    title = `Reading: ${String(block.input?.path ?? block.input?.file_path ?? "file")}`;
                  } else if (toolName === "Write" || toolName === "write_file" || toolName === "create") {
                    kind = "file";
                    title = `Writing: ${String(block.input?.path ?? block.input?.file_path ?? "file")}`;
                  } else if (toolName === "Edit" || toolName === "MultiEdit" || toolName === "str_replace") {
                    kind = "file";
                    title = `Editing: ${String(block.input?.path ?? block.input?.file_path ?? "file")}`;
                  } else if (toolName === "Bash" || toolName === "bash" || toolName === "run_command") {
                    kind = "command";
                    title = `$ ${String(block.input?.command ?? block.input?.cmd ?? "").slice(0, 80)}`;
                  } else if (toolName === "TodoWrite" || toolName === "TodoRead") {
                    kind = "thinking";
                    title = `Planning (${toolName})`;
                  } else if (toolName === "Glob" || toolName === "LS" || toolName === "Search" || toolName === "Grep") {
                    kind = "tool";
                    title = `Searching (${toolName})`;
                  }
                  const detail = JSON.stringify(block.input ?? {}).slice(0, 150);
                  emit(title, detail, kind);
                }
              }
            } else if (event.type === "tool_result" && event.content) {
              const text = event.content
                .filter((c) => c.type === "text")
                .map((c) => c.text ?? "")
                .join("")
                .trim()
                .slice(0, 150);
              if (text) emit("Tool result", text, "tool");
            } else if (event.type === "result") {
              tokensUsed =
                (event.usage?.input_tokens ?? 0) + (event.usage?.output_tokens ?? 0);
              emit(
                `Finished (${event.subtype})`,
                `${event.duration_ms}ms · ${tokensUsed} tokens`,
                "result",
                87
              );
            }
          }
        },
        onStderr: (data) => {
          for (const line of data.split("\n")) {
            const t = line.trim();
            if (t.length > 3) emit("stderr", t.slice(0, 200), "error");
          }
        },
      }
    );

    emit("Collecting changes", "Running git diff…", "system", 90);
    const changedFiles = await getChangedFiles(sandbox, workspace);

    await flush();
    await sandbox.pause();

    const summary =
      `Claude Code: ${changedFiles.length} file(s) changed. ` +
      (cmdResult.stdout.slice(-300) || "Task completed.");

    await convexSwarm("/swarm/update-agent", {
      agentId,
      status: "done",
      progress: 100,
      tokensUsed,
      result: summary.slice(0, 500),
      activityEntry: {
        time: new Date().toLocaleTimeString(),
        title: "Done — sandbox paused",
        detail: `${changedFiles.length} file(s) changed · sandbox ${sandboxId.slice(0, 12)}… paused`,
        kind: "result",
      },
    });

    return { name: task.name, changedFiles, summary: summary.slice(0, 500) };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await flush();
    await sandbox.kill().catch(() => undefined);
    await convexSwarm("/swarm/update-agent", {
      agentId,
      status: "error",
      error: errorMsg,
      activityEntry: {
        time: new Date().toLocaleTimeString(),
        title: "Error — sandbox killed",
        detail: errorMsg.slice(0, 200),
        kind: "error",
      },
    });
    return { name: task.name, changedFiles: [], summary: `Error: ${errorMsg}` };
  }
}

// ── Dispatcher: routes to the right agent template ───────────────────────

function runSpawnedAgent(
  task: AgentTask,
  agentId: string,
  allFiles: ProjectFile[],
  agentContext: string
): Promise<AgentResult> {
  if (task.agentTemplate === "claude") {
    return runClaudeCodeAgent(task, agentId, allFiles, agentContext);
  }
  return runOpenCodeAgent(task, agentId, allFiles, agentContext);
}

// ── Merge agent: reconcile all agent outputs ─────────────────────────────

async function runMergeAgent(
  agentResults: AgentResult[],
  baseFiles: ProjectFile[]
): Promise<ProjectFile[]> {
  const fileMap = new Map<string, string>();
  for (const f of baseFiles) fileMap.set(f.path, f.content);

  const changesByFile = new Map<
    string,
    Array<{ agentName: string; content: string }>
  >();
  for (const result of agentResults) {
    for (const file of result.changedFiles) {
      const existing = changesByFile.get(file.path) ?? [];
      existing.push({ agentName: result.name, content: file.content });
      changesByFile.set(file.path, existing);
    }
  }

  // Non-conflicting changes apply directly
  const conflicts: Array<{
    path: string;
    versions: Array<{ agentName: string; content: string }>;
  }> = [];

  for (const [path, versions] of changesByFile.entries()) {
    if (versions.length === 1) {
      fileMap.set(path, versions[0].content);
    } else {
      conflicts.push({ path, versions });
    }
  }

  // Use Gemini to resolve conflicts (smart merge)
  if (conflicts.length > 0) {
    const geminiModel = google("gemini-2.5-flash-preview-04-17");
    for (const conflict of conflicts) {
      const base = fileMap.get(conflict.path) ?? "(new file)";
      const prompt =
        `Multiple agents changed the same file. Merge their changes intelligently.\n\n` +
        `File: ${conflict.path}\n` +
        `Base:\n${base}\n\n` +
        conflict.versions
          .map((v) => `=== ${v.agentName} ===\n${v.content}`)
          .join("\n\n") +
        `\n\nReturn ONLY the merged file content, no explanation.`;

      const mergeResult = await generateText({
        model: geminiModel,
        messages: [{ role: "user", content: prompt }],
        maxOutputTokens: 8000,
      });
      fileMap.set(conflict.path, mergeResult.text);
    }
  }

  return Array.from(fileMap.entries()).map(([path, content]) => ({
    path,
    content,
    language: inferLang(path),
  }));
}

// ── Main POST handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
  const {
    messages,
    model = "gpt-4.1",
    projectId,
    threadId,
    projectFiles = [],
  } = (await request.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    model?: string;
    projectId?: string;
    threadId?: string;
    projectFiles?: ProjectFile[];
  };

  const openai = createOpenAI({
    apiKey: process.env.AI_GATEWAY_TOKEN ?? process.env.OPENAI_API_KEY ?? "",
    baseURL: process.env.AI_GATEWAY_BASE_URL,
  });

  // Gemini models must use @ai-sdk/google directly — the Vercel AI Gateway's
  // /v1/responses endpoint rejects the `output` field in tool-result messages
  // that the OpenAI-compatible provider sends during multi-step tool calls.
  const resolvedModel = model.startsWith("gemini")
    ? google(model)
    : openai(getProviderModelId(model));

  const fileListSummary =
    projectFiles.length > 0
      ? `\n\nProject has ${projectFiles.length} files: ${projectFiles
          .map((f) => f.path)
          .slice(0, 20)
          .join(", ")}${projectFiles.length > 20 ? "…" : ""}`
      : "";

  const hasGeminiKey = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const availableTemplates = [
    hasGeminiKey ? '"opencode" (Gemini 2.5 Flash)' : null,
    hasAnthropicKey ? '"claude" (Claude Code)' : null,
  ]
    .filter(Boolean)
    .join(", ");

  const result = streamText({
    model: resolvedModel,
    messages,
    system:
      `You are SwarmAgents, an AI coding assistant that spawns parallel E2B sandbox agents to implement tasks.${fileListSummary}\n\n` +
      `ALWAYS use the spawn_agents tool for ANY coding task — including simple edits, refactors, and new features.\n` +
      `If the user says "call opencode", "use opencode", "spawn agent", or asks you to modify code, ALWAYS call spawn_agents.\n` +
      `Available agent templates: ${availableTemplates || "none configured — spawn_agents will still create sandbox records"}.\n` +
      `Guidelines:\n` +
      `- Create 2–3 focused sub-tasks, each with a non-overlapping file scope\n` +
      `- For simple single-file edits, still use 2 agents (one to edit, one to verify)\n` +
      `- Each task description must be self-contained and specific\n` +
      `- Briefly describe your plan BEFORE the tool call (1-2 sentences)`,
    tools: {
      spawn_agents: tool({
        description:
          "Spawn multiple parallel coding agents — each runs in its own E2B sandbox (OpenCode with Gemini 2.5 Flash or Claude Code) and implements a scoped sub-task. Sandboxes are paused after completion for cost efficiency and can be resumed. Results are merged and saved back to the project.",
        inputSchema: z.object({
          plan: z
            .string()
            .describe("Overall implementation plan and how work is divided"),
          tasks: z
            .array(
              z.object({
                name: z.string().describe("Short agent name, e.g. 'API Layer Agent'"),
                task: z
                  .string()
                  .describe("Detailed, self-contained task description"),
                assignedFiles: z
                  .array(z.string())
                  .describe(
                    "File paths or directory prefixes this agent owns (empty = unrestricted)"
                  ),
                agentTemplate: z
                  .enum(["opencode", "claude"])
                  .describe(
                    '"opencode" uses OpenCode + Gemini 2.5 Flash; "claude" uses Claude Code + Anthropic'
                  ),
              })
            )
            .min(2)
            .max(5),
        }),
        execute: async (input) => {
          const { plan, tasks } = input;

          if (!threadId) {
            return {
              error: "No active thread — cannot spawn agents without a threadId.",
            };
          }

          // 1. Create swarm run + per-agent records in Convex (fast, ~1s)
          let createResult: { swarmRunId: string; agentIds: string[] };
          try {
            createResult = (await convexSwarm("/swarm/create-run", {
              threadId,
              ...(projectId ? { projectId } : {}),
              plan,
              tasks,
            })) as { swarmRunId: string; agentIds: string[] };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[spawn_agents] Failed to create swarm run:", msg);
            return { error: `Could not reach Convex to create swarm run: ${msg}` };
          }

          const { swarmRunId, agentIds } = createResult;

          const agentContext =
            `Overall plan: ${plan}\n\n` +
            `Parallel agents (do NOT touch their files):\n` +
            tasks
              .map(
                (t) =>
                  `- [${t.agentTemplate.toUpperCase()}] ${t.name}: ${t.task.slice(0, 80)}… → ${t.assignedFiles.join(", ") || "unrestricted"}`
              )
              .join("\n");

          // 2. Run the heavy sandbox work AFTER the HTTP response completes.
          //    next/server after() keeps the work alive on Vercel / next dev
          //    without blocking the LLM stream.
          after(async () => {
            try {
              await convexSwarm("/swarm/update-run", { swarmRunId, status: "running" });

              const agentResults = await Promise.all(
                tasks.map((task, i) =>
                  runSpawnedAgent(task, agentIds[i], projectFiles, agentContext)
                )
              );

              await convexSwarm("/swarm/update-run", { swarmRunId, status: "merging" });

              const mergedFiles = await runMergeAgent(agentResults, projectFiles);

              if (projectId && mergedFiles.length > 0) {
                await convexSwarm("/swarm/save-files", {
                  projectId,
                  files: mergedFiles.map((f) => ({
                    path: f.path,
                    content: f.content,
                    language: f.language ?? inferLang(f.path),
                  })),
                });
              }

              await convexSwarm("/swarm/update-run", { swarmRunId, status: "done" });
            } catch (err) {
              console.error("[spawn_agents] Background run failed:", err);
              await convexSwarm("/swarm/update-run", { swarmRunId, status: "error" }).catch(() => undefined);
            }
          });

          // 3. Return immediately — agents are queued and will report progress
          //    via Convex reactive subscriptions in the UI.
          return {
            swarmRunId,
            agentCount: tasks.length,
            agentNames: tasks.map((t) => t.name),
            message: `${tasks.length} agent(s) launched and running in parallel E2B sandboxes. Watch their live progress in the agent timeline below.`,
          };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toTextStreamResponse();
}
