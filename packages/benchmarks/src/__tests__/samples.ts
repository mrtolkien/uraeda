import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunRecord, Scores } from "../record.ts";

export function temporary(prefix = "benchmarks-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function sampleRecord(): Omit<RunRecord, "transcripts"> {
  return {
    "approved-by": "owner",
    blocked: [],
    effort: "medium",
    ended: "2026-10-19T12:00:00Z",
    harness: { name: "claude", version: "2.1.303" },
    human: { guidelines: "abc123", model: "claude-sonnet-5-5" },
    models: { answered: ["claude-sonnet-5-5"], asked: "claude-sonnet-5-5" },
    outcome: "finished",
    repository: { commit: "a".repeat(40), dirty: false },
    skill: { commit: "b".repeat(40), dirty: false },
    started: "2026-10-19T10:00:00Z",
    steps: [],
    task: { id: "instance_x", image: "ghcr.io/x@sha256:1", source: "swe-bench-pro-v2" },
    urls: [],
    version: 1,
  };
}

export function sampleScores(): Scores {
  return { tests: { passed: 3, resolved: false, total: 5 } };
}

/** A git repository holding a copy of `benchmarks/.gitignore`, to see what git would keep. */
export function repositoryWithIgnore(): string {
  const repo = temporary("benchmarks-git-");
  execFileSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "benchmarks"));
  copyFileSync(
    join(import.meta.dirname, "../../../../benchmarks/.gitignore"),
    join(repo, "benchmarks/.gitignore"),
  );
  return repo;
}

export function write(path: string, content: string): string {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return path;
}
