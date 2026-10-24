// The spec page's stories, each a card: its key scenarios as Given, When, and Then rows, the others
// behind "N more scenarios", and its mockup live in it, an HTML one too, in a live window (US3).
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addPreview, addSpecFeature, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { atWidth, fixtureRepo, renderPage, serverFetch } from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

/** US3 3; the spec page's US3 2 */
test("stories embed their mockups live, and an HTML mockup draws live", async () => {
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
    ["Type a repeat in the title", "Title with a repeat phrase"],
  ];
  for (const [title, label] of frames) {
    const story = await card(title!);
    expect(await within(story).findByRole("region", { name: `live · ${label}` })).toBeTruthy();
  }
  expect(screen.getAllByRole("figure")).toHaveLength(4);
  expect(within(html).queryByRole("link", { name: "Title with a repeat phrase" })).toBeNull();
  const frame = within(html).getByTitle("Title with a repeat phrase, 1440 px");
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
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

/** The Given, When, and Then rows of a scenario, each as its text, which starts with its word. */
const rows = (scenario: HTMLElement) =>
  [
    ...document
      .getElementById(scenario.getAttribute("aria-labelledby") ?? "")!
      .querySelectorAll("div"),
  ]
    .filter((row) => row.children.length === 2 && row.children[0]!.tagName === "SPAN")
    .map((row) => row.children[1]!.textContent);

/** US3 1: a scenario draws its Given, When, and Then each as a labelled row, in order. */
test("a scenario's Given, When, and Then start its rows with their words", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  await renderPage(PAGE, repo);

  const story = await card("Repeat on a custom schedule");
  const [first, second] = scenariosOf(story);

  expect(rows(first!)).toEqual([
    "Given a task due Monday the 5th, ",
    'When the user sets "every 2 weeks", ',
    "Then completing it moves it to Monday the 19th.",
  ]);
  expect(rows(second!)[0]).toEqual(
    "Given a task due Monday the 5th, repeating on Mondays and Thursdays, ",
  );
});

/** The fixture's HTML mockup's window. */
const HTML_WINDOW = "live · Title with a repeat phrase";

/**
 * The server in process, recording the `HEAD` checks of the mockups it is sent; `fail` makes the
 * first ones fail as a network error does.
 */
function checkedMockups(repo: string, fail = 0) {
  const fetch = serverFetch(repo);
  const checks: Array<string> = [];
  let failing = fail;
  return {
    checks,
    fetch: (async (input, init) => {
      const url = typeof input === "object" && "url" in input ? input.url : input.toString();
      if (init?.method === "HEAD" && url.includes("/mockups/")) {
        checks.push(url);
        if (failing > 0) {
          failing -= 1;
          throw new TypeError("Failed to fetch");
        }
      }
      return fetch(input, init);
    }) as typeof globalThis.fetch,
  };
}

/** An `IntersectionObserver` that sees nothing until `seeAll` says everything it watches is seen. */
function watchSeen() {
  const observers: Array<() => void> = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push(() => callback([{ isIntersecting: true } as never], this as never));
      }
      observe() {}
      disconnect() {}
    },
  );
  return () =>
    act(async () => {
      for (const seen of observers) {
        seen();
      }
    });
}

/** Review: a mockup's check is sent once its window is on screen, not as the page opens. */
test("an HTML mockup is checked once its window is seen", async () => {
  const seeAll = watchSeen();
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const server = checkedMockups(repo);
  await renderPage(PAGE, repo, { fetch: server.fetch });

  expect(await screen.findByRole("region", { name: HTML_WINDOW })).toBeTruthy();
  expect(server.checks).toEqual([]);
  await seeAll();
  await waitFor(() => expect(server.checks).toHaveLength(1));
});

/** Review: a network error is no missing mockup; it is checked again once back online. */
test("a mockup whose check fails on the network stays drawn, and is checked again", async () => {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  const seeAll = watchSeen();
  const server = checkedMockups(repo, 1);
  await renderPage(PAGE, repo, { fetch: server.fetch });

  const window_ = await screen.findByRole("region", { name: HTML_WINDOW });
  await seeAll();
  await waitFor(() => expect(server.checks).toHaveLength(1));
  await act(async () => {});
  expect(within(window_).queryByText("This mockup could not be loaded.")).toBeNull();
  expect(within(window_).getByTitle("Title with a repeat phrase, 1440 px")).toBeTruthy();

  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await waitFor(() => expect(server.checks).toHaveLength(2));
  expect(within(window_).queryByText("This mockup could not be loaded.")).toBeNull();
});
