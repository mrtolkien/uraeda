// Flow: the draft editor. A line becomes a draft, whose text saves only on an explicit action, byte
// for byte; unsaved text is kept and restored; a save over a change made elsewhere is refused and
// the text kept; images move a draft to its folder without losing what was typed; Start makes the
// feature. Each test starts from the committed repository, and asserts the files on disk.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import { click, git, quiet, read, refreshUntil, startApp, type } from "./harness.tsx";

const LISTENER = "specs/drafts/git-listener.md";
const MOVED = "specs/drafts/git-listener/proposal.md";
const FRONTMATTER =
  "---\ndiscovery: high # low, medium, or high: how far the agent researches before asking\n---\n\n";

const app = startApp();

let base = "";
beforeEach(() => {
  base ||= git(app.repo, "rev-parse", "HEAD").trim();
  git(app.repo, "reset", "--hard", "--quiet", base);
  git(app.repo, "clean", "-fdq", "specs");
});

/** The text box of the editor. */
const text = () => screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;

/** Taps Edit on the proposal drawn, and returns its text box. */
async function edit() {
  await click(await screen.findByRole("button", { name: "Edit" }));
  return text();
}

/** Presses the editor's Save. */
const save = () => click(screen.getByRole("button", { name: "Save" }));

/** The page again, as after a reload: the store reads `localStorage` anew. */
async function reload() {
  forgetUnsaved();
  cleanup();
  await app.open(window.location.pathname, { raw: true });
}

/** The proposal of a folder draft. */
function folderDraft(body = "# Login error banner\n\n## What\n\nThe banner.\n") {
  const path = "specs/drafts/login-banner/proposal.md";
  mkdirSync(join(app.repo, "specs/drafts/login-banner"), { recursive: true });
  writeFileSync(join(app.repo, path), body);
  return path;
}

