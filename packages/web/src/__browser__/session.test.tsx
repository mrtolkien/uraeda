// US1 and its edge case "Back from a session view": a feature's session opens as a page of its own
// at both sizes, its transcript follows its end while the human is at the end, and Back returns to
// the same position. US3's edge case "Width changing across 768 px": the session's column turns
// into the phone's status line and back as the width changes. US4.1–US4.4: scrolled up, "Jump to the latest" brings back the end, and the page
// follows it again. The session view passes the layout checks at both sizes, in light and dark
// (SC-004).
// A chat whose last message has images opens at its end too, once they load. Round 03 Q2: a banner
// that leaves at the end, and the scroll that comes after the reply, do not stop following. A scroll
// made before the transcript first draws keeps its place (R110).
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { createRef, type Ref, useImperativeHandle, useRef, useState } from "react";
import { createFateClient } from "react-fate/client";
import type { ChatImage } from "uraeda-server/fate";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, page, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { useFollowEnd } from "../following.ts";
import { sendMessage as sendTo } from "../sessions.ts";
import {
  atRepo,
  atSize,
  agent,
  checkLayout,
  drawn,
  image,
  LIVE,
  sendMessage,
  show,
  startTurn,
  colorScheme,
} from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const CLI = "2026-10-12-cli-tuis";

afterEach(() => {});

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

/** Opens the feature's session, and starts a turn that writes 40 lines. */
async function openWorkingSession() {
  await show(`/f/${CLI}/session`, "CLI TUIs");
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
  await colorScheme("dark");
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
    ...lines(9, "Line"),
    { text: `As [the proposal](/f/${CLI}/proposal.md) asks.`, type: "text" },
    ...lines(9, "Next line"),
  ]);
  const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
  await within(log).findByText("Next line 9.", undefined, LIVE);
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

/**
 * Holds the page's reads of turns and their items from now on, until the returned function is
 * called: the transcript's tail draws only then.
 */
function holdTurns() {
  const original = window.fetch;
  const held: Array<() => void> = [];
  let holding = true;
  window.fetch = (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    if (holding && body.includes('"kind":"byId"') && /"type":"Turn(Log)?"/.test(body)) {
      return new Promise<Response>((resolve, reject) => {
        held.push(() => void original(input, init).then(resolve, reject));
      });
    }
    return original(input, init);
  };
  return () => {
    if (holding) {
      holding = false;
      window.fetch = original;
      held.splice(0).forEach((go) => go());
    }
  };
}

describe("on the phone, opened while its transcript loads", () => {
  atSize("phone");

  // R110: the human scrolls up before the transcript's tail first draws, which opens the page at its
  // end: the human's scroll wins. The case holds the turns' data until it has scrolled, so the tail
  // draws after the scroll in every run; a spacer under the page lets it scroll before then.
  test("scrolled up before the transcript first draws, the page keeps the place and offers Jump to the latest", async () => {
    await show("/", "Priorities");
    const fate = createFateClient({ url: atRepo("/fate") });
    const first = await sendTo(fate, { text: "Plan the CLI." });
    if (!first.ok) {
      throw new Error(first.message);
    }
    await agent.agentAccept();
    await agent.agentEmit([...lines(40, "Line"), ENDED]);

    const release = holdTurns();
    try {
      await show(`/sessions/${first.session}`, "");
      await screen.findByRole("textbox", { name: "Message Claude Code" }, LIVE);
      expect(screen.queryByText("Line 40.")).toBeNull();
      const spacer = document.createElement("div");
      spacer.style.height = "1600px";
      document.body.append(spacer);
      await drawn();
      const box = scroller();
      box.scrollTo(0, box.scrollHeight);
      await drawn();
      box.scrollTo(0, box.scrollTop - 400);
      await drawn();
      expect(box.scrollTop).toBeGreaterThan(0);
      const above = box.scrollHeight - box.scrollTop - box.clientHeight;
      expect(above).toBeGreaterThanOrEqual(399);

      release();
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Line 40.", undefined, LIVE);
      await drawn();
      // The human stays at least as far above the end as they scrolled: the transcript draws above
      // what they read, which keeps its place on screen or moves down by the transcript's height.
      expect(box.scrollHeight - box.scrollTop - box.clientHeight).toBeGreaterThanOrEqual(above);
      // The button shows once the log has read where the human is, as US4.2's does.
      await screen.findByRole("button", { name: JUMP }, LIVE);
      expect(box.scrollHeight - box.scrollTop - box.clientHeight).toBeGreaterThanOrEqual(above);
    } finally {
      release();
    }
  });
});

