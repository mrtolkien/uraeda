// Flow: adding a repository (decision repositories): with an empty list every page is the first run,
// the same form in the page; the Folder field completes the machine's folders as it is typed; Enter
// adds; a refusal stays under the field until the text changes; Cancel adds nothing.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { click, type } from "./harness.tsx";
import { startListApp } from "./lists.tsx";

const binding = await import("uraeda-binding");

const before = process.env.HOME;
const home = temporaryFolder("uraeda-home");
beforeAll(() => {
  // `~` is the server's home: a folder of the test's, holding a git repository and plain folders.
  process.env.HOME = home;
  for (const folder of ["dev/todo-app", "dev/other-app"]) {
    mkdirSync(join(home, folder), { recursive: true });
    execFileSync("git", ["init", "--quiet", join(home, folder)]);
  }
  mkdirSync(join(home, "dev/tools"), { recursive: true });
});
afterAll(() => {
  process.env.HOME = before;
});

const app = startListApp(() => []);

/** The Folder field, once the page is drawn. */
async function field() {
  return (await screen.findByRole("textbox")) as HTMLInputElement;
}

/** Presses a key in the field. */
async function press(input: HTMLElement, key: string) {
  await act(async () => {
    fireEvent.keyDown(input, { key });
  });
}

/** The suggestions drawn under the field: one list item each, in order. */
async function suggestions() {
  return (await screen.findAllByRole("listitem")).map((item) => item.textContent ?? "");
}

test("with an empty list every page is the first run: the form, and no navigation", async () => {
  await app.open("/priorities");

  expect(await field()).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  // The field starts at the home folder, whose folders the human goes on from.
  expect((await field()).value).toMatch(/^~\/?$/);
});

test("typing completes folders, those in git marked, and a pick fills the field", async () => {
  await app.open("/");
  const input = await field();

  await type(input, "~/dev/to");

  await waitFor(async () => {
    const rows = await suggestions();
    expect(rows.some((row) => row.includes("todo-app") && row.includes("git"))).toBe(true);
    expect(rows.some((row) => row.includes("tools") && !row.includes("git"))).toBe(true);
    expect(rows.some((row) => row.includes("other-app"))).toBe(false);
  });
  const picked = (await screen.findAllByRole("listitem")).find((item) =>
    item.textContent?.includes("todo-app"),
  )!;
  await click(within(picked).getByText(/todo-app/));
  expect(input.value).toContain("todo-app");
});

test("a folder outside git is refused under the field, until the text changes", async () => {
  await app.open("/");
  const input = await field();
  await type(input, "~/dev/tools");

  await press(input, "Enter");

  // The refusal stays, nothing was added, and typing again takes it away.
  await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
  expect(await binding.readRepositories(app.dataDir)).toEqual([]);
  expect(window.location.pathname).toBe("/");
  await type(input, "~/dev/tools2");
  expect(input.getAttribute("aria-invalid")).not.toBe("true");
});

test("a path that is not absolute, or not there, is refused", async () => {
  await app.open("/");
  const input = await field();

  for (const text of ["dev/tools", "~/dev/nothing-here"]) {
    await type(input, text);
    await press(input, "Enter");
    await waitFor(() => expect(input.getAttribute("aria-invalid")).toBe("true"));
    expect(await binding.readRepositories(app.dataDir)).toEqual([]);
  }
});

test("Enter adds the folder and opens it, listed on the machine", async () => {
  await app.open("/");
  const input = await field();
  await type(input, "~/dev/todo-app");

  await press(input, "Enter");

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  expect((await binding.readRepositories(app.dataDir)).map((row) => row.name)).toEqual([
    "todo-app",
  ]);
});

/** The form of the heading's menu. */
async function openForm() {
  await click(await screen.findByRole("button", { name: /^Uraeda / }));
  const menu = within(await screen.findByRole("dialog"));
  await click(menu.getByText("Add a repository…"));
  return within(await screen.findByRole("dialog"));
}

test("Cancel on the menu's form closes it and adds nothing", async () => {
  await app.open("/r/todo-app/");
  const form = await openForm();
  await type(form.getByRole("textbox"), "~/dev/other-app");
  const buttons = form.getAllByRole("button");

  // Cancel comes before Add, the primary action, in the form's buttons.
  await click(buttons[0]);

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await binding.readRepositories(app.dataDir)).map((row) => row.name)).toEqual([
    "todo-app",
  ]);
});

test("the menu's form adds another repository and opens it", async () => {
  await app.open("/r/todo-app/");
  const form = await openForm();
  const input = form.getByRole("textbox");
  await type(input, "~/dev/other-app");

  await press(input, "Enter");

  await waitFor(() => expect(window.location.pathname).toBe("/r/other-app/"));
  expect((await binding.readRepositories(app.dataDir)).map((row) => row.name).sort()).toEqual([
    "other-app",
    "todo-app",
  ]);
});

test("adding a repository the list holds opens it, and holds it once", async () => {
  await app.open("/r/other-app/");
  const form = await openForm();
  const input = form.getByRole("textbox");
  await type(input, "~/dev/todo-app");

  await press(input, "Enter");

  await waitFor(() => expect(window.location.pathname).toBe("/r/todo-app/"));
  expect((await binding.readRepositories(app.dataDir)).length).toBe(2);
});
