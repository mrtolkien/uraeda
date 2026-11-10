import type { Job, Jobs } from "uraeda-binding";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
// The helpers first: they load the app, whose modules the scheduler's imports in a cycle.
import {
  atStep,
  binding,
  fixtureRepo,
  testFeatureOptions,
  testServer,
} from "../../__tests__/helpers.ts";
import type { Binding, RepoContext } from "../../fate/context.ts";
import type { SessionRow } from "../../runner/cache.ts";
import { jobMessage } from "../../runner/message.ts";
import { type Scheduler, startScheduler } from "../scheduler.ts";

// The times are the process's local time: the zone is set for this file, and put back.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  if (zone === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = zone;
  }
});

type Server = Awaited<ReturnType<typeof testServer>>;

const PROMPT = "Check the dependencies and report what is outdated.";

/** A change of the fixture repository, which the runs' sessions are moved into. */
const CHANGE = "2026-10-12-cli-tuis";

/** The minute the scheduler waits between two runs. */
const MINUTE = 60_000;

/** A job in the repository `repositories` names, daily at 03:00 on the fake agent. */
function job(name: string, repositories: Array<string>, over: Partial<Job> = {}): Job {
  return {
    agent: "fake",
    model: "fake-small",
    name,
    on: true,
    prompt: PROMPT,
    reportOnly: false,
    repositories,
    schedule: { hour: 3, kind: "daily", minute: 0 },
    scheduleText: "daily 03:00",
    ...over,
  };
}

/**
 * A scheduler over the server's repository, `uraeda`, and a second one, `notes`, which the test
 * ticks itself: its clock, its jobs, its switch, the repositories its extension is off in, and the
 * waits it was asked for are the test's.
 */
async function setup(using: Binding = binding) {
  const server = await testServer(undefined, { binding: using });
  const [host] = server.hosts.all();
  const repos = [
    { name: host.name, path: host.path },
    { name: "notes", path: fixtureRepo() },
  ];
  const state = {
    binding: using,
    clock: new Date("2026-11-09T12:00:00"),
    enabled: true,
    extensionOff: new Set<string>(),
    jobs: { jobs: [] } as Jobs,
    reads: 0,
    waits: [] as Array<number>,
  };
  const featureOptions = testFeatureOptions(server.dataDir, server.settings, using);
  const context = (repo: string): RepoContext => ({
    binding: state.binding,
    dataDir: server.dataDir,
    featureOptions,
    frames: server.frames,
    hosts: server.hosts,
    previews: server.previews,
    repo,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  });
  /** A scheduler on the test's state: a second one is a second trigger, or a second server. */
  const start = (waits = true): Scheduler =>
    startScheduler({
      context,
      enabled: () => state.enabled,
      every: null,
      isOn: (repository) => !state.extensionOff.has(repository),
      jobs: async () => state.jobs,
      now: () => state.clock,
      repos: () => {
        state.reads += 1;
        return repos;
      },
      ...(waits && {
        wait: async (ms: number) => {
          state.waits.push(ms);
        },
      }),
    });
  const scheduler = start();
  const created: Array<SessionRow> = [];
  server.sessions.cache.onCreated((row) => created.push(row));
  const at = async (time: string) => {
    state.clock = new Date(`2026-11-${time}`);
    await scheduler.tick();
  };
  /** The job's rows in a repository, the newest first. */
  const history = async (name: string, path = repos[0].path) =>
    server.sessions.cache.jobs.history(name, await server.sessions.mainRoot(path));
  /** The sessions the job started in a repository. */
  const sessions = async (name: string, path = repos[0].path) =>
    (await history(name, path)).flatMap((row) => (row.session === null ? [] : [row.session]));
  return { at, created, history, repos, scheduler, server, sessions, start, state };
}

/** The system lines and the first message of a session's first turn. */
function opening(server: Server, session: string) {
  const [turn] = server.sessions.cache.turns(session);
  const items = server.sessions.cache.items(turn.id, 0, 10);
  const message = items.find((item) => item.kind === "message");
  if (message?.kind !== "message") {
    throw new Error("the session has no message");
  }
  return {
    lines: items.flatMap((item) => (item.kind === "system" ? [item.text] : [])),
    message,
    turn: turn.id,
  };
}