/** A turn's end, as the agent reports it. */
const ENDED = {
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result" as const,
};

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
  await show(`/sessions/${first.session}`, "These two.");

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

test("a run that fails while the human is at its end keeps how it ended in view", async () => {
  await openWorkingSession();
  const box = scroller();
  box.scrollTo(0, box.scrollHeight);
  await drawn();
  expect(screen.queryByRole("button", { name: JUMP })).toBeNull();

  // The fake agent exits without a result: the run fails, and its banner shows below the transcript.
  await agent.agentFinish();

  const banner = await screen.findByText("The agent's run failed.", undefined, LIVE);
  await drawn();
  await expect.poll(() => inView(banner), LIVE).toBe(true);
  expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
});

/** The line of the transcript a third down the window: where the human reads. */
function readLine(log: HTMLElement) {
  const third = window.innerHeight / 3;
  return within(log)
    .getAllByText(/^Line \d+\.$/)
    .find((element) => element.getBoundingClientRect().bottom >= third)!;
}

/** The session's column. */
const COLUMN = "The session's column";

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
});

/**
 * Holds every scroll event the browser dispatches from now on, until `text` draws in `log`, then
 * dispatches the last of each target's, as a loaded browser does: a scroll queued as the page
 * changes, a clamp's or the page's own, is dispatched only at the next rendering update, after the
 * tasks that ran meanwhile. Released in the microtask after the draw, before any observer or frame.
 * Returns how to stop holding, should the text never draw.
 */
function holdScrollsUntil(log: HTMLElement, text: string) {
  const held = new Map<EventTarget, Event>();
  const hold = (event: Event) => {
    event.stopImmediatePropagation();
    held.set(event.target!, event);
  };
  const stop = () => {
    observer.disconnect();
    window.removeEventListener("scroll", hold, { capture: true });
  };
  const observer = new MutationObserver(() => {
    if (log.textContent?.includes(text)) {
      stop();
      for (const [target, event] of held) {
        target.dispatchEvent(event);
      }
    }
  });
  window.addEventListener("scroll", hold, { capture: true });
  observer.observe(log, { characterData: true, childList: true, subtree: true });
  return stop;
}

/** What the case does to `Column`, each a draw of its own. */
type ColumnControls = { leave: () => void; send: () => void; work: () => void };

/**
 * A transcript's column as the session page lays it out: the transcript, then a banner. `ref` takes
 * the banner away, draws the human's message, and starts the session working.
 */
