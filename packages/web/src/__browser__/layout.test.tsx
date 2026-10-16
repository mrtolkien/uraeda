// The UI checks decision, at a phone's size and a desktop's, in light and dark: on every page a UI
// decision governs, no text is cut and nothing scrolls sideways (SC-003), paragraphs are 17 px on
// the phone and 19 px from 1024 px (SC-004), every control is 44 px tall under a touch pointer
// (SC-004), no line of a paragraph runs past about 110 characters, text is left-aligned,
// and axe-core finds no WCAG 2.1 A or AA violation (SC-003). On the phone, questions, options,
// stories, and scenarios start within 50 px of the screen's left edge. A change of width keeps
// what is being typed (US7 2) and the task view's address (the edge case on crossing 768 px). The
// session view, the chat view, and the sidebar pass the same checks (SC-004 of chat in the web UI).
// So do the views images were added to (SC-005 of image attachments): the editor with an image's
// link, a refusal, and the drop hint, its preview and a proposal with the image, the lightbox, the
// composer's thumbnails and a message's images, a review comment and a round's answer with a link.
// The views text inputs changed pass them too: a round with a comment under a settled point and the
// form of another open, the notes restored with their notice, and the "Leave page?" and "Discard
// your comment?" confirmations. So do a feature's session at its implementation, its column shown
// and hidden, the phone's progress line open, and a chat, the transcript 760 px wide beside the
// column at 1440 px (SC-001, SC-004 of the session view), and at 1024 px with the sidebar open (its
// edge case). So do a spec with a story embedded, ready, a round whose options are stories, and the
// Storybook page (the UI iteration flow's UI checks). So do the sign-in screen, empty and with its
// error, and the repository menu's sign-out list and its confirmation, in `sign-in.test.tsx`.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, page, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  atSize,
  agent,
  attached,
  checkAccessibility,
  checkAlignment,
  checkControlHeights,
  checkInsets,
  checkLayout,
  checkMeasure,
  checkPage,
  checkTextSizes,
  dragEnd,
  dragOver,
  drawn,
  drop,
  grown,
  image,
  LIVE,
  paste,
  reload,
  repository,
  sendMessage,
  show,
  startTurn,
} from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";
const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const TASK = "/priorities/claude-code-runner-triggered-manually";

const PAGES: Array<[name: string, path: string, text: string, insets: string | null]> = [
  ["home", "/", "Waiting on you", null],
  [
    "a round of questions",
    ROUND,
    "How does your iPhone reach the server?",
    // Question titles, and the options' text.
    '[role="main"] section h2, [role="main"] section [aria-pressed]',
  ],
  [
    "a spec under review",
    SPEC,
    "Complete a repeating task",
    // Story titles, paragraphs, and the items of numbered lists, like scenarios.
    '[role="main"] h3, [role="main"] p, [role="main"] ol:not(nav ol) > li',
  ],
  ["a plan under review", "/f/2026-10-13-plan-review/plan.md", "Task 5", null],
  ["a task view", TASK, "Claude Code runner", null],
  ["the priorities", "/priorities", "Git listener process", null],
  // Its agent panel offers "Review and start the agent": the test server's agent is the fake one.
  ["a feature waiting on an agent", "/f/2026-10-12-cli-tuis", "Review and start the agent", null],
  // A feature's session before its first message, and an empty chat.
  ["a feature's new session", "/f/2026-10-12-cli-tuis/session", "CLI TUIs", null],
  ["a new chat", "/chats/new", "New chat", null],
];

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

const CASES = PAGES.flatMap(([name, path, text, insets]) =>
  (["light", "dark"] as const).map((mode) => ({ insets, mode, name, path, text })),
);

/** The side navigation. Folding draws it anew: it is found again each time. */
const nav = () => screen.getByRole("navigation", { name: "Side navigation" });

test.each(CASES)("$name, in $mode", async ({ insets, mode, path, text }) => {
  await checkCase(path, text, insets, mode);
});

/**
 * Opens a spec's folds, its stories' scenarios and its Details, so the checks reach what they hold:
 * the scenarios' insets among them. Their triggers are controls, measured with the others.
 */
