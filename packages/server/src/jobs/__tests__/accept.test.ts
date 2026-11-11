import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job, Jobs } from "uraeda-binding";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
// The helpers first: they load the app, whose modules the acceptance's imports in a cycle.
import { binding, git, testFeatureOptions, testServer } from "../../__tests__/helpers.ts";
import type { ExtensionsHost } from "../../extensions/server.ts";
import type { Binding, RepoContext } from "../../fate/context.ts";
import { toChange } from "../../fate/session-moves.ts";
import { readSession } from "../../fate/sessions.ts";
import type { AgentEvent } from "../../runner/events.ts";
import type { FakeStep } from "../../runner/fake.ts";
import { acceptOffers } from "../accept.ts";
import { Busy } from "../busy.ts";
import { startRun } from "../run.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const NAME = "Dependencies";

/** The repository's name in Uraeda's list, which the jobs name: the server's, once one is made. */
const repository = { name: "uraeda" };

const TITLE = "Upgrade three dependencies";

/** A change offer, as the agent ends its report on one. */
const block = (kind: string, title = TITLE) =>
  `\`\`\`uraeda-offer ${kind}\n# ${title}\n\nUpgrade a, b, and c to their latest minor versions.\n\`\`\``;

const OFFER = `Three dependencies are outdated.\n\n${block("change")}\n`;

/** A tool call that ends: the agent works between its texts. */
function call(id: string): Array<AgentEvent> {
  return [
    { id, input: {}, kind: "read", name: "Read", target: "package.json", type: "toolStart" },
    { id, isError: false, output: "", type: "toolEnd" },
  ];
}

/** The events of a turn that ends in failure, or in the human's stop. */
const failed: AgentEvent = {
  denials: [],
  errors: ["the agent crashed"],
  interrupted: false,
  ok: false,
  type: "result",
};
const stopped: AgentEvent = { ...failed, errors: [], interrupted: true };

/** A job on the fake agent that is not report only, running in every repository by default. */
function job(over: Partial<Job> = {}): Job {
  return {
    agent: "fake",
    name: NAME,
    on: true,
    prompt: "Check the dependencies and report what is outdated.",
    reportOnly: false,
    repositories: [repository.name],
    schedule: { hour: 3, kind: "daily", minute: 0 },
    scheduleOnly: false,
    scheduleText: "daily 03:00",
    ...over,
  };
}

/**
 * The acceptance over the server's repository, on a binding whose jobs are the test's, `state.jobs`,
 * and which a test may hold at `state.gate`, as a settings file read slowly.
 */
async function setup(extensions?: ExtensionsHost) {
  // `file`: the jobs are the core's reading of the settings file, as in the app, not the test's.
  const state: { file?: boolean; gate?: Promise<void>; jobs: Jobs } = {
    jobs: { jobs: [job()] },
  };
  const using: Binding = {
    ...binding,
    readJobs: async (dir) => {
      await state.gate;
      return state.file ? binding.readJobs(dir) : state.jobs;
    },
  };
  const server = await testServer(undefined, { binding: using });
  repository.name = server.name;
  state.jobs = { jobs: [job()] };
  const shared = {
    binding: using,
    dataDir: server.dataDir,
    ...(extensions && { extensions }),
    featureOptions: testFeatureOptions(server.dataDir, server.settings, using),
    frames: server.frames,
    hosts: server.hosts,
    previews: server.previews,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  };
  const busy = new Busy();
  const accepting = acceptOffers(shared, busy);
  onTestFinished(() => accepting());
  const ctx: RepoContext = { ...shared, repo: server.repo };
  let due = 0;
  return {
    accepting,
    busy,
    ctx,
    server,
    state,
    /** Starts the job's run on a fake turn of `steps`, and waits for the acceptance to finish. */
    async run(steps: Array<FakeStep>, started: Job = job(), then?: Array<FakeStep>) {
      state.jobs = { jobs: [started] };
      server.adapter.script(steps);
      if (then) {
        server.adapter.script(then);
      }
      const run = await startRun(
        ctx,
        started,
        { at: Date.now(), due: ++due, trigger: "schedule" },
        await server.sessions.mainRoot(ctx.repo),
      );
      const session = run!.session;
      await ended(server, session);
      await accepting.settled();
      // The change's own run, when one started.
      await ended(server, session);
      return session;
    },
  };
}

/** Waits for the session's turns to end, the move's own included. */
async function ended(server: Server, session: string) {
  for (const turn of server.sessions.cache.turns(session)) {
    await server.sessions.settled(turn.id);
  }
}

