// Spec page US1 key 3 and the layout decision's "An open detail, tab, or sheet MUST be in the URL":
// the phone's Contents and Review sheets are kept in the address's `?tab=`, as the column's open
// tab is on wide screens, so a reload and a width change keep them; a verdict from the Review
// sheet leaves no entry of it in the history.
import { act, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { overlayOf } from "../layout/useBackCloses.ts";
import { atWidth, click, fixtureRepo, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
/** The block's pane, titled by its first line. */
const BLOCK = "Spec to review, revision 2, about 10 minutes.";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(402);
});

/** The spec waiting for review, its page drawn at `path`. */
async function specAt(path = PAGE) {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(path, repo);
  await screen.findByRole("region", { name: BLOCK });
  return repo;
}

/** The phone's status line. */
const statusLine = () =>
  within(document.querySelector<HTMLElement>("footer[aria-label='Status line']")!);

/** The address's open tab. */
const tab = () => new URLSearchParams(window.location.search).get("tab");

test("an open sheet is in the address, and goes with it once closed", async () => {
  await specAt();

  await click(statusLine().getByRole("button", { name: "Contents" }));
  await screen.findByRole("dialog", { name: "Contents" });
  expect(tab()).toBe("contents");

  await click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(tab()).toBeNull();
});

test("a reload keeps the open sheet, and Close takes it out of the address", async () => {
  await specAt(`${PAGE}?tab=review`);

  const sheet = await screen.findByRole("dialog", { name: "Review" });
  await click(within(sheet).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(tab()).toBeNull();
  expect(overlayOf(window.history.state)).toBeUndefined();
});

test("crossing to a wide screen opens the sheet's tab", async () => {
  await specAt();
  await click(statusLine().getByRole("button", { name: "0 comments" }));
  await screen.findByRole("dialog", { name: "Review" });

  await act(async () => atWidth(1440));

  const list = await screen.findByRole("tablist", { name: "The spec's column" });
  expect(
    within(list)
      .getByRole("tab", { name: /^Review/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

test("after a reload, a jump from the sheet closes it for good", async () => {
  await specAt(`${PAGE}?tab=contents`);

  const sheet = await screen.findByRole("dialog", { name: "Contents" });
  await click(within(sheet).getByRole("link", { name: /^Task storage/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(tab()).toBeNull());
  // Still closed once the Back over its entry landed.
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(screen.queryByRole("dialog")).toBeNull();
});
