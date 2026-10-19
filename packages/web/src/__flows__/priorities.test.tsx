// Flow: the priorities page and the quick add. A line is groomed in place, in a pane the address
// holds; text saves only on an explicit action and is kept when left; a write to git shows at once
// and blocks every other; a change made elsewhere refuses a write and the list reads again. The
// tests take their turn on one repository: each uses the line of its own, or follows the one before.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { dropIndex, dropMove } from "../drop.ts";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { runWrite } from "../writes/store.ts";
import { click, git, holding, lastCommit, read, startApp, type } from "./harness.tsx";

const PATH = "specs/PRIORITIES.md";
const RUNNER = "claude-code-runner-triggered-manually";
const NIX = "nix-docker-based-execution-environments";

const app = startApp();

/** Presses a key on an element. */
async function press(element: Element, key: string, options: object = {}) {
  await act(async () => {
    fireEvent.keyDown(element, { key, ...options });
  });
}

/** Opens a section's Add row, types a line, and presses Enter. */
async function add(section: string, text: string) {
  await click(await screen.findByRole("button", { name: `Add to ${section}` }));
  const field = screen.getByRole("textbox", { name: `Add to ${section}` });
  await type(field, text);
  await press(field, "Enter");
}

/** The rows' links of the list, those that open a pane. */
function paneLinks() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith(app.path("/priorities/")));
}

/** The pane beside the list. */
async function pane() {
  return within(await screen.findByRole("region", { name: "Detail" }));
}

/** The text field of the Add row of Later. */
const field = () => screen.getByRole("textbox", { name: "Add to Later" }) as HTMLInputElement;

/** Answers the dialog that asks to discard, with one of its buttons, and waits for it to go. */
async function answer(button: string) {
  const buttons = await screen.findAllByRole("button", { name: button });
  await click(buttons.at(-1)!);
}

test("a line opens in a pane the address holds, and a reload shows the same line", async () => {
  await app.open("/priorities");
  await screen.findAllByRole("link");

  await click(paneLinks().find((link) => link.getAttribute("href")?.endsWith(RUNNER))!);

  expect(window.location.pathname).toBe(app.path(`/priorities/${RUNNER}`));
  expect(await (await pane()).findByRole("button", { name: "Edit" })).toBeTruthy();
  // Nothing in the pane is a text field until Edit: opening to read puts no focus in one.
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();

  await app.open(window.location.pathname, { raw: true, reload: true });
  expect(await (await pane()).findByRole("button", { name: "Edit" })).toBeTruthy();
  expect(window.location.pathname).toBe(app.path(`/priorities/${RUNNER}`));
});

test("a started entry opens its feature from the pane, and offers no section to move", async () => {
  await app.open("/priorities");
  await screen.findAllByRole("link");
  const started = paneLinks().find((l) => l.getAttribute("href")?.endsWith("/priorities/cli-tuis"));

  await click(started!);

  const detail = await pane();
  const feature = await detail.findByRole("link", { name: /feature/i });
  expect(feature.getAttribute("href")).toBe(app.path("/f/2026-10-12-cli-tuis"));
  expect(detail.queryAllByRole("radio")).toHaveLength(0);
});

test("an Add row adds the line to the file and stays ready for the next", async () => {
  await app.open("/priorities");

  await add("Later", "Ship a TUI");

  await waitFor(() =>
    expect(read(app.repo).split("## Later")[1].split("## Blocked")[0]).toContain("- Ship a TUI\n"),
  );
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Add to Later" })).toHaveProperty("value", ""),
  );
  // Added, never committed by itself.
  expect(git(app.repo, "status", "--porcelain")).toContain("PRIORITIES.md");
});

test("Commit makes one commit of the priorities alone, whatever else changed", async () => {
  writeFileSync(join(app.repo, "README.md"), "# Changed\n");
  await app.open("/priorities");

  await click(await screen.findByRole("button", { name: "Commit" }));

  await waitFor(() => expect(lastCommit(app.repo)).toContain("Ship a TUI"));
  expect(git(app.repo, "show", "--name-only", "--format=", "HEAD").trim()).toBe(PATH);
  expect(git(app.repo, "status", "--porcelain")).toContain("README.md");
  rmSync(join(app.repo, "README.md"));
});

test("Discard asks, and brings the committed priorities back", async () => {
  await app.open("/priorities");
  const committed = read(app.repo);
  await add("Later", "A line to throw away");
  await waitFor(() => expect(read(app.repo)).not.toBe(committed));

  await click(await screen.findByRole("button", { name: "Discard" }));
  await answer("Discard them");

  await waitFor(() => expect(read(app.repo)).toBe(committed));
});

