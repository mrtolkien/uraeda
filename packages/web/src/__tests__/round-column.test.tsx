// Questions page US3 and US5, and their edge cases: on wide and semi-wide screens, a round waiting
// for answers has a column of Outline, Notes, and, for a feature whose agent is available, Session.
// "Ask the agent" and "Ask" write their quote into the session's composer and open Session; on the
// phone they open the session's page. The notes are one field, written in the Notes tab or the
// phone's sheet, and shown at the round's end. Review focus 4 and 5: typed text stays through tabs
// and widths, and asking while the agent works sends nothing.
//
// The round is the merge-chats round 01, written in the web-ui feature's worktree: the quotes name
// that file's path, where the spec names the merge-chats feature's.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { COLUMN_KEY } from "../layout/documentColumnWidth.ts";
import {
  atRepo,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const NAME = "clarifications-01.md";
const PAGE = `/f/${FOLDER}/${NAME}`;
const ROUND = `specs/${FOLDER}/${NAME}`;

today("2026-10-11");

/** The merge-chats round 01, in the new format. */
const MERGE_CHATS = readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8");

/** Every question the round asks once Q2 is answered A, Q2.A included. */
const ALL = ["Q1", "Q2", "Q2.A", "Q3", "Q4", "Q5", "Q6", "Q7"];

/** The quotes the spec gives, on this round's path. */
const Q2_QUOTE = `About Q2 of ${ROUND}:\n> Where does a new chat work?`;
const Q3_QUOTE = `About Q3 of ${ROUND}:\n> Does the chat's conversation become the change's session?`;
const LIGHT_FLOW_QUOTE = `About the settled point of ${ROUND}:\n> The light flow stays.`;

/** A repository whose round, in the feature's worktree, is the merge-chats round with these answers. */
function round(answers: Record<string, string> = {}, text = MERGE_CHATS) {
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

/** The round's page, drawn, at `path`. */
async function open(path: string, repo: string, agent: boolean | Fake = true) {
  const page = await renderPage(path, repo, { agent });
  await screen.findAllByText(/Who may move a chat up to a change/);
  return page;
}

function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The names the column's tabs may have. */
const TAB_NAMES = ["Outline", "Notes", "Session"];

/** The column's tabs, by their names, in their order. */
function tabs() {
  const list = screen.getByRole("tablist", { name: "The round's column" });
  const all = within(list).getAllByRole("tab");
  const at = (name: string) => all.indexOf(within(list).getByRole("tab", { name }));
  return TAB_NAMES.filter((name) => within(list).queryByRole("tab", { name })).sort(
    (a, b) => at(a) - at(b),
  );
}

/** The open tab's name. */
function openTab() {
  return TAB_NAMES.find((name) => screen.queryByRole("tab", { name, selected: true }));
}

/** The session's composer, in the column. */
function composer() {
  const panel = screen.getByRole("tabpanel", { name: "Session" });
  return within(panel).findByRole("textbox", { name: "Message Claude Code" });
}

/** Asks the agent about a question, from its card. */
async function askAbout(id: string) {
  await click(within(question(id)).getAllByRole("button", { name: "Ask the agent" })[0]!);
}

/** The round's end, with its notes. */
function end() {
  return screen.getByRole("region", { name: "Notes" });
}

/** The notes' field. */
function notesField() {
  return screen.getByRole("textbox", { name: "Anything else" }) as HTMLTextAreaElement;
}

/** Q3's comment field. */
function comment() {
  return within(question("Q3")).getByLabelText(
    "Comment, or your own answer instead of a letter",
  ) as HTMLTextAreaElement;
}

/** US3 key 1 and 2, SC-003 */
test("asking about Q2 opens Session with its quote", async () => {
  await open(PAGE, round());
  expect(tabs()).toEqual(["Outline", "Notes", "Session"]);
  expect(openTab()).toBe("Outline");

  await askAbout("Q2");

  expect(openTab()).toBe("Session");
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("session");
  expect(window.location.pathname).toBe(atRepo(PAGE));
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${Q2_QUOTE}\n\n`));
});

/** US3 more 2, and the high edge case on the quote */
test("asking again replaces the quote and keeps the text", async () => {
  await open(PAGE, round());
  await askAbout("Q2");
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${Q2_QUOTE}\n\n`));
  await type(box, `${Q2_QUOTE}\n\nwhy would that cost more?`);

  await askAbout("Q3");

  await waitFor(() => expect(box.textContent).toBe(`${Q3_QUOTE}\n\nwhy would that cost more?`));
});