function Column({ ref }: { ref: Ref<ColumnControls> }) {
  const log = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState(true);
  const [sent, setSent] = useState(false);
  const [working, setWorking] = useState(false);
  const { following, jumpToLatest } = useFollowEnd(log, working);
  useImperativeHandle(ref, () => ({
    leave: () => setBanner(false),
    send: () => setSent(true),
    work: () => setWorking(true),
  }));
  return (
    <>
      <div>
        <div ref={log}>
          {lines(sent ? 70 : 60, "Line").map(({ text }) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        {banner && (
          <Banner
            collapsible={false}
            description="Read how it ended, then tell the agent how to go on."
            status="error"
            title="The run failed."
          />
        )}
      </div>
      {!following && <Button clickAction={jumpToLatest} label={JUMP} />}
    </>
  );
}

describe("on the phone, the end followed through a page that shortens", () => {
  atSize("phone");

  // Round 03 Q2: the failure banner leaves as the human sends, and the scroll that queues then is
  // dispatched only once the reply has drawn. Only the human's scroll stops following.
  test("idle at the end of a failed run, send, the scrolls dispatched after the reply: it stays in view", async () => {
    const log = await openWorkingSession();
    await agent.agentFinish();
    await screen.findByText("The agent's run failed.", undefined, LIVE);
    await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
    await drawn();
    const box = scroller();
    box.scrollTo(0, box.scrollHeight);
    await drawn();

    const release = holdScrollsUntil(log, "Reply 10.");
    try {
      await sendMessage("Now the tests.");
      await agent.agentAccept();
      // The banner leaves, and what it queues is held while the reply comes.
      await expect.poll(() => screen.queryByText("The agent's run failed."), LIVE).toBeNull();
      await agent.agentEmit(lines(10, "Reply"));
      const reply = await within(log).findByText("Reply 10.", undefined, LIVE);
      await expect.poll(() => inView(reply), LIVE).toBe(true);
      await drawn();
      expect(inView(reply)).toBe(true);
      expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
    } finally {
      release();
    }
  });

  // The same race through the layout's clamp: the banner leaves alone, the page shortens under the
  // human at its end, and the reply draws before the browser dispatches the clamp's scroll. While the
  // human follows, the page keeps its height: the banner leaves blank space, which the reply fills.
  test("a banner that leaves at the end leaves its space, so the clamp's late scroll does not stop following", async () => {
    document.body.innerHTML = "";
    const column = createRef<ColumnControls>();
    render(<Column ref={column} />);
    try {
      await drawn();
      window.scrollTo(0, document.documentElement.scrollHeight);
      await drawn();
      const height = document.documentElement.scrollHeight;

      // The banner leaves and the page is laid out: a shorter page clamps the position, and the
      // browser queues a scroll, dispatched once the human's message has drawn below.
      const release = holdScrollsUntil(screen.getByText("Line 60.").parentElement!, "Line 70.");
      act(() => column.current!.leave());
      const left = document.documentElement.scrollHeight;
      act(() => column.current!.send());
      await drawn();
      release();
      act(() => column.current!.work());
      await drawn();

      expect(screen.getByText("Line 70.").getBoundingClientRect().bottom).toBeLessThanOrEqual(
        window.innerHeight,
      );
      expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
      expect(left).toBe(height);
      // Scrolled up by the human, it stops following, and Jump to the latest brings the end back.
      window.scrollTo(0, 0);
      const jump = await screen.findByRole("button", { name: JUMP }, LIVE);
      // Pressed where it is: below the column here, a pointer would scroll to it first.
      act(() => jump.click());
      await expect.poll(() => screen.queryByRole("button", { name: JUMP }), LIVE).toBeNull();
      expect(screen.getByText("Line 70.").getBoundingClientRect().bottom).toBeLessThanOrEqual(
        window.innerHeight,
      );
    } finally {
      cleanup();
    }
  });
});

// Only the wide layout shows a task view in a pane, and the width changes start from it.
describe("on the desktop", () => {
  atSize("desktop");

  // A session opened after a task view still opens at its end: the task view's pane keeps its own
  // position in its history entry, which must not hold the next pages back.
  test("a session opened after a task view's pane opens at its end", async () => {
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

    // The card opens the feature's page, and the page its session.
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Navigation" })).getByRole("link", {
        name: /^cli-tuis, /,
      }),
    );
    await userEvent.click(await screen.findByRole("link", { name: / \d\d:\d\d$/ }, LIVE));

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
        ...lines(3, "Line"),
        { text: `Long \`paragraph\` ${words}.`, type: "text" },
        ...lines(12, "Next line"),
      ]);
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Next line 12.", undefined, LIVE);
      await drawn();
      // Its inline code above the line, its text across it.
      const paragraph = within(log).getByText(/word399\.$/);
      expect(paragraph.getBoundingClientRect().height).toBeGreaterThan(200);
      await putAboveTheThird(paragraph, 100);
      const top = paragraph.getBoundingClientRect().top;

      await page.viewport(402, 874);
      await expect.poll(() => window.innerWidth).toBe(402);
      await screen.findByRole("button", { name: "Activity" }, LIVE);
      await drawn();

      expect(Math.abs(paragraph.getBoundingClientRect().top - top)).toBeLessThan(2);
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

describe("on the desktop, the column across 768 px", () => {
  atSize("desktop");

  test("the column turns into the status line's parts across 768 px, at the same position", async () => {
    try {
      await agent.addPlan(CLI);
      await show(`/f/${CLI}/session`, "CLI TUIs");
      await startTurn("Plan the CLI.", lines(60, "Line"));
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Line 60.", undefined, LIVE);
      await screen.findByRole("complementary", { name: COLUMN }, LIVE);
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
      await screen.findByRole("button", { name: "Activity" }, LIVE);
      expect(screen.queryByRole("dialog", { name: "Activity" })).toBeNull();
      expect(screen.queryByRole("complementary", { name: COLUMN })).toBeNull();
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
      await screen.findByRole("complementary", { name: COLUMN }, LIVE);
      expect(screen.queryByRole("button", { name: "Activity" })).toBeNull();
      await drawn();
      expect(log.isConnected).toBe(true);
      expect(Math.abs(readNarrow.getBoundingClientRect().top - topNarrow)).toBeLessThan(2);
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

// Review focus 2: crossing 1280 px changes the shell only. The navigation narrows to its rail and
// widens back, and the session keeps the line the human reads, or keeps following its end.
describe("at semi-wide, across 1280 px", () => {
  atSize("semi");

  test("a session scrolled mid-way keeps the line read across 1280 px and back", async () => {
    try {
      await show(`/f/${CLI}/session`, "CLI TUIs");
      await startTurn("Plan the CLI.", lines(80, "Line"));
      const log = await screen.findByRole("log", { name: "Conversation" }, LIVE);
      await within(log).findByText("Line 80.", undefined, LIVE);
      await drawn();
      const box = scroller();
      box.scrollTo(0, Math.round((box.scrollHeight - box.clientHeight) / 2));
      await drawn();
      expect(box.scrollTop).toBeGreaterThan(0);
      const read = readLine(log);
      const top = read.getBoundingClientRect().top;

      await page.viewport(1440, 900);
      await expect.poll(() => window.innerWidth).toBe(1440);
      await drawn();
      await drawn();
      expect(log.isConnected).toBe(true);
      expect(readLine(log)).toBe(read);
      expect(Math.abs(read.getBoundingClientRect().top - top)).toBeLessThan(2);

      await page.viewport(1205, 900);
      await expect.poll(() => window.innerWidth).toBe(1205);
      await drawn();
      await drawn();
      expect(readLine(log)).toBe(read);
      expect(Math.abs(read.getBoundingClientRect().top - top)).toBeLessThan(2);
    } finally {
      await page.viewport(1205, 900);
    }
  });

  test("a session following its end keeps following across 1280 px and back", async () => {
    try {
      const log = await openWorkingSession();
      const box = scroller();
      box.scrollTo(0, box.scrollHeight);
      await drawn();
      expect(screen.queryByRole("button", { name: JUMP })).toBeNull();

      await page.viewport(1440, 900);
      await expect.poll(() => window.innerWidth).toBe(1440);
      await drawn();
      await agent.agentEmit(lines(20, "Wide line"));
      const wide = await within(log).findByText("Wide line 20.", undefined, LIVE);
      await expect.poll(() => inView(wide), LIVE).toBe(true);

      await page.viewport(1205, 900);
      await expect.poll(() => window.innerWidth).toBe(1205);
      await drawn();
      await agent.agentEmit(lines(20, "Semi line"));
      const semi = await within(log).findByText("Semi line 20.", undefined, LIVE);
      await expect.poll(() => inView(semi), LIVE).toBe(true);
      await drawn();
      expect(inView(semi)).toBe(true);
      expect(screen.queryByRole("button", { name: JUMP })).toBeNull();
    } finally {
      await page.viewport(1205, 900);
    }
  });
});
