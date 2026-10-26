// The keys that move an item queue their moves (R30): a list that goes away takes its queue and its
// waiting with it, so no move is written for a list nobody sees, and no timer outlives it.
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { useItemMoves, waitForList } from "../lists/useItemMoves.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const SECTIONS = [{ id: "next", rows: [{ key: "a" }, { key: "b" }, { key: "c" }] }];

test("moves still queued when the list goes are dropped, and no settle timer is left", async () => {
  const written = Promise.withResolvers<void>();
  const onMove = vi.fn(() => written.promise);
  const { result, unmount } = renderHook(() => useItemMoves(onMove, SECTIONS, () => {}));

  // Two moves: the first is being written, the second waits for it.
  result.current?.("down", 0);
  result.current?.("down", 1);
  expect(onMove).toHaveBeenCalledTimes(1);

  unmount();
  written.resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(onMove).toHaveBeenCalledTimes(1);
  // The list never showed the first move: its wait for that would have outlived the list.
  expect(vi.getTimerCount()).toBe(0);
});

test("a wait for the list to show a move ends with the list", async () => {
  const onMove = vi.fn(() => Promise.resolve());
  const { result, unmount } = renderHook(() => useItemMoves(onMove, SECTIONS, () => {}));

  result.current?.("down", 0);
  result.current?.("down", 1);
  await vi.advanceTimersByTimeAsync(0);
  // The first is written and waits for the list to show it, with a timer for the longest wait.
  expect(onMove).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(1);

  unmount();
  await vi.advanceTimersByTimeAsync(5000);

  expect(onMove).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

// Break: the settle timer resolving its wait but leaving the resolver for a reorder to find.
test("a wait the list never settles leaves no resolver behind once its timer ends it", async () => {
  const waiters = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const waited = waitForList(waiters, timers, 2000);
  expect(waiters.size).toBe(1);
  await vi.advanceTimersByTimeAsync(2000);
  await waited;

  expect(waiters.size).toBe(0);
  expect(timers.size).toBe(0);
});
