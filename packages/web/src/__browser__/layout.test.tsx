// SC-007: on a 402 × 874 screen in WebKit, the pages cut no text, never scroll sideways, keep body
// text at 16 px or more, and start the text of questions, options, stories, and scenarios within
// 50 px of the screen's left edge.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "../styles.css";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { ChatMessageList } from "@astryxdesign/core/Chat";
import { createRoot, type Root } from "react-dom/client";
import { createFateClient } from "react-fate/client";
import { afterEach, expect, test } from "vite-plus/test";
import { Denials, RunStatus } from "../AgentPanel.tsx";
import { App } from "../App.tsx";
import { type RunEvent, RunEvents } from "../RunLog.tsx";

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  document.body.innerHTML = "";
});

/** Renders the UI at a path, against the test server's own `/fate`, and waits for a text. */
async function show(path: string, text: string) {
  window.history.replaceState(null, "", path);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(<App client={createFateClient({ url: "/fate" })} />);
  await expect
    .poll(() => document.body.textContent?.includes(text), { timeout: 15_000 })
    .toBe(true);
  // Fonts and layout settle.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** Whether an element sits inside one meant to scroll sideways: a table or code. */
function scrolls(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowX;
    if (overflow === "auto" || overflow === "scroll") {
      return true;
    }
  }
  return false;
}

/** The left edge of an element's text. */
function textLeft(element: Element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  return Math.min(...[...range.getClientRects()].map((rect) => rect.left));
}

function checkPage() {
  // Nothing scrolls the page sideways.
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  const main = document.querySelector('[role="main"]') ?? document.body;
  for (const element of main.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    const name = element.outerHTML.slice(0, 120);
    expect(style.getPropertyValue("-webkit-line-clamp") || "none", name).toBe("none");
    if (scrolls(element)) {
      continue;
    }
    // No text is cut where an element clips it, by an ellipsis or not; visually hidden elements,
    // a few pixels wide, are for screen readers.
    const clips =
      style.textOverflow === "ellipsis" ||
      style.overflowX === "hidden" ||
      style.overflowX === "clip";
    if (clips && element.clientWidth > 4) {
      expect(element.scrollWidth, name).toBeLessThanOrEqual(element.clientWidth + 1);
    }
    // Nothing reaches past the screen's edge.
    const box = element.getBoundingClientRect();
    if (box.width > 4) {
      expect(box.right, name).toBeLessThanOrEqual(window.innerWidth + 1);
    }
  }
  for (const paragraph of main.querySelectorAll(".page p:not(.small):not(.muted), .summary")) {
    expect(
      parseFloat(getComputedStyle(paragraph).fontSize),
      paragraph.outerHTML.slice(0, 160),
    ).toBeGreaterThanOrEqual(16);
  }
}

function checkInsets(selector: string) {
  const elements = [...document.querySelectorAll(selector)];
  expect(elements.length, selector).toBeGreaterThan(0);
  for (const element of elements) {
    expect(textLeft(element), element.textContent?.slice(0, 60)).toBeLessThanOrEqual(50);
  }
}

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

test("home", async () => {
  await show("/", "Waiting on you");
  checkPage();
});

test("a round of questions", async () => {
  await show("/f/2026-10-11-web-ui/clarifications-01.md", "How does your iPhone reach the server?");
  checkPage();
  checkInsets("section > .title-l, .option .summary");
});

test("a spec under review", async () => {
  await show("/f/2026-10-06-recurring-tasks/spec.md", "Complete a repeating task");
  checkPage();
  checkInsets(".title-l, .doc > .block p, .doc > .block > ol > li, .doc > ol > li");
});

test("a plan under review", async () => {
  await show("/f/2026-10-13-plan-review/plan.md", "Task 5");
  checkPage();
});

test("the priorities", async () => {
  await show("/priorities", "Git listener process");
  checkPage();
});

test("a feature waiting on an agent", async () => {
  await show("/f/2026-10-12-cli-tuis", "CLI TUIs");
  checkPage();
});

const LONG =
  "specs/2026-10-12-claude-code-runner-triggered-manually-https-code/clarifications-01.md";

/** A run's panel, drawn from its records: the browser tests' server runs no agent. */
function Panel({ state }: { state: "running" | "failed" }) {
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
    denials: [{ seq: 5, tool: "Bash", target: `gh pr create --draft --title "${LONG}"`, rule: "" }],
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
    <Theme theme={neutralTheme} mode="light">
      <div className="page" role="main">
        <section className="agent-panel">
          <RunStatus run={run as never} waitsOnHuman={false} />
          {run.reason && <p className="agent-reason">{run.reason}</p>}
          <Denials denials={run.denials} onAllow={async () => {}} />
          <ChatMessageList align="top" density="compact" className="run-log">
            <RunEvents events={events} />
          </ChatMessageList>
        </section>
      </div>
    </Theme>
  );
}

test("the agent panel", async () => {
  for (const state of ["running", "failed"] as const) {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    root.render(<Panel state={state} />);
    await expect
      .poll(() => document.body.textContent?.includes("Rate limited"), { timeout: 15_000 })
      .toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    checkPage();
    root.unmount();
    document.body.innerHTML = "";
  }
});
