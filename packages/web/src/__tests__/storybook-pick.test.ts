// US2: the pick script in a frame of its own, as the spec's messages describe it; picks carry the
// element's source, none here, and its outer HTML (the UI sandbox's task 4).
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
    /** Takes the focus to an element, as a key on it needs. */
    focus: (selector: string) => (frame.document.querySelector(selector) as FrameElement).focus(),
    /** The window loses the focus, as it does when the human goes to another window. */
    blur: () => frame.dispatchEvent(new frame.Event("blur")),
    key: (key: string) =>
      frame.document.dispatchEvent(new frame.KeyboardEvent("keydown", { bubbles: true, key })),
    posted: () => posted,
    /**
     * A key event on an element, its `init` as `KeyboardEvent`'s; false when something stopped its
     * default, as the pick script does with a key it takes.
     */
    press: (
      selector: string,
      type: "keydown" | "keyup",
      key: string,
      init: { ctrlKey?: boolean; isComposing?: boolean; repeat?: boolean; shiftKey?: boolean } = {},
    ) =>
      frame.document
        .querySelector(selector)!
        .dispatchEvent(
          new frame.KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...init }),
        ),
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
    html: "<button>Hide the sidebar</button>",
    name: "Hide the sidebar",
    role: "button",
    source: null,
    text: "Hide the sidebar",
    uraeda: "picked",
  });
  expect(frame.text()).toContain("Clicked 0 times");
  frame.click("button");
  expect(frame.text()).toContain("Clicked 1 times");
});

test("a disabled button, which gets no click, is picked as the press ends", async () => {
  const frame = await pickFrame("<button disabled>Save</button>");

  frame.send({ on: true, uraeda: "pick" });
  frame.dispatch("button", "pointerdown");
  frame.dispatch("button", "pointerup");

  expect(frame.posted()).toContainEqual({
    html: '<button disabled="">Save</button>',
    name: "Save",
    role: "button",
    source: null,
    text: "Save",
    uraeda: "picked",
  });
});

test("a press picks once, and the click that follows it reaches no story", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);

  frame.send({ on: true, uraeda: "pick" });
  frame.dispatch("button", "pointerdown");
  frame.dispatch("button", "pointerup");
  const mouseUp = frame.dispatch("button", "mouseup");
  frame.click("button");

  const picked = frame.posted().filter((data) => (data as { uraeda: string }).uraeda === "picked");
  expect(picked).toHaveLength(1);
  expect(mouseUp).toBe(false);
  expect(frame.text()).toContain("Clicked 0 times");
  frame.click("button");
  expect(frame.text()).toContain("Clicked 1 times");
});

test("a tap picks as it ends, and its touch end and click reach no story", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);
  let touches = 0;
  frame.document.querySelector("button")!.addEventListener("touchend", () => {
    touches += 1;
  });

  frame.send({ on: true, uraeda: "pick" });
  frame.dispatch("button", "pointerdown");
  frame.dispatch("button", "touchstart");
  frame.dispatch("button", "pointerup");
  frame.dispatch("button", "touchend");
  frame.click("button");

  expect(frame.posted()).toContainEqual(expect.objectContaining({ uraeda: "picked" }));
  expect(touches).toBe(0);
  expect(frame.text()).toContain("Clicked 0 times");
});

test("a new press after a pick without a click reaches the story", async () => {
  const frame = await pickFrame("<button>Hide the sidebar</button><p>Clicked 0 times</p>");
  countClicks(frame);

  frame.send({ on: true, uraeda: "pick" });
  frame.dispatch("button", "pointerdown");
  frame.dispatch("button", "pointerup");
  const press = frame.dispatch("button", "pointerdown");
  frame.click("button");

  expect(press).toBe(true);
  expect(frame.text()).toContain("Clicked 1 times");
});

test("a click inside a link picks the link", async () => {
  const frame = await pickFrame('<a href="/docs" aria-label="Read the docs"><span>Docs</span></a>');

  frame.send({ on: true, uraeda: "pick" });
  frame.click("span");

  expect(frame.posted()).toContainEqual({
    html: '<a href="/docs" aria-label="Read the docs"><span>Docs</span></a>',
    name: "Read the docs",
    role: "link",
    source: null,
    text: "Docs",
    uraeda: "picked",
  });
});

