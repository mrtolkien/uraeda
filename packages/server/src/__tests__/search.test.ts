import { expect, test } from "vite-plus/test";
import { searchCache } from "./helpers.ts";

/**
 * SC-003, in `vp test`: the fastest of five searches, so a machine busy with other tests does not
 * fail it. `search.bench.ts` measures the mean with `vp test bench`.
 */
test("SC-003: searching 500 sessions holding 100,000 items answers in under 200 ms", () => {
  const { cache, needle } = searchCache();
  cache.sessions("/repo", { query: "warm-up" });

  const times = Array.from({ length: 5 }, () => {
    const start = performance.now();
    const found = cache.sessions("/repo", { query: "needle" });
    const elapsed = performance.now() - start;
    expect(found.map((session) => session.id)).toEqual([needle]);
    return elapsed;
  });

  expect(Math.min(...times)).toBeLessThan(200);
});
