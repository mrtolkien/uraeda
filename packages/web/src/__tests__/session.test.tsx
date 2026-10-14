// US1: a feature's session, its transcript and its composer, at both widths. The log following its
// end and Back's position are in the browser tests.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import {
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";
import { elapsed } from "../Transcript.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

today("2026-10-12");

const OPENING =
  "A human is chatting with you about the feature specs/2026-10-11-web-ui/, on branch 2026-10-11-web-ui: answer, and change files, commit, or move the workflow only when they ask.";

/** The composer's text field, once the page is drawn. */
function composer() {
  return screen.findByRole("textbox", { name: "Message Claude Code" });
}

/** The transcript as drawn now: the page draws a new one once its session is created. */
function log() {
  return within(screen.getByRole("log", { name: "Conversation" }));
}

/** Types a message and presses Send. */
async function send(text: string) {
  await type(await composer(), text);
  // During a turn, Send shows beside Stop once the session's state is read: it waits for it.
  await click(await screen.findByRole("button", { name: "Send" }));
}

/** Sends a message to a feature's session that the agent reads, and leaves its turn going. */
async function openTurn(fake: Fake, text = "Why did you recommend A in Q6?") {
  await send(text);
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ type: "accepted", id: fake.adapter.sent[0].id });
}

test("US1.1: a message shows under its opening line, and the reply below it", async () => {
  const fake = await fakeAgent();
  fake.adapter.script([{ type: "text", text: "Because A keeps **one** process." }]);
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });

  await send("Why did you recommend A in Q6?");

  await refreshUntil(() => expect(log().getByText("one").tagName).toBe("STRONG"));
  expect(log().getByText("Why did you recommend A in Q6?")).toBeTruthy();
  expect(log().getByText(OPENING)).toBeTruthy();
  expect(fake.adapter.sent[0].text).toBe(`${OPENING}\nWhy did you recommend A in Q6?`);
  // The feature still waits on you: nothing moved its step.
  expect(screen.getAllByText("Needs you").length).toBeGreaterThan(0);
});

test("a session shown at a gate is recorded as seen once its turn ends, though it needs you", async () => {
  const fake = await fakeAgent();
  fake.adapter.script([{ type: "text", text: "Because A keeps one process." }]);
  const repo = fixtureRepo();
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake });

  await send("Why did you recommend A in Q6?");

  // The feature waits on you: "Needs you" outranks a new reply, which the view shows all the same.
  await refreshUntil(() => expect(log().getByText("Because A keeps one process.")).toBeTruthy());
  const { cache } = fake.sessions;
  const session = cache.featureSession(await fake.sessions.mainRoot(repo), WEB_UI)!;
  await waitFor(() => {
    const [turn] = cache.turns(session.id);
    const { seenAt } = cache.session(session.id)!;
    expect(turn.endedAt).not.toBeNull();
    expect(seenAt !== null && seenAt >= turn.endedAt!).toBe(true);
  });
});

test("US1.3: a message sent during a turn shows greyed, with Take back", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake);

  await send("Use the existing helper");

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(2));
  expect(fake.adapter.sent[1].when).toBe("steer");
  await refreshUntil(() => expect(log().getByText("Use the existing helper")).toBeTruthy());
  expect(log().getByText("Not read yet")).toBeTruthy();
  expect(log().getAllByRole("button", { name: "Take back" })).toHaveLength(1);
});

test("US1.3: without the agent's take-back, a message not read has no Take back", async () => {
  const fake = await fakeAgent();
  fake.adapter.capabilities = { ...fake.adapter.capabilities, takeBack: false };
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake);

  await send("Use the existing helper");

  await refreshUntil(() => expect(log().getByText("Not read yet")).toBeTruthy());
  expect(log().queryByRole("button", { name: "Take back" })).toBeNull();
});

test("US1.4: Take back removes the message and puts its text back in the composer", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake);
  await send("Use the existing helper");
  await refreshUntil(() => expect(log().getByText("Not read yet")).toBeTruthy());

  await click(log().getByRole("button", { name: "Take back" }));

  await waitFor(() => expect(fake.adapter.takenBack).toEqual([fake.adapter.sent[1].id]));
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe("Use the existing helper"));
  fake.adapter.emit({ type: "cancelled", id: fake.adapter.sent[1].id });
  await refreshUntil(() => expect(log().queryByText("Use the existing helper")).toBeNull());
});

test("US1.5: Send turns into Stop during a turn, and Stop ends it as Stopped", async () => {
  // The session's page alone: on a wide screen, the feature's page beside it has its own Stop.
  atWidth(402);
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake, "Look at the plan.");

  await refreshUntil(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Send" })).toBeNull();

  await click(screen.getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(fake.adapter.interrupts).toBe(1));
  await refreshUntil(() => expect(screen.getAllByText("Stopped").length).toBeGreaterThan(0));
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
});

test("a Stop that fails says why under the composer", async () => {
  atWidth(402);
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake, "Look at the plan.");
  await refreshUntil(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());
  vi.spyOn(fake.sessions, "stop").mockImplementation(() => {
    throw new Error("refused: The agent did not take the interrupt.");
  });

  await click(screen.getByRole("button", { name: "Stop" }));

  expect(await screen.findByText("The agent did not take the interrupt.")).toBeTruthy();
});

