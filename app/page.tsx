"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  Eye,
  GitBranch,
  GitPullRequest,
  Globe,
  Layers,
  MessageSquare,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LandingThemeToggle } from "@/components/landing/landing-theme-toggle";

const features = [
  {
    title: "Multi-step plans",
    description:
      "Break goals into clear steps so the agent stays aligned with your product intent.",
    icon: Layers,
  },
  {
    title: "Threaded workspace",
    description:
      "Keep conversations, context, and history in one place for every feature or fix.",
    icon: MessageSquare,
  },
  {
    title: "Code-aware edits",
    description:
      "Work across files with changes that respect structure, imports, and style.",
    icon: Code2,
  },
  {
    title: "Review-ready output",
    description:
      "See diffs and summaries so you can approve, adjust, or ship with confidence.",
    icon: GitPullRequest,
  },
  {
    title: "Fast iteration loops",
    description:
      "Tight feedback between chat, edits, and verification keeps momentum high.",
    icon: Zap,
  },
  {
    title: "Workflow fit",
    description:
      "Designed around how teams actually build: plan, implement, verify, repeat.",
    icon: Workflow,
  },
] as const;

const faqItems = [
  {
    q: "What is Swarm Agents?",
    a: "Swarm Agents is an AI coding workspace where you collaborate with agents on real software tasks—planning, implementation, and review—in a single environment.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Sign up or sign in to create threads, sync your workspace, and pick up where you left off across sessions.",
  },
  {
    q: "How does it differ from a plain chat assistant?",
    a: "The workspace is built around development workflows: structured threads, file context, and outputs you can review like real changes—not one-off snippets.",
  },
  {
    q: "Can I use it with my own stack?",
    a: "Connect any GitHub repository and the agents work within your existing codebase structure, respecting your conventions and file layout.",
  },
  {
    q: "Which AI models are supported?",
    a: "Swarm Agents supports multiple leading models including GPT-4.1, Claude, and Gemini. Switch between models per thread based on your task requirements.",
  },
  {
    q: "Is my code sent to the model?",
    a: "When you use agent features, relevant context is sent to the model to generate responses and edits. Check your organization policies and provider terms for retention and training.",
  },
] as const;

const accentGradient =
  "linear-gradient(135deg, var(--sidebar-primary), oklch(0.65 0.2 280))";

const primaryCtaClass =
  "rounded-full bg-foreground px-4 text-background hover:opacity-90 sm:px-5";
