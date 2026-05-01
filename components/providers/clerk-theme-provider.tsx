"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import type { ReactNode } from "react";

/**
 * Clerk’s shadcn preset maps UI to your design tokens (--card, --primary, …).
 * Light/dark follow `next-themes` via `:root` / `html.dark` — do not layer
 * `@clerk/themes` `dark` on top or it overrides tokens with fixed hex colors.
 */
const clerkAppearance = {
  baseTheme: shadcn,
  elements: {
    modalBackdrop:
      "flex !items-center justify-center overflow-y-auto py-6 sm:py-10",
    modalContent: "!my-0",
  },
};

export function ClerkThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
  );
}
