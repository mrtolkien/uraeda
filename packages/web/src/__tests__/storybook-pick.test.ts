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
 * parent is recorded, and messages reach it from its parent or from another window.
 */
async function pickFrame(html: string) {
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
  const tag = frame.document.createElement("script");
  tag.textContent = script;
  frame.document.head.append(tag);

  return {
    click: (selector: string) => (frame.document.querySelector(selector) as FrameElement).click(),
    document: frame.document,
    key: (key: string) =>
      frame.document.dispatchEvent(new frame.KeyboardEvent("keydown", { bubbles: true, key })),
    posted: () => posted,
    send: (data: unknown, source: unknown = page) =>
      frame.dispatchEvent(new frame.MessageEvent("message", { data, source: source as never })),
    text: () => frame.document.body.textContent ?? "",
  };
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
