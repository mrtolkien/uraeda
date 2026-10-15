// US1 and its edge case "Back from a session view": a feature's session opens as a page of its own
// at both sizes, its transcript follows its end while the human is at the end, and Back returns to
// the same position. US3 and its edge case "Width changing across 768 px": the phone's progress
// line keeps its open state and position across Back, and the column turns into it and back as the
// width changes. US4.1–US4.4: scrolled up, "Jump to the latest" brings back the end, and the page
// follows it again. The session view passes the layout checks at both sizes, in light and dark
// (SC-004).
// A chat whose last message has images opens at its end too, once they load.
import { act, screen, within } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import type { ChatImage } from "uraeda-server/fate";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, page, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { sendMessage as sendTo } from "../sessions.ts";
import {
  atRepo,
  atSize,
  agent,
  checkLayout,
  drawn,
  grown,
  image,
  LIVE,
  sendMessage,
  show,
  startTurn,
} from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const CLI = "2026-10-12-cli-tuis";

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

/** What scrolls the transcript: the window, the session being a page of its own. */
function scroller() {
  return document.scrollingElement!;
}

/** The composer's text field, which stays at the bottom. */
function composer() {
  return screen.getByRole("textbox", { name: "Message Claude Code" });
}

/** Whether an element's bottom shows above the composer. */
function inView(element: Element) {
  return element.getBoundingClientRect().bottom <= composer().getBoundingClientRect().top + 1;
}

/** Lines of the agent's text, numbered. */
function lines(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    text: `${prefix} ${index + 1}.`,
    type: "text" as const,
  }));
}

/** Opens the feature's session from its page, and starts a turn that writes 40 lines. */
async function openWorkingSession() {
  await show(`/f/${CLI}`, "Open the session");
  await userEvent.click(screen.getByRole("link", { name: "Open the session" }));
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  await startTurn("Plan the CLI.", lines(40, "Line"));
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Line 40.", undefined, LIVE);
  await drawn();
  return log;
}

test("a working session: a page of its own, following its end (US1)", async () => {
  const log = await openWorkingSession();
  expect(screen.queryByRole("list", { name: "Files" })).toBeNull();
  await checkLayout();

  // At the end, a new line comes into view.
  const box = scroller();
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  await agent.agentEmit([{ text: "The newest line.", type: "text" }]);
  const newest = await within(log).findByText("The newest line.", undefined, LIVE);
  await expect.poll(() => inView(newest), LIVE).toBe(true);

  // Scrolled up, the view stays where it is, even as the turn grows past a page of 100 items.
  const middle = Math.round((box.scrollHeight - box.clientHeight) / 2);
  box.scrollTo(0, middle);
  await drawn();
  const position = box.scrollTop;
  expect(position).toBeGreaterThan(0);
  await agent.agentEmit(lines(70, "Later line"));
  await within(log).findByText("Later line 70.", undefined, LIVE);
  await drawn();
  expect(log.isConnected).toBe(true);
  expect(box.scrollTop).toBe(position);
});

const JUMP = "Jump to the latest";

test("US4.2–US4.4: scrolled up, Jump to the latest brings the end back, and the page follows it", async () => {
  const log = await openWorkingSession();
  const box = scroller();

  // US4.4: at the end, no button.
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  expect(screen.queryByRole("button", { name: JUMP })).toBeNull();

  // US4.2: scrolled up 400 px, the page keeps its position as lines arrive, and the button shows,
  // above the composer, without growing the page.
  const height = box.scrollHeight;
  box.scrollTo(0, box.scrollTop - 400);
  await drawn();
  const position = box.scrollTop;
  const jump = await screen.findByRole("button", { name: JUMP }, LIVE);
  await drawn();
  expect(jump.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    composer().getBoundingClientRect().top,
  );
  expect(box.scrollHeight).toBe(height);
  expect(box.scrollTop).toBe(position);
  await agent.agentEmit(lines(5, "Later line"));
  const latest = await within(log).findByText("Later line 5.", undefined, LIVE);
  await drawn();
  expect(box.scrollTop).toBe(position);
  expect(inView(latest)).toBe(false);
  await checkLayout();

  // US4.3: pressed, the newest line shows, the button goes, the focus moves to the composer rather
  // than to the page, and a further line stays in view.
  await userEvent.click(jump);
  await expect.poll(() => inView(latest), LIVE).toBe(true);
  await expect.poll(() => screen.queryByRole("button", { name: JUMP }), LIVE).toBeNull();
  expect(document.activeElement).toBe(composer());
  await agent.agentEmit([{ text: "A line after the jump.", type: "text" }]);
  const after = await within(log).findByText("A line after the jump.", undefined, LIVE);
  await expect.poll(() => inView(after), LIVE).toBe(true);
  expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
});

