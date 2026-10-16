// US1: the navigation's heading opens the repository menu, which switches repository; US5: its rows'
// ⋯ menu removes one, and a missing folder is marked.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { expectLogged } from "uraeda-binding/test-utils";
import {
  click,
  fakeAgent,
  listOf,
  refreshUntil,
  renderPage,
  repoAt,
  sent,
  temporaryHome,
  type,
} from "./helpers.tsx";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

const home = temporaryHome();

/** uraeda, opened at 10:59, then todo-app, at 10:58, both in `~/dev`. */
function twoRepositories() {
  return listOf([
    ["uraeda", repoAt(join(home(), "dev/uraeda"))],
    ["todo-app", repoAt(join(home(), "dev/todo-app"))],
  ]);
}

/** The heading's button, which opens the menu, on the repository `name`. */
function heading(name: string) {
  return screen.findByRole("button", { name: `Uraeda ${name}` });
}

/** Opens the menu from the heading, and returns it. */
async function openMenu(name = "uraeda") {
  await click(await heading(name));
  return within(await screen.findByRole("dialog", { name: "Repositories" }));
}

/**
 * The menu's rows, by their text: the name, then its path or why its folder is not found, without
 * their controls' names, or their ⋯ menu's, drawn in the row on narrow screens.
 */
function rows(menu: ReturnType<typeof within>) {
  return within(menu.getByRole("list", { name: "Repositories" }))
    .getAllByRole("listitem")
    .map((row) => {
      const text = row.cloneNode(true) as HTMLElement;
      for (const control of text.querySelectorAll("[aria-haspopup], dialog, [role=dialog]")) {
        control.remove();
      }
      return text.textContent;
    });
}

/** The row of a repository in the menu. */
function rowOf(menu: ReturnType<typeof within>, name: string) {
  return within(menu.getByRole("list", { name: "Repositories" }))
    .getAllByRole("listitem")
    .find((row) => within(row).queryByText(name, { exact: true }))!;
}

/** Chooses "Remove from Uraeda" in a row's ⋯ menu. */
async function remove(menu: ReturnType<typeof within>, name: string) {
  const more = within(rowOf(menu, name)).getByRole("button", { name: `More for ${name}` });
  await click(more);
  const items = document.getElementById(more.getAttribute("aria-controls")!)!;
  await click(await within(items).findByRole("menuitem", { name: "Remove from Uraeda" }));
}

/** US1.1 */
test("the menu lists repositories, most recent first, the current one checked", async () => {
  await renderPage("/r/uraeda/", undefined, { dataDir: twoRepositories(), raw: true });

  const menu = await openMenu();

  expect(rows(menu)).toEqual(["uraeda~/dev/uraeda", "todo-app~/dev/todo-app"]);
  expect(within(rowOf(menu, "uraeda")).getByRole("img", { name: "Current" })).toBeTruthy();
  expect(within(rowOf(menu, "todo-app")).queryByRole("img", { name: "Current" })).toBeNull();
  expect(menu.getByRole("button", { name: "Add a repository…" })).toBeTruthy();
});

/** US1.2, SC-001 */
test("picking a repository opens its home in two clicks", async () => {
  await renderPage("/r/uraeda/priorities", undefined, { dataDir: twoRepositories(), raw: true });
  let clicks = 0;
  const count = async (element: HTMLElement) => {
    clicks += 1;
    await click(element);
  };

  await count(await heading("uraeda"));
  const menu = within(await screen.findByRole("dialog", { name: "Repositories" }));
  await count(menu.getByRole("button", { name: /^todo-app/ }));

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  expect(clicks).toBe(2);
  expect(await heading("todo-app")).toBeTruthy();
  expect((await screen.findAllByRole("link", { name: /Git listener process/ })).length).toBe(1);
  for (const link of screen.getAllByRole("link")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("/")) {
      expect(href.startsWith("/r/todo-app/")).toBe(true);
    }
  }
});