/** A run whose agent ends its turn at once. */
async function ends(server: Server, session: string) {
  for (const turn of server.sessions.cache.turns(session)) {
    await server.sessions.settled(turn.id);
  }
}

/** Triggers that race: a time is started once, by two ticks, two schedulers, or a clock set back. */
async function startedOnce(run: Awaited<ReturnType<typeof setup>>, name: string) {
  // Two ticks at once, then two more, then the clock set back: one session for the time.
  run.state.jobs = { jobs: [job("Twice", [name])] };
  run.server.adapter.script([]);
  await run.at("14T02:59:00");
  run.state.clock = new Date("2026-11-14T03:00:10");
  await Promise.all([run.scheduler.tick(), run.scheduler.tick()]);
  await run.at("14T03:00:40");
  await run.at("14T02:59:30");
  await run.at("14T03:00:20");
  expect(await run.sessions("Twice")).toHaveLength(1);

  // Two schedulers on one record, as two servers or two queues, ticked at once: one session.
  run.state.jobs = { jobs: [job("Race", [name])] };
  const other = run.start();
  const before = run.created.length;
  await run.at("15T02:59:00");
  await other.tick();
  run.state.clock = new Date("2026-11-15T03:00:10");
  await Promise.all([run.scheduler.tick(), other.tick()]);
  expect(run.created.length - before).toBe(1);
  expect(await run.history("Race")).toHaveLength(1);
  await other.stop();
}

/**
 * US1 1, 2, more 1, 3; SC-001; the edge cases of the agent off, a repository not listed, the
 * extension off. Catches: a run on the default agent, without its line, or with the prompt as the
 * human's own message, which would block the acceptance of task 5.
 */
test("a job runs at its time", async () => {
  const run = await setup();
  const [uraeda, notes] = run.repos;
  run.server.adapter.script([]);
  run.server.adapter.script([]);
  run.state.jobs = { jobs: [job("Dependencies", [uraeda.name, notes.name])] };
  await run.at("11T02:59:00");
  expect(run.created).toHaveLength(0);
  await run.at("11T03:00:20");

  // The rows as created: the title is set right after.
  const [first, second] = run.created.map((row) => run.server.sessions.cache.session(row.id)!);
  expect(first.title).toBe("Dependencies");
  expect(first.folder).toBeNull();
  expect(first.agent).toBe("fake");
  expect(first.model).toBe("fake-small");
  expect(first.repo).toBe(await run.server.sessions.mainRoot(uraeda.path));
  expect(second.repo).toBe(await run.server.sessions.mainRoot(notes.path));
  const { lines, message } = opening(run.server, first.id);
  expect(lines).toContain("Started by the schedule “Dependencies”.");
  expect(message.text.startsWith(PROMPT)).toBe(true);
  expect(message.text).toContain("started by the scheduled job “Dependencies”");
  expect(message.origin).toBe("workflow");
  // The second repository's run starts a wait of a minute after the first's.
  expect(run.state.waits).toEqual([MINUTE]);
  const [row] = await run.history("Dependencies");
  expect(row).toMatchObject({
    due: new Date("2026-11-11T03:00:00").getTime(),
    outcome: "started",
    session: first.id,
    trigger: "schedule",
  });
  // The next time is tomorrow's: nothing more runs at 03:00:50.
  await run.at("11T03:00:50");
  expect(run.created).toHaveLength(2);

  // US1 more 3: hourly runs at each top of the hour.
  run.server.adapter.script([]);
  run.state.jobs = {
    jobs: [job("Hourly", [uraeda.name], { schedule: { hour: 0, kind: "hourly", minute: 0 } })],
  };
  await run.at("11T13:59:00");
  await run.at("11T14:00:05");
  expect(await run.sessions("Hourly")).toHaveLength(1);

  // Rows where nothing runs: no session and no row.
  const none = [
    ["its agent unregistered", job("Gone", [uraeda.name], { agent: "gone" })],
    ["a repository not in the list", job("Nowhere", ["nowhere"])],
    ["the extension off there", job("Off", ["notes-off"])],
    ["a pause", job("Paused", [uraeda.name], { on: false })],
    ["a problem", job("Broken", [uraeda.name], { problem: "The schedule is not understood" })],
  ] as const;
  run.repos.push({ name: "notes-off", path: notes.path });
  run.state.extensionOff.add("notes-off");
  run.state.jobs = { jobs: none.map(([, one]) => one) };
  await run.at("12T02:59:00");
  await run.at("12T03:00:10");
  for (const [row, one] of none) {
    expect(await run.history(one.name), row).toEqual([]);
  }
  expect(run.created).toHaveLength(3);

  // A chat that does not start, a model the agent does not list, leaves no row and no session: the
  // time is tried again at the next tick, once the job is mended (R9).
  run.state.jobs = { jobs: [job("Mended", [uraeda.name], { model: "no-such-model" })] };
  await run.at("13T02:59:00");
  await run.at("13T03:00:10");
  expect(await run.history("Mended")).toEqual([]);
  expect(run.created).toHaveLength(3);
  run.server.adapter.script([]);
  run.state.jobs = { jobs: [job("Mended", [uraeda.name])] };
  await run.at("13T03:00:40");
  expect(await run.sessions("Mended")).toHaveLength(1);
});