test("a working session, with a sub-agent and a steered message, in dark (SC-004)", async () => {
  window.localStorage.setItem("uraeda.theme", "dark");
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    { text: "Reading **the answers**.", type: "text" },
    {
      id: "a",
      input: { file_path: "spec.md" },
      kind: "read",
      name: "Read",
      target: "specs/2026-10-12-cli-tuis/spec.md",
      type: "toolStart",
    },
    { id: "a", isError: false, output: "# Spec", type: "toolEnd" },
    {
      id: "task",
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description: "Map the runner code" },
      type: "toolStart",
    },
    {
      id: "b",
      input: {},
      kind: "search",
      name: "Grep",
      parent: "task",
      target: '"sessions" packages/server/src/runner/',
      type: "toolStart",
    },
    { text: "The runner already keeps one cache per repository.", type: "textDelta" },
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText(/keeps one cache/, undefined, LIVE);
  await userEvent.fill(
    screen.getByRole("textbox", { name: "Message Claude Code" }),
    "Use the existing helper for the cache's paths.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await within(log).findByText("Not read yet", undefined, LIVE);
  await drawn();
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  await checkLayout();
});

/**
 * Follows a link of the agent's reply, a real click as the human's, while it shows, then comes
 * back with Back once the page it opens is drawn in the session's place. Back before then is in
 * `routes.test.ts`.
 */
async function followAndComeBack(link: HTMLElement, path: string) {
  await userEvent.click(link);
  await expect.poll(() => window.location.pathname).toBe(atRepo(path));
  await expect.poll(() => link.isConnected, LIVE).toBe(false);
  await drawn();
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
  await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await drawn();
}

test("Back from a session view returns to its position, following the end only from the end", async () => {
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    ...lines(20, "Line"),
    { text: `As [the proposal](/f/${CLI}/proposal.md) asks.`, type: "text" },
    ...lines(20, "Next line"),
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Next line 20.", undefined, LIVE);
  await drawn();

  // Scrolled up to a link in the reply: Back returns there, and nothing moves as the turn grows.
  const box = scroller();
  const proposal = within(log).getByRole("link", { name: "the proposal" });
  box.scrollTo(
    0,
    Math.round(box.scrollTop + proposal.getBoundingClientRect().top - box.clientHeight / 2),
  );
  await drawn();
  const position = Math.round(box.scrollTop);
  expect(position).toBeGreaterThan(0);
  await followAndComeBack(proposal, `/f/${CLI}/proposal.md`);
  await expect.poll(() => Math.round(box.scrollTop), LIVE).toBe(position);
  await agent.agentEmit([{ text: "A line while scrolled up.", type: "text" }]);
  await screen.findByText("A line while scrolled up.", undefined, LIVE);
  await drawn();
  expect(Math.round(box.scrollTop)).toBe(position);

  // At the end: Back returns to the end, and the view follows it again.
  await agent.agentEmit([{ text: `Then [the spec](/f/${CLI}/spec.md).`, type: "text" }]);
  const spec = await screen.findByRole("link", { name: "the spec" }, LIVE);
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  await followAndComeBack(spec, `/f/${CLI}/spec.md`);
  await agent.agentEmit([{ text: "A line after coming back.", type: "text" }]);
  const newest = await screen.findByText("A line after coming back.", undefined, LIVE);
  await expect.poll(() => inView(newest), LIVE).toBe(true);
});

