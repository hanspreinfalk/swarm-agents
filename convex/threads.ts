import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

/** Deletes all messages, their likedMessages rows, and the thread document. */
export async function deleteThreadCascade(
  ctx: MutationCtx,
  threadId: Id<"threads">,
) {
  const repositoryFiles = await ctx.db
    .query("repositoryFiles")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .take(500);
  for (const file of repositoryFiles) {
    await ctx.db.delete(file._id);
  }

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();

  for (const message of messages) {
    const feedback = await ctx.db
      .query("likedMessages")
      .withIndex("by_message", (q) => q.eq("messageId", message._id))
      .collect();
    for (const row of feedback) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.delete(message._id);
  }

  await ctx.db.delete(threadId);
}

export const createThread = mutation({
  args: {
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    repositoryFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("threads", {
      userId: identity.tokenIdentifier,
      title: args.title ?? "New thread",
      model: args.model ?? "gpt-4.1",
      ...(args.repositoryFullName !== undefined
        ? { repositoryFullName: args.repositoryFullName }
        : {}),
      ...(args.branch !== undefined ? { branch: args.branch } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("threads")
      .withIndex("by_user_and_updated", (q) =>
        q.eq("userId", identity.tokenIdentifier)
      )
      .order("desc")
      .take(50);
  },
});

export const getThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

export const updateThread = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    repositoryFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const { threadId, title, model, repositoryFullName, branch } = args;
    await ctx.db.patch(threadId, {
      ...(title !== undefined ? { title } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(repositoryFullName !== undefined ? { repositoryFullName } : {}),
      ...(branch !== undefined ? { branch } : {}),
      updatedAt: Date.now(),
    });
  },
});

const repositoryFileValidator = v.object({
  path: v.string(),
  content: v.string(),
  language: v.union(
    v.literal("typescript"),
    v.literal("javascript"),
    v.literal("python")
  ),
  sha: v.optional(v.string()),
  size: v.optional(v.number()),
});

async function requireOwnedThread(ctx: MutationCtx, threadId: Id<"threads">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const thread = await ctx.db.get(threadId);
  if (!thread || thread.userId !== identity.tokenIdentifier) {
    throw new Error("Unauthorized");
  }
  return thread;
}

export const listRepositoryFiles = query({
  args: {
    threadId: v.id("threads"),
    branch: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      return [];
    }

    return await ctx.db
      .query("repositoryFiles")
      .withIndex("by_thread_and_branch", (q) =>
        q.eq("threadId", args.threadId).eq("branch", args.branch)
      )
      .take(500);
  },
});

export const replaceRepositoryFiles = mutation({
  args: {
    threadId: v.id("threads"),
    repositoryFullName: v.string(),
    branch: v.string(),
    files: v.array(repositoryFileValidator),
  },
  handler: async (ctx, args) => {
    await requireOwnedThread(ctx, args.threadId);

    const existingFiles = await ctx.db
      .query("repositoryFiles")
      .withIndex("by_thread_and_branch", (q) =>
        q.eq("threadId", args.threadId).eq("branch", args.branch)
      )
      .take(500);

    for (const file of existingFiles) {
      await ctx.db.delete(file._id);
    }

    const updatedAt = Date.now();
    for (const file of args.files) {
      await ctx.db.insert("repositoryFiles", {
        threadId: args.threadId,
        repositoryFullName: args.repositoryFullName,
        branch: args.branch,
        path: file.path,
        content: file.content,
        language: file.language,
        ...(file.sha !== undefined ? { sha: file.sha } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
        updatedAt,
      });
    }

    await ctx.db.patch(args.threadId, {
      repositoryFullName: args.repositoryFullName,
      branch: args.branch,
      updatedAt,
    });
  },
});

export const saveRepositoryFile = mutation({
  args: {
    threadId: v.id("threads"),
    repositoryFullName: v.string(),
    branch: v.string(),
    file: repositoryFileValidator,
  },
  handler: async (ctx, args) => {
    await requireOwnedThread(ctx, args.threadId);

    const existingFile = await ctx.db
      .query("repositoryFiles")
      .withIndex("by_thread_and_branch_and_path", (q) =>
        q
          .eq("threadId", args.threadId)
          .eq("branch", args.branch)
          .eq("path", args.file.path)
      )
      .unique();

    const updatedAt = Date.now();
    const nextFile = {
      threadId: args.threadId,
      repositoryFullName: args.repositoryFullName,
      branch: args.branch,
      path: args.file.path,
      content: args.file.content,
      language: args.file.language,
      ...(args.file.sha !== undefined ? { sha: args.file.sha } : {}),
      ...(args.file.size !== undefined ? { size: args.file.size } : {}),
      updatedAt,
    };

    if (existingFile) {
      await ctx.db.replace(existingFile._id, nextFile);
    } else {
      await ctx.db.insert("repositoryFiles", nextFile);
    }

    await ctx.db.patch(args.threadId, { updatedAt });
  },
});

export const deleteThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    await deleteThreadCascade(ctx, args.threadId);
  },
});

export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
    });
  },
});

export const listMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(200);
  },
});

/** Removes an assistant message and its feedback rows. Caller must own the thread. */
export const deleteAssistantMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) return;
    if (message.role !== "assistant") {
      throw new Error("Can only delete assistant messages");
    }

    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const feedback = await ctx.db
      .query("likedMessages")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    for (const row of feedback) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.messageId);
    await ctx.db.patch(message.threadId, { updatedAt: Date.now() });
  },
});
