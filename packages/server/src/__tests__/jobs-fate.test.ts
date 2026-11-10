// The `Jobs` record and its writes, on a repository's endpoint (the plan's task 6): which jobs a
// repository lists, their problems and next runs, the pause and "Run now" through the settings
// file, and the live update each change sends.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { createApp } from "../app.ts";
import { startJobs } from "../jobs/start.ts";
import type { Binding } from "../fate/context.ts";
import { publish } from "../live.ts";
import { binding, byIdAt, type Data, fateAt, fixtureRepo, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;
type Read = { data?: Data; error?: { message: string }; ok: boolean };

const SELECT = ["id", "enabled", "problem", "jobs", "timeZone"];
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
async function setup(config: (repository: string) => string, using: Binding = binding) {
  const server = await testServer(undefined, { binding: using });
  const path = join(server.configDir, "config.toml");
  writeFileSync(path, config(server.name));
  const jobs = startJobs({
    binding: using,
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
    binding: using,
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

/** Adds a second repository to the list, and writes its name where the config says `placeholder`. */
async function addOther(run: Awaited<ReturnType<typeof setup>>, placeholder: string) {
  const added = (await binding.addRepository(run.server.dataDir, fixtureRepo())).repository.name;
  await run.server.hosts.reload();
  writeFileSync(run.path, readFileSync(run.path, "utf8").replaceAll(placeholder, added));
  return added;
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
  // The zone the schedules run in, which the card's times read in.
  expect(record.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  // "Elsewhere" names no repository of the list: every repository lists it, with its problem (R38).
  expect(names(record)).toEqual(["Dependencies", "Elsewhere", "Code quality"]);
  expect(job(record, "Elsewhere").problem).toBe("“elsewhere” is not in Uraeda's list.");
  expect(job(record, "Dependencies").problem).toBe("“notes” is not in Uraeda's list.");
  expect(job(record, "Code quality").problem).toBe(
    "Not running: the schedule “dayly 06:00” is not understood",
  );
  expect(job(record, "Code quality").next).toEqual({ at: null, text: null, why: "problem" });
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
  expect(job(paused.data, "Dependencies").next).toEqual({ at: null, text: null, why: "paused" });
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

/**
 * The edge cases of a job in a repository: the words of an agent that is off or not available are
 * the server's, titled as its other refusals are (review 05, finding 6); and `enabled` is the switch.
 */
test("a job's next run says why its agent does not run it, in the server's words, and `enabled` is the switch", async () => {
  const run = await setup(
    (name) =>
      `${table("Ghost", [name]).replace('"fake"', '"ghost"')}\n${table("Named", [name])}\n` +
      table("Default", [name]).replace('agent = "fake"\nmodel = "fake-small"\n', ""),
  );
  const { server } = run;
  const record = await run.read();
  // A named agent that is not on here: its title, or its name when it is not registered.
  expect(job(record, "Ghost").problem).toBeNull();
  expect(job(record, "Ghost").next).toEqual({
    at: null,
    text: "Not running here: ghost is off in this repository.",
    why: "agent-off",
  });

  // An agent that is on and not available, named or by default: its title, not its id.
  server.adapter.installed = false;
  await server.sessions.check();
  const title = server.sessions.runtimes.title("fake");
  const unavailable = `Not running here: ${title} is not available on this machine.`;
  const after = await run.read();
  expect(job(after, "Named").next).toEqual({ at: null, text: unavailable, why: "agent-off" });
  expect(job(after, "Default").next).toEqual({ at: null, text: unavailable, why: "agent-off" });

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

/**
 * Finding 8. Catches: one workspace read for each job that started a change, on every read of the
 * record, which each client repeats at each run's start: the record reads it once.
 */
test("a read of the record reads the workspace once, however many jobs started a change", async () => {
  const reads = { workspace: 0 };
  const counting: Binding = {
    ...binding,
    readWorkspace: async (repo: string) => {
      reads.workspace += 1;
      return binding.readWorkspace(repo);
    },
  };
  const run = await setup(
    (name) => ["A", "B", "C"].map((one) => table(one, [name])).join("\n"),
    counting,
  );
  const { cache } = run.server.sessions;
  const root = await run.server.sessions.mainRoot(run.server.repo);
  for (const [at, name] of ["A", "B", "C"].entries()) {
    const chat = await run.server.sessions.newChat(run.server.repo);
    cache.jobs.add({
      at: at + 1,
      due: at + 1,
      job: name,
      outcome: "started",
      reason: null,
      repository: root,
      session: chat.id,
      trigger: "schedule",
    });
    cache.attach(chat.id, "2026-10-12-cli-tuis");
  }
  reads.workspace = 0;
  const record = await run.read();
  expect(names(record)).toEqual(["A", "B", "C"]);
  expect(reads.workspace).toBe(1);
  for (const one of ["A", "B", "C"]) {
    expect(job(record, one).next.why).toBe("change-open");
  }
});

/**
 * Review 05, Codex P2. Catches: a card that reads "Never ran" for a job whose latest started run
 * is older than the 50 rows of the history, as a job whose change stays open for days is, with an
 * hourly time skipped each hour: the record gives the latest started run apart from its history.
 */
test("the record gives the latest started run beyond the history's 50 rows", async () => {
  const run = await setup((name) => table("Hourly", [name]));
  const { cache } = run.server.sessions;
  const root = await run.server.sessions.mainRoot(run.server.repo);
  const chat = await run.server.sessions.newChat(run.server.repo);
  const add = (due: number, outcome: "skipped" | "started") =>
    cache.jobs.add({
      at: due,
      due,
      job: "Hourly",
      outcome,
      reason: outcome === "skipped" ? "change-open" : null,
      repository: root,
      session: outcome === "started" ? chat.id : null,
      trigger: "schedule",
    });
  expect(job(await run.read(), "Hourly").last).toBeNull();
  add(1, "started");
  for (let due = 2; due < 60; due += 1) {
    add(due, "skipped");
  }
  const hourly = job(await run.read(), "Hourly");
  expect(hourly.history).toHaveLength(50);
  expect(hourly.history.every((row: Data) => row.outcome === "skipped")).toBe(true);
  expect(hourly.last).toMatchObject({ outcome: "started", session: chat.id });
});

/**
 * Review 07, finding 4. Catches: a scheduled start that failed leaving no trace: the history lists
 * it with why, and the card's last run is the failed start while it is the newest run, however many
 * skipped times follow it, until a run starts.
 */
test("a failed start is in the history, and is the card's last run while it is the newest run", async () => {
  const run = await setup((name) => table("Hourly", [name]));
  const { cache } = run.server.sessions;
  const root = await run.server.sessions.mainRoot(run.server.repo);
  const chat = await run.server.sessions.newChat(run.server.repo);
  const add = (due: number, outcome: "failed" | "skipped" | "started") =>
    cache.jobs.add({
      at: due,
      due,
      ...(outcome === "failed" && { error: "Claude Code has no model opus-9: pick another" }),
      job: "Hourly",
      outcome,
      reason: outcome === "skipped" ? "working" : null,
      repository: root,
      session: outcome === "started" ? chat.id : null,
      trigger: "schedule",
    });
  add(1, "started");
  add(2, "failed");
  const failed = job(await run.read(), "Hourly");
  expect(failed.history[0]).toMatchObject({
    error: "Claude Code has no model opus-9: pick another",
    outcome: "failed",
  });
  expect(failed.last).toMatchObject({
    error: "Claude Code has no model opus-9: pick another",
    outcome: "failed",
  });
  // A skipped time after it is no run: the failure stays the card's last run.
  add(3, "skipped");
  expect(job(await run.read(), "Hourly").last).toMatchObject({ outcome: "failed" });
  // A run that started later is.
  add(4, "started");
  expect(job(await run.read(), "Hourly").last).toMatchObject({ error: null, outcome: "started" });
});

/**
 * Review 05, finding 2. Catches: two jobs of one name, which the file may hold and the card says,
 * indistinguishable to a reader of the record: each row carries its place in the file.
 */
test("each job of the record carries its place in the file, two of one name too", async () => {
  const run = await setup(
    (name) =>
      `${table("Elsewhere", ["other-repository"])}\n${table("Twin", [name])}\n` +
      `${table("Other", [name])}\n${table("Twin", [name])}`,
  );
  // "Elsewhere" is in the second repository of the list, so it leaves a gap in this one's places.
  await addOther(run, "other-repository");
  const record = await run.read();
  expect(record.jobs.map((one: Data) => [one.index, one.name])).toEqual([
    [1, "Twin"],
    [2, "Other"],
    [3, "Twin"],
  ]);
  expect(record.jobs.map((one: Data) => one.problem)).toEqual([
    null,
    null,
    "Two jobs are named “Twin”.",
  ]);
});

/** A watcher's burst with nothing changed. */
const NO_CHANGES = {
  branchDecisions: [],
  decisions: false,
  features: [],
  files: [],
  git: false,
  inbox: false,
  priorities: false,
  workspace: false,
};

/**
 * Finding 7. Catches: a card that keeps "“notes” is not in Uraeda's list.", "Not running here: Claude
 * Code is off in this repository.", or "change-open" after the repository was added, the agent turned
 * on, or the change merged, until an unrelated job event or a reload.
 */
test("the record is announced when the repository list, a runtime, or the workspace changes", async () => {
  const run = await setup((name) => table("Dependencies", [name]));
  const { server } = run;
  const host = server.hosts.all()[0];
  const update = vi.spyOn(host.live, "update");
  const heard = () =>
    update.mock.calls.filter(([type, id]) => type === "Jobs" && id === "jobs").length;

  // A repository added to the list, read again by the hosts.
  let before = heard();
  await binding.addRepository(server.dataDir, fixtureRepo());
  await server.hosts.reload();
  await vi.waitFor(() => expect(heard()).toBeGreaterThan(before));

  // An agent turned on or off, or found available, in a repository.
  before = heard();
  server.sessions.runtimes.changed();
  await vi.waitFor(() => expect(heard()).toBeGreaterThan(before));

  // A change a job started, merged or dropped, as the watcher and the pull requests' refresh report
  // it: a feature no job's run is in asks nothing of the jobs (review 05, finding 8).
  const { cache } = server.sessions;
  const chat = await server.sessions.newChat(server.repo);
  cache.jobs.add({
    at: 1,
    due: 1,
    job: "Dependencies",
    outcome: "started",
    reason: null,
    repository: await server.sessions.mainRoot(server.repo),
    session: chat.id,
    trigger: "schedule",
  });
  cache.attach(chat.id, "2026-10-12-cli-tuis");
  before = heard();
  publish({ ...NO_CHANGES, features: ["2026-10-01-other"] }, host, server.sessions);
  expect(heard()).toBe(before);
  publish({ ...NO_CHANGES, features: ["2026-10-12-cli-tuis"] }, host, server.sessions);
  expect(heard()).toBeGreaterThan(before);
  // A feature or a branch that appeared or went changes the open changes: announced.
  before = heard();
  publish({ ...NO_CHANGES, workspace: true }, host, server.sessions);
  expect(heard()).toBeGreaterThan(before);

  // Only the changed host's bus hears it, not the global one nor another repository's.
  const other = server.hosts.all().find((one) => one !== host);
  const elsewhere = vi.spyOn(other!.live, "update");
  publish({ ...NO_CHANGES, workspace: true }, host, server.sessions);
  expect(elsewhere.mock.calls.filter(([type]) => type === "Jobs")).toEqual([]);

  // A burst that moved no feature or branch asks nothing of the jobs.
  before = heard();
  publish({ ...NO_CHANGES, git: true }, host, server.sessions);
  expect(heard()).toBe(before);
});

/**
 * Finding 9; R13. Catches: "Run now" refused for a schedule that is not understood, which a run by
 * hand does not read, so the human cannot test the prompt until it is mended; and a run by hand of a
 * job that cannot run at all, refused with a fragment instead of the card's words.
 */
test("Run now is refused only while the run works, or for a problem that makes a run impossible", async () => {
  const run = await setup(
    (name) =>
      `${table("Quality", [name]).replace("daily 03:00", "dayly 06:00")}\n` +
      `${table("Silent", [name]).replace(PROMPT, "")}\n` +
      `${table("Twin", [name])}\n${table("Twin", [name])}\n` +
      `${table("Lost", ["nowhere"])}`,
  );
  const { server } = run;
  const runNow = (name: string) => run.mutate("jobs.runNow", { name }, ["session"]);

  // A schedule that is not understood does not stop a run by hand.
  server.adapter.script([]);
  const ran = await runNow("Quality");
  expect(ran.ok).toBe(true);
  expect(systemLines(server, ran.data.session)).toContain(
    "Started by “Run now” of the job “Quality”.",
  );

  // What makes a run impossible is refused, in the words of the card.
  expect((await runNow("Silent")).error?.message).toBe("refused: A job has no prompt.");
  expect((await runNow("Twin")).error?.message).toBe("refused: Two jobs are named “Twin”.");
  expect((await runNow("Lost")).ok).toBe(false);
});

/**
 * Review 06, finding 9 (and Codex P2). Catches: a skipped time that names the title of the session
 * of an older run, which is its job's name, or of a change that is not the one open: the row carries
 * the open change's folder and its own title, from the workspace.
 */
test("a skipped time names the change that blocked it, by the change's title", async () => {
  const run = await setup((name) => table("Dependencies", [name]));
  const { cache } = run.server.sessions;
  const root = await run.server.sessions.mainRoot(run.server.repo);
  const folder = "2026-10-12-cli-tuis";
  const title = (await binding.readWorkspace(run.server.repo)).features.find(
    (one) => one.folder === folder,
  )?.title;
  expect(title).toBeTruthy();
  const add = (due: number, blockedBy: string | null) =>
    cache.jobs.add({
      at: due,
      blockedBy,
      due,
      job: "Dependencies",
      outcome: "skipped",
      reason: "change-open",
      repository: root,
      session: null,
      trigger: "schedule",
    });
  add(1, folder);
  add(2, null);
  add(3, "2026-01-01-gone");
  const [gone, unknown, named] = job(await run.read(), "Dependencies").history as Array<Data>;
  expect(named.blockedBy).toEqual({ folder, title });
  expect(unknown.blockedBy).toBeNull();
  // A folder no workspace lists any more has no title to say.
  expect(gone.blockedBy).toBeNull();
});

/**
 * Review 06, finding 8 (R38). Catches: a hand-written job with no `repositories`, a text for it, or
 * a misspelt name, which no repository lists, so the human could not find the job that never runs:
 * every repository's Jobs place lists a job that names no repository of Uraeda's list, with its
 * problem, and none lists a job that names another repository of the list.
 */
test("a job that names no listed repository is listed in every repository, with its problem", async () => {
  const run = await setup((name) => {
    const bare = table("Bare", [name]).replace(/repositories = .*\n/, "");
    const text = table("Text", []).replace(/repositories = .*\n/, 'repositories = "uraeda"\n');
    return [
      table("Mine", [name]),
      table("Away", ["other-repository"]),
      table("Nowhere", ["ureada"]),
      bare,
      text,
    ].join("\n");
  });
  const { name } = run.server;
  // "Away" names the second repository of the list.
  const added = await addOther(run, "other-repository");
  const record = await run.read(name);
  expect(names(record)).toEqual(["Mine", "Nowhere", "Bare", "Text"]);
  expect(job(record, "Nowhere").problem).toBe("“ureada” is not in Uraeda's list.");
  expect(job(record, "Bare").problem).toBe("A job runs in one repository at least.");
  expect(job(record, "Text").problem).toBe("repositories is a list of names.");
  // None of the three runs anywhere, and the card says why, not a time.
  for (const stray of ["Nowhere", "Bare", "Text"]) {
    expect(job(record, stray).next).toEqual({ at: null, text: null, why: "problem" });
  }
  // The same three are in the other repository's place, with "Away" there.
  expect(names(await run.read(added))).toEqual(["Away", "Nowhere", "Bare", "Text"]);
});
