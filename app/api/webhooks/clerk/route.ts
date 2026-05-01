import { headers } from "next/headers";

// Thin proxy: forwards Clerk webhook events to the Convex HTTP endpoint.
// Clerk Dashboard → Webhooks → Endpoint URL: https://yourdomain.com/api/webhooks/clerk
//
// The Convex HTTP endpoint (convex/http.ts) handles signature verification
// and runs the internal mutations to keep the users table in sync.
//
// Required env vars:
//   CONVEX_SITE_URL  — your Convex deployment site URL (e.g. https://xxx.convex.site)

export async function POST(req: Request) {
  const convexSiteUrl = process.env.CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    console.error("CONVEX_SITE_URL is not set");
    return new Response("CONVEX_SITE_URL not configured", { status: 500 });
  }

  const headersList = await headers();
  const body = await req.text();

  const svixId = headersList.get("svix-id") ?? "";
  const svixTimestamp = headersList.get("svix-timestamp") ?? "";
  const svixSignature = headersList.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  try {
    const response = await fetch(`${convexSiteUrl}/clerk/webhook/user`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Convex webhook error:", response.status, text);
      return new Response("Webhook processing failed", {
        status: response.status,
      });
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("Failed to forward webhook to Convex:", err);
    return new Response("Internal error", { status: 500 });
  }
}
