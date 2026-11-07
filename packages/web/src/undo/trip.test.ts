// The trip an undo takes to where its action happened: the action's repository and page, whichever
// repository the tab is on when the undo runs.
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { currentEntry } from "../routes.tsx";
import { goTo } from "./UndoKeys.tsx";

beforeEach(() => {
  window.history.replaceState({ id: "start" }, "", "/r/b/inbox");
});

describe("an undo takes the human to the action's repository", () => {
  test("an entry of the repository a, undone on the inbox of b, opens a's inbox", () => {
    goTo({ path: "/inbox", repo: "a", select: "row-1" });
    expect(window.location.pathname).toBe("/r/a/inbox");
    expect(currentEntry().select).toBe("row-1");
  });

  test("an entry of the page open, in the repository open, selects in place", () => {
    goTo({ path: "/inbox", repo: "b", select: "row-1" });
    expect(window.location.pathname).toBe("/r/b/inbox");
    expect(currentEntry().id).toBe("start");
    expect(currentEntry().select).toBe("row-1");
  });
});
