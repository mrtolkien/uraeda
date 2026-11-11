// The binding's transport contracts, on the real native output: the shapes and errors the server
// relies on. The core's own tests own the detailed rules, like comments kept in arrays, BOMs, and
// Windows line ends (`crates/core/tests/settings_writes.rs`).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  addJob,
  checkRunOptions,
  checkedPort,
  checkedSchedule,
  mergeRunOptions,
  readJobs,
  readSettings,
  removeJob,
  setContinue,
  setJobOn,
  setPort,
  setRunOptions,
  setSingleKeyShortcuts,
  setVimCommands,
  setVimMode,
  settingsFile,
  updateJob,
} from "./index.js";
import { temporaryFolder } from "./test-utils.ts";

const PORT_PROBLEM = "The port is a number from 1 to 65535.";

/** A config folder of the test's own, holding `text` as its settings file. */
function configWith(text: string) {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), text);
  return dir;
}

/** The message a call rejects with, or undefined when it resolves. */
const rejection = (call: Promise<unknown>) =>
  call.then(
    () => undefined,
    (error: Error) => error.message,
  );

const read = (dir: string) => readFileSync(join(dir, "config.toml"), "utf8");

test("settings cross the binding in camelCase, an absent key left out", async () => {
  const dir = configWith(
    [
      "[server]",
      'allowed_hosts = ["Box.TS.net"]',
      "open_browser = false",
      "",
      "[runs]",
      "build_in_fresh_session = true",
      "continue_after_restart = false",
      "continue_after_limit = true",
      "automatic_continues = 3",
      "catch_up_pull_requests = true",
      'review_depth = "branch"',
      "",
      "[runs.steps.spec]",
      'model = "opus"',
      "new_session = true",
      "",
    ].join("\n"),
  );

  expect(await readSettings(dir)).toEqual({
    keyboard: {},
    runs: {
      automaticContinues: 3,
      catchUpPullRequests: true,
      continueAfterLimit: true,
      continueAfterRestart: false,
      options: {
        reviewDepth: "branch",
        steps: [{ model: "opus", newSession: true, step: "spec" }],
      },
    },
    server: { allowedHosts: ["box.ts.net"], openBrowser: false },
  });
});

test("run options cross the binding: written in their tables, checked, and merged", async () => {
  const dir = configWith("# mine\n[runs]\nbuild_in_fresh_session = false\n");
  const options = {
    reviewers: [{ command: "make check" }],
    steps: [{ agent: "codex", newSession: false, step: "plan" }],
  };

  const written = await setRunOptions(dir, options);

  expect(written.runs.options).toEqual(options);
  expect(read(dir)).toBe(
    '# mine\n[runs]\n\n[runs.steps.plan]\nagent = "codex"\nnew_session = false\n\n[[runs.reviewers]]\ncommand = "make check"\n',
  );
  expect(() => checkRunOptions({ reviewDepth: "deep", steps: [] })).toThrow(
    "refused: deep is not a review depth: waves or branch.",
  );
  expect(mergeRunOptions(options, { steps: [{ model: "gpt", step: "plan" }] })).toEqual({
    reviewers: [{ command: "make check" }],
    steps: [{ agent: "codex", model: "gpt", newSession: false, step: "plan" }],
  });
});

test("a write is read back by a new read, keeping the human's comment and order", async () => {
  const dir = configWith("# mine\n[server]\nopen_browser = true # keep\n");

  const written = await setPort(dir, " 4400 ");

  expect(written).toEqual({
    keyboard: {},
    runs: { options: { steps: [] } },
    server: { openBrowser: true, port: 4400 },
  });
  expect(read(dir)).toBe("# mine\n[server]\nopen_browser = true # keep\nport = 4400\n");
  expect(await readSettings(dir)).toEqual(written);
});

test("the keyboard table crosses the binding, and a write keeps the human's comment and order", async () => {
  const dir = configWith("# mine\n[keyboard]\nsingle_key_shortcuts = false # mouse only\n");

  expect(await readSettings(dir)).toEqual({
    keyboard: { singleKeyShortcuts: false },
    runs: { options: { steps: [] } },
    server: {},
  });
  const written = await setSingleKeyShortcuts(dir, true);

  expect(written.keyboard).toEqual({ singleKeyShortcuts: true });
  expect(read(dir)).toBe("# mine\n[keyboard]\nsingle_key_shortcuts = true # mouse only\n");
});

