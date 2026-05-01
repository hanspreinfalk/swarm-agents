"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Code2,
  GitPullRequest,
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
    a: "The app is meant to work alongside typical web stacks (for example Next.js and Convex in this project). Your exact integrations depend on how you configure the workspace.",
  },
  {
    q: "Is my code sent to the model?",
    a: "When you use agent features, relevant context is sent to the model to generate responses and edits. Check your organization policies and provider terms for retention and training.",
  },
] as const;

const primaryCtaClass =
  "rounded-full bg-foreground px-4 text-background hover:opacity-90 sm:px-5";

const primaryCtaLgClass =
  "h-11 rounded-full bg-foreground px-6 text-background hover:opacity-90";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_70%_at_50%_-10%,color-mix(in_oklab,var(--sidebar-primary)_22%,transparent),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-muted/70 to-transparent"
        aria-hidden
      />

      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 font-semibold text-foreground"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              <Image
                src="/logo.svg"
                alt=""
                width={22}
                height={22}
                className="shrink-0"
              />
            </span>
            <span className="truncate">Swarm Agents</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#preview" className="transition-colors hover:text-foreground">
              Preview
            </a>
            <a href="#workflow" className="transition-colors hover:text-foreground">
              Workflow
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

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-12 text-center sm:pt-20">
        <Badge variant="outline" className="mb-6 border-border bg-card/80 px-3 py-1 text-muted-foreground shadow-sm">
          <Sparkles className="size-3" />
          AI coding agent for focused product work
        </Badge>

        <div className="mb-6 flex size-16 items-center justify-center rounded-3xl border border-border bg-card shadow-md">
          <Terminal className="size-8 text-sidebar-primary" />
        </div>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl">
          Build with a swarm of coding agents.
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Plan, implement, review, and ship software with an agent workspace
          built for real development loops.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {isSignedIn ? (
            <Button asChild size="lg" className={primaryCtaLgClass}>
              <Link href="/workspace">
                Open workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <SignUpButton mode="modal">
                <Button size="lg" className={primaryCtaLgClass}>
                  Start building
                  <ArrowRight className="size-4" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button size="lg" variant="outline" className="h-11 rounded-full px-6">
                  Sign in
                </Button>
              </SignInButton>
            </>
          )}
        </div>
      </section>

      <section
        id="features"
        className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-20"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Features
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Everything you need for agent-assisted development
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            From first idea to reviewed changes, the workspace keeps context and
            output structured so you stay in control.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm"
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-sidebar-primary/15 text-sidebar-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="preview" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-20">
        <div className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:block">
              Create agent workspace
            </div>
            <Button asChild size="xs" className="rounded-full bg-foreground text-background hover:opacity-90">
              <Link href="/workspace">Open</Link>
            </Button>
          </div>

          <div className="grid min-h-[360px] md:grid-cols-[240px_1fr_300px]">
            <aside className="hidden border-r border-border bg-muted/30 p-4 text-left md:block">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Threads
              </p>
              {[
                "Landing page",
                "Auth setup",
                "Convex webhook",
                "Review fixes",
              ].map((item, index) => (
                <div
                  key={item}
                  className={`mb-2 rounded-xl px-3 py-2 text-sm ${
                    index === 0
                      ? "border border-border bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {item}
                </div>
              ))}
            </aside>

            <div className="flex flex-col justify-between p-6 text-left">
              <div>
                <Badge variant="secondary" className="mb-4">
                  Agent plan
                </Badge>
                <h2 className="text-2xl font-semibold text-foreground">
                  Create a polished launch page
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  The agent coordinates UI, auth, and backend sync tasks while
                  keeping every change reviewable.
                </p>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Plan", "Break work into steps"],
                  ["Build", "Apply focused edits"],
                  ["Verify", "Run checks before ship"],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-border bg-muted/40 p-4 shadow-sm"
                  >
                    <Check className="mb-3 size-4 text-sidebar-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside
              id="workflow"
              className="scroll-mt-24 border-t border-border bg-muted/20 p-5 text-left md:border-l md:border-t-0"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Files changed</p>
                <span className="text-xs text-muted-foreground">+24 -6</span>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div className="rounded-xl border-l-2 border-destructive bg-destructive/10 p-3 pl-3 text-destructive">
                  - missing auth provider wrapper
                </div>
                <div className="rounded-xl border-l-2 border-sidebar-primary bg-sidebar-primary/10 p-3 pl-3 text-foreground">
                  + ClerkProvider and ConvexProviderWithClerk
                </div>
                <div className="rounded-xl border-l-2 border-primary bg-primary/10 p-3 pl-3 text-foreground">
                  + webhook create, update, delete
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <Code2 className="mb-3 size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Code-aware edits</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/50 p-4">
                  <GitPullRequest className="mb-3 size-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Review-ready output</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="mx-auto w-full max-w-3xl scroll-mt-24 px-6 pb-24"
      >
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            FAQ
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Common questions
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Quick answers about how Swarm Agents fits into your workflow.
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-10 w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base text-foreground">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="border-t border-border bg-muted/30 py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold text-foreground"
            >
              <Image
                src="/logo.svg"
                alt=""
                width={28}
                height={28}
                className="shrink-0"
              />
              Swarm Agents
            </Link>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Agent workspace for planning, building, and reviewing software with
              AI—without losing the thread.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a
                    href="#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#preview"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Preview
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  {isSignedIn ? (
                    <Link
                      href="/workspace"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Workspace
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
                      Sign up
                    </button>
                  </SignUpButton>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-6xl border-t border-border px-6 pt-8">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Swarm Agents. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
