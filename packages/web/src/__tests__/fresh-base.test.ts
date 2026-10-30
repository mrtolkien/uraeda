// A write over the hash the browser holds: a refusal for a stale hash reads the file again and writes
// once more over it, and a second refusal is the one the caller gets.
import { expect, test } from "vite-plus/test";
import { withFreshBase } from "../freshBase.ts";

type Result = { error?: Error; result?: string };

const CONFLICT = new Error("conflict: PRIORITIES.md changed on disk");

test.each([
  {
    expected: { result: "written over b" },
    reads: ["cache-first a", "network-only b"],
    what: "a conflict, then the write over the hash read again",
    writes: [{ error: CONFLICT }, { result: "written over b" }],
  },
  {
    expected: { error: CONFLICT },
    reads: ["cache-first a", "network-only b"],
    what: "a second conflict",
    writes: [{ error: CONFLICT }, { error: CONFLICT }],
  },
  {
    expected: { result: "written over a" },
    reads: ["cache-first a"],
    what: "no conflict",
    writes: [{ result: "written over a" }],
  },
  {
    expected: { error: new Error("refused: The proposal is gone") },
    reads: ["cache-first a"],
    what: "another refusal",
    writes: [{ error: new Error("refused: The proposal is gone") }],
  },
])("a write refused as a conflict reads again and retries once: $what", async (row) => {
  const hashes = ["a", "b", "c"];
  const reads: Array<string> = [];
  const over: Array<string> = [];
  const answers: Array<Result> = [...row.writes];
  const result = await withFreshBase(
    async (mode) => {
      const hash = hashes[reads.length];
      reads.push(`${mode} ${hash}`);
      return hash;
    },
    async (hash) => {
      over.push(hash);
      return answers.shift()!;
    },
  );
  expect(result).toEqual(row.expected);
  expect(reads).toEqual(row.reads);
  // Each write is over the hash read just before it.
  expect(over).toEqual(reads.map((read) => read.split(" ")[1]));
});

test("a conflict thrown by the write reads again and retries once", async () => {
  const over: Array<string> = [];
  const result = await withFreshBase(
    async (mode) => (mode === "cache-first" ? "a" : "b"),
    async (hash) => {
      over.push(hash);
      if (hash === "a") {
        throw CONFLICT;
      }
      return "written";
    },
  );
  expect(result).toBe("written");
  expect(over).toEqual(["a", "b"]);
});