/**
 * US1 3; US2 1, 2; SC-002; the review focus of a job added just after its time (R2). Catches: a
 * server that makes up for the times it missed, which the human refused.
 */
test("a time nobody saw arrive is never started", async () => {
  const run = await setup();
  const [{ name }] = run.repos;
  const ran = async (job: string) => (await run.sessions(job)).length;

  // A scheduler first ticked at 03:02 starts nothing for 03:00, and nothing at 09:00.
  run.state.jobs = { jobs: [job("Late", [name])] };
  await run.at("11T03:02:00");
  await run.at("11T09:00:00");
  expect(await ran("Late")).toBe(0);

  // A job added at 3:02 starts nothing before the next 03:00.
  run.state.jobs = { jobs: [] };
  await run.at("12T03:01:00");
  run.state.jobs = { jobs: [job("Added", [name])] };
  await run.at("12T03:02:00");
  await run.at("12T03:02:30");
  expect(await ran("Added")).toBe(0);
  run.server.adapter.script([]);
  await run.at("13T03:00:10");
  expect(await ran("Added")).toBe(1);

  // The switch off at 03:00 and on at 09:00: nothing; the next day at 03:00: one run.
  run.state.jobs = { jobs: [job("Switched", [name])] };
  await run.at("14T02:59:00");
  run.state.enabled = false;
  await run.at("14T03:00:10");
  run.state.enabled = true;
  await run.at("14T09:00:00");
  expect(await ran("Switched")).toBe(0);
  run.server.adapter.script([]);
  await run.at("15T03:00:10");
  expect(await ran("Switched")).toBe(1);

  // A job turned on at 03:02 starts nothing for 03:00 either.
  run.state.jobs = { jobs: [job("Resumed", [name], { on: false })] };
  await run.at("16T02:59:00");
  run.state.jobs = { jobs: [job("Resumed", [name])] };
  await run.at("16T03:02:00");
  expect(await ran("Resumed")).toBe(0);

  // A tick at 03:03 after one at 02:59: one run.
  run.state.jobs = { jobs: [job("Caught", [name])] };
  await run.at("17T02:59:00");
  run.server.adapter.script([]);
  await run.at("17T03:03:00");
  expect(await ran("Caught")).toBe(1);

  // A tick at 03:06 after one at 02:59: more than 5 minutes past, nothing.
  const late = await setup();
  late.state.jobs = { jobs: [job("Missed", [late.repos[0].name])] };
  await late.at("17T02:59:00");
  await late.at("17T03:06:00");
  expect(late.created).toHaveLength(0);
});

/**
 * US2 3, more 1, 2; SC-003; the review focus of a time started twice. Catches: two runs of one job
 * at once, or a second pull request on the same files.
 */
