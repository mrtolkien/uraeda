import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import * as binding from "uraeda-binding";
import { expect, test, vi } from "vite-plus/test";
import {
  answered,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  record,
  refreshUntil,
  renderPage,
  today,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

today("2026-10-12");

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

type Steps = Parameters<Fake["adapter"]["script"]>[0];

/** Scripts a run of the fake agent, starts it as "Start the agent" does, and waits for its end. */
async function seedRun(fake: Fake, repo: string, folder: string, steps: Steps) {
  fake.adapter.script(steps);
  const id = await fake.runner.start(repo, folder, { trigger: "manual" });
  await fake.runner.settled(id);
  return id;
}

/** Starts a run that goes on until the test ends it, with its events sent by `agent.emit`. */
async function liveRun(fake: Fake, repo: string, folder = CLI) {
  return fake.runner.start(repo, folder, { trigger: "manual" });
}

/** Writes an ended run in the cache, as a run of an earlier server would have left it. */
async function cachedRun(
  fake: Fake,
  repo: string,
  folder: string,
  end: { state: "done" | "failed" | "stopped"; step: string; text: string },
) {
  const { mainRoot } = await binding.nextStep(repo, folder);
  const id = fake.runner.cache.startRun({
    repo: mainRoot,
    folder,
    sessionId: "3f2c0000-0000-4000-8000-000000000000",
    newSession: true,
    trigger: "manual",
    step: end.step,
    allowed: null,
    startedAt: "2026-10-12T09:00:00.000Z",
  })!;
  fake.runner.cache.appendEvent(id, { kind: "text", text: end.text });
  fake.runner.cache.endRun(id, { state: end.state });
  return id;
}

/** US2.1, C3 */
test("US2.1 and C3: an agent's text renders as markdown", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedRun(fake, repo, CLI, [{ type: "text", text: "Reading **the answers**" }]);

  await renderPage(`/f/${CLI}/runs/${id}`, repo, { agent: fake });

  const strong = await screen.findByText("the answers");
  expect(strong.tagName).toBe("STRONG");
  const log = screen.getByRole("log", { name: "Run log" });
  expect(log.contains(strong)).toBe(true);
  expect(log.textContent).toContain("Reading the answers");
});

/** US2.2 */
test("US2.2: a tool call shows its target and duration", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await liveRun(fake, repo);
  // The runner times a tool call with the clock: 2.5 seconds pass between its start and its end.
  const start = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    fake.adapter.emit({
      type: "toolStart",
      id: "toolu_1",
      name: "Bash",
      input: { command: "vp run ready" },
    });
    await waitFor(() => expect(fake.runner.cache.eventCount(id)).toBe(1));
  } finally {
    clock.mockRestore();
  }

  await renderPage(`/f/${CLI}/runs/${id}`, repo, { agent: fake });

  const target = await screen.findByText("vp run ready");
  const log = screen.getByRole("log", { name: "Run log" });
  expect(log.contains(target)).toBe(true);
  expect(log.textContent).toContain("Bash");
  expect(log.textContent).toContain("Running");
  expect(screen.queryByText("2.5 s")).toBeNull();

  const end = vi.spyOn(Date, "now").mockReturnValue(start + 2500);
  try {
    fake.adapter.emit({ type: "toolEnd", id: "toolu_1", isError: false, output: "ok" });
    await waitFor(() =>
      expect(fake.runner.cache.events(id, 0, 1)[0]).toMatchObject({ status: "complete" }),
    );
  } finally {
    end.mockRestore();
  }

  await refreshUntil(() => expect(screen.getByText("2.5 s")).toBeTruthy());
  expect(screen.getByText("vp run ready")).toBeTruthy();
});

/** US2.3 */
test("US2.3: Stop stops the run", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  expect(await screen.findByText("Working on Plan")).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(agent.interrupts).toBe(1));
  await refreshUntil(() => expect(screen.getByText("Stopped")).toBeTruthy());
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

/** US2.5 */
test("US2.5: the panel shows the session's cost", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { type: "result", ok: true, costUsd: 3.1, errors: [], denials: [] },
  ]);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  expect(await screen.findByText(/\$3\.10 this session/)).toBeTruthy();
});

/** US2.6 */
test("US2.6: earlier runs are listed", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [{ type: "text", text: "The first run" }]);
  await seedRun(fake, repo, CLI, [{ type: "text", text: "The second run" }]);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  // US8: one row per run, newest first, each leading to its log.
  const runs = within(await screen.findByRole("list", { name: "Runs" }));
  const rows = runs.getAllByRole("link");
  expect(rows).toHaveLength(2);
  expect(rows[0].getAttribute("href")).toMatch(new RegExp(`^/f/${CLI}/runs/\\d+$`));
  expect(screen.queryByText("The second run")).toBeNull();
});

/** US2.7 */
test("US2.7: Home shows a working agent", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // A feature started from its draft, whose worktree passes the core's checks.
  const { folder } = await binding.startFeature(
    repo,
    "specs/drafts/git-listener.md",
    "git-listener",
  );
  await liveRun(fake, repo, folder);

  await renderPage("/", repo, { agent: fake });

  const main = within(await screen.findByRole("main"));
  // The row is the list item whose link leads to the feature.
  await main.findByRole("link", { name: /Git listener process/ });
  const row = main
    .getAllByRole("listitem")
    .find((item) => within(item).queryByRole("link", { name: /Git listener process/ }))!;
  expect(within(row).getByText("Working")).toBeTruthy();
  expect(within(row).getByText("Discovery")).toBeTruthy();
});

