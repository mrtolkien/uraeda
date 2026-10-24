// Questions page US2: the outline lists the whole round, every part of it in the page's order, and
// `n` goes to the next blank question, follow-ups included. US4 more 2: a round without points to
// check has no "Check these" row.
//
// Until the round page draws the outline in its column, the test draws it beside the page, over
// the round the core reads from the same repository: the page draws the parts it jumps to. The page
// is drawn on the phone, where its own navigation has no `n` and `p` (R16).
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vite-plus/test";
import { readFile, readRound } from "uraeda-binding";
import type { NavQuestion } from "../roundJump.ts";
import { OutlineSheet, RoundOutline } from "../RoundOutline.tsx";
import { atWidth, click, fixture, fixtureRepo, git, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const NAME = "clarifications-01.md";
const PAGE = `/f/${FOLDER}/${NAME}`;

today("2026-10-11");

/** The merge-chats round 01, in the new format: 2 points to check, 3 of behaviour, 3 under the hood. */
const MERGE_CHATS = readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8");

/**
 * The round's questions in the page's order, as the fixture has them: Q2.A follows Q2, once asked.
 */
const ASKED = ["Q1", "Q2", "Q2.A", "Q3", "Q4", "Q5", "Q6", "Q7"];

/** The round's text without its `## Check these` section. */
const withoutCheck = (text: string) =>
  text.slice(0, text.indexOf("## Check these")) + text.slice(text.indexOf("## Q1:"));

/** A repository whose round, in the feature's worktree, is `text` with these answers. */
function round(text: string, answers: Record<string, string> = {}) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  const lines = text.split("\n");
  for (const [id, answer] of Object.entries(answers)) {
    const heading = lines.findIndex((line) => /^#{2,3} /.test(line) && line.includes(` ${id}:`));
    const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
    lines[at] = `**Answer:** ${answer}`;
  }
  writeFileSync(join(repo, ".worktrees", FOLDER, "specs", FOLDER, NAME), lines.join("\n"));
  return repo;
}

/** The round's page on the phone, and the round as the core reads it, with its questions. */
async function roundPage(repo: string) {
  atWidth(402);
  await renderPage(PAGE, repo);
  await screen.findAllByText(/Who may move a chat up to a change/);
  const file = await readFile(repo, FOLDER, NAME);
  const round = file.current.items.clarifications!;
  const questions: Array<NavQuestion> = ASKED.flatMap((id) =>
    round.questions
      .filter((q) => q.id === id && q.asked)
      .map((q) => ({
        answered: q.answer.trim() !== "",
        id: q.id,
        level: q.parent ? 2 : 1,
        title: q.title,
      })),
  );
  return { document: file.current.document, questions, round };
}

/** The round's page on the phone, and its outline drawn beside it. */
async function outline(repo: string) {
  const parts = await roundPage(repo);
  await act(async () => {
    render(<RoundOutline isActive onSubmit={() => {}} {...parts} />);
  });
  return screen.getByRole("navigation", { name: "Outline" });
}

/** The phone's outline sheet over the round's page, open until a row closes it. */
function Sheet(parts: Omit<Parameters<typeof OutlineSheet>[0], "isOpen" | "onClose">) {
  const [isOpen, setOpen] = useState(true);
  return <OutlineSheet isOpen={isOpen} onClose={() => setOpen(false)} {...parts} />;
}

/** The outline's rows, by their text. */
const rows = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole("button")
    .filter((button) => !["Next", "Submit"].includes(button.textContent ?? ""))
    .map((row) => row.textContent ?? "");

test("the outline lists the whole round (US2 key 3)", async () => {
  const nav = await outline(round(MERGE_CHATS, { Q2: "A" }));

  expect(nav.textContent).toContain("1 of 8 answered");
  const read = rows(nav).map((row) => row.replace(/^[✓○] (Q[\d.A-Z]+) .*/, "$1"));
  expect(read).toEqual([
    "Verdict and summary",
    "Goal",
    "Today",
    "Scope",
    "Sources",
    "Check these · 2",
    "Q1",
    "Q2",
    "Q2.A",
    "Q3",
    "Q4",
    "Q5",
    "Q6",
    "Q7",
    "Behaviour · 3",
    "Under the hood · 3",
    "Notes and submit",
  ]);
  // A question's row shows its state by a glyph, which its name leaves for words.
  expect(rows(nav)[7]).toMatch(/^✓ Q2 Where does a new chat work\?/);
  expect(
    within(nav).getByRole("button", { name: "Q2 Where does a new chat work? (answered)" }),
  ).toBeTruthy();
  expect(within(nav).getByRole("button", { name: /^Q1 .*\(unanswered\)$/ })).toBeTruthy();
});

test("n goes to the next blank question, follow-ups included (US2 more 2)", async () => {
  const nav = await outline(round(MERGE_CHATS, { Q1: "A", Q2: "A" }));

  await click(within(nav).getByRole("button", { name: /^Q1 .*\(answered\)$/ }));
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "n" });
  });

  expect(document.activeElement?.textContent).toContain("What may a chat change on your main");
});