/** The system lines of every turn of the session. */
function systemLines(server: Server, session: string): Array<string> {
  const { cache } = server.sessions;
  return cache
    .turns(session)
    .flatMap((turn) => cache.items(turn.id, 0, 50))
    .flatMap((item) => (item.kind === "system" ? [item.text] : []));
}

/** What the repository's history says: its commits and its branches. */
function history(server: Server) {
  return {
    branches: git(server.repo, "branch", "--list", "--format=%(refname:short)"),
    log: git(server.repo, "log", "--oneline", "--all"),
  };
}

const folderOf = (server: Server, session: string) =>
  server.sessions.cache.session(session)?.folder ?? null;

/**
 * US3 1, 2; SC-004. Catches: a job whose offer waits until morning, the proposal's whole point; a
 * quiet night that leaves a commit, a branch, or a worktree.
 */
test("a run's offer starts its change", async () => {
  const { run, server } = await setup();
  const before = history(server);
  const session = await run([{ text: OFFER, type: "text" }], job(), []);

  const moved = server.sessions.cache.session(session);
  expect(moved?.folder).toMatch(/^\d{4}-\d{2}-\d{2}-/);
  expect(systemLines(server, session)).toContain(
    `The job “${NAME}” started the change “${TITLE}”.`,
  );
  const [run1, change] = server.sessions.cache.turns(session);
  expect(run1.state).toBe("done");
  expect(change).toMatchObject({ kind: "workflow", step: "change", trigger: "start" });
  expect(history(server).branches).toContain(`change/${moved?.folder}`);

  // A run ending on "Nothing to upgrade." makes nothing: the session keeps no folder.
  const quiet = await setup();
  const calm = history(quiet.server);
  const idle = await quiet.run([{ text: "Nothing to upgrade.", type: "text" }]);
  expect(folderOf(quiet.server, idle)).toBeNull();
  expect(history(quiet.server)).toEqual(calm);
  expect(before).toEqual(calm);
});

/**
 * US3 3, more 2, 3; SC-005. Catches: a change started for a report-only job, after the human wrote,
 * or from text that was not the run's last word, the relaxed guard's edges.
 */
test("an offer waits where the job or the human says so", async () => {
  const { ctx, run, server, state } = await setup();
  // A change started by mistake runs on, so the assertions below read it, and no turn hangs.
  server.adapter.fallback = () => [];
  const before = history(server);
  const { cache } = server.sessions;
  const offer: FakeStep = { text: OFFER, type: "text" };
  // The runs go one after another: each acceptance reads the repository as it is.
  const sessions: Record<string, string> = {};
  const check = async (why: string, steps: Array<FakeStep>, started?: Job) => {
    sessions[why] = await run(steps, started);
  };
  let session = "";
  cache.onCreated((row) => (session = row.id));
  /** The human's message, as a steer writes it into the turn that is ending. */
  const steered = () => {
    const [turn] = cache.turns(session);
    cache.appendItem(turn.id, {
      id: "human",
      kind: "message",
      origin: "human",
      state: "read",
      text: "Wait, not that one.",
    });
  };

  await check("report only", [offer], job({ reportOnly: true }));
  await check("a human message", [steered, offer]);
  await check("a human message queued behind", [
    () => void server.sessions.send(ctx.repo, session, { text: "Wait, not that one." }),
    offer,
  ]);
  await check("stopped", [offer, stopped]);
  await check("failed", [offer, failed]);
  await check("a feature offer", [{ text: `${block("feature")}\n`, type: "text" }]);
  await check("an open block", [
    {
      text: "```uraeda-offer change\n# Upgrade three dependencies\n\nUpgrade a, b, c.",
      type: "text",
    },
  ]);
  await check("an open block after a closed one", [
    {
      text: `${OFFER}\nAnd also:\n\n\`\`\`uraeda-offer change\n# Another\n\nNot closed.`,
      type: "text",
    },
  ]);
  await check("prose after the offer", [
    {
      text: `${block("change")}\n\nOn reflection this is too risky: do not start it.`,
      type: "text",
    },
  ]);
  await check("a code block after the offer", [
    { text: `${OFFER}\n\`\`\`sh\nnpm test\n\`\`\`\n`, type: "text" },
  ]);
  await check("an earlier text", [offer, ...call("c1"), { text: "Done.", type: "text" }]);
  await check("a call after the offer", [offer, ...call("c2")]);
  await check("a job deleted meanwhile", [
    () => {
      state.jobs = { jobs: [] };
    },
    offer,
  ]);

  // A run row of another repository: the row's repository is not its session's.
  state.jobs = { jobs: [job()] };
  const chat = await server.sessions.newChat(ctx.repo);
  cache.jobs.add({
    at: Date.now(),
    due: 999,
    job: NAME,
    outcome: "started",
    reason: null,
    repository: "/another/repository",
    session: chat.id,
    trigger: "schedule",
  });
  server.adapter.script([offer]);
  const sent = await server.sessions.send(ctx.repo, chat.id, {
    line: "Started by the schedule.",
    origin: "workflow",
    text: "Check.",
  });
  await server.sessions.settled(sent.turn);
  sessions["another repository"] = chat.id;

  for (const [why, id] of Object.entries(sessions)) {
    expect(folderOf(server, id), why).toBeNull();
    expect(cache.jobs.ofSession(id)?.refusal ?? null, why).toBeNull();
  }
  expect(history(server)).toEqual(before);
});

