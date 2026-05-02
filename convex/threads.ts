import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

/** Deletes all messages, their likedMessages rows, and the thread document. */
export async function deleteThreadCascade(
  ctx: MutationCtx,
  threadId: Id<"threads">,
) {
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
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("threads", {
      userId: identity.tokenIdentifier,
      title: args.title ?? "New thread",
      model: args.model ?? "gpt-4.1",
      ...(args.projectId !== undefined ? { projectId: args.projectId } : {}),
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
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.tokenIdentifier) {
      throw new Error("Unauthorized");
    }

    const { threadId, title, model, projectId } = args;
    await ctx.db.patch(threadId, {
      ...(title !== undefined ? { title } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      updatedAt: Date.now(),
    });
  },
});

const projectFileValidator = v.object({
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

async function requireOwnedProject(
  ctx: MutationCtx,
  projectId: Id<"projects">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const project = await ctx.db.get(projectId);
  if (!project || project.userId !== identity.tokenIdentifier) {
    throw new Error("Unauthorized");
  }
  return project;
}

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("projects")
      .withIndex("by_user_and_updated", (q) =>
        q.eq("userId", identity.tokenIdentifier)
      )
      .order("desc")
      .take(100);
  },
});

export const upsertProject = mutation({
  args: {
    name: v.string(),
    repositoryFullName: v.string(),
    branch: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existingProject = await ctx.db
      .query("projects")
      .withIndex("by_user_and_repo_and_branch", (q) =>
        q
          .eq("userId", identity.tokenIdentifier)
          .eq("repositoryFullName", args.repositoryFullName)
          .eq("branch", args.branch)
      )
      .unique();

    const updatedAt = Date.now();
    if (existingProject) {
      await ctx.db.patch(existingProject._id, {
        name: args.name,
        updatedAt,
      });
      return existingProject._id;
    }

    return await ctx.db.insert("projects", {
      userId: identity.tokenIdentifier,
      name: args.name,
      repositoryFullName: args.repositoryFullName,
      branch: args.branch,
      updatedAt,
    });
  },
});

export const listProjectFiles = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== identity.tokenIdentifier) {
      return [];
    }

    return await ctx.db
      .query("projectFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(1000);
  },
});

export const replaceProjectFiles = mutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(projectFileValidator),
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);

    const existingFiles = await ctx.db
      .query("projectFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(1000);

    for (const file of existingFiles) {
      await ctx.db.delete(file._id);
    }

    const updatedAt = Date.now();
    for (const file of args.files) {
      await ctx.db.insert("projectFiles", {
        projectId: args.projectId,
        path: file.path,
        content: file.content,
        language: file.language,
        ...(file.sha !== undefined ? { sha: file.sha } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
        updatedAt,
      });
    }

    await ctx.db.patch(project._id, {
      updatedAt,
    });
  },
});

export const saveProjectFile = mutation({
  args: {
    projectId: v.id("projects"),
    file: projectFileValidator,
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId);

    const existingFile = await ctx.db
      .query("projectFiles")
      .withIndex("by_project_and_path", (q) =>
        q.eq("projectId", args.projectId).eq("path", args.file.path)
      )
      .unique();

    const updatedAt = Date.now();
    const nextFile = {
      projectId: args.projectId,
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
      await ctx.db.insert("projectFiles", nextFile);
    }

    await ctx.db.patch(project._id, { updatedAt });
  },
});

export const replaceProjectFilesInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    files: v.array(projectFileValidator),
  },
  handler: async (ctx, args) => {
    const existingFiles = await ctx.db
      .query("projectFiles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .take(1000);

    for (const file of existingFiles) {
      await ctx.db.delete(file._id);
    }

    const updatedAt = Date.now();
    for (const file of args.files) {
      await ctx.db.insert("projectFiles", {
        projectId: args.projectId,
        path: file.path,
        content: file.content,
        language: file.language,
        ...(file.sha !== undefined ? { sha: file.sha } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
        updatedAt,
      });
    }

    await ctx.db.patch(args.projectId, { updatedAt });
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
