// Spec page US5, SC-003, its edge case "The reviewed commit is not in git anymore", and Review focus
// 2 and 3: on a revision, "Since your review" lists each place changed since the reviewed version,
// a tap jumping to it; each block holding a change is marked Δ, its words as a decision's are, and
// no other block is; Contents marks the rows owning one.
import { screen, waitFor, within } from "@testing-library/react";
import {
  addRevisedSpec,
  addSpecFeature,
  reviewedSpec,
  SPEC_FEATURE,
} from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, fixtureRepo, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const BLOCK = "Spec to review, revision 2, about 10 minutes.";
const MARK = "Changed since your review";
const US1 = "US1 · Make a task repeat";
const US2 = "US2 · Complete a repeating task";
const ANSWERS = "Your review, answered";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** The page of a revised spec, `reviewed` making its revision 1, once its block draws. */
async function revised(reviewed?: (text: string) => string) {
  const repo = fixtureRepo();
  addRevisedSpec(repo, reviewed ? { reviewed } : {});
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: BLOCK });
}

/** The "Since your review" pane, by its whole title. */
const sincePane = (title: string) => screen.findByRole("region", { name: title });

/** The places the pane lists, by their buttons' names. */
const places = (pane: HTMLElement) =>
  within(pane)
    .getAllByRole("button")
    .map((button) => button.textContent)
    .filter((name) => !/part(s)? removed/.test(name ?? ""));

/** Every block marked in the page. */
const marks = () => within(screen.getByRole("main")).queryAllByRole("group", { name: MARK });

/** The rows of Contents carrying the mark, by their labels before it. */
const markedRows = () =>
  within(screen.getByRole("list", { name: "Parts" }))
    .queryAllByRole("link", { name: /changed since your review/ })
    .map((link) => link.textContent?.split("Δ")[0]?.trim());

/** US5 key 1 */
test("the pane lists each place changed since the review", async () => {
  await revised();

  const pane = await sincePane("Since your review · 3 parts changed");
  expect(places(pane)).toEqual([ANSWERS, "US1's journey", "US2's journey"]);
});

/** US5 key 2, SC-001 */
test("US2's journey is marked, its 3 struck and its 5 underlined", async () => {
  await revised();
  await sincePane("Since your review · 3 parts changed");

  const story = screen.getByRole("region", { name: US2 });
  const [journey, ...others] = within(story).getAllByRole("group", { name: MARK });
  expect(others).toHaveLength(0);
  expect(within(journey!).getByRole("deletion").textContent).toBe("3");
  expect(within(journey!).getByRole("insertion").textContent).toBe("5");
  expect(journey!.textContent).toContain("Δ");
});

/** SC-003: every block marked holds a change, and no other block is marked. */
test("only the blocks changed since the review are marked", async () => {
  await revised();
  await sincePane("Since your review · 3 parts changed");

  const inside = (name: string) => {
    const region = screen.getByRole("region", { name });
    return marks().filter((mark) => region.contains(mark)).length;
  };
  // US1's journey, US2's journey, and the three answers.
  expect(marks()).toHaveLength(5);
  expect([inside(US1), inside(US2), inside(ANSWERS)]).toEqual([1, 1, 3]);
  expect(within(screen.getByRole("region", { name: US1 })).getByRole("group").textContent).toMatch(
    /weekdays, weekends, weekly/,
  );
});

/** US5: Contents marks the rows owning a change. */
test("Contents marks the answers, US1, and US2 only", async () => {
  await revised();
  await sincePane("Since your review · 3 parts changed");

  expect(markedRows()).toEqual([
    ANSWERS,
    "US1 Make a task repeat",
    "US2 Complete a repeating task",
  ]);
});

/** US5: a place's button jumps to its first block. */
test("a place's button jumps to its block", async () => {
  await revised();
  const pane = await sincePane("Since your review · 3 parts changed");

  await click(within(pane).getByRole("button", { name: "US2's journey" }));

  const story = screen.getByRole("region", { name: US2 });
  await waitFor(() => expect(story.contains(document.activeElement)).toBe(true));
});

/** US5 more 1 */
test("a first revision has no pane and no mark", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo, { revision: 1 });
  await renderPage(PAGE, repo);
  await screen.findByRole("region", { name: "Spec to review, revision 1, about 10 minutes." });

  expect(screen.queryByRole("region", { name: /^Since your review/ })).toBeNull();
  expect(marks()).toHaveLength(0);
  expect(markedRows()).toEqual([]);
});

/** US5 more 2 */
test("a part removed shows struck, folded under its count", async () => {
  const removed = "Tasks sync through the store.";
  await revised((text) => reviewedSpec(text).replace("Tradeoffs:", `${removed}\n\nTradeoffs:`));

  const pane = await sincePane("Since your review · 3 parts changed");
  expect(within(pane).queryByText(removed)).toBeNull();
  await click(within(pane).getByRole("button", { name: "1 part removed" }));

  expect(within(pane).getByRole("deletion").textContent).toBe(removed);
  expect(marks()).toHaveLength(5);
});

/** Review focus 3 */
test("a change in a journey and in a key scenario lists both, and Contents marks the story once", async () => {
  await revised((text) =>
    reviewedSpec(text).replace("not done, due Monday the 12th.", "not done, due Monday the 11th."),
  );

  const pane = await sincePane("Since your review · 4 parts changed");
  expect(places(pane)).toEqual([ANSWERS, "US1's journey", "US2's journey", "US2, key scenario 1"]);
  const story = screen.getByRole("region", { name: US2 });
  const [, scenario] = within(story).getAllByRole("group", { name: MARK });
  expect(within(scenario!).getByRole("deletion").textContent).toBe("11th.");
  expect(within(scenario!).getByRole("insertion").textContent).toBe("12th.");
  expect(markedRows()).toEqual([
    ANSWERS,
    "US1 Make a task repeat",
    "US2 Complete a repeating task",
  ]);
});

/** The edge case: the reviewed commit is not in git anymore. */
test("a review at a commit git has no more marks nothing", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const pane = await sincePane("Since your review");
  expect(pane.textContent).toContain("The version you reviewed is not in git anymore.");
  expect(marks()).toHaveLength(0);
  expect(markedRows()).toEqual([]);
});

/** Review focus 2 */
test("a revision whose frontmatter alone changed says no part changed", async () => {
  await revised((text) => text.replace("revision: 2", "revision: 1"));

  const pane = await sincePane("Since your review");
  expect(pane.textContent).toContain("No part changed since your review.");
  expect(pane.textContent).not.toMatch(/0 parts/);
  expect(marks()).toHaveLength(0);
});
