// The tab's undo stack: the latest entry first, 50 at most, a redo side a new entry clears, runs of
// one list's moves joined while each comes less than a second after the last, refused entries
// dropped, and one replay at a time. The clock is the test's own, moved by hand.
import { describe, expect, test, vi } from "vite-plus/test";
import { createUndoStack, type UndoEntry } from "./stack.ts";

function clock() {
  let time = 1_000_000;
  return {
    advance: (ms: number) => {
      time += ms;
    },
    now: () => time,
  };
}

function entry(label: string, extra: Partial<UndoEntry> = {}): UndoEntry {
  return {
    label,
    place: { path: "PRIORITIES.md" },
    redo: vi.fn(async () => undefined),
    undo: vi.fn(async () => undefined),
    ...extra,
  };
}

/** A move of `list`, whose run's entry undoes and redoes every move it joined, in order. */
function move(label: string, list: string, log: Array<string>): UndoEntry {
  const own: UndoEntry = {
    label,
    move: { join: (earlier) => joined(earlier, own), list },
    place: { path: "PRIORITIES.md" },
    redo: async () => {
      log.push(`redo ${label}`);
      return undefined;
    },
    undo: async () => {
      log.push(`undo ${label}`);
      return undefined;
    },
  };
  return own;
}

function joined(earlier: UndoEntry, later: UndoEntry): UndoEntry {
  return {
    ...later,
    label: `Moved ${later.label}`,
    redo: async () => (await earlier.redo()) ?? later.redo(),
    undo: async () => (await later.undo()) ?? earlier.undo(),
  };
}

const never = () => Promise.resolve(true);

describe("undo takes back the latest entry first, minutes later", () => {
  test("two entries, ten minutes on", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const moved = entry("Moved");
    const indented = entry("Indented");
    stack.push(moved);
    time.advance(60_000);
    stack.push(indented);
    time.advance(10 * 60_000);
    expect(await stack.undo(never)).toEqual({ entry: indented, kind: "done" });
    expect(indented.undo).toHaveBeenCalledOnce();
    expect(moved.undo).not.toHaveBeenCalled();
    expect(await stack.undo(never)).toEqual({ entry: moved, kind: "done" });
    expect(moved.undo).toHaveBeenCalledOnce();
  });

  test("a committed entry asks: no keeps it on top, yes undoes it", async () => {
    const stack = createUndoStack(clock().now);
    const plain = entry("Plain", { committed: vi.fn(async () => false) });
    const committed = entry("Committed", { committed: async () => true });
    for (const each of [plain, committed]) {
      stack.push(each);
    }
    const ask = vi.fn(async () => false);
    expect(await stack.undo(ask)).toEqual({ entry: committed, kind: "kept" });
    expect(ask).toHaveBeenCalledWith(committed, false);
    expect(committed.undo).not.toHaveBeenCalled();
    expect(stack.top()).toBe(committed);
    expect(await stack.undo(async () => true)).toEqual({ entry: committed, kind: "done" });
    expect(committed.undo).toHaveBeenCalledOnce();
    const asked = vi.fn(async () => true);
    expect(await stack.undo(asked)).toEqual({ entry: plain, kind: "done" });
    expect(asked).not.toHaveBeenCalled();
    // A redo of a committed entry asks as a redo.
    const askRedo = vi.fn(async () => false);
    await stack.redo(askRedo);
    await stack.redo(askRedo);
    expect(askRedo).toHaveBeenCalledWith(committed, true);
  });
});

test("the stack keeps the latest 50 entries", async () => {
  const stack = createUndoStack(clock().now);
  const entries = Array.from({ length: 51 }, (_, index) => entry(`Entry ${index}`));
  for (const each of entries) {
    stack.push(each);
  }
  for (let index = 50; index >= 1; index -= 1) {
    expect(await stack.undo(never)).toEqual({ entry: entries[index], kind: "done" });
  }
  expect(await stack.undo(never)).toEqual({ kind: "empty" });
  expect(entries[0]?.undo).not.toHaveBeenCalled();
});

test("a new entry clears what could be redone", async () => {
  const stack = createUndoStack(clock().now);
  const first = entry("First");
  stack.push(first);
  await stack.undo(never);
  expect(stack.canRedo()).toBe(true);
  expect(await stack.redo(never)).toEqual({ entry: first, kind: "done" });
  expect(first.redo).toHaveBeenCalledOnce();
  expect(stack.top()).toBe(first);
  await stack.undo(never);
  stack.push(entry("Second"));
  expect(stack.canRedo()).toBe(false);
  expect(await stack.redo(never)).toEqual({ kind: "empty" });
});

