// US3 4 and review focus 4, on the real priorities page: `K J H L` and Shift with the arrows move
// the focused card itself, with the write a drag makes, and a bare arrow moves the selection and
// writes nothing. Each test has a repository of its own, given the priorities below.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

atSize("desktop");

/** Now holds two lines, Next three, and Later one: the focus starts on Next's second. */
const PRIORITIES = `# Priorities

## Now

- Now line 1
- Now line 2

## Next

- Next line 1
- Next line 2
- Next line 3

## Later

- Later line 1
`;

const LINE = "Next line 2";

/** The lines of a section of the priorities file, as it holds them now. */
async function section(title: string) {
  const text = await commands.readRepo();
  const start = text.indexOf(`## ${title}`);
  const next = text.indexOf("\n## ", start + 1);
  return text
    .slice(start, next === -1 ? undefined : next)
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

/** Opens the page with the focus on the card of `line`, `LINE` by default. */
async function onLine(line = LINE) {
  await commands.writeRepo(PRIORITIES, "specs/PRIORITIES.md");
  await show("/priorities", line);
  const link = screen
    .getAllByRole("link", { name: new RegExp(line) })
    .find((one) => one.closest("[data-row]") !== null) as HTMLElement;
  link.focus();
  expect(document.activeElement).toBe(link);
}

test("K moves the line above the one before it, as a drag would write it", async () => {
  await onLine();

  await userEvent.keyboard("{Shift>}K{/Shift}");

  await expect.poll(() => section("Next")).toEqual(["Next line 2", "Next line 1", "Next line 3"]);
});

test("J moves the line one place down", async () => {
  await onLine();

  await userEvent.keyboard("{Shift>}J{/Shift}");

  await expect.poll(() => section("Next")).toEqual(["Next line 1", "Next line 3", "Next line 2"]);
});

test("J pressed twice at once moves the line two places down: the second waits for the first write (R9)", async () => {
  await onLine("Next line 1");

  await userEvent.keyboard("JJ");

  await expect.poll(() => section("Next")).toEqual(["Next line 2", "Next line 3", "Next line 1"]);
});

test("L moves the line to the end of the next section, Later", async () => {
  await onLine();

  await userEvent.keyboard("{Shift>}L{/Shift}");

  await expect.poll(() => section("Later")).toEqual(["Later line 1", "Next line 2"]);
  expect(await section("Next")).toEqual(["Next line 1", "Next line 3"]);
});

test("H moves the line to the end of the previous section, Now", async () => {
  await onLine();

  await userEvent.keyboard("{Shift>}H{/Shift}");

  await expect.poll(() => section("Now")).toEqual(["Now line 1", "Now line 2", "Next line 2"]);
  expect(await section("Next")).toEqual(["Next line 1", "Next line 3"]);
});

test("Shift with an arrow is the same move as its letter", async () => {
  await onLine();

  await userEvent.keyboard("{Shift>}{ArrowUp}{/Shift}");

  await expect.poll(() => section("Next")).toEqual(["Next line 2", "Next line 1", "Next line 3"]);
});

test("a bare arrow moves the selection, and writes nothing", async () => {
  await onLine();
  const before = await commands.readRepo();

  await userEvent.keyboard("{ArrowUp}");

  await waitFor(() => expect(document.activeElement?.textContent).toContain("Next line 1"));
  expect(await commands.readRepo()).toBe(before);
});
