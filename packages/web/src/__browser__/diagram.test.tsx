// US6, its edge case "A diagram wider than its card", and SC-003, at a phone's size and a
// desktop's: a `mermaid` block draws in the page, named for its type and its place among the
// diagrams, in the colours of the colour mode; a block that does not parse shows its source under
// "This diagram could not be drawn."; a wide diagram scrolls inside its card, never the page, and
// a diagram fixed by a live edit does too; and a page without a diagram loads no `pele` chunk.
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

/** Commits the mockup's round, its Q1 flowchart replaced by `source` when given, then `more`. */
async function writeRound(source?: string, more = "") {
  const round = await commands.fixtureText("round-mockup/clarifications-01.md");
  const block = source === undefined ? undefined : `\`\`\`mermaid\n${source}\n\`\`\``;
  const text = round.replace(FLOWCHART, (first) => `${block ?? first}${more}`);
  await commands.commitOnBranch(FOLDER, { [`specs/${FOLDER}/clarifications-01.md`]: text });
}

/** The diagram drawn, named for its type: a group, or a region when it scrolls. */
function diagram(name = String.raw`\w[\w ]* diagram`) {
  return screen.findByLabelText(new RegExp(`^${name}`), undefined, { timeout: 15_000 });
}

/** The colour the first diagram's text is painted in. */
function textColor() {
  return getComputedStyle(screen.getAllByText("Task completed")[0]!).fill;
}

/** The resources the page requested whose address names `pele`. */
function peleRequests() {
  return performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.includes("pele"));
}

/** A flowchart of 16 steps, wider than a card at any size. */
const WIDE = [
  "flowchart LR",
  ...Array.from({ length: 16 }, (_, index) => `  s${index}[Step number ${index}]`),
  ...Array.from({ length: 15 }, (_, index) => `  s${index} --> s${index + 1}`),
].join("\n");

// First in the file: a module loaded once is never requested again.
test("a spec without a diagram loads no pele chunk, a round with one does (US6 3, SC-003)", async () => {
  // The browser keeps 250 entries by default, which the app's own modules fill.
  performance.setResourceTimingBufferSize(100_000);
  performance.clearResourceTimings();
  await show(`/f/${FOLDER}/spec.md`, "Complete a repeating task");
  expect(performance.getEntriesByType("resource").length).toBeGreaterThan(0);
  expect(peleRequests()).toEqual([]);

  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");
  await diagram();
  expect(peleRequests().length).toBeGreaterThan(0);
});

test("a flowchart draws in the page, named for its type (US6 1)", async () => {
  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");

  const drawn = await diagram("Flowchart diagram");
  expect(drawn.textContent).toContain("Task completed");
  expect(screen.queryByText("This diagram could not be drawn.")).toBeNull();
  expect(screen.queryByText("Drawing the diagram…")).toBeNull();
  expect(drawn.getBoundingClientRect().height).toBeGreaterThan(50);
});

test("each diagram is named for its place among the document's diagrams", async () => {
  await writeRound(undefined, "\n\n```mermaid\nsequenceDiagram\n  A->>B: hello\n```");
  await show(ROUND, "When does the next occurrence appear?");

  await diagram("Flowchart diagram, 1 of 2");
  await diagram("Sequence diagram, 2 of 2");
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
  expect(screen.queryByLabelText(/ diagram/)).toBeNull();
  // The rest of the page draws.
  expect(
    screen.getAllByText("How should the app store due dates?", { exact: false }).length,
  ).toBeGreaterThan(0);
});

test("in the dark colour mode, a diagram takes the dark colours (US6 4)", async () => {
  await writeRound();
  await show(ROUND, "When does the next occurrence appear?");
  await diagram();
  const light = textColor();

  await colorScheme("dark");
  await expect.poll(textColor, { timeout: 15_000 }).not.toBe(light);
});

test("a diagram wider than its card scrolls inside it, never the page (edge case)", async () => {
  await writeRound(WIDE);
  await show(ROUND, "When does the next occurrence appear?");

  // The keyboard reaches it, to scroll it: a region named for what it holds.
  const region = await screen.findByRole(
    "region",
    { name: "Flowchart diagram, scrolls sideways" },
    { timeout: 15_000 },
  );
  expect(region.tabIndex).toBe(0);
  expect(getComputedStyle(region).overflowX).toBe("auto");
  expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
  expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
});

test("a diagram that fits its card is not a stop of the keyboard", async () => {
  await writeRound("flowchart TB\n  a[A] --> b[B]");
  await show(ROUND, "When does the next occurrence appear?");

  const drawn = await diagram();
  const scroller = drawn.parentElement!;
  expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
  expect(screen.queryByRole("region", { name: /scrolls sideways/ })).toBeNull();
});

test("a diagram fixed by a live edit after failing scrolls with the keyboard (edge case)", async () => {
  await writeRound("flowchart LR\n A -->");
  await show(ROUND, "When does the next occurrence appear?");
  await screen.findByText("This diagram could not be drawn.", undefined, { timeout: 15_000 });

  await writeRound(WIDE);

  const region = await screen.findByRole(
    "region",
    { name: /scrolls sideways/ },
    { timeout: 15_000 },
  );
  expect(region.tabIndex).toBe(0);
});

test("a diagram far beyond the card is scaled down, not drawn at its size (edge case)", async () => {
  const chain = Array.from({ length: 120 }, (_, index) => `  s${index}[Step number ${index}]`);
  const links = Array.from({ length: 119 }, (_, index) => `  s${index} --> s${index + 1}`);
  await writeRound(["flowchart LR", ...chain, ...links].join("\n"));
  await show(ROUND, "When does the next occurrence appear?");

  const region = await screen.findByRole(
    "region",
    { name: /scrolls sideways/ },
    { timeout: 20_000 },
  );
  expect(region.scrollWidth).toBeLessThanOrEqual(4000);
});
