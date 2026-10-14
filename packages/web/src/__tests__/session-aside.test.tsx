// US1.2–US1.7 and US5.1: the session's column of progress and changes, beside the transcript on a
// wide screen, and its edge cases.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { addPlan, commitOnBranch, ELEVEN, temporaryFolder } from "uraeda-binding/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  answered,
  atWidth,
  type Binding,
  click,
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

const binding: Binding = await import("uraeda-binding");

beforeEach(() => atWidth(1440));
afterEach(() => vi.restoreAllMocks());

/** The column, by its landmark. */
function aside() {
  return within(screen.getByRole("complementary", { name: "Progress" }));
}

/** Waits for the column, and returns it. */
async function findAside() {
  await screen.findByRole("complementary", { name: "Progress" });
  return aside();
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

/** The spec's branch: `git.rs` +38 −0, `App.tsx` +4 −19, and a file of the feature's folder. */
function specsBranch() {
  const repo = fixtureRepo();
  onMainAndMerged(repo, CLI, "packages/web/src/App.tsx", lines(19, "old"));
  commitOnBranch(repo, CLI, {
    [`specs/${CLI}/notes.md`]: "Notes.\n",
    "crates/core/src/git.rs": lines(38),
    "packages/web/src/App.tsx": lines(4, "new"),
  });
  return repo;
}

/** The list item of a changed file, by its path. */
function changed(path: string) {
  return aside().getByText(path).closest("li")!;
}

test("US1.2: the column shows the step, Task 7 of 11, and the tasks", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  expect(column.getByRole("heading", { name: "Implementation" })).toBeTruthy();
  expect(await column.findByText("Task 7 of 11")).toBeTruthy();
  const bar = column.getByRole("progressbar", { name: "Task 7 of 11" });
  expect(bar.getAttribute("aria-valuenow")).toBe("7");
  expect(bar.getAttribute("aria-valuemax")).toBe("11");
  const tasks = within(column.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
  expect(tasks).toHaveLength(11);
  expect(
    tasks.filter((task) => task.getAttribute("aria-label")?.startsWith("Done: ")),
  ).toHaveLength(6);
  expect(tasks[0].getAttribute("aria-label")).toBe("Done: Plan progress in the core");
  expect(tasks[6].getAttribute("aria-label")).toBe("Current: Session column");
  expect(tasks[7].getAttribute("aria-label")).toBe("Jump to the latest");
});

test("US1.3: a checked box moves it", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await findAside();

  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title], index) => [title, index < 7 ? 5 : 0, 5]),
  );

  await refreshUntil(() => expect(aside().getByText("Task 8 of 11")).toBeTruthy());
  expect(aside().getByRole("listitem", { name: "Current: Jump to the latest" })).toBeTruthy();
});

test("US1.4: the changed files, without the feature's folder", async () => {
  await renderPage(`/f/${CLI}/session`, specsBranch(), { agent: await fakeAgent() });

  const column = await findAside();
  expect(column.getByRole("heading", { name: "Changed on the branch" })).toBeTruthy();
  expect(await column.findByText("2 files · +42 −19")).toBeTruthy();
  const files = within(column.getByRole("list", { name: "Changed files" })).getAllByRole(
    "listitem",
  );
  expect(files.map((file) => file.textContent)).toEqual([
    "crates/core/src/git.rs+38 −0",
    "packages/web/src/App.tsx+4 −19",
  ]);
  expect(column.queryByText(/notes\.md/)).toBeNull();
});

test("US1.5: a new commit adds a file", async () => {
  const repo = specsBranch();
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await (await findAside()).findByText("2 files · +42 −19");

  commitOnBranch(repo, CLI, { "crates/core/src/watch.rs": lines(6) });

  await refreshUntil(() => expect(aside().getByText("3 files · +48 −19")).toBeTruthy());
  expect(changed("crates/core/src/watch.rs").textContent).toContain("+6 −0");
});

