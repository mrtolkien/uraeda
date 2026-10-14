// The UI checks decision, at a phone's size and a desktop's, in light and dark: on every page a UI
// decision governs, no text is cut and nothing scrolls sideways (SC-003), paragraphs are 17 px on
// the phone and 19 px from 1024 px (SC-004), every control is 44 px tall under a touch pointer
// (SC-004), no line of a paragraph runs past about 110 characters, text is left-aligned,
// and axe-core finds no WCAG 2.1 A or AA violation (SC-003). On the phone, questions, options,
// stories, and scenarios start within 50 px of the screen's left edge. A change of width keeps
// what is being typed (US7 2) and the task view's address (the edge case on crossing 768 px). The
// session view, the chat view, and the sidebar pass the same checks (SC-004 of chat in the web UI).
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import {
  atRepo,
  agent,
  checkAccessibility,
  checkAlignment,
  checkControlHeights,
  checkInsets,
  checkLayout,
  checkMeasure,
  checkPage,
  checkTextSizes,
  drawn,
  LIVE,
  repository,
  sendMessage,
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

test("the folded navigation keeps ＋, Home, and the repository menu (US6 4, 5; US1)", async () => {
  if (window.innerWidth < 768) {
    return;
  }
  try {
    await show("/priorities", "Claude Code runner");
    await userEvent.click(within(nav()).getByRole("button", { name: "Collapse sidebar" }));
    await expect
      .poll(() => within(nav()).queryByRole("button", { name: "Expand sidebar" }))
      .toBeTruthy();

    expect(within(nav()).getByRole("button", { name: "Add a priority" })).toBeTruthy();
    // Folded, the heading's icon opens the menu.
    await userEvent.click(within(nav()).getByRole("button", { name: `Uraeda ${repository()}` }));
    const menu = await screen.findByRole("dialog", { name: "Repositories" });
    expect(within(menu).getByRole("list", { name: "Repositories" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
    await userEvent.click(within(nav()).getByRole("link", { name: "Home" }));
    await expect.poll(() => window.location.pathname).toBe(atRepo("/"));

    await userEvent.click(within(nav()).getByRole("button", { name: "Expand sidebar" }));
    // Unfolded: the heading again, "Uraeda" over the repository's name, and ＋ beside it.
    await expect
      .poll(() => within(nav()).queryByRole("button", { name: `Uraeda ${repository()}` }))
      .toBeTruthy();
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

// A feature's session with long paths and commands, working, then failed with an action blocked,
// and the feature page's agent section beside it or on its own page: the same checks as the
// pages', in both themes.
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
    await screen.findByRole("button", { name: "Allow and retry" }, LIVE);
  }
  await drawn();
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
    await drawn();
  }
  await checkLayout(nav);
});
