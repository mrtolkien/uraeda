import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { Case } from "../case.ts";
import { makeConfigDir, upstreamHosts } from "../config-dir.ts";
import { writeWrapper } from "../docker-wrapper.ts";
import { prepareSandbox } from "../sandbox.ts";
import { fakeBin } from "./fake-bin.ts";
import { temporary, write } from "./samples.ts";

afterEach(() => vi.unstubAllEnvs());

const CASE: Case = {
  id: "c",
  image: "ghcr.io/x/y@sha256:1",
  proposal: "/p.md",
  repository: "/app",
  source: "swe-bench-pro-v2",
  task: "t",
  upstream: "https://github.com/ansible/ansible",
};

/** The arguments the wrapper gives docker, with the adapter's arguments after `claude`. */
function runWrapper(env: Record<string, string> = {}) {
  const fake = fakeBin(temporary());
  const folder = temporary();
  const path = writeWrapper({
    bareOrigin: "/bare/origin.git",
    claude: "/host/claude",
    configDir: "/cfg",
    image: "image:tag",
    label: "run-1",
    path: join(folder, "wrapper"),
    repository: "/host/repo",
  });
  execFileSync(path, ["-p", "--plugin-dir", "/p", "--add-dir", "/i", "--session-id", "x"], {
    env: { ...fake.env, ...env },
  });
  return fake.calls()[0] ?? [];
}

test("mounts each path at its own path, and the repository at /app", () => {
  const args = runWrapper();

  expect(args).toEqual(
    expect.arrayContaining([
      "/host/repo:/app",
      "/p:/p:ro",
      "/i:/i",
      "/bare/origin.git:/bare/origin.git",
      "/cfg:/cfg",
    ]),
  );
  expect(args.slice(-8)).toEqual([
    "image:tag",
    "-p",
    "--plugin-dir",
    "/p",
    "--add-dir",
    "/i",
    "--session-id",
    "x",
  ]);
});

test("passes the token by name and never mounts the credentials", () => {
  const args = runWrapper({ CLAUDE_CODE_OAUTH_TOKEN: "secret-value" });

  expect(args).toContain("CLAUDE_CODE_OAUTH_TOKEN");
  expect(args.join(" ")).not.toContain("secret-value");
  expect(args.join(" ")).not.toContain(".claude");
});

test("the settings set the model, turn the fallback off, and deny the upstream's hosts", () => {
  const folder = makeConfigDir({
    deniedHosts: upstreamHosts("https://github.com/ansible/ansible"),
    effort: "medium",
    folder: join(temporary(), "config"),
    model: "claude-sonnet-5-5",
  });

  const settings = JSON.parse(readFileSync(join(folder, "settings.json"), "utf8"));

  expect(settings).toMatchObject({
    effort: "medium",
    env: { ANTHROPIC_SMALL_FAST_MODEL: "claude-sonnet-5-5", DISABLE_AUTOUPDATER: "1" },
    model: "claude-sonnet-5-5",
    switchModelsOnFlag: false,
  });
  expect(settings.permissions.deny).toEqual([
    "WebFetch(domain:github.com)",
    "WebFetch(domain:raw.githubusercontent.com)",
    "WebFetch(domain:api.github.com)",
    "WebFetch(domain:codeload.github.com)",
  ]);
});

test("a host that is not GitHub is denied alone", () => {
  expect(upstreamHosts("https://git.example.org/x/y")).toEqual(["git.example.org"]);
});

/** A sandbox made with the fakes, over a repository with one file. */
async function sandbox() {
  const source = temporary();
  write(join(source, "app.py"), "print(1)\n");
  const fake = fakeBin(source);
  vi.stubEnv("PATH", fake.env.PATH ?? "");
  const constitution = write(join(temporary(), "constitution.md"), "# Constitution\n");
  const made = await prepareSandbox({
    case: CASE,
    claude: "/host/claude",
    constitution,
    effort: "medium",
    model: "claude-sonnet-5-5",
  });
  return { fake, made };
}

test("prepares a repository with its specs, its constitution, and a bare origin it pushed to", async () => {
  const { made } = await sandbox();

  expect(readFileSync(join(made.repo, "app.py"), "utf8")).toBe("print(1)\n");
  expect(readFileSync(join(made.repo, "specs/CONSTITUTION.md"), "utf8")).toBe("# Constitution\n");
  expect(
    execFileSync("git", ["-C", made.bareOrigin, "log", "--format=%s", "main"], {
      encoding: "utf8",
    }),
  ).toBe("specs\nbase\n");
  await made.close();
});

test("close removes the containers and the folders", async () => {
  const { fake, made } = await sandbox();

  await made.close();

  expect(fake.calls().some((call) => call[0] === "rm")).toBe(true);
  expect(existsSync(made.repo)).toBe(false);
});

test("a failed preparation removes what it made", async () => {
  const source = temporary();
  const fake = fakeBin(source);
  vi.stubEnv("PATH", fake.env.PATH ?? "");

  await expect(
    prepareSandbox({
      case: CASE,
      claude: "/host/claude",
      constitution: "/missing/constitution.md",
      effort: "medium",
      model: "claude-sonnet-5-5",
      work: join(temporary(), "work"),
    }),
  ).rejects.toThrow();

  expect(fake.calls().some((call) => call[0] === "rm")).toBe(true);
});
