// The redesigned sidebar's stories: the hierarchy's sections and their counts, each item as a card
// with its step, its status, its task, its background command, and the lines its branch changed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import {
  addChange,
  addPlan,
  commitOnBranch,
  ELEVEN,
  fixture,
  git,
} from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The side navigation, as drawn on a wide screen. */
function nav() {
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

/** Waits for the side navigation, and returns it. */
async function findNav() {
  return within(await screen.findByRole("navigation", { name: "Side navigation" }));
}

/** A card's link, by its name's start. */
function card(name: string) {
  return nav().getByRole("link", { name: new RegExp(`^${name}, `) });
}

/** US2.1, C1 */
test("the sidebar reads in the flow's order, the inbox's and Now's counts, and no drafts", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await (await findNav()).findByRole("group", { name: "Sessions" });

  const links = nav()
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label") ?? link.textContent ?? "");
  const at = (start: string) => links.findIndex((name) => name.startsWith(start));
  expect(at("Home")).toBe(0);
  expect(at("Home")).toBeLessThan(at("web-ui, "));
  expect(at("web-ui, ")).toBeLessThan(at("Inbox"));
  expect(at("Inbox")).toBeLessThan(at("Priorities"));
  expect(at("Priorities")).toBeLessThan(at("＋New"));
  expect(at("＋New")).toBeLessThan(at("cli-tuis, "));
  // The inbox's count, drawn once its own read ends: read again until it is.
  await waitFor(() =>
    expect(nav().getByRole("link", { name: /^Inbox/ }).textContent).toContain("10"),
  );
  // The count of the entries under Now (C1), seen beside the row's label: the fixture's four are
  // started, and started entries are left out, as on the priorities page.
  expect(links[at("Priorities")]).toBe("Priorities0");
  expect(nav().queryByText(/Drafts?/)).toBeNull();
});

/** US2.2 */
test("a feature waiting on its answers is a card under Needs you only, by its step", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^web-ui, / });

  expect(link.getAttribute("aria-label")).toBe(
    "web-ui, Web UI for the workflow files, feature, Questions to answer, Needs you",
  );
  expect(nav().getAllByRole("link", { name: /^web-ui, / })).toHaveLength(1);
});

/** US2.4 */
test("a card counts the lines its branch changed outside its folder", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  commitOnBranch(repo, CLI, { "src/cli.ts": "one\ntwo\nthree\n" });
  await renderPage("/", repo, { agent: await fakeAgent() });

  await refreshUntil(() =>
    expect(card("cli-tuis").getAttribute("aria-label")).toContain("3 lines added, 0 removed"),
  );
  expect(nav().getByText("+3")).toBeTruthy();
  expect(nav().getByText("−0")).toBeTruthy();
});

/** US2.5, merge chats US1: the wrench, not a badge, shows it is a change. */
test("a change under Needs you says it is a change", async () => {
  const repo = fixtureRepo();
  const round = readFileSync(
    join(
      fixture("repo"),
      "branches",
      "2026-10-11-web-ui/specs/2026-10-11-web-ui/clarifications-01.md",
    ),
    "utf8",
  );
  addChange(repo, "2026-10-15-flaky-tests", {
    "clarifications-01.md": round,
    "proposal.md": "# Flaky tests\n\nThe session tests fail one run in ten.\n",
  });
  await renderPage("/", repo, { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^flaky-tests, / });
  expect(link.getAttribute("aria-label")).toContain(", change, ");
  expect(group.queryByText("Change")).toBeNull();
});

/** US1.9 */
test("a card shows its run's background command", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Review it" });
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({ tasks: [{ kind: "command", tool: "bash-1" }], type: "background" });
  await renderPage("/", repo, { agent: fake });

  await refreshUntil(() =>
    expect(card("cli-tuis").getAttribute("aria-label")).toContain(
      "Working, background command running",
    ),
  );
});

/** C4: the "…" is always there, so a card keeps its size under the pointer. */
test("every card has its settings button, without a pointer", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await (await findNav()).findByRole("group", { name: "Sessions" });

  for (const slug of ["recurring-tasks", "web-ui", "plan-review", "cli-tuis"]) {
    expect(nav().getByRole("button", { name: `Settings of ${slug}` })).toBeTruthy();
  }
});

