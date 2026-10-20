/**
 * The screenshots' views of the inbox: its page, with notes and empty; a note open, beside the list
 * on the desktop and as a page on the phone; the add form, plain, with its category menu, and with
 * images; a note with images, in the list and open; Home's Inbox group; the sidebar's ＋; the priorities' commit bar holding a move from the
 * inbox; the triage's banners; and the triage's answering view, at its top and at a question. Each
 * change made to the repository is taken back once its view is taken.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "playwright";
import { git } from "uraeda-binding/test-utils";
import { type Each, forget, settle, show } from "./shots.ts";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const INBOX = "specs/INBOX.md";
const PRIORITIES = "specs/PRIORITIES.md";
const TRIAGE = "specs/INBOX-TRIAGE.md";
const NOTE = "Draft to proposal on mobile went 404";
/** The inbox's first note, which shows once the page is drawn. */
const FIRST = "Specs are still way too long and hard to read";

/** The triage of `fixtures/`, as an agent proposes it. */
const triage = () => readFileSync(join(root, "fixtures/INBOX-TRIAGE.md"), "utf8");

/** Opens the add form from the ＋ next to Inbox: in the navigation's drawer on the phone. */
async function openForm(page: Page) {
  // Without the text the last shot's form kept: each form opens as new, with no restore notice.
  await forget(page);
  await show(page, "/inbox", FIRST);
  if (page.viewportSize()!.width < 768) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await page.getByRole("button", { name: "Add a note to the inbox" }).click();
  const form = page.getByRole("dialog", { name: "Add a note" });
  await form
    .getByPlaceholder("What did you notice?")
    .fill("The spec page's headings are body-sized");
  await settle(page);
  return form;
}

/** The add form's views: plain, its Category menu open, and with images picked. */
async function takeForm(each: Each) {
  await each("add-note", async ({ page }) => {
    await openForm(page);
  });
  await each("add-note-category", async ({ page }) => {
    const form = await openForm(page);
    await form.getByRole("combobox", { name: "Category" }).click();
    await page.getByRole("option", { name: "UI" }).waitFor();
    await settle(page);
  });
  await each("add-note-image", async ({ page }) => {
    const form = await openForm(page);
    await form
      .locator('input[type="file"]')
      .setInputFiles([
        join(root, "fixtures/images", "phone.png"),
        join(root, "fixtures/images", "desktop.png"),
      ]);
    await form.getByText("With images, the note is saved as a draft").waitFor();
    await settle(page);
  });
}

/** Writes a file of the repository, runs `act`, and puts the file back as it was. */
async function withFile(repo: string, path: string, text: string, act: () => Promise<void>) {
  const file = join(repo, path);
  let before: string | undefined;
  try {
    before = readFileSync(file, "utf8");
  } catch {
    before = undefined;
  }
  writeFileSync(file, text);
  try {
    await act();
  } finally {
    if (before === undefined) {
      rmSync(file, { force: true });
    } else {
      writeFileSync(file, before);
    }
  }
}

/** The draft of the note with images the shots show. */
const IMAGED = "specs/drafts/slow-lists";

/**
 * A note whose draft holds two images: its row, with the first one's thumbnail, and its page, with
 * both under its text. The draft and the note are taken back once the views are taken.
 */
async function takeImagedNote(each: Each, repo: string) {
  const inbox = readFileSync(join(repo, INBOX), "utf8");
  mkdirSync(join(repo, IMAGED, "images"), { recursive: true });
  for (const [name, source] of [
    ["first", "lossless.webp"],
    ["second", "lossy.webp"],
  ]) {
    copyFileSync(join(root, "fixtures/images", source), join(repo, IMAGED, `images/${name}.webp`));
  }
  writeFileSync(
    join(repo, IMAGED, "proposal.md"),
    "# Slow lists\n\n## What\n\nSlow lists\n\n![first](images/first.webp)\n\n![second](images/second.webp)\n\n## Why\n",
  );
  writeFileSync(
    join(repo, INBOX),
    inbox.replace(
      "- We need a home icon\n",
      "- We need a home icon\n- [Slow lists](drafts/slow-lists/proposal.md)\n",
    ),
  );
  try {
    await each("inbox-images", ({ page }) => show(page, "/inbox", "Slow lists"));
    await each("inbox-note-images", async ({ page }) => {
      await show(page, "/inbox/slow-lists", "Note, in");
      await page.getByRole("img", { name: "second" }).waitFor();
      await settle(page);
    });
  } finally {
    rmSync(join(repo, IMAGED), { force: true, recursive: true });
    writeFileSync(join(repo, INBOX), inbox);
  }
}

/** The triage's views: its banners on the inbox page, waiting and answered, and its round. */
async function takeTriage(each: Each, repo: string) {
  await withFile(repo, TRIAGE, triage(), async () => {
    await each("triage-waiting", ({ page }) =>
      show(page, "/inbox", "An inbox triage waits for your answers"),
    );
    await each("triage", ({ page }) => show(page, "/inbox/triage", "Inbox triage"));
    // Its second question's card, near the top, below the phone's top bar.
    await each("triage-question", async ({ page }) => {
      await show(page, "/inbox/triage", "Inbox triage");
      await page
        .locator("#Q2")
        .evaluate((element) =>
          window.scrollBy(
            0,
            element.getBoundingClientRect().top - (window.innerWidth < 768 ? 64 : 16),
          ),
        );
      await settle(page);
    });
  });
  const answered = triage()
    .replace("status: awaiting-human", "status: answered")
    .replaceAll("**Answer:**\n", "**Answer:** A\n");
  await withFile(repo, TRIAGE, answered, () =>
    each("triage-answered", ({ page }) =>
      show(page, "/inbox", "Your triage answers are ready to apply"),
    ),
  );
}

/** The inbox's views, its repository at `repo`. */
export async function takeInbox(each: Each, repo: string) {
  await each("inbox", ({ page }) => show(page, "/inbox", FIRST));
  await each("inbox-note", async ({ page }) => {
    await show(page, "/inbox", FIRST);
    await page.getByRole("link", { name: new RegExp(NOTE) }).click();
    await page.getByRole("button", { name: "Move to priorities" }).waitFor();
    await settle(page);
  });
  // Emptied in a commit, so no change waits, then taken back.
  writeFileSync(join(repo, INBOX), "# Inbox\n");
  git(repo, "commit", "--quiet", "--no-verify", "--all", "--message", "chore: empty the inbox");
  await each("inbox-empty", ({ page }) => show(page, "/inbox", "The inbox is empty."));
  git(repo, "reset", "--quiet", "--hard", "HEAD~1");
  await takeForm(each);
  await takeImagedNote(each, repo);
  await each("home-inbox", async ({ page }) => {
    await show(page, "/", "notes to organize");
    await page
      .getByRole("heading", { name: "Inbox" })
      .first()
      .evaluate((heading) => heading.scrollIntoView({ block: "center" }));
    await settle(page);
  });
  // A note moved to Next, as Move to priorities writes it, not committed.
  const inbox = readFileSync(join(repo, INBOX), "utf8");
  const priorities = readFileSync(join(repo, PRIORITIES), "utf8");
  await withFile(repo, INBOX, inbox.replace(`- ${NOTE}\n`, ""), () =>
    withFile(repo, PRIORITIES, priorities.replace("\n## Later", `- ${NOTE}\n\n## Later`), () =>
      each("priorities-commit", async ({ page }) => {
        await show(page, "/priorities", NOTE);
        await page.getByRole("button", { name: "Commit" }).waitFor();
        await settle(page);
      }),
    ),
  );
  await takeTriage(each, repo);
}
