// The addresses of the task view, a mockup, and a run's view, which the UI layout decision requires for an open
// detail.
import { renderHook, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { navigate, parseLocation, parseRoute, repoPath, useRestoreScroll } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import { atRepo, click, fakeAgent, fixtureRepo, renderPage, type } from "./helpers.tsx";

test.each([
  ["/priorities/git-listener", { key: "git-listener", page: "task" }],
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

/** US1 more 2, US3 more 2: links from before sessions open the same page at its new address. */
test.each([
  ["/chats/abc", "/sessions/abc", "", ""],
  ["/chats/new", "/new", "", ""],
  ["/changes/new", "/new", "?kind=change", ""],
  // Their query and their hash come along, the target's query first.
  ["/chats/abc?from=mail#turn-x", "/sessions/abc", "?from=mail", "#turn-x"],
  ["/changes/new?from=mail#top", "/new", "?kind=change&from=mail", "#top"],
])("old addresses redirect: %s lands on %s%s%s", async (old, path, search, hash) => {
  await renderPage(old);
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(path)));
  expect(window.location.search).toBe(search);
  expect(window.location.hash).toBe(hash);
});

test("a new session's first message opens /sessions/<id>", async () => {
  const fake = await fakeAgent();
  await renderPage("/new", fixtureRepo(), { agent: fake });

  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "List the drafts",
  );
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/sessions/")}[^/]+$`)),
  );
  expect(fake.adapter.sent[0].text).toBe("List the drafts");
});

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

// The edge case "Back from a session view": Back before the next page draws finds the page left
// still shown, scrolled to the top for the next one, and it takes its position back.
test("Back before the next page draws returns the page left to its position", async () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const scrollY = vi.spyOn(window, "scrollY", "get").mockReturnValue(1077);
  window.history.pushState({ id: "left" }, "", "/f/2026-10-12-cli-tuis/session");
  const { unmount } = renderHook(() => useRestoreScroll(true));
  try {
    navigate("/f/2026-10-12-cli-tuis/proposal.md");
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
    const back = new Promise((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
    window.history.back();
    await back;
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1077);
  } finally {
    unmount();
    scrollTo.mockRestore();
    scrollY.mockRestore();
  }
});
