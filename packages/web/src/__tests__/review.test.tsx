import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { GENERAL_ID } from "../YourReview.tsx";
import { fixture, fixtureRepo, git, renderPage, serverFetch, today } from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/spec.md`;
const SPEC = `specs/${FOLDER}/spec.md`;
const REVIEW = `specs/${FOLDER}/spec-review.md`;
const WORKTREE = join(".worktrees", FOLDER);

today("2026-10-11");

/** Commits a change to the spec on its branch, in the feature's worktree. */
function commitSpec(repo: string, edit: (text: string) => string) {
  if (!existsSync(join(repo, WORKTREE))) {
    git(repo, "worktree", "add", "--quiet", WORKTREE, FOLDER);
  }
  const path = join(repo, WORKTREE, SPEC);
  writeFileSync(path, edit(readFileSync(path, "utf8")));
  git(
    join(repo, WORKTREE),
    "commit",
    "--quiet",
    "--no-verify",
    "--all",
    "--message",
    "spec(recurring-tasks): edit",
  );
}

/** A repository whose spec has more scenario 1 of US2 on lines 92 and 93, and risk tier medium. */
function repo() {
  const repo = fixtureRepo();
  commitSpec(repo, (text) =>
    text
      .replace("risk-tier: high", "risk-tier: medium")
      .replace("plan-review: true", "plan-review: false")
      .replace("## User stories\n", `${"Padding.\n\n".repeat(4)}## User stories\n`),
  );
  const lines = git(repo, "show", `${FOLDER}:${SPEC}`).split("\n");
  expect(lines[91]).toMatch(/^1\. \*\*Given\*\* a weekly task due Monday the 5th/);
  return repo;
}

function read(repo: string, path: string) {
  return readFileSync(join(repo, WORKTREE, path), "utf8");
}

/**
 * The toggle of the first tappable block whose text holds a phrase: its name is the block's text,
 * which labels it. Only the toggles are read, by their label: naming every button of the page on
 * each try is slow on a busy machine.
 */
