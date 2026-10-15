// The addresses of the task view, a mockup, and a run's view, which the UI layout decision requires for an open
// detail.
import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { navigate, parseLocation, parseRoute, repoPath, useRestoreScroll } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";

test.each([
  ["/priorities/git-listener", { key: "git-listener", page: "task" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { folder: "2026-10-06-recurring-tasks", name: "repeat.html", page: "mockup" },
  ],
  ["/f/2026-10-12-cli-tuis/runs/7", { folder: "2026-10-12-cli-tuis", id: "7", page: "run" }],
  // "New change", which the sidebar's row opens (the spec's components).
  ["/changes/new", { page: "new-change" }],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));

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
