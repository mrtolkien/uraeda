import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { startFeature } from "uraeda-binding";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import {
  answered,
  answersSoFar,
  atRepo,
  click,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  read,
  renderPage,
  sent,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-12");

afterEach(() => {
  vi.useRealTimers();
});

/** Taps Edit on a written proposal, drawn, and returns its text field (US5 5). */
async function edit() {
  await click(await screen.findByRole("button", { name: "Edit" }));
  return screen.getByRole("textbox", { name: "Text" });
}

/** Presses the editor's Save. */
const saveText = () => click(screen.getByRole("button", { name: "Save" }));

/** The page shown again, as after a reload: the store reads `localStorage` anew. */
async function reload(path: string, repo: string) {
  forgetUnsaved();
  await renderPage(path, repo, { reload: true });
}

/** US4.1 */
test("Draft turns a line into a draft, linked, and opens its editor", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));

  await click(await screen.findByRole("button", { name: "Draft" }));

  const path = "specs/drafts/claude-code-runner-triggered-manually.md";
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${path}`)));
  expect(readFileSync(join(repo, path), "utf8")).toMatch(
    /\n---\n\n# Claude Code runner \(triggered manually\)\n/,
  );
  expect(readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8")).toContain(
    "- [Claude Code runner (triggered manually)](drafts/claude-code-runner-triggered-manually.md)",
  );
  expect(git(repo, "status", "--porcelain")).toContain("PRIORITIES.md");
  expect(await screen.findByRole("textbox", { name: "Text" })).toBeTruthy();
});

/** Codex review: Draft drafts the line the human saw, or nothing. */
test("Draft is refused once the priorities changed elsewhere", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  const draft = await screen.findByRole("button", { name: "Draft" });
  const file = join(repo, "specs/PRIORITIES.md");
  // Another line takes `next-1` before the click.
  writeFileSync(file, readFileSync(file, "utf8").replace("## Next\n\n", "## Next\n\n- Other\n"));

  await click(draft);

  expect(await screen.findByText(/PRIORITIES.md changed/)).toBeTruthy();
  expect(existsSync(join(repo, "specs/drafts/other.md"))).toBe(false);
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
});

/** US5 3 */
test("a new draft shows its hints, which are not in the file (US5 3)", async () => {
  const { repo } = await renderPage("/");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  await click(await screen.findByRole("button", { name: "Draft" }));
  expect(await screen.findByText("The problem it solves, and for whom.")).toBeTruthy();
  expect(read(repo, "specs/drafts/claude-code-runner-triggered-manually.md")).not.toContain(
    "The problem it solves",
  );
});

/** US5 5 */
test("a written proposal opens drawn, with Edit (US5 5)", async () => {
  await renderPage("/edit/specs/drafts/git-listener.md");
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
});

/** US4.2 */
test("a draft is saved as typed, byte for byte", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();

  const typed = "# Git listener process\n\n## What\n\nRun  the next step,\twith tabs.\n";
  await type(field, typed);
  await saveText();

  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(typed),
  );
});

test("the discovery effort is set in the proposal's frontmatter", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = join(repo, "specs/drafts/git-listener.md");
  const before = readFileSync(file, "utf8");
  await edit();

  await click(await screen.findByRole("radio", { name: "Medium" }));

  await waitFor(() =>
    expect(readFileSync(file, "utf8")).toBe(`---\ndiscovery: medium\n---\n\n${before}`),
  );
});

/** Codex review: discovery changes wait for the saves before them, and Commit for them. */
test("quick discovery changes and Commit all land, in order", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = join(repo, "specs/drafts/git-listener.md");
  const field = await edit();
  await type(field, "# Git listener process\n\n## What\n\nTyped.\n");

  // Each click draws, and none waits for the write before it.
  for (const control of [
    screen.getByRole("radio", { name: "Medium" }),
    screen.getByRole("radio", { name: "Low" }),
    screen.getByRole("button", { name: "Commit" }),
  ]) {
    act(() => control.click());
  }

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  const committed = "---\ndiscovery: low\n---\n\n# Git listener process\n\n## What\n\nTyped.\n";
  expect(readFileSync(file, "utf8")).toBe(committed);
  expect(git(repo, "show", "HEAD:specs/drafts/git-listener.md")).toBe(committed);
  expect(screen.queryByText(/changed/)).toBeNull();
});

/** US4.3 */
test("a draft is committed with the priorities it changed", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    readFileSync(join(repo, "specs/PRIORITIES.md"), "utf8").replace(
      "- Claude Code",
      "- Claude Code!",
    ),
  );
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\nMore.\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  expect(await screen.findByText("Your 1 priority change is committed with it.")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  expect(git(repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort()).toEqual([
    "specs/PRIORITIES.md",
    "specs/drafts/git-listener.md",
  ]);
});

/** Codex review: Commit stops when the text shown could not be saved. */
test("Commit stops when the text could not be saved", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  const file = join(repo, "specs/drafts/git-listener.md");
  writeFileSync(file, "# Theirs\n");
  const before = git(repo, "rev-parse", "HEAD");

  await type(field, "# Mine\n");
  await click(screen.getByRole("button", { name: "Commit" }));

  expect(await screen.findByText(/nothing was committed/)).toBeTruthy();
  expect(git(repo, "rev-parse", "HEAD")).toBe(before);
});

/** Codex review: a draft changed elsewhere shows when the page comes back. */
test("a draft changed elsewhere shows when the page reads again", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  const file = join(repo, "specs/drafts/git-listener.md");
  writeFileSync(file, "# Theirs\n");

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await waitFor(() => expect(field.value).toBe("# Theirs\n"));
  await type(field, "# Theirs, and mine\n");
  await saveText();
  await waitFor(() => expect(readFileSync(file, "utf8")).toBe("# Theirs, and mine\n"));
});

/** US2 3: the text changed is kept, not saved, however long it waits. */
test("the text changed is not saved as time passes, and says so (US2 3)", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = join(repo, "specs/drafts/git-listener.md");
  const before = read(repo, "specs/drafts/git-listener.md");
  const field = await edit();

  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await type(field, "# Git listener process\n\n## What\n\nTyped.\n");
  vi.advanceTimersByTime(5000);
  vi.useRealTimers();
  // Another file changes, and the page reads again.
  writeFileSync(join(repo, "specs/PRIORITIES.md"), read(repo).replace("- Claude Code", "- Codex"));
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await answered("Draft", from);

  expect(readFileSync(file, "utf8")).toBe(before);
  expect((field as HTMLTextAreaElement).value).toBe(
    "# Git listener process\n\n## What\n\nTyped.\n",
  );
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
});

/** US2 4 */
test("Commit saves the text typed, then commits it (US2 4)", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const typed = "# Git listener process\n\n## What\n\nCommitted as typed.\n";
  await type(await edit(), typed);

  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  expect(git(repo, "show", "HEAD:specs/drafts/git-listener.md")).toBe(typed);
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});

/** US2 8, and the field's own key. */
test("Save and Ctrl+Enter save the text, and Save waits for a change", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const file = "specs/drafts/git-listener.md";
  const field = await edit();
  expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);

  await type(field, "# Git listener process\n\nSaved.\n");
  await saveText();
  await waitFor(() => expect(read(repo, file)).toBe("# Git listener process\n\nSaved.\n"));
  expect(await screen.findByText("saved ✓")).toBeTruthy();

  await type(field, "# Git listener process\n\nSaved with the key.\n");
  await act(async () => {
    fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" });
  });
  await waitFor(() =>
    expect(read(repo, file)).toBe("# Git listener process\n\nSaved with the key.\n"),
  );
});

/** US5 1 and 2, for the editor: its text comes back after a reload, with the notice. */
test("the editor's unsaved text is restored after a reload, with the notice", async () => {
  const path = "/edit/specs/drafts/git-listener.md";
  const { repo } = await renderPage(path);
  await type(await edit(), "# Git listener process\n\nNot saved yet.\n");

  await reload(path, repo);

  // A restored text opens to be edited, not drawn.
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  expect(field.value).toBe("# Git listener process\n\nNot saved yet.\n");
  expect(screen.getByText(/^Unsaved text restored from \d\d:\d\d\.$/)).toBeTruthy();
  expect(screen.getByText("Unsaved changes")).toBeTruthy();

  await click(screen.getByRole("button", { name: "Discard" }));
  expect(field.value).toBe(read(repo, "specs/drafts/git-listener.md"));
  await reload(path, repo);
  expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
  expect(screen.queryByText(/Unsaved text restored/)).toBeNull();
});

/** The slug, a field of the store too: typed, it is kept, here and on the line's page. */
test("the slug typed is restored after a reload, and on the line's page", async () => {
  const path = "/edit/specs/drafts/git-listener.md";
  const { repo } = await renderPage(path);
  await type(await screen.findByLabelText("Slug"), "listener");

  await reload(path, repo);

  expect(await screen.findByLabelText("Slug")).toHaveProperty("value", "listener");
  expect(screen.getByText(/^Unsaved text restored from \d\d:\d\d\.$/)).toBeTruthy();
  await act(async () => navigate(atRepo("/priorities/git-listener")));
  // The slug is unsaved: leaving the editor asks first.
  await click(
    within(await screen.findByRole("dialog", { name: "Leave page?" })).getByRole("button", {
      name: "Leave page",
    }),
  );
  // The line's page, with its own Delete.
  await screen.findByRole("button", { name: "Delete" });
  expect(screen.getByLabelText("Slug")).toHaveProperty("value", "listener");
});

/** US4.4 */
test("Start turns a draft into a feature in its own worktree", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  await type(await screen.findByLabelText("Slug"), "git-listener");

  await click(screen.getByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-git-listener")));
  expect(
    existsSync(
      join(repo, ".worktrees/2026-10-12-git-listener/specs/2026-10-12-git-listener/proposal.md"),
    ),
  ).toBe(true);
  expect(git(repo, "branch", "--show-current").trim()).toBe("main");
  expect(git(repo, "show", "main:specs/PRIORITIES.md")).toContain(
    "- [Git listener process](/specs/2026-10-12-git-listener/proposal.md)",
  );
});

/** US4.5 */
/** Review C2: the proposal is freeform, so Start starts any draft. */
test("a draft with the template's placeholders starts", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/drafts/git-listener.md"),
    "# Git listener process\n\n## What\n\n[What the feature does, from the user's point of view.]\n\n## Why\n\n[The problem it solves, and for whom.]\n",
  );
  await renderPage("/edit/specs/drafts/git-listener.md", repo);

  await click(await screen.findByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-12-git-listener")));
  expect(git(repo, "branch", "--list", "2026-10-12-git-listener").trim()).not.toBe("");
});

test("a save over a change made elsewhere keeps the text, and offers the new version", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");

  await type(field, "# Mine\n");
  await saveText();

  expect(
    await screen.findByText(
      "git-listener.md changed on disk since you opened it. Your text was not saved.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy my text" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
    "# Changed elsewhere\n",
  );
});

/** Review C1: the new version replaces the text, and a later save does not undo it. */
test("Load the new version loads it", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Changed elsewhere\n");
  await type(field, "# Mine\n");
  await saveText();
  await screen.findByRole("button", { name: "Load the new version" });

  await click(screen.getByRole("button", { name: "Load the new version" }));

  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Changed elsewhere\n",
    ),
  );
  await type(screen.getByRole("textbox", { name: "Text" }), "# Changed elsewhere\n\nMore.\n");
  await saveText();
  await waitFor(() =>
    expect(readFileSync(join(repo, "specs/drafts/git-listener.md"), "utf8")).toBe(
      "# Changed elsewhere\n\nMore.\n",
    ),
  );
});

/** Picks files with "Add image", as the system's picker gives them. */
async function pick(files: Array<File>) {
  const input = screen.getByLabelText("Add image", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** US1.6 */
test("a draft that gets an image opens at its folder's proposal", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  field.setSelectionRange(field.value.length, field.value.length);
  const bytes = readFileSync(fixture("images/phone.png"));

  await pick([new File([bytes], "login.png", { type: "image/png" })]);

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${moved}`)));
  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Git listener process\n\n## What\n\nRun the next step when a branch changes.\n\n## Why\n\nSo agents start without me.\n\n![login](images/login.webp)\n",
    ),
  );
  await waitFor(() => expect(read(repo, moved)).toContain("![login](images/login.webp)"));
  expect(existsSync(join(repo, "specs/drafts/git-listener/images/login.webp"))).toBe(true);
  expect(existsSync(join(repo, "specs/drafts/git-listener.md"))).toBe(false);
  expect(read(repo)).toContain("(drafts/git-listener/proposal.md)");
});

