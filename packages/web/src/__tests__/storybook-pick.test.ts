// US2: the pick script in a frame of its own, as the spec's messages describe it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserWindow, type HTMLElement as FrameElement, Window } from "happy-dom";
import { afterEach, expect, test } from "vite-plus/test";

const script = readFileSync(
  join(import.meta.dirname, "../../../../skills/uraeda/assets/storybook/uraeda-pick.js"),
  "utf8",
);

/** The windows each test opened, closed after it. */
const opened: Array<Window> = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((window) => window.happyDOM.close()));
});

/**
 * A frame showing `html` with the pick script loaded, in a page of its own: what it posts to its
 * parent is recorded, and messages reach it from its parent or from another window. `before` runs
 * on the frame's document before the script loads.
 */
async function pickFrame(html: string, before?: (document: BrowserWindow["document"]) => void) {
  const page = new Window({
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
    url: "http://127.0.0.1:4310/",
  });
  opened.push(page);
  const posted: Array<unknown> = [];
  Object.assign(page, { postMessage: (data: unknown) => posted.push(data) });
  const iframe = page.document.createElement("iframe");
  iframe.srcdoc = html;
  page.document.body.append(iframe);
  await page.happyDOM.waitUntilComplete();
  const frame = iframe.contentWindow as BrowserWindow;
  before?.(frame.document);
  const tag = frame.document.createElement("script");
  tag.textContent = script;
  frame.document.head.append(tag);

  return {
    click: (selector: string) => (frame.document.querySelector(selector) as FrameElement).click(),
    dispatch: (selector: string, type: string) =>
      frame.document
        .querySelector(selector)!
        .dispatchEvent(new frame.Event(type, { bubbles: true, cancelable: true })),
    document: frame.document,
    key: (key: string) =>
      frame.document.dispatchEvent(new frame.KeyboardEvent("keydown", { bubbles: true, key })),
    posted: () => posted,
    send: (data: unknown, source: unknown = page) =>
      frame.dispatchEvent(new frame.MessageEvent("message", { data, source: source as never })),
    text: () => frame.document.body.textContent ?? "",
  };
}

/** A stand-in for `getBoundingClientRect`, of `height` alone: happy-dom lays nothing out. */
function boxOf(height: number) {
  return () => ({ height }) as never;
}

/** Counts the clicks that reach the story's button, in its paragraph. */
function countClicks(frame: Awaited<ReturnType<typeof pickFrame>>) {
  let clicks = 0;
  frame.document.querySelector("button")!.addEventListener("click", () => {
    clicks += 1;
    frame.document.querySelector("p")!.textContent = `Clicked ${clicks} times`;
  });
}

test("it says it is ready, and its height", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button>");

  expect(frame.posted()).toContainEqual({ uraeda: "ready" });
  expect(frame.posted()).toContainEqual({ height: expect.any(Number), uraeda: "size" });
});

test("pick mode reports the clicked element's role and name, and ends", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);

  frame.send({ on: true, uraeda: "pick" });
  frame.click("button");

  expect(frame.posted()).toContainEqual({
    name: "Hide the sidebar",
    role: "button",
    text: "Hide the sidebar",
    uraeda: "picked",
  });
  expect(frame.text()).toContain("Clicked 0 times");
  frame.click("button");
  expect(frame.text()).toContain("Clicked 1 times");
});

test("a click inside a link picks the link", async () => {
  const frame = await pickFrame('<a href="/docs" aria-label="Read the docs"><span>Docs</span></a>');

  frame.send({ on: true, uraeda: "pick" });
  frame.click("span");

  expect(frame.posted()).toContainEqual({
    name: "Read the docs",
    role: "link",
    text: "Docs",
    uraeda: "picked",
  });
});

test("a separator has its role and no name", async () => {
  const frame = await pickFrame('<div role="separator" aria-orientation="vertical"></div>');

  frame.send({ on: true, uraeda: "pick" });
  frame.click("div");

  expect(frame.posted()).toContainEqual({
    name: "",
    role: "separator",
    text: "",
    uraeda: "picked",
  });
});

test("Escape ends pick mode and says so", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);

  frame.send({ on: true, uraeda: "pick" });
  frame.key("Escape");
  frame.click("button");

  expect(frame.posted()).toContainEqual({ uraeda: "pick-stopped" });
  expect(frame.posted()).not.toContainEqual(expect.objectContaining({ uraeda: "picked" }));
  expect(frame.text()).toContain("Clicked 1 times");
});

test("pick mode turned off from the page ends without a word", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);

  frame.send({ on: true, uraeda: "pick" });
  frame.send({ on: false, uraeda: "pick" });
  frame.click("button");

  expect(frame.posted()).not.toContainEqual({ uraeda: "pick-stopped" });
  expect(frame.text()).toContain("Clicked 1 times");
});

test("a message from another window than its parent is ignored", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);
  const stranger = new Window();
  opened.push(stranger);

  frame.send({ on: true, uraeda: "pick" }, stranger);
  frame.click("button");

  expect(frame.posted()).not.toContainEqual(expect.objectContaining({ uraeda: "picked" }));
  expect(frame.text()).toContain("Clicked 1 times");
});

test("its height is the story's, not the centered layout's full page", async () => {
  const frame = await pickFrame(
    '<body style="margin: 0; padding: 16px"><div id="storybook-root"><button>Hide</button></div></body>',
    (document) => {
      document.body.getBoundingClientRect = boxOf(900);
      document.querySelector("#storybook-root")!.getBoundingClientRect = boxOf(120);
    },
  );

  expect(frame.posted()).toContainEqual({ height: 152, uraeda: "size" });
});

test("a click inside a dialog picks what it hits, not the dialog", async () => {
  const frame = await pickFrame(
    '<div role="dialog" aria-label="Settings"><p>Sidebar width</p></div>',
  );

  frame.send({ on: true, uraeda: "pick" });
  frame.click("p");

  expect(frame.posted()).toContainEqual({
    name: "",
    role: "paragraph",
    text: "Sidebar width",
    uraeda: "picked",
  });
});

test("a touch reaches no story's handler in pick mode", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Touched 0 times</p>");
  let touches = 0;
  for (const type of ["touchstart", "touchmove", "touchend", "contextmenu"]) {
    frame.document.querySelector("button")!.addEventListener(type, () => {
      touches += 1;
    });
  }

  frame.send({ on: true, uraeda: "pick" });
  frame.dispatch("button", "touchstart");
  frame.dispatch("button", "touchmove");
  const tapClicks = frame.dispatch("button", "touchend");
  const menu = frame.dispatch("button", "contextmenu");

  expect(touches).toBe(0);
  expect(tapClicks).toBe(true);
  expect(menu).toBe(false);
});

test.each([
  [
    "a label pointing at nothing gives way to the text",
    '<button aria-labelledby="missing">Save</button>',
    "button",
    { name: "Save", role: "button", text: "Save" },
  ],
  [
    "a label clicked picks its control",
    '<label for="q">Search tasks</label><input id="q" type="search">',
    "label",
    { name: "Search tasks", role: "searchbox", text: "" },
  ],
  [
    "a text box without a label is named by its placeholder",
    '<input placeholder="Filter by tag">',
    "input",
    { name: "Filter by tag", role: "textbox", text: "" },
  ],
])("%s", async (_, html, selector, picked) => {
  const frame = await pickFrame(html);

  frame.send({ on: true, uraeda: "pick" });
  frame.click(selector);

  expect(frame.posted()).toContainEqual({ ...picked, uraeda: "picked" });
});