/** US1.3 */
test("the filter keeps names and paths that match", async () => {
  const dataDir = listOf([
    ["uraeda", repoAt(join(home(), "dev/uraeda"))],
    ["todo-app", repoAt(join(home(), "dev/todo-app"))],
    ["client-site", repoAt(join(home(), "work/client-site"))],
    ["notes", repoAt(join(home(), "TODO/notes"))],
    ["blog", repoAt(join(home(), "dev/blog"))],
  ]);
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });
  const menu = await openMenu();

  await type(menu.getByRole("textbox", { name: "Filter repositories" }), "todo");

  expect(rows(menu)).toEqual(["todo-app~/dev/todo-app", "notes~/TODO/notes"]);
  expect(menu.getByRole("button", { name: "Add a repository…" })).toBeTruthy();
});

/** US1.4 */
test("opening a repository moves it first", async () => {
  await renderPage("/r/uraeda/", undefined, { dataDir: twoRepositories(), raw: true });
  // Its page shown, the repository is opened once.
  await waitFor(() =>
    expect(sent.filter((body) => body.includes('"repositories.open"'))).toHaveLength(1),
  );

  await click((await openMenu()).getByRole("button", { name: /^todo-app/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  await waitFor(() =>
    expect(sent.filter((body) => body.includes('"repositories.open"'))).toHaveLength(2),
  );

  const menu = await openMenu("todo-app");
  await waitFor(() => expect(rows(menu)[0]).toBe("todo-app~/dev/todo-app"));
});

/** The requests that marked a repository opened, sent so far. */
const opens = () => sent.filter((body) => body.includes('"repositories.open"'));

/** US1.4, back to a repository opened before in the tab */
test("going back to a repository moves it first again", async () => {
  await renderPage("/r/todo-app/", undefined, { dataDir: twoRepositories(), raw: true });
  await waitFor(() => expect(opens()).toHaveLength(1));
  await click((await openMenu("todo-app")).getByRole("button", { name: /^uraeda/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/r/uraeda/"));
  await waitFor(() => expect(opens()).toHaveLength(2));

  await click((await openMenu("uraeda")).getByRole("button", { name: /^todo-app/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));

  // Opened at the same second as uraeda, todo-app still comes first by its name.
  await waitFor(() => expect(opens()).toHaveLength(3));
  const menu = await openMenu("todo-app");
  await waitFor(() => expect(rows(menu)[0]).toBe("todo-app~/dev/todo-app"));
});

/** US5.1 */
test("removing from the menu leaves the list", async () => {
  const dataDir = twoRepositories();
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });
  const menu = await openMenu();

  await remove(menu, "todo-app");

  await waitFor(() => expect(rows(menu)).toEqual(["uraeda~/dev/uraeda"]));
  expect((await binding.readRepositories(dataDir)).map((row) => row.name)).toEqual(["uraeda"]);
  expect(existsSync(join(home(), "dev/todo-app/specs"))).toBe(true);
  expect(window.location.pathname).toBe("/r/uraeda/");
});

/** US5.2 */
test("removing the current repository opens the next one", async () => {
  const dataDir = twoRepositories();
  await renderPage("/r/todo-app/f/2026-10-11-web-ui", undefined, { dataDir, raw: true });

  await remove(await openMenu("todo-app"), "todo-app");

  await waitFor(() => expect(window.location.pathname).toBe("/r/uraeda/"));
  expect(await heading("uraeda")).toBeTruthy();

  // The last one gone, the first run shows.
  await remove(await openMenu("uraeda"), "uraeda");

  expect(await screen.findByRole("heading", { name: "Add your first repository" })).toBeTruthy();
  expect(await binding.readRepositories(dataDir)).toEqual([]);
});

/** US5.3 */
test("removing while an agent works shows the refusal in the menu", async () => {
  const dataDir = twoRepositories();
  const fake = await fakeAgent();
  const todo = join(home(), "dev/todo-app");
  const session = await fake.sessions.featureSession(todo, "2026-10-11-web-ui");
  const { turn } = await fake.sessions.send(todo, session.id, { text: "Why A?" });
  // The agent takes the message, and works until stopped.
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  await waitFor(() => expect(fake.sessions.working(todo)).not.toEqual([]));
  await renderPage("/r/uraeda/", undefined, { agent: fake, dataDir, raw: true });
  const menu = await openMenu();

  await remove(menu, "todo-app");

  expect(await menu.findByText("An agent is working in todo-app: stop it first.")).toBeTruthy();
  expect(rows(menu)).toEqual(["uraeda~/dev/uraeda", "todo-app~/dev/todo-app"]);
  expect((await binding.readRepositories(dataDir)).map((row) => row.name)).toEqual([
    "uraeda",
    "todo-app",
  ]);
  fake.sessions.stop(todo, session.id);
  await fake.sessions.settled(turn);
});

/** US5.4 */
test("a missing folder is marked in its row", async () => {
  const dataDir = listOf([
    ["uraeda", repoAt(join(home(), "dev/uraeda"))],
    ["client-site", join(home(), "work/client-site")],
  ]);
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });

  const menu = await openMenu();

  expect(rows(menu)).toEqual([
    "uraeda~/dev/uraeda",
    "client-siteFolder not found: ~/work/client-site",
  ]);
});

/** The edge case of an unreadable `repositories.json` */
test("an unreadable list shows its problem in the menu", async () => {
  const dataDir = twoRepositories();
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });
  const menu = await openMenu();
  // The server logs the problem too: expected here, so kept from the log.
  const logged = expectLogged(
    process.stderr,
    "write",
    /^uraeda-server: repositories\.json could not be read: /,
  );

  writeFileSync(join(dataDir, "repositories.json"), "{ not json");

  await refreshUntil(() =>
    expect(menu.getByText(/^repositories\.json could not be read: /)).toBeTruthy(),
  );
  expect(logged).toHaveBeenCalledWith(
    expect.stringMatching(/^uraeda-server: repositories\.json could not be read: /),
  );
  // The last list read stays.
  expect(rows(menu)).toEqual(["uraeda~/dev/uraeda", "todo-app~/dev/todo-app"]);
});

/** US1, the menu on a page that is not a repository's */
test("an unknown name's page has the menu, nothing checked", async () => {
  await renderPage("/r/old-site/", undefined, { dataDir: twoRepositories(), raw: true });

  expect(
    await screen.findByRole("heading", { name: "No repository named “old-site”" }),
  ).toBeTruthy();
  await click(await screen.findByRole("button", { name: "Uraeda" }));
  const menu = within(await screen.findByRole("dialog", { name: "Repositories" }));

  expect(rows(menu)).toEqual(["uraeda~/dev/uraeda", "todo-app~/dev/todo-app"]);
  expect(menu.queryByRole("img", { name: "Current" })).toBeNull();
});

/** The menu at narrow widths: a sheet with Close */
test("on a narrow screen, the menu is a sheet with Close", async () => {
  const { atWidth } = await import("./helpers.tsx");
  atWidth(402);
  await renderPage("/r/uraeda/", undefined, { dataDir: twoRepositories(), raw: true });

  const menu = await openMenu();
  expect(rows(menu)).toEqual(["uraeda~/dev/uraeda", "todo-app~/dev/todo-app"]);
  await click(menu.getByRole("button", { name: /^todo-app/ }));

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Repositories" })).toBeNull());
});

/** US9.4 */
test("Enter in the filter opens the one repository it leaves", async () => {
  await renderPage("/r/uraeda/", undefined, { dataDir: twoRepositories(), raw: true });
  const menu = await openMenu();
  const filter = menu.getByRole("textbox", { name: "Filter repositories" });
  await type(filter, "to");
  expect(rows(menu)).toHaveLength(1);

  await act(async () => {
    fireEvent.keyDown(filter, { key: "Enter" });
  });

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
});
