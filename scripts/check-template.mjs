import { Sandbox } from "e2b";

const sb = await Sandbox.create("hanspreinfalk-base-more-memory", { timeoutMs: 300_000 });
console.log("sandboxId:", sb.sandboxId);

// Write a minimal Next.js package.json
await sb.files.makeDir("/home/user/workspace");
await sb.files.write("/home/user/workspace/package.json", JSON.stringify({
  name: "test", version: "0.0.1", scripts: { dev: "next dev" },
  dependencies: { next: "15.3.1", react: "^19.0.0", "react-dom": "^19.0.0" }
}, null, 2));

console.log("Running npm install...");
const result = await sb.commands.run(
  "npm install --omit=dev --no-fund --no-audit",
  {
    cwd: "/home/user/workspace",
    timeoutMs: 10 * 60_000,
    requestTimeoutMs: 12 * 60_000,
    envs: { NODE_OPTIONS: "--max-old-space-size=3072" },
    onStdout: d => process.stdout.write(d),
    onStderr: d => process.stderr.write(d),
  }
);
console.log("\nexitCode:", result.exitCode, "error:", result.error);
await Sandbox.kill(sb.sandboxId);