/** US3 more 1 */
test("asking about a point to check quotes its subject", async () => {
  await open(PAGE, round());
  const check = screen.getByRole("region", { name: "Check these" });

  await click(within(check).getByRole("button", { name: 'Ask about "The light flow stays."' }));

  expect(openTab()).toBe("Session");
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${LIGHT_FLOW_QUOTE}\n\n`));
});

/** US3 more 3 */
test("the open tab is in the address", async () => {
  const repo = round();
  await open(`${PAGE}?tab=session`, repo);
  expect(openTab()).toBe("Session");

  await renderPage(PAGE, repo, { agent: true, reload: true });
  await screen.findAllByText(/Who may move a chat up to a change/);

  expect(openTab()).toBe("Session");
  expect(await composer()).toBeTruthy();
});

/** US5 key 1 and 2 */
test("a note from the Notes tab shows at the end, and Submit saves it", async () => {
  const repo = round(Object.fromEntries(ALL.map((id) => [id, "A"])));
  await open(PAGE, repo, false);
  expect(within(end()).getByRole("button", { name: "Write a note" })).toBeTruthy();

  await click(screen.getByRole("tab", { name: "Notes" }));
  await type(notesField(), "Check the spec page too.");

  expect(within(end()).getByText("Check the spec page too.")).toBeTruthy();
  expect(within(end()).getByText("Unsaved changes")).toBeTruthy();
  expect(within(end()).getByRole("button", { name: "Edit notes" })).toBeTruthy();

  await click(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain("**Notes:** Check the spec page too.");
});

/** The edge case "the column folded", R23: asking, or Edit notes, unfolds it. */
test("asking with the column folded unfolds it on Session, its composer focused", async () => {
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ folded: true }));
  await open(PAGE, round());
  expect(screen.queryByRole("tablist", { name: "The round's column" })).toBeNull();

  await askAbout("Q2");

  expect(openTab()).toBe("Session");
  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${Q2_QUOTE}\n\n`));
  await waitFor(() => expect(box.contains(document.activeElement)).toBe(true));
});

test("Edit notes with the column folded unfolds it on Notes, its field focused", async () => {
  window.localStorage.setItem(COLUMN_KEY, JSON.stringify({ folded: true }));
  await open(PAGE, round());

  await click(within(end()).getByRole("button", { name: "Write a note" }));

  expect(openTab()).toBe("Notes");
  await waitFor(() => expect(document.activeElement).toBe(notesField()));
});

test("Edit notes opens the Notes tab, its field focused", async () => {
  await open(PAGE, round());

  await click(within(end()).getByRole("button", { name: "Write a note" }));

  expect(openTab()).toBe("Notes");
  await waitFor(() => expect(document.activeElement).toBe(notesField()));
});