test("text in an Add row is kept when left, and Cancel asks before dropping it", async () => {
  await app.open("/priorities");
  const before = read(app.repo);
  await click(await screen.findByRole("button", { name: "Add to Later" }));
  await type(field(), "Typed, not saved");

  await act(async () => {
    fireEvent.blur(field());
  });
  // Leaving the field saves nothing: only an explicit action writes.
  expect(read(app.repo)).toBe(before);
  expect(field().value).toBe("Typed, not saved");

  await click(screen.getByRole("button", { name: "Cancel" }));
  await answer("Discard");
  expect(screen.queryByRole("textbox", { name: "Add to Later" })).toBeNull();
  expect(read(app.repo)).toBe(before);
});

test("editing a line in place saves on Enter, moves the address, and Escape asks first", async () => {
  await app.open(`/priorities/${RUNNER}`);
  await click(await screen.findByRole("button", { name: "Edit" }));
  const field = await screen.findByRole("textbox", { name: "Line" });

  // Escape on a changed line asks, and keeps the file as it was.
  const before = read(app.repo);
  await type(field, "Something else");
  await press(field, "Escape");
  await answer("Discard");
  expect(read(app.repo)).toBe(before);

  await click(await screen.findByRole("button", { name: "Edit" }));
  const again = await screen.findByRole("textbox", { name: "Line" });
  await type(again, "  ");
  await press(again, "Enter");
  // A blank line is refused, in the page, and the file keeps the line.
  expect(read(app.repo)).toBe(before);
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);

  await type(again, "Claude Code runner");
  await press(again, "Enter");
  await waitFor(() => expect(read(app.repo)).toContain("- Claude Code runner\n"));
  await waitFor(() =>
    expect(window.location.pathname).toBe(app.path("/priorities/claude-code-runner")),
  );
});

test("the section chosen in the pane moves the line to it", async () => {
  await app.open("/priorities/claude-code-runner");

  await click(await screen.findByRole("radio", { name: "Later" }));

  await waitFor(() =>
    expect(read(app.repo).split("## Later")[1].split("## Blocked")[0]).toContain(
      "- Claude Code runner\n",
    ),
  );
  expect(await screen.findByRole("radio", { checked: true, name: "Later" })).toBeTruthy();
});

test("Delete removes the line, and Undo puts it back as written, nested line and all", async () => {
  const before = read(app.repo);
  await app.open(`/priorities/${NIX}`);

  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  expect(read(app.repo)).not.toContain("Nix + Docker");
  expect(read(app.repo)).not.toContain("with a cache");

  await click(undo);

  await waitFor(() => expect(read(app.repo)).toBe(before));
});

test("Undo puts the line back where the file has it now, keeping a change made meanwhile", async () => {
  await app.open(`/priorities/${NIX}`);
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await screen.findByRole("button", { name: "Undo" });
  writeFileSync(
    join(app.repo, PATH),
    read(app.repo).replace("## Later\n\n", "## Later\n\n- Added elsewhere\n"),
  );

  await click(undo);

  await waitFor(() => expect(read(app.repo)).toContain("Nix + Docker"));
  expect(read(app.repo)).toContain("- Added elsewhere\n");
  git(app.repo, "checkout", "--", PATH);
});

test("an Undo the core refuses says so in the page, not only in a toast, until dismissed", async () => {
  // The file changes after the Undo read it, before its insert arrives: the core refuses it.
  const racing: typeof fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("priorities.insert")) {
      writeFileSync(join(app.repo, PATH), `${read(app.repo)}\n- Added elsewhere\n`);
    }
    return app.fetch(input, init);
  };
  await app.open(`/priorities/${NIX}`, { fetch: racing });
  await click(await screen.findByRole("button", { name: "Delete" }));

  await click(await screen.findByRole("button", { name: "Undo" }));

  const banner = await waitFor(() => {
    const found = screen
      .getAllByRole("alert")
      .find((alert) => within(alert).queryByRole("button", { name: "Dismiss" }));
    expect(found).toBeTruthy();
    return found!;
  });
  expect(read(app.repo)).not.toContain("Nix + Docker");
  await click(within(banner).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryAllByRole("button", { name: "Dismiss" })).toHaveLength(0);
  git(app.repo, "checkout", "--", PATH);
});

test("an add over a change made elsewhere is refused, keeps its text, and the list reads again", async () => {
  await app.open("/priorities");
  await screen.findAllByRole("link");
  writeFileSync(join(app.repo, PATH), read(app.repo).replace("Git listener", "Git watcher"));

  await add("Later", "Never written");

  const field = screen.getByRole("textbox", { name: "Add to Later" });
  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(field).toHaveProperty("value", "Never written");
  expect(read(app.repo)).not.toContain("Never written");
  // The list reads the file again: the line changed elsewhere shows.
  await waitFor(() =>
    expect(paneLinks().some((l) => /watcher/i.test(l.textContent ?? ""))).toBe(true),
  );
  git(app.repo, "checkout", "--", PATH);
});

