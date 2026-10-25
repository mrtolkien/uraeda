// US1 more 1, US2, and their edge cases: the session's column, for every session, the files this
// session edited and the branch's under its Activity, and the plan's progress at its foot. Its
// width, its split, and the phone's sheet are measured in `__browser__/session-column.test.tsx`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import {
  addChange,
  addPlan,
  commitOnBranch,
  ELEVEN,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import type { Item } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { redirect } from "../routes.tsx";
import {
  addRun,
  answered,
  atRepo,
  atWidth,
  type Binding,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  serverFetch,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";
const WEB_UI = "2026-10-11-web-ui";

/** The column's name, its landmark's. */
const NAME = "The session's column";

const binding: Binding = await import("uraeda-binding");

beforeEach(() => atWidth(1440));
afterEach(() => vi.restoreAllMocks());

/** The column, by its landmark. */
function column() {
  return within(screen.getByRole("complementary", { name: NAME }));
}

/** Waits for the column, and returns it. */
async function findColumn() {
  await screen.findByRole("complementary", { name: NAME });
  return column();
}

/** The Changes part of the column, by its heading. */
function changes() {
  return within(column().getByRole("region", { name: "Changes" }));
}

/** The list item of a file in Changes, by its path. */
function row(path: string) {
  return within(rowOf(path));
}

/** The list item of a file in Changes, by its path, as an element. */
function rowOf(path: string) {
  return changes().getByText(path).closest("li")!;
}

/** `count` lines of text. */
function lines(count: number, word = "line") {
  return Array.from({ length: count }, (_, index) => `${word} ${index + 1}\n`).join("");
}

/**
 * Commits a file on `main`, and merges `main` into a feature's branch in a temporary worktree, so
 * the file is in the branch's merge base: a later change on the branch removes its lines.
 */
function onMainAndMerged(repo: string, branch: string, path: string, text: string) {
  mkdirSync(join(repo, path, ".."), { recursive: true });
  writeFileSync(join(repo, path), text);
  git(repo, "add", "--", path);
  git(repo, "commit", "--quiet", "--no-verify", "--message", `add ${path}`, "--", path);
  const worktree = join(temporaryFolder("uraeda-merge"), "worktree");
  git(repo, "worktree", "add", "--quiet", worktree, branch);
  try {
    git(worktree, "merge", "--quiet", "--no-edit", "main");
  } finally {
    git(repo, "worktree", "remove", "--force", worktree);
  }
}

/** A completed edit call of `path`, or one that `failed`. */
function edit(id: string, path: string, status: "completed" | "failed" = "completed"): Item {
  return { id, kind: "tool", name: "Edit", status, target: path, toolKind: "edit" };
}

/**
 * The feature's session, which edited `complete.ts` twice and `complete.test.ts` once, and failed
 * an edit of `undo.ts`: its id.
 */
async function editedSession(fake: Fake, repo: string) {
  const session = await fake.sessions.featureSession(repo, CLI);
  addRun(fake, session.id, [
    edit("e1", "src/tasks/complete.ts"),
    edit("e2", "src/tasks/complete.test.ts"),
    edit("e3", "src/tasks/undo.ts", "failed"),
    edit("e4", "src/tasks/complete.ts"),
    { kind: "text", streaming: false, text: "Edited." },
  ]);
  return session.id;
}

test("US2.1: this session's files, with their edits, and no diff", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await editedSession(fake, repo);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  await findColumn();
  expect(await changes().findByText("This session · 2 files")).toBeTruthy();
  expect(row("src/tasks/complete.ts").getByText("2 edits")).toBeTruthy();
  expect(row("src/tasks/complete.test.ts").getByText("1 edit")).toBeTruthy();
  // No diff: a row is its path and its count of edits, nothing more.
  expect(rowOf("src/tasks/complete.ts").textContent).toBe("src/tasks/complete.ts2 edits");
  // The failed edit is not this session's change.
  expect(changes().queryByText("src/tasks/undo.ts")).toBeNull();
});

