import { expect, test } from "vite-plus/test";
import { searchCache } from "./helpers.ts";

const { cache } = searchCache();

/** SC-003, with `vp test bench`. */
test("SC-003: searching 500 sessions holding 100,000 items answers in under 200 ms", async ({
  bench,
}) => {
  const result = await bench("search a query held by one item", () => {
    cache.sessions("/repo", { query: "needle" });
  }).run();

  process.stdout.write(`A search answered in ${result.latency.mean.toFixed(1)} ms on average.\n`);
  expect(result.latency.mean).toBeLessThan(200);
});
