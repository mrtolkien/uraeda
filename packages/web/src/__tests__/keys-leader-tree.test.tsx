// The leader's tree (US1 top level, SC-001, SC-007): every top-level page is reached in at most
// three presses from the home, the place entries are the destinations' own icon and label, and the
// New, Find, and UI groups run what their buttons do.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addChange } from "uraeda-binding/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { DESTINATIONS } from "../destinations.ts";
import { SHOW_AFTER } from "../keys/leader.ts";
import { findBindings } from "../keys/leaderTree.ts";
import type { PickerKind } from "../keys/pickerSources.ts";
import { navigate } from "../routeHistory.ts";
import { atRepo, atWidth, fakeAgent, fixtureRepo, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
});

afterEach(() => vi.useRealTimers());

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
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  press(" ");
  act(() => void vi.advanceTimersByTime(SHOW_AFTER));
  const menu = screen.getByRole("group", { name: "Space" });
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

/** The leader menu, shown at the keys `path` pressed from the home, as a user sees it. */
function menuAfter(...path: Array<string>) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  keys(...path);
  act(() => void vi.advanceTimersByTime(SHOW_AFTER));
  vi.useRealTimers();
  return screen.getByRole("group", {
    name: path.map((key) => (key === " " ? "Space" : key)).join(" "),
  });
}

/** The icon a row draws, as its paths: the same icon looks the same wherever it is drawn. */
const iconOf = (row: HTMLElement) =>
  Array.from(row.querySelectorAll("svg")).find((svg) => !svg.closest("kbd"))?.innerHTML;

/** The row of the leader menu, or the link of a navigation, named `label`. */
const rowNamed = (menu: HTMLElement, label: string) =>
  within(menu).getByText(label).closest("li") as HTMLElement;

/** The icon and label of each place in the menu, as in the navigation's links. */
function expectPlaces(menu: HTMLElement, nav: HTMLElement, places: Array<{ label: string }>) {
  for (const place of places) {
    const link = within(nav)
      .getAllByRole("link", { name: new RegExp(`^${place.label}`) })
      .find((one) => iconOf(one) !== undefined)!;
    expect(rowNamed(menu, place.label), place.label).toBeTruthy();
    expect(iconOf(rowNamed(menu, place.label)), place.label).toBe(iconOf(link));
  }
}

// Break: a place entry with an icon or a label of its own.
test("the menu's place entries draw the icon and label of the navigation column's links (SC-007)", async () => {
  await atHome();
  const { decisions, home, inbox, priorities, settings } = DESTINATIONS;
  const nav = screen.getByRole("navigation", { name: "Navigation" });
  const menu = menuAfter(" ");
  expectPlaces(menu, nav, [decisions, home, inbox, priorities, settings]);
  press("Escape");
  // `g`'s menu names the same places the same way.
  expectPlaces(menuAfter("g"), nav, [decisions, home, inbox, priorities, settings]);
});

// Break: a place entry with an icon or a label of its own.
test("the menu's place entries draw the icon and label of the phone's tabs too (SC-007)", async () => {
  atWidth(402);
  await atHome("Tabs");
  const { home, inbox, priorities, sessions } = DESTINATIONS;
  expectPlaces(menuAfter(" "), screen.getByRole("navigation", { name: "Tabs" }), [
    home,
    inbox,
    priorities,
    sessions,
  ]);
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

/**
 * Each kind: the title of a picker row of it in the repository below, its entry in the Find group,
 * and in the New group if any.
 */
const KINDS: Array<{ add?: string; find: string; kind: PickerKind; row: string }> = [
  { add: "Feature", find: "Features", kind: "features", row: "Web UI for the workflow files" },
  { add: "Change", find: "Changes", kind: "changes", row: "Centre the x" },
  { add: "Session", find: "Sessions", kind: "sessions", row: "List the drafts" },
  { add: "Note (inbox entry)", find: "Notes", kind: "notes", row: "Text input feels laggy" },
  {
    add: "Priority",
    find: "Priorities",
    kind: "priorities",
    row: "Nix + Docker based execution environments",
  },
  { find: "Decisions", kind: "decisions", row: "UI behaviour" },
];

/**
 * The kinds whose picker rows draw the item's card icon in place of the kind's, each with the name
 * of its row's card in the sidebar: a feature's is its slug.
 */
const CARDS: Partial<Record<PickerKind, string>> = {
  features: "web-ui",
  sessions: "List the drafts",
};

/** The picker's row of a title: a title may be a line of another kind too, so the first. */
const named = (all: Array<HTMLElement>, title: string) =>
  all.find((one) => one.textContent?.startsWith(title));

/** The icon of the sidebar's card of a name: its kind's, its step's, or its agent's. */
function cardIconOf(name: string) {
  const nav = screen.getByRole("navigation", { name: "Navigation" });
  const card = Array.from(nav.querySelectorAll<HTMLElement>("[data-card]")).find((one) =>
    one.textContent?.includes(name),
  );
  return Array.from(card?.querySelectorAll("svg") ?? []).find(
    (svg) => !svg.closest("kbd, [data-rail-only]"),
  )?.innerHTML;
}

// Break: the New group's note, or any picker row, drawn with an icon of its own. A feature's and a
// session's rows draw their card's icon, a feature's step or a session's agent, as the sidebar does.
test("a kind has one icon in the New group, the Find group, and the picker's rows (UI coherence)", async () => {
  // A repository with a row of every kind: a change, and a session besides the fixture's.
  const repo = fixtureRepo();
  addChange(repo, "2026-10-16-centred-x", { "proposal.md": "# Centre the x\n\nIt sits low.\n" });
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text: "List the drafts" });
  await fake.sessions.settled(turn);
  await renderPage("/", repo, { agent: fake });
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
  const added = menuAfter(" ", "n");
  const inNew = new Map(
    KINDS.filter(({ add }) => add !== undefined).map(({ add, kind }) => [
      kind,
      iconOf(rowNamed(added, add!)),
    ]),
  );
  press("Escape");
  const found = menuAfter(" ", "f");
  const inFind = new Map(KINDS.map(({ find, kind }) => [kind, iconOf(rowNamed(found, find))]));
  press("Escape");

  // Every kind's rows in the one picker.
  keys(" ", " ");
  await screen.findByRole("combobox", { name: "Find anything" });
  const rows = await waitFor(() => {
    const all = screen.getAllByRole("option");
    for (const { row } of KINDS) {
      expect(named(all, row), `a ${row} row`).toBeDefined();
    }
    return all;
  });

  for (const { kind, row } of KINDS) {
    // A decision's row draws its own decision's icon; a feature's and a session's their card's,
    // and the other kinds draw their kind's.
    const drawn = iconOf(named(rows, row)!);
    const card = CARDS[kind];
    if (card !== undefined) {
      expect(drawn, `${kind} in the picker`).toBeDefined();
      expect(drawn, `${kind} in the picker`).toBe(cardIconOf(card));
    } else if (kind !== "decisions") {
      expect(drawn, `${kind} in the picker`).toBe(inFind.get(kind));
    }
    if (inNew.has(kind)) {
      expect(inNew.get(kind), `${kind} in the New group`).toBe(inFind.get(kind));
    }
  }
  // Each kind has an icon of its own.
  expect(new Set(inFind.values()).size).toBe(KINDS.length);
});
