/**
 * `vp run release <version>`: starts a release from an up-to-date `main`. It writes the version's
 * section of `CHANGELOG.md` from the records added to `specs/done/` since the last tag, sets the
 * Cargo workspace's version, then, once confirmed, commits, tags `v<version>`, and pushes both.
 *
 * The tag does the rest: `release.yml` releases `ura`, with the changelog's section as the GitHub
 * release's notes, and `npm.yml` publishes the npm packages at the same version, which
 * `release.ts prepare` writes into them. The `package.json` files in git stay at `0.0.0`.
 *
 * `--dry-run` prints the notes and changes nothing.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { cargoVersion, releaseOf } from "./release.ts";

/** The checkout. */
const ROOT = resolve(import.meta.dirname, "../../..");
const REPOSITORY = "https://github.com/mrtolkien/uraeda";
const HEADER = "# Changelog\n";

/** A record of `specs/done/`, as the notes show it. */
export type Record = {
  kind: string;
  path: string;
  pullRequest: string | null;
  summary: string;
  title: string;
};

/** The record's kind, title, pull request, and the first paragraph of its "What and why". */
export function parseRecord(path: string, text: string): Record {
  const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
  const field = (name: string) =>
    new RegExp(`^${name}:\\s*(.+)$`, "m").exec(front)?.[1].trim() ?? null;
  const title = /^# (?:Record: )?(.+)$/m.exec(text)?.[1].trim() ?? path;
  const section = text.split(/^## What and why\n/m)[1]?.split(/^## /m)[0] ?? "";
  const why = section.trim().split(/\n\s*\n/)[0];
  return {
    kind: field("kind") ?? "feature",
    path,
    pullRequest: field("pull-request"),
    summary: why.replaceAll(/\s*\n\s*/g, " ").trim(),
    title,
  };
}

/** The text with its links relative to the record made absolute, at the tag, for GitHub's release. */
export function absoluteLinks(text: string, path: string, version: string): string {
  return text.replaceAll(/\]\((?![a-z]+:|#)([^)]+)\)/g, (_, target: string) => {
    const file = target.startsWith("/")
      ? target.slice(1)
      : posix.normalize(posix.join(posix.dirname(path), target));
    return `](${REPOSITORY}/blob/v${version}/${file})`;
  });
}

/** The version's section: features, then changes, each record linked at the tag. */
export function notes(version: string, date: string, records: Array<Record>): string {
  const groups: Array<[string, Array<Record>]> = [
    ["Features", records.filter(({ kind }) => kind !== "change")],
    ["Changes", records.filter(({ kind }) => kind === "change")],
  ];
  const lines = [`## ${version} - ${date}`, ""];
  if (records.length === 0) {
    lines.push("No feature or change recorded in `specs/done/`.", "");
  }
  for (const [heading, group] of groups) {
    if (group.length === 0) {
      continue;
    }
    lines.push(`### ${heading}`, "");
    for (const { path, pullRequest, summary, title } of group) {
      const number = pullRequest && /\/pull\/(\d+)$/.exec(pullRequest)?.[1];
      const link = number ? ` ([#${number}](${pullRequest}))` : "";
      const record = `[${title}](${REPOSITORY}/blob/v${version}/${path})`;
      const text = absoluteLinks(summary, path, version);
      lines.push(`- **${record}**${link}${text ? `: ${text}` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** The changelog with the section added above every older one. */
export function addSection(changelog: string, section: string): string {
  const body = changelog.startsWith(HEADER)
    ? changelog.slice(HEADER.length).trimStart()
    : changelog;
  return `${HEADER}\n${section}${body ? `\n${body}` : ""}`.replace(/\n*$/, "\n");
}

/** `Cargo.toml` with its `[workspace.package]` version set. */
export function setCargoVersion(cargo: string, version: string): string {
  const updated = cargo.replace(
    /^(\[workspace\.package\][^[]*?^version = ")[^"]+(")/m,
    `$1${version}$2`,
  );
  if (updated === cargo) {
    throw new Error("no [workspace.package] version in Cargo.toml");
  }
  return updated;
}

/** A version's major, minor, and patch. */
function numbers(version: string): Array<number> {
  return version.split(/[-+]/)[0].split(".").map(Number);
}

/** Whether `next` comes after `current`, comparing major, minor, and patch. */
export function isAfter(next: string, current: string): boolean {
  const [a, b] = [numbers(next), numbers(current)];
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) {
      return a[index] > b[index];
    }
  }
  // The same numbers: only a prerelease of the current version's release may follow.
  return current.includes("-") && next !== current;
}

function git(...args: Array<string>): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/** Refuses anything but a clean `main` at `origin/main`, with the tag still free. */
function checkCheckout(tag: string) {
  if (git("branch", "--show-current") !== "main") {
    throw new Error("release from main");
  }
  if (git("status", "--porcelain") !== "") {
    throw new Error("the checkout has uncommitted changes");
  }
  git("fetch", "--quiet", "--tags", "origin", "main");
  if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) {
    throw new Error("main is not origin/main: pull or push first");
  }
  if (git("tag", "--list", tag) !== "") {
    throw new Error(`the tag ${tag} already exists`);
  }
}

/** The records added to `specs/done/` since the last version tag, or ever without one. */
function newRecords(): Array<Record> {
  const last = git("tag", "--list", "v*", "--sort=-v:refname").split("\n")[0];
  const range = last ? [`${last}..HEAD`] : ["HEAD"];
  const added = last
    ? git("diff", "--name-only", "--diff-filter=A", ...range, "--", "specs/done/*.md")
    : git("ls-files", "specs/done/*.md");
  return added
    .split("\n")
    .filter(Boolean)
    .sort()
    .map((path) => parseRecord(path, readFileSync(join(ROOT, path), "utf8")));
}

async function confirm(question: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await prompt.question(question)).trim());
  } finally {
    prompt.close();
  }
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { "dry-run": { type: "boolean" } },
  });
  const [given] = positionals;
  if (!given || positionals.length > 1) {
    throw new Error("usage: vp run release <version> [--dry-run]");
  }
  const { version } = releaseOf(given);
  const tag = `v${version}`;
  const current = cargoVersion(ROOT);
  if (!isAfter(version, current)) {
    throw new Error(`${version} does not come after the current version ${current}`);
  }
  const section = notes(version, new Date().toISOString().slice(0, 10), newRecords());
  process.stdout.write(`${section}\n`);
  if (values["dry-run"]) {
    return;
  }
  checkCheckout(tag);

  const changelog = join(ROOT, "CHANGELOG.md");
  const cargo = join(ROOT, "Cargo.toml");
  writeFileSync(
    changelog,
    addSection(existsSync(changelog) ? readFileSync(changelog, "utf8") : "", section),
  );
  writeFileSync(cargo, setCargoVersion(readFileSync(cargo, "utf8"), version));
  // Updates the workspace's own versions in Cargo.lock, without building.
  execFileSync("cargo", ["metadata", "--format-version", "1", "--offline"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  process.stdout.write(`${git("status", "--short")}\n\n`);

  if (!(await confirm(`Commit, tag ${tag}, and push both to origin? [y/N] `))) {
    git("checkout", "--", "Cargo.toml", "Cargo.lock");
    if (git("status", "--porcelain", "CHANGELOG.md").startsWith("??")) {
      git("clean", "--force", "--quiet", "--", "CHANGELOG.md");
    } else {
      git("checkout", "--", "CHANGELOG.md");
    }
    process.stdout.write("Stopped: nothing changed.\n");
    return;
  }
  git("add", "CHANGELOG.md", "Cargo.toml", "Cargo.lock");
  execFileSync("git", ["commit", "--quiet", "-m", `chore: release ${tag}`], {
    cwd: ROOT,
    stdio: "inherit",
  });
  git("tag", tag);
  git("push", "--atomic", "origin", "main", tag);
  process.stdout.write(
    `Pushed ${tag}: ${REPOSITORY}/actions builds ura's release and publishes the npm packages.\n`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`release: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
