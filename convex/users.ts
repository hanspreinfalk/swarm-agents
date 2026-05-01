import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { deleteThreadCascade } from "./threads";

type ClerkUserInput = {
  clerkId: string;
  fullName: string;
  email: string;
  pictureUrl?: string;
};

async function getUserByClerkId(ctx: MutationCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
}

function userPatch(args: ClerkUserInput) {
  return {
    fullName: args.fullName,
    email: args.email,
    ...(args.pictureUrl ? { pictureUrl: args.pictureUrl } : {}),
  };
}

export const createUserFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    fullName: v.string(),
    email: v.string(),
    pictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await getUserByClerkId(ctx, args.clerkId);

    if (existingUser) {
      await ctx.db.patch(existingUser._id, userPatch(args));
      return existingUser._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      ...userPatch(args),
    });
  },
});

export const updateUserFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    fullName: v.string(),
    email: v.string(),
    pictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await getUserByClerkId(ctx, args.clerkId);

    if (!existingUser) {
      return await ctx.db.insert("users", {
        clerkId: args.clerkId,
        ...userPatch(args),
      });
    }

    await ctx.db.patch(existingUser._id, userPatch(args));
    return existingUser._id;
  },
});

export const deleteUserFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Threads and ratings use Convex identity.tokenIdentifier, which for Clerk is
    // `${jwtIssuer}|${clerkUserId}` (same domain as CLERK_JWT_ISSUER_DOMAIN in auth.config).
    const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
    if (issuer) {
      const tokenIdentifier = `${issuer}|${args.clerkId}`;
      const userThreads = await ctx.db
        .query("threads")
        .withIndex("by_user", (q) => q.eq("userId", tokenIdentifier))
        .collect();
      for (const thread of userThreads) {
        await deleteThreadCascade(ctx, thread._id);
      }
    }

    const existingUser = await getUserByClerkId(ctx, args.clerkId);
    if (!existingUser) {
      return null;
    }

    await ctx.db.delete(existingUser._id);
    return existingUser._id;
  },
});
