// Flow: the inbox. A note is added from the form, moved, edited, deleted, and sent to the
// priorities or a draft from its pane, in the files and uncommitted until the one bar commits; an
// Undo puts back only what it changed; a change made elsewhere refuses a write and the page reads
// again. Each test starts from the committed repository, and asserts the files, never the words.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, lastCommit, read, startApp, type } from "./harness.tsx";

const INBOX = "specs/INBOX.md";
const PRIORITIES = "specs/PRIORITIES.md";
const LOOK = "specs/drafts/look-and-feel.md";
const LOOK_TEXT =
  "# Look and feel pass\n\n## What\n\nA pass over the app's spacing and icons.\n\n## Why\n\nIt looks unfinished.\n";
const HOME_ICON = "we-need-a-home-icon";
const MOBILE = "draft-to-proposal-on-mobile-went-404";

/** The fixture repository with a committed draft to add notes to. */
function repository() {
  const repo = fixtureRepo();
  writeFileSync(join(repo, LOOK), LOOK_TEXT);
  git(repo, "add", LOOK);
  git(repo, "commit", "--quiet", "--no-verify", "--message", "docs: look and feel");
  return repo;
}

const app = startApp({ repo: repository });

// Each test starts from the committed files, as a human who committed or discarded would.
let base = "";
beforeEach(() => {
  base ||= git(app.repo, "rev-parse", "HEAD").trim();
  git(app.repo, "reset", "--hard", "--quiet", base);
  git(app.repo, "clean", "-fdq", "specs");
});

async function press(element: Element, key: string) {
  await act(async () => {
    fireEvent.keyDown(element, { key });
  });
}

/** The dialog of the form to add a note. */
async function openForm() {
  await click(await screen.findByRole("button", { name: "Add a note to the inbox" }));
  const form = within(await screen.findByRole("dialog", { name: /note/i }));
  return form;
}

/** The form's note field. */
function field(form: ReturnType<typeof within>) {
  return form.getAllByRole("textbox")[0];
}

/** Picks a category in the form's category menu. */
async function pick(form: ReturnType<typeof within>, category: string) {
  await click(form.getByRole("combobox"));
  await click(await screen.findByRole("option", { name: category }));
}

/** Adds a note through the form, in a category when given. */
async function addNote(text: string, category?: string) {
  const form = await openForm();
  await type(field(form), text);
  if (category) {
    await pick(form, category);
  }
  await click(form.getByRole("button", { name: "Add" }));
  return form;
}

/** The text of the section `## <name>` of a file. */
function section(text: string, name: string) {
  return text.split(`## ${name}\n`)[1]?.split("\n## ")[0] ?? "";
}

/** Opens a menu of the note's pane by its button, and picks one of its items. */
async function choose(menu: string, item: string) {
  await click(await screen.findByRole("button", { name: menu }));
  await click(await screen.findByRole("menuitem", { name: item }));
}

/** Picks the category a note moves to in its pane. */
async function moveTo(category: string) {
  await click(await screen.findByRole("combobox"));
  await click(await screen.findByRole("option", { name: category }));
}

/** Picks a draft in the note's "Add to a draft" list. */
async function addToDraft(filter: string, title: string) {
  await click(await screen.findByRole("button", { name: "Add to a draft" }));
  await type(await screen.findByPlaceholderText(/draft/i), filter);
  await click(await screen.findByRole("option", { name: title }));
}

/** Shows another page of the repository, as a link followed in the app would. */
async function go(path: string) {
  cleanup();
  await app.open(path);
}

/** The Undo of the last write, once the file holds it. */
const undo = () => screen.findByRole("button", { name: "Undo" });

test("a note added in a category ends it, and Undo puts the file back as it was", async () => {
  await app.open("/inbox");
  const before = read(app.repo, INBOX);

  await addNote("The plan's task list scrolls under the top bar", "UI");

  await waitFor(() =>
    expect(read(app.repo, INBOX)).toContain(
      "- Text input feels laggy on the sessions page\n- The plan's task list scrolls under the top bar\n\n## CLI\n",
    ),
  );
  // Added, never committed by itself.
  expect(git(app.repo, "status", "--porcelain")).toContain("INBOX.md");
  expect(await screen.findByText(/task list scrolls/)).toBeTruthy();

  await click(await undo());
  await waitFor(() => expect(read(app.repo, INBOX)).toBe(before));
});