async function openFolds() {
  const closed = screen
    .queryAllByRole("button", { name: /^(Scenarios \(\d+\)|Details)$/ })
    .filter((trigger) => trigger.getAttribute("aria-expanded") === "false");
  for (const trigger of closed) {
    await userEvent.click(trigger);
  }
  await drawn();
}

async function checkCase(
  path: string,
  text: string,
  insets: string | null,
  mode: "light" | "dark",
) {
  window.localStorage.setItem("uraeda.theme", mode);
  await show(path, text);
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  if (window.innerWidth < 768) {
    // The phone instance has a touch screen.
    expect(window.matchMedia("(pointer: coarse)").matches).toBe(true);
  }
  await openFolds();
  checkPage();
  checkTextSizes();
  checkControlHeights();
  checkMeasure();
  checkAlignment();
  if (insets) {
    checkInsets(insets);
  }
  await checkAccessibility();
}

describe("on the desktop", () => {
  atSize("desktop");

  test("a comment being typed keeps its text and focus when the window narrows (US7 2)", async () => {
    await page.viewport(800, 900);
    try {
      await show(ROUND, "How does your iPhone reach the server?");
      const field = screen.getAllByRole("textbox", { name: "Comment" })[2] as HTMLTextAreaElement;
      await userEvent.click(field);
      await userEvent.keyboard("Only from home");
      await page.viewport(700, 900);
      // The narrow layout is drawn: the round's index leaves its column for the bar.
      await expect.poll(() => screen.queryByRole("navigation", { name: "Questions" })).toBeNull();
      expect(field.isConnected).toBe(true);
      expect(field.value).toBe("Only from home");
      expect(document.activeElement).toBe(field);
    } finally {
      await page.viewport(1440, 900);
    }
  });

  test("a task view keeps its address as the window crosses 768 px", async () => {
    try {
      await show("/", "Claude Code runner");
      await act(async () => {
        fireEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
      });
      await screen.findByRole("radio", { checked: true, name: "Next" });
      // A pane beside home.
      expect(screen.getByRole("link", { name: /Git listener process/ })).toBeTruthy();

      await page.viewport(700, 900);
      await expect.poll(() => window.innerWidth).toBe(700);
      // A page of its own, at the same address.
      await expect
        .poll(() => screen.queryByRole("link", { name: /Git listener process/ }))
        .toBeNull();
      expect(screen.getByRole("radio", { checked: true, name: "Next" })).toBeTruthy();
      expect(window.location.pathname).toBe(atRepo(TASK));

      await page.viewport(1440, 900);
      await expect.poll(() => window.innerWidth).toBe(1440);
      // A pane again.
      expect(await screen.findByRole("link", { name: /Git listener process/ })).toBeTruthy();
      expect(screen.getByRole("radio", { checked: true, name: "Next" })).toBeTruthy();
      expect(window.location.pathname).toBe(atRepo(TASK));
    } finally {
      await page.viewport(1440, 900);
    }
  });

  // The inbox's spec: the sidebar's ＋ buttons show only while it is unfolded.
  test("the folded navigation keeps Home and the repository menu, its ＋ unfolded (US6 4; US1)", async () => {
    try {
      await show("/priorities", "Claude Code runner");
      await userEvent.click(within(nav()).getByRole("button", { name: "Collapse sidebar" }));
      await expect
        .poll(() => within(nav()).queryByRole("button", { name: "Expand sidebar" }))
        .toBeTruthy();

      expect(within(nav()).queryByRole("button", { name: "Add to the priorities" })).toBeNull();
      // Folded, the heading's icon opens the menu.
      await userEvent.click(within(nav()).getByRole("button", { name: `Uraeda ${repository()}` }));
      const menu = await screen.findByRole("dialog", { name: "Repositories" });
      expect(within(menu).getByRole("list", { name: "Repositories" })).toBeTruthy();
      await userEvent.keyboard("{Escape}");
      await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
      await userEvent.click(within(nav()).getByRole("link", { name: "Home" }));
      await expect.poll(() => window.location.pathname).toBe(atRepo("/"));

      await userEvent.click(within(nav()).getByRole("button", { name: "Expand sidebar" }));
      // Unfolded: the heading again, "Uraeda" over the repository's name, and the ＋ buttons.
      await expect
        .poll(() => within(nav()).queryByRole("button", { name: `Uraeda ${repository()}` }))
        .toBeTruthy();
      expect(within(nav()).getByRole("button", { name: "Add to the priorities" })).toBeTruthy();
      expect(within(nav()).getByRole("button", { name: "Add a note to the inbox" })).toBeTruthy();
    } finally {
      // The navigation's state is kept in the browser: the next tests start unfolded.
      for (const key of Object.keys(window.localStorage)) {
        if (key.includes("uraeda.nav")) {
          window.localStorage.removeItem(key);
        }
      }
    }
  });
});

