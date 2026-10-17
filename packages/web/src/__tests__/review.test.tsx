import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { type ComponentProps, Profiler } from "react";
import { expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  atRepo,
  atWidth,
  fixture,
  fixtureRepo,
  git,
  renderPage,
  serverFetch,
  today,
} from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/spec.md`;
const SPEC = `specs/${FOLDER}/spec.md`;
const REVIEW = `specs/${FOLDER}/spec-review.md`;
const WORKTREE = join(".worktrees", FOLDER);

today("2026-10-11");

/** Called each time the document's blocks render: a `Profiler` around every `Blocks` (US3 1). */
const profiled = vi.hoisted(() => ({ onRender: vi.fn() }));
vi.mock(import("../Blocks.tsx"), async (original) => {
  const blocks = await original();
  return {
    ...blocks,
    Blocks: (props: ComponentProps<typeof blocks.Blocks>) => (
      <Profiler id="document" onRender={profiled.onRender}>
        <blocks.Blocks {...props} />
      </Profiler>
    ),
  };
});

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

async function comment(text: string) {
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: text } });
  });
  await click(screen.getByRole("button", { name: /^(Add|Save) comment$/ }));
}

/**
 * The pending comment shown under a name once its save is done: its form closed, and its text
 * shown. The file is written before the save's answer reaches the page, and the page shows the
 * new text a moment after the form closes.
 */
async function saved(name: string | RegExp, text: string) {
  await waitFor(() => {
    expect(screen.queryByLabelText("Comment text")).toBeNull();
    expect(screen.getByRole("group", { name }).textContent).toContain(text);
  });
  return screen.getByRole("group", { name });
}

const FIRST = "completes it on Monday the 5th, Then it stays in the list, not done";
const SECOND = "completes it on Thursday the 8th, Then it is due Monday the 12th.";

/** The nested item's toggle. A parent's toggle is named by its text, its nested item's included. */
const nested = () => screen.findByRole("button", { name: "Nested item" });

/** A story's title, by its id, in the fixture's spec. */
const STORIES = {
  US1: "Make a task repeat",
  US2: "Complete a repeating task",
  US3: "Repeat on a custom schedule",
  US4: "Type a repeat in the title",
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

/**
 * Whether an element is folded away: inside the region a closed trigger controls, which a screen
 * reader skips and the browser does not draw (the browser tests check what shows).
 */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** Writes a pending review with one comment on lines, on the spec at its branch's tip. */
function pendingComment(r: string, start: number, end: number) {
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  const lines = start === end ? `Line ${start}` : `Lines ${start}–${end}`;
  writeFileSync(
    join(r, WORKTREE, REVIEW),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: ${lines}, under "Somewhere"\n\n> Quoted.\n\nTwice?\n`,
  );
}

