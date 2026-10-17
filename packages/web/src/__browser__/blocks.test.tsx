// US2 scenario 5 and the edge case "A table wider than its region on a wide screen", at a phone's
// size and a desktop's: a table's columns keep a floor of 144 px, past which the table scrolls
// sideways in its own region, never the page, and its cells keep their links.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, show } from "./helpers.tsx";

atSize("both");

const commands = browserCommands as unknown as RepoCommands;

const FOLDER = "2026-10-06-recurring-tasks";

/**
 * The feature's round, as the mockup's, its 3-column table with a link in a cell, and a table of 8
 * columns after it.
 */
async function writeRound() {
  const round = await commands.fixtureText("round-mockup/clarifications-01.md");
  const wide = [
    `| ${["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => `Column ${name}`).join(" | ")} |`,
    `|${" --- |".repeat(8)}`,
    `|${" a value |".repeat(8)}`,
  ].join("\n");
  const text = round
    .replace("| Todoist         |", "| [Todoist](https://todoist.com) |")
    .replace("### Scope\n", `${wide}\n\n### Scope\n`);
  await commands.commitOnBranch(FOLDER, { [`specs/${FOLDER}/clarifications-01.md`]: text });
}

/** The tables of the round's Context, by their first header. */
function table(header: string) {
  const cell = screen.getByRole("columnheader", { name: header });
  return cell.closest("table")!;
}

/** The region a table scrolls in: Astryx's scroll wrapper around it. */
function region(element: HTMLTableElement) {
  return element.closest<HTMLElement>('[role="group"]')!;
}

test("a table's columns keep 144 px and it scrolls in its own region (US2 5)", async () => {
  await writeRound();
  await show(`/f/${FOLDER}/clarifications-01.md`, "How users pick a repeat");

  const narrow = table("Product");
  const wide = table("Column A");
  for (const each of [narrow, wide]) {
    const headers = [...each.querySelectorAll("th")];
    expect(headers.length).toBeGreaterThanOrEqual(3);
    for (const header of headers) {
      expect(header.getBoundingClientRect().width, header.textContent!).toBeGreaterThanOrEqual(144);
    }
  }
  // At 402 px the 3 columns are wider than the region; on a wide screen, the 8 are.
  const scrolling = window.innerWidth < 768 ? [narrow, wide] : [wide];
  for (const each of scrolling) {
    const scroller = region(each);
    expect(scroller).toBeTruthy();
    expect(getComputedStyle(scroller).overflowX).toBe("auto");
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  }
  expect(document.documentElement.scrollWidth).toBe(window.innerWidth);
  // The cells keep their spans: the link stays a link, in its cell.
  const link = screen.getByRole("link", { name: "Todoist" });
  expect(link.closest("td")).toBeTruthy();
  expect(narrow.contains(link)).toBe(true);
});
