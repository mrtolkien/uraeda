// The feature page's agent: its session's status, its latest turn, Stop, "Open the session", and
// "Review and start the agent" or "Review and try again", which open the session with the workflow's
// message (US2). The transcript's tool calls, its long turns, and a blocked action (US5) are checked on the session.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { startFeature } from "uraeda-binding";
import {
  atRepo,
  answered,
  atWidth,
  click,
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

/** The workflow's message when the human asks the CLI's agent to continue. */
const MANUAL = [
  `/uraeda:uraeda Continue the feature specs/${CLI}/, on branch ${CLI}.`,
  "The human asked you to continue.",
  "Its next step is plan: follow skills/uraeda/references/plan.md.",
].join("\n");

today("2026-10-12");

type Steps = Parameters<Fake["adapter"]["script"]>[0];

/** Sends the workflow's message to a feature's session, as the composer's "Start the agent" does. */
async function startTurn(fake: Fake, repo: string, folder: string) {
  const session = await fake.sessions.featureSession(repo, folder);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  return turn;
}

/** Scripts a turn of the fake agent, starts it as the composer does, and waits for its end. */
async function seedRun(fake: Fake, repo: string, folder: string, steps: Steps) {
  fake.adapter.script(steps);
  const id = await startTurn(fake, repo, folder);
  await fake.sessions.settled(id);
  return id;
}

/** Starts a turn that goes on until the test ends it, with its events sent by `agent.emit`. */
async function liveRun(fake: Fake, repo: string, folder = CLI) {
  const id = await startTurn(fake, repo, folder);
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  return id;
}

/** Writes an ended workflow turn in the cache, a tool call then the agent's closing text. */
async function cachedRun(
  fake: Fake,
  repo: string,
  folder: string,
  end: { state: "done" | "failed" | "stopped"; step: string; text: string },
) {
  const session = await fake.sessions.featureSession(repo, folder);
  const { cache } = fake.sessions;
  const id = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: end.step,
    trigger: "manual",
  });
  cache.appendItem(id, {
    id: "toolu_1",
    kind: "tool",
    name: "Bash",
    status: "completed",
    target: "git commit",
    toolKind: "execute",
  });
  cache.appendItem(id, { kind: "text", streaming: false, text: end.text });
  cache.endTurn(id, { state: end.state });
  return id;
}

/** The feature page's agent panel. */
function panel() {
  return within(screen.getByRole("region", { name: "Agent" }));
}

/** Opens the feature's page from the session's crumbs, and waits for its agent panel. */
async function openFeaturePage(title: string) {
  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
  await click(crumbs.getByRole("link", { name: title }));
  await screen.findByRole("region", { name: "Agent" });
}

/** The session's transcript, once drawn. */
async function log() {
  return within(await screen.findByRole("log", { name: "Conversation" }));
}

/** The status a side navigation row shows, by its slug. */
function sidebarStatus(slug: string) {
  const nav = within(screen.getByRole("navigation", { name: "Side navigation" }));
  const link = nav.getByRole("link", { name: new RegExp(`^${slug}, `) });
  return within(link).getByRole("img").getAttribute("aria-label");
}