/** Review focus 12: a slow upload over the limit may fail before the server's refusal arrives. */
test("a file over 20 MB is refused before it is uploaded", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = (await edit()) as HTMLTextAreaElement;
  const before = field.value;

  await pick([new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })]);

  expect(
    (await screen.findAllByText("This image is over 20 MB: big.png is 20.1 MB.")).length,
  ).toBeGreaterThan(0);
  expect(sent.some((request) => request.includes("/attach"))).toBe(false);
  expect(field.value).toBe(before);
  expect(existsSync(join(repo, "specs/drafts/git-listener"))).toBe(false);
});

/** The login banner's proposal, a folder draft, written in a repository: its path. */
function proposal(repo: string, text = "# Login error banner\n\n## What\n\nThe banner.\n") {
  const path = "specs/drafts/login-banner/proposal.md";
  mkdirSync(join(repo, "specs/drafts/login-banner"), { recursive: true });
  writeFileSync(join(repo, path), text);
  return path;
}

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

/** A PNG, as the picker gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/**
 * The server in process, whose uploads wait until the test lets each one through: what happens
 * during an upload.
 */
function holdUploads(repo: string, fetch = serverFetch(repo)) {
  const waiting: Array<() => void> = [];
  return {
    fetch: (async (input, init) => {
      if (urlOf(input).includes("/attach?")) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return fetch(input, init);
    }) as typeof globalThis.fetch,
    waiting,
    /** Lets the next upload through, once it waits. */
    async release() {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      await act(async () => waiting.shift()!());
    },
  };
}

