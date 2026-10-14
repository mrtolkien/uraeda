// US1: a feature's session, its transcript and its composer, at both widths. The log following its
// end and Back's position are in the browser tests.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  answered,
  atRepo,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixture,
  fixtureRepo,
  refreshUntil,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";
import { elapsed, sentAt } from "../Transcript.tsx";

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
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
}

test("US1.1: a message shows under its opening line, and the reply below it", async () => {
  const fake = await fakeAgent();
  fake.adapter.script([{ text: "Because A keeps **one** process.", type: "text" }]);
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
  fake.adapter.script([{ text: "Because A keeps one process.", type: "text" }]);
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

test("a message shows when it was sent", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake);

  await send("Use the existing helper");

  await refreshUntil(() => expect(log().getByText("Use the existing helper")).toBeTruthy());
  const times = document.querySelectorAll("[role=log] time");
  expect(times.length).toBeGreaterThan(0);
  const at = [...times].at(-1)!;
  expect(at.textContent).toBe(sentAt(at.getAttribute("dateTime")!));
});

test("a message's time has its date unless it was sent today", () => {
  const now = new Date(2026, 9, 14, 18, 0);
  const today = new Date(2026, 9, 14, 9, 5);
  const before = new Date(2026, 9, 12, 9, 5);
  const time = today.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  expect(sentAt(today.toISOString(), now)).toBe(time);
  expect(sentAt(before.toISOString(), now)).toMatch(/12/);
  expect(sentAt(before.toISOString(), now)).toContain(time);
  expect(sentAt(new Date(2025, 9, 12).toISOString(), now)).toContain("2025");
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

test("the composer typed in stays as the first message creates the session", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  const box = await composer();
  await openTurn(fake);
  await refreshUntil(() => expect(log().getByText("Why did you recommend A in Q6?")).toBeTruthy());

  // The field typed in is the one the session shows: text typed as the session lands is kept.
  expect(await composer()).toBe(box);
  await type(box, "Use the existing helper");
  await click(await screen.findByRole("button", { name: "Send" }));
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(2));
  expect(fake.adapter.sent[1].text).toBe("Use the existing helper");
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
  fake.adapter.emit({ id: fake.adapter.sent[1].id, type: "cancelled" });
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
  fake.adapter.script([{ text: "Planned the tasks.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, session.id, { text: "Plan it." });
  await fake.sessions.settled(turn);

  await renderPage(`/f/${CLI}/runs/${turn}`, repo, { agent: fake });

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${CLI}/session`)));
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
  fake.adapter.script([{ text: "Planned the tasks.", type: "text" }]);
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
  fake.adapter.emit({ text: "Looked.", type: "text" });
  fake.adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });

  await refreshUntil(() =>
    expect(screen.getByText("Reply complete").closest("[role=status]")).toBeTruthy(),
  );
});

test("a running turn ends with what the agent does now, gone once it ends", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake, "Write the spec.");

  await refreshUntil(() => expect(log().getByText("Working…")).toBeTruthy());
  fake.adapter.emit({ activity: { kind: "thinking" }, type: "activity" });
  await refreshUntil(() => expect(log().getByText("Thinking…")).toBeTruthy());
  fake.adapter.emit({
    activity: { kind: "tool", name: "Write", target: "specs/2026-10-12-cli-tuis/spec.md" },
    type: "activity",
  });
  await refreshUntil(() =>
    expect(log().getByText("Writing specs/2026-10-12-cli-tuis/spec.md…")).toBeTruthy(),
  );
  // The dot names the activity, without the time that changes every second.
  expect(
    log().getByRole("img", { name: "Writing specs/2026-10-12-cli-tuis/spec.md" }),
  ).toBeTruthy();

  fake.adapter.emit({ text: "Written.", type: "text" });
  fake.adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  await refreshUntil(() => expect(log().getByText("Written.")).toBeTruthy());
  await refreshUntil(() => expect(log().queryByText(/…$/)).toBeNull());
});

test("an activity's time reads in seconds, then minutes", () => {
  expect(elapsed(9400)).toBe("9 s");
  expect(elapsed(65_000)).toBe("1 min 5 s");
  expect(elapsed(120_000)).toBe("2 min");
  expect(elapsed(754_000)).toBe("12 min");
});

// US2: images in a chat, through the composer's picker, paste, and the page's drop.

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

/** A PNG of the fixtures, as the picker or the clipboard gives it. */
const png = (name = "login.png") =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Picks files with "Add images", as the system's picker gives them. */
async function pick(files: Array<File>) {
  const input = await screen.findByLabelText("Add images", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** Pastes files into the composer, as from the clipboard. */
async function pasteImages(files: Array<File>) {
  const box = await composer();
  await act(async () => {
    fireEvent.paste(box, {
      clipboardData: { files, getData: () => "", types: ["Files"] },
    });
  });
}

/** Drops files anywhere on the page. */
async function dropImages(files: Array<File>) {
  await act(async () => {
    fireEvent.drop(document.body, { dataTransfer: { files, types: ["Files"] } });
  });
}

/** Astryx's spinner, named "Loading", over a thumbnail being saved. */
const SPINNER = '[role="status"][aria-label]';

/** The thumbnails' remove buttons, once every image is saved. */
async function thumbnails(count: number) {
  await waitFor(() => {
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(count);
    expect(screen.queryByText(/^Adding /, { ignore: "[data-astryx-live-region] *" })).toBeNull();
    // No thumbnail's spinner: each image is saved.
    for (const remove of screen.getAllByRole("button", { name: /^Remove / })) {
      expect(remove.closest('[role="group"]')?.querySelector(SPINNER)).toBeNull();
    }
  });
  return screen.getAllByRole("button", { name: /^Remove / });
}

/**
 * The server in process, with the chat images its uploads saved: the test reads and deletes them
 * through it.
 */
function recording(repo: string, fake: Fake) {
  const server = serverFetch(repo, fake.sessions);
  const saved: Array<string> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await server(input, init);
    if (urlOf(input).includes("/attach?") && response.ok) {
      saved.push(((await response.clone().json()) as { id: string }).id);
    }
    return response;
  };
  return { fetch, saved, server };
}

test("US2.1: two pasted images show as removable thumbnails", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });

  await pasteImages([png("one.png"), png("two.png")]);

  await thumbnails(2);
  expect(screen.getByRole("button", { name: "Add images" })).toBeTruthy();
  expect(fake.adapter.sent).toHaveLength(0);
});

test("US2.2: a message with images shows them above its text", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png("one.png"), png("two.png")]);
  await thumbnails(2);

  await send("What is wrong here?");

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].images).toHaveLength(2);
  expect(fake.adapter.sent[0].images[0].path).toMatch(/\/images\/[0-9a-f-]+\.webp$/);
  await refreshUntil(() => expect(log().getByText("What is wrong here?")).toBeTruthy());
  // Told apart by their place: one image alone is "Image".
  const images = log().getAllByRole("link", { name: /^Image \d of 2$/ });
  expect(images.map((image) => image.getAttribute("aria-label"))).toEqual([
    "Image 1 of 2",
    "Image 2 of 2",
  ]);
  // Above the text, in the same bubble.
  const text = log().getByText("What is wrong here?");
  expect(images[1].compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // The composer is empty again.
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("US2.3: a removed thumbnail is not sent, and its image is deleted", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const { fetch, saved, server } = recording(repo, fake);
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch });
  await pick([png("one.png"), png("two.png")]);
  const [first] = await thumbnails(2);

  await click(first);

  await thumbnails(1);
  await waitFor(async () =>
    expect((await server(atRepo(`/chat-images/${saved[0]}`))).status).toBe(404),
  );
  await send("Only the second");
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].images).toHaveLength(1);
  expect(fake.adapter.sent[0].images[0].path.endsWith(saved[1])).toBe(true);
});

test('US2.4: an image alone is sent, and its chat is titled "Image"', async () => {
  const fake = await fakeAgent();
  await renderPage("/chats/new", fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);

  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].images).toHaveLength(1);
  await waitFor(() => expect(window.location.pathname).toMatch(/\/chats\/[^/]+$/));
  expect(await screen.findByRole("heading", { name: "Image" })).toBeTruthy();
});

test("an image alone is sent with Enter on a wide screen", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);

  await act(async () => {
    fireEvent.keyDown(await composer(), { key: "Enter" });
  });

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].images).toHaveLength(1);
});

test("an image is not sent while it is being saved", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const server = serverFetch(repo, fake.sessions);
  const waiting: Array<() => void> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (urlOf(input).includes("/attach?")) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    return server(input, init);
  };
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch });
  await pick([png()]);
  await waitFor(() => expect(waiting).toHaveLength(1));

  await type(await composer(), "Look");

  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  await act(async () => waiting.shift()!());
  await thumbnails(1);
  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false);
});

test("US2.5: a taken-back message returns its text and images to the composer", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await openTurn(fake);
  await pick([png()]);
  await thumbnails(1);
  await send("Use this one");
  await refreshUntil(() => expect(log().getByText("Not read yet")).toBeTruthy());

  await click(log().getByRole("button", { name: "Take back" }));

  await waitFor(async () => expect((await composer()).textContent).toBe("Use this one"));
  await thumbnails(1);
  await click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(3));
  expect(fake.adapter.sent[2].images).toEqual(fake.adapter.sent[1].images);
});

test("US2.6: a sent image opens full screen", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);
  await send("This one");
  await refreshUntil(() => expect(log().getByText("This one")).toBeTruthy());

  await click(log().getByRole("link", { name: "Image" }));

  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("US2.7: an agent without images has no attach button, and a drop says why", async () => {
  const fake = await fakeAgent();
  fake.adapter.capabilities = { ...fake.adapter.capabilities, images: false };
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await composer();
  await answered("Agent");
  expect(screen.queryByRole("button", { name: /^Add image/ })).toBeNull();

  await dropImages([png()]);

  expect((await screen.findAllByText("This agent cannot read images.")).length).toBeGreaterThan(0);
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("an image dropped anywhere on the session page joins the message", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await composer();

  await dropImages([png()]);

  await thumbnails(1);
});

test('an eleventh image is refused: "A message takes at most 10 images."', async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick(Array.from({ length: 9 }, (_, index) => png(`${index}.png`)));
  await thumbnails(9);

  await pick([png("nine.png"), png("ten.png")]);

  await thumbnails(10);
  expect((await screen.findAllByText("A message takes at most 10 images.")).length).toBeGreaterThan(
    0,
  );
});

test('a missing chat image shows "Image missing"', async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);
  await send("This one");
  await refreshUntil(() => expect(log().getByText("This one")).toBeTruthy());

  await act(async () => {
    fireEvent.error(log().getByRole("link", { name: "Image" }).querySelector("img")!);
  });

  expect(log().getByText("Image missing")).toBeTruthy();
});

test("the workflow's message takes no images", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session?continue=manual`, fixtureRepo(), { agent: fake });
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));

  expect(screen.queryByRole("button", { name: /^Add image/ })).toBeNull();
  await dropImages([png()]);
  expect(
    (await screen.findAllByText("The workflow's message takes no images.")).length,
  ).toBeGreaterThan(0);
});

