import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createThread = mutation({
  args: {
    title: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("threads", {
      userId: identity.tokenIdentifier,
      title: args.title ?? "New thread",
      model: args.model ?? "gpt-4.1",
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const { threadId, title, model } = args;
    await ctx.db.patch(threadId, {
      ...(title !== undefined ? { title } : {}),
      ...(model !== undefined ? { model } : {}),
      updatedAt: Date.now(),
    });
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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
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

    await ctx.db.delete(args.threadId);
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