/** A file of the cli-tuis branch's fixture, edited and committed on its branch. */
function editOnCli(file: string, edit: (text: string) => string) {
  const repo = fixtureRepo();
  const path = `specs/${CLI}/${file}`;
  const text = readFileSync(fixture(`repo/branches/${CLI}/${path}`), "utf8");
  commitOnBranch(repo, CLI, { [path]: edit(text) });
  return repo;
}

/** US6: a feature whose step cannot be found is a card under Needs you, a problem to fix. */
test("a feature that cannot go on is a problem card under Needs you", async () => {
  const repo = editOnCli("spec.md", (text) => text.replace("status: approved", "status: aproved"));
  await renderPage("/", repo, { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^cli-tuis, / });
  expect(link.getAttribute("aria-label")).toContain(", Problem to fix, Needs you");
});

/** US6: a problem needs the human, even on a feature whose session is idle. */
test("a feature with a session and an invalid status is a problem card under Needs you", async () => {
  const repo = editOnCli("spec.md", (text) => text.replace("status: approved", "status: aproved"));
  const fake = await fakeAgent();
  await fake.sessions.featureSession(repo, CLI);
  await renderPage("/", repo, { agent: fake });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^cli-tuis, / });
  expect(link.getAttribute("aria-label")).toContain(", Problem to fix, Needs you");
});

/** US6: an answered round with a blank answer cannot go on, whatever its step. */
test("an answered round with a blank answer is a problem card", async () => {
  const repo = editOnCli("clarifications-01.md", (text) =>
    text.replace(/\*\*Answer:\*\* B and C:[^\n]*\n[^\n]*\n/, "**Answer:**\n"),
  );
  git(repo, "switch", "--quiet", CLI);
  await renderPage("/", repo, { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^cli-tuis, / });
  expect(link.getAttribute("aria-label")).toContain(", Problem to fix, Needs you");
});

/** US6 1: a note, here a plan's missing section, stays off the cards. */
test("a feature with a format note keeps its step on its card", async () => {
  const repo = fixtureRepo();
  addPlan(repo, "2026-10-13-plan-review", ELEVEN);
  git(repo, "switch", "--quiet", "2026-10-13-plan-review");
  await renderPage("/", repo, { agent: await fakeAgent() });

  await (await findNav()).findByRole("group", { name: "Sessions" });
  const link = card("plan-review");
  expect(link.getAttribute("aria-label")).toContain(", Implementation, ");
  expect(link.getAttribute("aria-label")).not.toContain("Problem");
});

/** A session started with its first message on `startedAt`, its reply written, its turn ended. */
async function seedSession(fake: Fake, repo: string, text: string, startedAt?: string) {
  const session = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  await fake.sessions.settled((await fake.sessions.send(repo, session.id, { text })).turn);
  if (startedAt) {
    fake.sessions.cache.db
      .prepare("UPDATE sessions SET created_at = ? WHERE id = ?")
      .run(startedAt, session.id);
  }
  return session.id;
}

/** The Sessions section, once drawn. */
async function sessions() {
  return within(await (await findNav()).findByRole("group", { name: "Sessions" }));
}

/** The names of a section's links, in their order. */
const names = (group: ReturnType<typeof within>) =>
  group
    .getAllByRole("link")
    .map((link: HTMLElement) => link.getAttribute("aria-label") ?? link.textContent ?? "");

/** Merge chats US1 1 */
test("sessions, changes, and features share one list, oldest first", async () => {
  const repo = fixtureRepo();
  addChange(repo, "2026-10-18-flaky-tests", {
    "proposal.md": "# Flaky tests\n\nThe session tests fail one run in ten.\n",
  });
  const fake = await fakeAgent();
  await seedSession(fake, repo, "Why is CI slow?", "2026-10-19T09:00:00.000Z");
  await renderPage("/", repo, { agent: fake });

  const group = await sessions();
  await waitFor(() => group.getByRole("link", { name: /^Why is CI slow\?, / }));
  const links = names(group);
  const at = (start: string) => links.findIndex((name: string) => name.startsWith(start));
  expect(at("＋New")).toBe(0);
  expect(group.getByRole("link", { name: "New" }).getAttribute("href")).toBe(atRepo("/new"));
  expect(at("cli-tuis, ")).toBeGreaterThan(0);
  expect(at("cli-tuis, ")).toBeLessThan(at("flaky-tests, "));
  expect(at("flaky-tests, ")).toBeLessThan(at("Why is CI slow?, "));
  expect(links[at("cli-tuis, ")]).toContain(", feature, ");
  expect(links[at("flaky-tests, ")]).toContain(", change, ");
  expect(links[at("Why is CI slow?, ")]).toContain(", session, ");
  for (const name of ["Changes", "Features", "Chats"]) {
    expect(nav().queryByRole("group", { name })).toBeNull();
  }
});

