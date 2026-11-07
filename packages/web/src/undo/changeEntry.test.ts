// An entry made from a change, replayed by the stack: the core's refusal drops it, its text shown
// without the code; a lost connection rejects, leaving it where it was for another try.
import type { useFateClient } from "react-fate";
import type { ChangeView } from "uraeda-binding";
import { expect, test, vi } from "vite-plus/test";
import { inboxEntry, movedWrite } from "../inboxUndo.ts";
import { moveEntry, prioritiesPlace } from "../lists/prioritiesUndo.ts";
import { changeEntry } from "./changeEntry.ts";
import { createUndoStack } from "./stack.ts";

type Fate = ReturnType<typeof useFateClient>;

const CHANGE: ChangeView = { commit: "abc", files: [] };

/** A fate whose undo answers with what `apply` gives, and whose reads answer nothing. */
function fakeFate(apply: () => Promise<unknown>) {
  return {
    mutations: {
      undo: { apply: vi.fn(apply), committed: async () => ({ result: { committed: false } }) },
    },
    request: vi.fn(async () => ({})),
  } as unknown as Fate;
}

const never = async () => false;

// Break: a lost connection taken as a refusal, the entry dropped for good.
test("a failed request leaves the entry on top; a conflict drops it, with its text", async () => {
  const answers: Array<() => Promise<unknown>> = [
    async () => {
      throw new TypeError("fetch failed");
    },
    async () => ({ error: new Error("conflict: “Color themes” changed since in PRIORITIES.md.") }),
  ];
  const fate = fakeFate(() => answers.shift()!());
  const stack = createUndoStack(() => 0);
  const entry = changeEntry(
    fate,
    CHANGE,
    "Deleted “Color themes”",
    { path: "/", repo: "uraeda" },
    "Color themes",
  );
  stack.record(entry);

  await expect(stack.undo(never)).rejects.toThrow("fetch failed");
  expect(stack.top()).toBe(entry);
  expect(stack.canRedo()).toBe(false);

  expect(await stack.undo(never)).toEqual({
    entry,
    kind: "refused",
    reason: "“Color themes” changed since in PRIORITIES.md.",
  });
  expect(stack.top()).toBeUndefined();
});

// Break: a server's failure, not the core's refusal, dropping the redo side's entry.
test("a failed redo rejects and leaves the entry on the redo side; a refusal drops it", async () => {
  const answers: Array<() => Promise<unknown>> = [
    async () => ({ result: { commit: "abc", id: "undo" } }),
    async () => ({ error: new Error("Internal Server Error") }),
    async () => ({ error: new Error("refused: “Color themes” changed since in PRIORITIES.md.") }),
  ];
  const fate = fakeFate(() => answers.shift()!());
  const stack = createUndoStack(() => 0);
  const entry = changeEntry(
    fate,
    CHANGE,
    "Deleted “Color themes”",
    { path: "/", repo: "uraeda" },
    "Color themes",
  );
  stack.record(entry);
  expect(await stack.undo(never)).toEqual({ entry, kind: "done" });

  await expect(stack.redo(never)).rejects.toThrow("Internal Server Error");
  expect(stack.canRedo()).toBe(true);

  expect(await stack.redo(never)).toMatchObject({
    kind: "refused",
    reason: "“Color themes” changed since in PRIORITIES.md.",
  });
  expect(stack.canRedo()).toBe(false);
  expect(stack.top()).toBeUndefined();
});

/** A change of `path`, from `before` to `after`, in base64 as a change holds them. */
function changeOf(path: string, before: string, after: string): ChangeView {
  return { commit: "abc", files: [{ after: btoa(after), before: btoa(before), path }] };
}

// Break: a run of moves keyed by its list alone, joining one repository's change with another's.
test("moves of the same list in two repositories, within the second, are two steps", async () => {
  const fate = fakeFate(async () => ({ result: { commit: "abc", id: "undo" } }));
  const stack = createUndoStack(() => 0);
  const row = { key: "row", text: "Idea" };
  const inbox = (repo: string) =>
    inboxEntry(fate, changeOf("specs/INBOX.md", `${repo} 1`, `${repo} 2`), movedWrite(row), repo);
  const first = inbox("a");
  stack.record(first);
  stack.record(inbox("b"));
  expect(stack.top()?.place.repo).toBe("b");
  await stack.undo(never);
  expect(stack.top()).toBe(first);

  const priorities = (repo: string) =>
    moveEntry(
      fate,
      changeOf("specs/PRIORITIES.md", `${repo} 1`, `${repo} 2`),
      "Moved “Idea”",
      prioritiesPlace(repo, "row"),
      "Idea",
    );
  stack.clear();
  const earlier = priorities("a");
  stack.record(earlier);
  stack.record(priorities("b"));
  await stack.undo(never);
  expect(stack.top()).toBe(earlier);
});
