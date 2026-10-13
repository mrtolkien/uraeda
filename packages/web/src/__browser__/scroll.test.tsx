// US1 scenario 8 and the UI behaviour decision: Back returns to the same scroll position, and a page
// keeps its content while its data reloads. Review focus 3: the position survives a reload.
import { act, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { reload, show, watchFor } from "./helpers.tsx";

const SPEC = "/f/2026-10-06-recurring-tasks/spec.md";
const TEXT = "Complete a repeating task";

/**
 * Scrolls the spec down to its last link to the discovery, then follows it, and gives the position
 * left: the link stays in view, so the click does not scroll.
 */
async function leave() {
  await show(SPEC, TEXT);
  const link = screen.getAllByRole("link", { name: "discovery" }).at(-1)!;
  const position = Math.round(
    link.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2,
  );
  expect(position).toBeGreaterThan(500);
  window.scrollTo(0, position);
  await expect.poll(() => Math.round(window.scrollY)).toBe(position);
  // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
  await userEvent.click(link);
  await expect
    .poll(() => window.location.pathname)
    .toBe("/f/2026-10-06-recurring-tasks/discovery-01.md");
  await expect
    .poll(() => document.body.textContent?.includes("No file discovery-01.md"))
    .toBe(true);
  return position;
}

test("Back returns to the position, without Loading… (US1 8)", async () => {
  const position = await leave();
  const loading = watchFor("Loading…");
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(SPEC);
  await expect.poll(() => Math.round(window.scrollY)).toBe(position);
  expect(document.body.textContent).toContain(TEXT);
  expect(loading.stop()).toBe(false);
});

test("the position survives a reload, then Back (review focus 3)", async () => {
  const position = await leave();
  await reload("No file discovery-01.md");
  await act(async () => window.history.back());
  await expect.poll(() => window.location.pathname).toBe(SPEC);
  await expect.poll(() => Math.round(window.scrollY)).toBe(position);
});
