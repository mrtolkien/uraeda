import { expect, test } from "vite-plus/test";

import { poolSize } from "../threadpool.ts";

test("the thread pool has a thread per core, at least 8 and at most 64", () => {
  expect(poolSize(4)).toBe("8");
  expect(poolSize(16)).toBe("16");
  expect(poolSize(256)).toBe("64");
});

test("the server's entry sizes the thread pool before any other import", async () => {
  const { readFileSync } = await import("node:fs");
  const main = readFileSync(new URL("../main.ts", import.meta.url), "utf8");
  const first = main.split("\n").find((line) => line.startsWith("import "));
  expect(first).toBe('import "./threadpool.ts";');
});
