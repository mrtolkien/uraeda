// US5.5 to US5.7: what a card shows for an action a button started, until the server's status for
// its item changes, 10 seconds after its write ended, or the write fails.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { markPending, PENDING_MS, runWrite, usePendingAction, useWrites } from "../writes/store.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A card's action for `folder`, as the server's status changes. */
function cardOf(folder: string, status = "Needs you") {
  return renderHook(({ now }) => usePendingAction(folder, now), { initialProps: { now: status } });
}

test("a commit shows on its card while it runs, then 10 seconds at most", async () => {
  const card = cardOf("a");
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;

  act(() => {
    write = runWrite({ folder: "a", label: "Committing…" }, () => done.promise);
  });
  expect(card.result.current).toBe("Committing…");
  // A long commit: no timer runs while it does.
  act(() => vi.advanceTimersByTime(PENDING_MS * 2));
  expect(card.result.current).toBe("Committing…");

  await act(async () => {
    done.resolve(true);
    await write;
  });
  expect(card.result.current).toBe("Committing…");
  act(() => vi.advanceTimersByTime(PENDING_MS - 1));
  expect(card.result.current).toBe("Committing…");
  act(() => vi.advanceTimersByTime(1));
  expect(card.result.current).toBeUndefined();
});

test("the server's status for the item ends the action", () => {
  const card = cardOf("b", "Idle");
  act(() => markPending("b", "Starting the agent…"));
  expect(card.result.current).toBe("Starting the agent…");

  card.rerender({ now: "Working" });

  expect(card.result.current).toBeUndefined();
});

test("a failed write shows the server's status again at once", async () => {
  const card = cardOf("c");
  await act(async () => {
    await runWrite({ folder: "c", label: "Committing…" }, async () => false);
  });
  expect(card.result.current).toBeUndefined();
});

/** Review focus 4 */
test("a write that fails after the server's status changed never shows its action again", async () => {
  const card = cardOf("d", "Needs you");
  const done = Promise.withResolvers<boolean>();
  let write: Promise<boolean> | undefined;
  act(() => {
    write = runWrite({ folder: "d", label: "Committing…" }, () => done.promise);
  });
  card.rerender({ now: "Working" });
  expect(card.result.current).toBeUndefined();

  await act(async () => {
    done.resolve(false);
    await write;
  });

  expect(card.result.current).toBeUndefined();
  card.rerender({ now: "Needs you" });
  expect(card.result.current).toBeUndefined();
});

test("a write started during another one keeps the bar until it ends", async () => {
  const bar = renderHook(() => useWrites().running);
  const first = Promise.withResolvers<boolean>();
  const second = Promise.withResolvers<boolean>();
  let writes: Array<Promise<boolean>> = [];
  act(() => {
    writes = [
      runWrite({ label: "Committing…" }, () => first.promise),
      runWrite({ label: "Starting the change…" }, () => second.promise),
    ];
  });

  await act(async () => {
    first.resolve(true);
    await writes[0];
  });
  expect(bar.result.current?.label).toBe("Starting the change…");

  await act(async () => {
    second.resolve(true);
    await writes[1];
  });
  expect(bar.result.current).toBeUndefined();
});