/**
 * Review focus: a message that arrives while the acceptance reads the settings reaches the session,
 * and the card waits: no change starts for it, whether it starts a turn or lands in the turn that
 * ended.
 */
test.each(["starts a turn", "lands in the ended turn"])(
  "a human message that %s while the acceptance waits leaves the card waiting",
  async (how) => {
    const { accepting, ctx, server, state } = await setup();
    server.adapter.fallback = () => [];
    const before = history(server);
    const gate = Promise.withResolvers<void>();
    state.gate = gate.promise;
    server.adapter.script([{ text: OFFER, type: "text" }]);
    const started = await startRun(
      ctx,
      job(),
      { at: Date.now(), due: 1, trigger: "schedule" },
      await server.sessions.mainRoot(ctx.repo),
    );
    const session = started!.session;
    await ended(server, session);
    // The turn ended and the acceptance waits for the settings: the human writes now.
    const [turn] = server.sessions.cache.turns(session);
    if (how === "starts a turn") {
      const sent = await server.sessions.send(ctx.repo, session, { text: "Not this one." });
      await server.sessions.settled(sent.turn);
    } else {
      server.sessions.cache.appendItem(turn.id, {
        id: "human",
        kind: "message",
        origin: "human",
        state: "read",
        text: "Not this one.",
      });
    }
    gate.resolve();
    await accepting.settled();
    expect(folderOf(server, session)).toBeNull();
    expect(server.sessions.cache.jobs.ofSession(session)?.refusal ?? null).toBeNull();
    expect(history(server)).toEqual(before);
  },
);

/**
 * US3 more 1. Catches: a refused start that leaves the session reading as a plain new reply.
 */
test("a change that cannot start asks, with its reason", async () => {
  const { accepting, ctx, run, server } = await setup();
  const first = await run([{ text: OFFER, type: "text" }], job(), []);
  expect(folderOf(server, first)).not.toBeNull();

  // The same proposal, the same day: the change's folder name is taken.
  const second = await run([{ text: OFFER, type: "text" }]);
  expect(folderOf(server, second)).toBeNull();
  const refused = await readSession(ctx, second);
  expect(refused).toMatchObject({ status: "attention", statusReason: "change-refused" });
  expect(refused?.changeRefusal).toMatch(/exists/u);
  expect(refused?.changeRefusal).not.toMatch(/^refused: /u);
  const [turn] = server.sessions.cache.turns(second);
  expect(server.sessions.cache.jobs.ofSession(second)?.refusedTurn).toBe(turn.id);

  // Dismissing the turn puts the session back to idle, with nothing to ask.
  server.sessions.dismiss(ctx.repo, turn.id);
  const idle = await readSession(ctx, second);
  expect(idle).toMatchObject({ status: "idle", statusReason: null });

  // A later turn with no human message, as an agent's wakeup, ends on another offer: the run's row
  // has its refusal, dismissed or not, so nothing starts by itself again; the card stays the way.
  server.adapter.script([{ text: `${block("change", "Another proposal")}\n`, type: "text" }]);
  const woken = await server.sessions.send(ctx.repo, second, {
    line: "The agent woke up.",
    origin: "workflow",
    text: "Go on.",
  });
  await server.sessions.settled(woken.turn);
  await accepting.settled();
  expect(folderOf(server, second)).toBeNull();
  expect(server.sessions.cache.jobs.ofSession(second)?.refusedTurn).toBe(turn.id);

  // A later turn of the session asks nothing of the refused offer.
  server.adapter.script([{ text: "Understood.", type: "text" }]);
  const sent = await server.sessions.send(ctx.repo, second, { text: "I will start it myself." });
  await server.sessions.settled(sent.turn);
  expect(await readSession(ctx, second)).toMatchObject({ changeRefusal: null });
});

