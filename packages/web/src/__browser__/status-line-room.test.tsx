// The status line's room (layout look's US2): on a semi-wide window whose hints run longer than the
// line, the hints give way to the counts, which stay whole, on one line, inside the line; the hints
// past the room are cut.
import { Theme } from "@astryxdesign/core/theme";
import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { page, server } from "vite-plus/test/browser";
import { StatusLine } from "../shell/StatusLine.tsx";
import { type StatusHint, StatusHintsProvider, useStatusHints } from "../statusHints.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { atSize, drawn } from "./helpers.tsx";

// Three cards need the human and two sessions run, without a server to read them from.
vi.mock(import("../sessionData.ts"), async (original) => ({
  ...(await original()),
  useNavigation: () => ({ sessionList: null, workspace: null }) as never,
}));
vi.mock(import("../sidebar/entries.ts"), async (original) => ({
  ...(await original()),
  entriesOf: () => Array.from({ length: 3 }, () => ({ status: "waiting" })) as never,
  runningSessions: () => 2,
}));
vi.mock(import("../sidebar/cards.ts"), async (original) => ({
  ...(await original()),
  needsYou: () => true,
}));

atSize("desktop");

const HINTS: Array<StatusHint> = Array.from({ length: 12 }, (_, index) => ({
  keys: "j k",
  label: `a long hint ${index + 1}`,
}));

function Page() {
  useStatusHints(HINTS);
  return <StatusLine isNarrow={false} slot={null} />;
}

test("at 768 px, the hints give way: the counts stay on one line inside the status line", async () => {
  const { height, width } = server.config.browser.viewport;
  await page.viewport(768, height);
  try {
    await expect.poll(() => window.innerWidth).toBe(768);
    render(
      <Theme mode="light" theme={uraedaTheme}>
        <StatusHintsProvider>
          <Page />
        </StatusHintsProvider>
      </Theme>,
    );
    const line = screen.getByRole("contentinfo", { name: "Status line" });
    await within(line).findByText(/a long hint 12/);
    await drawn();
    const box = line.getBoundingClientRect();
    const counts = [/3 need you/, /2 running/].map((text) => within(line).getByText(text));
    for (const count of counts) {
      const shown = count.getBoundingClientRect();
      expect(shown.top).toBeGreaterThanOrEqual(box.top - 0.5);
      expect(shown.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
      expect(shown.right).toBeLessThanOrEqual(window.innerWidth + 0.5);
      // Whole, not cut: its text fits its box.
      expect(count.scrollWidth).toBeLessThanOrEqual(count.clientWidth + 1);
    }
    const [needs, running] = counts.map((count) => count.getBoundingClientRect());
    expect(Math.abs(needs!.top - running!.top)).toBeLessThanOrEqual(1);
  } finally {
    await page.viewport(width, height);
  }
});
