// US1: a priority's or a note's pane opens to read, nothing focused, and Edit, in its bar, edits the
// line in place, and a drafted entry's text with it (C2). And the task view's own tests, moved here
// with it: its section, Delete with Undo, ‹ Previous / Next ›, and the line's field.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { runWrite } from "../writes/store.ts";
import {
  atRepo,
  atWidth,
  click,
  fixtureRepo,
  git,
  holding,
  read,
  renderPage,
  sent,
  serverFetch,
  type,
} from "./helpers.tsx";

const DRAFT = "specs/drafts/git-listener.md";

/** The pane beside the list, as it is drawn now. */
function detail() {
  return within(screen.getByRole("region", { name: "Detail" }));
}

/** The pane beside the list, once it is drawn. */
async function paneDrawn() {
  return within(await screen.findByRole("region", { name: "Detail" }));
}

/** A section's rows on the list beside the pane, by the section's title, once it is drawn. */
async function rows(title: string) {
  return within(await screen.findByRole("list", { name: `${title} lines` }));
}

/** Whether a text field has the focus: opening an entry never puts it in one (SC-005). */
function isFieldFocused() {
  return screen.queryAllByRole("textbox").some((field) => field === document.activeElement);
}

/** Presses Edit, in the pane's bar. */
async function pressEdit() {
  await click(await screen.findByRole("button", { name: "Edit" }));
}

/** Types a line's new text in its field, and presses a key. */
async function edit(text: string, key: string) {
  const field = screen.getByRole("textbox", { name: "Line" });
  await type(field, text);
  await act(async () => {
    fireEvent.keyDown(field, { key });
  });
}

/**
 * The Undo of the toast a Delete shows once the line is gone from the file. The toast hides by
 * itself after 5 seconds: a test takes its Undo at once, not after a wait.
 */
async function deleted() {
  await screen.findByText('Deleted "Nix + Docker based execution environments"', {
    ignore: "script, style, [aria-live]",
  });
  return screen.getByRole("button", { name: "Undo" });
}

