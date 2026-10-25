// US3 and US6 and their edge cases: the inbox as a pane per category, with a purpose line, an empty
// category drawn as an empty pane, "New category", a title renamed in place, and a pane menu whose
// Delete asks "Delete the N notes too?" with Yes (Y), No (N), and Cancel (C). Each test takes the
// repository in turn, on a fresh copy of the fixture.
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, attached, drawn, image, middle, pickUp, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

const PATH = "specs/INBOX.md";
const PURPOSE = "Things noticed, not decided: turn each into a priority, a draft, or nothing.";
const HOME = "We need a home icon";
const ICONS = "Icons are blurry on retina screens";

atSize("both");

/** The titles of the page's panes, with their counts. */
function titles() {
  return within(screen.getByRole("main"))
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

/** A menu's row by its label: a menu item in a popover, a button in the sheet of a narrow screen. */
function row(label: string) {
  return waitFor(() => {
    const name = new RegExp(`^${label}$`);
    const dialog = screen.queryByRole("dialog");
    const found =
      screen.queryByRole("menuitem", { name }) ??
      (dialog ? within(dialog).queryByRole("button", { name }) : null);
    expect(found, label).not.toBeNull();
    return found as HTMLElement;
  });
}

/** Opens a category's menu and takes Delete. */
async function deleteCategory(name: string) {
  await userEvent.click(screen.getByRole("button", { name: `Actions of category ${name}` }));
  await userEvent.click(await row("Delete"));
}

/** The question of a delete, once drawn. */
function question(name: string) {
  return screen.findByRole("dialog", { name: `Delete the category ${name}` });
}

/** A choice of the question, by its words. */
function choice(dialog: HTMLElement, words: RegExp) {
  return within(dialog).getByRole("button", { name: words });
}

/** Writes the inbox, and shows it. */
async function inboxWith(text: string, ready: string) {
  await commands.writeRepo(text, PATH);
  await show("/inbox", ready);
}

/** The card of a note, by its text. */
function card(text: string) {
  const found = screen.getByRole("link", { name: new RegExp(text) }).closest("li");
  expect(found).not.toBeNull();
  return within(found as HTMLElement);
}

test("each category with notes is a pane, and a note's sub-line shows under its text", async () => {
  await inboxWith(
    "# Inbox\n\n- Loose note\n\n## UI\n\n- Icons are blurry\n  - on retina screens\n- Second\n\n## Prompts\n",
    "Loose note",
  );

  // The notes without a category first, then the file's order, an empty category as an empty pane.
  expect(titles()).toEqual(["No category · 1", "UI · 2", "Prompts · 0"]);
  expect(screen.getByText(PURPOSE)).toBeTruthy();
  const note = card("Icons are blurry");
  const sub = note.getByText("on retina screens");
  const text = note.getByText("Icons are blurry");
  expect(sub.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    text.getBoundingClientRect().bottom - 1,
  );
});

test("both tags of a note show on its card", async () => {
  await inboxWith(
    "# Inbox\n\n## UI\n\n- [agent] [spec-page] Live window drops the anchor\n",
    "Live",
  );

  const note = card("Live window drops the anchor");
  expect(note.getByText("agent")).toBeTruthy();
  expect(note.getByText("spec-page")).toBeTruthy();
});

test("an empty inbox shows its purpose line and New category, and no empty pane", async () => {
  await inboxWith("# Inbox\n", PURPOSE);

  expect(screen.getByRole("button", { name: "New category" })).toBeTruthy();
  expect(titles()).toEqual([]);
});

test("New category writes ## Prompts at the end of INBOX.md and shows an empty pane", async () => {
  await show("/inbox", HOME);

  await userEvent.click(screen.getByRole("button", { name: "New category" }));
  await userEvent.keyboard("Prompts{Enter}");

  await expect
    .poll(() => commands.readRepo(PATH))
    .toMatch(/- Make sure agents are resumable\n+## Prompts\n*$/);
  await expect.poll(titles).toEqual(["No category · 3", "UI · 5", "CLI · 2", "Prompts · 0"]);
});

test("a taken or blank category name is refused with the core's message", async () => {
  await show("/inbox", HOME);
  const original = await commands.readRepo(PATH);

  await userEvent.click(screen.getByRole("button", { name: "New category" }));
  await userEvent.keyboard("UI{Enter}");
  expect(await screen.findByText("A category named UI exists.")).toBeTruthy();
  await userEvent.clear(screen.getByRole("textbox", { name: "New category" }));
  await userEvent.keyboard("   {Enter}");
  expect(await screen.findByText("A category needs a name.")).toBeTruthy();
  expect(await commands.readRepo(PATH)).toBe(original);
});

test("deleting UI and answering No puts its notes first under no category, and Undo restores the file", async () => {
  await show("/inbox", HOME);
  const original = await commands.readRepo(PATH);

  await deleteCategory("UI");
  const dialog = await question("UI");
  expect(within(dialog).getByText("Delete the 5 notes too?")).toBeTruthy();
  await userEvent.click(choice(dialog, /^No/));

  await expect.poll(() => commands.readRepo(PATH)).not.toContain("## UI");
  expect(await commands.readRepo(PATH)).toContain(
    "- We need a home icon\n- [run-ui] In failures the `x` is not centered in the circle\n- Draft to proposal on mobile went 404\n- Icons are blurry on retina screens\n- [agent] [session-view] Opening a session with 2,000 messages takes 4 s\n- Text input feels laggy on the sessions page\n",
  );
  await expect.poll(titles).toEqual(["No category · 8", "CLI · 2"]);
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await expect.poll(() => commands.readRepo(PATH)).toBe(original);
  await expect.poll(titles).toEqual(["No category · 3", "UI · 5", "CLI · 2"]);
});

test("answering Yes removes the heading and its notes, and Undo restores them", async () => {
  await show("/inbox", HOME);
  const original = await commands.readRepo(PATH);

  await deleteCategory("UI");
  await userEvent.click(choice(await question("UI"), /^Yes/));

  await expect.poll(() => commands.readRepo(PATH)).not.toContain("## UI");
  expect(await commands.readRepo(PATH)).not.toContain("Icons are blurry");
  await expect.poll(titles).toEqual(["No category · 3", "CLI · 2"]);
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await expect.poll(() => commands.readRepo(PATH)).toBe(original);
});

describe("the keys of the question", () => {
  test.each([
    { kept: true, key: "c", notes: true },
    { kept: false, key: "n", notes: true },
    { kept: false, key: "y", notes: false },
  ])("$key chooses while the question is open", async ({ kept, key, notes }) => {
    await show("/inbox", HOME);
    const original = await commands.readRepo(PATH);

    await deleteCategory("UI");
    await question("UI");
    await userEvent.keyboard(key);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    if (kept) {
      await drawn();
      expect(await commands.readRepo(PATH)).toBe(original);
      return;
    }
    await expect.poll(() => commands.readRepo(PATH)).not.toContain("## UI");
    expect((await commands.readRepo(PATH)).includes(ICONS)).toBe(notes);
  });

  test("each choice shows its key, and Y, N, and C are the question's names", async () => {
    await show("/inbox", HOME);
    await deleteCategory("UI");
    const dialog = await question("UI");

    for (const [words, key] of [
      [/^Yes/, "Y"],
      [/^No/, "N"],
      [/^Cancel/, "C"],
    ] as const) {
      expect(choice(dialog, words).textContent).toContain(key);
    }
  });
});

test("Cancel changes nothing", async () => {
  await show("/inbox", HOME);
  const original = await commands.readRepo(PATH);

  await deleteCategory("UI");
  await userEvent.click(choice(await question("UI"), /^Cancel/));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await drawn();
  expect(await commands.readRepo(PATH)).toBe(original);
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

test("an empty category deletes at once, with Undo", async () => {
  await inboxWith("# Inbox\n\n- Loose note\n\n## Prompts\n", "Loose note");
  const original = await commands.readRepo(PATH);

  await deleteCategory("Prompts");

  await expect.poll(() => commands.readRepo(PATH)).not.toContain("## Prompts");
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await expect.poll(() => commands.readRepo(PATH)).toBe(original);
});

test("renaming UI to Interface keeps its notes, and a taken name is refused with its message", async () => {
  await show("/inbox", HOME);

  // Enter over the title as it is changes nothing: the core refuses a category's own name.
  await userEvent.click(screen.getByRole("button", { name: "UI" }));
  const field = await screen.findByRole("textbox", { name: "Rename UI" });
  const original = await commands.readRepo(PATH);
  await userEvent.type(field, "{Enter}");
  await drawn();
  expect(await commands.readRepo(PATH)).toBe(original);

  await userEvent.click(screen.getByRole("button", { name: "UI" }));
  await userEvent.click(await screen.findByRole("textbox", { name: "Rename UI" }));
  await userEvent.keyboard("{Control>}a{/Control}CLI{Enter}");
  expect(await screen.findByText("A category named CLI exists.")).toBeTruthy();
  expect(await commands.readRepo(PATH)).toBe(original);

  await userEvent.keyboard("{Control>}a{/Control}Interface{Enter}");
  await expect.poll(() => commands.readRepo(PATH)).toContain("## Interface\n");
  expect(await commands.readRepo(PATH)).not.toContain("## UI");
  await expect.poll(titles).toEqual(["No category · 3", "Interface · 5", "CLI · 2"]);
});

test("Escape cancels a rename", async () => {
  await show("/inbox", HOME);
  const original = await commands.readRepo(PATH);

  await userEvent.click(screen.getByRole("button", { name: "UI" }));
  await screen.findByRole("textbox", { name: "Rename UI" });
  await userEvent.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Rename UI" })).toBeNull());
  expect(await commands.readRepo(PATH)).toBe(original);
  expect(titles()).toContain("UI · 5");
});

test("an Undo over a file changed meanwhile shows the conflict and reads the file again", async () => {
  await show("/inbox", HOME);

  await deleteCategory("UI");
  await userEvent.click(choice(await question("UI"), /^No/));
  await expect.poll(() => commands.readRepo(PATH)).not.toContain("## UI");
  const changed = `${await commands.readRepo(PATH)}\n## Later\n\n- Written meanwhile\n`;
  await commands.writeRepo(changed, PATH);
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));

  expect(await screen.findByText(/changed on disk/)).toBeTruthy();
  expect(await commands.readRepo(PATH)).toBe(changed);
  expect(await screen.findByText("Written meanwhile")).toBeTruthy();
});

describe("on the desktop", () => {
  atSize("desktop");

  afterEach(async () => {
    await commands.mouse([{ type: "up" }]);
  });

  test("a note dropped on Prompts is written under ## Prompts at the drop place", async () => {
    await commands.writeRepo(`${await commands.readRepo(PATH)}\n## Prompts\n`, PATH);
    await show("/inbox", ICONS);
    await drawn();
    const target = middle(screen.getByRole("heading", { level: 2, name: /^Prompts/ }));
    const start = middle(screen.getByRole("link", { name: new RegExp(ICONS) }));
    await pickUp(ICONS);
    for (let step = 1; step <= 8; step++) {
      await commands.mouse([
        {
          type: "move",
          x: start.x + ((target.x - start.x) * step) / 8,
          y: start.y - 10 + ((target.y + 10 - start.y) * step) / 8,
        },
      ]);
      await drawn();
    }
    await expect.poll(() => screen.queryByRole("list", { name: "Prompts lines" })).not.toBeNull();
    await commands.mouse([{ type: "up" }]);

    await expect
      .poll(() => commands.readRepo(PATH), { timeout: 10_000 })
      .toMatch(/## Prompts\n\n- Icons are blurry on retina screens\n*$/);
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("a note's first image shows under its text", async () => {
    const draft = "specs/drafts/slow-lists/proposal.md";
    await commands.writeRepo("# Slow lists\n\n## What\n\nSlow lists\n\n## Why\n", draft);
    const link = await attached(draft, await image("phone.png", "first.png"));
    await commands.writeRepo(
      `# Slow lists\n\n## What\n\nSlow lists\n\n![first](${link})\n\n## Why\n`,
      draft,
    );
    await inboxWith(
      "# Inbox\n\n## UI\n\n- [Slow lists](drafts/slow-lists/proposal.md)\n",
      "Slow lists",
    );

    const note = card("Slow lists");
    // The thumbnail, a group of its own, is drawn once its card is.
    const picture = await waitFor(() => note.getByRole("group"));
    const text = note.getByText("Slow lists");
    expect(picture.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      text.getBoundingClientRect().bottom - 1,
    );
  });
});
