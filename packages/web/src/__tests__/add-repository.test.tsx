// US2: "Add a repository…" opens a short form, whose Folder field completes as it is typed; US3.3:
// with an empty list, every page shows the first run, the same form in the page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { click, listOf, renderPage, repoAt, sent, temporaryHome, type } from "./helpers.tsx";

const home = temporaryHome();

/**
 * `~/dev` holding `todo-app`, a git repository, `tools`, outside git, and `.cache`, and a list
 * holding `uraeda`, its page open.
 */
async function openOnUraeda() {
  const dataDir = listOf([["uraeda", repoAt(join(home(), "dev/uraeda"))]]);
  repoAt(join(home(), "dev/todo-app"));
  mkdirSync(join(home(), "dev/tools"), { recursive: true });
  mkdirSync(join(home(), "dev/.cache"), { recursive: true });
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });
  return dataDir;
}

/** Opens the add form from the heading's menu, and returns it. */
async function openForm() {
  await click(await screen.findByRole("button", { name: "Uraeda uraeda" }));
  const menu = within(await screen.findByRole("dialog", { name: "Repositories" }));
  await click(menu.getByRole("button", { name: "Add a repository…" }));
  return within(await screen.findByRole("dialog", { name: "Add a repository" }));
}

/** The suggestions shown under the field, by their text. */
async function suggestions(form: ReturnType<typeof within>) {
  const list = await form.findByRole("list", { name: "Folders" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent);
}

/** US2.1 */
test("typing completes folders, git ones marked", async () => {
  await openOnUraeda();
  const form = await openForm();

  await type(form.getByRole("textbox", { name: "Folder" }), "~/dev/to");

  await waitFor(async () =>
    expect(await suggestions(form)).toEqual(["~/dev/todo-app/git", "~/dev/tools/"]),
  );
  // One request per text typed.
  expect(sent.filter((body) => body.includes('"~/dev/to"'))).toHaveLength(1);
});

/** US2.2 */
test("adding a folder opens it", async () => {
  const dataDir = await openOnUraeda();
  const form = await openForm();
  const field = form.getByRole("textbox", { name: "Folder" });
  await type(field, "~/dev/to");

  await click(await form.findByRole("button", { name: /^~\/dev\/todo-app\// }));
  expect((field as HTMLInputElement).value).toBe("~/dev/todo-app/");
  await click(form.getByRole("button", { name: "Add" }));

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add a repository" })).toBeNull(),
  );
  expect(await screen.findByRole("button", { name: "Uraeda todo-app" })).toBeTruthy();
  expect((await binding.readRepositories(dataDir)).map((row) => row.name).sort()).toEqual([
    "todo-app",
    "uraeda",
  ]);
});

/** US2.2, from the keyboard */
test("Enter adds", async () => {
  await openOnUraeda();
  const form = await openForm();
  const field = form.getByRole("textbox", { name: "Folder" });
  await type(field, "~/dev/todo-app");

  await act(async () => {
    fireEvent.keyDown(field, { key: "Enter" });
  });

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
});

/** US2.3 */
test("a folder outside git keeps the form open with the error", async () => {
  const dataDir = await openOnUraeda();
  const form = await openForm();
  await type(form.getByRole("textbox", { name: "Folder" }), "~/dev/tools");

  await click(form.getByRole("button", { name: "Add" }));

  expect(
    await form.findByText(
      `Not a git repository: ${join(home(), "dev/tools")}. Run git init there first.`,
    ),
  ).toBeTruthy();
  expect(screen.getByRole("dialog", { name: "Add a repository" })).toBeTruthy();
  expect(window.location.pathname).toBe("/r/uraeda/");
  expect((await binding.readRepositories(dataDir)).map((row) => row.name)).toEqual(["uraeda"]);
});

/** The add form's edge cases */
test("a path that is not absolute, or not there, is refused", async () => {
  await openOnUraeda();
  const form = await openForm();
  const field = form.getByRole("textbox", { name: "Folder" });

  await type(field, "dev/tools");
  await click(form.getByRole("button", { name: "Add" }));
  expect(await form.findByText("Type an absolute path, starting with / or ~.")).toBeTruthy();

  await type(field, "~/dev/nope");
  await click(form.getByRole("button", { name: "Add" }));
  expect(await form.findByText(`No such folder: ${join(home(), "dev/nope")}.`)).toBeTruthy();
});

/** US2.5 */
test("adding a known repository opens it", async () => {
  const dataDir = await openOnUraeda();
  const form = await openForm();
  await type(form.getByRole("textbox", { name: "Folder" }), "~/dev/uraeda");
  await click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add a repository" })).toBeNull(),
  );

  expect(window.location.pathname).toBe("/r/uraeda/");
  expect((await binding.readRepositories(dataDir)).map((row) => row.name)).toEqual(["uraeda"]);
});

/** The UI behaviour decision: errors stay until the text changes */
test("the error goes once the text changes", async () => {
  await openOnUraeda();
  const form = await openForm();
  const field = form.getByRole("textbox", { name: "Folder" });
  await type(field, "~/dev/tools");
  await click(form.getByRole("button", { name: "Add" }));
  const error = `Not a git repository: ${join(home(), "dev/tools")}. Run git init there first.`;
  expect(await form.findByText(error)).toBeTruthy();

  await type(field, "~/dev/tools/");

  expect(form.queryByText(error)).toBeNull();
});

/** The add form has Cancel and a visible Close */
test("Cancel closes the form without adding", async () => {
  const dataDir = await openOnUraeda();
  const form = await openForm();
  await type(form.getByRole("textbox", { name: "Folder" }), "~/dev/todo-app");

  await click(form.getByRole("button", { name: "Cancel" }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Add a repository" })).toBeNull(),
  );
  expect((await binding.readRepositories(dataDir)).map((row) => row.name)).toEqual(["uraeda"]);
});

/** US3.3 */
test("an empty list shows the first run, with the field set to ~/", async () => {
  const todo = repoAt(join(home(), "dev/todo-app"));
  const dataDir = listOf([]);
  await renderPage("/priorities", undefined, { dataDir, raw: true });

  expect(await screen.findByRole("heading", { name: "Add your first repository" })).toBeTruthy();
  expect(
    screen.getByText("Uraeda shows the specs and runs agents in git repositories on this machine."),
  ).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  const field = screen.getByRole("textbox", { name: "Folder" }) as HTMLInputElement;
  expect(field.value).toBe("~/");
  expect(screen.getByText(/A folder in a git repository\. From a terminal:/)).toBeTruthy();

  await type(field, "~/dev/todo-app");
  await click(screen.getByRole("button", { name: "Add" }));

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  expect(await screen.findByRole("button", { name: "Uraeda todo-app" })).toBeTruthy();
  expect((await binding.readRepositories(dataDir)).map((row) => row.path)).toEqual([todo]);
});
