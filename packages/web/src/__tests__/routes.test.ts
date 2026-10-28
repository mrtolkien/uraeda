// The addresses of the task view, a mockup, and a run's view, which the UI layout decision requires for an open
// detail.
import { expect, test } from "vite-plus/test";
import { parseLocation, parseRoute, repoPath } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";

test.each([
  ["/priorities/git-listener", { key: "git-listener", page: "proposal" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { folder: "2026-10-06-recurring-tasks", name: "repeat.html", page: "mockup" },
  ],
  ["/f/2026-10-12-cli-tuis/runs/7", { folder: "2026-10-12-cli-tuis", id: "7", page: "run" }],
  // A session, and the New page with the kind it starts with (US3).
  ["/sessions/abc", { id: "abc", page: "session-id" }],
  ["/new", { kind: "session", page: "new" }],
  // US5.1: a feature's story page, and the main checkout's; a file of that name stays a file.
  ["/f/x/storybook", { folder: "x", page: "storybook" }],
  ["/storybook", { folder: "main", page: "storybook" }],
  ["/f/x/storybook.md", { folder: "x", name: "storybook.md", page: "file" }],
  // US8: the decisions page, a decision open, and a principle open.
  ["/decisions", { page: "decisions" }],
  ["/decisions/ui-behaviour", { name: "ui-behaviour", page: "decision" }],
  ["/decisions/constitution/iv", { page: "principle", slug: "iv" }],
  ["/decisions/git/rules", { page: "missing", path: "/decisions/git/rules" }],
  // US2 more 5: a decision as a feature's branch has it.
  [
    "/f/2026-10-17-spec-page/decisions/task-storage",
    { folder: "2026-10-17-spec-page", name: "task-storage", page: "branch-decision" },
  ],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));

/** US3: the New page's kind is in its query, Session when it names none or another. */
test.each([
  ["?kind=change", "change"],
  ["?kind=feature", "feature"],
  ["?kind=session", "session"],
  ["?kind=other", "session"],
  ["", "session"],
])("parseRoute(/new%s) picks %s", (search, kind) =>
  expect(parseRoute("/new", search)).toEqual({ kind, page: "new" }),
);

/** US6.3: the repository is in the URL, and a path without it is still a page's. */
test.each([
  ["/r/uraeda/", { repo: "uraeda", route: { page: "home" } }],
  ["/r/uraeda", { repo: "uraeda", route: { page: "home" } }],
  [
    "/r/uraeda/f/2026-10-14-dark-mode",
    { repo: "uraeda", route: { folder: "2026-10-14-dark-mode", page: "feature" } },
  ],
  ["/r/my%20app/priorities", { repo: "my app", route: { page: "priorities" } }],
  [
    "/f/2026-10-14-dark-mode",
    { repo: null, route: { folder: "2026-10-14-dark-mode", page: "feature" } },
  ],
  ["/", { repo: null, route: { page: "home" } }],
])("parseLocation(%s)", (path, expected) => expect(parseLocation(path)).toEqual(expected));

test("a repository's path starts with its encoded name", () => {
  expect(repoPath("uraeda", "/f/2026-10-14-dark-mode")).toBe("/r/uraeda/f/2026-10-14-dark-mode");
  expect(repoPath("a#b", "/")).toBe("/r/a%23b/");
});

test("a feature's session address encodes its folder, as every link to it does", () => {
  expect(sessionPath("2026-10-12-a#b?c")).toBe("/f/2026-10-12-a%23b%3Fc/session");
});
