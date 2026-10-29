// The wide column folded to its rail unfolds from a button of its own, for a pointer or a finger, as
// `[` does for the keys: Unfold, first in the rail, which an unfolded column keeps out of reach.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { NAV_KEY } from "../shell/columnWidth.ts";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

/** The column's fold, as the browser keeps it. */
const isFolded = () => JSON.parse(window.localStorage.getItem(NAV_KEY) ?? "{}").folded === true;

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

// Break: no Unfold in the folded rail, or one that does not unfold the column, leaves a mouse or a
// touch screen with no way to unfold it.
test("a click on Unfold unfolds the folded column, which then hides it", async () => {
  window.localStorage.setItem(NAV_KEY, JSON.stringify({ folded: true }));
  await renderPage("/settings", fixtureRepo());
  const nav = await screen.findByRole("navigation", { name: "Navigation" });
  // Folded, the column has no edge to drag.
  expect(screen.queryByRole("separator", { name: "Resize navigation" })).toBeNull();

  fireEvent.click(within(nav).getByRole("button", { name: "Unfold navigation" }));

  await waitFor(() => expect(isFolded()).toBe(false));
  expect(await screen.findByRole("separator", { name: "Resize navigation" })).toBeTruthy();
  // Unfolded, it is hidden: out of the tab order and of what screen readers read.
  expect(within(nav).queryByRole("button", { name: "Unfold navigation" })).toBeNull();
});
