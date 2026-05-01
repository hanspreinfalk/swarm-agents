import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      return [];
    }

    return await ctx.db
      .query("likedMessages")
      .withIndex("by_thread_and_user", (q) =>
        q.eq("threadId", args.threadId).eq("userId", identity.tokenIdentifier)
      )
      .collect();
  },
});

export const setSentiment = mutation({
  args: {
    messageId: v.id("messages"),
    sentiment: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.role !== "assistant") {
      throw new Error("Only assistant messages can be rated");
    }

    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("likedMessages")
      .withIndex("by_message_and_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", identity.tokenIdentifier)
      )
      .first();

    if (existing) {
      if (existing.sentiment === args.sentiment) {
        await ctx.db.delete(existing._id);
        return { cleared: true as const };
      }
      await ctx.db.patch(existing._id, { sentiment: args.sentiment });
      return { cleared: false as const, id: existing._id };
    }

    const id = await ctx.db.insert("likedMessages", {
      userId: identity.tokenIdentifier,
      threadId: message.threadId,
      messageId: args.messageId,
      sentiment: args.sentiment,
    });
    return { cleared: false as const, id };
  },
});