const primaryCtaLgClass =
  "h-12 rounded-full bg-foreground px-7 text-background hover:opacity-90 text-base";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      {/* Global hero glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_120%_55%_at_50%_-5%,color-mix(in_oklab,var(--sidebar-primary)_22%,transparent),transparent_60%)]"
        aria-hidden
      />

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 font-semibold text-foreground"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              <Image src="/logo.svg" alt="" width={22} height={22} className="shrink-0" />
            </span>
            <span className="truncate">Swarm Agents</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#preview" className="transition-colors hover:text-foreground">
              Preview
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LandingThemeToggle />
            {isSignedIn ? (
              <>
                <Button asChild size="sm" className={primaryCtaClass}>
                  <Link href="/workspace">Open app</Link>
                </Button>
                <UserButton />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    Sign in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm" className={primaryCtaClass}>
                    Get started
                  </Button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-28 pt-24 text-center sm:pb-36 sm:pt-36">
        <Badge
          variant="outline"
          className="mb-7 gap-1.5 border-border bg-card/80 px-3.5 py-1.5 text-sm text-muted-foreground shadow-sm"
        >
          <Sparkles className="size-3.5 text-sidebar-primary" />
          AI-powered coding workspace
        </Badge>

        <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-[4.5rem] lg:leading-[1.1]">
          Build software at the{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: accentGradient }}
          >
            speed of thought
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
          Collaborate with a swarm of AI coding agents in a structured workspace.
          Plan features, implement changes, review diffs, and ship — without losing
          context.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          {isSignedIn ? (
            <Button asChild size="lg" className={primaryCtaLgClass}>
              <Link href="/workspace">
                Open workspace <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <SignUpButton mode="modal">
                <Button size="lg" className={primaryCtaLgClass}>
                  Start building free <ArrowRight className="size-4" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full px-7 text-base"
                >
                  Sign in
                </Button>
              </SignInButton>
            </>
          )}
        </div>

        {/* Capability strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-5 border-t border-border pt-12">
          {[
            { icon: Bot, label: "Multi-model", sub: "GPT-4.1 · Claude · Gemini" },
            { icon: GitBranch, label: "GitHub sync", sub: "Branches & commits" },
            { icon: Globe, label: "Live preview", sub: "E2B sandboxes" },
            { icon: Terminal, label: "Full context", sub: "File-aware edits" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3.5">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                <Icon className="size-5 text-sidebar-primary" />
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <div id="how-it-works" className="scroll-mt-24">
        {/* PLAN */}
        <section className="mx-auto w-full max-w-7xl px-6 pb-36">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
                01 · Plan
              </div>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Break work into{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: accentGradient }}
                >
                  clear steps
                </span>
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Start every feature with a structured plan. The agent breaks down your
                goal into discrete, reviewable steps so you always know what&apos;s
                happening and why — before a single line is written.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Automatic task decomposition from a single prompt",
                  "Each step linked to specific files and context",
                  "Reorder, skip, or refine steps before execution",
                  "Full history of every plan decision per thread",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3.5 text-base text-muted-foreground">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                      <Check className="size-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Plan card */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="border-b border-border bg-muted/50 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full bg-sidebar-primary" />
                  <p className="text-sm font-medium text-foreground">
                    Agent plan · feature/auth-redesign
                  </p>
                </div>
              </div>
              <div className="p-6">
                <p className="mb-5 text-base font-semibold text-foreground">
                  Redesign authentication flow
                </p>
                <div className="space-y-2.5">
                  {[
                    { n: "1", title: "Audit current auth components", sub: "Review ClerkProvider, sign-in & sign-up pages", s: "done" },
                    { n: "2", title: "Update ClerkProvider config", sub: "Add afterSignInUrl, theme tokens", s: "done" },
                    { n: "3", title: "Redesign sign-in / sign-up pages", sub: "New layout, branded appearance", s: "active" },
                    { n: "4", title: "Update webhook handlers", sub: "Sync user create/update/delete events", s: "pending" },
                    { n: "5", title: "Test all auth flows end-to-end", sub: "Cover sign-in, sign-up, password reset", s: "pending" },
                  ].map(({ n, title, sub, s }) => (
                    <div
                      key={n}
                      className={`flex items-start gap-4 rounded-xl p-4 ${
                        s === "active"
                          ? "border border-sidebar-primary/25 bg-sidebar-primary/10"
                          : "bg-muted/40"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          s === "done"
                            ? "bg-sidebar-primary text-white"
                            : s === "active"
                              ? "border-2 border-sidebar-primary bg-transparent text-sidebar-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s === "done" ? <Check className="size-3.5" /> : n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${s === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                          {title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                      </div>
                      {s === "active" && (
                        <span className="shrink-0 rounded-full bg-sidebar-primary/20 px-2.5 py-1 text-[11px] font-semibold text-sidebar-primary">
                          In progress
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BUILD */}
        <section className="mx-auto w-full max-w-7xl px-6 pb-36">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            {/* Diff card (left) */}
            <div className="order-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:order-1">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
                <p className="text-sm font-medium text-foreground">
                  components/auth/sign-in.tsx
                </p>
                <span className="rounded-full bg-sidebar-primary/20 px-2.5 py-1 text-xs font-semibold text-sidebar-primary">
                  +38 −15
                </span>
              </div>
              <div className="space-y-1 p-5 font-mono text-[12px]">
                {[
                  { kind: "del", text: '- <div className="old-auth-form">' },
                  { kind: "del", text: '-   <input type="email" placeholder="Email" />' },
                  { kind: "del", text: '-   <input type="password" />' },
                  { kind: "del", text: "- </div>" },
                  { kind: "gap", text: "" },
                  { kind: "add", text: "+ <SignIn" },
                  { kind: "add", text: '+   afterSignInUrl="/workspace"' },
                  { kind: "add", text: '+   routing="hash"' },
                  { kind: "add", text: "+   appearance={{" },
                  { kind: "add", text: '+     elements: { rootBox: "mx-auto max-w-sm" }' },
                  { kind: "add", text: "+   }}" },
                  { kind: "add", text: "+ />" },
                ].map((line, i) =>
                  line.kind === "gap" ? (
                    <div key={i} className="h-3" />
                  ) : (
                    <div
                      key={i}
                      className={`rounded px-3 py-1 ${
                        line.kind === "del"
                          ? "border-l-2 border-destructive bg-destructive/10 text-destructive"
                          : "border-l-2 border-sidebar-primary bg-sidebar-primary/10 text-foreground"
                      }`}
                    >
                      {line.text}
                    </div>
                  )
                )}
              </div>
              <div className="border-t border-border bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-green-500" />
                    3 files changed
                  </span>
                  <span>·</span>
                  <span>+38 insertions, −15 deletions</span>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
                02 · Build
              </div>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Apply{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: accentGradient }}
                >
                  precise edits
                </span>{" "}
                across files
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                The agent writes real code — respecting your file structure, imports,
                and naming conventions. Every change is diff-reviewed before it
                touches your project.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Context-aware edits across multiple files simultaneously",
                  "Imports, types, and dependencies updated automatically",
                  "Syntax-highlighted diffs for every change",
                  "Accept, reject, or request revisions per file",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3.5 text-base text-muted-foreground">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                      <Check className="size-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SHIP */}
        <section className="mx-auto w-full max-w-7xl px-6 pb-36">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
                03 · Ship
              </div>
              <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Review, commit &{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: accentGradient }}
                >
                  preview live
                </span>
              </h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                See a live preview of your changes before committing. Push directly to
                GitHub from the workspace — with one-click branch creation and
                meaningful commit messages.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  "Live preview powered by E2B sandboxes",
                  "Commit to any GitHub branch from the workspace",
                  "Full branch management: create, switch, sync",
                  "Auto-generated commit messages from change context",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3.5 text-base text-muted-foreground">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-sidebar-primary">
                      <Check className="size-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ship card */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">feature/auth-redesign</p>
                </div>
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-600 dark:text-green-400">
                  Preview ready
                </span>
              </div>
              <div className="p-6">
                {/* Preview frame */}
                <div className="mb-6 overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center border-b border-border bg-muted/60 px-4 py-2">
                    <Globe className="mr-2 size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      https://xyz123.e2b.app
                    </span>
                  </div>
                  <div className="flex h-36 items-center justify-center bg-gradient-to-br from-sidebar-primary/8 to-transparent">
                    <div className="text-center">
                      <p className="mb-3 text-base font-semibold text-foreground">
                        Sign in to SwarmAgents
                      </p>
                      <div className="mx-auto h-9 w-28 rounded-lg bg-foreground/80" />
                    </div>
                  </div>
                </div>
                {/* Commit UI */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="size-3.5" />
                    Committing to
                    <span className="font-mono font-medium text-foreground">
                      feature/auth-redesign
                    </span>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 font-mono text-sm text-muted-foreground">
                    feat: redesign auth flow with Clerk components
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background"
                  >
                    Commit &amp; push →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── FEATURES GRID ───────────────────────────────────────────── */}
      <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-24 px-6 pb-36">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Everything included
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Built for the full dev loop
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Every capability you need to plan, build, review, and ship — in one
            connected workspace.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary">
                <Icon className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2.5 text-sm leading-7 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── APP PREVIEW MOCKUP ──────────────────────────────────────── */}
      <section id="preview" className="mx-auto w-full max-w-7xl scroll-mt-24 px-6 pb-36">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            See it in action
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            The workspace, up close
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Threads, chat, and code — all in one place. Connect a GitHub repository and
            start building immediately.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Window chrome */}
          <div className="flex items-center justify-between border-b border-border bg-muted/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="rounded-full bg-muted px-4 py-1.5 text-xs text-muted-foreground">
              swarm-agents / workspace
            </div>
            <Button
              asChild
              size="xs"
              className="rounded-full bg-foreground text-background hover:opacity-90"
            >
              <Link href="/workspace">Open app</Link>
            </Button>
          </div>

          {/* App layout */}
          <div className="grid h-[560px] grid-cols-[210px_1fr_300px] overflow-hidden">
            {/* Sidebar */}
            <aside className="border-r border-border bg-muted/20 p-4 text-left">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Threads
                </p>
                <span className="text-base leading-none text-muted-foreground">+</span>
              </div>
              {[
                "Build landing page",
                "Auth + Clerk setup",
                "Convex webhooks",
                "API rate limiting",
                "Review PR fixes",
              ].map((item, i) => (
                <div
                  key={item}
                  className={`mb-1.5 rounded-lg px-3 py-2.5 text-[13px] ${
                    i === 0
                      ? "bg-sidebar-primary/15 font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {item}
                </div>
              ))}
            </aside>

            {/* Chat panel */}
            <div className="flex flex-col overflow-hidden border-r border-border bg-background">
              <div className="border-b border-border px-5 py-3">
                <p className="text-sm font-medium text-foreground">Build landing page</p>
                <p className="text-xs text-muted-foreground">
                  GitHub: my-org/swarm-agents · main
                </p>
              </div>
              <div className="flex-1 space-y-5 overflow-hidden p-5">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-sidebar-primary/20 px-4 py-3 text-sm text-foreground">
                    Create a polished hero section with gradient text and a working CTA
                  </div>
                </div>
                {/* Agent response */}
                <div className="flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex-1 space-y-2.5">
                    <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3 text-sm text-foreground">
                      <p className="mb-2.5 font-medium">Creating the hero section with:</p>
                      <div className="space-y-2">
                        {[
                          "Gradient text using CSS variables",
                          "Responsive CTA buttons",
                          "Mobile-first layout",
                          "Scroll-triggered animation",
                        ].map((step) => (
                          <div key={step} className="flex items-center gap-2 text-muted-foreground">
                            <Check className="size-3.5 text-sidebar-primary" />
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                      Editing{" "}
                      <code className="font-mono text-foreground">app/page.tsx</code> —
                      applied 47 lines
                    </div>
                  </div>
                </div>
              </div>
              {/* Input */}
              <div className="border-t border-border p-4">
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                  <span className="flex-1 text-sm text-muted-foreground">
                    Continue with mobile optimization…
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Code/diff panel */}
            <div className="flex flex-col overflow-hidden bg-muted/10 text-left">
              <div className="border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-foreground">app/page.tsx</span>
                  <span className="ml-auto rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-sidebar-primary">
                    +47 −12
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 overflow-hidden p-4 font-mono text-[11px]">
                <div className="text-muted-foreground">
                  {"1 "}
                  <span className="text-sidebar-primary">export default</span>
                  {" function "}
                  <span className="text-yellow-500 dark:text-yellow-400">Home</span>
                  {"() {"}
                </div>
                <div className="rounded border-l-2 border-destructive bg-destructive/10 px-2 py-0.5 text-destructive">
                  {"- return <h1>Hello</h1>"}
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ return ("}
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ "}
                  <span className="text-sidebar-primary">&lt;main</span>
                  {' className='}
                  <span className="text-green-500 dark:text-green-400">&quot;relative...&quot;</span>
                  <span className="text-sidebar-primary">&gt;</span>
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ "}<span className="text-sidebar-primary">&lt;HeroSection</span>{" />"}
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ "}<span className="text-sidebar-primary">&lt;FeaturesGrid</span>{" />"}
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ "}<span className="text-sidebar-primary">&lt;CTASection</span>{" />"}
                </div>
                <div className="rounded border-l-2 border-sidebar-primary bg-sidebar-primary/10 px-2 py-0.5 text-foreground">
                  {"+ "}<span className="text-sidebar-primary">&lt;/main&gt;</span>
                </div>
                <div className="text-muted-foreground">{")"}</div>
                <div className="text-muted-foreground">{"}"}</div>
              </div>
              <div className="border-t border-border p-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground"
                  >
                    <Eye className="size-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background"
                  >
                    <GitPullRequest className="size-3.5" />
                    Commit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-6 pb-36">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-24 text-center shadow-sm sm:px-16">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,color-mix(in_oklab,var(--sidebar-primary)_18%,transparent),transparent_65%)]"
            aria-hidden
          />
          <Badge
            variant="outline"
            className="relative mb-7 gap-1.5 border-border bg-background/50 px-3.5 py-1.5 text-sm text-muted-foreground"
          >
            <Sparkles className="size-3.5" />
            Start for free
          </Badge>
          <h2 className="relative text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Ready to build faster?
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            Connect your GitHub repository, describe what you need, and let agents
            handle the implementation — while you stay in control of every change.
          </p>
          <div className="relative mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {isSignedIn ? (
              <Button asChild size="lg" className={primaryCtaLgClass}>
                <Link href="/workspace">
                  Open workspace <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <SignUpButton mode="modal">
                  <Button size="lg" className={primaryCtaLgClass}>
                    Get started free <ArrowRight className="size-4" />
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full px-7 text-base"
                  >
                    Sign in
                  </Button>
                </SignInButton>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 pb-36">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            FAQ
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Common questions
          </h2>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Quick answers about how Swarm Agents fits into your workflow.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-12 w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="py-5 text-left text-lg text-foreground">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-base text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/30 py-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link
              href="/"
              className="flex items-center gap-3 font-semibold text-foreground"
            >
              <Image src="/logo.svg" alt="" width={28} height={28} className="shrink-0" />
              <span className="text-base">Swarm Agents</span>
            </Link>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Agent workspace for planning, building, and reviewing software with
              AI — without losing the thread.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Product
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ["How it works", "#how-it-works"],
                  ["Features", "#features"],
                  ["Preview", "#preview"],
                  ["FAQ", "#faq"],
                ].map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  {isSignedIn ? (
                    <Link
                      href="/workspace"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Open workspace
                    </Link>
                  ) : (
                    <SignInButton mode="modal">
                      <button
                        type="button"
                        className="text-left text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Sign in
                      </button>
                    </SignInButton>
                  )}
                </li>
                <li>
                  <SignUpButton mode="modal">
                    <button
                      type="button"
                      className="text-left text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Create account
                    </button>
                  </SignUpButton>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Built with
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                {["Next.js 16", "Convex backend", "E2B sandboxes", "Clerk auth"].map(
                  (tech) => (
                    <li key={tech} className="text-muted-foreground">
                      {tech}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 w-full max-w-7xl border-t border-border px-6 pt-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Swarm Agents. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