/** US4.1 */
test("US4.1: Start the agent starts a run", async () => {
  const { agent } = await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  await tap(await screen.findByRole("button", { name: "Start the agent" }));

  await waitFor(() => expect(agent.starts).toHaveLength(1));
  expect(agent.starts[0].message).toContain("The human asked you to continue.");
  expect(await screen.findByText("Working on Plan")).toBeTruthy();
});

/** US4.2 */
test("US4.2: Try again after a failure", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { type: "result", ok: false, errors: ["Rate limit reached"], denials: [] },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  expect(await screen.findByText("Failed on Plan")).toBeTruthy();
  expect(screen.getByText("Rate limit reached")).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Try again" }));

  await waitFor(() => expect(agent.starts).toHaveLength(2));
  expect(agent.starts[1]).toMatchObject({ resume: true, sessionId: agent.starts[0].sessionId });
});

/** US4.3 */
test("US4.3: a feature waiting on you has no Start the agent", async () => {
  await renderPage(`/f/${WEB_UI}`, fixtureRepo(), { agent: true });

  expect(await screen.findByText("Answer questions")).toBeTruthy();
  await answered("Runner");
  expect(screen.queryByRole("region", { name: "Agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});

test("without claude, a feature waiting on an agent has no panel", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo());

  expect(await screen.findByText("CLI TUIs", { selector: "h1" })).toBeTruthy();
  await answered("Runner");
  expect(screen.queryByRole("region", { name: "Agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});

/** US6.1, US6.2 */
test("US6.1 and US6.2: a blocked action can be allowed", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    {
      type: "result",
      ok: true,
      errors: [],
      denials: [{ tool: "Bash", input: { command: "gh pr create --draft" } }],
    },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  expect(await screen.findByText("Blocked by auto mode")).toBeTruthy();
  expect(screen.getByText("Bash: gh pr create --draft")).toBeTruthy();
  expect(screen.getByText(allows("Bash(gh pr create --draft)"))).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Allow and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(2));
  expect(agent.starts[1].allowed).toBe("Bash(gh pr create --draft)");
  expect(agent.starts[1].message).toContain(
    "The human allowed `Bash(gh pr create --draft)`: run it again, then continue.",
  );
});

/** The sentence that names the rule "Allow and continue" passes. */
const allows = (rule: string) => (_: string, element: Element | null) =>
  element?.textContent === `Allows ${rule} for one run.` &&
  ![...element.children].some((child) => child.textContent === element.textContent);

/** US6.3 */
test("US6.3: a blocked write outside the project shows its absolute rule", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    {
      type: "result",
      ok: true,
      errors: [],
      denials: [{ tool: "Write", input: { file_path: "/home/me/.ssh/config" } }],
    },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  expect(await screen.findByText("Write: /home/me/.ssh/config")).toBeTruthy();
  expect(screen.getByText(allows("Edit(//home/me/.ssh/config)"))).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Allow and continue" }));

  await waitFor(() => expect(agent.starts).toHaveLength(2));
  expect(agent.starts[1].allowed).toBe("Edit(//home/me/.ssh/config)");
});

test("a blocked action without a target shows that its rule allows every call", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { type: "result", ok: true, errors: [], denials: [{ tool: "mcp__x__y", input: {} }] },
  ]);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  expect(await screen.findByText(allows("mcp__x__y"))).toBeTruthy();
});

/** Review focus 3 */
test("review focus 3: 250 events show in order", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedRun(
    fake,
    repo,
    CLI,
    Array.from({ length: 250 }, (_, index) => ({ type: "text", text: `Event ${index + 1}.` })),
  );

  await renderPage(`/f/${CLI}/runs/${id}`, repo, { agent: fake });

  await screen.findByText("Event 250.");
  const texts = screen.getAllByText(/^Event \d+\.$/).map((element) => element.textContent);
  expect(texts).toEqual(Array.from({ length: 250 }, (_, index) => `Event ${index + 1}.`));
});

test("a run done at a gate says so", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await cachedRun(fake, repo, WEB_UI, { state: "done", step: "discovery", text: "Asked." });

  await renderPage(`/f/${WEB_UI}`, repo, { agent: fake });

  expect(await screen.findByText("Done: waiting for you")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
});

test("a merged feature shows its runs and no button", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "--create", "2026-10-09-dark-mode", "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, "specs/done/2026-10-09-dark-mode.md"), record("Dark mode"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", "2026-10-09-dark-mode");
  const fake = await fakeAgent();
  const folder = "2026-10-09-dark-mode";
  await cachedRun(fake, repo, folder, { state: "done", step: "plan", text: "Planned." });
  await cachedRun(fake, repo, folder, { state: "done", step: "finish", text: "Finished." });

  await renderPage(`/f/${folder}`, repo, { agent: fake });

  const runs = within(await screen.findByRole("list", { name: "Runs" }));
  expect(await runs.findAllByRole("link")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Start the agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
});
