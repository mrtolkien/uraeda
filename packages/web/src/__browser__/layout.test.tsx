// The UI checks decision, at a phone's size and a desktop's, in light and dark: on every page a UI
// decision governs, no text is cut and nothing scrolls sideways (SC-003), paragraphs are 17 px on
// the phone and 19 px from 1024 px (SC-004), every control is 44 px tall under a touch pointer
// (SC-004), no line of a paragraph runs past about 75 characters (US6 3), text is left-aligned,
// and axe-core finds no WCAG 2.1 A or AA violation (SC-003). On the phone, questions, options,
// stories, and scenarios start within 50 px of the screen's left edge. A change of width keeps
// what is being typed (US7 2) and the task view's address (the edge case on crossing 768 px).
import { AppShell } from "@astryxdesign/core/AppShell";
import { ChatMessageList } from "@astryxdesign/core/Chat";
import { Theme } from "@astryxdesign/core/theme";
import { VStack } from "@astryxdesign/core/VStack";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { Denials, RunReason, RunStatus } from "../AgentPanel.tsx";
import { Page } from "../layout/Page.tsx";
import { type RunEvent, RunEvents } from "../RunLog.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import {
  checkAccessibility,
  checkAlignment,
  checkControlHeights,
  checkInsets,
  checkMeasure,
  checkPage,
  checkTextSizes,
  show,
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
    await expect.poll(() => window.innerWidth).toBe(700);
    await new Promise((resolve) => setTimeout(resolve, 300));
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
      operations: [{ id: "1", kind: "byId", type: "Runner", ids: ["runner"], select: ["version"] }],
    }),
  });
  const { results } = (await response.json()) as { results: Array<{ data: Array<unknown> }> };
  expect(results[0].data).toEqual([{ id: "runner", version: "0.0.0 (fake agent)" }]);
});

const LONG =
  "specs/2026-10-12-claude-code-runner-triggered-manually-https-code/clarifications-01.md";

/** A run's panel, drawn from its records: the browser tests' server runs no agent. */
function Panel({ state, mode }: { state: "running" | "failed"; mode: "light" | "dark" }) {
  const run = {
    id: "1",
    folder: "2026-10-12-claude-code-runner-triggered-manually-https-code",
    trigger: "answers",
    step: "implementation",
    state,
    reason: state === "failed" ? `Claude Code exited with code 1: could not read ${LONG}` : null,
    costUsd: 12.5,
    startedAt: "2026-10-12T09:00:00.000Z",
    endedAt: state === "failed" ? "2026-10-12T10:05:00.000Z" : null,
    newSession: false,
    allowed: null,
    pages: 1,
    denials: [
      {
        seq: 5,
        tool: "Bash",
        target: `gh pr create --draft --title "${LONG}"`,
        rule: `Bash(gh pr create --draft --title "${LONG}")`,
      },
    ],
  };
  const events: Array<RunEvent> = [
    { seq: 0, kind: "system", text: "Started a new session: the previous one is gone." },
    {
      seq: 1,
      kind: "text",
      text: `Reading **the answers** of round 01 in \`${LONG}\`, then the spec.`,
    },
    {
      seq: 2,
      kind: "tool",
      id: "a",
      name: "Read",
      target: LONG,
      status: "complete",
      durationMs: 200,
    },
    {
      seq: 3,
      kind: "tool",
      id: "b",
      name: "Bash",
      target: `ura check ${LONG} && vp run ready`,
      status: "running",
    },
    { seq: 4, kind: "system", text: "Rate limited, retrying in 30 s." },
    { seq: 5, kind: "denial", tool: "Bash", target: "gh pr create --draft", rule: "" },
  ];
  return (
    <Theme theme={uraedaTheme} mode={mode}>
      {/* The shell paints the theme's background, as in the app. */}
      <AppShell height="auto" contentPadding={0}>
        <Page>
          <VStack as="section" gap={3} aria-label="Agent">
            <RunStatus run={run as never} waitsOnHuman={false} />
            {run.reason && <RunReason reason={run.reason} />}
            <Denials denials={run.denials} onAllow={async () => {}} />
            <ChatMessageList align="top" density="compact" aria-label="Run log">
              <RunEvents events={events} />
            </ChatMessageList>
          </VStack>
        </Page>
      </AppShell>
    </Theme>
  );
}

// The agent panel's states with long paths and commands, which a feature's page shows only once an
// agent has run: the same checks as the pages', in both themes.
test.each(
  (["running", "failed"] as const).flatMap((state) =>
    (["light", "dark"] as const).map((mode) => ({ state, mode })),
  ),
)("the agent panel, $state, in $mode", async ({ state, mode }) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    root.render(<Panel state={state} mode={mode} />);
    await expect
      .poll(() => document.body.textContent?.includes("Rate limited"), { timeout: 15_000 })
      .toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    checkPage();
    checkControlHeights();
    checkTextSizes();
    checkMeasure();
    checkAlignment();
    await checkAccessibility();
  } finally {
    root.unmount();
    container.remove();
  }
});
