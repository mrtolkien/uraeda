// Flow: the pick script a story's frame runs, which lets the human point at an element of a story
// and comment on it. It tells the embedding page the element's role and name, ends after one pick
// without the story seeing the press, ends on Escape, and obeys only the page that embeds it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserWindow, type HTMLElement as FrameElement, Window } from "happy-dom";
import { afterEach, expect, test } from "vite-plus/test";

const script = readFileSync(
  join(import.meta.dirname, "../../../../skills/uraeda/assets/storybook/uraeda-pick.js"),
  "utf8",
);

const opened: Array<Window> = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((window) => window.happyDOM.close()));
});

/**
 * A story's frame showing `html` with the pick script loaded, inside a page whose messages are
 * recorded; messages reach the frame from its page, or from another window.
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
  const posted: Array<{ name?: string; role?: string; uraeda?: string }> = [];
  Object.assign(page, { postMessage: (data: unknown) => posted.push(data as never) });
  const iframe = page.document.createElement("iframe");
  iframe.srcdoc = html;
  page.document.body.append(iframe);
  await page.happyDOM.waitUntilComplete();
  const frame = iframe.contentWindow as BrowserWindow;
  const tag = frame.document.createElement("script");
  tag.textContent = script;
  frame.document.head.append(tag);
  // The story's own button, counting what reaches it.
  let reached = 0;
  frame.document.querySelector("button")?.addEventListener("click", () => (reached += 1));
  return {
    click: (selector: string) => (frame.document.querySelector(selector) as FrameElement).click(),
    key: (key: string) =>
      frame.document.dispatchEvent(new frame.KeyboardEvent("keydown", { bubbles: true, key })),
    picks: () => posted.filter((data) => data.uraeda === "picked"),
    posted: () => posted,
    reached: () => reached,
    send: (data: unknown, source: unknown = page) =>
      frame.dispatchEvent(new frame.MessageEvent("message", { data, source: source as never })),
  };
}

test("the frame tells its page it is ready", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button>");

  expect(frame.posted().some((data) => data.uraeda === "ready")).toBe(true);
});

test("a pick reports the element's role and name, ends, and the story never saw the press", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button>");

  frame.send({ on: true, uraeda: "pick" });
  frame.click("button");

  expect(frame.picks()).toEqual([
    expect.objectContaining({ name: "Hide the sidebar", role: "button" }),
  ]);
  expect(frame.reached()).toBe(0);
  // Pick mode ended: the next click is the story's own.
  frame.click("button");
  expect(frame.reached()).toBe(1);
  expect(frame.picks()).toHaveLength(1);
});

test("Escape ends pick mode, and the story gets its clicks back", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button>");

  frame.send({ on: true, uraeda: "pick" });
  frame.key("Escape");
  frame.click("button");

  expect(frame.picks()).toHaveLength(0);
  expect(frame.reached()).toBe(1);
});

test("a message from any window but the embedding page is ignored", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button>");

  frame.send({ on: true, uraeda: "pick" }, {});
  frame.click("button");

  expect(frame.picks()).toHaveLength(0);
  expect(frame.reached()).toBe(1);
});