async function scenario(phrase: string) {
  return waitFor(() => {
    const block = [...document.querySelectorAll<HTMLElement>("button[aria-pressed]")].find(
      (toggle) => {
        const label = document.getElementById(toggle.getAttribute("aria-labelledby") ?? "");
        return label?.textContent?.replaceAll(/\s+/g, " ").includes(phrase);
      },
    );
    expect(block).toBeTruthy();
    return block as HTMLElement;
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

/**
 * The forms of the comments being written: not the general comment's field, always at the
 * review's end, but those a tap on a block or an Edit opens.
 */
function writing() {
  return screen
    .queryAllByRole("form", { name: "Comment" })
    .filter((form) => !form.closest(`#${GENERAL_ID}`));
}

/** The form of the comment being written, once it shows. */
function form() {
  return waitFor(() => {
    expect(writing()).toHaveLength(1);
    return writing()[0]!;
  });
}

/** The field of the comment being written, once it shows. */
async function field() {
  return within(await form()).getByLabelText("Comment text") as HTMLTextAreaElement;
}

/** The general comment's field, at the review's end. */
function generalField() {
  const end = document.getElementById(GENERAL_ID) as HTMLElement;
  return within(end).getByLabelText("Comment text") as HTMLTextAreaElement;
}

/** Writes the comment being written, and sends it. */
async function comment(text: string) {
  await typeComment(text);
  await click(within(await form()).getByRole("button", { name: /^(Add|Save) comment$/ }));
}

/**
 * The pending comment shown under a name once its save is done: its form closed, and its text
 * shown. The file is written before the save's answer reaches the page, and the page shows the
 * new text a moment after the form closes.
 */
async function saved(name: string | RegExp, text: string) {
  await waitFor(() => {
    expect(writing()).toHaveLength(0);
    expect(screen.getByRole("group", { name }).textContent).toContain(text);
  });
  return screen.getByRole("group", { name });
}

const FIRST = "completes it on Monday the 5th, Then it stays in the list, not done";
/** A story's title, by its id, in the fixture's spec. */
const STORIES = {
  US1: "US1 · Make a task repeat",
  US2: "US2 · Complete a repeating task",
  US3: "US3 · Repeat on a custom schedule",
  US4: "US4 · Type a repeat in the title",
};

/**
 * The trigger of a story's more scenarios, in its card: "N more scenarios" closed, "Fold the other
 * scenarios" open. Its state is open or closed, where a block's toggle is pressed or not.
 */
async function fold(story: keyof typeof STORIES) {
  return waitFor(() => {
    const card = screen.getByRole("region", { name: STORIES[story] });
    const triggers = within(card)
      .getAllByRole("button", { name: /^(\d+ more scenarios?|Fold the other scenarios)$/ })
      .filter((button) => button.hasAttribute("aria-expanded"));
    expect(triggers).toHaveLength(1);
    return triggers[0]!;
  });
}

/** Opens a story's more scenarios, as the human taps their trigger, unless they are open already. */
async function openFold(story: keyof typeof STORIES) {
  const trigger = await fold(story);
  if (trigger.getAttribute("aria-expanded") !== "true") {
    await click(trigger);
  }
}

/** Opens US2's more scenarios. */
const openUS2 = () => openFold("US2");

/** The line of the spec holding a phrase, at its branch's tip. */
function lineOf(r: string, phrase: string) {
  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** Types in a comment field, the one being written's by default, without sending it. */
async function typeComment(text: string, into?: HTMLElement) {
  const target = into ?? (await field());
  await act(async () => {
    fireEvent.change(target, { target: { value: text } });
  });
}

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

/** A PNG, as the picker gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Picks files with the comment's "Add image", as the system's picker gives them. */
async function pick(files: Array<File>) {
  const input = await screen.findByLabelText("Add image", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** The server in process, whose uploads wait until the test lets each one through. */
function holdUploads(repo: string) {
  const fetch = serverFetch(repo);
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

const UNSENT = "Add or cancel your comment first.";
/** The texts shown on the page, not in the screen reader's announcements. */
function shown(text: string) {
  return screen
    .queryAllByText(text)
    .filter((element) => !element.closest("[data-astryx-live-region]"));
}

/** The last commit's subject on the feature's branch. */
const lastCommit = (r: string) => git(r, "log", "-1", "--format=%s", FOLDER).trim();

/** US2's second more scenario, under the first. */
const SECOND = "completes it on Thursday the 8th, Then it is due Monday the 12th";

/**
 * Opens a comment on a block and picks an image for it, linked once its upload ends: the general
 * comment's field at the review's end takes no image of its own.
 */
async function commentWithImage(phrase: string) {
  await click(await scenario(phrase));
  await form();
  await pick([png("login.png")]);
}

/** Review focus 11, R64: an image uploading is in no file yet, which a verdict would delete. */
test("Request changes during an upload is refused, and commits nothing", async () => {
  const r = repo();
  const held = holdUploads(r);
  await renderPage(PAGE, r, { fetch: held.fetch });
  // Folded, the more scenarios are not in the page: opened first.
  await openUS2();
  await click(await scenario(FIRST));
  await comment("Say it stays.");
  await saved(/^C1/, "Say it stays.");
  const before = lastCommit(r);
  await commentWithImage(SECOND);
  await waitFor(() => expect(held.waiting).toHaveLength(1));

  await click(screen.getByRole("button", { name: "Request changes" }));

  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));
  expect(lastCommit(r)).toBe(before);
  await held.release();
  await waitFor(async () => expect((await field()).value).toContain("![login](images/login.webp)"));
  expect(lastCommit(r)).toBe(before);
});

/**
 * US5 10: a comment open with text holds the verdict back, images or not (R16): the general
 * comment's field, always at the review's end, too.
 */
test("a verdict with an open comment holding text is refused", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  const before = lastCommit(r);
  await typeComment("Half a tho", await waitFor(generalField));

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));
  expect(lastCommit(r)).toBe(before);
  expect(read(r, SPEC)).toContain("status: awaiting-human\n");
});

/**
 * A repository whose spec, at its branch's tip, holds extra blocks before its decisions: one
 * paragraph on every other line from line 32, "Paragraph 5 of the long spec." on line 40 and
 * "Paragraph 11 of the long spec." on line 52.
 */
function longSpec(blocks = 30) {
  const r = fixtureRepo();
  const paragraphs = Array.from(
    { length: blocks },
    (_, index) => `Paragraph ${index + 1} of the long spec.\n\n`,
  );
  commitSpec(r, (text) => text.replace("## Decisions\n", `\n${paragraphs.join("")}## Decisions\n`));
  expect(lineOf(r, "Paragraph 5 of the long spec.")).toBe(40);
  expect(lineOf(r, "Paragraph 11 of the long spec.")).toBe(52);
  return r;
}

const LINE_40 = "Paragraph 5 of the long spec.";
const LINE_52 = "Paragraph 11 of the long spec.";

/** The text of the comment being written. */
const commentText = () =>
  (within(writing()[0]!).getByLabelText("Comment text") as HTMLTextAreaElement).value;

/** The page shown again, as after a reload: the store reads `localStorage` anew. */
async function reload(r: string) {
  forgetUnsaved();
  await renderPage(PAGE, r, { reload: true });
}

/** Review focus 6: lines of a version the review is no longer on are named in the text. */
test("a comment restored after the reviewed commit changed is a general one", async () => {
  const r = longSpec();
  await renderPage(PAGE, r);
  await click(await scenario(LINE_40));
  await click(await scenario(LINE_52));
  await typeComment("Too vague");
  commitSpec(r, (text) => `${text}\nOne more line.\n`);

  await reload(r);

  // The general draft restored takes the place of the end's own general field.
  const restored = await form();
  expect(within(restored).getByText("General")).toBeTruthy();
  await waitFor(() =>
    expect(commentText()).toBe("On lines 40–52 of the previous version: Too vague"),
  );
  expect(document.getElementById(GENERAL_ID)).toBeNull();
  expect(document.querySelector("button[aria-pressed='true']")).toBeNull();
  await click(within(restored).getByRole("button", { name: "Add comment" }));
  await saved("C1 · general", "On lines 40–52 of the previous version: Too vague");
});

/** A pending review on the long spec: one comment per line given, each with its text. */
function pendingComments(r: string, comments: Array<[line: number, text: string]>) {
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  const written = comments.map(
    ([line, text], index) =>
      `## C${index + 1}: Line ${line}, under "Somewhere"\n\n> Quoted.\n\n${text}\n`,
  );
  writeFileSync(
    join(r, WORKTREE, REVIEW),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n${written.join("\n")}`,
  );
}

/** Second review: an edit kept for C2 follows it to C1 as C1 is removed, and is saved into it. */
test("an edit of a review comment follows it when a comment before it is removed", async () => {
  const r = longSpec();
  pendingComments(r, [
    [40, "First."],
    [52, "Second."],
    [60, "Third."],
  ]);
  await renderPage(PAGE, r);
  await click(
    within(await screen.findByRole("group", { name: "C2 · line 52" })).getByRole("button", {
      name: "Edit",
    }),
  );
  await typeComment("Second, edited.");

  await click(
    within(screen.getByRole("group", { name: "C1 · line 40" })).getByRole("button", {
      name: "Remove",
    }),
  );

  await waitFor(() => expect(screen.queryByRole("group", { name: "C1 · line 40" })).toBeNull());
  expect(within(await form()).getByText("Editing C1")).toBeTruthy();
  expect(commentText()).toBe("Second, edited.");

  await reload(r);

  const restored = await form();
  expect(within(restored).getByText("Editing C1")).toBeTruthy();
  expect(commentText()).toBe("Second, edited.");
  await click(within(restored).getByRole("button", { name: "Save comment" }));
  await saved("C1 · line 52", "Second, edited.");
  expect(read(r, REVIEW)).toContain("Third.");
});