/** Merge chats US1 2: Done's order is `doneRows`' (done.test.ts); here, it leaves Sessions. */
test("a session read to its end leaves Sessions", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const read = await seedSession(fake, repo, "What does ura clean keep?");
  await seedSession(fake, repo, "Why is CI slow?");
  fake.sessions.seen(repo, read);
  await renderPage("/", repo, { agent: fake });

  const group = await sessions();
  await waitFor(() => group.getByRole("link", { name: /^Why is CI slow\?, / }));
  expect(group.queryByRole("link", { name: /What does ura clean keep/ })).toBeNull();
});

/** Merge chats US1 more 1 */
test("a reply brings a done session back under Sessions, at its place", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const read = await seedSession(
    fake,
    repo,
    "What does ura clean keep?",
    "2026-10-18T09:00:00.000Z",
  );
  await seedSession(fake, repo, "Why is CI slow?", "2026-10-19T09:00:00.000Z");
  fake.sessions.seen(repo, read);
  await renderPage("/", repo, { agent: fake });
  const group = await sessions();
  await waitFor(() => group.getByRole("link", { name: /^Why is CI slow\?, / }));
  expect(group.queryByRole("link", { name: /What does ura clean keep/ })).toBeNull();

  fake.adapter.script([{ text: "Its worktree, until merged.", type: "text" }]);
  await fake.sessions.settled(
    (await fake.sessions.send(repo, read, { text: "And the branch?" })).turn,
  );

  // Started first, it is back above the later session.
  await refreshUntil(() =>
    expect(group.getByRole("link", { name: /^What does ura clean keep\?, / })).toBeTruthy(),
  );
  const links = names(group);
  const at = (start: string) => links.findIndex((name: string) => name.startsWith(start));
  expect(at("What does ura clean keep?")).toBe(at("Why is CI slow?") - 1);
});

/** Merge chats US1 3 */
test("a session's … renames it", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedSession(fake, repo, "Why is CI slow?");
  await renderPage("/", repo, { agent: fake });
  const group = await sessions();

  await click(await group.findByRole("button", { name: "Actions of Why is CI slow?" }));
  await click(await screen.findByRole("menuitem", { name: "Rename" }));
  await type(await screen.findByRole("textbox", { name: "Title" }), "CI speed");
  await click(screen.getByRole("button", { name: "Save" }));

  await refreshUntil(() => expect(group.getByRole("link", { name: /^CI speed, / })).toBeTruthy());
  expect(group.queryByRole("link", { name: /Why is CI slow/ })).toBeNull();
});

/** Merge chats, edge case: a session read while its page is open. */
test("the open session stays in the list until its page is left", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await seedSession(fake, repo, "Why is CI slow?");
  await renderPage(`/sessions/${id}`, repo, { agent: fake });
  // Its page marks it read to its end: done.
  await waitFor(() => expect(fake.sessions.cache.session(id)!.seenAt).not.toBeNull());

  await refreshUntil(() =>
    expect(nav().getByRole("link", { name: /^Why is CI slow\?, / })).toBeTruthy(),
  );
  await click(nav().getByRole("link", { name: "Home" }));

  await refreshUntil(() =>
    expect(nav().queryByRole("link", { name: /^Why is CI slow\?, / })).toBeNull(),
  );
});

/** Merge chats SC-005: every card's status and "…" are in its row. */
test("each card has its status and its … in its row", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await seedSession(fake, repo, "Why is CI slow?");
  await renderPage("/", repo, { agent: fake });
  const group = await sessions();
  await waitFor(() => group.getByRole("link", { name: /^Why is CI slow\?, / }));

  const cards = [
    { more: "Settings of cli-tuis", name: /^cli-tuis, /, status: "Idle" },
    { more: "Actions of Why is CI slow?", name: /^Why is CI slow\?, /, status: "New reply" },
  ];
  for (const card of cards) {
    const link = group.getByRole("link", { name: card.name });
    expect(within(link).getByRole("img", { name: card.status })).toBeTruthy();
    // The card's row, its link and its "…", holds its own "…" and no other.
    const row = within(link.parentElement!);
    const more = row.getByRole("button", { name: card.more });
    expect(row.getAllByRole("button")).toEqual([more]);
  }
});
