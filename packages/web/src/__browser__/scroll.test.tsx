// US1 scenario 8 and the UI behaviour decision: Back returns to the same scroll position, and a page
// keeps its content while its data reloads. Review focus 3: the position survives a reload.
import { act, fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { reload, show } from "./helpers.tsx";

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const TEXT = "Complete a repeating task";

/** Scrolls the spec, then follows its first link to the discovery. */
async function leave() {
  await show(SPEC, TEXT);
  window.scrollTo(0, 1200);
  await expect.poll(() => Math.round(window.scrollY)).toBe(1200);
  await act(async () => {
    fireEvent.click(screen.getAllByRole("link", { name: "discovery" })[0]!);
  });
  await expect
    .poll(() => window.location.pathname)
    .toBe("/f/2026-10-06-recurring-tasks/discovery-01.md");
  await expect
    .poll(() => document.body.textContent?.includes("No file discovery-01.md"))
    .toBe(true);
}

test("Back returns to the position, without Loading… (US1 8)", async () => {
  await leave();
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(SPEC);
  expect(screen.queryByText("Loading…")).toBeNull();
  await expect.poll(() => Math.round(window.scrollY)).toBe(1200);
});

test("the position survives a reload, then Back (review focus 3)", async () => {
  await leave();
  await reload("No file discovery-01.md");
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(SPEC);
  await expect.poll(() => Math.round(window.scrollY)).toBe(1200);
});