describe("moves of one list less than a second apart join one entry", () => {
  test("three moves 400 ms apart are one entry, undone and redone as a run", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    stack.push(move("1", "priorities", log));
    time.advance(400);
    stack.push(move("2", "priorities", log));
    time.advance(400);
    stack.push(move("3", "priorities", log));
    const outcome = await stack.undo(never);
    expect(outcome.kind).toBe("done");
    expect(log).toEqual(["undo 3", "undo 2", "undo 1"]);
    expect(await stack.undo(never)).toEqual({ kind: "empty" });
    log.length = 0;
    await stack.redo(never);
    expect(log).toEqual(["redo 1", "redo 2", "redo 3"]);
  });

  test("the time restarts at each move: a long run stays one entry", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    for (let index = 0; index < 5; index += 1) {
      stack.push(move(`${index}`, "inbox", log));
      time.advance(900);
    }
    await stack.undo(never);
    expect(log).toEqual(["undo 4", "undo 3", "undo 2", "undo 1", "undo 0"]);
    expect(await stack.undo(never)).toEqual({ kind: "empty" });
  });

  test("a move 2,000 ms later is a second entry", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    stack.push(move("1", "priorities", log));
    time.advance(2000);
    stack.push(move("2", "priorities", log));
    await stack.undo(never);
    expect(log).toEqual(["undo 2"]);
  });

  test("a delete within the second is its own entry, and a move after it starts a new run", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    const deleted = entry("Deleted");
    stack.push(move("1", "priorities", log));
    time.advance(300);
    stack.push(deleted);
    time.advance(300);
    stack.push(move("2", "priorities", log));
    await stack.undo(never);
    expect(log).toEqual(["undo 2"]);
    expect(await stack.undo(never)).toEqual({ entry: deleted, kind: "done" });
    await stack.undo(never);
    expect(log).toEqual(["undo 2", "undo 1"]);
  });

  test("a move of another list within the second is its own entry", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    stack.push(move("inbox", "inbox", log));
    time.advance(300);
    stack.push(move("priorities", "priorities", log));
    await stack.undo(never);
    expect(log).toEqual(["undo priorities"]);
    await stack.undo(never);
    expect(log).toEqual(["undo priorities", "undo inbox"]);
  });

  test("an undo ends the run: the next move is its own entry", async () => {
    const time = clock();
    const stack = createUndoStack(time.now);
    const log: Array<string> = [];
    stack.push(move("1", "priorities", log));
    time.advance(300);
    stack.push(move("2", "priorities", log));
    await stack.undo(never);
    // The run of 1 and 2 is undone; a move pushed right after starts its own entry.
    time.advance(100);
    stack.push(move("3", "priorities", log));
    await stack.undo(never);
    expect(log).toEqual(["undo 2", "undo 1", "undo 3"]);
    expect(stack.canRedo()).toBe(true);
  });
});

test("a refused undo leaves the stack, and shows its reason", async () => {
  const stack = createUndoStack(clock().now);
  const below = entry("Below");
  const reason = "Could not undo: “Color themes” changed since in PRIORITIES.md.";
  const refused = entry("Refused", { undo: vi.fn(async () => reason) });
  for (const each of [below, refused]) {
    stack.push(each);
  }
  expect(await stack.undo(never)).toEqual({ entry: refused, kind: "refused", reason });
  expect(stack.canRedo()).toBe(false);
  expect(stack.top()).toBe(below);
  expect(await stack.undo(never)).toEqual({ entry: below, kind: "done" });
  // A refused redo leaves the redo side the same way.
  const redoReason = "Could not redo: “Below” changed since in PRIORITIES.md.";
  vi.mocked(below.redo).mockResolvedValueOnce(redoReason);
  expect(await stack.redo(never)).toEqual({ entry: below, kind: "refused", reason: redoReason });
  expect(stack.canRedo()).toBe(false);
  expect(stack.top()).toBeUndefined();
});

test("undo and redo on an empty side do nothing", async () => {
  const stack = createUndoStack(clock().now);
  const ask = vi.fn(async () => true);
  expect(await stack.undo(ask)).toEqual({ kind: "empty" });
  expect(await stack.redo(ask)).toEqual({ kind: "empty" });
  const only = entry("Only");
  stack.push(only);
  expect(await stack.redo(ask)).toEqual({ kind: "empty" });
  expect(only.redo).not.toHaveBeenCalled();
  expect(ask).not.toHaveBeenCalled();
});

test("an undo pressed during another waits for it", async () => {
  const stack = createUndoStack(clock().now);
  const held = Promise.withResolvers<undefined>();
  const first = entry("First");
  const second = entry("Second", { undo: vi.fn(() => held.promise) });
  for (const each of [first, second]) {
    stack.push(each);
  }
  const one = stack.undo(never);
  const two = stack.undo(never);
  await vi.waitFor(() => expect(second.undo).toHaveBeenCalledOnce());
  for (let tick = 0; tick < 10; tick += 1) {
    await Promise.resolve();
  }
  expect(first.undo).not.toHaveBeenCalled();
  held.resolve(undefined);
  expect(await one).toEqual({ entry: second, kind: "done" });
  expect(await two).toEqual({ entry: first, kind: "done" });
});

test("listeners hear each push, undo, redo, and clear", async () => {
  const stack = createUndoStack(clock().now);
  const listener = vi.fn();
  const stop = stack.subscribe(listener);
  stack.push(entry("One"));
  await stack.undo(never);
  await stack.redo(never);
  stack.clear();
  expect(listener).toHaveBeenCalledTimes(4);
  expect(stack.top()).toBeUndefined();
  stop();
  stack.push(entry("Two"));
  expect(listener).toHaveBeenCalledTimes(4);
});
