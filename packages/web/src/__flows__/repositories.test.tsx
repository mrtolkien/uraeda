// Flow: the repositories (decision repositories): every page is in its repository, named in its
// address; the menu opens, filters, and removes them without touching their files; a name the list
// lacks, a folder gone, and a removal an agent forbids are said, never a crash.
import { existsSync, rmSync } from "node:fs";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { click, refreshUntil } from "./harness.tsx";
import { startListApp } from "./lists.tsx";

const binding = await import("uraeda-binding");
const WEB_UI = "2026-10-11-web-ui";

const paths = { client: fixtureRepo(), todo: fixtureRepo(), uraeda: fixtureRepo() };
const gone = fixtureRepo();
rmSync(gone, { force: true, recursive: true });

// The most recently opened first: uraeda, then todo-app, client-site, and a folder that is gone.
const app = startListApp(
  () => [
    ["uraeda", paths.uraeda],
    ["todo-app", paths.todo],
    ["client-site", paths.client],
    ["gone-site", gone],
  ],
  { agent: true },
);

/** The names of the list on disk, in order. */
async function listed() {
  return (await binding.readRepositories(app.dataDir)).map((row) => row.name);
}

/** The heading's menu, opened. */
async function openMenu() {
  await click(await screen.findByRole("button", { name: /^Uraeda / }));
  return within(await screen.findByRole("dialog"));
}

/** The menu's row of a repository, found by its name. */
function row(menu: ReturnType<typeof within>, name: string) {
  return within(menu.getByText(name).closest("li") as HTMLElement);
}

/** Removes a repository from the menu, through its ⋯ menu. */
async function remove(menu: ReturnType<typeof within>, name: string) {
  await click(row(menu, name).getByRole("button", { name: new RegExp(`${name}$`) }));
  await click(await screen.findByRole("menuitem"));
}

test("a path without a repository opens it in the most recent, keeping its query and place", async () => {
  await app.open(`/f/${WEB_UI}?tab=files#top`);

  await waitFor(() => expect(window.location.pathname).toBe(`/r/uraeda/f/${WEB_UI}`));
  expect(window.location.search + window.location.hash).toBe("?tab=files#top");
});

test("the root opens the most recent repository's home", async () => {
  await app.open("/");

  await waitFor(() => expect(window.location.pathname).toBe("/r/uraeda/"));
});

test("a name the list lacks is said, with a link to the most recent", async () => {
  await app.open("/r/old-site/");

  const link = await screen.findByRole("link", { name: /uraeda/ });
  expect(link.getAttribute("href")).toBe("/r/uraeda/");
  await click(link);
  expect(window.location.pathname).toBe("/r/uraeda/");
});

test("the menu opens a repository, which moves first in the list", async () => {
  await app.open("/r/uraeda/");
  const menu = await openMenu();

  await click(row(menu, "todo-app").getByText("todo-app"));

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  await waitFor(async () => expect((await listed())[0]).toBe("todo-app"));
});

test("the filter keeps what matches, and Enter opens the one repository it leaves", async () => {
  await app.open("/r/todo-app/");
  const menu = await openMenu();

  await click(menu.getByRole("textbox"));
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(menu.getByRole("textbox"), { target: { value: "client" } });
  expect(menu.queryByText("uraeda")).toBeNull();
  fireEvent.keyDown(menu.getByRole("textbox"), { key: "Enter" });

  await waitFor(() => expect(window.location.pathname).toBe("/r/client-site/"));
});

test("a folder that is gone is said on its page, which offers only the removal", async () => {
  await app.open("/r/gone-site/");

  await screen.findAllByRole("button");
  // The heading's menu is the only other button: the page's own offers the removal.
  const [removal] = screen
    .getAllByRole("button")
    .filter((b) => !/^Uraeda/.test(b.textContent ?? ""));
  await click(removal);

  await waitFor(async () => expect(await listed()).not.toContain("gone-site"));
  await waitFor(() => expect(window.location.pathname).not.toBe("/r/gone-site/"));
});

test("removing an agent's repository is refused, and the list stays", async () => {
  const session = await app.sessions.featureSession(paths.todo, WEB_UI);
  const { turn } = await app.sessions.send(paths.todo, session.id, { text: "Why A?" });
  await waitFor(() => expect(app.agent.sent.length).toBeGreaterThan(0));
  app.agent.emit({ id: app.agent.sent[0].id, type: "accepted" });
  await waitFor(() => expect(app.sessions.working(paths.todo)).not.toEqual([]));
  await app.open("/r/client-site/");
  const menu = await openMenu();
  const before = await listed();

  await remove(menu, "todo-app");

  // The refusal is said in the menu, next to the repository, not only in a log.
  await waitFor(() =>
    expect(within(screen.getByRole("dialog")).queryAllByRole("alert").length).toBeGreaterThan(0),
  );

  // The refusal shows in the menu: the row stays, and so does the list on disk.
  await waitFor(async () => expect(await listed()).toEqual(before));
  expect(row(menu, "todo-app")).toBeTruthy();
  app.sessions.stop(paths.todo, session.id);
  await app.sessions.settled(turn);
});

test("removing the current repository opens the next, and leaves its files", async () => {
  await app.open("/r/client-site/");
  const menu = await openMenu();

  await remove(menu, "client-site");

  await waitFor(async () => expect(await listed()).not.toContain("client-site"));
  await waitFor(() => expect(window.location.pathname).not.toBe("/r/client-site/"));
  // Removing a repository from the list changes none of its files.
  expect(existsSync(`${paths.client}/specs/PRIORITIES.md`)).toBe(true);
});

test("a repository removed behind the page's back makes its open page say it is unknown", async () => {
  await app.open("/r/todo-app/");
  await screen.findAllByRole("link");

  await binding.removeRepository(app.dataDir, "todo-app");

  await refreshUntil(() => {
    // The page says the name is unknown, with a link to one that is listed, not a server error.
    expect(screen.queryAllByRole("link").some((l) => l.getAttribute("href") === "/r/uraeda/")).toBe(
      true,
    );
  });
});

test("the files of a repository's pages link under its own prefix", async () => {
  await app.open("/r/uraeda/");
  await screen.findAllByRole("link");

  const links = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
  const internal = links.filter((href) => href.startsWith("/") && !href.startsWith("//"));
  expect(internal.length).toBeGreaterThan(0);
  expect(internal.every((href) => href.startsWith("/r/uraeda/") || href === "/")).toBe(true);
});
