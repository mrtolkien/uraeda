import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
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

/** A repository whose spec has scenario 1 of US2 on lines 92 and 93, and risk tier medium. */
function repo() {
  const repo = fixtureRepo();
  commitSpec(repo, (text) =>
    text
      .replace("risk-tier: high", "risk-tier: medium")
      .replace("plan-review: true", "plan-review: false")
      .replace("## User stories\n", `${"Padding.\n\n".repeat(17)}## User stories\n`),
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

/**
 * A fold's trigger, by its label: the first with it, in the page's order, unless told otherwise.
 * Its state is open or closed, where a block's toggle is pressed or not, as the Details heading's.
 */
async function fold(name: string, index = 0) {
  return waitFor(() => {
    const triggers = screen
      .getAllByRole("button", { name })
      .filter((button) => button.hasAttribute("aria-expanded"));
    expect(triggers.length).toBeGreaterThan(index);
    return triggers[index]!;
  });
}

/** Opens a fold, as the human taps its trigger, unless it is open already. */
async function openFold(name: string, index = 0) {
  const trigger = await fold(name, index);
  if (trigger.getAttribute("aria-expanded") !== "true") {
    await click(trigger);
  }
}

/** Opens US2's scenarios, the first "Scenarios (4)" of the page: US4's come after. */
const openUS2 = () => openFold("Scenarios (4)");

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

/** The line of the spec's Testing table holding a phrase, at its branch's tip. */
function lineOf(r: string, phrase: string) {
  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n");
  return lines.findIndex((line) => line.includes(phrase)) + 1;
}

/** US1.1, SC-001 */
test("a spec under review shows each story's scenarios and its details folded", async () => {
  await renderPage(PAGE, repo());

  for (const name of ["Scenarios (3)", "Scenarios (4)", "Details"]) {
    expect((await fold(name)).getAttribute("aria-expanded")).toBe("false");
  }
  expect(screen.getAllByRole("button", { name: /^Scenarios \(\d\)$/ })).toHaveLength(4);
  const why = screen.getByText(
    "Why this priority: this is what saves users from recreating tasks.",
  );
  expect(folded(why)).toBe(false);
  for (const scenario of screen.getAllByText(/a weekly task due Monday the 5th/)) {
    expect(folded(scenario)).toBe(true);
  }
  expect(folded(screen.getByRole("heading", { name: "Data" }))).toBe(true);
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
  expect((await fold("Scenarios (4)")).getAttribute("aria-expanded")).toBe("true");
  expect((await fold("Scenarios (3)")).getAttribute("aria-expanded")).toBe("false");
  expect(folded(pending)).toBe(false);
  expect(folded(within(pending).getByRole("button", { name: "Edit" }))).toBe(false);
  expect(folded(within(pending).getByRole("button", { name: "Remove" }))).toBe(false);
});

/** The edge case of a pending comment inside Details. */
test("a pending comment in the details opens them", async () => {
  const r = repo();
  const line = lineOf(r, "| Upgrade of version 1 data");
  pendingComment(r, line, line);
  await renderPage(PAGE, r);

  const pending = await screen.findByRole("group", { name: `C1 · line ${line}` });
  expect((await fold("Details")).getAttribute("aria-expanded")).toBe("true");
  expect(folded(pending)).toBe(false);
});

/** Review focus 1 */
test("closing a fold keeps the draft", async () => {
  await renderPage(PAGE, repo());
  await openUS2();
  await click(await scenario(FIRST));
  await typeComment("Twice?");

  await click(await fold("Scenarios (4)"));
  expect((await fold("Scenarios (4)")).getAttribute("aria-expanded")).toBe("false");
  expect(folded(screen.getByLabelText("Comment text"))).toBe(true);
  await click(await fold("Scenarios (4)"));

  expect((await fold("Scenarios (4)")).getAttribute("aria-expanded")).toBe("true");
  const field = screen.getByLabelText("Comment text") as HTMLTextAreaElement;
  expect(folded(field)).toBe(false);
  expect(field.value).toBe("Twice?");
});

test("a fold's trigger opens it and selects no block", async () => {
  await renderPage(PAGE, repo());

  await click(await fold("Details"));
  await click(await fold("Scenarios (4)"));

  expect((await fold("Details")).getAttribute("aria-expanded")).toBe("true");
  expect((await fold("Scenarios (4)")).getAttribute("aria-expanded")).toBe("true");
  expect(screen.queryByLabelText("Comment text")).toBeNull();
  expect(document.querySelector("button[aria-pressed='true']")).toBeNull();
});

/** Review C2: the mockups, the easiest part of a spec to check, open from the top of its review. */
test("the mockups are first on a spec under review", async () => {
  await renderPage(PAGE, repo());

  const mockups = await screen.findByRole("region", { name: "Mockups" });
  const story = screen.getByRole("heading", { name: "User stories" });
  expect(mockups.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const push = vi.spyOn(window.history, "pushState");
  await click(within(mockups).getByRole("button", { name: "Open the mockup: Repeat" }));
  // Opened in the page's own repository, not through the most recently opened one's redirect.
  expect(push).toHaveBeenCalledWith(
    expect.anything(),
    "",
    atRepo(`/f/${FOLDER}/mockups/repeat.html`),
  );
  expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/mockups/repeat.html`));
  push.mockRestore();
});

/** Review C2: a spec without mockups has no place for them. */
test("a spec without mockups has no mockups region", async () => {
  const r = fixtureRepo();
  commitSpec(r, (text) => text.replace(/## Mockups\n[\s\S]*?(?=## Assumptions)/, ""));
  await renderPage(PAGE, r);

  await screen.findByRole("heading", { name: "User stories" });
  expect(screen.queryByRole("region", { name: "Mockups" })).toBeNull();
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
  await openFold("Details");
  const row = await scenario("Upgrade of version 1 data");

  await click(row);
  await comment("Which version?");

  await saved(/^C1 · line \d+$/, "Which version?");
  const review = read(r, REVIEW);
  expect(review).toMatch(/## C1: Line \d+, under "[^"]+"\n\n> \| Upgrade of version 1 data/);
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
  await openFold("Details");
  await click(await scenario("Upgrade of version 1 data"));

  await click(await screen.findByRole("button", { name: "Ask the agent" }));

  const lines = git(r, "show", `${FOLDER}:${SPEC}`).split("\n");
  const at = lines.findIndex((line) => line.includes("| Upgrade of version 1 data"));
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

const UNSENT = "Add or cancel your comment first: its images are not in the review yet.";
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

/** R64: only a comment's images hold a verdict back, not its text. */
test("a verdict with an open comment of text alone goes through", async () => {
  const r = repo();
  await renderPage(PAGE, r);
  await click(await screen.findByRole("button", { name: "Add a general comment" }));
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "Half a tho" } });
  });

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
  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(lastCommit(r)).toBe("spec(recurring-tasks): approve"));
  expect(existsSync(join(r, WORKTREE, IMAGE))).toBe(false);
  expect(git(r, "ls-tree", "-r", "--name-only", FOLDER, `specs/${FOLDER}/images`).trim()).toBe("");
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