/** Holds the page's uploads until the test lets each through, on the server in process. */
function holding(repo: string, fake: Fake) {
  const { fetch: server, saved, server: direct } = recording(repo, fake);
  const waiting: Array<() => void> = [];
  let hold = true;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (hold && urlOf(input).includes("/attach?")) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    return server(input, init);
  };
  return {
    fetch,
    saved,
    server: direct,
    waiting,
    /** Lets uploads through from now on, and those waiting. */
    releaseAll: async () => {
      hold = false;
      await act(async () => waiting.splice(0).forEach((resolve) => resolve()));
    },
  };
}

/** A file of the fixtures' images, under a name of the human's. */
const fileOf = (name: string, as: string, type: string) =>
  new File([readFileSync(fixture(`images/${name}`))], as, { type });

/** The texts shown on the page, not in the screen reader's announcements. */
const shownText = (text: string) =>
  screen.queryAllByText(text).filter((element) => !element.closest("[data-astryx-live-region]"));

const SVG_REFUSED = "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one.";

test("a refused image of a batch stays shown once the others are saved", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await composer();

  await dropImages([fileOf("drawing.svg", "diagram.svg", "image/svg+xml"), png("login.png")]);

  await thumbnails(1);
  expect(shownText(SVG_REFUSED)).toHaveLength(1);
  expect(shownText("Added login.png")).toHaveLength(0);
});

