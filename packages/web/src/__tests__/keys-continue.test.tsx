// Continue, `Space c` (US1 more 1, edge: nothing needs you): with one card needing the human it
// opens it, with several a small picker lists them and Enter opens the selected, with none the menu
// says "Nothing needs you" and the page stays.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, atRepo, fixtureRepo, git, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => atWidth(1440));

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The home, drawn, with the requests answered; the repository's features left as they are. */
async function atHome(repo = fixtureRepo()) {
  await renderPage("/", repo);
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
}

/** The folders of the cards in the navigation's Needs you pane, first to last. */
async function waitingFolders() {
  const nav = within(await screen.findByRole("navigation", { name: "Navigation" }));
  const group = await nav.findByRole("group", { name: "Needs you" });
  return within(group)
    .getAllByRole("link")
    .map((link) => decodeURIComponent(link.getAttribute("href")!.split("/").at(-1)!));
}

test("with three cards needing you, Space c lists them in a picker, and Enter opens the selected (US1 more 1)", async () => {
  await atHome();
  const folders = await waitingFolders();
  expect(folders).toHaveLength(3);

  press(" ");
  press("c");
  const field = await screen.findByRole("combobox", { name: "Continue" });
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));

  await act(async () => void fireEvent.keyDown(field, { key: "Enter" }));
  await waitFor(() => expect(window.location.pathname).not.toBe(atRepo("/")));
  expect(window.location.pathname).toContain(folders[0]);
  expect(screen.queryByRole("combobox", { name: "Continue" })).toBeNull();
});

test("with one card needing you, Space c opens it at once", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "--quiet", "-D", "2026-10-06-recurring-tasks", "2026-10-13-plan-review");
  await atHome(repo);
  const folders = await waitingFolders();
  expect(folders).toHaveLength(1);

  press(" ");
  press("c");
  await waitFor(() => expect(window.location.pathname).toContain(folders[0]));
  expect(screen.queryByRole("combobox", { name: "Continue" })).toBeNull();
});

test("with none, the menu says Nothing needs you, and the page stays (edge)", async () => {
  const repo = fixtureRepo();
  git(
    repo,
    "branch",
    "--quiet",
    "-D",
    "2026-10-06-recurring-tasks",
    "2026-10-13-plan-review",
    "2026-10-11-web-ui",
  );
  await atHome(repo);
  expect(screen.queryByRole("group", { name: "Needs you" })).toBeNull();

  press(" ");
  const menu = await screen.findByRole("group", { name: "Space" }, { timeout: 2000 });
  expect(within(menu).getByText("Nothing needs you")).toBeTruthy();
  expect(within(menu).queryByText("Continue")).toBeNull();

  press("c");
  expect(window.location.pathname).toBe(atRepo("/"));
  expect(screen.queryByRole("combobox", { name: "Continue" })).toBeNull();
});