test("a note with no category goes before the first one, a new category at the end", async () => {
  await app.open("/inbox");
  await addNote("Sessions need a model selector");
  await waitFor(() =>
    expect(read(app.repo, INBOX)).toContain(
      "- We need a home icon\n- Sessions need a model selector\n\n## UI\n",
    ),
  );

  const form = await openForm();
  await type(field(form), "Folding is slow");
  await pick(form, "New category…");
  await type(form.getByRole("textbox", { name: /name/i }), "Editor");
  await click(form.getByRole("button", { name: "Add" }));

  await waitFor(() =>
    expect(read(app.repo, INBOX)).toMatch(
      /- Make sure agents are resumable\n\n## Editor\n\n- Folding is slow\n$/,
    ),
  );
});

test("a note added from a feature's page is marked with that feature's slug", async () => {
  await app.open("/f/2026-10-12-cli-tuis");

  await addNote("The x is not centered");

  await waitFor(() =>
    expect(read(app.repo, INBOX)).toContain(
      "- We need a home icon\n- [cli-tuis] The x is not centered\n",
    ),
  );
});

test("a blank note cannot be added; the form keeps its text when closed, and Cancel asks", async () => {
  await app.open("/inbox");
  let form = await openForm();
  const add = () => form.getByRole("button", { name: "Add" });
  expect(add()).toHaveProperty("disabled", true);
  await type(field(form), "   ");
  expect(add()).toHaveProperty("disabled", true);
  await type(field(form), "A half-typed note");
  expect(add()).toHaveProperty("disabled", false);

  // Closed, the form keeps its text and asks nothing; nothing was written.
  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  form = await openForm();
  expect(field(form)).toHaveProperty("value", "A half-typed note");
  expect(git(app.repo, "status", "--porcelain")).toBe("");

  // Cancel asks first, and once confirmed drops the text.
  await click(form.getByRole("button", { name: "Cancel" }));
  const buttons = await screen.findAllByRole("button", { name: "Discard" });
  await click(buttons.at(-1)!);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  form = await openForm();
  expect(field(form)).toHaveProperty("value", "");
});

/** Picks an image in the form, as the system's picker gives it. */
async function attachImage(form: ReturnType<typeof within>) {
  const bytes = readFileSync(fixture("images/phone.png"));
  const input = form.getByLabelText(/attach/i, { selector: "input" });
  await act(async () => {
    fireEvent.change(input, {
      target: { files: [new File([bytes], "headings.png", { type: "image/png" })] },
    });
  });
}