test("Vim's keys cross the binding, its commands as a list of lines", async () => {
  const dir = configWith("# mine\n[keyboard]\nsingle_key_shortcuts = false # mouse only\n");

  await setVimMode(dir, true);
  const written = await setVimCommands(dir, ["imap jj <Esc>", "nmap Y y$"]);

  expect(written.keyboard).toEqual({
    singleKeyShortcuts: false,
    vimCommands: ["imap jj <Esc>", "nmap Y y$"],
    vimMode: true,
  });
  expect(await readSettings(dir)).toEqual(written);
});

test("a synchronous check throws its problem at the call, not as a rejection", () => {
  expect(checkedPort(" 8080 ")).toBe(8080);
  let thrown: unknown;
  try {
    checkedPort("70000");
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe(PORT_PROBLEM);
});

test("an asynchronous refusal rejects with the core's code and message, writing nothing", async () => {
  const before = "[server]\nport = 4310\n";
  const dir = configWith(before);

  expect(await rejection(setPort(dir, "0"))).toBe(`refused: ${PORT_PROBLEM}`);
  expect(read(dir)).toBe(before);
});

test("an unreadable file rejects reads and writes with its own code, and is kept", async () => {
  const before = "[server\nport = 4310\n";
  const dir = configWith(before);

  const reading = await rejection(readSettings(dir));
  const writing = await rejection(setPort(dir, "4400"));

  expect(reading).toMatch(new RegExp(`^unreadable: Cannot read ${escape(settingsFile(dir))}: `));
  expect(writing).toMatch(new RegExp(`^unreadable: Cannot read ${escape(settingsFile(dir))}: `));
  expect(read(dir)).toBe(before);
});

function escape(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

test("jobs read and write through the binding", async () => {
  const dir = configWith("# mine\n[server]\nport = 4310\n");
  const job = {
    effort: "high",
    name: "Dependencies",
    prompt: 'Upgrade \\ the """ dependencies.\nRun the tests.\\\n',
    reportOnly: false,
    repositories: ["uraeda", "notes"],
    schedule: "monday 04:00",
  };

  await addJob(dir, job);

  const { jobs, problem } = await readJobs(dir);
  expect(problem).toBeUndefined();
  expect(jobs).toEqual([
    {
      effort: "high",
      name: "Dependencies",
      on: true,
      prompt: job.prompt,
      reportOnly: false,
      repositories: ["uraeda", "notes"],
      schedule: { day: 1, hour: 4, kind: "weekly", minute: 0 },
      scheduleOnly: false,
      scheduleText: "monday 04:00",
    },
  ]);
  expect(checkedSchedule("hourly")).toEqual({ hour: 0, kind: "hourly", minute: 0 });
  expect(() => checkedSchedule("daily 25:00")).toThrow("A time is from 00:00 to 23:59.");

  await updateJob(dir, "Dependencies", { ...job, name: "Upgrades", schedule: "hourly" });
  await setJobOn(dir, "Upgrades", false);
  expect((await readJobs(dir)).jobs.map(({ name, on }) => [name, on])).toEqual([
    ["Upgrades", false],
  ]);
  expect(await rejection(addJob(dir, { ...job, name: "Upgrades" }))).toBe(
    "refused: A job named “Upgrades” exists already.",
  );
  await removeJob(dir, "Upgrades");
  expect((await readJobs(dir)).jobs).toEqual([]);

  expect((await setContinue(dir, "jobs", false)).runs.scheduledJobs).toBe(false);
  expect(read(dir)).toContain("scheduled_jobs = false");
  expect(read(dir)).toContain("# mine\n[server]\nport = 4310\n");

  writeFileSync(join(dir, "config.toml"), "jobs = 3\n");
  expect(await readJobs(dir)).toEqual({ jobs: [], problem: "jobs is a list of [[jobs]] tables." });
  expect(await readSettings(dir)).toBeDefined();
});