test("US4.4: without the agent, the composer is disabled and says why", async () => {
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), {
    agent: await fakeAgent({ installed: false }),
  });

  const box = await composer();
  expect(box.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText("Claude Code is not available on this machine.")).toBeTruthy();
});

test("a feature with no branch yet: the composer is disabled and says why", async () => {
  const repo = fixtureRepo();
  // A proposal not committed yet: the feature has no branch.
  const folder = "2026-10-20-draft";
  mkdirSync(join(repo, "specs", folder));
  writeFileSync(join(repo, "specs", folder, "proposal.md"), "# Draft\n\n## What\n\nA draft.\n");
  const fake = await fakeAgent();

  await renderPage(`/f/${folder}/session`, repo, { agent: fake });

  expect(
    await screen.findByText("This feature has no branch yet: commit its proposal first."),
  ).toBeTruthy();
  expect((await composer()).getAttribute("aria-disabled")).toBe("true");
});

test("a blank message cannot be sent", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });

  await type(await composer(), " ");

  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
});

test("a refused send keeps the text and shows the reason under the composer", async () => {
  const fake = await fakeAgent();
  const { sessions } = await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await composer();
  // The agent leaves the machine after the page read it.
  fake.adapter.installed = false;
  await sessions.check();

  await send("Why did you recommend A in Q6?");

  expect(await screen.findByText("Claude Code is not available on this machine.")).toBeTruthy();
  expect((await composer()).textContent).toBe("Why did you recommend A in Q6?");
  expect(fake.adapter.sent).toHaveLength(0);
});

test("an old run's address opens the session at that turn", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  fake.adapter.script([{ type: "text", text: "Planned the tasks." }]);
  const { turn } = await fake.sessions.send(repo, session.id, { text: "Plan it." });
  await fake.sessions.settled(turn);

  await renderPage(`/f/${CLI}/runs/${turn}`, repo, { agent: fake });

  await waitFor(() => expect(window.location.pathname).toBe(`/f/${CLI}/session`));
  expect(window.location.hash).toBe(`#turn-${turn}`);
  expect(
    await within(await screen.findByRole("log", { name: "Conversation" })).findByText(
      "Planned the tasks.",
    ),
  ).toBeTruthy();
});

test("a workflow turn opens with the step it ran", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  fake.adapter.script([{ type: "text", text: "Planned the tasks." }]);
  const { turn } = await fake.sessions.send(repo, session.id, {
    text: "Continue.",
    workflow: { trigger: "manual" },
  });
  await fake.sessions.settled(turn);

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  expect(
    await within(await screen.findByRole("log", { name: "Conversation" })).findByText("Run: Plan"),
  ).toBeTruthy();
});

test("on the phone, the session is a page of its own, with crumbs", async () => {
  atWidth(402);
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  await screen.findByRole("log", { name: "Conversation" });
  const crumbs = within(screen.getByRole("navigation", { name: "Breadcrumbs" }));
  expect(crumbs.getByRole("link", { name: "Web UI for the workflow files" })).toBeTruthy();
  expect(crumbs.getByText("Session")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Files" })).toBeNull();
});

test("on a wide screen, the session is beside the feature page", async () => {
  atWidth(1024);
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  await screen.findByRole("log", { name: "Conversation" });
  expect(await screen.findByRole("list", { name: "Files" })).toBeTruthy();
  // The feature page's crumbs only: the session is in a pane beside it.
  expect(screen.queryByText("Session")).toBeNull();
});

test("the status region says when a reply starts and ends", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake, "Look at the plan.");

  await refreshUntil(() =>
    expect(screen.getByText("Claude Code is replying").closest("[role=status]")).toBeTruthy(),
  );
  fake.adapter.emit({ type: "text", text: "Looked." });
  fake.adapter.emit({ type: "result", ok: true, errors: [], denials: [], interrupted: false });

  await refreshUntil(() =>
    expect(screen.getByText("Reply complete").closest("[role=status]")).toBeTruthy(),
  );
});

test("a running turn ends with what the agent does now, gone once it ends", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake, "Write the spec.");

  await refreshUntil(() => expect(log().getByText("Working…")).toBeTruthy());
  fake.adapter.emit({ type: "activity", activity: { kind: "thinking" } });
  await refreshUntil(() => expect(log().getByText("Thinking…")).toBeTruthy());
  fake.adapter.emit({
    type: "activity",
    activity: { kind: "tool", name: "Write", target: "specs/2026-10-12-cli-tuis/spec.md" },
  });
  await refreshUntil(() =>
    expect(log().getByText("Writing specs/2026-10-12-cli-tuis/spec.md…")).toBeTruthy(),
  );
  // The dot names the activity, without the time that changes every second.
  expect(
    log().getByRole("img", { name: "Writing specs/2026-10-12-cli-tuis/spec.md" }),
  ).toBeTruthy();

  fake.adapter.emit({ type: "text", text: "Written." });
  fake.adapter.emit({ type: "result", ok: true, errors: [], denials: [], interrupted: false });
  await refreshUntil(() => expect(log().getByText("Written.")).toBeTruthy());
  await refreshUntil(() => expect(log().queryByText(/…$/)).toBeNull());
});

test("an activity's time reads in seconds, then minutes", () => {
  expect(elapsed(9_400)).toBe("9 s");
  expect(elapsed(65_000)).toBe("1 min 5 s");
  expect(elapsed(120_000)).toBe("2 min");
  expect(elapsed(754_000)).toBe("12 min");
});