test("a note with an image becomes a draft with the image, and Undo takes both back out", async () => {
  await app.open("/inbox");
  const before = read(app.repo, INBOX);
  const form = await openForm();
  await type(field(form), "Headings are flat");
  await attachImage(form);

  // The image is kept as the form closes and opens again: the human did not drop it.
  await click(form.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const again = await openForm();
  await click(again.getByRole("button", { name: "Add as a draft" }));

  await waitFor(() =>
    expect(existsSync(join(app.repo, "specs/drafts/headings-are-flat/proposal.md"))).toBe(true),
  );
  expect(read(app.repo, "specs/drafts/headings-are-flat/proposal.md")).toContain("![");

  await click(await undo());
  await waitFor(() => expect(read(app.repo, INBOX)).toBe(before));
  await waitFor(() =>
    expect(existsSync(join(app.repo, "specs/drafts/headings-are-flat"))).toBe(false),
  );
});

test("a note whose answer is lost is found in the inbox, once, and the draft is not made twice", async () => {
  const lost: typeof globalThis.fetch = async (input, init) => {
    const response = await app.fetch(input, init);
    const url = typeof input === "object" && "url" in input ? input.url : input.toString();
    if (url.includes("/inbox/note-image")) {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }
    return response;
  };
  await app.open("/inbox", { fetch: lost });
  const form = await openForm();
  await type(field(form), "Headings are flat");
  await attachImage(form);

  await click(form.getByRole("button", { name: "Add as a draft" }));

  await waitFor(() =>
    expect(read(app.repo, INBOX).match(/\[Headings are flat\]/g)).toHaveLength(1),
  );
  expect(existsSync(join(app.repo, "specs/drafts/headings-are-flat-2"))).toBe(false);
});

test("an Undo is refused once the note it added changed, and the draft stays", async () => {
  await app.open("/inbox");
  const form = await openForm();
  await type(field(form), "Headings are flat");
  await attachImage(form);
  await click(form.getByRole("button", { name: "Add as a draft" }));
  await waitFor(() => expect(read(app.repo, INBOX)).toContain("Headings are flat"));
  writeFileSync(
    join(app.repo, INBOX),
    read(app.repo, INBOX).replace("[Headings are flat]", "[Headings are flat, and dull]"),
  );

  await click(await undo());

  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(read(app.repo, INBOX)).toContain("and dull");
  expect(existsSync(join(app.repo, "specs/drafts/headings-are-flat/proposal.md"))).toBe(true);
});

test("a note's row opens its pane at an address of its own, and a note is moved to the priorities", async () => {
  await app.open("/inbox");
  const row = (await screen.findAllByRole("link")).find((link) =>
    link.getAttribute("href")?.endsWith(`/inbox/${MOBILE}`),
  );
  await click(row!);
  expect(window.location.pathname).toBe(app.path(`/inbox/${MOBILE}`));
  const inbox = read(app.repo, INBOX);
  const priorities = read(app.repo, PRIORITIES);

  await choose("Move to priorities", "Next");

  await waitFor(() =>
    expect(section(read(app.repo, PRIORITIES), "Next")).toContain(
      "- Draft to proposal on mobile went 404\n",
    ),
  );
  expect(read(app.repo, INBOX)).not.toContain("Draft to proposal on mobile went 404");
  await waitFor(() => expect(window.location.pathname).toBe(app.path("/inbox")));

  await click(await undo());
  await waitFor(() =>
    expect([read(app.repo, INBOX), read(app.repo, PRIORITIES)]).toEqual([inbox, priorities]),
  );
});

test("Make a draft writes the draft and opens it in the editor; a note that links one offers none", async () => {
  await app.open(`/inbox/${HOME_ICON}`);

  await choose("Make a draft", "Later");

  await waitFor(() =>
    expect(window.location.pathname).toBe(app.path("/edit/specs/drafts/we-need-a-home-icon.md")),
  );
  expect(read(app.repo, "specs/drafts/we-need-a-home-icon.md")).toContain(
    "# We need a home icon\n",
  );
  expect(section(read(app.repo, PRIORITIES), "Later")).toContain("(drafts/we-need-a-home-icon.md)");
  expect(read(app.repo, INBOX)).not.toContain("We need a home icon");
  git(app.repo, "reset", "--hard", "--quiet");
  git(app.repo, "clean", "-fdq", "specs");

  writeFileSync(
    join(app.repo, INBOX),
    "# Inbox\n\n## UI\n\n- [Look and feel pass](drafts/look-and-feel.md)\n",
  );
  await go("/inbox/look-and-feel-pass");
  expect(await screen.findByRole("button", { name: "Move to priorities" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Make a draft" })).toBeNull();
});

test("Add to a draft appends the note to the draft, and Undo keeps what was typed since", async () => {
  await app.open("/inbox/icons-are-blurry-on-retina-screens");
  const inbox = read(app.repo, INBOX);

  await addToDraft("Look", "Look and feel pass");

  await waitFor(() =>
    expect(read(app.repo, LOOK)).toContain("- Icons are blurry on retina screens\n\n## Why"),
  );
  expect(read(app.repo, INBOX)).not.toContain("Icons are blurry on retina screens");
  writeFileSync(
    join(app.repo, LOOK),
    read(app.repo, LOOK).replace("unfinished.", "unfinished, and dated."),
  );

  await click(await undo());

  await waitFor(() => expect(read(app.repo, INBOX)).toBe(inbox));
  expect(read(app.repo, LOOK)).toBe(LOOK_TEXT.replace("unfinished.", "unfinished, and dated."));
});

test("Delete asks nothing and Undo puts the note back at its place; Category moves it to the end of another", async () => {
  await app.open(`/inbox/${MOBILE}`);
  const before = read(app.repo, INBOX);

  await click(await screen.findByRole("button", { name: "Delete" }));

  await waitFor(() => expect(read(app.repo, INBOX)).not.toContain("on mobile went 404"));
  expect(screen.queryByRole("dialog")).toBeNull();
  await click(await undo());
  await waitFor(() => expect(read(app.repo, INBOX)).toBe(before));

  await app.open(`/inbox/${HOME_ICON}`);
  await moveTo("UI");
  await waitFor(() =>
    expect(read(app.repo, INBOX)).toContain(
      "- Text input feels laggy on the sessions page\n- We need a home icon\n\n## CLI\n",
    ),
  );
});

test("Edit replaces the note's text on Enter and keeps its marks", async () => {
  await app.open("/inbox/in-failures-the-x-is-not-centered-in-the-circle");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const text = screen.getAllByRole("textbox").at(-1)!;

  await type(text, "Specs are too long");
  await press(text, "Enter");

  await waitFor(() => expect(read(app.repo, INBOX)).toContain("- [run-ui] Specs are too long\n"));
  await waitFor(() => expect(window.location.pathname).toBe(app.path("/inbox/specs-are-too-long")));
});

test("one bar on both pages commits every move in one commit of the files they changed", async () => {
  await app.open(`/inbox/${MOBILE}`);
  await choose("Move to priorities", "Next");
  await waitFor(() => expect(read(app.repo, PRIORITIES)).toContain(MOBILE.slice(0, 5)));
  await go("/inbox/icons-are-blurry-on-retina-screens");
  await addToDraft("Look", "Look and feel pass");
  await waitFor(() => expect(read(app.repo, LOOK)).toContain("Icons are blurry"));
  await go("/priorities");
  const head = lastCommit(app.repo);

  await click(await screen.findByRole("button", { name: "Commit" }));

  await waitFor(() => expect(lastCommit(app.repo)).not.toBe(head));
  expect(
    git(app.repo, "show", "--name-only", "--format=", "HEAD").trim().split("\n").sort(),
  ).toEqual([INBOX, LOOK, PRIORITIES].sort());
  expect(git(app.repo, "status", "--porcelain")).toBe("");
});

test("Discard restores the inbox, the priorities, and the draft", async () => {
  const before = [read(app.repo, INBOX), read(app.repo, PRIORITIES), read(app.repo, LOOK)];
  await app.open(`/inbox/${MOBILE}`);
  await choose("Move to priorities", "Next");
  await waitFor(() => expect(read(app.repo, PRIORITIES)).not.toBe(before[1]));
  await go("/inbox");

  await click(await screen.findByRole("button", { name: "Discard" }));
  const buttons = await screen.findAllByRole("button", { name: /discard/i });
  await click(buttons.at(-1)!);

  await waitFor(() =>
    expect([read(app.repo, INBOX), read(app.repo, PRIORITIES), read(app.repo, LOOK)]).toEqual(
      before,
    ),
  );
});

test("a move over a change made elsewhere is refused, applies nothing, and the page reads again", async () => {
  await app.open(`/inbox/${MOBILE}`);
  await screen.findByRole("button", { name: "Move to priorities" });
  writeFileSync(
    join(app.repo, INBOX),
    read(app.repo, INBOX).replace("We need a home icon", "A home icon"),
  );

  await choose("Move to priorities", "Next");

  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(read(app.repo, PRIORITIES)).not.toContain("Draft to proposal on mobile");
  // The page read the inbox again: the note changed elsewhere shows.
  expect(await screen.findByText(/A home icon/)).toBeTruthy();
});

test("an edit over a change made elsewhere is refused, and the note is not edited", async () => {
  await app.open(`/inbox/${MOBILE}`);
  await click(await screen.findByRole("button", { name: "Edit" }));
  writeFileSync(
    join(app.repo, INBOX),
    read(app.repo, INBOX).replace("We need a home icon", "A home icon"),
  );
  const text = screen.getAllByRole("textbox").at(-1)!;
  await type(text, "Draft to proposal 404s on mobile");
  await press(text, "Enter");
  await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
  expect(read(app.repo, INBOX)).not.toContain("404s on mobile");
});

test("Undo of a move to the priorities keeps a change made to the inbox meanwhile", async () => {
  await app.open(`/inbox/${MOBILE}`);
  const inbox = read(app.repo, INBOX);
  await choose("Move to priorities", "Next");
  await waitFor(() => expect(read(app.repo, PRIORITIES)).toContain("on mobile went 404"));
  writeFileSync(
    join(app.repo, INBOX),
    read(app.repo, INBOX).replace("We need a home icon", "A home icon"),
  );

  await click(await undo());

  await waitFor(() =>
    expect(read(app.repo, INBOX)).toBe(inbox.replace("We need a home icon", "A home icon")),
  );
});
