// US6, its edge case "A diagram wider than its card", and SC-003, at a phone's size and a
// desktop's: a `mermaid` block draws in a frame titled "Diagram", sandboxed without scripts or the
// app's origin, in Mermaid's `dark` theme in the dark colour mode; a block that does not parse
// shows its source under "This diagram could not be drawn."; a wide diagram scrolls inside its card,
// never the page; and a page without a diagram loads no `mermaid` chunk.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, colorScheme, show } from "./helpers.tsx";

atSize("both");

const commands = browserCommands as unknown as RepoCommands;

const FOLDER = "2026-10-06-recurring-tasks";
const ROUND = `/f/${FOLDER}/clarifications-01.md`;

/** The mockup round's flowchart, in Q1's context. */
const FLOWCHART = /```mermaid\n[\s\S]*?```/;

/** Commits the mockup's round, its Q1 flowchart replaced by `source` when given. */
async function writeRound(source?: string) {
  const round = await commands.fixtureText("round-mockup/clarifications-01.md");
  const text =
    source === undefined ? round : round.replace(FLOWCHART, `\`\`\`mermaid\n${source}\n\`\`\``);
  await commands.commitOnBranch(FOLDER, { [`specs/${FOLDER}/clarifications-01.md`]: text });
}

/** The diagram's frame, once drawn. */
async function diagramFrame(): Promise<HTMLIFrameElement> {
  await expect
    .poll(() => document.querySelector('iframe[title="Diagram"]'), { timeout: 15_000 })
    .toBeTruthy();
  return document.querySelector<HTMLIFrameElement>('iframe[title="Diagram"]')!;
}

/** The document a frame loads, from its `data:` address: the page cannot read the frame itself. */
function frameSource(frame: HTMLIFrameElement): string {
  const src = frame.getAttribute("src") ?? "";
  const base64 = src.slice(src.indexOf(",") + 1);
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** The resources the page requested whose address names `mermaid`. */
function mermaidRequests() {
  return performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.includes("mermaid"));
}

// First in the file: a module loaded once is never requested again.
test("a spec without a diagram loads no mermaid chunk, a round with one does (US6 3, SC-003)", async () => {
  // The browser keeps 250 entries by default, which the app's own modules fill.
  performance.setResourceTimingBufferSize(100_000);
  performance.clearResourceTimings();
  await show(`/f/${FOLDER}/spec.md`, "Complete a repeating task");
  expect(performance.getEntriesByType("resource").length).toBeGreaterThan(0);
  expect(mermaidRequests()).toEqual([]);

  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");
  await diagramFrame();
  expect(mermaidRequests().length).toBeGreaterThan(0);
});

test("a flowchart draws in a sandboxed frame titled Diagram (US6 1)", async () => {
  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");

  const frame = await diagramFrame();
  const sandbox = frame.getAttribute("sandbox");
  expect(sandbox).not.toBeNull();
  expect(sandbox).not.toContain("allow-scripts");
  expect(sandbox).not.toContain("allow-same-origin");
  // Drawn, in the frame's own document: the browser shows its text.
  await expect
    .poll(() => commands.frameText("Diagram"), { timeout: 10_000 })
    .toContain("Task completed");
  expect(frame.getBoundingClientRect().height).toBeGreaterThan(50);
  expect(screen.queryByText("This diagram could not be drawn.")).toBeNull();
});

test("a diagram that does not parse shows its source as code (US6 2)", async () => {
  await writeRound("flowchart LR\n A -->");
  await show(ROUND, "When does the next occurrence appear?");

  const line = await screen.findByText("This diagram could not be drawn.", undefined, {
    timeout: 15_000,
  });
  const code = line.parentElement!.querySelector("pre");
  expect(code?.textContent).toContain("flowchart LR");
  expect(code?.textContent).toContain("A -->");
  expect(document.querySelector('iframe[title="Diagram"]')).toBeNull();
  // The rest of the page draws.
  expect(
    screen.getAllByText("How should the app store due dates?", { exact: false }).length,
  ).toBeGreaterThan(0);
});

test("in the dark colour mode, a diagram uses Mermaid's dark theme (US6 4)", async () => {
  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");
  // Mermaid's `neutral` theme fills a node with #eee, its `dark` one with #1f2020.
  expect(frameSource(await diagramFrame())).toContain("#eee");

  await colorScheme("dark");
  await expect
    .poll(() => frameSource(document.querySelector('iframe[title="Diagram"]')!), {
      timeout: 15_000,
    })
    .toContain("#1f2020");
  expect(frameSource(await diagramFrame())).not.toContain("fill:#eee");
});

test("a diagram wider than its card scrolls inside it, never the page (edge case)", async () => {
  const steps = Array.from({ length: 16 }, (_, index) => `  s${index}[Step number ${index}]`);
  const links = Array.from({ length: 15 }, (_, index) => `  s${index} --> s${index + 1}`);
  await writeRound(["flowchart LR", ...steps, ...links].join("\n"));
  await show(ROUND, "When does the next occurrence appear?");

  const frame = await diagramFrame();
  const scroller = frame.parentElement!;
  expect(getComputedStyle(scroller).overflowX).toBe("auto");
  expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
});
