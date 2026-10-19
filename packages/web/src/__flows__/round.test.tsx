// Flow: a round of questions. The human answers by tap and by comment, text saves only on an
// explicit action, unsaved text is kept and marked, a refused write keeps the text next to its
// question, Submit commits the round, and the page keeps its place. Each test answers the round of
// a feature of its own, in the one repository of the file.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  PHONE,
  atWidth,
  click,
  fixtureRepo,
  quiet,
  refreshUntil,
  startApp,
  type,
} from "./harness.tsx";
import { addRound, answerLine, checkOut, editElsewhere, lastSubject, roundNow } from "./rounds.ts";

const ALL = { Q1: "A", Q2: "A", Q3: "A" };
const FOLDERS = {
  answer: "2026-10-21-answer",
  comment: "2026-10-21-comment",
  done: "2026-10-21-done",
  elsewhere: "2026-10-21-elsewhere",
  follow: "2026-10-21-follow",
  fresh: "2026-10-21-fresh",
  hook: "2026-10-21-hook",
  notes: "2026-10-21-notes",
  phone: "2026-10-21-phone",
  place: "2026-10-21-place",
  refused: "2026-10-21-refused",
  restore: "2026-10-21-restore",
  submit: "2026-10-21-submit",
  typed: "2026-10-21-typed",
  warn: "2026-10-21-warn",
};

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    addRound(repo, FOLDERS.answer);
    addRound(repo, FOLDERS.comment, { Q2: "A" });
    addRound(repo, FOLDERS.follow, { Q1: "A" });
    addRound(repo, FOLDERS.notes, ALL);
    addRound(repo, FOLDERS.submit, ALL);
    addRound(repo, FOLDERS.typed, { Q1: "A", Q2: "A" });
    addRound(repo, FOLDERS.warn);
    addRound(repo, FOLDERS.hook, ALL);
    addRound(repo, FOLDERS.refused, ALL);
    addRound(repo, FOLDERS.elsewhere);
    addRound(repo, FOLDERS.restore);
    addRound(repo, FOLDERS.done);
    addRound(repo, FOLDERS.place, { Q1: "A" });
    addRound(repo, FOLDERS.phone, { Q1: "A" });
    addRound(repo, FOLDERS.fresh);
    for (const folder of [FOLDERS.refused, FOLDERS.elsewhere, FOLDERS.done]) {
      checkOut(repo, folder);
    }
    return repo;
  },
});

const page = (folder: string) => `/f/${folder}/clarifications-01.md`;

/** A question's card: the page gives each question its id as an anchor. */
function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The checkbox of a question's option, by its letter. */
function option(id: string, letter: string) {
  return within(question(id)).getByRole("checkbox", {
    name: new RegExp(String.raw`^Option ${letter}\b`),
  }) as HTMLInputElement;
}

/** The comment field of a question: the only text box of its card. */
function comment(id: string) {
  return within(question(id)).getByRole("textbox") as HTMLTextAreaElement;
}

/** The notices a question's card shows right now. */
function statuses(id: string) {
  return within(question(id)).queryAllByRole("status").length;
}

/** The comment's Save button, enabled once the text differs from what is saved. */
function saveButton(id: string) {
  return within(question(id)).getByRole("button", { name: /^save/i }) as HTMLButtonElement;
}

/** The text typed, as the human types it into a field. */
async function typeIn(element: HTMLElement, value: string) {
  await type(element, value);
}

/** Saves a question's comment from the keyboard, as Ctrl+Enter does. */
async function saveFromKeyboard(id: string) {
  await act(async () => {
    fireEvent.keyDown(comment(id), { ctrlKey: true, key: "Enter" });
  });
}

/** The page's Submit answers button. */
function submit() {
  return screen.getByRole("button", { name: "Submit answers" }) as HTMLButtonElement;
}

async function open(folder: string, id = "Q1") {
  await app.open(page(folder));
  await waitFor(() => expect(question(id)).toBeTruthy());
}

test("a tapped option is saved as the letters picked, in order, and the page shows them picked", async () => {
  await open(FOLDERS.answer);

  await click(option("Q2", "A"));
  await waitFor(() => expect(answerLine(app.repo, FOLDERS.answer, "Q2")).toBe("**Answer:** A"));
  await click(option("Q2", "C"));
  await waitFor(() =>
    expect(answerLine(app.repo, FOLDERS.answer, "Q2")).toBe("**Answer:** A and C"),
  );

  expect(option("Q2", "A").checked).toBe(true);
  expect(option("Q2", "B").checked).toBe(false);
  await click(option("Q2", "A"));
  await waitFor(() => expect(answerLine(app.repo, FOLDERS.answer, "Q2")).toBe("**Answer:** C"));

  // Read back, the answer selects its letters.
  await app.open(page(FOLDERS.answer), { reload: true });
  await waitFor(() => expect(option("Q2", "C").checked).toBe(true));
});

