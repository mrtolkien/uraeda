// The spec page's stories, each a card: its key scenarios as Given, When, and Then rows, the others
// behind "N more scenarios", and its mockup live in it, an HTML one a link (US3).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addPreview, addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/**
 * Whether an element is folded away: inside the region a closed trigger controls, which a screen
 * reader skips and the browser does not draw.
 */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** A story's card, a region named by its title, once drawn. */
const card = (title: string) => screen.findByRole("region", { name: title });

/** The scenarios a card shows, as a review taps them: each a block named by its text. */
function scenariosOf(story: HTMLElement) {
  return within(story)
    .queryAllByRole("button", { name: /^Given / })
    .filter((block) => block.hasAttribute("aria-pressed") && !folded(block));
}

/** A button of a card, by its name. */
const button = (story: HTMLElement, name: string) => within(story).getByRole("button", { name });

/** US3 1, 2 */
test("a story shows its key scenarios, and the others behind a button", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await card("Complete a repeating task");
  expect(scenariosOf(story)).toHaveLength(2);
  await click(button(story, "3 more scenarios"));

  expect(scenariosOf(story)).toHaveLength(5);
  expect(button(story, "Fold the other scenarios")).toBeTruthy();
  await click(button(story, "Fold the other scenarios"));
  expect(scenariosOf(story)).toHaveLength(2);
});

/** US3 3 */
test("stories embed their mockups live, and link an HTML one", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  addPreview(repo);
  await renderPage(PAGE, repo);

  const html = await card("Type a repeat in the title");
  expect(screen.queryByRole("button", { name: /Open the mockup/ })).toBeNull();
  const frames = [
    ["Make a task repeat", "Repeat menu, open"],
    ["Complete a repeating task", "Repeating task, completed"],
    ["Repeat on a custom schedule", "Custom repeat screen"],
  ];
  for (const [title, label] of frames) {
    expect(await within(await card(title!)).findByRole("figure", { name: label })).toBeTruthy();
  }
  expect(screen.getAllByRole("figure")).toHaveLength(3);
  const link = within(html).getByRole("link", { name: "Title with a repeat phrase" });
  expect(link.getAttribute("href")).toContain("mockups/title.html");
});

test("a story without more scenarios has no fold button", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await card("Repeat on a custom schedule");
  expect(scenariosOf(story)).toHaveLength(2);
  expect(within(story).queryByRole("button", { name: /more scenario/ })).toBeNull();
  expect(within(story).queryByRole("button", { name: "Fold the other scenarios" })).toBeNull();
});

test("a tap on a scenario opens the comment form on its lines", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await card("Repeat on a custom schedule");
  await click(scenariosOf(story)[0]!);

  await waitFor(() => expect(screen.getByLabelText("Comment text")).toBeTruthy());
  expect(
    screen.getByText(/^Lines? \d+(–\d+)?, under "US3: Repeat on a custom schedule/),
  ).toBeTruthy();
});

/** The Given, When, and Then rows of a scenario, each as its word and its text. */
const rows = (scenario: HTMLElement) =>
  [
    ...document
      .getElementById(scenario.getAttribute("aria-labelledby") ?? "")!
      .querySelectorAll("div"),
  ]
    .filter((row) => row.children.length === 2 && row.children[0]!.tagName === "SPAN")
    .map((row) => [row.children[0]!.textContent, row.children[1]!.textContent]);

/** US3 1: a scenario draws its Given, When, and Then each as a labelled row, in order. */
test("a scenario's Given, When, and Then label its rows, the words after each", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await card("Repeat on a custom schedule");
  const [first, second] = scenariosOf(story);

  expect(rows(first!)).toEqual([
    ["Given", "a task due Monday the 5th, "],
    ["When", 'the user sets "every 2 weeks", '],
    ["Then", "completing it moves it to Monday the 19th."],
  ]);
  expect(rows(second!)[0]).toEqual([
    "Given",
    "a task due Monday the 5th, repeating on Mondays and Thursdays, ",
  ]);
});