test("a tap on Today asks the page to open it, by the address", async () => {
  const nav = await outline(round(MERGE_CHATS));

  await click(within(nav).getByRole("button", { name: "Today" }));

  expect(window.location.hash).toBe("#today");
});

test("no Check these without points (US4 more 2)", async () => {
  const nav = await outline(round(withoutCheck(MERGE_CHATS)));

  expect(rows(nav)).toContain("Behaviour · 3");
  expect(rows(nav).some((row) => row.startsWith("Check these"))).toBe(false);
});

test("on the phone, the outline's sheet closes on a tap, then goes there (US2 more 3)", async () => {
  const parts = await roundPage(round(MERGE_CHATS, { Q1: "A" }));
  await act(async () => {
    render(<Sheet {...parts} />);
  });
  const sheet = await screen.findByRole("dialog", { name: "Outline" });
  expect(sheet.textContent).toContain("1 of 7 answered");

  await click(within(sheet).getByRole("button", { name: /^Q3 .*\(unanswered\)$/ }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outline" })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain("Does the chat's conversation become"),
  );
});

test("a triage's Context row brings its free context to the top", async () => {
  const repo = fixtureRepo();
  copyFileSync(fixture("INBOX-TRIAGE.md"), join(repo, "specs/INBOX-TRIAGE.md"));
  git(repo, "add", "specs/INBOX-TRIAGE.md");
  git(repo, "commit", "--quiet", "-m", "chore: propose an inbox triage");
  atWidth(402);
  await renderPage("/inbox/triage", repo, { agent: true });
  await screen.findByRole("heading", { level: 1, name: "Inbox triage" });
  const file = (await readRound(repo, "inbox-triage"))!;
  const round = file.current.items.clarifications!;
  const questions: Array<NavQuestion> = round.questions.map((q) => ({
    answered: false,
    id: q.id,
    level: 1,
    title: q.title,
  }));
  await act(async () => {
    render(
      <RoundOutline
        document={file.current.document}
        isActive
        onSubmit={() => {}}
        questions={questions}
        round={round}
      />,
    );
  });
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;

  await click(
    within(screen.getByRole("navigation", { name: "Outline" })).getByRole("button", {
      name: "Context",
    }),
  );

  expect(scrolled).toHaveBeenCalledOnce();
  expect(scrolled.mock.contexts[0]).toBe(screen.getByRole("region", { name: "Context" }));
});

/** A Behaviour item that does not start in bold: no point, so no comment and no count. */
const THIRD_POINT = "- **The upgraded change's entry** goes";
const NOT_A_POINT = "- The upgraded change's entry goes";

test("a group counts only its points, in its pane and in the outline", async () => {
  const nav = await outline(round(MERGE_CHATS.replace(THIRD_POINT, NOT_A_POINT)));

  expect(rows(nav)).toContain("Behaviour · 2");
  const behaviour = screen.getByRole("region", { name: "Behaviour" });
  expect(within(behaviour).getByRole("heading").textContent).toContain("· 2");
});

test("a group without points has no pane and no row", async () => {
  const behaviour = MERGE_CHATS.slice(
    MERGE_CHATS.indexOf("### Behaviour"),
    MERGE_CHATS.indexOf("### Under the hood"),
  );
  const nav = await outline(
    round(
      MERGE_CHATS.replace(behaviour, behaviour.replaceAll("- **", "- ").replaceAll("** ", " ")),
    ),
  );

  expect(rows(nav).some((row) => row.startsWith("Behaviour"))).toBe(false);
  expect(screen.queryByRole("region", { name: "Behaviour" })).toBeNull();
  expect(screen.getByRole("region", { name: "Under the hood" })).toBeTruthy();
});
