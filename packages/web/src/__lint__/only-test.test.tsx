// A focused test left behind: refused by `no-only-tests`, so the rest of the suite still runs.
import { expect, test } from "vite-plus/test";

test.only("runs alone", () => {
  expect(1).toBe(1);
});
