// Run by `nsh test`, without a display: the runner it builds links the app's Rust crate, so this
// passes only when Native Shell, the crate, and the entry fit together.
import { expect, open, test } from "nsh/test";

test("the app opens and shows its name", async () => {
  const app = await open("./App.tsx");
  expect(app.texts()).toContain("Uraeda");
});
