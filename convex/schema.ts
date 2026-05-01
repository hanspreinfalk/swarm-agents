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
    repositoryFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_updated", ["userId", "updatedAt"]),

  // ── Synced repository files per thread/branch ──────────────────────────
  repositoryFiles: defineTable({
    threadId: v.id("threads"),
    repositoryFullName: v.string(),
    branch: v.string(),
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
    .index("by_thread", ["threadId"])
    .index("by_thread_and_branch", ["threadId", "branch"])
    .index("by_thread_and_branch_and_path", ["threadId", "branch", "path"]),

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
});
