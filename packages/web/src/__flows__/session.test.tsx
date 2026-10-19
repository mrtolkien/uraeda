// Flow: a chat and a feature's session. A message reaches the agent and its reply is shown; one
// sent during a turn waits and can be taken back; Stop ends a turn; a refusal keeps the human's
// text next to the composer; images are attached, removable, and deleted when removed.
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { IMAGE_REFUSALS } from "uraeda-server/limits";
import { click, refreshUntil, startApp, type } from "./harness.tsx";
import {
  composer,
  composerText,
  drop,
  log,
  openTurn,
  paste,
  pick,
  png,
  recording,
  resetAgent,
  send,
  thumbnails,
} from "./session-helpers.tsx";

const WEB_UI = "2026-10-11-web-ui";
const CLI = "2026-10-12-cli-tuis";

const app = startApp({ agent: true });

beforeEach(() => resetAgent(app));

/** A chat of its own, which the test opens. */
async function chat() {
  const { id } = await app.sessions.newChat(app.repo);
  await app.open(`/chats/${id}`);
  await composer();
  return id;
}

test("a message reaches the agent and its reply is shown, with the feature's step where it was", async () => {
  app.agent.script([{ text: "Because A keeps **one** process.", type: "text" }]);
  await app.open(`/f/${WEB_UI}/session`);

  await send("Why did you recommend A?");

  await refreshUntil(() => expect(log().getByText("one").tagName).toBe("STRONG"));
  expect(app.agent.sent[0].text).toContain("Why did you recommend A?");
  // A chat about a feature moves nothing: its round still waits on the human.
  await app.open(`/f/${WEB_UI}`);
  expect(
    (await screen.findAllByRole("link")).some((link) =>
      link.getAttribute("href")?.endsWith(`/f/${WEB_UI}/clarifications-01.md`),
    ),
  ).toBe(true);
});

test("a message sent during a turn waits, and Take back returns its text to the composer", async () => {
  await chat();
  await openTurn(app);

  await send("Use the existing helper");

  await waitFor(() => expect(app.agent.sent).toHaveLength(2));
  expect(app.agent.sent[1].when).toBe("steer");
  await click(await screen.findByRole("button", { name: "Take back" }));
  await waitFor(() => expect(app.agent.takenBack).toEqual([app.agent.sent[1].id]));
  await waitFor(() => expect(composerText()).toBe("Use the existing helper"));
  app.agent.emit({ id: app.agent.sent[1].id, type: "cancelled" });
  await refreshUntil(() => expect(log().queryByText("Use the existing helper")).toBeNull());
});

test("an agent that cannot take a message back offers no Take back", async () => {
  app.agent.capabilities = { ...app.agent.capabilities, takeBack: false };
  await chat();
  await openTurn(app);

  await send("Use the existing helper");

  await refreshUntil(() => expect(log().getByText("Use the existing helper")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Take back" })).toBeNull();
});

test("Send turns into Stop during a turn, and Stop interrupts the agent", async () => {
  await chat();
  await openTurn(app, "Look at the plan.");

  await refreshUntil(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
  await click(screen.getByRole("button", { name: "Stop" }));

  await waitFor(() => expect(app.agent.interrupts).toBe(1));
  await refreshUntil(() => expect(screen.getByRole("button", { name: "Send" })).toBeTruthy());
});

test("a blank message cannot be sent", async () => {
  await chat();

  await type(await composer(), " ");

  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
});

test("a refused send keeps the text in the composer, and sends nothing", async () => {
  await chat();
  // The agent leaves the machine after the page read it.
  app.agent.installed = false;
  await app.sessions.check();

  await send("Why did you recommend A?");

  await waitFor(() => expect(composerText()).toBe("Why did you recommend A?"));
  expect(app.agent.sent).toHaveLength(0);
  app.agent.installed = true;
  await app.sessions.check();
});

test("a session of a past run opens at that run from its address", async () => {
  const session = await app.sessions.featureSession(app.repo, CLI);
  app.agent.script([{ text: "Planned the tasks.", type: "text" }]);
  const { turn } = await app.sessions.send(app.repo, session.id, { text: "Plan it." });
  await app.sessions.settled(turn);

  await app.open(`/f/${CLI}/runs/${turn}`);

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/f/${CLI}/session`)));
  expect(window.location.hash).toBe(`#turn-${turn}`);
  expect(await screen.findByRole("log")).toBeTruthy();
});

test("a thumbnail pasted, picked, or dropped is shown removable and sent with the message", async () => {
  await chat();

  await paste([png("one.png")]);
  await pick([png("two.png")]);
  await drop([png("three.png")]);
  await thumbnails(3);
  await send("What is wrong here?");

  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  expect(app.agent.sent[0].images).toHaveLength(3);
  await refreshUntil(() => expect(log().getByText("What is wrong here?")).toBeTruthy());
  // The images moved to the message: the composer holds no thumbnail.
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
});

test("a thumbnail removed is not sent, and its saved image is deleted", async () => {
  const { id } = await app.sessions.newChat(app.repo);
  const { fetch, saved } = recording(app);
  await app.open(`/chats/${id}`, { fetch });
  await pick([png("one.png"), png("two.png")]);
  const [first] = await thumbnails(2);

  await click(first);

  await thumbnails(1);
  await waitFor(async () => {
    const gone = await app.fetch(`http://127.0.0.1:4310${app.path(`/chat-images/${saved[0]}`)}`);
    expect(gone.status).toBe(404);
  });
  await send("Only the second");
  await waitFor(() => expect(app.agent.sent[0].images).toHaveLength(1));
});

test("an agent that takes no images refuses them, and attaches nothing", async () => {
  app.agent.capabilities = { ...app.agent.capabilities, images: false };
  await chat();

  await paste([png()]);
  await drop([png()]);

  // The refusal is said, so both the paste and the drop were handled.
  await waitFor(() => expect(document.body.textContent).toContain(IMAGE_REFUSALS.noImages));
  expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);
  expect(screen.queryByLabelText(/^Add image/, { selector: "input" })).toBeNull();
});

test("a message taken back returns its images to the composer", async () => {
  await chat();
  await openTurn(app);
  await pick([png()]);
  await thumbnails(1);
  await send("With a picture");
  await waitFor(() => expect(app.agent.sent).toHaveLength(2));

  await click(await screen.findByRole("button", { name: "Take back" }));

  await waitFor(() => expect(composerText()).toBe("With a picture"));
  await thumbnails(1);
});

test("removing a thumbnail moves the focus to the next one, then to the message", async () => {
  await chat();
  await pick([png("one.png"), png("two.png")]);
  const [first] = await thumbnails(2);

  await click(first);

  const [next] = await thumbnails(1);
  await waitFor(() => expect(document.activeElement).toBe(next));
  await click(next);
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
});
