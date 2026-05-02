import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Users ──────────────────────────────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    fullName: v.string(),
    email: v.string(),
    pictureUrl: v.optional(v.string()),
    lastLogin: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Threads ────────────────────────────────────────────────────────────
  threads: defineTable({
    userId: v.string(), // tokenIdentifier from Clerk auth
    title: v.string(),
    model: v.string(),
    projectId: v.optional(v.id("projects")),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  // ── Projects (shared across threads) ────────────────────────────────────
  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    repositoryFullName: v.string(),
    branch: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user_and_updated", ["userId", "updatedAt"])
    .index("by_user_and_repo_and_branch", ["userId", "repositoryFullName", "branch"]),

  // ── Synced repository files per project ─────────────────────────────────
  projectFiles: defineTable({
    projectId: v.id("projects"),
    path: v.string(),
    content: v.string(),
    language: v.union(
      v.literal("typescript"),
      v.literal("javascript"),
      v.literal("python")
    ),
    sha: v.optional(v.string()),
    size: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_and_path", ["projectId", "path"]),

  // ── Messages ───────────────────────────────────────────────────────────
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_thread", ["threadId"]),

  // ── Per-user thumbs up/down on assistant messages ───────────────────────
  likedMessages: defineTable({
    userId: v.string(),
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    sentiment: v.union(v.literal("up"), v.literal("down")),
  })
    .index("by_thread_and_user", ["threadId", "userId"])
    .index("by_message_and_user", ["messageId", "userId"])
    .index("by_message", ["messageId"]),

  // ── Swarm orchestration runs ──────────────────────────────────────────
  swarmRuns: defineTable({
    threadId: v.id("threads"),
    projectId: v.optional(v.id("projects")),
    status: v.union(
      v.literal("running"),
      v.literal("merging"),
      v.literal("done"),
      v.literal("error")
    ),
    plan: v.string(),
    totalTokens: v.number(),
    startedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_thread", ["threadId"]),

  // ── Individual spawned agents within a swarm run ─────────────────────
  spawnedAgents: defineTable({
    swarmRunId: v.id("swarmRuns"),
    name: v.string(),
    task: v.string(),
    assignedFiles: v.array(v.string()),
    /** "opencode" uses OpenCode+Gemini 2.5 Flash; "claude" uses Claude Code */
    agentTemplate: v.union(v.literal("opencode"), v.literal("claude")),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error")
    ),
    progress: v.number(),
    tokensUsed: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    result: v.optional(v.string()),
    /** E2B sandbox ID — stored so we can pause/resume/kill it */
    sandboxId: v.optional(v.string()),
      activity: v.array(
        v.object({
          time: v.string(),
          title: v.string(),
          detail: v.string(),
          /** Categorises the event so the UI can show the right icon */
          kind: v.optional(
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
          ),
        })
      ),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_swarm_run", ["swarmRunId"]),
});