/**
 * Finding 4. Catches: a scheduled time, or a run by hand, starting while the run's change is being
 * opened, as the session is not in its folder yet and its agent does not work: the acceptance in
 * flight holds the job busy, from the turn's end until the acceptance ends, whatever it decides.
 */
test.each(["starts the change", "finds the job report only"])(
  "an acceptance in flight holds its job busy until it %s",
  async (how) => {
    const { accepting, busy, ctx, server, state } = await setup();
    server.adapter.fallback = () => [];
    const root = await server.sessions.mainRoot(ctx.repo);
    const gate = Promise.withResolvers<void>();
    state.gate = gate.promise;
    server.adapter.script([{ text: OFFER, type: "text" }]);
    const started = await startRun(
      ctx,
      job(),
      { at: Date.now(), due: 1, trigger: "schedule" },
      await server.sessions.mainRoot(ctx.repo),
    );
    const session = started!.session;
    await ended(server, session);
    // The turn ended and the acceptance waits for the settings: the job is busy meanwhile.
    expect(busy.has(NAME, root)).toBe(true);
    expect(busy.has("Another", root)).toBe(false);
    expect(busy.has(NAME, "/another/repository")).toBe(false);
    if (how === "finds the job report only") {
      state.jobs = { jobs: [job({ reportOnly: true })] };
    }
    gate.resolve();
    await accepting.settled();
    expect(busy.has(NAME, root)).toBe(false);
    expect(folderOf(server, session) === null).toBe(how === "finds the job report only");
    await ended(server, session);
  },
);

/**
 * Finding 10. Catches: a session that belongs to a change reading "The change could not start by
 * itself." for good, when the human started the change from the card and no turn followed: the
 * refusal is cleared where the session moves, and the status ignores it once the session has a folder.
 */
test("a refused offer is forgotten once its session moves into a change", async () => {
  const { ctx, run, server } = await setup();
  server.adapter.fallback = () => [];
  const { cache } = server.sessions;
  await run([{ text: OFFER, type: "text" }], job(), []);

  // The human starts the change from the card, with another title: the refusal goes.
  const second = await run([{ text: OFFER, type: "text" }]);
  expect(await readSession(ctx, second)).toMatchObject({ statusReason: "change-refused" });
  await toChange(ctx, { session: second, text: "# Another proposal\n\nBody." });
  expect(cache.jobs.ofSession(second)).toMatchObject({ refusal: null, refusedTurn: null });
  const moved = await readSession(ctx, second);
  expect(moved?.changeRefusal).toBeNull();
  expect(moved?.statusReason).not.toBe("change-refused");

  // A session that moved some other way, with the refusal still stored, ignores it too.
  const third = await run([{ text: OFFER, type: "text" }]);
  expect(await readSession(ctx, third)).toMatchObject({ statusReason: "change-refused" });
  cache.attach(third, "2026-10-12-cli-tuis");
  const attached = await readSession(ctx, third);
  expect(attached?.changeRefusal).toBeNull();
  expect(attached?.statusReason).not.toBe("change-refused");
});

/** A `[[jobs]]` table of the job in the settings file, with the fields a test changes. */
function table(fields: Record<string, string>): string {
  const all: Record<string, string> = {
    agent: '"fake"',
    name: `"${NAME}"`,
    prompt: '"Check the dependencies."',
    repositories: `["${repository.name}"]`,
    schedule: '"daily 03:00"',
    ...fields,
  };
  return `[[jobs]]\n${Object.entries(all)
    .map(([key, value]) => `${key} = ${value}\n`)
    .join("")}`;
}

/**
 * Review 07, findings 2 and X4; review 08, C1 and X1. The offer is accepted for a job whose only
 * problem is its schedule ("Run now" runs it, R23, and its note promises the change starts), and
 * for no other: the core's own reading of the file, since it reports the schedule's problem last
 * and a job with a text `report_only` or no repository must not read as only a bad schedule.
 * Catches: a change started for a job the human wrote as report only, or with no repository.
 */
