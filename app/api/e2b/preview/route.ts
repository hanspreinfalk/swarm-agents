import { Sandbox } from "e2b";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreviewFile = {
  path: string;
  content: string;
};

type PreviewRequestBody = {
  files?: PreviewFile[];
  projectKey?: string;
};

type PreviewSession = {
  sandboxId: string;
  initialized: boolean;
};

type ProgressEvent = {
  type: "progress";
  stage: string;
  message: string;
  filesProcessed?: number;
  filesTotal?: number;
};

type ReadyEvent = {
  type: "ready";
  url: string;
  sandboxId: string;
};

type ErrorEvent = {
  type: "error";
  error: string;
};

type TerminalEvent = {
  type: "terminal";
  chunk: string;
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes
const PREVIEW_PORT = 3000;
const PROJECT_ROOT = "/home/user/workspace";
const PREVIEW_HEALTHCHECK_TIMEOUT_MS = 90_000; // 90 seconds
const PREVIEW_HEALTHCHECK_INTERVAL_MS = 1_500; // 1.5 seconds
const SANDBOX_REQUEST_TIMEOUT_MS = 12 * 60 * 1_000; // 12 minutes
const FILE_WRITE_BATCH_SIZE = 60;

const globalState = globalThis as typeof globalThis & {
  __swarmPreviewSessions?: Map<string, PreviewSession>;
};

const previewSessions =
  globalState.__swarmPreviewSessions ??
  (globalState.__swarmPreviewSessions = new Map<string, PreviewSession>());

function sanitizeProjectKey(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return "default";
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 80) || "default";
}

function normalizeFilePath(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!normalized) return null;
  if (normalized.includes("..")) return null;
  if (normalized.includes("\u0000")) return null;
  return normalized;
}

function isPreviewProcess(cmd: string, args: string[]): boolean {
  const joined = `${cmd} ${args.join(" ")}`.toLowerCase();
  return joined.includes("npm run dev") || joined.includes("next dev");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPreview(url: string): Promise<boolean> {
  const deadline = Date.now() + PREVIEW_HEALTHCHECK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        // Independent per-attempt timeout so a slow/unresponsive server
        // doesn't block the loop indefinitely on a single request.
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status < 500) return true;
    } catch {
      // Keep polling until deadline — AbortError from the per-request
      // timeout is expected and handled here.
    }
    await sleep(PREVIEW_HEALTHCHECK_INTERVAL_MS);
  }

  // Return false instead of throwing so the caller can still deliver the
  // URL to the client even when the server didn't respond in time.
  return false;
}

function asChunk(data: string): string {
  return data.endsWith("\n") ? data : `${data}\n`;
}

