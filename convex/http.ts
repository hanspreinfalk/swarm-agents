import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";

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

export default http;