/** Waits for the feature's session to open with the workflow's message in its composer. */
async function opensWith(folder: string, text: string) {
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${folder}/session`)));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() => expect(box.textContent).toBe(text));
}

/** US1, US2 */
test("the feature page shows the session's status and Open the session", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [{ text: "Planned.", type: "text" }]);

  await renderPage(`/f/${CLI}`, repo, { agent: fake });

  await waitFor(() => expect(panel().getByText("New reply")).toBeTruthy());
  expect(panel().getByRole("img", { name: "New reply" })).toBeTruthy();
  expect(panel().getByText(/Run: Plan/)).toBeTruthy();
  expect(panel().getByRole("link", { name: "Open the session" }).getAttribute("href")).toBe(
    atRepo(`/f/${CLI}/session`),
  );
  expect(screen.queryByRole("list", { name: "Runs" })).toBeNull();
});

test("a feature waiting on you, with no session yet, opens its session to chat", async () => {
  await renderPage(`/f/${WEB_UI}`, fixtureRepo(), { agent: true });

  expect(await screen.findByRole("link", { name: "Open the session" })).toBeTruthy();
});

test("Stop stops the turn, and Review and try again opens the session with the message", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(panel().getByText("Working")).toBeTruthy());
  // The agent runs the step: starting it again would run it twice.
  expect(panel().queryByRole("button", { name: "Review and start the agent" })).toBeNull();

  await click(panel().getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(agent.interrupts).toBe(1));
  await refreshUntil(() => expect(panel().getByText(/Run: Plan · Stopped/)).toBeTruthy());
  await click(panel().getByRole("button", { name: "Review and try again" }));

  await opensWith(CLI, MANUAL);
  expect(agent.sent).toHaveLength(1);
});

test("a Stop that fails says why in the panel", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await liveRun(fake, repo);
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(panel().getByText("Working")).toBeTruthy());
  vi.spyOn(fake.sessions, "stop").mockImplementation(() => {
    throw new Error("refused: The agent did not take the interrupt.");
  });

  await click(panel().getByRole("button", { name: "Stop" }));

  expect(await panel().findByText("The agent did not take the interrupt.")).toBeTruthy();
});

/** US2.7 */
test("Home shows a working agent", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  // A feature started from its draft, whose worktree passes the core's checks.
  const { folder } = await startFeature(repo, "specs/drafts/git-listener.md", "git-listener");
  await startTurn(fake, repo, folder);

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

/** US2 */
test("Review and start the agent opens the session with the message, unsent", async () => {
  const { agent } = await renderPage(`/f/${CLI}`, fixtureRepo(), { agent: true });

  await click(await screen.findByRole("button", { name: "Review and start the agent" }));

  await opensWith(CLI, MANUAL);
  expect(window.location.search).toBe("?continue=manual");
  expect(agent.sent).toHaveLength(0);
});

/** US2.5 */
test("US2.5: during a chat turn, the agent's start queues the workflow's message after it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Why plan first?" });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(panel().getByText("Working")).toBeTruthy());

  await click(panel().getByRole("button", { name: "Review and start the agent" }));
  await opensWith(CLI, MANUAL);
  await click(await screen.findByRole("button", { name: "Start once this turn ends" }));

  // Queued below the chat turn, unsent while it works.
  await refreshUntil(() =>
    expect(
      within(screen.getByRole("log", { name: "Conversation" })).getByText("Run: Plan"),
    ).toBeTruthy(),
  );
  expect(fake.adapter.sent).toHaveLength(1);
  // It starts once that turn ends.
  fake.adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(2));
  expect(fake.adapter.sent[1].text).toBe(MANUAL);
});

test("Review and try again after a failure opens the session with the message", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    { denials: [], errors: ["Rate limit reached"], interrupted: false, ok: false, type: "result" },
  ]);
  const { agent } = await renderPage(`/f/${CLI}`, repo, { agent: fake });
  await waitFor(() => expect(panel().getByText("Failed")).toBeTruthy());

  await click(panel().getByRole("button", { name: "Review and try again" }));

  await opensWith(CLI, MANUAL);
  expect(agent.sent).toHaveLength(1);
});

test("a feature waiting on you has no Review and start the agent", async () => {
  await renderPage(`/f/${WEB_UI}`, fixtureRepo(), { agent: true });

  expect(await screen.findByText("Answer questions")).toBeTruthy();
  // The agent section is drawn, with its way into the session: it offers no start.
  const section = await screen.findByRole("region", { name: "Agent" });
  expect(within(section).getByRole("link", { name: "Open the session" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
});

test("without claude, a feature waiting on an agent has no panel", async () => {
  await renderPage(`/f/${CLI}`, fixtureRepo());

  expect(await screen.findByText("CLI TUIs", { selector: "h1" })).toBeTruthy();
  await answered("Agent");
  expect(screen.queryByRole("region", { name: "Agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
});

/** US2.3 */
test("US2.3: a run ending at a gate shows its closing text last, and Needs you", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await cachedRun(fake, repo, WEB_UI, {
    state: "done",
    step: "discovery",
    text: "Asked you three questions in clarifications-01.md.",
  });

  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake });

  const closing = await (
    await log()
  ).findByText("Asked you three questions in clarifications-01.md.");
  const text = screen.getByRole("log", { name: "Conversation" }).textContent ?? "";
  expect(text.trimEnd().endsWith(closing.textContent ?? "")).toBe(true);
  expect(sidebarStatus("web-ui")).toBe("Needs you");
  await openFeaturePage("Web UI for the workflow files");
  expect(panel().getByText("Needs you")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
});

/** US5.1, US5.2 */
test("US5.1: a blocked action shows Allow and retry, and Needs you", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    {
      denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  const { agent } = await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(
    await (await log()).findByText("Blocked by auto mode: Bash git push origin HEAD"),
  ).toBeTruthy();
  expect(sidebarStatus("cli-tuis")).toBe("Needs you");
  await openFeaturePage("CLI TUIs");
  expect(panel().getByText("Needs you")).toBeTruthy();
  await act(async () => window.history.back());

  await click((await log()).getByRole("button", { name: "Allow and retry" }));

  await waitFor(() => expect(agent.sent).toHaveLength(2));
  expect(agent.opens.at(-1)?.allowed).toBe("Bash(git push origin HEAD)");
  expect(agent.sent[1].text).toBe(
    "Try the blocked action again, now allowed: Bash git push origin HEAD",
  );
});

test("Allow and retry is disabled while a turn works, since it reopens the process", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    {
      denials: [{ input: { command: "git push origin HEAD" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Why was it blocked?" });
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const allow = await (await log()).findByRole("button", { name: "Allow and retry" });

  expect(allow.hasAttribute("disabled")).toBe(true);
});

test("a blocked action no allow rule can match alone offers no Allow and retry, and says why", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(fake, repo, CLI, [
    {
      denials: [{ input: { command: "rm build/*" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(await (await log()).findByText("Blocked by auto mode: Bash rm build/*")).toBeTruthy();
  expect((await log()).getByText("No allow rule can match only this action.")).toBeTruthy();
  expect((await log()).queryByRole("button", { name: "Allow and retry" })).toBeNull();
});

test("a tool call shows its target, then its duration", async () => {
  // The session's page alone, with its own transcript.
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await liveRun(fake, repo);
  // The session times a tool call with the clock: 2.5 seconds pass between its start and its end.
  const start = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    fake.adapter.emit({
      id: "toolu_1",
      input: { command: "vp run ready" },
      kind: "execute",
      name: "Bash",
      target: "vp run ready",
      type: "toolStart",
    });
    await waitFor(() => expect(fake.sessions.cache.itemCount(id)).toBe(2));
  } finally {
    clock.mockRestore();
  }

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(await (await log()).findByText("vp run ready")).toBeTruthy();
  expect((await log()).queryByText("2.5 s")).toBeNull();

  const end = vi.spyOn(Date, "now").mockReturnValue(start + 2500);
  try {
    fake.adapter.emit({ id: "toolu_1", isError: false, output: "ok", type: "toolEnd" });
    await waitFor(() =>
      expect(fake.sessions.cache.items(id, 1, 1)[0]).toMatchObject({ status: "completed" }),
    );
  } finally {
    end.mockRestore();
  }

  await refreshUntil(() =>
    expect(
      within(screen.getByRole("log", { name: "Conversation" })).getByText("2.5 s"),
    ).toBeTruthy(),
  );
});

/** Review focus 3: a turn's items come in pages of 100. */
test("250 items of a turn show in order", async () => {
  atWidth(402);
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedRun(
    fake,
    repo,
    CLI,
    Array.from({ length: 250 }, (_, index) => ({
      text: `Event ${index + 1}.`,
      type: "text" as const,
    })),
  );

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  await (await log()).findByText("Event 250.");
  const texts = (await log()).getAllByText(/^Event \d+\.$/).map((element) => element.textContent);
  expect(texts).toEqual(Array.from({ length: 250 }, (_, index) => `Event ${index + 1}.`));
});

test("a merged feature shows its session, and no button that starts the agent", async () => {
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
  await cachedRun(fake, repo, folder, { state: "done", step: "finish", text: "Finished." });

  await renderPage(`/f/${folder}`, repo, { agent: fake });

  expect(await screen.findByRole("link", { name: "Open the session" })).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Runs" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Review and start the agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Review and try again" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
});

test("a merged feature without a session has no panel", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "--create", "2026-10-09-dark-mode", "main");
  mkdirSync(join(repo, "specs/done"), { recursive: true });
  writeFileSync(join(repo, "specs/done/2026-10-09-dark-mode.md"), record("Dark mode"));
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "finish(dark-mode): dark mode");
  git(repo, "switch", "--quiet", "main");
  git(repo, "merge", "--quiet", "--no-ff", "--no-edit", "2026-10-09-dark-mode");

  await renderPage("/f/2026-10-09-dark-mode", repo, { agent: true });

  expect(await screen.findByText("Merged into the default branch")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Agent" })).toBeNull();
});
