// The UI checks decision, at a phone's size and a desktop's, in light and dark: on every page a UI
// decision governs, no text is cut and nothing scrolls sideways (SC-003), paragraphs are 17 px on
// the phone and 19 px from 1024 px (SC-004), every control is 44 px tall under a touch pointer
// (SC-004), no line of a paragraph runs past about 125 characters, text is left-aligned,
// and axe-core finds no WCAG 2.1 A or AA violation (SC-003). On the phone, questions, options,
// stories, and scenarios start within 50 px of the screen's left edge. A change of width keeps
// what is being typed (US7 2) and the task view's address (the edge case on crossing 768 px). The
// session view, the chat view, and the sidebar pass the same checks (SC-004 of chat in the web UI).
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import {
  agent,
  checkAccessibility,
  checkAlignment,
  checkControlHeights,
  checkInsets,
  checkLayout,
  checkMeasure,
  checkPage,
  checkTextSizes,
  LIVE,
  sendMessage,
  settle,
  show,
  startTurn,
} from "./helpers.tsx";

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
  // Its agent panel offers "Start the agent": the test server's agent is the fake one.
  ["a feature waiting on an agent", "/f/2026-10-12-cli-tuis", "Start the agent", null],
  // A feature's session before its first message, and an empty chat.
  ["a feature's new session", "/f/2026-10-12-cli-tuis/session", "CLI TUIs", null],
  ["a new chat", "/chats/new", "New chat", null],
];

afterEach(() => {
  window.localStorage.removeItem("uraeda.theme");
});

const CASES = PAGES.flatMap(([name, path, text, insets]) =>
  (["light", "dark"] as const).map((mode) => ({ name, path, text, insets, mode })),
);

test.each(CASES)("$name, in $mode", async ({ path, text, insets, mode }) => {
  await checkCase(path, text, insets, mode);
});

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

test("a comment being typed keeps its text and focus when the window narrows (US7 2)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
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
  if (window.innerWidth < 768) {
    return;
  }
  try {
    await show("/", "Claude Code runner");
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: /Claude Code runner/ }));
    });
    await screen.findByRole("radio", { name: "Next", checked: true });
    // A pane beside home.
    expect(screen.getByRole("link", { name: /Git listener process/ })).toBeTruthy();

    await page.viewport(700, 900);
    await expect.poll(() => window.innerWidth).toBe(700);
    // A page of its own, at the same address.
    await expect
      .poll(() => screen.queryByRole("link", { name: /Git listener process/ }))
      .toBeNull();
    expect(screen.getByRole("radio", { name: "Next", checked: true })).toBeTruthy();
    expect(window.location.pathname).toBe(TASK);

    await page.viewport(1440, 900);
    await expect.poll(() => window.innerWidth).toBe(1440);
    // A pane again.
    expect(await screen.findByRole("link", { name: /Git listener process/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Next", checked: true })).toBeTruthy();
    expect(window.location.pathname).toBe(TASK);
  } finally {
    await page.viewport(1440, 900);
  }
});

test("the folded navigation keeps ＋ and a link home (US6 4, 5)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  try {
    await show("/priorities", "Claude Code runner");
    // Folding draws the navigation anew: it is found again each time.
    const nav = () => screen.getByRole("navigation", { name: "Side navigation" });
    await userEvent.click(within(nav()).getByRole("button", { name: "Collapse sidebar" }));
    await expect
      .poll(() => within(nav()).queryByRole("button", { name: "Expand sidebar" }))
      .toBeTruthy();

    expect(within(nav()).getByRole("button", { name: "Add a priority" })).toBeTruthy();
    await userEvent.click(within(nav()).getByRole("link", { name: "Uraeda" }));
    await expect.poll(() => window.location.pathname).toBe("/");

    await userEvent.click(within(nav()).getByRole("button", { name: "Expand sidebar" }));
    // Unfolded: the heading again, "Uraeda" with the repository's name, and ＋ beside it.
    await expect.poll(() => within(nav()).queryByRole("link", { name: /^Uraeda \S/ })).toBeTruthy();
    expect(within(nav()).getByRole("button", { name: "Add a priority" })).toBeTruthy();
  } finally {
    // The navigation's state is kept in the browser: the next tests start unfolded.
    for (const key of Object.keys(window.localStorage)) {
      if (key.includes("uraeda.nav")) {
        window.localStorage.removeItem(key);
      }
    }
  }
});

// The agents decision: the tests `vp run ready` runs use the fake adapter, never Claude Code.
test("the test server runs the fake agent", async () => {
  const response = await fetch("/fate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      version: 1,
      operations: [{ id: "1", kind: "byId", type: "Agent", ids: ["agent"], select: ["version"] }],
    }),
  });
  const { results } = (await response.json()) as { results: Array<{ data: Array<unknown> }> };
  expect(results[0].data).toEqual([{ id: "agent", version: "0.0.0 (fake agent)" }]);
});

