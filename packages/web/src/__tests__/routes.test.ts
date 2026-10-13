// The addresses of the task view, a mockup, and a run's view, which the UI layout decision requires for an open
// detail.
import { renderHook } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { navigate, parseRoute, useRestoreScroll } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";

test.each([
  ["/priorities/git-listener", { page: "task", key: "git-listener" }],
  [
    "/f/2026-10-06-recurring-tasks/mockups/repeat.html",
    { page: "mockup", folder: "2026-10-06-recurring-tasks", name: "repeat.html" },
  ],
  ["/f/2026-10-12-cli-tuis/runs/7", { page: "run", folder: "2026-10-12-cli-tuis", id: "7" }],
])("parseRoute(%s)", (path, route) => expect(parseRoute(path)).toEqual(route));

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
