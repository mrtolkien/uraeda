// The `Jobs` record and its writes, on a repository's endpoint (the plan's task 6): which jobs a
// repository lists, their problems and next runs, the pause and "Run now" through the settings
// file, and the live update each change sends.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { createApp } from "../app.ts";
import { startJobs } from "../jobs/start.ts";
import { binding, byIdAt, type Data, fateAt, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;
type Read = { data?: Data; error?: { message: string }; ok: boolean };

const SELECT = ["id", "enabled", "problem", "jobs"];
const PROMPT = "Check the dependencies and report what is outdated.";

/** A job's table, on the fake agent. */
const table = (name: string, repositories: Array<string>, over = "") =>
  `[[jobs]]
name = "${name}"
repositories = [${repositories.map((one) => `"${one}"`).join(", ")}]
schedule = "daily 03:00"
agent = "fake"
model = "fake-small"
prompt = "${PROMPT}"
${over}
`;

/** The server's app with the scheduler of its jobs, which the test stops. */
async function setup(config: (repository: string) => string) {
  const server = await testServer();
  const path = join(server.configDir, "config.toml");
  writeFileSync(path, config(server.name));
  const jobs = startJobs({
    binding,
    dataDir: server.dataDir,
    featureOptions: server.featureOptions,
    frames: server.frames,
    hosts: server.hosts,
    previews: server.previews,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  });
  onTestFinished(() => jobs.stop());
  const app = createApp({
    allowOrigins: [],
    binding,
    dataDir: server.dataDir,
    featureOptions: server.featureOptions,
    frames: server.frames,
    hosts: server.hosts,
    jobs,
    port: 4310,
    previews: server.previews,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  });
  const read = async (name: string | null = server.name) =>
    (await byIdAt(app, name, "Jobs", ["jobs"], SELECT))[0];
  const mutate = async (name: string, input: unknown, select = ["jobs"]): Promise<Read> => {
    const [result] = await fateAt(app, server.name, [{ input, kind: "mutation", name, select }]);
    return result;
  };
  return { app, configText: () => readFileSync(path, "utf8"), mutate, path, read, server };
}

/** A fake turn that waits, and what ends its wait. */
function held() {
  const wake: { release: () => void } = { release: () => {} };
  return {
    release: () => wake.release(),
    step: () => new Promise<void>((done) => (wake.release = done)),
  };
}

const names = (record: Data): Array<string> => record.jobs.map((one: Data) => one.name);
const job = (record: Data, name: string): Data =>
  record.jobs.find((one: Data) => one.name === name);

/** The system lines of a session's first turn. */
function systemLines(server: Server, session: string): Array<string> {
  const [turn] = server.sessions.cache.turns(session);
  return server.sessions.cache
    .items(turn.id, 0, 10)
    .flatMap((item) => (item.kind === "system" ? [item.text] : []));
}

/**
 * US4 1, 2, 3, more 2; US5 and the edge case of a file that cannot be read. Catches: a job shown
 * in a repository it does not name, a pause that never reaches the file, "Run now" held by the
 * pause, and a second run started while the first works.
 */
test("the jobs' record and its writes", async () => {
  const run = await setup(
    (name) =>
      `# my jobs\n${table("Dependencies", [name, "notes"])}\n${table("Elsewhere", ["elsewhere"])}\n` +
      `${table("Code quality", [name]).replace("daily 03:00", "dayly 06:00")}`,
  );
  const { server } = run;
  const record = await run.read();
  expect(record.enabled).toBe(true);
  expect(record.problem).toBeNull();
  expect(names(record)).toEqual(["Dependencies", "Code quality"]);
  expect(job(record, "Dependencies").problem).toBe("“notes” is not in Uraeda's list.");
  expect(job(record, "Code quality").problem).toBe(
    "Not running: the schedule “dayly 06:00” is not understood",
  );
  expect(job(record, "Code quality").next).toEqual({ at: null, why: "problem" });
  expect(job(record, "Dependencies")).toMatchObject({
    agent: "fake",
    history: [],
    on: true,
    prompt: PROMPT,
    reportOnly: false,
    repositories: [server.name, "notes"],
    schedule: { hour: 3, kind: "daily", minute: 0 },
    scheduleText: "daily 03:00",
  });
  expect(typeof job(record, "Dependencies").next.at).toBe("string");
  expect(job(record, "Dependencies").next.why).toBeNull();

  // A pause is written in the job's table, answered by the record, and shown as the reason.
  const paused = await run.mutate("jobs.setOn", { name: "Dependencies", on: false });
  expect(job(paused.data, "Dependencies").next).toEqual({ at: null, why: "paused" });
  expect(run.configText()).toContain("on = false");
  expect(run.configText()).toContain("# my jobs");

  // Run now, though the job is paused: a session with its line, the row in the history.
  server.adapter.script([]);
  const ran = await run.mutate("jobs.runNow", { name: "Dependencies" }, ["session", "jobs"]);
  expect(ran.ok).toBe(true);
  expect(systemLines(server, ran.data.session)).toContain(
    "Started by “Run now” of the job “Dependencies”.",
  );
  const [row] = job(ran.data, "Dependencies").history;
  expect(row).toMatchObject({
    due: null,
    folder: null,
    outcome: "started",
    reason: null,
    session: ran.data.session,
    title: "Dependencies",
    trigger: "manual",
  });
  expect(new Date(row.at).toISOString()).toBe(row.at);

  // A second run while the first works is refused, with the card's words.
  const hold = held();
  server.adapter.script([hold.step]);
  const second = await run.mutate("jobs.runNow", { name: "Dependencies" }, ["session"]);
  expect(second.ok).toBe(true);
  const third = await run.mutate("jobs.runNow", { name: "Dependencies" }, ["session"]);
  expect(third.error?.message).toBe("refused: “Dependencies” still runs here.");
  hold.release();

  // A job named for another repository, or a name unknown, is refused.
  const elsewhere = await run.mutate("jobs.runNow", { name: "Elsewhere" }, ["session"]);
  expect(elsewhere.ok).toBe(false);

  // With config.toml unreadable: the settings' message, no job, and a write refused.
  writeFileSync(run.path, "[server\n");
  const broken = await run.read();
  expect(broken.problem).toMatch(/^Cannot read .*config\.toml/);
  expect(broken.jobs).toEqual([]);
  const refused = await run.mutate("jobs.setOn", { name: "Dependencies", on: true });
  expect(refused.error?.message).toMatch(/^refused: Cannot read /);
  expect(readFileSync(run.path, "utf8")).toBe("[server\n");
});

/** US5 1, more 1, 2: the writes through the record, a rename keeping its runs. */
test("a job is added, edited, renamed, and removed through the record", async () => {
  const run = await setup(() => "");
  const { server } = run;
  const input = {
    agent: "fake",
    name: "Dependencies",
    prompt: PROMPT,
    reportOnly: false,
    repositories: [server.name],
    schedule: "daily 03:00",
  };
  const added = await run.mutate("jobs.add", { job: input });
  expect(names(added.data)).toEqual(["Dependencies"]);
  expect(run.configText()).toContain('schedule = "daily 03:00"');

  const again = await run.mutate("jobs.add", { job: input });
  expect(again.error?.message).toBe("refused: A job named “Dependencies” exists already.");
  const badTime = await run.mutate("jobs.update", {
    job: { ...input, schedule: "daily 25:00" },
    name: "Dependencies",
  });
  expect(badTime.error?.message).toBe("refused: A time is from 00:00 to 23:59.");
  const noRepository = await run.mutate("jobs.update", {
    job: { ...input, repositories: [] },
    name: "Dependencies",
  });
  expect(noRepository.error?.message).toBe("refused: A job runs in one repository at least.");
  expect(run.configText()).toContain("daily 03:00");

  // The runs follow the job under its new name.
  server.adapter.script([]);
  await run.mutate("jobs.runNow", { name: "Dependencies" }, ["session"]);
  const weekly = { ...input, name: "Upgrades", schedule: "monday 04:00" };
  const renamed = await run.mutate("jobs.update", { job: weekly, name: "Dependencies" });
  expect(names(renamed.data)).toEqual(["Upgrades"]);
  expect(job(renamed.data, "Upgrades").scheduleText).toBe("monday 04:00");
  expect(job(renamed.data, "Upgrades").history).toHaveLength(1);

  const removed = await run.mutate("jobs.remove", { name: "Upgrades" });
  expect(removed.data.jobs).toEqual([]);
  expect(run.configText()).not.toContain("[[jobs]]");
  // Its sessions stay.
  expect(
    server.sessions.cache.jobs.history("Upgrades", await server.sessions.mainRoot(server.repo)),
  ).not.toEqual([]);
});

/** The edge cases of a job in a repository: a named agent that is off, and a switch for all. */
test("a job's problem names the agent that is off here, and `enabled` is the switch", async () => {
  const run = await setup((name) => table("Ghost", [name]).replace('"fake"', '"ghost"'));
  const record = await run.read();
  expect(job(record, "Ghost").problem).toBe("Not running here: ghost is off in this repository.");
  expect(job(record, "Ghost").next).toEqual({ at: null, why: "agent-off" });

  writeFileSync(run.path, `[runs]\nscheduled_jobs = false\n${table("Ghost", [run.server.name])}`);
  await run.server.settings.reload();
  expect((await run.read()).enabled).toBe(false);
});

/** The record is announced where the settings, a run's row, or a run's session change. */
test("the record is announced on every repository's endpoint", async () => {
  const run = await setup((name) => table("Dependencies", [name]));
  const { server } = run;
  const update = vi.spyOn(server.hosts.all()[0].live, "update");
  const heard = () =>
    update.mock.calls.filter(([type, id]) => type === "Jobs" && id === "jobs").length;

  await run.mutate("jobs.setOn", { name: "Dependencies", on: false });
  await vi.waitFor(() => expect(heard()).toBeGreaterThan(0));

  // A hand edit of the file reaches it too, after the settings' quiet moment.
  const before = heard();
  writeFileSync(run.path, "");
  await server.settings.reload();
  await vi.waitFor(() => expect(heard()).toBeGreaterThan(before));

  // A run's row, apart from any session.
  writeFileSync(run.path, table("Dependencies", [server.name]));
  await server.settings.reload();
  const rows = heard();
  server.sessions.cache.jobs.add({
    at: 1,
    due: 1,
    job: "Dependencies",
    outcome: "skipped",
    reason: "working",
    repository: await server.sessions.mainRoot(server.repo),
    session: null,
    trigger: "schedule",
  });
  expect(heard()).toBeGreaterThan(rows);

  // A run's session, as its turn ends.
  const hold = held();
  server.adapter.script([hold.step]);
  const started = await run.mutate("jobs.runNow", { name: "Dependencies" }, ["session"]);
  const working = heard();
  hold.release();
  const [turn] = server.sessions.cache.turns(started.data.session);
  await server.sessions.settled(turn.id);
  expect(heard()).toBeGreaterThan(working);
});
