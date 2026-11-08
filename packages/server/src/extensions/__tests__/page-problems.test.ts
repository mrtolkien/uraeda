// The problems pages report from the browser: kept for the running version only, so the next one
// starts clean, and bounded.
import { expect, test } from "vite-plus/test";
import { PageProblems } from "../page-problems.ts";

const at = (version: number, current: number | undefined, message = "boom") => ({
  current,
  file: "page.tsx",
  message,
  version,
});

test("a page's problems last for its version only", () => {
  const problems = new PageProblems();
  expect(problems.report("wiki", at(2, 2))).toBe(true);
  expect(problems.report("wiki", at(2, 2))).toBe(false);
  expect(problems.of("wiki", 2)).toEqual([{ file: "page.tsx", message: "boom" }]);
  // A page still on the old version reports nothing; the next version starts without them.
  expect(problems.report("wiki", at(1, 2, "late"))).toBe(false);
  expect(problems.of("wiki", 3)).toEqual([]);
  expect(problems.report("wiki", at(3, 3, "again"))).toBe(true);
  expect(problems.of("wiki", 3)).toEqual([{ file: "page.tsx", message: "again" }]);
  expect(problems.of("wiki", 2)).toEqual([]);
});

test("a page throwing in a loop keeps ten problems, each at most 1000 characters", () => {
  const problems = new PageProblems();
  for (let n = 0; n < 50; n++) {
    problems.report("wiki", at(1, 1, `${n}`.padEnd(5000, "x")));
  }
  const kept = problems.of("wiki", 1);
  expect(kept).toHaveLength(10);
  expect(kept.every((problem) => problem.message.length === 1000)).toBe(true);
});
