"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  Code2,
  GitPullRequest,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef3ff] text-slate-950">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.95),transparent_28%),radial-gradient(circle_at_78%_20%,rgba(130,104,255,0.72),transparent_34%),linear-gradient(135deg,#f7fbff_0%,#b8c9ff_42%,#145dff_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-blue-700/90 via-blue-500/40 to-transparent" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-black/5">
            <Bot className="size-4 text-blue-600" />
          </span>
          Swarm Agents
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-slate-700 md:flex">
          <a href="#features" className="transition hover:text-slate-950">
            Features
          </a>
          <a href="#preview" className="transition hover:text-slate-950">
            Preview
          </a>
          <a href="#workflow" className="transition hover:text-slate-950">
            Workflow
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Button
                asChild
                size="sm"
                className="rounded-full bg-black px-4 text-white hover:bg-black/85"
              >
                <Link href="/workspace">Open app</Link>
              </Button>
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button
                  size="sm"
                  className="rounded-full bg-black px-4 text-white hover:bg-black/85"
                >
                  Get started
                </Button>
              </SignUpButton>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-12 text-center sm:pt-20">
        <Badge
          variant="outline"
          className="mb-6 border-white/60 bg-white/60 px-3 py-1 text-slate-700 shadow-sm backdrop-blur"
        >
          <Sparkles className="size-3" />
          AI coding agent for focused product work
        </Badge>

        <div className="mb-6 flex size-16 items-center justify-center rounded-3xl bg-white/80 shadow-xl shadow-blue-900/10 ring-1 ring-white/60 backdrop-blur">
          <Terminal className="size-8 text-blue-600" />
        </div>

        <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tight sm:text-7xl">
          Build with a swarm of coding agents.
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-700 sm:text-lg">
          Plan, implement, review, and ship software with an agent workspace
          built for real development loops.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          {isSignedIn ? (
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full bg-black px-6 text-white hover:bg-black/85"
            >
              <Link href="/workspace">
                Open workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <SignUpButton mode="modal">
                <Button
                  size="lg"
                  className="h-11 rounded-full bg-black px-6 text-white hover:bg-black/85"
                >
                  Start building
                  <ArrowRight className="size-4" />
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-full border-white/70 bg-white/60 px-6 backdrop-blur"
                >
                  Sign in
                </Button>
              </SignInButton>
            </>
          )}
        </div>
      </section>

      <section id="preview" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-[2rem] border border-white/50 bg-white/60 shadow-2xl shadow-blue-950/25 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-400" />
              <span className="size-3 rounded-full bg-yellow-400" />
              <span className="size-3 rounded-full bg-green-400" />
            </div>
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:block">
              Create agent workspace
            </div>
            <Button
              asChild
              size="xs"
              className="rounded-full bg-black text-white hover:bg-black/85"
            >
              <Link href="/workspace">Open</Link>
            </Button>
          </div>

          <div className="grid min-h-[360px] md:grid-cols-[240px_1fr_300px]">
            <aside className="hidden border-r border-slate-200/70 bg-slate-100/70 p-4 text-left md:block">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
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
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600"
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
                <h2 className="text-2xl font-semibold">
                  Create a polished launch page
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  The agent coordinates UI, auth, and backend sync tasks while
                  keeping every change reviewable.
                </p>
              </div>
              <div id="features" className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Plan", "Break work into steps"],
                  ["Build", "Apply focused edits"],
                  ["Verify", "Run checks before ship"],
                ].map(([title, body]) => (
                  <div
                    key={title}
                    className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-slate-200/70"
                  >
                    <Check className="mb-3 size-4 text-blue-600" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-xs text-slate-600">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside
              id="workflow"
              className="border-t border-slate-200/70 bg-white/80 p-5 text-left md:border-l md:border-t-0"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold">Files changed</p>
                <span className="text-xs text-emerald-600">+24 -6</span>
              </div>
              <div className="space-y-3 text-xs font-mono">
                <div className="rounded-xl bg-rose-50 p-3 text-rose-700">
                  - missing auth provider wrapper
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
                  + ClerkProvider and ConvexProviderWithClerk
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                  + webhook create, update, delete
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <Code2 className="mb-3 size-4 text-slate-600" />
                  <p className="text-xs text-slate-600">Code-aware edits</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <GitPullRequest className="mb-3 size-4 text-slate-600" />
                  <p className="text-xs text-slate-600">Review-ready output</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}