// The phone's bottom bar: every tile writes a short word under its icon, which its name holds, so
// a tile is understood without being learned (NN/g: most icons need a word), and a spoken command
// finds it by what it shows.
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => atWidth(375));
afterEach(() => atWidth(1440));

// Break: a tile back to its icon alone, or one whose word is not in its name.
test("each tile of a round's bottom bar shows a word its name holds", async () => {
  await renderPage("/f/2026-10-11-web-ui/clarifications-01.md", fixtureRepo());
  const bar = await screen.findByRole("navigation", { name: "The round's parts" });
  await quiet();
  const tiles = within(bar).getAllByRole("button");
  expect(tiles.length).toBeGreaterThanOrEqual(3);
  for (const tile of tiles) {
    const word = tile.textContent?.trim() ?? "";
    expect(word).not.toBe("");
    // Eight letters at most: five tiles keep their words whole on a 360 px phone.
    expect(word.length).toBeLessThanOrEqual(8);
    expect(tile.getAttribute("aria-label")?.toLowerCase()).toContain(word.toLowerCase());
  }
  // The outline's count is in its name, its word the part alone.
  const outline = within(bar).getByRole("button", { name: /^Outline, \d+\/\d+ answered$/ });
  expect(outline.textContent).toBe("Outline");
});