/** US2 more 3 */
test("on the phone, 1/8 opens the outline in a sheet, and a row closes it", async () => {
  atWidth(402);
  await open(PAGE, round({ Q2: "A" }));
  expect(screen.queryByRole("tablist", { name: "The round's column" })).toBeNull();

  await click(screen.getByRole("button", { name: "1/8" }));
  const sheet = await screen.findByRole("dialog", { name: "Outline" });
  await click(within(sheet).getByRole("button", { name: /^Q3 .*\(unanswered\)$/ }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Outline" })).toBeNull());
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain("Does the chat's conversation become"),
  );
});

/** US5 key 3 */
test("on the phone, Notes opens a sheet over the same note", async () => {
  atWidth(402);
  await open(PAGE, round());

  await click(screen.getByRole("button", { name: "Notes" }));
  const sheet = await screen.findByRole("dialog", { name: "Notes" });
  await type(within(sheet).getByRole("textbox", { name: "Anything else" }), "From the phone.");
  await click(within(sheet).getByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notes" })).toBeNull());
  expect(within(end()).getByText("From the phone.")).toBeTruthy();
  expect(within(end()).getByText("Unsaved changes")).toBeTruthy();
});

/** US3 key 3 */
test("on the phone, asking opens the session's page with the quote", async () => {
  atWidth(402);
  await open(PAGE, round());

  await askAbout("Q2");

  expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() => expect(box.textContent).toBe(`${Q2_QUOTE}\n\n`));
});

/** Review focus 4, and the high edge case on typed text */
test("typed notes, comments, and the composer stay through tabs and widths", async () => {
  await open(PAGE, round());
  await type(comment(), "Only if it is cheap.");
  await click(screen.getByRole("tab", { name: "Notes" }));
  await type(notesField(), "Check the spec page too.");
  await askAbout("Q2");
  const box = await composer();
  await type(box, `${Q2_QUOTE}\n\nwhy would that cost more?`);

  // To the phone and back: the column goes, and comes back.
  await act(async () => atWidth(402));
  expect(screen.queryByRole("tablist", { name: "The round's column" })).toBeNull();
  expect(comment().value).toBe("Only if it is cheap.");
  expect(within(end()).getByText("Check the spec page too.")).toBeTruthy();
  await act(async () => atWidth(1440));

  expect(comment().value).toBe("Only if it is cheap.");
  expect((await composer()).textContent).toBe(`${Q2_QUOTE}\n\nwhy would that cost more?`);
  await click(screen.getByRole("tab", { name: "Notes" }));
  expect(notesField().value).toBe("Check the spec page too.");
  expect(within(end()).getByText("Unsaved changes")).toBeTruthy();
  await click(screen.getByRole("tab", { name: "Outline" }));
  expect(within(end()).getByText("Check the spec page too.")).toBeTruthy();
});

/** Review focus 5: the composer is the session's page's while the agent works. */
test("asking while the agent works sends nothing", async () => {
  const fake = await fakeAgent();
  const repo = round();
  const session = await fake.sessions.featureSession(repo, FOLDER);
  fake.sessions.cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "discovery",
    trigger: "manual",
  });
  await open(`${PAGE}?tab=session`, repo, fake);
  const panel = screen.getByRole("tabpanel", { name: "Session" });
  await waitFor(() => expect(within(panel).getByRole("button", { name: "Stop" })).toBeTruthy());

  await askAbout("Q2");

  const box = await composer();
  await waitFor(() => expect(box.textContent).toBe(`${Q2_QUOTE}\n\n`));
  expect(fake.adapter.sent).toHaveLength(0);
});

/** The edge case "a round whose agent is unavailable" */
test("without an agent, no Session tab and no Ask", async () => {
  await open(PAGE, round(), false);

  expect(tabs()).toEqual(["Outline", "Notes"]);
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Ask about/ })).toBeNull();
});

/** The edge case "an answered round" */
test("an answered round has no column", async () => {
  await open(
    PAGE,
    round(
      Object.fromEntries(ALL.map((id) => [id, "A"])),
      MERGE_CHATS.replace("status: awaiting-human", "status: answered"),
    ),
  );

  expect(screen.queryByRole("complementary", { name: "The round's column" })).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
});

/** The edge case "the window crosses 768 px with the Session tab open" */
test("on the phone, the round shows and the address keeps the tab", async () => {
  atWidth(402);
  await open(`${PAGE}?tab=session`, round());

  expect(screen.getByRole("region", { name: "Check these" })).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Message Claude Code" })).toBeNull();
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("session");
});