/** Review: a version read during an upload is not taken as the one the save is made over. */
test("a file changed elsewhere during an upload is a conflict, not overwritten", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const held = holdUploads(repo);
  await renderPage(`/edit/${path}`, repo, { fetch: held.fetch });
  await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  writeFileSync(join(repo, path), "# Theirs\n");
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await answered("Draft", from);
  await held.release();

  expect(await screen.findByRole("button", { name: "Load the new version" })).toBeTruthy();
  expect(read(repo, path)).toBe("# Theirs\n");
});

/** Review: a second drop during an upload goes to the folder the first one made. */
test("images added during an upload to a single-file draft all go to its new folder", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("one.png")]);
  await pick([png("two.png")]);
  await held.release();
  await held.release();

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${moved}`)));
  await waitFor(() =>
    expect(read(repo, moved)).toContain("![one](images/one.webp)\n\n![two](images/two.webp)\n"),
  );
  expect(existsSync(join(repo, "specs/drafts/git-listener/images/two.webp"))).toBe(true);
  // The last status shows on the page at the new path.
  expect(screen.getAllByText("Added two.webp").length).toBeGreaterThan(0);
});

/** Review: a draft's page is kept while its images upload, though the draft moved meanwhile. */
test("the editor keeps its draft while the images upload, though it moved", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("one.png")]);
  await pick([png("two.png")]);
  await held.release();
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  // The draft moved: read again, its old path holds nothing, and fate keeps the draft read last.
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await waitFor(() => expect(answersSoFar()).toBeGreaterThan(from));
  await act(() => new Promise((resolve) => setTimeout(resolve)));

  expect(screen.queryByText(/No draft/)).toBeNull();
  expect(screen.getByRole("textbox", { name: "Text" })).toBeTruthy();
  await held.release();
  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/git-listener/proposal.md")),
  );
});

/** Review: an upload that ends after the human left saves its link, and leaves them there. */
test("an upload that ends after the page was left saves its link, where it moved", async () => {
  const repo = fixtureRepo();
  const held = holdUploads(repo);
  await renderPage("/edit/specs/drafts/git-listener.md", repo, { fetch: held.fetch });
  await edit();

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await act(async () => navigate("/"));
  await held.release();

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(read(repo, moved)).toContain("![login](images/login.webp)"));
  expect(window.location.pathname).toBe(atRepo("/"));
});

/** Review: what is typed during an upload is saved once it ends, and leaving before asks. */
test("typing during an upload shows saving, and leaving the page asks", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const held = holdUploads(repo);
  await renderPage(`/edit/${path}`, repo, { fetch: held.fetch });
  const field = await screen.findByRole("textbox", { name: "Text" });

  await pick([png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await type(field, "# Login error banner\n\n## What\n\nThe banner, typed.\n");

  expect(screen.getByText("saving…")).toBeTruthy();
  const leaving = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(leaving);
  expect(leaving.defaultPrevented).toBe(true);
  await held.release();
  await waitFor(() => expect(read(repo, path)).toContain("typed.\n\n![login](images/login.webp)"));
  await waitFor(() => expect(screen.getByText("saved ✓")).toBeTruthy());
});

/** Review focus 1, for the editor: an image saves the text typed with it, and keeps nothing. */
test("an image saves the text typed with it, and leaves nothing unsaved", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  await renderPage(`/edit/${path}`, repo);
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  await type(field, "# Login error banner\n\n## What\n\nTyped first.\n");
  field.setSelectionRange(field.value.length, field.value.length);

  await pick([png("login.png")]);

  await waitFor(() =>
    expect(read(repo, path)).toBe(
      "# Login error banner\n\n## What\n\nTyped first.\n\n![login](images/login.webp)\n",
    ),
  );
  await reload(`/edit/${path}`, repo);
  await screen.findByRole("textbox", { name: "Text" });
  expect(screen.queryByText(/Unsaved text restored/)).toBeNull();
});

/** Review: an image is not added over a text that could not be saved, and says so. */
test("an image is refused while the text is not saved, and added once reloaded", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
  const field = await edit();
  writeFileSync(join(repo, "specs/drafts/git-listener.md"), "# Theirs\n");
  await type(field, "# Mine\n");

  await pick([png("login.png")]);

  expect(
    (await screen.findAllByText("Your text is not saved: the image was not added.")).length,
  ).toBeGreaterThan(0);
  expect(sent.some((request) => request.includes("/attach"))).toBe(false);

  await click(screen.getByRole("button", { name: "Load the new version" }));
  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement).value).toBe(
      "# Theirs\n",
    ),
  );
  await pick([png("login.png")]);
  await waitFor(() =>
    expect(read(repo, "specs/drafts/git-listener/proposal.md")).toBe(
      "# Theirs\n\n![login](images/login.webp)\n",
    ),
  );
});

test.each([
  [
    "an error page",
    () =>
      new Response("<h1>Bad gateway</h1>", {
        headers: { "content-type": "text/html" },
        status: 502,
      }),
    "The image could not be added (HTTP 502).",
  ],
  [
    "the guard's refusal",
    () =>
      new Response("Forbidden site", { headers: { "content-type": "text/plain" }, status: 403 }),
    "Forbidden site",
  ],
  [
    "no answer",
    () => {
      throw new TypeError("Failed to fetch");
    },
    "Could not reach the Uraeda server.",
  ],
])("an upload that gets %s says so under the field", async (_, answer, message) => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const server = serverFetch(repo);
  const fetch: typeof globalThis.fetch = async (input, init) =>
    urlOf(input).includes("/attach?") ? answer() : server(input, init);
  await renderPage(`/edit/${path}`, repo, { fetch });
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
  expect(field.value).toBe(before);
});

/** Review: an upload the server never answers ends, with a refusal, instead of holding Submit. */
test("an upload the server does not answer in time says so under the field", async () => {
  const repo = fixtureRepo();
  const path = proposal(repo);
  const server = serverFetch(repo);
  // What the upload's time limit does: its signal aborts the request, which rejects so.
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (!urlOf(input).includes("/attach?")) {
      return server(input, init);
    }
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
  await renderPage(`/edit/${path}`, repo, { fetch });
  const field = (await screen.findByRole("textbox", { name: "Text" })) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect(
    (await screen.findAllByText("The image could not be added: the server did not answer in time."))
      .length,
  ).toBeGreaterThan(0);
  expect(field.value).toBe(before);
});

/** Edge case: an image added while the feature's agent works is refused, as every write. */
test("an image added while the feature's agent works is refused under the field", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const { folder } = await startFeature(repo, "specs/drafts/git-listener.md", "git-listener");
  const session = await fake.sessions.featureSession(repo, folder);
  await fake.sessions.send(repo, session.id, {
    text: "Continue the feature.",
    workflow: { trigger: "manual" },
  });
  await renderPage(`/edit/specs/${folder}/proposal.md`, repo, { agent: fake });
  const field = (await edit()) as HTMLTextAreaElement;
  const before = field.value;

  await pick([png("login.png")]);

  expect(
    (
      await screen.findAllByText(
        "An agent is working on this feature. Stop it first, or wait for it.",
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(field.value).toBe(before);
  expect(sent.some((request) => request.includes("/attach"))).toBe(true);
});

test("a feature's committed proposal is edited and committed in its worktree", async () => {
  const repo = fixtureRepo();
  git(repo, "branch", "2026-10-14-runner", "main");
  git(repo, "worktree", "add", "--quiet", ".worktrees/2026-10-14-runner", "2026-10-14-runner");
  const worktree = join(repo, ".worktrees/2026-10-14-runner");
  const proposal = join(worktree, "specs/2026-10-14-runner/proposal.md");
  mkdirSync(join(proposal, ".."), { recursive: true });
  writeFileSync(proposal, "# Runner\n\n## What\n\nRun.\n\n## Why\n\nSpeed.\n");
  git(worktree, "add", "--all");
  git(worktree, "commit", "--quiet", "--no-verify", "--message", "chore(runner): proposal");
  await renderPage("/edit/specs/2026-10-14-runner/proposal.md", repo);

  await type(await edit(), "# Runner\n\n## What\n\nRun agents.\n\n## Why\n\nSpeed.\n");
  await click(screen.getByRole("button", { name: "Commit" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", "2026-10-14-runner").trim()).toBe(
      "chore(runner): edit the proposal",
    ),
  );
  expect(readFileSync(proposal, "utf8")).toContain("Run agents.");
});

/** C2 and R1: the pane's editor and the editor page hold one unsaved text, `<path>#editor`. */
test("the draft's text typed in the pane opens on the editor page", async () => {
  const typed = "# Git listener process\n\n## What\n\nTyped in the pane.\n";
  await renderPage("/priorities/git-listener");
  await click(await screen.findByRole("button", { name: "Edit" }));
  await type(screen.getByRole("textbox", { name: "Text" }), typed);

  await click(screen.getByRole("link", { name: "Open draft" }));
  await click(
    within(await screen.findByRole("dialog", { name: "Leave page?" })).getByRole("button", {
      name: "Leave page",
    }),
  );

  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/git-listener.md")),
  );
  expect(await screen.findByRole("textbox", { name: "Text" })).toHaveProperty("value", typed);
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
});