test("a time is skipped while the last run works or its change is open", async () => {
  const merged: { done?: boolean } = {};
  const using = {
    ...binding,
    readWorkspace: async (repo: string) =>
      (merged.done
        ? atStep(binding, CHANGE, { name: "done", waitsOn: "none" })
        : binding
      ).readWorkspace(repo),
  } as Binding;
  const run = await setup(using);
  const [{ name, path }] = run.repos;

  // Monday's run still at work on Tuesday 03:00: no session, and the history says why.
  run.state.jobs = { jobs: [job("Dependencies", [name])] };
  await run.at("09T02:59:00");
  await run.at("09T03:00:10");
  expect(run.created).toHaveLength(1);
  await run.at("10T02:59:00");
  await run.at("10T03:00:10");
  expect(run.created).toHaveLength(1);
  const [skipped] = await run.history("Dependencies");
  expect(skipped).toMatchObject({
    due: new Date("2026-11-10T03:00:00").getTime(),
    outcome: "skipped",
    reason: "working",
    session: null,
  });
  // Run now is refused while its run works.
  await expect(run.scheduler.runNow(name, "Dependencies")).rejects.toThrow(
    "“Dependencies” still runs here.",
  );
  expect(await run.scheduler.nextRun(run.state.jobs.jobs[0], name)).toEqual({
    at: new Date("2026-11-11T03:00:00"),
  });

  // A stopped run does not block the next time.
  const [stuck] = run.created;
  run.server.sessions.stop(path, stuck.id);
  await ends(run.server, stuck.id);
  run.server.adapter.script([]);
  await run.at("11T02:59:00");
  await run.at("11T03:00:10");
  expect(run.created).toHaveLength(2);

  // Its session moved into a change still open: reason "change-open".
  const [, second] = run.created;
  await ends(run.server, second.id);
  run.server.sessions.cache.attach(second.id, CHANGE);
  await run.at("12T02:59:00");
  await run.at("12T03:00:10");
  expect(run.created).toHaveLength(2);
  expect((await run.history("Dependencies"))[0]).toMatchObject({
    outcome: "skipped",
    reason: "change-open",
  });
  expect(await run.scheduler.nextRun(run.state.jobs.jobs[0], name)).toEqual({
    why: "change-open",
  });

  // Run now starts with an open change, by hand: no time, and its own line.
  run.server.adapter.script([]);
  const manual = await run.scheduler.runNow(name, "Dependencies");
  expect(opening(run.server, manual.session).lines).toContain(
    "Started by “Run now” of the job “Dependencies”.",
  );
  expect((await run.history("Dependencies"))[0]).toMatchObject({
    due: null,
    outcome: "started",
    trigger: "manual",
  });
  await ends(run.server, manual.session);

  // Once merged: a run. The latest started run, the manual one, has no open change.
  merged.done = true;
  run.server.adapter.script([]);
  await run.at("13T02:59:00");
  await run.at("13T03:00:10");
  expect(run.created).toHaveLength(4);
  await startedOnce(run, name);
});

/** US3's note: a report-only job's run changes no file, and its offer waits for the human. */
test("a job's message says what to do with a needed change", () => {
  const { name, prompt } = job("Dependencies", []);
  const open = jobMessage({ name, prompt, reportOnly: false });
  const reportOnly = jobMessage({ name, prompt, reportOnly: true });
  expect(open.startsWith(`${PROMPT}\n\n---\n\n`)).toBe(true);
  expect(open).toContain("Uraeda starts the change from your offer");
  expect(open).not.toContain("Change no file");
  expect(reportOnly).toContain("Change no file");
  expect(reportOnly).toContain("the offer waits for the human");
  expect(reportOnly).not.toContain("Uraeda starts the change");
  expect(open).toContain("Nobody follows it");
});

/** Stopping the scheduler cuts the minute between two runs short, and starts no other run. */
test("a stop does not wait for the minute between runs", async () => {
  const run = await setup();
  const [uraeda, notes] = run.repos;
  run.state.jobs = { jobs: [job("Dependencies", [uraeda.name, notes.name])] };
  const scheduler = run.start(false);
  run.state.clock = new Date("2026-11-11T02:59:00");
  await scheduler.tick();
  run.state.clock = new Date("2026-11-11T03:00:10");
  run.server.adapter.script([]);
  const ticking = scheduler.tick();
  // Its first run starts at once, and the second waits a minute: the stop ends the wait.
  while (run.created.length === 0) {
    await new Promise((done) => setImmediate(done));
  }
  await scheduler.stop();
  await ticking;
  expect(run.created).toHaveLength(1);
});

