import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const activityKindValidator = v.optional(
  v.union(
    v.literal("system"),
    v.literal("thinking"),
    v.literal("tool"),
    v.literal("file"),
    v.literal("command"),
    v.literal("text"),
    v.literal("result"),
    v.literal("error")
  )
);

const activityEntryValidator = v.object({
  time: v.string(),
  title: v.string(),
  detail: v.string(),
  kind: activityKindValidator,
});

const agentTemplateValidator = v.union(v.literal("opencode"), v.literal("claude"));

// ── Internal mutations (called via Convex HTTP actions from the chat route) ──

export const createSwarmRun = internalMutation({
  args: {
    threadId: v.id("threads"),
    projectId: v.optional(v.id("projects")),
    plan: v.string(),
    tasks: v.array(
      v.object({
        name: v.string(),
        task: v.string(),
        assignedFiles: v.array(v.string()),
        agentTemplate: agentTemplateValidator,
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const swarmRunId = await ctx.db.insert("swarmRuns", {
      threadId: args.threadId,
      ...(args.projectId !== undefined ? { projectId: args.projectId } : {}),
      status: "running",
      plan: args.plan,
      totalTokens: 0,
      startedAt: now,
      updatedAt: now,
    });

    const agentIds: Id<"spawnedAgents">[] = [];
    for (const task of args.tasks) {
      const agentId = await ctx.db.insert("spawnedAgents", {
        swarmRunId,
        name: task.name,
        task: task.task,
        assignedFiles: task.assignedFiles,
        agentTemplate: task.agentTemplate,
        status: "queued",
        progress: 0,
        tokensUsed: 0,
        activity: [],
        updatedAt: now,
      });
      agentIds.push(agentId);
    }

    return { swarmRunId, agentIds };
  },
});

export const updateSpawnedAgent = internalMutation({
  args: {
    agentId: v.id("spawnedAgents"),
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("done"),
        v.literal("error")
      )
    ),
    progress: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    result: v.optional(v.string()),
    sandboxId: v.optional(v.string()),
    activityEntry: v.optional(activityEntryValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { agentId, activityEntry, ...rest } = args;
    const now = Date.now();

    const agent = await ctx.db.get(agentId);
    if (!agent) throw new Error("Agent not found");

    const nextActivity = activityEntry
      ? [...agent.activity, activityEntry]
      : agent.activity;

    await ctx.db.patch(agentId, {
      ...rest,
      activity: nextActivity,
      ...(rest.status === "running" && !agent.startedAt ? { startedAt: now } : {}),
      ...(rest.status === "done" || rest.status === "error"
        ? { completedAt: now }
        : {}),
      updatedAt: now,
    });
  },
});

export const updateSwarmRun = internalMutation({
  args: {
    swarmRunId: v.id("swarmRuns"),
    status: v.optional(
      v.union(
        v.literal("running"),
        v.literal("merging"),
        v.literal("done"),
        v.literal("error")
      )
    ),
    totalTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { swarmRunId, ...updates } = args;
    await ctx.db.patch(swarmRunId, { ...updates, updatedAt: Date.now() });
  },
});

// ── Public queries (subscribed from the frontend) ─────────────────────────

export const listSwarmRuns = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("swarmRuns")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(5);
  },
});

export const listSpawnedAgents = query({
  args: { swarmRunId: v.id("swarmRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("spawnedAgents")
      .withIndex("by_swarm_run", (q) => q.eq("swarmRunId", args.swarmRunId))
      .take(50);
  },
});