const LONG =
  "specs/2026-10-12-claude-code-runner-triggered-manually-https-code/clarifications-01.md";
const CLI = "2026-10-12-cli-tuis";

/** A turn's lines with long paths and commands, as a session shows them. */
const LONG_TURN = [
  {
    type: "text" as const,
    text: `Reading **the answers** of round 01 in \`${LONG}\`, then the spec.`,
  },
  {
    type: "toolStart" as const,
    id: "a",
    name: "Read",
    kind: "read" as const,
    input: { file_path: LONG },
    target: LONG,
  },
  { type: "toolEnd" as const, id: "a", isError: false, output: `# ${LONG}` },
  {
    type: "toolStart" as const,
    id: "b",
    name: "Bash",
    kind: "execute" as const,
    input: { command: `ura check ${LONG} && vp run ready` },
    target: `ura check ${LONG} && vp run ready`,
  },
  { type: "retry" as const, attempt: 1, delayMs: 30_000, error: "rate_limit" },
];

// A feature's session with long paths and commands, working, then failed with an action blocked,
// and the feature page's agent section beside it or on its own page: the same checks as the
// pages', in both themes.
test.each(
  (["working", "failed"] as const).flatMap((state) =>
    (["light", "dark"] as const).map((mode) => ({ state, mode })),
  ),
)("a feature's session, $state, and its agent section, in $mode", async ({ state, mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", LONG_TURN);
  await screen.findByText(/Rate limited/, undefined, LIVE);
  if (state === "failed") {
    await agent.agentEmit([
      {
        type: "result",
        ok: false,
        costUsd: 0.42,
        errors: ["The tests failed."],
        denials: [{ tool: "Bash", input: { command: `gh pr create --draft --title "${LONG}"` } }],
        interrupted: false,
      },
    ]);
    await screen.findByRole("button", { name: "Allow and retry" }, LIVE);
  }
  await settle();
  await checkLayout();
  // The feature page's agent section: beside the session on a wide screen, a page on the phone.
  if (window.innerWidth < 768) {
    await show(`/f/${CLI}`, "Open the session");
    await screen.findAllByText(state === "working" ? "Working" : /Failed/, undefined, LIVE);
    await checkLayout();
  }
});

/** Starts a chat with a turn whose action auto mode blocked. */
async function blockedChat() {
  await show("/chats/new", "New chat");
  await sendMessage("Tag v0.3.0 and push the tag.");
  // At once: a reply that ends the turn before the new chat's view listens still shows.
  await agent.agentAccept();
  await agent.agentEmit([
    {
      type: "toolStart",
      id: "a",
      name: "Bash",
      kind: "execute",
      input: { command: "git tag v0.3.0" },
      target: "git tag v0.3.0",
    },
    { type: "toolEnd", id: "a", isError: false, output: "" },
    { type: "text", text: "I created the tag `v0.3.0`, but pushing it was blocked." },
    {
      type: "result",
      ok: true,
      costUsd: 0.31,
      errors: [],
      denials: [{ tool: "Bash", input: { command: "git push origin v0.3.0" } }],
      interrupted: false,
    },
  ]);
  await expect.poll(() => window.location.pathname, LIVE).toMatch(/^\/chats\/(?!new)/);
  await screen.findByRole("button", { name: "Allow and retry" }, LIVE);
  await settle();
}

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
  await settle();
  // The phone's drawer, or the navigation beside the page.
  return search.closest("dialog") ?? search.closest("nav")!;
}

test.each(
  ["CLI", "zzz", ""].flatMap((query) =>
    (["light", "dark"] as const).map((mode) => ({ query, mode })),
  ),
)("the sidebar with sessions, searched for “$query”, in $mode", async ({ query, mode }) => {
  window.localStorage.setItem("uraeda.theme", mode);
  // A chat, then a feature's session with a sub-agent at work.
  await blockedChat();
  await show(`/f/${CLI}/session`, "CLI TUIs");
  await startTurn("Plan the CLI.", [
    {
      type: "toolStart",
      id: "task",
      name: "Task",
      kind: "other",
      input: {},
      subagent: { description: "Map the runner code" },
    },
  ]);
  const nav = await navigation();
  await within(nav as HTMLElement).findByText("Map the runner code", undefined, LIVE);
  if (query) {
    await userEvent.fill(within(nav as HTMLElement).getByRole("searchbox"), query);
    await within(nav as HTMLElement).findByText(
      query === "zzz" ? "No session matches “zzz”." : "CLI TUIs",
      undefined,
      LIVE,
    );
    if (query !== "zzz") {
      await expect
        .poll(() => within(nav as HTMLElement).queryByRole("link", { name: /^Home/ }))
        .toBeNull();
    }
    await settle();
  }
  await checkLayout(nav);
});