/** Saves an image for a chat, as the composer does, without showing it on the page. */
async function chatImage(file: File): Promise<ChatImage> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(atRepo(`/attach?chat=1&name=${encodeURIComponent(file.name)}`), {
    body,
    method: "POST",
  });
  return (await response.json()) as ChatImage;
}

/**
 * Review: the images of the last message load after the view showed the transcript's end. They
 * are sent outside the page, and served late: an image this page already loaded, or one loaded
 * before the view is drawn, is drawn at once, at its size.
 */
test("a chat whose last message has images opens at its end", async () => {
  await show("/", "Priorities");
  const fate = createFateClient({ url: atRepo("/fate") });
  const ended = {
    denials: [],
    errors: [],
    interrupted: false,
    ok: true,
    type: "result" as const,
  };
  const first = await sendTo(fate, { text: "Plan the CLI." });
  if (!first.ok) {
    throw new Error(first.message);
  }
  await agent.agentAccept();
  await agent.agentEmit([
    ...Array.from({ length: 40 }, (_, index) => ({
      text: `Line ${index + 1}.`,
      type: "text" as const,
    })),
    ended,
  ]);
  const images = [
    await chatImage(await image("phone.png", "one.png")),
    await chatImage(await image("desktop.png", "two.png")),
  ];
  // The turn's end is recorded before the next message goes.
  await expect
    .poll(async () => {
      const next = await sendTo(fate, { images, session: first.session, text: "These two." });
      return next.ok;
    }, LIVE)
    .toBe(true);
  await agent.agentAccept();
  await agent.agentEmit([ended]);

  // Over a slow network, its images come after the view opened.
  await commands.slowChatImages(1000);
  await show(`/chats/${first.session}`, "These two.");

  const log = await screen.findByRole("log", { name: "Conversation" });
  const drawnImages = [...log.querySelectorAll<HTMLImageElement>('a[href*="/chat-images/"] img')];
  expect(drawnImages).toHaveLength(2);
  await expect
    .poll(() => drawnImages.every((one) => one.complete && one.naturalWidth > 0), LIVE)
    .toBe(true);
  await drawn();
  const box = scroller();
  expect(box.scrollHeight - box.scrollTop - box.clientHeight).toBeLessThanOrEqual(1);
});

/** The line of the transcript a third down the window: where the human reads. */
function readLine(log: HTMLElement) {
  const third = window.innerHeight / 3;
  return within(log)
    .getAllByText(/^Line \d+\.$/)
    .find((element) => element.getBoundingClientRect().bottom >= third)!;
}

/** The phone's progress line of `CLI` at Task 7 of 11. */
const LINE = "Implementation · 7/11 · Session column";

/** Scrolls the window so that an element's top is `offset` px above the line a third down it. */
async function putAboveTheThird(element: Element, offset: number) {
  const box = scroller();
  const third = window.innerHeight / 3;
  box.scrollTo(0, Math.round(box.scrollTop + element.getBoundingClientRect().top - third + offset));
  await drawn();
}