/**
 * Minimal dotenv parser — handles:
 *   KEY=value
 *   KEY="quoted value"
 *   KEY='quoted value'
 *   # comments
 *   export KEY=value
 */
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIdx = withoutExport.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = withoutExport.slice(0, eqIdx).trim();
    if (!key || /\s/.test(key)) continue;
    let value = withoutExport.slice(eqIdx + 1);
    // Strip inline comment (only outside quotes)
    const commentMatch = value.match(/^(['"])(.*)\1\s*(?:#.*)?$/) ?? value.match(/^([^#]*?)(?:\s+#.*)?$/);
    if (commentMatch) {
      const quoted = value.match(/^(['"])(.*)\1/);
      value = quoted ? quoted[2] : (commentMatch[1] ?? value).trim();
    }
    result[key] = value;
  }
  return result;
}

/**
 * Collect env vars from project env files (in ascending priority order).
 * Later files override earlier ones. NODE_OPTIONS is reserved and always
 * set by us so we strip it from user-supplied values.
 */
function collectProjectEnvs(
  writeEntries: Array<{ path: string; data: string }>,
  projectRoot: string,
): Record<string, string> {
  const envFilePriority = [
    ".env",
    ".env.development",
    ".env.local",
    ".env.development.local",
  ];
  const byName = new Map(writeEntries.map((e) => [e.path, e.data]));
  const merged: Record<string, string> = {};
  for (const name of envFilePriority) {
    const content = byName.get(`${projectRoot}/${name}`);
    if (!content) continue;
    Object.assign(merged, parseEnvContent(content));
  }
  delete merged["NODE_OPTIONS"];
  return merged;
}

async function getOrCreateSandbox(key: string): Promise<{ sandbox: Sandbox; session: PreviewSession }> {
  const existing = previewSessions.get(key);
  if (existing) {
    try {
      const sandbox = await Sandbox.connect(existing.sandboxId, {
        requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
      });
      await sandbox.setTimeout(SESSION_TIMEOUT_MS);
      return { sandbox, session: existing };
    } catch {
      previewSessions.delete(key);
    }
  }

  const sandbox = await Sandbox.create("hanspreinfalk-base-more-memory", {
    timeoutMs: SESSION_TIMEOUT_MS,
    requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
  });
  const session: PreviewSession = {
    sandboxId: sandbox.sandboxId,
    initialized: false,
  };
  previewSessions.set(key, session);
  return { sandbox, session };
}

export async function POST(request: Request) {
  let body: PreviewRequestBody;
  try {
    body = (await request.json()) as PreviewRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incomingFiles = body.files ?? [];
  if (!Array.isArray(incomingFiles) || incomingFiles.length === 0) {
    return NextResponse.json({ error: "No files provided for preview." }, { status: 400 });
  }

  const writeEntries: Array<{ path: string; data: string }> = [];
  for (const file of incomingFiles) {
    const normalizedPath = normalizeFilePath(file.path);
    if (!normalizedPath) continue;
    writeEntries.push({
      path: `${PROJECT_ROOT}/${normalizedPath}`,
      data: file.content ?? "",
    });
  }
  if (writeEntries.length === 0) {
    return NextResponse.json({ error: "No valid files provided for preview." }, { status: 400 });
  }

  const key = sanitizeProjectKey(body.projectKey);
  const projectEnvs = collectProjectEnvs(writeEntries, PROJECT_ROOT);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ProgressEvent | ReadyEvent | ErrorEvent | TerminalEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      try {
        send({
          type: "progress",
          stage: "preparing",
          message: "Connecting to E2B sandbox...",
        });
        send({
          type: "terminal",
          chunk: "$ connect e2b sandbox\n",
        });

        const { sandbox, session } = await getOrCreateSandbox(key);
        send({
          type: "terminal",
          chunk: `connected: ${sandbox.sandboxId}\n`,
        });
        const envCount = Object.keys(projectEnvs).length;
        if (envCount > 0) {
          send({
            type: "terminal",
            chunk: `loaded ${envCount} env var${envCount === 1 ? "" : "s"} from project .env files\n`,
          });
        }
        send({
          type: "progress",
          stage: "preparing",
          message: "Connected. Uploading workspace files...",
          filesProcessed: 0,
          filesTotal: writeEntries.length,
        });

        await sandbox.files.makeDir(PROJECT_ROOT, {
          requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
        });

        for (let i = 0; i < writeEntries.length; i += FILE_WRITE_BATCH_SIZE) {
          const batch = writeEntries.slice(i, i + FILE_WRITE_BATCH_SIZE);
          await sandbox.files.write(batch, {
            requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
          });
          send({
            type: "progress",
            stage: "uploading",
            message: "Uploading files to sandbox...",
            filesProcessed: Math.min(i + batch.length, writeEntries.length),
            filesTotal: writeEntries.length,
          });
        }

        send({
          type: "progress",
          stage: "validating",
          message: "Checking project setup...",
          filesProcessed: writeEntries.length,
          filesTotal: writeEntries.length,
        });

        const hasPackageJson = await sandbox.files.exists(`${PROJECT_ROOT}/package.json`, {
          requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
        });
        if (!hasPackageJson) {
          throw new Error("Preview requires a package.json in the project files.");
        }

        if (!session.initialized) {
          send({
            type: "progress",
            stage: "installing",
            message: "Installing npm dependencies in sandbox...",
            filesProcessed: writeEntries.length,
            filesTotal: writeEntries.length,
          });
          send({
            type: "terminal",
            chunk:
              `$ cd ${PROJECT_ROOT}\n` +
              `$ NODE_OPTIONS=--max-old-space-size=1536 npm install --package-lock=false --omit=dev --no-fund --no-audit\n`,
          });
          const installResult = await sandbox.commands.run(
            "npm install --package-lock=false --omit=dev --no-fund --no-audit",
            {
              cwd: PROJECT_ROOT,
              timeoutMs: 0,
              requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
              envs: {
                ...projectEnvs,
                NODE_OPTIONS: "--max-old-space-size=1536",
              },
              onStdout(data) {
                send({ type: "terminal", chunk: asChunk(data) });
              },
              onStderr(data) {
                send({ type: "terminal", chunk: asChunk(data) });
              },
            }
          );
          if (installResult.exitCode !== 0) {
            throw new Error(
              installResult.error ||
              installResult.stderr ||
              installResult.stdout ||
              `npm install failed (exit ${installResult.exitCode})`
            );
          }
          send({
            type: "terminal",
            chunk: "npm install finished successfully.\n",
          });
          session.initialized = true;
        } else {
          send({
            type: "progress",
            stage: "installing",
            message: "Dependencies already installed for this sandbox.",
            filesProcessed: writeEntries.length,
            filesTotal: writeEntries.length,
          });
          send({
            type: "terminal",
            chunk: "dependencies already installed in this sandbox.\n",
          });
        }

        send({
          type: "progress",
          stage: "starting",
          message: "Starting preview server...",
          filesProcessed: writeEntries.length,
          filesTotal: writeEntries.length,
        });

        const processes = await sandbox.commands.list({
          requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
        });
        const previewProc = processes.find((process) => isPreviewProcess(process.cmd, process.args));

        const url = `https://${sandbox.getHost(PREVIEW_PORT)}`;

        if (!previewProc) {
          send({
            type: "terminal",
            chunk:
              `$ cd ${PROJECT_ROOT}\n` +
              `$ NODE_OPTIONS=--max-old-space-size=1536 npm run dev -- --hostname 0.0.0.0 --port ${PREVIEW_PORT}\n`,
          });

          // Run without background:true so every line of output streams
          // through the callbacks immediately — this is intentionally NOT
          // awaited because npm run dev never exits while the server is up.
          // Errors (e.g. "signal: killed") are forwarded to the terminal so
          // the user can see exactly what went wrong.
          void sandbox.commands.run(
            `npm run dev -- --hostname 0.0.0.0 --port ${PREVIEW_PORT}`,
            {
              cwd: PROJECT_ROOT,
              timeoutMs: 0,
              requestTimeoutMs: SANDBOX_REQUEST_TIMEOUT_MS,
              envs: {
                ...projectEnvs,
                NODE_OPTIONS: "--max-old-space-size=1536",
              },
              onStdout(data) {
                send({ type: "terminal", chunk: asChunk(data) });
              },
              onStderr(data) {
                send({ type: "terminal", chunk: asChunk(data) });
              },
            }
          ).then((result) => {
            const detail = result.error ?? (result.exitCode !== 0 ? `exit code ${result.exitCode}` : null);
            if (detail) {
              send({ type: "terminal", chunk: `\nnpm run dev exited: ${detail}\n` });
            }
          }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            send({ type: "terminal", chunk: `\nnpm run dev error: ${msg}\n` });
          });
        } else {
          send({
            type: "terminal",
            chunk: `preview server already running (pid ${previewProc.pid}), reconnecting...\n`,
          });
          void sandbox.commands.connect(previewProc.pid, {
            onStdout(data) { send({ type: "terminal", chunk: asChunk(data) }); },
            onStderr(data) { send({ type: "terminal", chunk: asChunk(data) }); },
          }).catch(() => {});
        }

        send({
          type: "progress",
          stage: "waiting",
          message: "Waiting for preview server to become ready...",
          filesProcessed: writeEntries.length,
          filesTotal: writeEntries.length,
        });

        const healthOk = await waitForPreview(url);
        send({
          type: "terminal",
          chunk: healthOk
            ? `preview ready at ${url}\n`
            : `health check timed out — sending URL anyway: ${url}\n`,
        });

        // Always send the ready event so the client can load the URL
        // regardless of whether the health check confirmed the server is up.
        send({
          type: "ready",
          url,
          sandboxId: sandbox.sandboxId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown E2B preview error.";
        send({
          type: "error",
          error: message,
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
