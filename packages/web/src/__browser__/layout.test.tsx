// SC-007: in WebKit, the pages cut no text, never scroll sideways, and keep body text at 16 px or
// more; on a 402 × 874 screen, they start the text of questions, options, stories, and scenarios
// within 50 px of the screen's left edge.
import { Theme } from "@astryxdesign/core/theme";
import { ChatMessageList } from "@astryxdesign/core/Chat";
import { createRoot } from "react-dom/client";
import { expect, test } from "vite-plus/test";
import { Denials, RunStatus } from "../AgentPanel.tsx";
import { type RunEvent, RunEvents } from "../RunLog.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { checkInsets, checkPage, show } from "./helpers.tsx";

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
  // Question titles, and the options' text.
  checkInsets('[role="main"] section h2, [role="main"] section [aria-pressed]');
});

test("a spec under review", async () => {
  await show("/f/2026-10-06-recurring-tasks/spec.md", "Complete a repeating task");
  checkPage();
  // Story titles, paragraphs, and the items of numbered lists, like scenarios.
  checkInsets(
    '[role="main"] h3, [role="main"] [aria-pressed] > p, [role="main"] ol > li [aria-pressed]',
  );
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
    <Theme theme={uraedaTheme} mode="light">
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
    const root = createRoot(container);
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