// Behaviour the two layouts share: the transcript is a page of its own at both sizes.
describe("on the phone", () => {
  atSize("phone");

  test("an ended session scrolled up also offers Jump to the latest", async () => {
    const log = await openWorkingSession();
    await agent.agentFinish();
    await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
    await drawn();
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await drawn();
    expect(screen.queryByRole("button", { name: JUMP })).toBeNull();

    box.scrollTo(0, box.scrollTop - 400);
    // Pressed from the keyboard: the focus goes to the composer, not to the page.
    (await screen.findByRole("button", { name: JUMP }, LIVE)).focus();
    await userEvent.keyboard("{Enter}");

    const last = within(log).getByText("Line 40.");
    await expect.poll(() => inView(last), LIVE).toBe(true);
    await expect.poll(() => screen.queryByRole("button", { name: JUMP }), LIVE).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  test("idle at the end, send: the reply stays in view and no button shows", async () => {
    const log = await openWorkingSession();
    await agent.agentFinish();
    await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
    await drawn();
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await drawn();

    // The message, two lines, grows the transcript before the session works.
    await sendMessage("Now the tests.\nThen the docs.");
    await agent.agentAccept();
    await agent.agentEmit(lines(10, "Reply"));
    const reply = await within(log).findByText("Reply 10.", undefined, LIVE);
    await expect.poll(() => inView(reply), LIVE).toBe(true);
    await drawn();
    expect(inView(reply)).toBe(true);
    expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
  });

  test("US3.3: the open progress line survives a file link and Back", async () => {
    await agent.addPlan(CLI);
    await show(`/f/${CLI}/session`, "CLI TUIs");
    await startTurn("Plan the CLI.", lines(40, "Line"));
    const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
    await within(log).findByText("Line 40.", undefined, LIVE);
    await drawn();

    const line = screen.getByRole("button", { name: LINE });
    await userEvent.click(line);
    expect(line.getAttribute("aria-expanded")).toBe("true");
    const plan = await screen.findByRole("link", { name: "plan.md" }, LIVE);
    await drawn();
    // Scrolled to the plan's link, in the column's open content.
    const box = scroller();
    box.scrollTo(
      0,
      Math.round(box.scrollTop + plan.getBoundingClientRect().top - box.clientHeight / 2),
    );
    await drawn();
    const position = Math.round(box.scrollTop);
    expect(position).toBeGreaterThan(0);

    await followAndComeBack(plan, `/f/${CLI}/plan.md`);

    const back = await screen.findByRole("button", { name: LINE }, LIVE);
    expect(back.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByRole("link", { name: "plan.md" }, LIVE)).toBeTruthy();
    await expect.poll(() => Math.round(box.scrollTop), LIVE).toBe(position);
  });
});

// Only the wide layout shows a task view in a pane, and the width changes start from it.
describe("on the desktop", () => {
  atSize("desktop");

  // A session opened from a task view still opens at its end: the task view's pane keeps its own
  // position in its history entry, which must not hold the session's page back.
  test("a session opened from a task view's pane opens at its end", async () => {
    await show(`/f/${CLI}/session`, "CLI TUIs");
    await startTurn("Plan the CLI.", [
      {
        id: "task",
        input: {},
        kind: "other",
        name: "Task",
        subagent: { description: "Map the runner code" },
        type: "toolStart",
      },
      ...lines(40, "Line"),
    ]);
    await within(await screen.findByRole("log", { name: "Conversation" }, LIVE)).findByText(
      "Line 40.",
      undefined,
      LIVE,
    );
    await show("/priorities/claude-code-runner-triggered-manually", "Claude Code runner");
    // Scrolled, the pane has a position of its own for the task view's entry to keep.
    const pane = screen.getByRole("region", { name: "Detail" });
    pane.scrollTo(0, pane.scrollHeight);
    await drawn();

    await userEvent.click(
      await screen.findByRole("link", { name: "Map the runner code, Working" }, LIVE),
    );

    await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${CLI}/session`));
    const last = await within(
      await screen.findByRole("log", { name: "Conversation" }, LIVE),
    ).findByText("Line 40.", undefined, LIVE);
    await drawn();
    await expect.poll(() => inView(last), LIVE).toBe(true);
  });

  test("a paragraph read across the line a third down keeps its place across 768 px", async () => {
    const words = Array.from({ length: 400 }, (_, index) => `word${index}`).join(" ");
    try {
      await show(`/f/${CLI}/session`, "CLI TUIs");
      await startTurn("Plan the CLI.", [
        ...lines(10, "Line"),
        { text: `Long \`paragraph\` ${words}.`, type: "text" },
        ...lines(30, "Next line"),
      ]);
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Next line 30.", undefined, LIVE);
      await drawn();
      // Its inline code above the line, its text across it.
      const paragraph = within(log).getByText(/word399\.$/);
      expect(paragraph.getBoundingClientRect().height).toBeGreaterThan(200);
      await putAboveTheThird(paragraph, 100);
      const top = paragraph.getBoundingClientRect().top;

      await page.viewport(402, 874);
      await expect.poll(() => window.innerWidth).toBe(402);
      await screen.findByRole("button", { name: "Plan" }, LIVE);
      await drawn();

      expect(Math.abs(paragraph.getBoundingClientRect().top - top)).toBeLessThan(2);
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

describe("on the desktop, the column across 768 px", () => {
  atSize("desktop");

  test("the column turns into the collapsed progress line across 768 px, at the same position", async () => {
    try {
      await agent.addPlan(CLI);
      await show(`/f/${CLI}/session`, "CLI TUIs");
      await startTurn("Plan the CLI.", lines(60, "Line"));
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Line 60.", undefined, LIVE);
      await screen.findByRole("complementary", { name: "Progress" }, LIVE);
      await drawn();
      const box = scroller();
      box.scrollTo(0, Math.round((box.scrollHeight - box.clientHeight) / 2));
      await drawn();
      expect(box.scrollTop).toBeGreaterThan(0);
      // The line the human reads, a third down the window.
      const read = readLine(log);
      const top = read.getBoundingClientRect().top;

      await page.viewport(402, 874);
      await expect.poll(() => window.innerWidth).toBe(402);
      const line = await screen.findByRole("button", { name: LINE }, LIVE);
      expect(line.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();
      await drawn();
      // The same page, not a new one: its transcript stays, the line read where it was.
      expect(log.isConnected).toBe(true);
      expect(Math.abs(read.getBoundingClientRect().top - top)).toBeLessThan(2);
      // Scrolled on the phone: the line read a third down it is another one.
      box.scrollTo(0, Math.round((box.scrollHeight - box.clientHeight) / 3));
      await drawn();
      const readNarrow = readLine(log);
      const topNarrow = readNarrow.getBoundingClientRect().top;

      await page.viewport(1440, 900);
      await expect.poll(() => window.innerWidth).toBe(1440);
      await screen.findByRole("complementary", { name: "Progress" }, LIVE);
      expect(screen.queryByRole("button", { name: LINE })).toBeNull();
      await drawn();
      expect(log.isConnected).toBe(true);
      expect(Math.abs(readNarrow.getBoundingClientRect().top - topNarrow)).toBeLessThan(2);
    } finally {
      await page.viewport(1440, 900);
    }
  });

  test("opening the line moves the place read, which the next width keeps", async () => {
    try {
      await page.viewport(402, 874);
      await expect.poll(() => window.innerWidth).toBe(402);
      await agent.addPlan(CLI);
      await show(`/f/${CLI}/session`, "CLI TUIs");
      await startTurn("Plan the CLI.", lines(60, "Line"));
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Line 60.", undefined, LIVE);
      await drawn();
      const box = scroller();
      box.scrollTo(0, Math.round((box.scrollHeight - box.clientHeight) / 2));
      await drawn();

      // Opened without scrolling to it, as a tap at the top of the page would.
      await act(async () => screen.getByRole("button", { name: LINE }).click());
      await screen.findByRole("region", { name: "Progress" }, LIVE);
      // Its sections drawn, each once its files are read.
      await grown();
      const read = readLine(log);
      const top = read.getBoundingClientRect().top;

      await page.viewport(1440, 900);
      await expect.poll(() => window.innerWidth).toBe(1440);
      await screen.findByRole("complementary", { name: "Progress" }, LIVE);
      await drawn();

      expect(Math.abs(read.getBoundingClientRect().top - top)).toBeLessThan(2);
    } finally {
      await page.viewport(1440, 900);
    }
  });
});