/** A PNG, as the picker gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Picks files with "Add image", as the system's picker gives them. */
async function pick(files: Array<File>) {
  const input = screen.getByLabelText("Add image", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** The app's fetch, whose uploads wait until the test lets each one through. */
function holdUploads() {
  const waiting: Array<() => void> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "object" && "url" in input ? input.url : input.toString();
    if (url.includes("/attach?")) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    return app.fetch(input, init);
  };
  return {
    fetch,
    async release() {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      await act(async () => waiting.shift()!());
    },
    waiting,
  };
}

test("Draft turns a line into a linked draft and opens its editor, and is refused once the priorities changed", async () => {
  await app.open("/priorities/claude-code-runner-triggered-manually");
  await click(await screen.findByRole("button", { name: "Draft" }));

  const path = "specs/drafts/claude-code-runner-triggered-manually.md";
  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/edit/${path}`)));
  expect(read(app.repo, path)).toContain("# Claude Code runner (triggered manually)\n");
  expect(read(app.repo)).toContain(
    "[Claude Code runner (triggered manually)](drafts/claude-code-runner-triggered-manually.md)",
  );
  expect(git(app.repo, "status", "--porcelain")).toContain("PRIORITIES.md");
  expect(await screen.findByRole("textbox", { name: "Text" })).toBeTruthy();

  // Another page changed the priorities before the click: nothing is drafted.
  git(app.repo, "reset", "--hard", "--quiet", base);
  git(app.repo, "clean", "-fdq", "specs");
  cleanup();
  await app.open("/priorities/claude-code-runner-triggered-manually");
  const draft = await screen.findByRole("button", { name: "Draft" });
  writeFileSync(
    join(app.repo, "specs/PRIORITIES.md"),
    read(app.repo).replace("## Next\n\n", "## Next\n\n- Other\n"),
  );
  await click(draft);
  await quiet();
  expect(existsSync(join(app.repo, "specs/drafts/other.md"))).toBe(false);
  expect(window.location.pathname).toBe(
    app.path("/priorities/claude-code-runner-triggered-manually"),
  );
});

test("a draft is saved as typed, byte for byte, only by Save or Ctrl+Enter", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);

  const typed = "# Git listener process\n\n## What\n\nRun  the next step,\twith tabs.\n";
  await type(field, typed);
  // Typing writes nothing: the text waits for an explicit action.
  await quiet();
  expect(read(app.repo, LISTENER)).not.toBe(typed);
  await save();
  await waitFor(() => expect(read(app.repo, LISTENER)).toBe(typed));

  await type(field, "# Git listener process\n\nSaved with the key.\n");
  await act(async () => {
    fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" });
  });
  await waitFor(() =>
    expect(read(app.repo, LISTENER)).toBe("# Git listener process\n\nSaved with the key.\n"),
  );
});

test("the discovery effort goes in the frontmatter, which saves keep, and quick changes land in order", async () => {
  const body = read(app.repo, LISTENER);
  writeFileSync(join(app.repo, LISTENER), `${FRONTMATTER}${body}`);
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  // The box starts at the proposal's title: the frontmatter is the control's.
  expect(field.value).toBe(body);

  await click(await screen.findByRole("radio", { name: "Low" }));
  await waitFor(() => expect(read(app.repo, LISTENER)).toMatch(/^---\ndiscovery: low/));
  const set = read(app.repo, LISTENER);
  await type(field, `${body}\nMore.\n`);
  await save();
  await waitFor(() => expect(read(app.repo, LISTENER)).toBe(`${set}\nMore.\n`));
});

test("quick discovery changes and Commit all land in order, the last change committed", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  // Each click draws, none waits for the write before it, and the last state is the one kept.
  await type(field, "# Git listener process\n\n## What\n\nTyped.\n");
  for (const control of [
    screen.getByRole("radio", { name: "Medium" }),
    screen.getByRole("radio", { name: "Low" }),
    screen.getByRole("button", { name: "Commit" }),
  ]) {
    act(() => control.click());
  }
  await waitFor(() => expect(git(app.repo, "rev-parse", "HEAD").trim()).not.toBe(base));
  expect(git(app.repo, "show", `HEAD:${LISTENER}`)).toMatch(/discovery: low/);
  expect(git(app.repo, "show", `HEAD:${LISTENER}`)).toContain("Typed.");
  expect(read(app.repo, LISTENER)).toBe(git(app.repo, "show", `HEAD:${LISTENER}`));
});

test("typed text is kept, never saved by time or a read, and restored after a reload until discarded", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  const before = read(app.repo, LISTENER);
  const typed = "# Git listener process\n\nNot saved yet.\n";
  await type(field, typed);
  // Another file changes, and the page reads again: the text is neither saved nor replaced.
  writeFileSync(
    join(app.repo, "specs/PRIORITIES.md"),
    read(app.repo).replace("- Claude", "- Codex"),
  );
  await refreshUntil(() => expect(text().value).toBe(typed));
  expect(read(app.repo, LISTENER)).toBe(before);
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);

  await reload();

  // A restored text opens to be edited, not drawn, and says it was restored.
  expect(
    (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement,
  ).toHaveProperty("value", typed);
  expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  await click(screen.getByRole("button", { name: "Discard" }));
  expect(text().value).toBe(before);
  await reload();
  expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
  expect(read(app.repo, LISTENER)).toBe(before);
});

test("a slug typed is kept after a reload, and leaving the editor with it asks first", async () => {
  await app.open(`/edit/${LISTENER}`);
  await type(await screen.findByLabelText("Slug"), "listener");

  await reload();

  expect(await screen.findByLabelText("Slug")).toHaveProperty("value", "listener");
  await act(async () => navigate(app.path("/priorities/git-listener")));
  // The slug is unsaved: leaving asks, and Stay keeps the page.
  const stay = await screen.findAllByRole("button", { name: /stay/i });
  await click(stay.at(-1)!);
  expect(window.location.pathname).toBe(app.path(`/edit/${LISTENER}`));
  await act(async () => navigate(app.path("/priorities/git-listener")));
  const leave = await screen.findAllByRole("button", { name: /leave/i });
  await click(leave.at(-1)!);
  await waitFor(() => expect(window.location.pathname).toBe(app.path("/priorities/git-listener")));
});

test("a save over a change made elsewhere is refused, the text kept, and the new version is offered", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  writeFileSync(join(app.repo, LISTENER), "# Changed elsewhere\n");

  await type(field, "# Mine\n");
  await save();

  const load = await screen.findByRole("button", { name: "Load the new version" });
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(read(app.repo, LISTENER)).toBe("# Changed elsewhere\n");
  expect(text().value).toBe("# Mine\n");

  await click(load);
  await waitFor(() => expect(text().value).toBe("# Changed elsewhere\n"));
  await type(text(), "# Changed elsewhere\n\nMore.\n");
  await save();
  await waitFor(() => expect(read(app.repo, LISTENER)).toBe("# Changed elsewhere\n\nMore.\n"));
});

test("Commit saves the text typed and commits it with the priorities changed; it stops when the text cannot be saved", async () => {
  writeFileSync(
    join(app.repo, "specs/PRIORITIES.md"),
    read(app.repo).replace("- Claude Code", "- Claude Code!"),
  );
  await app.open(`/edit/${LISTENER}`);
  const typed = "# Git listener process\n\n## What\n\nCommitted as typed.\n";
  await type(await edit(), typed);

  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() => expect(git(app.repo, "rev-parse", "HEAD").trim()).not.toBe(base));
  expect(git(app.repo, "show", `HEAD:${LISTENER}`)).toBe(typed);
  expect(
    git(app.repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort(),
  ).toEqual(["specs/PRIORITIES.md", LISTENER].sort());
  expect(git(app.repo, "status", "--porcelain")).toBe("");
});

test("Commit stops when the text shown could not be saved, and commits nothing", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  writeFileSync(join(app.repo, LISTENER), "# Theirs\n");
  const head = git(app.repo, "rev-parse", "HEAD");
  await type(field, "# Mine\n");
  await click(screen.getByRole("button", { name: "Commit" }));
  await quiet();
  expect(git(app.repo, "rev-parse", "HEAD")).toBe(head);
  expect(read(app.repo, LISTENER)).toBe("# Theirs\n");
});

test("Start turns a draft into a feature in its own worktree, placeholders and all", async () => {
  writeFileSync(
    join(app.repo, LISTENER),
    "# Git listener process\n\n## What\n\n[What the feature does, from the user's point of view.]\n",
  );
  await app.open(`/edit/${LISTENER}`);
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start the feature" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(/\/f\/\d{4}-\d\d-\d\d-git-listener$/),
  );
  const folder = window.location.pathname.split("/f/")[1];
  expect(existsSync(join(app.repo, `.worktrees/${folder}/specs/${folder}/proposal.md`))).toBe(true);
  expect(git(app.repo, "branch", "--show-current").trim()).toBe("main");
  expect(git(app.repo, "show", "main:specs/PRIORITIES.md")).toContain(
    `(/specs/${folder}/proposal.md)`,
  );
});

test("an image moves the draft to its folder, with the text typed and the frontmatter kept", async () => {
  const body = read(app.repo, LISTENER);
  writeFileSync(join(app.repo, LISTENER), `${FRONTMATTER}${body}`);
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  await type(field, `${body}\nTyped first.\n`);
  field.setSelectionRange(field.value.length, field.value.length);

  await pick([png("login.png")]);

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/edit/${MOVED}`)));
  await waitFor(() =>
    expect(read(app.repo, MOVED)).toBe(
      `${FRONTMATTER}${body}\nTyped first.\n\n![login](images/login.webp)\n`,
    ),
  );
  expect(existsSync(join(app.repo, "specs/drafts/git-listener/images/login.webp"))).toBe(true);
  expect(existsSync(join(app.repo, LISTENER))).toBe(false);
  expect(read(app.repo)).toContain("(drafts/git-listener/proposal.md)");
  // Everything typed was saved with the image: nothing is left unsaved.
  await reload();
  await screen.findByRole("button", { name: "Edit" });
  expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
});