test("US1.6: a running sub-agent is listed", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Implement it." });
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({
    id: "task-1",
    input: {},
    kind: "other",
    name: "Task",
    subagent: { description: "Explore the tests" },
    type: "toolStart",
  });
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const column = await findAside();
  expect(await column.findByRole("heading", { name: "Sub-agents" })).toBeTruthy();
  expect(column.getByText("Explore the tests")).toBeTruthy();
});

test("US1.7: Hide progress folds it, for every session and after a reload", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await findAside();

  await click(screen.getByRole("button", { name: "Hide progress" }));

  expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show progress" })).toBeTruthy();
  expect(window.localStorage.getItem("uraeda.sessionAside")).toBe("hidden");
  // Another feature's session, in a new page.
  cleanup();
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: await fakeAgent() });
  await screen.findByRole("log", { name: "Conversation" });
  expect(await screen.findByRole("button", { name: "Show progress" })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();

  await click(screen.getByRole("button", { name: "Show progress" }));
  expect(await findAside()).toBeTruthy();
  expect(screen.getByRole("button", { name: "Hide progress" })).toBeTruthy();
  expect(window.localStorage.getItem("uraeda.sessionAside")).toBe("shown");
});

test("no plan yet: the step, then No plan yet.", async () => {
  // An approved spec, and no plan: the plan's step.
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  const column = await findAside();
  expect(await column.findByText("No plan yet.")).toBeTruthy();
  expect(column.getByRole("heading", { name: "Plan" })).toBeTruthy();
  expect(column.queryByRole("progressbar")).toBeNull();
});

test("a plan in review: its tasks, without a current one or a bar", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN, "awaiting-human");
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  expect(column.getByRole("heading", { name: "Review the plan" })).toBeTruthy();
  const tasks = await within(await column.findByRole("list", { name: "Tasks" })).findAllByRole(
    "listitem",
  );
  expect(tasks).toHaveLength(11);
  expect(tasks.some((task) => task.getAttribute("aria-label")?.startsWith("Current: "))).toBe(
    false,
  );
  expect(column.queryByRole("progressbar")).toBeNull();
  expect(column.queryByText(/^Task \d+ of /)).toBeNull();
});

test("every box checked: the step after the plan, and 11 of 11 tasks done", async () => {
  const repo = fixtureRepo();
  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  // The final review's step without GitHub, whose pull request the tests cannot know.
  expect(column.getByRole("heading", { name: "Pull request" })).toBeTruthy();
  expect(await column.findByText("11 of 11 tasks done")).toBeTruthy();
  const bar = column.getByRole("progressbar", { name: "11 of 11 tasks done" });
  expect(bar.getAttribute("aria-valuenow")).toBe("11");
});

test("nothing changed outside the feature's folder", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  const column = await findAside();
  expect(await column.findByText("Nothing outside the feature's folder yet.")).toBeTruthy();
});

test("more than 50 changed files: the first 50, then how many more", async () => {
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

  const column = await findAside();
  expect(await column.findByText("60 files · +60 −0")).toBeTruthy();
  expect(column.getAllByText(/^src\/f\d+\.rs$/)).toHaveLength(50);
  expect(column.getByText("src/f49.rs")).toBeTruthy();
  expect(column.getByText("and 10 more files")).toBeTruthy();
});

test("a binary file: listed without counts", async () => {
  const repo = fixtureRepo();
  commitOnBranch(repo, CLI, { "docs/screen.png": "\u0089PNG\r\n\u001a\n\u0000\u0000\u0000" });
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  await column.findByText("docs/screen.png");
  expect(changed("docs/screen.png").textContent).toBe("docs/screen.pngbinary");
});