test("a separator has its role and no name", async () => {
  const frame = await pickFrame('<div role="separator" aria-orientation="vertical"></div>');

  frame.send({ on: true, uraeda: "pick" });
  frame.click("div");

  expect(frame.posted()).toContainEqual({
    html: '<div role="separator" aria-orientation="vertical"></div>',
    name: "",
    role: "separator",
    source: null,
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
    html: "<p>Sidebar width</p>",
    name: "",
    role: "paragraph",
    source: null,
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
    {
      html: '<button aria-labelledby="missing">Save</button>',
      name: "Save",
      role: "button",
      source: null,
      text: "Save",
    },
  ],
  [
    "a label clicked picks its control",
    '<label for="q">Search tasks</label><input id="q" type="search">',
    "label",
    {
      html: '<input id="q" type="search">',
      name: "Search tasks",
      role: "searchbox",
      source: null,
      text: "",
    },
  ],
  [
    "a text box without a label is named by its placeholder",
    '<input placeholder="Filter by tag">',
    "input",
    {
      html: '<input placeholder="Filter by tag">',
      name: "Filter by tag",
      role: "textbox",
      source: null,
      text: "",
    },
  ],
])("%s", async (_, html, selector, picked) => {
  const frame = await pickFrame(html);

  frame.send({ on: true, uraeda: "pick" });
  frame.click(selector);

  expect(frame.posted()).toContainEqual({ ...picked, uraeda: "picked" });
});

/** The messages of a frame that say an element was picked. */
const picks = (frame: Awaited<ReturnType<typeof pickFrame>>) =>
  frame.posted().filter((data) => (data as { uraeda: string }).uraeda === "picked");

/** Counts the keys that reach the story's element: its keydown and keyup events, by key. */
function countKeys(frame: Awaited<ReturnType<typeof pickFrame>>, selector: string) {
  const reached: Array<string> = [];
  for (const type of ["keydown", "keyup"]) {
    frame.document.querySelector(selector)!.addEventListener(type, (event) => {
      reached.push(`${type} ${(event as unknown as KeyboardEvent).key}`);
    });
  }
  return reached;
}

test.each([
  ["Enter", "Enter", "textbox", "Title", '<input aria-label="Title">', "input"],
  ["Space", " ", "button", "Save", "<button>Save</button>", "button"],
])(
  "%s in pick mode picks the focused element, and the page gets no key",
  async (_, key, role, name, html, selector) => {
    const frame = await pickFrame(html);
    const reached = countKeys(frame, selector);
    frame.focus(selector);
    frame.send({ on: true, uraeda: "pick" });

    const taken = frame.press(selector, "keydown", key);

    expect(picks(frame)).toEqual([expect.objectContaining({ name, role, uraeda: "picked" })]);
    expect(taken).toBe(false);
    // The key up of the press is kept from the page too.
    frame.press(selector, "keyup", key);
    expect(reached).toEqual([]);
  },
);

test("Enter on a focused ignored element reaches it, and picks nothing", async () => {
  const frame = await pickFrame("<div data-uraeda-pick-ignore><button>Stop</button></div>");
  const reached = countKeys(frame, "button");
  frame.focus("button");
  frame.send({ on: true, uraeda: "pick" });

  const taken = frame.press("button", "keydown", "Enter");

  expect(taken).toBe(true);
  expect(reached).toEqual(["keydown Enter"]);
  expect(picks(frame)).toEqual([]);
});

test("Enter with nothing focused picks nothing, and leaves pick mode on", async () => {
  const frame = await pickFrame("<p>Marker</p>");
  frame.send({ on: true, uraeda: "pick" });

  frame.key("Enter");
  frame.click("p");

  expect(picks(frame)).toEqual([expect.objectContaining({ role: "paragraph", text: "Marker" })]);
});

test.each([
  ["Control", { ctrlKey: true }],
  ["Shift", { shiftKey: true }],
  ["composing text", { isComposing: true }],
])("Enter with %s picks nothing, and reaches the page", async (_, init) => {
  const frame = await pickFrame('<input aria-label="Title"><p>Marker</p>');
  const reached = countKeys(frame, "input");
  frame.focus("input");
  frame.send({ on: true, uraeda: "pick" });

  const taken = frame.press("input", "keydown", "Enter", init);

  expect(taken).toBe(true);
  expect(reached).toEqual(["keydown Enter"]);
  expect(picks(frame)).toEqual([]);
  // Pick mode is still on: a click picks.
  frame.click("p");
  expect(picks(frame)).toEqual([expect.objectContaining({ text: "Marker" })]);
});

test("the picking key's repeats, until its key up, do not reach the page", async () => {
  const frame = await pickFrame("<button>Save</button>");
  const reached = countKeys(frame, "button");
  frame.focus("button");
  frame.send({ on: true, uraeda: "pick" });

  frame.press("button", "keydown", " ");
  frame.press("button", "keydown", " ", { repeat: true });
  frame.press("button", "keyup", " ");
  expect(reached).toEqual([]);
  expect(picks(frame)).toHaveLength(1);

  // The press is over: the next one is the page's.
  frame.press("button", "keydown", " ");
  expect(reached).toEqual(["keydown  "]);
});

test("another key than the picking one is the page's, while its repeats are kept", async () => {
  const frame = await pickFrame("<button>Save</button>");
  const reached = countKeys(frame, "button");
  frame.focus("button");
  frame.send({ on: true, uraeda: "pick" });

  frame.press("button", "keydown", "Enter");
  frame.press("button", "keydown", "a");
  frame.press("button", "keyup", "Enter");

  expect(reached).toEqual(["keydown a"]);
});

test("once the window loses focus, the picking key's key up is the page's", async () => {
  const frame = await pickFrame('<button>Save</button><input aria-label="Title">');
  const reached = countKeys(frame, "input");
  frame.focus("button");
  frame.send({ on: true, uraeda: "pick" });

  // A Space pressed, then focus gone before its key up: the key up comes elsewhere, or never.
  frame.press("button", "keydown", " ");
  frame.blur();
  frame.focus("input");
  frame.press("input", "keyup", " ");

  expect(picks(frame)).toHaveLength(1);
  expect(reached).toEqual(["keyup  "]);
});

test("a pick's source is the nearest `data-insp-path` of the element or its parents", async () => {
  const frame = await pickFrame(
    '<div data-insp-path="a.tsx:1:1"><section data-insp-path="b.tsx:3:5"><p>Hi</p></section></div>',
  );

  frame.send({ on: true, uraeda: "pick" });
  frame.click("p");

  expect(frame.posted()).toContainEqual(
    expect.objectContaining({ html: "<p>Hi</p>", source: "b.tsx:3:5" }),
  );
});

test("an ignored element is not picked, and its click reaches it", async () => {
  const frame = await pickFrame("<div data-uraeda-pick-ignore><button>Stop</button></div><p>0</p>");
  let pressed = 0;
  frame.document.querySelector("button")!.addEventListener("click", () => {
    pressed += 1;
  });

  frame.send({ on: true, uraeda: "pick" });
  frame.click("button");

  expect(pressed).toBe(1);
  expect(picks(frame)).toEqual([]);
});

test("a pick's HTML is cut at 2000 characters", async () => {
  const frame = await pickFrame(`<p>${"word ".repeat(1000)}</p>`);

  frame.send({ on: true, uraeda: "pick" });
  frame.click("p");

  expect((picks(frame)[0] as { html: string }).html).toHaveLength(2000);
});

test("a pick's text is cut at 200 characters, ending with “…”", async () => {
  const frame = await pickFrame(`<p>${"a".repeat(250)}</p>`);

  frame.send({ on: true, uraeda: "pick" });
  frame.click("p");

  expect((picks(frame)[0] as { text: string }).text).toBe(`${"a".repeat(200)}…`);
});

test("a text of 200 characters is kept whole", async () => {
  const frame = await pickFrame(`<p>${"a".repeat(200)}</p>`);

  frame.send({ on: true, uraeda: "pick" });
  frame.click("p");

  expect((picks(frame)[0] as { text: string }).text).toBe("a".repeat(200));
});