// The agents decision: the tests `vp run ready` runs use the fake adapter, never Claude Code. Both
// sizes' servers come from the same config, so one size checks it.
describe("on the phone", () => {
  atSize("phone");

  test("the test server runs the fake agent", async () => {
    const response = await fetch("/fate", {
      body: JSON.stringify({
        operations: [{ id: "1", ids: ["agent"], kind: "byId", select: ["version"], type: "Agent" }],
        version: 1,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const { results } = (await response.json()) as { results: Array<{ data: Array<unknown> }> };
    expect(results[0].data).toEqual([{ id: "agent", version: "0.0.0 (fake agent)" }]);
  });
});

const LONG =
  "specs/2026-10-12-claude-code-runner-triggered-manually-https-code/clarifications-01.md";
const CLI = "2026-10-12-cli-tuis";

/** A turn's lines with long paths and commands, as a session shows them. */
const LONG_TURN = [
  {
    text: `Reading **the answers** of round 01 in \`${LONG}\`, then the spec.`,
    type: "text" as const,
  },
  {
    id: "a",
    input: { file_path: LONG },
    kind: "read" as const,
    name: "Read",
    target: LONG,
    type: "toolStart" as const,
  },
  { id: "a", isError: false, output: `# ${LONG}`, type: "toolEnd" as const },
  {
    id: "b",
    input: { command: `ura check ${LONG} && vp run ready` },
    kind: "execute" as const,
    name: "Bash",
    target: `ura check ${LONG} && vp run ready`,
    type: "toolStart" as const,
  },
  { attempt: 1, delayMs: 30_000, error: "rate_limit", type: "retry" as const },
];

/** The button of an action auto mode blocked, found again as the transcript draws it anew. */
const allowAndRetry = () =>
  screen.getByRole("button", { name: "Allow and retry" }) as HTMLButtonElement;

// A feature's session with long paths and commands, working, then failed with an action blocked,
// and the feature page's agent section: the same checks as the pages', in both themes.
test.each(
  (["working", "failed"] as const).flatMap((state) =>
    (["light", "dark"] as const).map((mode) => ({ mode, state })),
  ),
)("a feature's session, $state, and its agent section, in $mode", async ({ mode, state }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", LONG_TURN);
  await screen.findByText(/Rate limited/, undefined, LIVE);
  if (state === "failed") {
    await agent.agentEmit([
      {
        denials: [{ input: { command: `gh pr create --draft --title "${LONG}"` }, tool: "Bash" }],
        errors: ["The tests failed."],
        interrupted: false,
        ok: false,
        type: "result",
      },
    ]);
    // Disabled while the session still works, then enabled, fading from half its opacity: its
    // fade is drawn before the checks measure its contrast.
    await screen.findByRole("button", { name: "Allow and retry" }, LIVE);
    await expect.poll(() => allowAndRetry().disabled, LIVE).toBe(false);
  }
  await drawn();
  await checkLayout();
  // The feature page's agent section, on its own page.
  await show(`/f/${CLI}`, "Open the session");
  await screen.findAllByText(state === "working" ? "Working" : /Failed/, undefined, LIVE);
  await checkLayout();
});

/** The phone's progress line of `CLI` at Task 7 of 11. */
const LINE = "Implementation · 7/11 · Session column";

/**
 * The feature's session at its implementation, at Task 7 of 11, working on a turn with long paths:
 * its column drawn beside it on wide screens, its progress line above it on the phone.
 */
async function implementation(mode: "light" | "dark") {
  window.localStorage.setItem("uraeda.theme", mode);
  await agent.addPlan(CLI);
  // Files changed on the branch, their paths as long as a column's line.
  await agent.commitOnBranch(CLI, {
    "crates/core/src/files/plan.rs": "// The plan's tasks.\n",
    "packages/web/src/__browser__/layout.test.tsx": "// The layout checks.\n",
    "packages/web/src/SessionAside.tsx": "// The session's column.\n",
  });
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Carry on with Task 7.", LONG_TURN);
  await screen.findByText(/Rate limited/, undefined, LIVE);
  if (window.innerWidth >= 768) {
    const column = await screen.findByRole("complementary", { name: "Progress" }, LIVE);
    await within(column).findByText("Task 7 of 11", undefined, LIVE);
    await within(column).findByText("3 files · +3 −0", undefined, LIVE);
  } else {
    await screen.findByRole("button", { name: LINE }, LIVE);
  }
  await grown();
}

/** The checks on the page's main region, then on the column, which is beside it. */
async function checkSession() {
  await checkLayout();
  const column = screen.queryByRole("complementary", { name: "Progress" });
  if (column) {
    await checkLayout(column);
  }
}

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

// SC-001 and SC-004: a feature's session at its implementation, with its column shown.
test.each(MODES)(
  "a feature's session at its implementation, with its column, in $mode",
  async ({ mode }) => {
    await implementation(mode);
    await checkSession();
    if (window.innerWidth === 1440) {
      // SC-001: the sidebar at its default 240 px, the column shown, the transcript keeps 760 px.
      expect(screen.getByRole("complementary", { name: "Progress" })).toBeTruthy();
      const log = screen.getByRole("log", { name: "Conversation" });
      expect(log.getBoundingClientRect().width).toBeGreaterThanOrEqual(760);
    }
  },
);

describe("the session on the desktop", () => {
  atSize("desktop");

  // SC-004: the same session with its column hidden, on wide screens, where the column is.
  test.each(MODES)(
    "a feature's session at its implementation, with its column hidden, in $mode",
    async ({ mode }) => {
      await implementation(mode);
      await userEvent.click(screen.getByRole("button", { name: "Hide progress" }));
      await expect
        .poll(() => screen.queryByRole("complementary", { name: "Progress" }), LIVE)
        .toBeNull();
      await screen.findByRole("button", { name: "Show progress" });
      await drawn();
      await checkSession();
    },
  );

  // The edge case "From 768 to 1024 px with the sidebar open": the sidebar, the transcript, and the
  // column share the width, and nothing scrolls sideways.
  test("a session at 1024 px with the sidebar and the column open", async () => {
    try {
      await page.viewport(1024, 900);
      await expect.poll(() => window.innerWidth).toBe(1024);
      await implementation("light");
      expect(within(nav()).getByRole("button", { name: "Collapse sidebar" })).toBeTruthy();
      await checkSession();
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

describe("the session on the phone", () => {
  atSize("phone");

  // SC-004 on the phone: the progress line opened above the transcript.
  test.each(MODES)(
    "a feature's session at its implementation, its progress line open, in $mode",
    async ({ mode }) => {
      await implementation(mode);
      await userEvent.click(screen.getByRole("button", { name: LINE }));
      const open = await screen.findByRole("region", { name: "Progress" }, LIVE);
      await within(open).findByText("3 files · +3 −0", undefined, LIVE);
      await grown();
      await checkSession();
    },
  );
});

/** Starts a chat with a turn whose action auto mode blocked. */
async function blockedChat() {
  await show("/chats/new", "New chat");
  await sendMessage("Tag v0.3.0 and push the tag.");
  // At once: a reply that ends the turn before the new chat's view listens still shows.
  await agent.agentAccept();
  await agent.agentEmit([
    {
      id: "a",
      input: { command: "git tag v0.3.0" },
      kind: "execute",
      name: "Bash",
      target: "git tag v0.3.0",
      type: "toolStart",
    },
    { id: "a", isError: false, output: "", type: "toolEnd" },
    { text: "I created the tag `v0.3.0`, but pushing it was blocked.", type: "text" },
    {
      denials: [{ input: { command: "git push origin v0.3.0" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  await expect
    .poll(() => window.location.pathname, LIVE)
    .toMatch(new RegExp(`^${atRepo("/chats/")}(?!new)`));
  await screen.findByRole("button", { name: "Allow and retry" }, LIVE);
  await drawn();
}

// SC-004: a chat with one reply.
test.each(MODES)("a chat with one reply, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show("/chats/new", "New chat");
  await sendMessage("Why is CI slow on WebKit?");
  await agent.agentAccept();
  await agent.agentEmit([
    { text: "WebKit draws without a GPU on CI: its animations take longer.", type: "text" },
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  await expect
    .poll(() => window.location.pathname, LIVE)
    .toMatch(new RegExp(`^${atRepo("/chats/")}(?!new)`));
  await screen.findByText(/draws without a GPU/, undefined, LIVE);
  await expect.poll(() => screen.queryByRole("button", { name: "Stop" }), LIVE).toBeNull();
  await drawn();
  await checkLayout();
});

// A chat, a new chat, and the sidebar searched: the same checks, the sidebar's on its own region.
test.each((["light", "dark"] as const).map((mode) => ({ mode })))(
  "a chat with a blocked action, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await blockedChat();
    await checkLayout();
  },
);

/** Opens the navigation, the phone's from its menu, and gives its region. */
async function navigation() {
  if (window.innerWidth < 768) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  const search = await screen.findByRole("searchbox", { name: "Search sessions" });
  await drawn();
  // The phone's drawer, or the navigation beside the page.
  return search.closest("dialog") ?? search.closest("nav")!;
}

test.each(
  ["CLI", "zzz", ""].flatMap((query) =>
    (["light", "dark"] as const).map((mode) => ({ mode, query })),
  ),
)("the sidebar with sessions, searched for “$query”, in $mode", async ({ mode, query }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  // A chat, then a feature's session with a sub-agent at work.
  await blockedChat();
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    {
      fiveHour: { percentUsed: 43, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      type: "usage",
    },
    {
      id: "task",
      input: {},
      kind: "other",
      name: "Task",
      subagent: { description: "Map the runner code" },
      type: "toolStart",
    },
  ]);
  const nav = await navigation();
  await within(nav as HTMLElement).findByText("Map the runner code", undefined, LIVE);
  await within(nav as HTMLElement).findByText(/57% left · reset/, undefined, LIVE);
  if (query) {
    await userEvent.fill(within(nav as HTMLElement).getByRole("searchbox"), query);
    await within(nav as HTMLElement).findByText(
      query === "zzz" ? "No session matches “zzz”." : "cli-tuis",
      undefined,
      LIVE,
    );
    if (query !== "zzz") {
      await expect
        .poll(() => within(nav as HTMLElement).queryByRole("link", { name: /^Home/ }))
        .toBeNull();
    }
    await drawn();
  }
  await checkLayout(nav);
});

const DRAFT = "specs/drafts/login-banner/proposal.md";
const LEAD = "When the password is wrong, the banner covers the login button:";

/** A proposal's text with a screenshot under its first paragraph. */
const withImage = (title: string, link: string) =>
  `# ${title}\n\n## What\n\n${LEAD}\n\n${link}\n\n## Why\n\nUsers miss the button.\n`;

/** The login banner's draft, a folder holding a screenshot its text links. */
async function draftWithImage() {
  await commands.writeRepo(withImage("Login error banner", ""), DRAFT);
  const link = await attached(DRAFT, await image("desktop.png", "login.png"));
  await commands.writeRepo(withImage("Login error banner", link), DRAFT);
}

/** Waits for every image of the main region to load. */
async function imagesLoaded() {
  await expect
    .poll(
      () =>
        [...document.querySelectorAll<HTMLImageElement>('[role="main"] img')].every(
          (one) => one.complete && one.naturalWidth > 0,
        ),
      LIVE,
    )
    .toBe(true);
  await drawn();
}

test.each(MODES)("the editor's preview with an image, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await draftWithImage();
  try {
    await show(`/edit/${DRAFT}`, "Login error banner");
    await screen.findByRole("img", { name: "login" });
    await imagesLoaded();
    await checkLayout();
  } finally {
    // The editor of a draft the fixture lacks leaves before its repository goes.
    await show("/", "Priorities");
  }
});

test.each(MODES)(
  "the editor with an image's link, a refusal, and the drop hint, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await draftWithImage();
    try {
      await show(`/edit/${DRAFT}`, "Login error banner");
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      const field = screen.getByRole("textbox", { name: "Text" });
      drop([await image("drawing.svg", "diagram.svg")], field);
      await screen.findByText(/diagram\.svg is not one\./, undefined, LIVE);
      dragOver([await image("phone.png", "shot.png")], field);
      await screen.findByText("Drop to add to proposal.md", undefined, LIVE);
      await drawn();
      await checkLayout();
    } finally {
      dragEnd();
      await show("/", "Priorities");
    }
  },
);

const PROPOSAL = `specs/${CLI}/proposal.md`;

/** A feature's proposal with a screenshot, read on its page: written in its branch's worktree. */
async function proposalWithImage() {
  const link = await attached(PROPOSAL, await image("desktop.png", "login.png"));
  await commands.writeRepo(withImage("CLI TUIs", link), `.worktrees/${CLI}/${PROPOSAL}`);
  await show(`/f/${CLI}/proposal.md`, LEAD);
  await screen.findByRole("img", { name: "login" });
  await imagesLoaded();
}

test.each(MODES)("a spec with a story embedded, ready, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await commands.addStoryFeature();
  await show("/f/2026-10-20-sidebar-resize/spec.md", "Resize the sidebar");
  await expect
    .poll(() => commands.frameText("Dragging the handle, phone"), { timeout: 20_000 })
    .toContain("Dragging");
  await checkLayout();
});

test.each(MODES)("a round whose options are stories, ready, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await commands.addStoryFeature();
  await show(
    "/f/2026-10-20-sidebar-resize/clarifications-01.md",
    "What does the handle look like?",
  );
  for (const [label, name] of [
    ["Thin line", "ThinLine"],
    ["Grip", "Grip"],
  ]) {
    // An embed loads its frames once on screen.
    (await screen.findByRole("figure", { name: label })).scrollIntoView();
    await expect
      .poll(() => commands.frameText(`${label}, phone`), { timeout: 20_000 })
      .toContain(name);
  }
  await checkLayout();
});

test.each(MODES)("the Storybook page, ready, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await commands.addStoryFeature();
  await show("/f/2026-10-20-sidebar-resize/storybook", "Storybook");
  await expect
    .poll(() => commands.frameText("Storybook"), { timeout: 20_000 })
    .toContain("Dragging");
  await checkLayout();
});

test.each(MODES)("a proposal with an image, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await proposalWithImage();
  await checkLayout();
});

test.each(MODES)("an image open full screen, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await proposalWithImage();
  await userEvent.click(screen.getByRole("link", { name: "login" }));
  const lightbox = await screen.findByRole("dialog");
  await drawn();
  await checkLayout(lightbox);
});

/** Waits for the composer's two images to be saved, Send enabled. */
async function thumbnails() {
  await expect
    .poll(() => screen.queryAllByRole("button", { name: /^Remove / }).length, LIVE)
    .toBe(2);
  await expect
    .poll(() => screen.getByRole("button", { name: "Send" }).hasAttribute("disabled"), LIVE)
    .toBe(false);
}

test.each(MODES)(
  "the composer with two thumbnails, and a message with images, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show(`/f/${CLI}/session`, "Message Claude Code");
    const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
    paste([await image("phone.png", "image.png"), await image("desktop.png", "desktop.png")], box);
    await thumbnails();
    await userEvent.fill(box, "The login button overlaps the error banner on the phone.");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await agent.agentAccept();
    // The page draws a new view once the first message creates the session.
    await screen.findByRole("link", { name: "Image 2 of 2" }, LIVE);
    // Two more for the next message, beside the sent one, in the new view's composer.
    paste(
      [await image("phone.png", "image.png"), await image("desktop.png", "desktop.png")],
      await screen.findByRole("textbox", { name: "Message Claude Code" }),
    );
    await thumbnails();
    await imagesLoaded();
    await checkLayout();
  },
);

test.each(MODES)(
  "a review comment holding an image's link, with the drop hint, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show(SPEC, "Complete a repeating task");
    try {
      drop([await image("phone.png", "shot.png")]);
      const form = await screen.findByRole("form", { name: "Comment" });
      const field = within(form).getByRole("textbox", { name: "Comment text" });
      await expect.poll(() => (field as HTMLTextAreaElement).value, LIVE).toContain("(images/");
      dragOver([await image("phone.png", "shot.png")]);
      await within(form).findByText(/^Drop to add to/, undefined, LIVE);
      await drawn();
      await checkLayout();
    } finally {
      dragEnd();
    }
  },
);

test.each(MODES)("a round's answer holding an image's link, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show(ROUND, "How does your iPhone reach the server?");
  const field = within(document.getElementById("Q3")!).getByRole("textbox", { name: "Comment" });
  await userEvent.click(field);
  paste([await image("phone.png", "image.png")], field);
  await expect.poll(() => (field as HTMLTextAreaElement).value, LIVE).toContain("(images/");
  await screen.findByText(/^Added /, undefined, LIVE);
  await drawn();
  await checkLayout();
});

const QUESTION = "How does your iPhone reach the server?";
const COMMITS = "The actions' commits move into the core";
const ANSWER = "An answer is written";

/** A settled point of the round, by the bold subject its toggle's name starts with. */
const settledPoint = (subject: string) =>
  screen.findByRole("button", { name: new RegExp(`^${subject}`) });

/** The comment form open: under its point on a wide screen, in a sheet on the phone. */
async function settledForm() {
  return (await screen.findByRole("form", { name: "Comment" })) as HTMLElement;
}

/** The round, a comment added under its first settled point, and a form open with text under the second. */
async function settledComments() {
  await show(ROUND, QUESTION);
  await userEvent.click(await settledPoint(COMMITS), { force: true });
  let form = await settledForm();
  await userEvent.fill(
    within(form).getByLabelText("Comment text"),
    "Keep them in the core, but say so in the CLI's help.",
  );
  await userEvent.click(within(form).getByRole("button", { name: "Add comment" }));
  await screen.findByRole("group", { name: `Your comment on "${COMMITS}"` }, LIVE);
  // The phone's sheet gone, its history entry with it, before the next point is tapped.
  await expect.poll(() => screen.queryByRole("form", { name: "Comment" })).toBeNull();
  await drawn();
  await userEvent.click(await settledPoint(ANSWER), { force: true });
  form = await settledForm();
  await userEvent.fill(
    within(form).getByLabelText("Comment text"),
    "Keep the comment after the letters.",
  );
  await drawn();
  return form;
}

/** The overlay a form or a confirmation shows in on the phone, or the dialog on a wide screen. */
const overlayOf = (element: HTMLElement) => element.closest("dialog") ?? element;

test.each(MODES)(
  "a round with a settled point's comment and another's form open, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    const form = await settledComments();
    if (window.innerWidth < 768) {
      // The form in its sheet, then the page under it, once the sheet is closed.
      await checkLayout(overlayOf(form));
      await userEvent.click(within(overlayOf(form)).getByRole("button", { name: "Close" }));
      await expect.poll(() => screen.queryByRole("form", { name: "Comment" })).toBeNull();
      await drawn();
    }
    await checkLayout();
  },
);

test.each(MODES)(
  "the notes restored after a reload, with their notice, in $mode",
  async ({ mode }) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show(ROUND, QUESTION);
    await userEvent.fill(screen.getByLabelText("Notes"), "Overall fine, but say where answers go.");
    await reload(QUESTION);
    await screen.findByText(/^Unsaved text restored from \d\d:\d\d\./);
    screen.getByLabelText("Notes").scrollIntoView({ block: "center" });
    await drawn();
    await checkLayout();
  },
);

test.each(MODES)("the Leave page? confirmation, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show("/f/2026-10-11-web-ui", "Web UI for the workflow files");
  await act(async () => navigate(atRepo(ROUND)));
  await screen.findByText(QUESTION);
  const comment = within(document.getElementById("Q3")!).getAllByRole("textbox", {
    name: "Comment",
  })[0] as HTMLTextAreaElement;
  await userEvent.fill(comment, "Neither, keep it simple");
  window.history.back();
  const dialog = await screen.findByRole("dialog", { name: "Leave page?" });
  await drawn();
  await checkLayout(dialog);
});

test.each(MODES)("the Discard your comment? confirmation, in $mode", async ({ mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show(ROUND, QUESTION);
  await userEvent.click(await settledPoint(ANSWER), { force: true });
  const form = await settledForm();
  await userEvent.fill(
    within(form).getByLabelText("Comment text"),
    "Keep the comment after the letters.",
  );
  await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
  const dialog = await screen.findByRole("dialog", { name: "Discard your comment?" });
  await drawn();
  await checkLayout(dialog);
});