/**
 * The feature's branch: 13 files of 24 lines added, and a file of 41 lines from `main` deleted, 14
 * files, +312 -41.
 */
function fourteenFiles() {
  const repo = fixtureRepo();
  onMainAndMerged(repo, CLI, "src/old.ts", lines(41, "old"));
  commitOnBranch(repo, CLI, {
    "src/old.ts": null,
    ...Object.fromEntries(
      Array.from({ length: 13 }, (_, index) => [
        `src/f${String(index).padStart(2, "0")}.ts`,
        lines(24),
      ]),
    ),
  });
  return repo;
}

test("US2.2: the branch's files, the first two, then how many more", async () => {
  await renderPage(`/f/${CLI}/session`, fourteenFiles(), { agent: await fakeAgent() });

  await findColumn();
  expect(await changes().findByText("On the branch · 14 files · +312 -41")).toBeTruthy();
  expect(rowOf("src/f00.ts").textContent).toBe("src/f00.ts+24 -0");
  expect(changes().getByText("src/f01.ts")).toBeTruthy();
  expect(changes().queryByText("src/f02.ts")).toBeNull();

  await click(changes().getByRole("button", { name: "12 more files" }));

  expect(changes().getAllByText(/^src\/.+\.ts$/)).toHaveLength(14);
  expect(rowOf("src/old.ts").textContent).toBe("src/old.ts+0 -41");
  expect(changes().queryByText(/^and \d+ more/)).toBeNull();
});

test("US2.3: the progress bar reads the task, and opens the plan at it", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  const bar = await column().findByRole("link", { name: /^Implementation · task 7 of 11/ });
  expect(bar.textContent).toContain("Session column");
  await waitFor(() =>
    expect(bar.getAttribute("href")).toBe(atRepo(`/f/${CLI}/plan.md#task-7-session-column`)),
  );
  const drawn = within(bar).getByRole("progressbar", { hidden: true });
  expect(drawn.getAttribute("aria-valuenow")).toBe("7");
  expect(drawn.getAttribute("aria-valuemax")).toBe("11");
});

test("a checked box moves the progress to the next task", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await (await findColumn()).findByRole("link", { name: /task 7 of 11/ });

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title], index) => [title, index < 7 ? 5 : 0, 5]),
  );

  await refreshUntil(() =>
    expect(column().getByRole("link", { name: /^Implementation · task 8 of 11/ })).toBeTruthy(),
  );
});

test("edge: before its plan, no progress bar", async () => {
  // An approved spec, and no plan: the plan's step.
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  await findColumn();
  await answered("Feature");
  expect(column().queryByRole("link", { name: /task \d+ of/ })).toBeNull();
  expect(column().queryByRole("progressbar", { hidden: true })).toBeNull();
});

test("edge: a plan in review has no progress bar", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN, "awaiting-human");
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  await answered("Feature");
  expect(column().queryByRole("link", { name: /task \d+ of/ })).toBeNull();
});

test("edge: a session that changed nothing reads No file changed yet.", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  await findColumn();
  expect(await changes().findByText("No file changed yet.")).toBeTruthy();
  expect(changes().queryByText(/^This session/)).toBeNull();
});

test("US1 more 1: a chat in the main checkout has the column, without the branch or progress", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text: "List the open draft files" });
  await fake.sessions.settled(turn);
  addRun(fake, chat.id, [edit("e1", "notes/drafts.md")]);

  await renderPage(`/sessions/${chat.id}`, repo, { agent: fake });

  await screen.findByRole("heading", { level: 1, name: "List the open draft files" });
  await findColumn();
  expect(column().getByRole("tab", { name: "Activity" })).toBeTruthy();
  expect(await changes().findByText("This session · 1 file")).toBeTruthy();
  expect(row("notes/drafts.md").getByText("1 edit")).toBeTruthy();
  expect(changes().queryByText(/^On the branch/)).toBeNull();
  expect(column().queryByRole("link", { name: /task \d+ of/ })).toBeNull();
});

