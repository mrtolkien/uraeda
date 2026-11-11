import { getEventListeners } from "node:events";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { sleep } from "../sleep.ts";

afterEach(() => {
  vi.useRealTimers();
});

test("a wait that ends leaves no listener on the signal", async () => {
  vi.useFakeTimers();
  const stop = new AbortController();
  const waiting = sleep(60_000, stop.signal);
  expect(getEventListeners(stop.signal, "abort")).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(60_000);
  await waiting;
  expect(getEventListeners(stop.signal, "abort")).toHaveLength(0);
});

test("the stop cuts a wait short, and an aborted signal waits for nothing", async () => {
  vi.useFakeTimers();
  const stop = new AbortController();
  const waiting = sleep(60_000, stop.signal);
  stop.abort();
  await waiting;
  expect(vi.getTimerCount()).toBe(0);
  await sleep(60_000, stop.signal);
  expect(vi.getTimerCount()).toBe(0);
});