test("a line without a draft opens its task view (US3 1)", async () => {
  await renderPage("/priorities");
  await click(await screen.findByRole("link", { name: /Claude Code runner/ }));
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
  expect(await screen.findByRole("radio", { checked: true, name: "Next" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Move up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Move down" })).toBeNull();
});

test("editing the line in place moves the address (US3 3)", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  await pressEdit();
  await edit("Claude Code runner", "Enter");
  await waitFor(() => expect(read(repo)).toContain("- Claude Code runner\n"));
  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/priorities/claude-code-runner")),
  );
  expect(await (await paneDrawn()).findByText("Claude Code runner")).toBeTruthy();
});

/** US1 1, SC-005 */
test("a click opens the pane to read", async () => {
  await renderPage("/priorities");

  await click(await (await rows("Next")).findByRole("link", { name: /Git listener process/ }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/priorities/git-listener")));
  expect(await (await paneDrawn()).findByText("Next · 2 of 2")).toBeTruthy();
  expect(detail().getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(detail().getByRole("link", { name: "Open draft" })).toBeTruthy();
  // The draft, drawn, with its slug and Start.
  expect(await (await paneDrawn()).findByRole("heading", { name: "What" })).toBeTruthy();
  expect(detail().getByRole("button", { name: "Start the feature" })).toBeTruthy();
  expect(detail().getByRole("textbox", { name: "Slug" })).toHaveProperty("value", "git-listener");
  expect(detail().queryByRole("textbox", { name: "Line" })).toBeNull();
  expect(isFieldFocused()).toBe(false);
  // One Close, the pane's.
  expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
});

/** US1 2, C2 */
test("Edit opens the line and the draft's text in place", async () => {
  const { repo } = await renderPage("/priorities/git-listener");

  await pressEdit();

  const line = (await paneDrawn()).getByRole("textbox", { name: "Line" });
  expect(line).toHaveProperty("value", "[Git listener process](drafts/git-listener.md)");
  expect(document.activeElement).toBe(line);
  // The draft's text loads after its line.
  const text = await (await paneDrawn()).findByRole("textbox", { name: "Text" });
  expect(text).toHaveProperty("value", read(repo, DRAFT));
  expect(text.getAttribute("rows")).toBe("20");
  expect(detail().getByText("Enter saves · Escape cancels")).toBeTruthy();
  expect(detail().getByRole("button", { name: "Commit" })).toBeTruthy();
});

/** US1 3, SC-001 */
test("Enter saves the line", async () => {
  const { repo } = await renderPage("/priorities/git-listener");
  await pressEdit();

  await edit("[Git listener](drafts/git-listener.md)", "Enter");

  await waitFor(() => expect(read(repo)).toContain("- [Git listener](drafts/git-listener.md)\n"));
  await waitFor(() => expect(detail().queryByRole("textbox", { name: "Line" })).toBeNull());
  expect(await (await rows("Next")).findByRole("link", { name: "Git listener" })).toBeTruthy();
  expect(await detail().findByText("Git listener")).toBeTruthy();
  expect(await screen.findByText("1 change to commit")).toBeTruthy();
  // The draft's text, unchanged, closed with the line.
  expect(detail().queryByRole("textbox", { name: "Text" })).toBeNull();
});

/** C2: the draft's text, What and Why, saved and committed from the pane. */
test("the draft's text saves in place, and commits", async () => {
  const { repo } = await renderPage("/priorities/git-listener");
  await pressEdit();
  const typed = read(repo, DRAFT).replace("Run the next step", "Run the agent's next step");
  // The draft's text loads after its line.
  const text = await (await paneDrawn()).findByRole("textbox", { name: "Text" });

  await type(text, typed);
  await act(async () => {
    fireEvent.keyDown(text, { ctrlKey: true, key: "Enter" });
  });

  await waitFor(() => expect(read(repo, DRAFT)).toBe(typed));
  await click(detail().getByRole("button", { name: "Commit" }));
  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "chore: edit the draft Git listener process",
    ),
  );
  expect(git(repo, "show", `HEAD:${DRAFT}`)).toBe(typed);
});

/** US1 4 */
test("Open draft opens the editor page", async () => {
  await renderPage("/priorities/git-listener");

  await click(await (await paneDrawn()).findByRole("link", { name: "Open draft" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${DRAFT}`)));
  expect(
    await screen.findByRole("heading", { level: 1, name: "Git listener process" }),
  ).toBeTruthy();
});

/** US1 7, and what a gate asks of the human. */
test("a running entry's pane", async () => {
  await renderPage("/priorities");

  await click(await (await rows("Ongoing")).findByRole("link", { name: /CLI TUIs/ }));

  expect(await (await paneDrawn()).findByText("Running")).toBeTruthy();
  expect(detail().getByText("Plan")).toBeTruthy();
  expect(detail().getByRole("link", { name: "Open the feature" })).toBeTruthy();
  expect(detail().queryByRole("radiogroup", { name: "Section" })).toBeNull();
  expect(detail().queryByRole("radio", { name: "Now" })).toBeNull();

  await click((await rows("Ongoing")).getByRole("link", { name: /Web UI for the workflow files/ }));
  expect(await (await paneDrawn()).findByText("Answer questions")).toBeTruthy();
});

/** US1 5 */
test("a note opens to read, with its children", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/INBOX.md"),
    read(repo, "specs/INBOX.md").replace(
      "- We need a home icon\n",
      "- We need a home icon\n  - in the sidebar's header\n",
    ),
  );
  await renderPage("/inbox", repo);

  await click(await screen.findByRole("link", { name: /We need a home icon/ }));

  expect(await (await paneDrawn()).findByText("Note, in No category")).toBeTruthy();
  expect(detail().getByText("in the sidebar's header")).toBeTruthy();
  expect(detail().getByRole("button", { name: "Edit" })).toBeTruthy();
  expect(detail().queryByRole("textbox", { name: "Note" })).toBeNull();
  expect(isFieldFocused()).toBe(false);
});

/** Edge case: a row left with unsaved text keeps it, restored as it shows again. */
test("another row with unsaved text", async () => {
  await renderPage("/priorities/claude-code-runner-triggered-manually");
  await pressEdit();
  await type(screen.getByRole("textbox", { name: "Line" }), "Claude Code runner, by hand");

  await click((await rows("Later")).getByRole("link", { name: /Nix \+ Docker/ }));
  expect(await (await paneDrawn()).findByText("Later · 1 of 1")).toBeTruthy();
  expect(detail().queryByRole("textbox", { name: "Line" })).toBeNull();
  await click((await rows("Next")).getByRole("link", { name: /Claude Code runner/ }));

  const line = await (await paneDrawn()).findByRole("textbox", { name: "Line" });
  expect(line).toHaveProperty("value", "Claude Code runner, by hand");
  expect(detail().getByText(/^Unsaved text restored from \d\d:\d\d\.$/)).toBeTruthy();
});

test("Escape keeps the text, and an empty line is refused", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  const before = read(repo);
  await pressEdit();
  await edit("Something else", "Escape");
  await answer("Discard");
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();
  expect(detail().getByText("Claude Code runner (triggered manually)")).toBeTruthy();
  expect(read(repo)).toBe(before);

  await pressEdit();
  await edit("  ", "Enter");
  expect(screen.getAllByText("A priority cannot be empty.").length).toBeGreaterThan(0);
  expect(screen.getByRole("textbox", { name: "Line" })).toBeTruthy();
  expect(read(repo)).toBe(before);
});

test("the section moves the line (US3 4)", async () => {
  const { repo } = await renderPage("/priorities/claude-code-runner-triggered-manually");
  await click(await screen.findByRole("radio", { name: "Later" }));
  await waitFor(() =>
    expect(read(repo)).toContain(
      "  - with a cache\n- Claude Code runner (triggered manually)\n\n## Blocked",
    ),
  );
  expect(await screen.findByRole("radio", { checked: true, name: "Later" })).toBeTruthy();
});

test("Next › walks the section, disabled on the last (US3 6)", async () => {
  await renderPage("/priorities/claude-code-runner-triggered-manually");
  expect((await screen.findByRole("button", { name: "‹ Previous" })).hasAttribute("disabled")).toBe(
    true,
  );
  await click(screen.getByRole("button", { name: "Next ›" }));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/priorities/git-listener")));
  expect(await screen.findByRole("heading", { name: "What" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next ›" }).hasAttribute("disabled")).toBe(true);
});

test("a reload shows the same line (US3 7)", async () => {
  const repo = fixtureRepo();
  await renderPage("/priorities/claude-code-runner-triggered-manually", repo);
  expect(await (await paneDrawn()).findByText("Next · 1 of 2")).toBeTruthy();
  await renderPage(window.location.pathname, repo, { reload: true });
  expect(window.location.pathname).toBe(
    atRepo("/priorities/claude-code-runner-triggered-manually"),
  );
  expect(
    await (await paneDrawn()).findByText("Claude Code runner (triggered manually)"),
  ).toBeTruthy();
});

test("a removed line says so", async () => {
  await renderPage("/priorities/nope");
  expect(await screen.findByText("This line is no longer in PRIORITIES.md.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the priorities" })).toBeTruthy();
});

test("a refused Undo says so", async () => {
  const repo = fixtureRepo();
  const server = serverFetch(repo);
  // The file changes after the Undo read it, before its insert arrives: the core refuses it.
  const racing: typeof fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("priorities.insert")) {
      writeFileSync(join(repo, "specs/PRIORITIES.md"), `${read(repo)}\n- Added elsewhere\n`);
    }
    return server(input, init);
  };
  await renderPage("/priorities/nix-docker-based-execution-environments", repo, { fetch: racing });
  await click(await screen.findByRole("button", { name: "Delete" }));
  await click(await deleted());
  const message =
    'Could not restore "Nix + Docker based execution environments": PRIORITIES.md changed on disk.';
  // In the page, not a toast: the UI behaviour decision keeps errors out of toasts alone.
  const main = within(screen.getByRole("main"));
  await main.findByText(message);
  const banner = main.getAllByRole("alert").find((alert) => alert.textContent?.includes(message))!;
  expect(banner).toBeTruthy();
  expect(read(repo)).not.toContain("Nix + Docker");

  await click(within(banner).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText(message)).toBeNull();
});

test("Undo puts the line back at its place in the file as it is now (edge case)", async () => {
  const { repo } = await renderPage("/priorities/nix-docker-based-execution-environments");
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("## Later\n\n", "## Later\n\n- Added elsewhere\n"),
  );
  await click(undo);
  await waitFor(() =>
    expect(read(repo)).toContain(
      "- Nix + Docker based execution environments\n  - with a cache\n- Added elsewhere\n",
    ),
  );
});

test("Delete, then Undo, puts the line and its nested line back (US4 9)", async () => {
  const { repo } = await renderPage("/priorities/nix-docker-based-execution-environments");
  const before = read(repo);
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  expect(read(repo)).not.toContain("with a cache");
  expect(window.location.pathname).toBe(atRepo("/priorities"));
  await click(undo);
  await waitFor(() => expect(read(repo)).toBe(before));
});

test("Delete, then Undo, puts the line back exactly as written, marker and wrapping kept", async () => {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace(
      "- Nix + Docker based execution environments\n",
      "* Nix + Docker based\n  execution environments\n",
    ),
  );
  const before = read(repo);
  await renderPage("/priorities/nix-docker-based-execution-environments", repo);
  await click(await screen.findByRole("button", { name: "Delete" }));
  const undo = await deleted();
  expect(read(repo)).not.toContain("with a cache");
  await click(undo);
  await waitFor(() => expect(read(repo)).toBe(before));
});

/** The line of US2 5 to 7, first in Next, and its longer text. */
const NPX = "Run the web UI with npx";
const LONGER = `${NPX}, and a version check`;

const lineField = () => screen.getByRole("textbox", { name: "Line" }) as HTMLInputElement;

/** Answers "Discard your changes?" with one of its buttons, and waits for it to close. */
async function answer(button: "Discard" | "Keep editing") {
  const dialog = await screen.findByRole("dialog", { name: "Discard your changes?" });
  expect(within(dialog).getByText("The text you typed is deleted.")).toBeTruthy();
  await click(within(dialog).getByRole("button", { name: button }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull(),
  );
}

/** The task view of "Run the web UI with npx", its line open and changed to the longer text. */
async function npxChanged(repo = fixtureRepo()) {
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("Claude Code runner (triggered manually)", NPX),
  );
  await renderPage("/priorities/run-the-web-ui-with-npx", repo);
  await pressEdit();
  await type(lineField(), LONGER);
  return repo;
}

/** US2 5 */
test("a line left for elsewhere stays open with its text, and is not saved", async () => {
  const repo = await npxChanged();
  const before = read(repo);

  await act(async () => {
    fireEvent.blur(lineField());
  });

  expect(sent.filter((body) => body.includes("priorities.edit"))).toEqual([]);
  expect(lineField().value).toBe(LONGER);
  expect(screen.getByText("Unsaved changes")).toBeTruthy();
  expect(read(repo)).toBe(before);
});

/** US2 6 */
test.each(["Enter", "Save"])("%s saves the line, and closes it", async (how) => {
  const repo = await npxChanged();

  if (how === "Enter") {
    await act(async () => {
      fireEvent.keyDown(lineField(), { key: "Enter" });
    });
  } else {
    await click(screen.getByRole("button", { name: "Save" }));
  }

  await waitFor(() => expect(read(repo)).toContain(`- ${LONGER}\n`));
  expect(await (await paneDrawn()).findByText(LONGER)).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();
});

test("Enter during a composition does not save the line", async () => {
  const repo = await npxChanged();
  const before = read(repo);

  await act(async () => {
    fireEvent.keyDown(lineField(), { isComposing: true, key: "Enter" });
  });

  expect(sent.filter((body) => body.includes("priorities.edit"))).toEqual([]);
  expect(lineField().value).toBe(LONGER);
  expect(read(repo)).toBe(before);
});

/** US2 7 */
test.each(["Escape", "Cancel"])("%s on a changed line asks first", async (how) => {
  const repo = await npxChanged();
  const before = read(repo);
  const cancel = async () => {
    if (how === "Escape") {
      await act(async () => {
        fireEvent.keyDown(lineField(), { key: "Escape" });
      });
    } else {
      await click(screen.getByRole("button", { name: "Cancel" }));
    }
  };

  await cancel();
  await answer("Keep editing");
  expect(lineField().value).toBe(LONGER);

  await cancel();
  await answer("Discard");
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();
  expect(detail().getByText(NPX)).toBeTruthy();
  expect(read(repo)).toBe(before);
});

/** US2 8 */
test("an unchanged line's Save is disabled, and Cancel closes it without asking", async () => {
  await renderPage("/priorities/claude-code-runner-triggered-manually");
  await pressEdit();

  expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Unsaved changes")).toBeNull();
  await click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();
});

/** US5 1 and 2, on a line */
test("a line's unsaved text is restored after a reload, and Discard drops it", async () => {
  const repo = await npxChanged();

  forgetUnsaved();
  await renderPage(window.location.pathname, repo, { reload: true });

  await screen.findByRole("textbox", { name: "Line" });
  expect(lineField().value).toBe(LONGER);
  // The notice's Discard, not the bar's, which discards the uncommitted priorities.
  let notice = screen.getByText(/^Unsaved text restored from \d\d:\d\d\.$/);
  while (!within(notice).queryByRole("button", { name: "Discard" })) {
    notice = notice.parentElement!;
  }
  await click(within(notice).getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("textbox", { name: "Line" })).toBeNull();

  forgetUnsaved();
  await renderPage(window.location.pathname, repo, { reload: true });
  expect(await (await paneDrawn()).findByText(NPX)).toBeTruthy();
  expect(screen.queryByText(/^Unsaved text restored/)).toBeNull();
});

const slug = () => screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;

/** R2: Escape on a changed slug asks first. */
test("Escape on a changed slug asks first", async () => {
  await renderPage("/priorities/git-listener");
  await type(await screen.findByRole("textbox", { name: "Slug" }), "listener");
  const escape = () =>
    act(async () => {
      fireEvent.keyDown(slug(), { key: "Escape" });
    });

  await escape();
  await answer("Keep editing");
  expect(slug().value).toBe("listener");

  await escape();
  await answer("Discard");
  expect(slug().value).toBe("git-listener");
});

/** US1 6: on a phone, the entry's page, to read, Edit at its top, and no keyboard. */
test("on a phone, the page opens to read", async () => {
  atWidth(402);
  try {
    await renderPage("/priorities");

    await click(await (await rows("Next")).findByRole("link", { name: /Git listener process/ }));

    expect(await screen.findByText("Next · 2 of 2")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Detail" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(isFieldFocused()).toBe(false);
  } finally {
    atWidth(1024);
  }
});

/** UI behaviour (R17): the pane's git writes say what they do at once, with a spinner. */
test.each([
  ["Start the feature", "Starting the feature…", '"feature.start"'],
  ["Commit", "Committing…", '"text.commit"'],
])("the pane's %s reads %s at once", async (label, running, mutation) => {
  const repo = fixtureRepo();
  const held = await holding(repo, mutation);
  try {
    await renderPage("/priorities/git-listener", repo, { agent: held.fake, fetch: held.fetch });
    await pressEdit();

    await click(await (await paneDrawn()).findByRole("button", { name: label }));

    const button = detail().getByRole("button", { name: running });
    expect(button.querySelector('[role="status"]')).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Saving to git" })).toBeTruthy();
  } finally {
    held.release();
  }
});

/** UI behaviour (R17): while any git write runs, the pane's are blocked, and stay focusable. */
test("another git write blocks the pane's Commit and Start the feature", async () => {
  await renderPage("/priorities/git-listener");
  await pressEdit();
  const pane = await paneDrawn();
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;
  act(() => {
    write = runWrite({ label: "Committing…" }, () => done.promise);
  });
  try {
    for (const name of ["Commit", "Start the feature"]) {
      expect(pane.getByRole("button", { name }).getAttribute("aria-disabled")).toBe("true");
    }
  } finally {
    await act(async () => {
      done.resolve(true);
      await write;
    });
  }
  expect(pane.getByRole("button", { name: "Commit" }).getAttribute("aria-disabled")).not.toBe(
    "true",
  );
});