test("a feature without a branch: no changes section", async () => {
  const repo = fixtureRepo();
  // A proposal not committed yet: the feature has no branch.
  const folder = "2026-10-20-draft";
  mkdirSync(join(repo, "specs", folder));
  writeFileSync(join(repo, "specs", folder, "proposal.md"), "# Draft\n\n## What\n\nA draft.\n");
  await renderPage(`/f/${folder}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  expect(column.getByRole("heading", { name: "Write the proposal" })).toBeTruthy();
  await answered("BranchChanges");
  expect(column.queryByRole("heading", { name: "Changed on the branch" })).toBeNull();
});

test("git failing: the changes could not be read, and the tasks still show", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  await renderPage(`/f/${CLI}/session`, repo, {
    agent: await fakeAgent(),
    binding: { ...binding, branchChanges: () => Promise.reject(new Error("git: not found")) },
  });

  const column = await findAside();
  expect(await column.findByText("The changes could not be read.")).toBeTruthy();
  expect(await column.findByText("Task 7 of 11")).toBeTruthy();
});

test("no session: the column shows, and the transcript is empty", async () => {
  await renderPage(`/f/${CLI}/session`, fixtureRepo(), { agent: await fakeAgent() });

  const column = await findAside();
  expect(column.getByRole("link", { name: "Feature page" })).toBeTruthy();
  expect(screen.getByRole("log", { name: "Conversation" }).textContent).toBe("");
});

test("the feature's links: its page, then its workflow files but its reviews", async () => {
  const repo = fixtureRepo();
  commitOnBranch(repo, CLI, {
    [`specs/${CLI}/spec-review.md`]:
      "---\nverdict: approved\ncommit: 1234567\n---\n\n# Review: Spec, CLI TUIs\n",
  });
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });

  const column = await findAside();
  const links = within(column.getByRole("list", { name: "Feature" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
  expect(links[0]).toBe("Feature page");
  expect(links).toContain("spec.md");
  expect(links).not.toContain("spec-review.md");
});

test("localStorage refused: the column shows, and Hide progress still folds it", async () => {
  const repo = fixtureRepo();
  const real = window.localStorage;
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
  await findAside();

  await click(screen.getByRole("button", { name: "Hide progress" }));

  expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();
  expect(screen.getByRole("button", { name: "Show progress" })).toBeTruthy();
  expect(real.getItem("uraeda.sessionAside")).toBeNull();
  // Another page of the same document, which draws its page anew: still hidden.
  cleanup();
  await renderPage(`/f/${WEB_UI}/session`, repo, { agent: await fakeAgent() });
  expect(await screen.findByRole("button", { name: "Show progress" })).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();
  // Shown again, which storage takes once more.
  vi.restoreAllMocks();
  await click(screen.getByRole("button", { name: "Show progress" }));
  expect(await findAside()).toBeTruthy();
});

test("a column's read that fails leaves the session and the rest of the column", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const server = serverFetch(repo, fake.sessions);
  let refused = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("plan.md")) {
      refused = true;
      throw new Error("The server went away.");
    }
    return server(input, init);
  };
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake, fetch });
  await waitFor(() => expect(refused).toBe(true));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

  expect(screen.getByRole("log", { name: "Conversation" })).toBeTruthy();
  expect(aside().getByRole("link", { name: "Feature page" })).toBeTruthy();
});

test("US5.1: a chat has no column", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text: "List the open draft files" });
  await fake.sessions.settled(turn);

  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });

  await screen.findByRole("heading", { level: 1, name: "List the open draft files" });
  await waitFor(() => expect(screen.queryByRole("button", { name: "Archive" })).toBeTruthy());
  expect(screen.queryByRole("complementary", { name: "Progress" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hide progress" })).toBeNull();
});

test("folding the column keeps the focus on its button", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  await renderPage(`/f/${CLI}/session`, repo, { agent: await fakeAgent() });
  await findAside();
  const hide = screen.getByRole("button", { name: "Hide progress" });
  hide.focus();

  await click(hide);

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show progress" }));
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

  await click(screen.getByRole("button", { name: "Hide progress" }));

  expect(screen.getByText("The agent did not take the interrupt.")).toBeTruthy();
});
