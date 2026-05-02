import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { Id } from "./_generated/dataModel";

type ProjectFileInput = {
  path: string;
  content: string;
  language: "typescript" | "javascript" | "python";
  sha?: string;
  size?: number;
};

const http = httpRouter();

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserPayload = {
  id?: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

function getWebhookUser(data: Record<string, unknown>) {
  const user = data as ClerkUserPayload;
  const clerkId = user.id;

  if (!clerkId) {
    return null;
  }

  const primaryEmail = user.email_addresses?.find(
    (email) => email.id === user.primary_email_address_id,
  );
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown";

  return {
    clerkId,
    fullName,
    email: primaryEmail?.email_address ?? "",
    ...(user.image_url ? { pictureUrl: user.image_url } : {}),
  };
}

http.route({
  path: "/clerk/webhook/user",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Read body as text for signature verification
    const body = await req.text();

    // Collect Svix headers
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing Svix headers", { status: 400 });
    }

    // Verify signature
    let event: { type: string; data: Record<string, unknown> };
    try {
      const wh = new Webhook(webhookSecret);
      event = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as { type: string; data: Record<string, unknown> };
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const { type, data } = event;

    // ── user.created ──────────────────────────────────────────────────────
    if (type === "user.created") {
      const user = getWebhookUser(data);
      if (!user) {
        return new Response("Missing Clerk user id", { status: 400 });
      }

      await ctx.runMutation(internal.users.createUserFromWebhook, user);
    }

    // ── user.updated ──────────────────────────────────────────────────────
    else if (type === "user.updated") {
      const user = getWebhookUser(data);
      if (!user) {
        return new Response("Missing Clerk user id", { status: 400 });
      }

      await ctx.runMutation(internal.users.updateUserFromWebhook, user);
    }

    // ── user.deleted ──────────────────────────────────────────────────────
    else if (type === "user.deleted") {
      const clerkId = data.id;
      if (typeof clerkId !== "string") {
        return new Response("Missing Clerk user id", { status: 400 });
      }

      await ctx.runMutation(internal.users.deleteUserFromWebhook, { clerkId });
    }

    return new Response(null, { status: 200 });
  }),
});

// ── Internal swarm status update endpoints (called from Next.js chat route) ─

function checkSwarmSecret(req: Request): boolean {
  const secret = process.env.SWARM_INTERNAL_SECRET;
  if (!secret) return true; // allow if not configured (dev mode)
  return req.headers.get("x-swarm-secret") === secret;
}

http.route({
  path: "/swarm/create-run",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSwarmSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await req.json() as {
      threadId: string;
      projectId?: string;
      plan: string;
      tasks: Array<{
        name: string;
        task: string;
        assignedFiles: string[];
        agentTemplate: "opencode" | "claude";
      }>;
    };
    const result = await ctx.runMutation(internal.swarm.createSwarmRun, {
      threadId: body.threadId as Id<"threads">,
      ...(body.projectId ? { projectId: body.projectId as Id<"projects"> } : {}),
      plan: body.plan,
      tasks: body.tasks.map((t) => ({
        name: t.name,
        task: t.task,
        assignedFiles: t.assignedFiles,
        agentTemplate: t.agentTemplate ?? "opencode",
      })),
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/swarm/update-agent",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSwarmSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await req.json() as {
      agentId: string;
      status?: "queued" | "running" | "done" | "error";
      progress?: number;
      tokensUsed?: number;
      result?: string;
      sandboxId?: string;
      activityEntry?: {
        time: string;
        title: string;
        detail: string;
        kind?: "system" | "thinking" | "tool" | "file" | "command" | "text" | "result" | "error";
      };
      error?: string;
    };
    await ctx.runMutation(internal.swarm.updateSpawnedAgent, {
      agentId: body.agentId as Id<"spawnedAgents">,
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.progress !== undefined ? { progress: body.progress } : {}),
      ...(body.tokensUsed !== undefined ? { tokensUsed: body.tokensUsed } : {}),
      ...(body.result !== undefined ? { result: body.result } : {}),
      ...(body.sandboxId !== undefined ? { sandboxId: body.sandboxId } : {}),
      ...(body.activityEntry !== undefined ? { activityEntry: body.activityEntry } : {}),
      ...(body.error !== undefined ? { error: body.error } : {}),
    });
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/swarm/update-run",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSwarmSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await req.json() as {
      swarmRunId: string;
      status?: "running" | "merging" | "done" | "error";
      totalTokens?: number;
    };
    await ctx.runMutation(internal.swarm.updateSwarmRun, {
      swarmRunId: body.swarmRunId as Id<"swarmRuns">,
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.totalTokens !== undefined ? { totalTokens: body.totalTokens } : {}),
    });
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/swarm/save-files",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!checkSwarmSecret(req)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await req.json() as {
      projectId: string;
      files: ProjectFileInput[];
    };
    await ctx.runMutation(internal.threads.replaceProjectFilesInternal, {
      projectId: body.projectId as Id<"projects">,
      files: body.files,
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
