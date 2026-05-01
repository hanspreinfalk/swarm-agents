import { AuthConfig } from "convex/server";

export default {
    // Set CLERK_JWT_ISSUER_DOMAIN in the Convex dashboard before running `npx convex dev`
    // Dashboard: https://dashboard.convex.dev → Settings → Environment Variables
    providers: process.env.CLERK_JWT_ISSUER_DOMAIN
        ? [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN, applicationID: "convex" }]
        : []
} satisfies AuthConfig;