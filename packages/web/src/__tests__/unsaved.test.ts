import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  dropUnsaved,
  forgetUnsaved,
  hasUnsaved,
  pruneUnsaved,
  readUnsaved,
  unsavedKey,
  writeUnsaved,
} from "../fields/unsaved.ts";

const NOW = new Date("2026-10-15T12:00:00Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

beforeEach(() => {
  window.localStorage.clear();
  forgetUnsaved();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** An entry last typed `ago` milliseconds before now. */
const typedAgo = (ago: number) => ({
  at: new Date(NOW.getTime() - ago).toISOString(),
  base: "",
  text: "typed",
});

test.each([
  { ago: 29 * DAY, kept: true, what: "29 days" },
  { ago: 30 * DAY - MINUTE, kept: true, what: "a minute under 30 days" },
  { ago: 30 * DAY + MINUTE, kept: false, what: "a minute over 30 days" },
  { ago: 31 * DAY, kept: false, what: "31 days" },
])("an entry typed $what ago is kept: $kept", ({ ago, kept }) => {
  const key = unsavedKey("/repo", "specs/a.md#notes");
  writeUnsaved(key, typedAgo(ago));
  // The app starts again: the store reads the browser's storage.
  forgetUnsaved();

  pruneUnsaved(NOW);

  expect(readUnsaved(key) !== undefined).toBe(kept);
  expect(window.localStorage.getItem(key) !== null).toBe(kept);
});

test("entries are kept in the browser, and read back on the next start", () => {
  const key = unsavedKey("/repo", "specs/a.md#notes");
  writeUnsaved(key, typedAgo(0));
  forgetUnsaved();

  expect(readUnsaved(key)).toEqual(typedAgo(0));
  expect(hasUnsaved(unsavedKey("/repo", ""))).toBe(true);
  expect(hasUnsaved(unsavedKey("/other", ""))).toBe(false);

  dropUnsaved(key);
  forgetUnsaved();
  expect(readUnsaved(key)).toBeUndefined();
  expect(hasUnsaved()).toBe(false);
});

const throwing = () => {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
};

/** Review focus 9: storage that throws keeps the entries in memory. */
test.each([
  {
    breakStorage: () => {
      // A storage of its own: happy-dom's keeps the methods it handed out before.
      const full = {
        clear: throwing,
        getItem: throwing,
        key: throwing,
        length: 1,
        removeItem: throwing,
        setItem: throwing,
      };
      vi.spyOn(window, "localStorage", "get").mockReturnValue(full as unknown as Storage);
    },
    what: "storage whose methods throw",
  },
  {
    breakStorage: () => {
      vi.spyOn(window, "localStorage", "get").mockImplementation(throwing);
    },
    what: "storage that cannot be reached",
  },
])("$what keeps entries in memory", ({ breakStorage }) => {
  window.localStorage.setItem(unsavedKey("/repo", "old#notes"), JSON.stringify(typedAgo(0)));
  breakStorage();
  const key = unsavedKey("/repo", "specs/a.md#notes");

  writeUnsaved(key, typedAgo(0));

  expect(readUnsaved(key)).toEqual(typedAgo(0));
  expect(hasUnsaved(unsavedKey("/repo", ""))).toBe(true);
  pruneUnsaved(NOW);
  dropUnsaved(key);
  expect(readUnsaved(key)).toBeUndefined();
});
