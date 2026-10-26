// The leader's tree (US1 top level, SC-001, SC-007): every top-level page is reached in at most
// three presses from the home, the place entries are the destinations' own icon and label, and the
// New, Find, and UI groups run what their buttons do.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { DESTINATIONS } from "../destinations.ts";
import { findBindings, placeBindings } from "../keys/leaderTree.ts";
import type { PickerKind } from "../keys/pickerSources.ts";
import { navigate } from "../routeHistory.ts";
import { atRepo, atWidth, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
});

const stored = () => window.localStorage.getItem("uraeda.theme");
const press = (key: string) => fireEvent.keyDown(document.body, { key });
const keys = (...all: Array<string>) => all.forEach(press);

/** The home, drawn, with the requests answered. */
async function atHome(navigation = "Navigation") {
  await renderPage("/");
  await screen.findByRole("navigation", { name: navigation });
  await quiet();
}

/** Back to the home, from wherever a test went. */
async function home() {
  await act(async () => navigate(atRepo("/")));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/")));
  await quiet();
}

test("each page of the top level opens in at most three presses from the home (SC-001)", async () => {
  await atHome();
  const cases: Array<[presses: Array<string>, path: string]> = [
    [[" ", "i"], "/inbox"],
    [[" ", "p"], "/priorities"],
    [[" ", "d"], "/decisions"],
    [[" ", "s"], "/sessions"],
    [[" ", ","], "/settings"],
    [[" ", "n", "s"], "/new"],
    [[" ", "n", "c"], "/new"],
    [[" ", "n", "f"], "/new"],
  ];
  for (const [presses, path] of cases) {
    expect(presses.length).toBeLessThanOrEqual(3);
    keys(...presses);
    await waitFor(() => expect(window.location.pathname).toBe(atRepo(path)));
    await home();
  }
  // The kinds the New page starts.
  keys(" ", "n", "c");
  await waitFor(() => expect(window.location.search).toBe("?kind=change"));
  await home();
  keys(" ", "n", "f");
  await waitFor(() => expect(window.location.search).toBe("?kind=feature"));
});

test("Space n n and Space n p open the forms of the column's buttons (US1 key 1)", async () => {
  await atHome();
  keys(" ", "n", "n");
  expect(await screen.findByRole("dialog", { name: "Add a note" })).toBeTruthy();
});

test("Space n p opens the priority form", async () => {
  await atHome();
  keys(" ", "n", "p");
  expect(await screen.findByRole("dialog", { name: "New priority" })).toBeTruthy();
});

test("Space f d opens the decisions picker, and Space Space the one over everything (US4)", async () => {
  await atHome();
  keys(" ", "f", "d");
  expect(await screen.findByRole("combobox", { name: "Find decisions" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Find decisions" }), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );
  keys(" ", " ");
  expect(await screen.findByRole("combobox", { name: "Find anything" })).toBeTruthy();
});

const FIND_KEYS: Array<[key: string, kind: PickerKind]> = [
  ["f", "features"],
  ["c", "changes"],
  ["s", "sessions"],
  ["d", "decisions"],
  ["n", "notes"],
  ["p", "priorities"],
];

test("each Space f key opens the picker of its own kind (US4)", () => {
  const opened: Array<PickerKind | "all"> = [];
  const bindings = findBindings((kind) => void opened.push(kind));
  for (const [key] of FIND_KEYS) {
    bindings
      .find((binding) => binding.keys === `space f ${key}`)
      ?.run(new KeyboardEvent("keydown"));
  }
  expect(opened).toEqual(FIND_KEYS.map(([, kind]) => kind));
  bindings.find((binding) => binding.keys === "space space")?.run(new KeyboardEvent("keydown"));
  expect(opened.at(-1)).toBe("all");
});

test("on the page, each Space f key opens the picker named for its kind", async () => {
  await atHome();
  for (const [key, kind] of FIND_KEYS) {
    keys(" ", "f", key);
    const field = await screen.findByRole("combobox", { name: `Find ${kind}` });
    fireEvent.keyDown(field, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  }
});

test("Space h goes home from another page", async () => {
  await atHome();
  keys(" ", "i");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/inbox")));
  await quiet();

  keys(" ", "h");

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/")));
});

test("Space u t cycles the theme: Mocha, Latte, then System (ruling R61)", async () => {
  await atHome();
  expect(stored()).toBeNull();
  keys(" ", "u", "t");
  expect(stored()).toBe("mocha");
  keys(" ", "u", "t");
  expect(stored()).toBe("latte");
  keys(" ", "u", "t");
  expect(stored()).toBeNull();
});

test("Space r opens the repository menu, and Space shows the whole top level (US1 key 2)", async () => {
  await atHome();
  keys(" ", "r");
  expect(await screen.findByRole("dialog", { name: "Repositories" })).toBeTruthy();
});

test("the menu at Space lists the places, the groups, Continue, and Find anything", async () => {
  await atHome();
  press(" ");
  const menu = await screen.findByRole("group", { name: "Space" }, { timeout: 2000 });
  for (const label of [
    "Find anything…",
    "Continue",
    "Home",
    "Inbox",
    "Priorities",
    "Decisions",
    "Sessions",
    "Settings",
    "New →",
    "Find →",
    "UI →",
    "Switch repository…",
  ]) {
    expect(within(menu).getByText(label)).toBeTruthy();
  }
});

// Break: a place entry with an icon or a label of its own.
test("the menu's place entries carry the icon and label of each destination (SC-007)", () => {
  const places = {
    ",": DESTINATIONS.settings,
    d: DESTINATIONS.decisions,
    h: DESTINATIONS.home,
    i: DESTINATIONS.inbox,
    p: DESTINATIONS.priorities,
    s: DESTINATIONS.sessions,
  };
  for (const prefix of ["space", "g"]) {
    const bindings = placeBindings(prefix, () => {});
    for (const [key, destination] of Object.entries(places)) {
      const entry = bindings.find((binding) => binding.keys === `${prefix} ${key}`);
      expect(entry?.icon).toBe(destination.icon);
      expect(entry?.label).toBe(destination.label);
    }
    expect(bindings).toHaveLength(Object.keys(places).length);
  }
});

/** Whether a navigation holds a link named by each place's label. */
function expectLinks(nav: HTMLElement, places: Array<{ label: string }>) {
  for (const place of places) {
    expect(
      within(nav).getAllByRole("link", { name: new RegExp(`^${place.label}`) }).length,
    ).toBeGreaterThan(0);
  }
}

test("the navigation column names its places as the menu does (SC-007)", async () => {
  await atHome();
  const { decisions, home, inbox, priorities, settings } = DESTINATIONS;
  expectLinks(screen.getByRole("navigation", { name: "Navigation" }), [
    decisions,
    home,
    inbox,
    priorities,
    settings,
  ]);
});

test("the phone's tabs name theirs as the menu does (SC-007)", async () => {
  atWidth(402);
  await atHome("Tabs");
  const { home, inbox, priorities, sessions } = DESTINATIONS;
  expectLinks(screen.getByRole("navigation", { name: "Tabs" }), [
    home,
    inbox,
    priorities,
    sessions,
  ]);
});
