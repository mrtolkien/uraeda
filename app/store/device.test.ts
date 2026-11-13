// Run by `nsh test`, without a display: what the app keeps on a device, on Native Shell's storage,
// which this file's engine holds in memory.
import { effect, Storage } from "nsh";
import { expect, test } from "nsh/test";
import { deviceStore } from "./device";

/** The keys of a device, as the app's table declares its own. */
type Keys = {
  theme: "dark" | "light";
  [draft: `unsaved:${string}`]: { text: string };
};

test("a choice kept on the device comes back after a restart", async () => {
  await Storage.clear();
  const device = deviceStore<Keys>();
  await device.load();
  expect(device.get("theme")).toBe(undefined);
  const seen: Array<string | undefined> = [];
  effect(() => {
    seen.push(device.get("theme"));
  });

  // A choice is read back at once, by who reads it already too.
  device.set("theme", "dark");
  device.set("unsaved:inbox", { text: "half a note" });
  expect(device.get("theme")).toBe("dark");

  // A restart: the same storage, read again.
  const restarted = deviceStore<Keys>();
  expect(restarted.get("theme")).toBe(undefined);
  await restarted.load();
  expect(restarted.get("theme")).toBe("dark");
  expect(restarted.get("unsaved:inbox")).toEqual({ text: "half a note" });
  expect(restarted.get("unsaved:other")).toBe(undefined);

  // A choice taken back is gone after the next start.
  restarted.set("theme", undefined);
  const again = deviceStore<Keys>();
  await again.load();
  expect(again.get("theme")).toBe(undefined);
  expect(again.get("unsaved:inbox")).toEqual({ text: "half a note" });
  expect(seen).toEqual([undefined, "dark"]);
});

test("a choice made while the device is read wins over the one kept", async () => {
  await Storage.clear();
  await Storage.setItem("theme", JSON.stringify("light"));
  // What something else wrote there, which is no value of the app's, reads as nothing kept.
  await Storage.setItem("unsaved:inbox", "{half");
  const device = deviceStore<Keys>();
  const loading = device.load();
  device.set("theme", "dark");
  await loading;
  expect(device.get("theme")).toBe("dark");
  expect(device.get("unsaved:inbox")).toBe(undefined);
});

test("a value the storage refuses stays for the run, and the device says it is full", async () => {
  await Storage.clear();
  const device = deviceStore<Keys>();
  await device.load();
  expect(device.full()).toBe(false);
  // Past the 5 MB an app may keep.
  const text = "x".repeat(6 * 1024 * 1024);
  device.set("unsaved:inbox", { text });
  await Storage.getItem("theme");
  expect(device.full()).toBe(true);
  expect(device.get("unsaved:inbox")?.text.length).toBe(text.length);
  expect(await Storage.getItem("unsaved:inbox")).toBe(null);

  // A value that fits is kept again.
  device.set("unsaved:inbox", { text: "short" });
  await Storage.getItem("theme");
  expect(device.full()).toBe(false);
});

/** A storage whose writes are kept when the test settles them, in the order it settles them. */
function slowStorage() {
  const kept = new Map<string, string>();
  const waiting: Array<{ key: string; settle: () => void }> = [];
  let writes = 0;
  const later = (key: string, apply: () => void) =>
    new Promise<void>((resolve) => {
      writes += 1;
      waiting.push({
        key,
        settle: () => {
          apply();
          resolve();
        },
      });
    });
  return {
    kept,
    storage: {
      getItem: async (key: string) => kept.get(key) ?? null,
      keys: async () => [...kept.keys()],
      removeItem: (key: string) => later(key, () => kept.delete(key)),
      setItem: (key: string, value: string) => later(key, () => kept.set(key, value)),
    },
    /** Settles every write, the newest first, until none waits: the worst order a storage answers in. */
    async settle() {
      while (waiting.length > 0) {
        waiting.pop()?.settle();
        // oxlint-disable-next-line no-await-in-loop
        await new Promise<void>((done) => setTimeout(done, 0));
      }
    },
    writes: () => writes,
  };
}

test("the storage ends on the last value set, however its writes settle", async () => {
  const slow = slowStorage();
  const device = deviceStore<Keys>(slow.storage);
  await device.load();
  // Two fields typed in at once, each key set several times before the storage answers.
  device.set("unsaved:a", { text: "a" });
  device.set("unsaved:b", { text: "b" });
  device.set("unsaved:a", { text: "a, then more" });
  device.set("unsaved:b", { text: "b, then more" });
  device.set("theme", "dark");
  device.set("theme", undefined);
  await slow.settle();

  // A restart finds both texts whole, and no key that was taken back.
  const restarted = deviceStore<Keys>(slow.storage);
  await restarted.load();
  expect(restarted.get("unsaved:a")).toEqual({ text: "a, then more" });
  expect(restarted.get("unsaved:b")).toEqual({ text: "b, then more" });
  expect(restarted.get("theme")).toBe(undefined);
  // The texts kept are found from the values themselves.
  expect(restarted.keys("unsaved:").toSorted()).toEqual(["unsaved:a", "unsaved:b"]);
});

test("a value set with a rest is written once, when the device is flushed", async () => {
  const slow = slowStorage();
  const device = deviceStore<Keys>(slow.storage);
  await device.load();
  // Typed fast: read back at once, and nothing written while the hand moves.
  for (const text of ["h", "he", "hel", "hell", "hello"]) {
    device.set("unsaved:note", { text }, { rest: 60_000 });
  }
  expect(device.get("unsaved:note")).toEqual({ text: "hello" });
  expect(slow.writes()).toBe(0);
  device.flush();
  await slow.settle();
  expect(slow.writes()).toBe(1);
  expect(slow.kept.get("unsaved:note")).toBe(JSON.stringify({ text: "hello" }));
  // A value taken back at once cancels the write that waited.
  device.set("unsaved:note", { text: "more" }, { rest: 60_000 });
  device.set("unsaved:note", undefined);
  await slow.settle();
  expect(slow.kept.has("unsaved:note")).toBe(false);
});

test("an older refusal of a key does not say the device is full once a newer value is kept", async () => {
  // A storage that refuses a long text, when the test settles it.
  const waiting: Array<() => void> = [];
  const storage = {
    getItem: async () => null,
    keys: async () => [],
    removeItem: async () => {},
    setItem: (_key: string, value: string) =>
      new Promise<void>((resolve, reject) => {
        waiting.push(() => (value.length > 20 ? reject(new Error("full")) : resolve()));
      }),
  };
  const device = deviceStore<Keys>(storage);
  await device.load();
  // A draft past the limit, then trimmed before the storage answered.
  device.set("unsaved:inbox", { text: "far too long a text" });
  device.set("unsaved:inbox", { text: "short" });
  while (waiting.length > 0) {
    waiting.shift()?.();
    // oxlint-disable-next-line no-await-in-loop
    await new Promise<void>((done) => setTimeout(done, 0));
  }
  expect(device.full()).toBe(false);
});