/** The line of the spec holding a phrase, at its branch's tip. */
function lineOf(r: string, phrase: string) {
  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** US1.1, SC-001 */
test("a spec under review shows each story's more scenarios folded", async () => {
  await renderPage(PAGE, repo());

  for (const [story, name] of [
    ["US1", "1 more scenario"],
    ["US2", "2 more scenarios"],
  ] as const) {
    expect((await fold(story)).getAttribute("aria-expanded")).toBe("false");
    expect((await fold(story)).textContent).toBe(name);
  }
  expect(screen.getAllByRole("button", { name: /^\d more scenarios?$/ })).toHaveLength(4);
  const why = screen.getByText(
    "Why this priority: this is what saves users from recreating tasks.",
  );
  expect(folded(why)).toBe(false);
  expect(folded(screen.getByText(/completes it on Wednesday the 14th/))).toBe(false);
  for (const scenario of screen.getAllByText(/completes it on (Monday the 5th|Thursday the 8th)/)) {
    expect(folded(scenario)).toBe(true);
  }
});

/** US1.2 */
test("opening a story's scenarios lets the human comment on one", async () => {
  await renderPage(PAGE, repo());

  await openUS2();
  const first = await scenario(FIRST);
  expect(folded(first)).toBe(false);
  await click(first);

  expect(screen.getByText('Lines 92–93, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
});

/** US1.3 */
test("a pending comment opens its fold", async () => {
  const r = repo();
  pendingComment(r, 92, 93);
  await renderPage(PAGE, r);

  const pending = await screen.findByRole("group", { name: "C1 · lines 92–93" });
  expect((await fold("US2")).getAttribute("aria-expanded")).toBe("true");
  expect((await fold("US1")).getAttribute("aria-expanded")).toBe("false");
  expect(folded(pending)).toBe(false);
  expect(folded(within(pending).getByRole("button", { name: "Edit" }))).toBe(false);
  expect(folded(within(pending).getByRole("button", { name: "Remove" }))).toBe(false);
});

/** Review focus 1 */
test("closing a fold keeps the draft", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  await click(await scenario(FIRST));
  await typeComment("Twice?");

  await click(await fold("US2"));
  expect((await fold("US2")).getAttribute("aria-expanded")).toBe("false");
  expect(folded(screen.getByLabelText("Comment text"))).toBe(true);
  await click(await fold("US2"));

  expect((await fold("US2")).getAttribute("aria-expanded")).toBe("true");
  const field = screen.getByLabelText("Comment text") as HTMLTextAreaElement;
  expect(folded(field)).toBe(false);
  expect(field.value).toBe("Twice?");
});

test("a fold's trigger opens it and selects no block", async () => {
  await renderPage(PAGE, repo());

  await click(await fold("US1"));
  await click(await fold("US2"));

  expect((await fold("US1")).getAttribute("aria-expanded")).toBe("true");
  expect((await fold("US2")).getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByLabelText("Comment text")).toBeNull();
  expect(document.querySelector("button[aria-pressed='true']")).toBeNull();
});

/** US3.1 */
test("a tapped block takes a comment on its lines", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await openUS2();

  await click(await scenario(FIRST));
  expect(screen.getByText('Lines 92–93, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
  await comment("Say what the row shows");

  await saved("C1 · lines 92–93", "Say what the row shows");
  const review = read(r, REVIEW);
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  expect(review).toContain(`verdict: pending\ncommit: ${tip}\n`);
  expect(review).toContain(
    '## C1: Lines 92–93, under "US2: Complete a repeating task (P1)"\n\n> 1. **Given** a weekly task due Monday the 5th',
  );
  expect(review).toContain("\nSay what the row shows\n");
  expect(git(join(r, WORKTREE), "status", "--porcelain")).toContain("spec-review.md");
});

/** US3.2 */
test("a second tap extends the selection", async () => {
  await renderPage(PAGE, repo());
  await openUS2();

  await click(await scenario(FIRST));
  await click(await scenario(SECOND));

  expect(screen.getByText('Lines 92–95, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
});

/** US3.3 */
test("a pending comment is edited, then removed with its review file", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await openUS2();
  await click(await scenario(FIRST));
  await comment("Say what the row shows");
  const pending = await saved("C1 · lines 92–93", "Say what the row shows");

  await click(within(pending).getByRole("button", { name: "Edit" }));
  await comment("Say what the row shows, and for how long");
  const edited = await saved("C1 · lines 92–93", "Say what the row shows, and for how long");
  expect(read(r, REVIEW)).toContain("\nSay what the row shows, and for how long\n");

  await click(within(edited).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByRole("group", { name: "C1 · lines 92–93" })).toBeNull());
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
});

/** US6.1 */
test("approving with a higher tier leaves the plan's review off", async () => {
  const r = repo();
  await renderPage(PAGE, r);

  await click(await screen.findByRole("radio", { name: "high" }));
  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() =>
    expect(git(r, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "spec(recurring-tasks): approve",
    ),
  );
  const spec = read(r, SPEC);
  expect(spec).toContain("status: approved\n");
  expect(spec).toContain("risk-tier: high\n");
  expect(spec).toContain("plan-review: false\n");
});

/** US3.5 */
test("Request changes waits for a comment", async () => {
  await renderPage(PAGE, repo());

  const button = await screen.findByRole("button", { name: "Request changes" });
  expect(button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
  expect(screen.getAllByText("Add a comment first", { exact: false }).length).toBeGreaterThan(0);
});

/** US3.6 */
test("a plan shows each task's steps checked out of its total", async () => {
  await renderPage("/f/2026-10-13-plan-review/plan.md");

  expect(
    await screen.findByRole("heading", { name: "Task 5: Repeats typed in the title 2/5" }),
  ).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "high" })).toBeNull();
});

/** US3.7 */
test("a new version under pending comments is said", async () => {
  const r = repo();
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  writeFileSync(
    join(r, WORKTREE, REVIEW),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: General\n\nShorter.\n`,
  );
  commitSpec(r, (text) => `${text}\nOne more line.\n`);

  await renderPage(PAGE, r);

  expect(
    await screen.findByText(
      "The spec changed since your comments: your 1 pending comment is on the previous version. Adding a comment replaces it.",
    ),
  ).toBeTruthy();
  await click(screen.getByRole("button", { name: "Start over" }));
  await waitFor(() =>
    expect(screen.queryByText(/The spec changed since your comments/)).toBeNull(),
  );
  expect(screen.queryByRole("group", { name: "C1 · general" })).toBeNull();
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
});

/** A comment on a decision's lines is not on the spec's: it is listed, never placed by its lines. */
test("a comment on a decision is listed in your review, not under the spec's lines", async () => {
  const r = repo();
  const tip = git(r, "rev-parse", "--short=7", FOLDER).trim();
  writeFileSync(
    join(r, WORKTREE, REVIEW),
    `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Decision git, lines 92–93 removed, under "Rules"\n\n> - A rule.\n\nSay which store.\n`,
  );

  await renderPage(PAGE, r);

  expect(await screen.findByText("C1 · decision git, lines 92–93 removed")).toBeTruthy();
  expect(screen.getByText("Say which store.")).toBeTruthy();
  expect(screen.queryByRole("group", { name: /^C1/ })).toBeNull();
});

/** Review focus 4: a spec without stories still renders, and its blocks take comments. */
test("a spec without stories still takes comments", async () => {
  const r = fixtureRepo();
  commitSpec(r, (text) => text.replaceAll(/### US\d+:.*\n/g, "Story removed.\n"));

  await renderPage(PAGE, r);

  await click(await scenario(FIRST));
  expect(screen.getByText(/^Lines \d+–\d+, under "User stories"$/)).toBeTruthy();
});

/** Review C2: no verdict on a spec whose file differs from what the page shows. */
test("the verdict waits while the spec has changes not committed", async () => {
  const r = repo();
  const path = join(r, WORKTREE, SPEC);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nUnfinished edit.\n`);
  await renderPage(PAGE, r);

  expect(
    await screen.findByText(
      "spec.md has changes not committed: the review is of the committed version. Commit or discard them first.",
    ),
  ).toBeTruthy();
  const approve = screen.getByRole("button", { name: "Approve" });
  expect(approve.hasAttribute("disabled") || approve.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
});

/** Codex review: a general comment is edited and removed like the others. */
test("a general comment is edited, then removed", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await comment("Too long");
  const general = await saved("C1 · general", "Too long");
  expect(read(r, REVIEW)).toContain("\nToo long\n");

  await click(within(general).getByRole("button", { name: "Edit" }));
  await comment("Too long by half");
  const edited = await saved("C1 · general", "Too long by half");
  expect(read(r, REVIEW)).toContain("\nToo long by half\n");
  await click(within(edited).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByRole("group", { name: "C1 · general" })).toBeNull());
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
});

