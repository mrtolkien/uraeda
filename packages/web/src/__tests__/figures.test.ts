// A figure's token counts, in the spec's compact notation.
import { expect, test } from "vite-plus/test";
import { tokenCount } from "../feature/Figures.tsx";

/** US2.2 */
test("token counts read compact, rounded to one decimal, units in words' case", () => {
  expect(tokenCount(999)).toBe("999");
  expect(tokenCount(1000)).toBe("1 k");
  expect(tokenCount(2712)).toBe("2.7 k");
  expect(tokenCount(99_950)).toBe("100 k");
  expect(tokenCount(113_407)).toBe("113 k");
  // Rounding up to the next unit names it, never "1,000 k".
  expect(tokenCount(999_950)).toBe("1 M");
  expect(tokenCount(5_177_416)).toBe("5.2 M");
});
