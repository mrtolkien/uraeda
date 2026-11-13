// Run by `nsh test`, in the runner it builds with the app's crate: what TSX imports from
// `uraeda/native` is Rust, in `crates/app/`, and a call returns Rust's value at once.
import { expect, test } from "nsh/test";
import { version } from "uraeda/native";

test("TSX calls a function of the module", () => {
  expect(version()).toMatch(/^\d+\.\d+\.\d+$/);
});