test("a hand-over sends the workflow's message alone, and keeps the draft's images for later", async () => {
  // The session's page alone: on a wide screen, the feature's page beside it has its own Start.
  atWidth(402);
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);

  await act(async () => navigate(atRepo(`/f/${CLI}/session?continue=manual`)));
  await waitFor(async () => expect((await composer()).textContent).not.toBe(""));
  await click(screen.getByRole("button", { name: "Start the agent" }));

  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].images).toHaveLength(0);
  // The page draws the session its message created, with the draft it kept.
  await refreshUntil(() =>
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1),
  );
  await thumbnails(1);
});

test("several thumbnails are told apart by their place", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });

  // A browser names every pasted screenshot alike.
  await pasteImages([png("image.png"), png("image.png")]);

  const buttons = await thumbnails(2);
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "Remove image.png — image 1 of 2",
    "Remove image.png — image 2 of 2",
  ]);
});

test("removing a thumbnail moves the focus to the next one, then to the message", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png("one.png"), png("two.png")]);
  const [first] = await thumbnails(2);

  await click(first);

  await thumbnails(1);
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Remove two.png");
  await click(document.activeElement as HTMLElement);
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
});

test("an image dropped while the agent is not available is refused with why", async () => {
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), {
    agent: await fakeAgent({ installed: false }),
  });
  await composer();

  await dropImages([png()]);

  // Under the composer, and under the field as an image's refusal.
  await waitFor(() =>
    expect(shownText("Claude Code is not available on this machine.")).toHaveLength(2),
  );
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("a taken-back message's images leave the draft at most 10, and say why", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const { fetch, saved, server } = recording(repo, fake);
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch });
  await openTurn(fake);
  await pick([png("a.png"), png("b.png"), png("c.png")]);
  await thumbnails(3);
  await send("Three");
  await refreshUntil(() => expect(log().getByText("Not read yet")).toBeTruthy());
  await pick(Array.from({ length: 9 }, (_, index) => png(`${index}.png`)));
  await thumbnails(9);

  await click(log().getByRole("button", { name: "Take back" }));

  await thumbnails(10);
  expect(shownText("A message takes at most 10 images.").length).toBeGreaterThan(0);
  // The draft's last two are gone, with their files.
  await waitFor(async () =>
    expect((await server(atRepo(`/chat-images/${saved[10]}`))).status).toBe(404),
  );
  expect((await server(atRepo(`/chat-images/${saved[11]}`))).status).toBe(404);
  expect((await server(atRepo(`/chat-images/${saved[9]}`))).status).toBe(200);
});

