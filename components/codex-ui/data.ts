import type {
  CodingAgentActivity,
  ChatMessage,
  CodeFile,
  CodingAgentRun,
  ThreadGroup,
} from "./types";

// ─── Thread groups ────────────────────────────────────────────────

export const THREAD_GROUPS: ThreadGroup[] = [
  {
    id: "swarm",
    label: "SwarmAgents",
    items: [
      { id: "t1", title: "Use image skill", time: "1h" },
      { id: "t2", title: "Create landing hero", time: "4h" },
      { id: "t3", title: "Implement dark mode", time: "8h" },
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    items: [{ id: "t4", title: "Voice mode shortcuts", time: "2h" }],
  },
  {
    id: "sora",
    label: "Sora",
    items: [{ id: "t5", title: "Persist prompt presets", time: "5h" }],
  },
  {
    id: "atlas",
    label: "Atlas",
    items: [{ id: "t6", title: "Add Status filter facet", time: "3h" }],
  },
];

// ─── Code files ───────────────────────────────────────────────────

export const CODE_FILES: Record<string, CodeFile> = {
  "src/hero.tsx": {
    language: "typescript",
    content: `export const hero = {
  eyebrow: "Introducing",
  title: "SwarmAgents",
  subtitle: "AI agents that work together",
  primaryCta: "Get started",
  secondaryCta: "Download the CLI",
};

export const heroBullets = [
  "Understands your repo in seconds",
  "Executes commands safely in a sandbox",
  "Turns issues into reviewed, production-ready PRs",
];

interface HeroProps {
  className?: string;
}

export function HeroSection({ className }: HeroProps) {
  return (
    <section className={\`hero-section \${className ?? ""}\`}>
      <span className="eyebrow">{hero.eyebrow}</span>
      <h1 className="title">{hero.title}</h1>
      <p className="subtitle">{hero.subtitle}</p>
      <ul className="bullets">
        {heroBullets.map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      <div className="ctas">
        <a href="/get-started" className="btn-primary">
          {hero.primaryCta}
        </a>
        <a href="/download" className="btn-secondary">
          {hero.secondaryCta}
        </a>
      </div>
    </section>
  );
}
`,
  },
  "tools/build.py": {
    language: "python",
    content: `def build():
    print("building launch hero...")


def deploy():
    print("deploying to production...")


if __name__ == "__main__":
    build()
`,
  },
  "tools/deploy.py": {
    language: "python",
    content: `"""Deploy helpers (demo)."""


def main() -> None:
    print("deploy: stub")


if __name__ == "__main__":
    main()
`,
  },
  "src/components/Header.tsx": {
    language: "typescript",
    content: `export function Header() {
  return <header className="site-header">Header</header>;
}
`,
  },
  "src/components/Footer.tsx": {
    language: "typescript",
    content: `export function Footer() {
  return <footer className="site-footer">Footer</footer>;
}
`,
  },
  "src/components/HeroBullets.tsx": {
    language: "typescript",
    content: `import { heroBullets } from "../hero";

export function HeroBullets() {
  return (
    <ul>
      {heroBullets.map((b) => (
        <li key={b}>{b}</li>
      ))}
    </ul>
  );
}
`,
  },
  "src/App.tsx": {
    language: "typescript",
    content: `import { HeroSection } from "./hero";

export default function App() {
  return (
    <main>
      <HeroSection className="fullpage-hero" />
    </main>
  );
}
`,
  },
  "tsconfig.json": {
    language: "javascript",
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
  },
  "package.json": {
    language: "javascript",
    content: `{
  "name": "swarm-agents",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
`,
  },
};

// ─── Parallel coding agents ────────────────────────────────────────

function activity(
  entries: Array<[time: string, title: string, detail: string]>
): CodingAgentActivity[] {
  return entries.map(([time, title, detail]) => ({ time, title, detail }));
}

export const PARALLEL_CODING_AGENTS: CodingAgentRun[] = [
  {
    id: "agent-1",
    name: "Agent 01",
    task: "Audit current hero copy and CTAs",
    status: "done",
    progress: 100,
    durationSeconds: 72,
    tokensUsed: 4280,
    files: ["src/hero.tsx"],
    updates: [
      "Read existing hero content",
      "Identified unclear CTA hierarchy",
      "Suggested outcome-focused copy",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted the hero audit assignment from the main agent."],
      ["00:09", "Opened src/hero.tsx", "Read the hero config, CTA labels, and bullet copy."],
      ["00:24", "Assessed CTA hierarchy", "Compared the primary and secondary CTAs for launch intent."],
      ["00:46", "Wrote audit notes", "Flagged vague outcome language and recommended clearer developer value props."],
      ["01:12", "Reported back", "Sent findings to the main agent for merge planning."],
    ]),
  },
  {
    id: "agent-2",
    name: "Agent 02",
    task: "Rewrite headline and supporting copy",
    status: "done",
    progress: 100,
    durationSeconds: 94,
    tokensUsed: 5120,
    files: ["src/hero.tsx"],
    updates: [
      "Drafted launch headline",
      "Tightened subtitle for developer audience",
      "Applied final copy edits",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted the headline and subtitle rewrite assignment."],
      ["00:11", "Reviewed current title", "Checked existing product positioning in src/hero.tsx."],
      ["00:31", "Drafted alternatives", "Generated headline options focused on coordinated coding agents."],
      ["01:02", "Selected final copy", "Chose the shortest headline that preserved product meaning."],
      ["01:34", "Submitted patch notes", "Returned the recommended text changes to the main agent."],
    ]),
  },
  {
    id: "agent-3",
    name: "Agent 03",
    task: "Improve bullet point messaging",
    status: "done",
    progress: 100,
    durationSeconds: 58,
    tokensUsed: 3840,
    files: ["src/hero.tsx"],
    updates: [
      "Mapped bullets to product outcomes",
      "Removed vague feature language",
      "Kept each bullet short enough for scanning",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted the bullet messaging assignment."],
      ["00:08", "Read bullet list", "Reviewed each bullet in src/hero.tsx for specificity and scan length."],
      ["00:25", "Mapped outcomes", "Aligned the three bullets to repo understanding, safe execution, and PR delivery."],
      ["00:43", "Trimmed phrasing", "Removed filler words so each bullet fits in one quick read."],
      ["00:58", "Reported back", "Sent the final bullet recommendations to the main agent."],
    ]),
  },
  {
    id: "agent-4",
    name: "Agent 04",
    task: "Check CTA labels and routes",
    status: "reviewing",
    progress: 82,
    durationSeconds: 108,
    tokensUsed: 4680,
    files: ["src/hero.tsx", "src/App.tsx"],
    updates: [
      "Verified primary CTA intent",
      "Compared secondary CTA with navigation",
      "Reviewing route availability",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted CTA label and route validation."],
      ["00:14", "Read src/hero.tsx", "Checked href values and label intent for both CTA links."],
      ["00:38", "Read src/App.tsx", "Confirmed the hero component is rendered through the app shell."],
      ["01:09", "Compared routes", "Checked whether /get-started and /download match the launch flow."],
      ["01:48", "Entered review", "Prepared route availability notes for the main agent."],
    ]),
  },
  {
    id: "agent-5",
    name: "Agent 05",
    task: "Review build script impact",
    status: "running",
    progress: 68,
    durationSeconds: 65,
    tokensUsed: 3260,
    files: ["tools/build.py"],
    updates: [
      "Read build script entrypoints",
      "Confirmed copy changes do not affect build flow",
      "Checking deploy command wording",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted build script impact review."],
      ["00:10", "Opened tools/build.py", "Read build() and deploy() entrypoints."],
      ["00:28", "Checked coupling", "Confirmed hero copy edits do not touch Python execution paths."],
      ["00:49", "Reviewed command wording", "Compared build and deploy output strings with launch copy."],
      ["01:05", "Posted status", "Reported that no build flow change is required so far."],
    ]),
  },
  {
    id: "agent-6",
    name: "Agent 06",
    task: "Validate TypeScript shape",
    status: "running",
    progress: 61,
    durationSeconds: 52,
    tokensUsed: 3920,
    files: ["src/hero.tsx", "tsconfig.json"],
    updates: [
      "Checked exported object structure",
      "Verified JSX references remain valid",
      "Running local type assumptions",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted TypeScript shape validation."],
      ["00:07", "Inspected exports", "Checked hero, heroBullets, and HeroSection exports."],
      ["00:22", "Read tsconfig.json", "Confirmed strict compiler options and JSX settings."],
      ["00:39", "Validated references", "Checked that JSX still reads from existing object keys."],
      ["00:52", "Posted status", "Shared type-safety notes with the main agent."],
    ]),
  },
  {
    id: "agent-7",
    name: "Agent 07",
    task: "Inspect app integration",
    status: "running",
    progress: 47,
    durationSeconds: 44,
    tokensUsed: 3180,
    files: ["src/App.tsx"],
    updates: [
      "Found hero usage in app shell",
      "Confirmed component API stayed stable",
      "Checking layout copy fit",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted app integration inspection."],
      ["00:09", "Opened src/App.tsx", "Found HeroSection rendered as the main content."],
      ["00:18", "Checked props", "Confirmed the component API still only expects className."],
      ["00:31", "Reviewed layout fit", "Checked that the copy length remains suitable for the app shell."],
      ["00:44", "Posted status", "Reported no integration changes needed yet."],
    ]),
  },
  {
    id: "agent-8",
    name: "Agent 08",
    task: "Look for stale messaging",
    status: "running",
    progress: 35,
    durationSeconds: 39,
    tokensUsed: 2860,
    files: ["package.json", "src/hero.tsx"],
    updates: [
      "Scanning package metadata",
      "Comparing product naming",
      "Flagging inconsistent launch phrasing",
    ],
    activity: activity([
      ["00:00", "Started task", "Accepted stale messaging scan."],
      ["00:06", "Read package.json", "Checked package name and app scripts for product naming clues."],
      ["00:19", "Compared naming", "Matched package metadata against SwarmAgents copy in src/hero.tsx."],
      ["00:30", "Flagged wording", "Noted places where launch phrasing could drift from product naming."],
      ["00:39", "Posted status", "Sent naming consistency notes to the main agent."],
    ]),
  },
  {
    id: "agent-9",
    name: "Agent 09",
    task: "Prepare review summary",
    status: "queued",
    progress: 12,
    durationSeconds: 12,
    tokensUsed: 1640,
    files: ["src/hero.tsx", "tools/build.py"],
    updates: [
      "Waiting for implementation agents",
      "Collecting changed file list",
      "Drafting reviewer notes",
    ],
    activity: activity([
      ["00:00", "Queued task", "Waiting for implementation agents to finish before writing review notes."],
      ["00:04", "Prepared checklist", "Created review categories for copy, routes, build impact, and type safety."],
      ["00:07", "Collected scope", "Queued src/hero.tsx and tools/build.py as expected review inputs."],
      ["00:10", "Drafted outline", "Prepared a summary format for the main agent."],
      ["00:12", "Still queued", "Paused until running agents report their final activity."],
    ]),
  },
  {
    id: "agent-10",
    name: "Agent 10",
    task: "Run final verification checklist",
    status: "queued",
    progress: 6,
    durationSeconds: 8,
    tokensUsed: 1320,
    files: ["tsconfig.json", "package.json"],
    updates: [
      "Waiting for review summary",
      "Preparing type and lint checklist",
      "Tracking outstanding tasks",
    ],
    activity: activity([
      ["00:00", "Queued task", "Waiting for review summary before final verification."],
      ["00:02", "Prepared checks", "Queued type-check, lint, and changed-file review steps."],
      ["00:04", "Tracked dependencies", "Marked verification as dependent on Agent 09's summary."],
      ["00:06", "Collected files", "Prepared tsconfig.json and package.json as verification references."],
      ["00:08", "Still queued", "Paused until the main agent requests final checks."],
    ]),
  },
];

// ─── Initial messages ─────────────────────────────────────────────

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "u1",
    role: "user",
    text: "Create a compelling launch hero for SwarmAgents on the marketing site",
  },
  {
    id: "a1",
    role: "assistant",
    reasoning:
      "Let me start by reading the current hero file to understand what exists. I should look at the copy, the CTAs, and the bullet points. Then I'll rewrite them to be more outcome-focused for developers. The key messages should be: understands your repo, executes safely, ships PRs automatically.",
    isThinkingStreaming: false,
    thinkingDuration: 7,
    text: "I'll update the hero copy to clearly communicate what SwarmAgents does, add outcome-focused bullets, and ensure the CTAs align with launch goals.",
    tools: [
      { label: "Explored 2 files", done: true },
      { label: "Edited src/hero.tsx", done: true },
      { label: "Read tools/build.py", done: false },
      { label: "Edited tools/build.py", done: true },
    ],
    subAgents: PARALLEL_CODING_AGENTS,
  },
];