test("a drag's order gives the core's move, and a drop where it started gives none", () => {
  const before = { next: ["e"], now: ["a", "b", "c", "d"] };
  expect(dropMove(before, { next: ["e"], now: ["a", "d", "b", "c"] }, "d")).toEqual({
    index: 1,
    section: "now",
  });
  expect(dropMove(before, { next: ["a", "e"], now: ["b", "c", "d"] }, "a")).toEqual({
    index: 0,
    section: "next",
  });
  expect(dropMove(before, before, "c")).toBeUndefined();
  expect(dropIndex({ index: 0, section: "next" }, { index: 2, section: "next" })).toBe(1);
});

/** Opens the quick add's form from the page's ＋ and returns its line. */
async function quickAdd() {
  await click(await screen.findByRole("button", { name: "Add to the priorities" }));
  const form = within(await screen.findByRole("dialog"));
  return { field: await form.findByLabelText("Priority"), form };
}

test("＋ adds a line to Next without committing; Enter adds and commits, and Undo removes it", async () => {
  await app.open("/");
  const head = lastCommit(app.repo);
  const { field, form } = await quickAdd();
  await type(field, "A quick line");
  await click(form.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(read(app.repo)).toContain("- A quick line\n"));
  expect(lastCommit(app.repo)).toBe(head);

  git(app.repo, "checkout", "--", PATH);
  await app.open("/", { reload: true });
  const second = await quickAdd();
  await type(second.field, "A committed line");
  await press(second.field, "Enter");
  await waitFor(() => expect(lastCommit(app.repo)).toContain("A committed line"));
  expect(git(app.repo, "status", "--porcelain")).toBe("");

  await click(await screen.findByRole("button", { name: "Undo" }));
  await waitFor(() => expect(read(app.repo)).not.toContain("A committed line"));
  expect(git(app.repo, "status", "--porcelain")).toBe("");
});

test("a file with other changes only adds, and a refused commit says why in the form", async () => {
  const hook = join(app.repo, ".git/hooks/pre-commit");
  mkdirSync(join(app.repo, ".git/hooks"), { recursive: true });
  writeFileSync(hook, "#!/bin/sh\necho 'refused by a hook' >&2\nexit 1\n");
  chmodSync(hook, 0o755);
  await app.open("/");
  const { field, form } = await quickAdd();
  await type(field, "Hooked line");
  const head = lastCommit(app.repo);

  await click(form.getByRole("button", { name: "Add and commit" }));

  // The line stays written, the commit refused, the form open to say so next to its action.
  await waitFor(() => expect(read(app.repo)).toContain("- Hooked line\n"));
  await waitFor(() => expect(form.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(lastCommit(app.repo)).toBe(head);
  expect(screen.getByRole("dialog")).toBeTruthy();
  git(app.repo, "checkout", "--", PATH);
  writeFileSync(hook, "#!/bin/sh\nexit 0\n");
});

test("＋ keeps its text: Cancel asks, Close keeps it, and a reload restores it", async () => {
  await app.open("/");
  const { field } = await quickAdd();
  await type(field, "An idea");

  await click(screen.getByRole("button", { name: "Cancel" }));
  await answer("Keep editing");
  expect((screen.getByLabelText("Priority") as HTMLTextAreaElement).value).toBe("An idea");

  await click(await screen.findByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByLabelText("Priority")).toBeNull());

  forgetUnsaved();
  await app.open("/", { reload: true });
  await quickAdd();
  expect((screen.getByLabelText("Priority") as HTMLTextAreaElement).value).toBe("An idea");
  // The restored text says so, as the page does for every field it restores.
  expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
});

test("a git write shows its action at once, sends one request, and the others wait", async () => {
  await app.open("/");
  const held = holding('"priorities.add"');
  const { field, form } = await quickAdd();
  await type(field, "Held line");

  await press(field, "Enter");

  // At once, before the server answers: a running action with a progress, never a guess.
  expect(form.getByRole("button", { name: "Committing…" })).toBeTruthy();
  expect(screen.getByRole("progressbar")).toBeTruthy();
  await press(field, "Enter");
  expect(held.seen()).toBe(1);

  await act(async () => held.release());
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  await waitFor(() => expect(lastCommit(app.repo)).toContain("Held line"));
});

test("another git write blocks the buttons that write to git, and Enter, until it ends", async () => {
  await app.open("/");
  const { field, form } = await quickAdd();
  await type(field, "Blocked line");
  const head = lastCommit(app.repo);
  const done = Promise.withResolvers<boolean>();
  let other: Promise<boolean> | undefined;
  act(() => {
    other = runWrite({ label: "Committing…" }, () => done.promise);
  });

  const commit = form.getByRole("button", { name: "Add and commit" });
  expect(commit.getAttribute("aria-disabled")).toBe("true");
  await click(commit);
  await press(field, "Enter");
  expect(lastCommit(app.repo)).toBe(head);

  await act(async () => {
    done.resolve(true);
    await other;
  });
  expect(commit.getAttribute("aria-disabled")).not.toBe("true");
});