test("Send shows, disabled, while an image is saved during a turn", async () => {
  atWidth(402);
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const uploads = holding(repo, fake);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake, fetch: uploads.fetch });
  await openTurn(fake, "Look at the plan.");
  await refreshUntil(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());

  await pick([png()]);

  await waitFor(() => expect(uploads.waiting).toHaveLength(1));
  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  await uploads.releaseAll();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false),
  );
});

test("Enter while an image is saved does not send", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const uploads = holding(repo, fake);
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch: uploads.fetch });
  await pick([png()]);
  await waitFor(() => expect(uploads.waiting).toHaveLength(1));
  await type(await composer(), "Look");

  await act(async () => {
    fireEvent.keyDown(await composer(), { key: "Enter" });
  });

  await uploads.releaseAll();
  await thumbnails(1);
  expect(fake.adapter.sent).toHaveLength(0);
  expect((await composer()).textContent).toBe("Look");
});

test("on the phone, Return with images adds a line", async () => {
  atWidth(402);
  const fake = await fakeAgent();
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);
  await type(await composer(), "Look");

  await act(async () => {
    fireEvent.keyDown(await composer(), { key: "Enter" });
  });

  await waitFor(async () => expect((await composer()).textContent).toBe("Look\n"));
  expect(fake.adapter.sent).toHaveLength(0);
});

test("a refused send puts its images back in the composer", async () => {
  const fake = await fakeAgent();
  const { sessions } = await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await pick([png()]);
  await thumbnails(1);
  fake.adapter.installed = false;
  await sessions.check();

  await send("This one");

  expect(await screen.findByText("Claude Code is not available on this machine.")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
  expect(fake.adapter.sent).toHaveLength(0);
});

test("a thumbnail removed while it is saved has its image deleted once saved", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const uploads = holding(repo, fake);
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch: uploads.fetch });
  await pick([png()]);
  await waitFor(() => expect(uploads.waiting).toHaveLength(1));

  await click(screen.getByRole("button", { name: "Remove login.png" }));
  await uploads.releaseAll();

  await waitFor(() => expect(uploads.saved).toHaveLength(1));
  await waitFor(async () =>
    expect((await uploads.server(atRepo(`/chat-images/${uploads.saved[0]}`))).status).toBe(404),
  );
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("an image pasted for an agent without images is refused with why", async () => {
  const fake = await fakeAgent();
  fake.adapter.capabilities = { ...fake.adapter.capabilities, images: false };
  await renderPage(`/f/${WEB_UI}/session`, fixtureRepo(), { agent: fake });
  await composer();
  await answered("Agent");

  await pasteImages([png()]);

  expect((await screen.findAllByText("This agent cannot read images.")).length).toBeGreaterThan(0);
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("a thumbnail shows its file, dimmed, while it is saved", async () => {
  const fake = await fakeAgent();
  const repo = fixtureRepo();
  const uploads = holding(repo, fake);
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: fake, fetch: uploads.fetch });

  await pick([png()]);

  await waitFor(() => expect(uploads.waiting).toHaveLength(1));
  const thumbnail = screen.getByRole("group", { name: "login.png" });
  expect(thumbnail.querySelector("img")?.getAttribute("src")).toMatch(/^blob:/);
  expect(thumbnail.querySelector(SPINNER)).toBeTruthy();
  await uploads.releaseAll();
  await waitFor(() =>
    expect(thumbnail.querySelector("img")?.getAttribute("src")).toMatch(
      /^\/r\/[^/]+\/chat-images\//,
    ),
  );
});
