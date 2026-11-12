// Run by `nsh test`, without a display: the addresses of the app's pages, which are the React UI's
// so its links still open, and the app's history, which keeps each visit's positions and asks
// before a page with unsaved text is left.
import { effect } from "nsh";
import { expect, test } from "nsh/test";
import {
  back,
  bindHistory,
  entry,
  entryAt,
  keep,
  memoryHistory,
  navigate,
  openOverlay,
  positions,
  redirect,
  route,
  setLeaveGuard,
} from "./history";
import { parseRoute, pathOf, type Route, routeIn } from "./routes";

/**
 * An address, the route it names, and the address the route writes when it is not the same: an
 * address from before a page moved, or one written another way.
 */
type Row = [address: string, route: Route, written?: string];

/** The rows of the React UI's route table's tests, and one for each of its other paths. */
const ROWS: Array<Row> = [
  ["/", { page: "home" }],
  ["/priorities", { page: "priorities" }],
  ["/priorities/git-listener", { key: "git-listener", page: "proposal" }],
  ["/inbox", { page: "inbox" }],
  ["/inbox/triage", { page: "triage" }],
  ["/inbox/a-note", { key: "a-note", page: "note" }],
  ["/f/2026-10-14-dark-mode", { folder: "2026-10-14-dark-mode", page: "feature" }],
  ["/f/x/session", { folder: "x", page: "session" }],
  ["/f/x/spec.md", { folder: "x", name: "spec.md", page: "file" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { folder: "2026-10-06-recurring-tasks", name: "repeat.html", page: "mockup" },
  ],
  // A session, and the New page with the kind its address names, or none.
  ["/sessions", { page: "sessions" }],
  ["/sessions/abc", { id: "abc", page: "session-id" }],
  ["/new", { page: "new" }],
  ["/new?kind=change", { kind: "change", page: "new" }],
  ["/new?kind=feature", { kind: "feature", page: "new" }],
  ["/new?kind=session", { kind: "session", page: "new" }],
  ["/new?kind=other", { kind: "session", page: "new" }, "/new?kind=session"],
  // A story's page, a feature's and the main checkout's; a file of that name stays a file, and
  // the address without a story is the feature's page, or Home.
  [
    "/f/x/storybook?story=ui-button--primary",
    { folder: "x", page: "storybook", story: "ui-button--primary" },
  ],
  ["/storybook?story=a", { folder: "main", page: "storybook", story: "a" }],
  ["/f/x/storybook", { folder: "x", page: "feature" }, "/f/x"],
  ["/storybook", { page: "home" }, "/"],
  ["/f/x/storybook.md", { folder: "x", name: "storybook.md", page: "file" }],
  // The decisions page, a decision open, and the constitution, one page, which an old principle's
  // address opens too.
  ["/decisions", { page: "decisions" }],
  ["/decisions/check", { page: "decisions-check" }],
  ["/decisions/ui-behaviour", { name: "ui-behaviour", page: "decision" }],
  ["/decisions/constitution", { page: "constitution" }],
  ["/decisions/constitution/iv", { page: "constitution" }, "/decisions/constitution"],
  ["/decisions/git/rules", { page: "missing", path: "/decisions/git/rules" }],
  // A decision as a feature's branch has it.
  [
    "/f/2026-10-17-spec-page/decisions/task-storage",
    { folder: "2026-10-17-spec-page", name: "task-storage", page: "branch-decision" },
  ],
  ["/git", { page: "git" }],
  ["/settings", { page: "settings" }],
  ["/settings/extensions", { category: "extensions", page: "settings" }],
  ["/edit/specs/INBOX.md", { page: "edit", path: "specs/INBOX.md" }],
  ["/buffer/src/a%20b.ts", { page: "buffer", path: "src/a b.ts" }],
  // The addresses from before a page moved open the page where it is now, with their query and
  // their hash: the new address's own query wins over a parameter of the same name.
  ["/commit", { page: "git" }, "/git"],
  ["/chats/new", { page: "new" }, "/new"],
  ["/chats/abc", { id: "abc", page: "session-id" }, "/sessions/abc"],
  [
    "/chats/abc?ask=why#turn-2",
    { hash: "turn-2", id: "abc", page: "session-id", query: { ask: "why" } },
    "/sessions/abc?ask=why#turn-2",
  ],
  ["/changes/new", { kind: "change", page: "new" }, "/new?kind=change"],
  ["/changes/new?kind=feature", { kind: "change", page: "new" }, "/new?kind=change"],
  // An old run's address is its feature's session, at the turn the run became.
  [
    "/f/2026-10-12-cli-tuis/runs/7",
    { folder: "2026-10-12-cli-tuis", hash: "turn-7", page: "session" },
    "/f/2026-10-12-cli-tuis/session#turn-7",
  ],
  // The repository is in the address, and an address without it is still a page's.
  ["/r/uraeda/", { page: "home", repo: "uraeda" }],
  ["/r/uraeda", { page: "home", repo: "uraeda" }, "/r/uraeda/"],
  [
    "/r/uraeda/f/2026-10-14-dark-mode",
    { folder: "2026-10-14-dark-mode", page: "feature", repo: "uraeda" },
  ],
  ["/r/my%20app/priorities", { page: "priorities", repo: "my app" }],
  ["/r/a%23b/", { page: "home", repo: "a#b" }],
  ["/r/uraeda/nowhere", { page: "missing", path: "/nowhere", repo: "uraeda" }],
  // A name is encoded, as every link to it is, and one a browser would refuse is still read.
  ["/f/2026-10-12-a%23b%3Fc/session", { folder: "2026-10-12-a#b?c", page: "session" }],
  ["/f/50%25", { folder: "50%", page: "feature" }],
  ["/f/50%", { folder: "50%", page: "feature" }, "/f/50%25"],
  // The Jobs place, a job's page, and a new job's: a name the address cannot carry has `~` before.
  ["/jobs", { page: "jobs" }],
  ["/jobs/new", { page: "job-new" }],
  ["/jobs/Dependencies", { name: "Dependencies", page: "job" }],
  ["/jobs/Performance%20pass", { name: "Performance pass", page: "job" }],
  ["/jobs/~new", { name: "new", page: "job" }],
  ["/jobs/~..", { name: "..", page: "job" }],
  ["/jobs/~~x", { name: "~x", page: "job" }],
  ["/jobs/a/b", { page: "missing", path: "/jobs/a/b" }],
  // An extension's place, with the path after its name.
  ["/e/wiki", { name: "wiki", page: "extension", rest: "" }],
  ["/e/wiki/wiki", { name: "wiki", page: "extension", rest: "wiki" }],
  ["/e/wiki/wiki/pages/a%20b", { name: "wiki", page: "extension", rest: "wiki/pages/a b" }],
  // What a page reads beside its path: its query, and the block its hash names.
  [
    "/r/uraeda/git?commit=abc&file=src%2Fa.ts",
    { page: "git", query: { commit: "abc", file: "src/a.ts" }, repo: "uraeda" },
  ],
  ["/f/x/session?new", { folder: "x", page: "session", query: { new: "" } }],
  [
    "/f/x/session?ask=a+b",
    { folder: "x", page: "session", query: { ask: "a b" } },
    "/f/x/session?ask=a%20b",
  ],
  [
    "/f/x/spec.md?tab=tasks#q-3",
    { folder: "x", hash: "q-3", name: "spec.md", page: "file", query: { tab: "tasks" } },
  ],
  ["/decisions/git#rule%202", { hash: "rule 2", name: "git", page: "decision" }],
  ["/nowhere/at/all", { page: "missing", path: "/nowhere/at/all" }],
];

test("every old path parses to its route and back", () => {
  for (const [address, expected, written = address] of ROWS) {
    // The address is in each value compared, so a failure names its row.
    expect([address, parseRoute(address)]).toEqual([address, expected]);
    expect([address, pathOf(expected)]).toEqual([address, written]);
    expect([address, parseRoute(written)]).toEqual([address, expected]);
  }
});

// Catches: a job named "new" opening the add form, and a job named ".." or "." going where a
// browser normalises it, so a hand-written name could not be opened.
test("a job of any name opens its own page", () => {
  const names = [
    "Dependencies",
    "Performance pass",
    "new",
    ".",
    "..",
    "a/b",
    "~tilde",
    "a#b?c",
    "50%",
    "é",
  ];
  for (const name of names) {
    const path = pathOf({ name, page: "job" });
    expect([name, path.split("/").filter((part) => part === "." || part === "..")]).toEqual([
      name,
      [],
    ]);
    expect([name, path]).not.toEqual([name, "/jobs/new"]);
    expect([name, parseRoute(path)]).toEqual([name, { name, page: "job" }]);
  }
});

/** Starts the app's history again, on `address`, with no guard. */
function startAt(address: string) {
  setLeaveGuard(undefined);
  bindHistory(memoryHistory(entryAt(address)));
}

/** The address of the page shown. */
function shown(): string {
  return pathOf(route());
}

/** Resolves once the promises already settled have run what waited for them. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("back returns to the entry before, with its scroll", () => {
  startAt("/r/uraeda/priorities");
  const seen: Array<string> = [];
  effect(() => {
    seen.push(pathOf(route()));
  });
  const list = entry().id;
  const priorities = positions();
  priorities.keep("page", 420);

  // A page opens in the repository of the one shown, in a visit of its own, at its top.
  navigate({ folder: "2026-10-14-dark-mode", page: "feature" });
  expect(route()).toEqual({ folder: "2026-10-14-dark-mode", page: "feature", repo: "uraeda" });
  expect(entry().id).not.toBe(list);
  expect(entry().from).toEqual({ page: "priorities", repo: "uraeda" });
  expect(positions().at("page")).toBe(undefined);
  // The page left, still drawn while the next one loads, comes to rest: not the new visit's.
  priorities.keep("page", 999);
  expect(positions().at("page")).toBe(undefined);
  positions().keep("page", 80);

  // A redirect shows another page in the same visit: Back does not return to the one it replaced.
  redirect({ folder: "2026-10-14-dark-mode-renamed", page: "feature" });
  expect(positions().at("page")).toBe(80);

  expect(back()).toBe(true);
  expect(route()).toEqual({ page: "priorities", repo: "uraeda" });
  expect(entry().id).toBe(list);
  expect(positions().at("page")).toBe(420);

  // The visit the app started on has none before it.
  expect(back()).toBe(false);
  expect(route()).toEqual({ page: "priorities", repo: "uraeda" });
  expect(seen).toEqual([
    "/r/uraeda/priorities",
    "/r/uraeda/f/2026-10-14-dark-mode",
    "/r/uraeda/f/2026-10-14-dark-mode-renamed",
    "/r/uraeda/priorities",
  ]);
});

test("a visit keeps what its page asks, and an overlay is a visit Back closes", () => {
  startAt("/r/uraeda/inbox");
  const inbox = entry().id;
  navigate({ page: "priorities" }, { select: "line-3" });
  expect(entry().kept).toEqual({ select: "line-3" });
  // A write answered after the human left names its row in the visit it was made on only.
  keep({ select: "note-9" }, inbox);
  expect(entry().kept).toEqual({ select: "line-3" });
  keep({ open: ["next"] });
  expect(entry().kept).toEqual({ open: ["next"], select: "line-3" });

  const page = entry().id;
  openOverlay("Add a proposal");
  expect(entry().id).toBe(page);
  expect(entry().kept.overlay).toBe("Add a proposal");
  expect(back()).toBe(true);
  expect(entry().kept.overlay).toBe(undefined);
  expect(route()).toEqual({ page: "priorities", repo: "uraeda" });
  expect(back()).toBe(true);
  expect(route()).toEqual({ page: "inbox", repo: "uraeda" });
});

test("a leave guard holds a navigation until it is answered", async () => {
  startAt("/r/uraeda/inbox");
  let asked = 0;
  let answer: ((leave: boolean) => void) | undefined;
  /** Whether the page holds unsaved text: without any, the guard has no question. */
  let unsaved = true;
  setLeaveGuard(() => {
    if (!unsaved) {
      return undefined;
    }
    asked += 1;
    return new Promise((resolve) => {
      answer = resolve;
    });
  });

  // Held while the question is open, and dropped on "Stay".
  navigate({ page: "git" });
  expect([asked, shown()]).toEqual([1, "/r/uraeda/inbox"]);
  answer?.(false);
  await settled();
  expect(shown()).toBe("/r/uraeda/inbox");

  // "Leave page" opens it.
  navigate({ page: "git" });
  expect([asked, shown()]).toEqual([2, "/r/uraeda/inbox"]);
  answer?.(true);
  await settled();
  expect(shown()).toBe("/r/uraeda/git");

  // Back asks too: "Stay" keeps the page, with the visit before it still there to go back to.
  expect(back()).toBe(true);
  expect([asked, shown()]).toEqual([3, "/r/uraeda/git"]);
  answer?.(false);
  await settled();
  expect(shown()).toBe("/r/uraeda/git");
  expect(back()).toBe(true);
  answer?.(true);
  await settled();
  expect([asked, shown()]).toEqual([4, "/r/uraeda/inbox"]);

  // What stays on the page never asks: another note beside the same list, a block of the page,
  // an overlay and the Back that closes it, and a redirect.
  navigate({ key: "a-note", page: "note" });
  answer?.(true);
  await settled();
  expect([asked, shown()]).toEqual([5, "/r/uraeda/inbox/a-note"]);
  navigate({ key: "another", page: "note" });
  navigate({ hash: "block-2", key: "another", page: "note" });
  openOverlay("Move to");
  expect(back()).toBe(true);
  redirect({ key: "renamed", page: "note" });
  expect([asked, shown()]).toEqual([5, "/r/uraeda/inbox/renamed"]);

  // A guard with nothing unsaved lets a navigation through at once.
  unsaved = false;
  navigate({ page: "git" });
  expect([asked, shown()]).toEqual([5, "/r/uraeda/git"]);
});

test("an address kept with a repository opens in that repository, whichever is shown", () => {
  // A refused write's page, as its queue keeps it: within its repository, which the card names.
  expect(routeIn("notes", "/f/2026-10-06-recurring-tasks/spec.md")).toEqual({
    folder: "2026-10-06-recurring-tasks",
    name: "spec.md",
    page: "file",
    repo: "notes",
  });
  expect(routeIn("notes", "/inbox/triage")).toEqual({ page: "triage", repo: "notes" });
  // An address that names its repository keeps it.
  expect(routeIn("notes", "/r/todo-app/new?kind=feature")).toEqual({
    kind: "feature",
    page: "new",
    repo: "todo-app",
  });
});