test("a change's session has the column, its branch's files, and no progress (R8)", async () => {
  const repo = fixtureRepo();
  const change = "2026-10-16-header-logo";
  addChange(repo, change, { "proposal.md": "# A home logo\n" });
  commitOnBranch(repo, `change/${change}`, { "src/Header.tsx": lines(3) });
  await renderPage(`/f/${change}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  expect(await changes().findByText("On the branch · 1 file · +3 -0")).toBeTruthy();
  await answered("Feature");
  expect(column().queryByRole("link", { name: /task \d+ of/ })).toBeNull();
});

test("edge: the stretch's address unfolds the folded column, at Activity", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const id = await editedSession(fake, repo);
  const turn = fake.sessions.cache.turns(id)[0]!.id;
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  await findColumn();
  await click(screen.getByRole("button", { name: "Hide the session's column" }));
  expect(screen.getByRole("button", { name: "Show the session's column" })).toBeTruthy();

  await act(async () => redirect(atRepo(`/f/${CLI}/session?tab=activity&stretch=${turn}%3A0`)));

  expect(await screen.findByRole("button", { name: "Hide the session's column" })).toBeTruthy();
  const tab = column().getByRole("tab", { name: "Activity" });
  expect(tab.getAttribute("aria-selected")).toBe("true");
});

// Kept from the column before it: what the branch's changes show, and the column's fold.

test("a new commit adds a file", async () => {
  const repo = fourteenFiles();
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await (await findColumn()).findByText("On the branch · 14 files · +312 -41");

  commitOnBranch(repo, CLI, { "crates/core/src/watch.rs": lines(6) });

  await refreshUntil(() =>
    expect(changes().getByText("On the branch · 15 files · +318 -41")).toBeTruthy(),
  );
  // Sorted first by its path: among the two shown.
  expect(rowOf("crates/core/src/watch.rs").textContent).toBe("crates/core/src/watch.rs+6 -0");
});

test("more than 50 changed files: the first 50 once unfolded, then how many more", async () => {
  const repo = fixtureRepo();
  commitOnBranch(
    repo,
    CLI,
    Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `src/f${String(index).padStart(2, "0")}.rs`,
        "fn f() {}\n",
      ]),
    ),
  );
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  expect(await changes().findByText("On the branch · 60 files · +60 -0")).toBeTruthy();
  await click(changes().getByRole("button", { name: "58 more files" }));

  expect(changes().getAllByText(/^src\/f\d+\.rs$/)).toHaveLength(50);
  expect(changes().getByText("src/f49.rs")).toBeTruthy();
  expect(changes().getByText("and 10 more files")).toBeTruthy();
});

test("a binary file: listed without counts", async () => {
  const repo = fixtureRepo();
  commitOnBranch(repo, CLI, { "docs/screen.png": "\u0089PNG\r\n\u001a\n\u0000\u0000\u0000" });
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  await changes().findByText("docs/screen.png");
  expect(rowOf("docs/screen.png").textContent).toBe("docs/screen.pngbinary");
});

test("nothing outside the feature's folder: no branch part", async () => {
  const repo = fixtureRepo();
  commitOnBranch(repo, CLI, { [`specs/${CLI}/notes.md`]: "Notes.\n" });
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  await findColumn();
  await answered("BranchChanges");
  expect(changes().queryByText(/^On the branch/)).toBeNull();
  expect(changes().queryByText(/notes\.md/)).toBeNull();
});

test("git failing: the changes could not be read, and the progress still shows", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  await renderPage(`/f/${CLI}/session`, repo, {
    agent: await fakeAgent(),
    binding: { ...binding, branchChanges: () => Promise.reject(new Error("git: not found")) },
  });

  await findColumn();
  expect(await changes().findByText("The changes could not be read.")).toBeTruthy();
  expect(await column().findByRole("link", { name: /task 7 of 11/ })).toBeTruthy();
});

test("a column's read that fails leaves the session and the rest of the column", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const fake = await fakeAgent();
  const server = serverFetch(repo, fake.sessions);
  let refused: Promise<Response> | undefined;
  const fetch: typeof globalThis.fetch = (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("plan.md")) {
      refused = Promise.reject(new Error("The server went away."));
      return refused;
    }
    return server(input, init);
  };
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake, fetch });
  await waitFor(() => expect(refused).toBeDefined());
  // The refusal reaches the page, which React draws again.
  await act(async () => {
    await refused!.catch(() => undefined);
  });

  expect(await screen.findByRole("log", { name: "Conversation" })).toBeTruthy();
  await findColumn();
  expect(await changes().findByText("No file changed yet.")).toBeTruthy();
  expect(column().queryByRole("link", { name: /task 7 of 11/ })).toBeNull();
});

test("a merged feature, without a branch: no branch part", async () => {
  // Committed on the default branch: merged, with no branch left.
  await renderPage("/f/2026-10-10-cli-core/session", fixtureRepo(), { agent: await fakeAgent() });

  await findColumn();
  await answered("BranchChanges");
  expect(changes().queryByText(/^On the branch/)).toBeNull();
  expect(changes().getByText("No file changed yet.")).toBeTruthy();
});

test("its fold is kept for every session, after a reload", async () => {
  const repo = fixtureRepo();
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await findColumn();

  await click(screen.getByRole("button", { name: "Hide the session's column" }));

  expect(screen.queryByRole("separator", { name: "Resize the session's column" })).toBeNull();
  // Another feature's session, in a new page.
  cleanup();
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: await fakeAgent() });
  await screen.findByRole("log", { name: "Conversation" });
  expect(await screen.findByRole("button", { name: "Show the session's column" })).toBeTruthy();

  await click(screen.getByRole("button", { name: "Show the session's column" }));
  expect(await findColumn()).toBeTruthy();
  expect(screen.getByRole("separator", { name: "Resize the session's column" })).toBeTruthy();
});

test("localStorage refused: the column shows, and Hide still folds it", async () => {
  const repo = fixtureRepo();
  // A private window's storage: it reads nothing, and refuses every write.
  const refusing = {
    clear() {},
    getItem: () => null,
    key: () => null,
    length: 0,
    removeItem() {},
    setItem() {
      throw new Error("QuotaExceededError");
    },
  } satisfies Storage;
  vi.spyOn(window, "localStorage", "get").mockReturnValue(refusing);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await findColumn();

  await click(screen.getByRole("button", { name: "Hide the session's column" }));

  expect(screen.queryByRole("separator", { name: "Resize the session's column" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show the session's column" })).toBeTruthy();
  await click(screen.getByRole("button", { name: "Show the session's column" }));
  expect(await findColumn()).toBeTruthy();
});

test("folding the column keeps the focus on its button", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });
  await findColumn();
  const hide = screen.getByRole("button", { name: "Hide the session's column" });
  hide.focus();

  await click(hide);

  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Show the session's column" }),
  );
});

test("an error under the composer stays on screen when the column folds", async () => {
  const fake = await fakeAgent();
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: fake });
  await type(await screen.findByRole("textbox", { name: "Message Claude Code" }), "Plan it.");
  await click(await screen.findByRole("button", { name: "Send" }));
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  await refreshUntil(() => expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy());
  vi.spyOn(fake.sessions, "stop").mockImplementation(() => {
    throw new Error("refused: The agent did not take the interrupt.");
  });
  await click(screen.getByRole("button", { name: "Stop" }));
  await screen.findByText("The agent did not take the interrupt.");

  await click(screen.getByRole("button", { name: "Hide the session's column" }));

  expect(screen.getByText("The agent did not take the interrupt.")).toBeTruthy();
});

test("no session yet: the column shows, and the transcript is empty", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  await findColumn();
  expect(column().getByText("No call yet.")).toBeTruthy();
  expect(screen.getByRole("log", { name: "Conversation" }).textContent).toBe("");
});