/** A tick lists the repositories once, however many jobs and repositories it looks at. */
test("a tick reads the repositories once", async () => {
  const run = await setup();
  const names = run.repos.map(({ name }) => name);
  run.state.jobs = { jobs: ["A", "B", "C"].map((name) => job(name, names)) };
  await run.at("11T12:00:00");
  run.state.reads = 0;
  await run.at("11T12:00:30");
  expect(run.state.reads).toBe(1);
});

/**
 * Review focus: a time started twice. A "Run now" that lands while a tick reads the workspace to see
 * whether the last run's change is open is refused: the job's start is reserved before that read.
 */
test("a run by hand during a tick's workspace read is refused, and one run starts", async () => {
  const hold: { enter?: () => void; gate?: Promise<void> } = {};
  const merged: { done?: boolean } = {};
  const using = {
    ...binding,
    readWorkspace: async (repo: string) => {
      // Only the first read after the test arms the gate waits on it.
      const gate = hold.gate;
      hold.gate = undefined;
      if (gate !== undefined) {
        hold.enter?.();
        await gate;
      }
      return (
        merged.done ? atStep(binding, CHANGE, { name: "done", waitsOn: "none" }) : binding
      ).readWorkspace(repo);
    },
  } as Binding;
  const run = await setup(using);
  const [{ name }] = run.repos;
  run.state.jobs = { jobs: [job("Dependencies", [name])] };
  run.server.adapter.script([]);
  await run.at("09T02:59:00");
  await run.at("09T03:00:10");
  const [first] = run.created;
  await ends(run.server, first.id);
  run.server.sessions.cache.attach(first.id, CHANGE);
  merged.done = true;
  await run.at("10T02:59:00");

  // The tick of 03:00 waits on the workspace; a run by hand lands meanwhile.
  const gate = Promise.withResolvers<void>();
  const entry = Promise.withResolvers<void>();
  hold.gate = gate.promise;
  hold.enter = entry.resolve;
  run.server.adapter.script([]);
  run.state.clock = new Date("2026-11-10T03:00:10");
  const ticking = run.scheduler.tick();
  await entry.promise;
  await expect(run.scheduler.runNow(name, "Dependencies")).rejects.toThrow(
    "“Dependencies” still runs here.",
  );
  gate.resolve();
  await ticking;
  expect(run.created).toHaveLength(2);
  expect(await run.sessions("Dependencies")).toHaveLength(2);
  // The start ended: a run by hand is allowed once the run stops.
  await ends(run.server, run.created[1].id);
  run.server.adapter.script([]);
  await run.scheduler.runNow(name, "Dependencies");
  expect(run.created).toHaveLength(3);
});

/**
 * US2 3, SC-003. Catches: a run by hand that opened no change hiding the change an earlier run
 * opened and left open, so the next time starts a second run on the same files.
 */
test("a later run that opened no change does not hide a change still open", async () => {
  const run = await setup();
  const [{ name }] = run.repos;
  run.state.jobs = { jobs: [job("Dependencies", [name])] };
  run.server.adapter.script([]);
  await run.at("09T02:59:00");
  await run.at("09T03:00:10");
  const [first] = run.created;
  await ends(run.server, first.id);
  run.server.sessions.cache.attach(first.id, CHANGE);

  // Run now, with the change open, ends without a change of its own.
  run.server.adapter.script([]);
  const manual = await run.scheduler.runNow(name, "Dependencies");
  await ends(run.server, manual.session);

  await run.at("10T02:59:00");
  await run.at("10T03:00:10");
  expect(run.created).toHaveLength(2);
  expect((await run.history("Dependencies"))[0]).toMatchObject({
    outcome: "skipped",
    reason: "change-open",
  });
  expect(await run.scheduler.nextRun(run.state.jobs.jobs[0], name)).toEqual({
    why: "change-open",
  });
});
