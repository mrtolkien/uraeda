import { expect, test } from "vite-plus/test";
import { searchCache } from "./helpers.ts";

/** SC-003, in `vp test`: `search.bench.ts` measures it with `vp test bench`. */
test("SC-003: searching 500 sessions holding 100,000 items answers in under 200 ms", () => {
  const { cache, needle } = searchCache();
  cache.sessions("/repo", { query: "warm-up" });

  const start = performance.now();
  const found = cache.sessions("/repo", { query: "needle" });
  const elapsed = performance.now() - start;

  expect(found.map((session) => session.id)).toEqual([needle]);
  expect(elapsed).toBeLessThan(200);
});