test.each([
  ["a schedule not understood", { schedule: '"dayly 06:00"' }, true],
  [
    "a text report_only with a schedule not understood",
    { report_only: '"true"', schedule: '"dayly 06:00"' },
    false,
  ],
  [
    "repositories emptied with a schedule not understood",
    { repositories: "[]", schedule: '"dayly 06:00"' },
    false,
  ],
  ["repositories that are not names", { repositories: "[3]", schedule: '"dayly 06:00"' }, false],
  [
    "a report-only job with a schedule not understood",
    { report_only: "true", schedule: '"dayly 06:00"' },
    false,
  ],
  [
    "no prompt, with a schedule not understood",
    { prompt: '" "', schedule: '"dayly 06:00"' },
    false,
  ],
  ["a text report_only", { report_only: '"true"' }, false],
])("a run's offer, for a job edited to have %s while it worked", async (_why, fields, accepted) => {
  const { run, server, state } = await setup();
  server.adapter.fallback = () => [];
  state.file = true;
  const path = join(server.settings.dir, "config.toml");
  const edit = () => writeFileSync(path, table(fields));
  const session = await run([edit, { text: OFFER, type: "text" }], job(), []);
  expect(folderOf(server, session) !== null).toBe(accepted);
});

/** A job with a problem that is not in the core's reading, as the card's: the card waits. */
test("a run's offer waits for a job with a problem that is not the schedule's", async () => {
  const { run, server } = await setup();
  server.adapter.fallback = () => [];
  const unlisted = await run([{ text: OFFER, type: "text" }], {
    ...job(),
    problem: "“notes” is not in Uraeda's list.",
  });
  expect(folderOf(server, unlisted)).toBeNull();
});

/**
 * Review 07, finding 6 (R19). Catches: an offer at the end of a turn that left a wakeup of the
 * agent's pending being accepted, so the change's start closed the process that held the wakeup,
 * and the continuation the agent scheduled never happened. The turn the wakeup starts is read as
 * any turn's end is: it starts the change when its last word is an offer.
 */
test("an offer at the end of a turn that left a wakeup pending starts nothing, and the next turn's does", async () => {
  const { accepting, ctx, run, server } = await setup();
  server.adapter.fallback = () => [];
  const wakeup: FakeStep = {
    at: new Date(Date.now() + 25 * 60_000).toISOString(),
    type: "wakeup",
  };
  const session = await run([{ text: OFFER, type: "text" }, wakeup]);
  expect(server.sessions.wakeup(session)).toBe(true);
  expect(folderOf(server, session)).toBeNull();
  expect(server.sessions.cache.jobs.ofSession(session)?.refusal ?? null).toBeNull();

  // The wakeup's time comes, and the turn it starts, as a message of the workflow starts one, ends on
  // the offer.
  const real = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => real + 30 * 60_000);
  onTestFinished(() => void vi.restoreAllMocks());
  server.adapter.script([{ text: OFFER, type: "text" }]);
  server.adapter.script([]);
  const woken = await server.sessions.send(ctx.repo, session, {
    line: "The agent woke up.",
    origin: "workflow",
    text: "Go on.",
  });
  await server.sessions.settled(woken.turn);
  await accepting.settled();
  await ended(server, session);
  expect(folderOf(server, session)).toMatch(/^\d{4}-\d{2}-\d{2}-/);
});

/**
 * Review 08, C2 (R42). Catches: a change started where no job runs any more: the human turned the
 * Jobs extension off for the repository, took it out of the job, or removed it from the list while
 * the run worked. Each takes their yes back: the offer waits on its card.
 */
test.each(["the Jobs extension is turned off", "the job stops naming it", "it leaves the list"])(
  "a run's offer waits when, while it works, %s",
  async (how) => {
    const on = { jobs: true };
    const { accepting, ctx, server, state } = await setup({
      isOn: (name: string) => name !== "jobs" || on.jobs,
    } as unknown as ExtensionsHost);
    server.adapter.fallback = () => [];
    const before = history(server);
    const gate = Promise.withResolvers<void>();
    state.gate = gate.promise;
    server.adapter.script([{ text: OFFER, type: "text" }]);
    const started = await startRun(
      ctx,
      job(),
      { at: Date.now(), due: 1, trigger: "schedule" },
      await server.sessions.mainRoot(ctx.repo),
    );
    const session = started!.session;
    await ended(server, session);
    if (how === "the Jobs extension is turned off") {
      on.jobs = false;
    } else if (how === "the job stops naming it") {
      state.jobs = { jobs: [job({ repositories: ["notes"] })] };
    } else {
      await binding.removeRepository(server.dataDir, server.name);
      await server.hosts.reload();
    }
    gate.resolve();
    await accepting.settled();
    expect(folderOf(server, session)).toBeNull();
    expect(server.sessions.cache.jobs.ofSession(session)?.refusal ?? null).toBeNull();
    expect(history(server)).toEqual(before);
  },
);