test("a file over 20 MB is refused before it is uploaded, and an image waits for the text to be saved", async () => {
  await app.open(`/edit/${LISTENER}`);
  const field = await edit();
  const before = field.value;

  await pick([new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]);

  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(field.value).toBe(before);
  expect(existsSync(join(app.repo, "specs/drafts/git-listener"))).toBe(false);

  // A text that cannot be saved takes no image over it.
  writeFileSync(join(app.repo, LISTENER), "# Theirs\n");
  await type(field, "# Mine\n");
  await pick([png("login.png")]);
  await quiet();
  expect(existsSync(join(app.repo, "specs/drafts/git-listener"))).toBe(false);
  expect(read(app.repo, LISTENER)).toBe("# Theirs\n");
});

test("a file changed elsewhere during an upload is a conflict and is never overwritten", async () => {
  const path = folderDraft();
  const held = holdUploads();
  await app.open(`/edit/${path}`, { fetch: held.fetch });
  await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  writeFileSync(join(app.repo, path), "# Theirs\n");
  await refreshUntil(() => expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy());
  await held.release();

  expect(await screen.findByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(read(app.repo, path)).toBe("# Theirs\n");
});

test("images added during an upload all go to the folder the first made, and an upload ending after the page was left saves its link", async () => {
  const held = holdUploads();
  await app.open(`/edit/${LISTENER}`, { fetch: held.fetch });
  await edit();

  await pick([png("one.png")]);
  await pick([png("two.png")]);
  await held.release();
  await held.release();

  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/edit/${MOVED}`)));
  await waitFor(() =>
    expect(read(app.repo, MOVED)).toContain("![one](images/one.webp)\n\n![two](images/two.webp)\n"),
  );
  expect(existsSync(join(app.repo, "specs/drafts/git-listener/images/two.webp"))).toBe(true);

  await quiet();
});

test("an upload that ends after the page was left saves its link where the draft moved", async () => {
  const again = holdUploads();
  await app.open(`/edit/${LISTENER}`, { fetch: again.fetch });
  await edit();
  await pick([png("login.png")]);
  await waitFor(() => expect(again.waiting).toHaveLength(1));
  await act(async () => navigate(app.path("/")));
  // The editor is gone before the upload ends: the page is left, whatever the transition's pace.
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull());
  await again.release();
  await waitFor(() => expect(read(app.repo, MOVED)).toContain("![login](images/login.webp)"));
  expect(window.location.pathname).toBe(app.path("/"));
  await quiet();
});

test("text typed during an upload shows saving, leaving the page asks, and it is saved once the upload ends", async () => {
  const path = folderDraft();
  const held = holdUploads();
  await app.open(`/edit/${path}`, { fetch: held.fetch });
  const field = await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await type(field, "# Login error banner\n\n## What\n\nThe banner, typed.\n");

  // The browser asks before the tab goes: the text is not safe yet.
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  await held.release();
  await waitFor(() =>
    expect(read(app.repo, path)).toContain("typed.\n\n![login](images/login.webp)"),
  );
});