/** Codex review: a table's row takes a comment on its line. */
test("a table row takes a comment on its line", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  const row = await scenario("The upgrade meets a saved due date");

  await click(row);
  await comment("Which version?");

  await saved(/^C1 · line \d+$/, "Which version?");
  const review = read(r, REVIEW);
  expect(review).toMatch(
    /## C1: Line \d+, under "[^"]+"\n\n> \| High +\| The upgrade meets a saved due date/,
  );
  expect(review).toContain("\nWhich version?\n");
});

/** US2 3, 4: on a wide screen, the comment field opens under the block, with no overlay. */
test("on a wide screen, the comment field opens under the block (US2 3, 4)", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  const block = await scenario(FIRST);
  await click(block);

  const form = screen.getByRole("form", { name: "Comment" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(within(form).getByRole("button", { name: "Add comment" })).toBeTruthy();
  // Right under the block.
  expect(block.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const second = await scenario(SECOND);
  expect(form.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await click(within(form).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("form", { name: "Comment" })).toBeNull();
  expect((await scenario(FIRST)).getAttribute("aria-pressed")).toBe("false");
});

/** Answers "Discard" to "Discard your comment?". */
async function discard() {
  const dialog = await screen.findByRole("dialog", { name: "Discard your comment?" });
  await click(within(dialog).getByRole("button", { name: "Discard" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

/** Types in the comment field, without sending it. */
async function typeComment(text: string) {
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {
    fireEvent.change(field, { target: { value: text } });
  });
}

/** Final review: the field moves under each tapped block on wide screens, its text with it. */
test("on a wide screen, the text typed follows the field to the next block (US2 2, 3)", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  await click(await scenario(FIRST));
  await typeComment("Say what the row shows");

  await click(await scenario(SECOND));

  expect(screen.getByText('Lines 92–95, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
  expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toBe(
    "Say what the row shows",
  );
});

/** Final review: a general comment being typed is kept when a block is tapped. */
test("a general comment being typed is kept when a block is tapped", async () => {
  await renderPage(PAGE, repo());
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await typeComment("Too long");
  await openUS2();

  await click(await scenario(FIRST));

  expect(screen.getByText('Lines 92–93, under "US2: Complete a repeating task (P1)"')).toBeTruthy();
  expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toBe("Too long");
});

/** Final review: a tap inside a nested item's comment field leaves its parent item alone. */
test("a nested item's comment field takes taps without selecting its parent", async () => {
  const r = repo();
  commitSpec(r, (text) =>
    text.replace("## User stories\n", "- Parent item\n  - Nested item\n\n## User stories\n"),
  );
  await renderPage(PAGE, r);
  await click(await nested());
  const field = await screen.findByLabelText("Comment text");

  await click(field);
  await typeComment("Only the nested one");

  expect((await scenario("Parent item")).getAttribute("aria-pressed")).toBe("false");
  expect((await nested()).getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toBe(
    "Only the nested one",
  );
});

/** The composer of the feature's session, once the page is drawn. */
function composer() {
  return screen.findByRole("textbox", { name: "Message Claude Code" });
}

/** US6.1 */
test("US6.1: Ask the agent opens the session with the selected lines quoted", async () => {
  const r = repo();
  await renderPage(PAGE, r, { agent: true });
  await openUS2();
  await click(await scenario(FIRST));
  await click(await scenario(SECOND));

  await click(await screen.findByRole("button", { name: "Ask the agent" }));

  expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`));
  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n").slice(91, 95);
  const box = await composer();
  await waitFor(() =>
    expect(box.textContent).toBe(
      `About ${SPEC}, lines 92–95:\n${lines.map((line) => `> ${line}`).join("\n")}\n\n`,
    ),
  );
});

/** US6.1, on one line */
test("Ask the agent on one line names that line", async () => {
  const r = repo();
  await renderPage(PAGE, r, { agent: true });
  await click(await scenario("The upgrade meets a saved due date"));

  await click(await screen.findByRole("button", { name: "Ask the agent" }));

  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n");
  const at = lines.findIndex((line) => line.includes("| The upgrade meets a saved due date"));
  const box = await composer();
  await waitFor(() =>
    expect(box.textContent).toBe(`About ${SPEC}, line ${at + 1}:\n> ${lines[at]}\n\n`),
  );
});

test("without the agent, a selection offers no Ask the agent", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  await click(await scenario(FIRST));

  await screen.findByLabelText("Comment text");
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
});

/** US1.4 in a review: the image opens full screen, and taps in it leave the block as it was. */
test("taps in a block's image, opened full screen, do not select the block", async () => {
  const r = fixtureRepo();
  commitSpec(r, (text) =>
    text.replace(
      "## User stories\n",
      "The banner: ![Login](images/login.webp)\n\n## User stories\n",
    ),
  );
  await renderPage(PAGE, r);
  const block = await scenario("The banner:");

  await click(screen.getByRole("link", { name: "Login" }));
  const dialog = screen.getByRole("dialog", { name: "Login" });
  await click(within(dialog).getByRole("img", { name: "Login" }));
  await click(dialog);

  expect(block.getAttribute("aria-pressed")).toBe("false");
  expect(screen.queryByLabelText("Comment text")).toBeNull();
});

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
const STILL_ADDING = "An image is still being added: wait for it, then try again.";

/** The texts shown on the page, not in the screen reader's announcements. */
function shown(text: string) {
  return screen
    .queryAllByText(text)
    .filter((element) => !element.closest("[data-astryx-live-region]"));
}

/** Whether a text was announced to screen readers. */
function announced(text: string) {
  return [...document.querySelectorAll("[data-astryx-live-region]")].some((region) =>
    region.textContent?.includes(text),
  );
}

/** The image a comment of the review links, in the feature's worktree. */
const IMAGE = `specs/${FOLDER}/images/login.webp`;

/** The last commit's subject on the feature's branch. */
const lastCommit = (r: string) => git(r, "log", "-1", "--format=%s", FOLDER).trim();

/** Opens a general comment and picks an image for it, linked once its upload ends. */
async function generalWithImage() {
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await pick([png("login.png")]);
}

/** Review focus 11, R64: an image uploading is in no file yet, which a verdict would delete. */
test("Request changes during an upload is refused, and commits nothing", async () => {
  const r = repo();
  const held = holdUploads(r);
  await renderPage(PAGE, r, { fetch: held.fetch });
  await click(await scenario(FIRST));
  await comment("Say it stays.");
  await saved(/^C1/, "Say it stays.");
  const before = lastCommit(r);
  await generalWithImage();
  await waitFor(() => expect(held.waiting).toHaveLength(1));

  await click(screen.getByRole("button", { name: "Request changes" }));

  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));
  expect(lastCommit(r)).toBe(before);
  await held.release();
  await waitFor(() =>
    expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toContain(
      "![login](images/login.webp)",
    ),
  );
  expect(lastCommit(r)).toBe(before);
});

/** US5 10: a comment open with text holds the verdict back, images or not (R16). */
test("a verdict with an open comment holding text is refused", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  const before = lastCommit(r);
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await typeComment("Half a tho");

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));
  expect(lastCommit(r)).toBe(before);
  expect(read(r, SPEC)).toContain("status: awaiting-human\n");
});

/** An open comment with no text lets the verdict through. */
test("a verdict with an open comment of no text goes through", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await click(await screen.findByRole("button", { name: "Add a general comment" }));

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  expect(shown(UNSENT)).toEqual([]);
});

/** R64: a comment cancelled lets the verdict through, and its image goes with the commit. */
test("a verdict after a comment with an image was cancelled deletes the image", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await generalWithImage();
  await waitFor(() => expect(existsSync(join(r, WORKTREE, IMAGE))).toBe(true));
  await waitFor(() =>
    expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toContain(
      "![login]",
    ),
  );

  await click(screen.getByRole("button", { name: "Cancel" }));
  await discard();
  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  expect(existsSync(join(r, WORKTREE, IMAGE))).toBe(false);
  expect(git(r, "ls-tree", "-r", "--name-only", FOLDER, `specs/${FOLDER}/images`).trim()).toBe("");
});

/** Adds a general comment holding an image, and opens a new comment on a block. */
async function addedWithImage() {
  await generalWithImage();
  await waitFor(() => expect(commentText()).toContain("![login]"));
  await typeComment(`Look: ${commentText()}`);
  await click(screen.getByRole("button", { name: "Add comment" }));
  await saved(/^C1/, "Look:");
  await click(await scenario(FIRST));
  await waitFor(() => expect(commentText()).toBe(""));
}

/** Final review: the comment added with its image holds nothing of the next one. */
test("after a comment with an image is added, a verdict with the next one empty goes through", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await addedWithImage();

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  expect(shown(UNSENT)).toEqual([]);
});

/** Final review: an image added to the next comment brings back nothing of the one added. */
test("after a comment with an image is added, an image on the next one adds its link alone", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await addedWithImage();

  await pick([png("other.png")]);

  await waitFor(() => expect(commentText()).toContain("![other]"));
  expect(commentText()).not.toContain("![login]");
});

/** R64: the refusal is said where the human looks: in the comment's sheet on the phone. */
test.each([
  [402, true],
  [1440, false],
])("at %i px, the verdict's refusal is in the comment form: %s", async (width, inForm) => {
  atWidth(width);
  const r = repo();
  await renderPage(PAGE, r);
  await generalWithImage();
  await waitFor(() =>
    expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toContain(
      "![login]",
    ),
  );

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));
  const form = screen.getByRole("form", { name: "Comment" });
  expect(form.contains(shown(UNSENT)[0]!)).toBe(inForm);
  await waitFor(() => expect(announced(UNSENT)).toBe(true));
  expect(lastCommit(r)).not.toBe("spec(recurring-tasks): approve");
});

/** A `beforeunload` event sent to the window, as a reload sends: cancelled or not. */
function unloadCancelled() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** Second review, R26: a comment kept in the closed sheet is not on the page; leaving asks nothing. */
test("on the phone, a new comment left in its closed sheet does not make leaving ask", async () => {
  atWidth(402);
  await renderPage(PAGE, repo());
  await click(await scenario(FIRST));
  const sheet = await screen.findByRole("dialog", { name: "Comment" });
  await act(async () => {
    fireEvent.change(within(sheet).getByLabelText("Comment text"), {
      target: { value: "Half typed" },
    });
  });
  expect(unloadCancelled()).toBe(true);

  await click(within(sheet).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Comment" })).toBeNull());
  expect(unloadCancelled()).toBe(false);
  // The text is kept for the sheet, which opens with it again.
  await click(await scenario(FIRST));
  const again = await screen.findByRole("dialog", { name: "Comment" });
  expect((within(again).getByLabelText("Comment text") as HTMLTextAreaElement).value).toBe(
    "Half typed",
  );
});

/** A comment cancelled during its upload leaves no form to say the refusal in: the page says it. */
test("on the phone, a verdict during the upload of a cancelled comment is refused on the page", async () => {
  atWidth(402);
  const r = repo();
  const held = holdUploads(r);
  await renderPage(PAGE, r, { fetch: held.fetch });
  await generalWithImage();
  await waitFor(() => expect(held.waiting).toHaveLength(1));
  await click(screen.getByRole("button", { name: "Cancel" }));

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(shown(STILL_ADDING)).toHaveLength(1));
  await waitFor(() => expect(announced(STILL_ADDING)).toBe(true));
  await held.release();
  // Once the image is in, the refusal is dealt with, and the verdict goes through.
  await waitFor(() => expect(shown(STILL_ADDING)).toEqual([]));
  await click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  expect(existsSync(join(r, WORKTREE, IMAGE))).toBe(false);
});

/** The refusal is about the open comment: it goes with it. */
test("the verdict's refusal goes once the comment is cancelled", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await generalWithImage();
  await waitFor(() =>
    expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toContain(
      "![login]",
    ),
  );
  await click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(shown(UNSENT)).toHaveLength(1));

  await click(screen.getByRole("button", { name: "Cancel" }));
  await discard();

  expect(shown(UNSENT)).toEqual([]);
});

/** An image picked for one comment never goes into another opened during its upload. */
test("an image picked for a comment does not go into a comment edited during its upload", async () => {
  const r = repo();
  const held = holdUploads(r);
  await renderPage(PAGE, r, { fetch: held.fetch });
  await click(await scenario(FIRST));
  await comment("Say it stays.");
  const pending = await saved(/^C1/, "Say it stays.");
  await generalWithImage();
  await waitFor(() => expect(held.waiting).toHaveLength(1));

  await click(within(pending).getByRole("button", { name: "Edit" }));
  await held.release();

  await waitFor(() => expect(shown("Added login.webp").length).toBeGreaterThan(0));
  expect((screen.getByLabelText("Comment text") as HTMLTextAreaElement).value).toBe(
    "Say it stays.",
  );
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

/** The comment field's text. */
const commentText = () => (screen.getByLabelText("Comment text") as HTMLTextAreaElement).value;

/** The page shown again, as after a reload: the store reads `localStorage` anew. */
async function reload(r: string) {
  forgetUnsaved();
  await renderPage(PAGE, r, { reload: true });
}

/** US3 1, SC-002: a keystroke renders the comment form, not the document. */
test("typing a comment renders none of the document's blocks (US3 1, SC-002)", async () => {
  // This scenario needs the large document. The save and restore scenarios need only the lines
  // they select: rendering 300 blocks for each of them multiplied coverage's work needlessly.
  await renderPage(PAGE, longSpec(300));
  await click(await scenario(LINE_40));
  const field = await screen.findByLabelText("Comment text");
  await act(async () => {});
  profiled.onRender.mockClear();

  await act(async () => {
    fireEvent.change(field, { target: { value: "a" } });
  });

  expect(commentText()).toBe("a");
  expect(profiled.onRender).not.toHaveBeenCalled();
});

/** US3 2: the form moves under the block tapped, its text with it, on the lines selected. */
test("the comment typed on line 40 follows the field to line 52 (US3 2)", async () => {
  await renderPage(PAGE, longSpec());
  await click(await scenario(LINE_40));
  await typeComment("Too vague");

  const block = await scenario(LINE_52);
  await click(block);

  const form = screen.getByRole("form", { name: "Comment" });
  expect(within(form).getByText(/^Lines 40–52, under "/)).toBeTruthy();
  expect(commentText()).toBe("Too vague");
  expect(block.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

/** The server in process, whose writes of a text wait until the test lets each one through. */
function holdWrites(repo: string, text: string) {
  const fetch = serverFetch(repo);
  const waiting: Array<() => void> = [];
  return {
    fetch: (async (input, init) => {
      if (typeof init?.body === "string" && init.body.includes(text)) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return fetch(input, init);
    }) as typeof globalThis.fetch,
    /** Lets the next write through, once it waits. */
    async release() {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      await act(async () => waiting.shift()!());
    },
  };
}

/** US3 3: a new comment shows under its block at once, marked "saving…" until it is written. */
test("a comment added shows under its block at once, saving… until written (US3 3)", async () => {
  const r = longSpec();
  const held = holdWrites(r, "Too vague");
  await renderPage(PAGE, r, { fetch: held.fetch });
  await click(await scenario(LINE_40));
  const block = await scenario(LINE_52);
  await click(block);
  await typeComment("Too vague");

  await click(screen.getByRole("button", { name: "Add comment" }));

  const adding = await waitFor(() => {
    const note = document.querySelector<HTMLElement>('[aria-label="Lines 40–52 · saving…"]');
    expect(note).toBeTruthy();
    return note!;
  });
  expect(adding.textContent).toContain("Too vague");
  expect(block.compareDocumentPosition(adding) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByLabelText("Comment text")).toBeNull();
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
  await held.release();
  await saved("C1 · lines 40–52", "Too vague");
  expect(screen.queryByText("saving…", { exact: false })).toBeNull();
  expect(read(r, REVIEW)).toContain("\nToo vague\n");
});

/** The spec's error handling: a comment refused shows its form again, its text kept. */
test("a comment refused as it is added comes back in its form, with the error", async () => {
  const r = longSpec();
  await renderPage(PAGE, r);
  await click(await scenario(LINE_40));
  await typeComment("# Too vague");

  await click(screen.getByRole("button", { name: "Add comment" }));

  expect(
    await screen.findByText('a comment line cannot start with "#"', { exact: false }),
  ).toBeTruthy();
  expect(commentText()).toBe("# Too vague");
  expect(document.querySelector('[aria-label="Line 40 · saving…"]')).toBeNull();
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
});

/** The spec's Ctrl+Enter, which saves every multi-line field: not while the comment is empty. */
test("Ctrl+Enter in a review comment adds it, and does nothing while it is empty", async () => {
  const r = longSpec();
  await renderPage(PAGE, r);
  await click(await scenario(LINE_40));
  const field = await screen.findByLabelText("Comment text");
  const ctrlEnter = () =>
    act(async () => {
      fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" });
    });
  await ctrlEnter();
  expect(existsSync(join(r, WORKTREE, REVIEW))).toBe(false);
  await typeComment("Too vague");

  await ctrlEnter();

  await saved("C1 · line 40", "Too vague");
  expect(read(r, REVIEW)).toContain("\nToo vague\n");
});

/** US5 7: Cancel on a comment typed asks first. */
test("Cancel on a review comment typed asks first (US5 7)", async () => {
  await renderPage(PAGE, longSpec());
  await click(await scenario(LINE_40));
  await typeComment("Too vague");

  await click(screen.getByRole("button", { name: "Cancel" }));
  const dialog = await screen.findByRole("dialog", { name: "Discard your comment?" });
  await click(within(dialog).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(commentText()).toBe("Too vague");

  await click(screen.getByRole("button", { name: "Cancel" }));
  await discard();
  await waitFor(() => expect(screen.queryByLabelText("Comment text")).toBeNull());
  await click(await scenario(LINE_40));
  expect(commentText()).toBe("");
});

/** US5 8: Cancel on an empty comment closes it without asking. */
test("Cancel on an empty review comment closes it without asking (US5 8)", async () => {
  await renderPage(PAGE, longSpec());
  await click(await scenario(LINE_40));

  await click(await screen.findByRole("button", { name: "Cancel" }));

  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(screen.queryByLabelText("Comment text")).toBeNull());
});

/** US5 1, SC-004: a comment typed comes back after a reload, on the lines it was on. */
test("a review comment typed is restored after a reload, with its lines", async () => {
  const r = longSpec();
  await renderPage(PAGE, r);
  await click(await scenario(LINE_40));
  await click(await scenario(LINE_52));
  await typeComment("Too vague");

  await reload(r);

  const form = await screen.findByRole("form", { name: "Comment" });
  expect(within(form).getByText(/^Lines 40–52, under "/)).toBeTruthy();
  expect(commentText()).toBe("Too vague");
  expect(screen.getByText("Unsaved text restored from", { exact: false })).toBeTruthy();
  expect((await scenario(LINE_52)).getAttribute("aria-pressed")).toBe("true");
});

/** Review focus 6: lines of a version the review is no longer on are named in the text. */
test("a comment restored after the reviewed commit changed is a general one", async () => {
  const r = longSpec();
  await renderPage(PAGE, r);
  await click(await scenario(LINE_40));
  await click(await scenario(LINE_52));
  await typeComment("Too vague");
  commitSpec(r, (text) => `${text}\nOne more line.\n`);

  await reload(r);

  const form = await screen.findByRole("form", { name: "Comment" });
  expect(within(form).getByText("General")).toBeTruthy();
  await waitFor(() =>
    expect(commentText()).toBe("On lines 40–52 of the previous version: Too vague"),
  );
  expect(document.querySelector("button[aria-pressed='true']")).toBeNull();
  await click(screen.getByRole("button", { name: "Add comment" }));
  await saved("C1 · general", "On lines 40–52 of the previous version: Too vague");
});

/** The summary's field, once the end of the page is drawn. */
async function summaryField() {
  await screen.findByRole("radio", { name: "high" });
  return screen.getByLabelText("Summary") as HTMLTextAreaElement;
}

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
  const form = screen.getByRole("form", { name: "Comment" });
  expect(within(form).getByText("Editing C1")).toBeTruthy();
  expect(commentText()).toBe("Second, edited.");

  await reload(r);

  const restored = await screen.findByRole("form", { name: "Comment" });
  expect(within(restored).getByText("Editing C1")).toBeTruthy();
  expect(commentText()).toBe("Second, edited.");
  await click(within(restored).getByRole("button", { name: "Save comment" }));
  await saved("C1 · line 52", "Second, edited.");
  expect(read(r, REVIEW)).toContain("Third.");
});

/** Second review: an edit kept for a number another comment took elsewhere does not open on it. */
test("an edit of a review comment removed elsewhere is not restored onto the next one", async () => {
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

  pendingComments(r, [
    [52, "Second."],
    [60, "Third."],
  ]);
  await reload(r);

  await screen.findByRole("group", { name: "C1 · line 52" });
  expect(screen.queryByRole("form", { name: "Comment" })).toBeNull();
  expect(screen.getByRole("group", { name: "C2 · line 60" }).textContent).toContain("Third.");
});

/** Second review: the summary typed while the verdict is being sent stays unsaved. */
test("the summary typed while Approve is sent is kept", async () => {
  const r = repo();
  const server = serverFetch(r);
  const waiting: Array<() => void> = [];
  // The verdict's response, once the server sent it.
  let responded: Promise<unknown> | undefined;
  const fetch = (async (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    if (!body.includes('"summary":"Close"')) {
      return server(input, init);
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
    const response = server(input, init);
    responded = response;
    return response;
  }) as typeof globalThis.fetch;
  await renderPage(PAGE, r, { fetch });
  const summary = await summaryField();
  await act(async () => {
    fireEvent.change(summary, { target: { value: "Close" } });
  });
  await click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(waiting).toHaveLength(1));

  await act(async () => {
    fireEvent.change(summary, { target: { value: "Close, and more" } });
  });
  await act(async () => waiting.shift()!());
  await act(async () => {
    await responded;
  });

  await waitFor(() => expect(screen.queryByRole("button", { name: "Approve" })).toBeNull());
  expect(lastCommit(r)).toBe("spec(recurring-tasks): approve");
  const kept = Object.keys(localStorage)
    .filter((key) => key.endsWith("#summary"))
    .map((key) => JSON.parse(localStorage.getItem(key)!).text);
  expect(kept).toEqual(["Close, and more"]);
});

/** SC-004: the review's summary typed comes back after a reload. */
test("the summary typed is restored after a reload", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  const summary = await summaryField();
  await act(async () => {
    fireEvent.change(summary, { target: { value: "Close" } });
  });

  await reload(r);

  expect((await summaryField()).value).toBe("Close");
  expect(screen.getByText("Unsaved text restored from", { exact: false })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  await waitFor(() =>
    expect(Object.keys(localStorage).filter((key) => key.endsWith("#summary"))).toEqual([]),
  );
});
