// A feature's session and its turns, moved from the old agent panel's tests: the workflow's message
// queued after a chat turn (US2.5), a run that ends at a gate (US2.3), a blocked action (US5), the
// transcript's tool calls, and its long turns. The feature page's agent card is checked in
// `feature-page.test.tsx`.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  today,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

/** The workflow's message when the human asks the CLI's agent to continue. */
const MANUAL = [
  `/uraeda Continue the feature specs/${CLI}/ on branch ${CLI}: Write the plan, starting with skills/uraeda/references/plan.md.`,
  "Stop when the plan waits for my review, and earlier only if you need a decision from me.",
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

/** The feature page's agent card. */
function panel() {
  return within(screen.getByRole("region", { name: "Agent" }));
}

/** Opens the feature's page from the session's crumbs, and waits for its agent card. */
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

/** US2.5 */
test("US2.5: during a chat turn, the agent's start queues the workflow's message after it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Why plan first?" });
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  // The session opened to continue the feature, as a hand-over opens it.
  await renderPage(`/f/${CLI}/session?continue=manual`, repo, { agent: fake });

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
  // The feature page says what waits on the human; the agent rests.
  await openFeaturePage("Web UI for the workflow files");
  expect(
    within(screen.getByRole("region", { name: "Next" })).getByRole("heading", {
      name: "You answer the questions",
    }),
  ).toBeTruthy();
  expect(panel().getByText("Idle")).toBeTruthy();
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
  expect(agent.opens.at(-1)?.allowed).toEqual(["Bash(git push origin HEAD)"]);
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
