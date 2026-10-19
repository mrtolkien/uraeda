// Checks what the benchmark relies on outside this repository, against a real case image:
// `vp run benchmarks:probe`. See the plan's Task 1.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Check, runProbe } from "../src/probe.ts";

const IMAGE =
  "ghcr.io/scaleapi/swe-bench_pro-v2:instance_ansible__ansible-40ade1f84b8bb10a63576b0ac320c13f57c87d34-v6382ea168a93d80a64aab1fbd8c4f02dc5ada5bf";

const which = (name: string) =>
  realpathSync(execFileSync("which", [name], { encoding: "utf8" }).trim());
const claude = which("claude");
const config = mkdtempSync(join(tmpdir(), "benchmarks-probe-"));

/** Runs a shell command in the image, with the host's `claude` mounted read-only. */
function inImage(script: string, env: Array<string> = []) {
  const args = [
    "run",
    "--rm",
    "--entrypoint",
    "/bin/sh",
    "-v",
    `${claude}:/usr/local/bin/claude:ro`,
    "-v",
    `${config}:/cfg`,
    "-e",
    "CLAUDE_CONFIG_DIR=/cfg",
    "-e",
    "HOME=/tmp",
    ...env.flatMap((name) => ["-e", name]),
    IMAGE,
    "-c",
    script,
  ];
  const { status, stderr, stdout } = spawnSync("docker", args, {
    encoding: "utf8",
    timeout: 600_000,
  });
  return { out: `${stdout}${stderr}`, status };
}

const expectOk = (script: string, env?: Array<string>) => {
  const { out, status } = inImage(script, env);
  if (status !== 0) {
    throw new Error(out.trim().split("\n").slice(-3).join(" | "));
  }
  return out;
};

const checks: Array<Check> = [
  {
    name: "the image runs, and the host's claude starts inside it, beside git",
    run: async () => {
      expectOk("claude --version && git --version");
    },
  },
  {
    name: "a fresh configuration folder is not logged in",
    run: async () => {
      const { out } = inImage("claude -p hi --output-format json");
      if (!out.includes("Not logged in")) {
        throw new Error(out.slice(0, 300));
      }
    },
  },
  {
    name: "a session answers as claude-sonnet-5-5 with the model in settings.json",
    run: async () => {
      writeFileSync(
        join(config, "settings.json"),
        JSON.stringify({ effort: "medium", model: "claude-sonnet-5-5", switchModelsOnFlag: false }),
      );
      const out = expectOk("claude -p 'say ok' --output-format json", ["CLAUDE_CODE_OAUTH_TOKEN"]);
      if (!out.includes("claude-sonnet-5-5")) {
        throw new Error(out.slice(0, 300));
      }
    },
    token: true,
  },
  {
    name: "auto mode runs the repository's tests and edits a file without a block",
    run: async () => {
      const out = expectOk(
        "cd /app && claude -p 'Run `python -c \"print(1)\"` and create a file probe.txt containing ok' --permission-mode auto --output-format json",
        ["CLAUDE_CODE_OAUTH_TOKEN"],
      );
      if (/"permission_denials":\s*\[\s*\{/.test(out)) {
        throw new Error("auto mode blocked an action");
      }
    },
    token: true,
  },
];

const { exitCode, lines } = await runProbe({ checks, env: process.env });
process.stdout.write(`${lines.join("\n")}\n`);
process.exit(exitCode);