test("a comment saves only on an explicit action, follows the letters, and alone is the answer", async () => {
  await open(FOLDERS.comment, "Q2");
  const before = roundNow(app.repo, FOLDERS.comment);

  await typeIn(comment("Q2"), "but only for the dev server");

  // Typing saves nothing: the file is as it was, and the Save button is the way.
  expect(roundNow(app.repo, FOLDERS.comment)).toBe(before);
  expect(saveButton("Q2").disabled).toBe(false);
  await click(saveButton("Q2"));
  await waitFor(() =>
    expect(answerLine(app.repo, FOLDERS.comment, "Q2")).toBe(
      "**Answer:** A: but only for the dev server",
    ),
  );
  await waitFor(() => expect(saveButton("Q2").disabled).toBe(true));

  // A comment with no letter is the human's own answer, saved from the keyboard.
  await typeIn(comment("Q3"), "Neither, keep it simple");
  await saveFromKeyboard("Q3");
  await waitFor(() =>
    expect(answerLine(app.repo, FOLDERS.comment, "Q3")).toBe("**Answer:** Neither, keep it simple"),
  );
});

test("a follow-up is a card of its own after its parent once its letter is picked, and goes with it", async () => {
  await open(FOLDERS.follow);
  expect(question("Q1.B")).toBeNull();

  await click(option("Q1", "B"));

  await waitFor(() => expect(question("Q1.B")).toBeTruthy());
  const follows = question("Q1").compareDocumentPosition(question("Q1.B"));
  const precedes = question("Q1.B").compareDocumentPosition(question("Q2"));
  expect(follows & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(precedes & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(question("Q1").contains(question("Q1.B"))).toBe(false);

  await click(option("Q1", "B"));

  await waitFor(() => expect(question("Q1.B")).toBeNull());
});

test("a comment that starts like a letter warns when no letter is picked, as it would read back as picking it", async () => {
  await open(FOLDERS.warn, "Q3");
  const before = statuses("Q3");

  await typeIn(comment("Q3"), "Neither, keep it simple");
  expect(statuses("Q3")).toBe(before);
  await typeIn(comment("Q3"), "B: maybe later");

  expect(statuses("Q3")).toBeGreaterThan(before);
});

test("the notes save only on an explicit action, as the round's last line", async () => {
  await open(FOLDERS.notes);
  const notes = screen.getAllByRole("textbox").at(-1)!;
  const before = roundNow(app.repo, FOLDERS.notes);

  await typeIn(notes, "LGTM");
  expect(roundNow(app.repo, FOLDERS.notes)).toBe(before);
  const save = screen
    .getAllByRole("button", { name: /^save/i })
    .find((button) => !button.hasAttribute("disabled"))!;
  await click(save);

  await waitFor(() =>
    expect(roundNow(app.repo, FOLDERS.notes).trimEnd().endsWith("**Notes:** LGTM")).toBe(true),
  );
});

test("Submit waits until every question is answered, saves what is typed, and commits the round", async () => {
  await open(FOLDERS.typed, "Q3");
  // One question is blank: Submit is not offered yet, and spaces answer nothing.
  expect(submit().disabled).toBe(true);
  await typeIn(comment("Q3"), "   ");
  expect(submit().disabled).toBe(true);

  // A comment typed, not saved, answers it, and Submit saves it first.
  await typeIn(comment("Q3"), "keep it simple");
  expect(submit().disabled).toBe(false);
  await click(submit());

  await waitFor(() =>
    expect(lastSubject(app.repo, FOLDERS.typed)).not.toBe("work on " + FOLDERS.typed),
  );
  expect(
    git(app.repo, "show", `${FOLDERS.typed}:specs/${FOLDERS.typed}/clarifications-01.md`),
  ).toContain("**Answer:** keep it simple");
  expect(roundNow(app.repo, FOLDERS.typed)).toContain("status: answered");
  // Answered, the round is read-only: no Submit.
  await waitFor(() => expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull());
});

test("Submit commits the answered round and its notes typed meanwhile", async () => {
  await open(FOLDERS.submit);
  const notes = screen.getAllByRole("textbox").at(-1)!;
  await typeIn(notes, "Ship it");

  await click(submit());

  await waitFor(() => expect(roundNow(app.repo, FOLDERS.submit)).toContain("status: answered"));
  await waitFor(() =>
    expect(
      git(app.repo, "show", `${FOLDERS.submit}:specs/${FOLDERS.submit}/clarifications-01.md`),
    ).toContain("**Notes:** Ship it"),
  );
});

test("a refused answer keeps its text next to its question, and Submit stops", async () => {
  await open(FOLDERS.refused);
  // The round changes elsewhere while the human is typing.
  editElsewhere(app.repo, FOLDERS.refused, (round) =>
    round.replace("**Answer:** A", "**Answer:** C"),
  );

  await typeIn(comment("Q1"), "mine");
  await click(saveButton("Q1"));

  // The error stays at the question and the text is kept, still unsaved.
  expect(await within(question("Q1")).findByRole("alert")).toBeTruthy();
  expect(comment("Q1").value).toBe("mine");
  expect(saveButton("Q1").disabled).toBe(false);
  await click(submit());
  await waitFor(() =>
    expect(roundNow(app.repo, FOLDERS.refused)).not.toContain("status: answered"),
  );
  expect(lastSubject(app.repo, FOLDERS.refused)).toBe(`work on ${FOLDERS.refused}`);
});

test("a hook's refusal keeps the answers saved, and Try again commits them", async () => {
  const hooks = join(app.repo, ".git/hooks");
  git(app.repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho refused\nexit 1\n", { mode: 0o755 });
  await open(FOLDERS.hook);

  await click(submit());

  const retry = await screen.findByRole("button", { name: "Try again" });
  expect(lastSubject(app.repo, FOLDERS.hook)).toBe(`work on ${FOLDERS.hook}`);
  expect(answerLine(app.repo, FOLDERS.hook, "Q1")).toBe("**Answer:** A");
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await click(retry);

  await waitFor(() =>
    expect(lastSubject(app.repo, FOLDERS.hook)).not.toBe(`work on ${FOLDERS.hook}`),
  );
});

test("an answer changed elsewhere shows when the page reads again, and the next save builds on it", async () => {
  await open(FOLDERS.elsewhere, "Q2");
  editElsewhere(app.repo, FOLDERS.elsewhere, (round) => {
    const at = round.indexOf("## Q2:");
    return round.slice(0, at) + round.slice(at).replace("**Answer:**", "**Answer:** C");
  });

  await refreshUntil(() => expect(option("Q2", "C").checked).toBe(true));
  await typeIn(comment("Q2"), "mine");
  await click(saveButton("Q2"));

  await waitFor(() =>
    expect(answerLine(app.repo, FOLDERS.elsewhere, "Q2")).toBe("**Answer:** C: mine"),
  );
});

test("unsaved text is kept across a reload with a way to discard it, and survives the round being answered elsewhere", async () => {
  await open(FOLDERS.restore, "Q3");
  await typeIn(comment("Q3"), "Half typed");

  forgetUnsaved();
  await app.open(page(FOLDERS.restore), { reload: true });
  await waitFor(() => expect(comment("Q3").value).toBe("Half typed"));
  // The restored text is unsaved, and the page offers to discard it.
  expect(saveButton("Q3").disabled).toBe(false);
  const discard = within(question("Q3")).getByRole("button", { name: "Discard" });
  await click(discard);
  expect(comment("Q3").value).toBe("");

  // Typed again, the text is kept when the round is answered elsewhere: never dropped.
  await typeIn(comment("Q3"), "Too late");
  checkOut(app.repo, FOLDERS.restore);
  editElsewhere(app.repo, FOLDERS.restore, (round) =>
    round.replace("status: awaiting-human", "status: answered"),
  );
  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );
  expect(within(question("Q3")).getByRole("button", { name: "Discard" })).toBeTruthy();
});

test("an answered round is read-only: its options cannot be tapped", async () => {
  await open(FOLDERS.done);
  editElsewhere(app.repo, FOLDERS.done, (round) =>
    round.replace("status: awaiting-human", "status: answered"),
  );

  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );
  const before = roundNow(app.repo, FOLDERS.done);
  await click(option("Q2", "A"));
  await quiet();
  expect(roundNow(app.repo, FOLDERS.done)).toBe(before);
});

test("the round opens at the first blank question once one is answered, and at its top when none is", async () => {
  await open(FOLDERS.place, "Q2");
  await waitFor(() => expect(document.activeElement?.id).toMatch(/^Q2(-|$)/));

  cleanup();
  await app.open(page(FOLDERS.fresh));
  await waitFor(() => expect(question("Q2")).toBeTruthy());
  expect(document.activeElement?.id ?? "").not.toMatch(/^Q\d/);
});

test("on the phone an index of the questions jumps to one, and the round stays the page", async () => {
  atWidth(PHONE);
  await open(FOLDERS.phone, "Q3");
  const index = await screen.findByRole("navigation", { name: "Questions" });
  const rows = within(index).getAllByRole("button");

  await click(rows.at(-1)!);

  await waitFor(() => expect(document.activeElement?.id).toMatch(/^Q3(-|$)/));
  expect(window.location.pathname).toBe(app.path(page(FOLDERS.phone)));
});
