import { expect, test } from "vite-plus/test";
import { checkVersion, publishOrder, releaseOf } from "./release.ts";

test.each([
  { expected: { distTag: "latest", version: "0.5.0" }, tag: "v0.5.0" },
  { expected: { distTag: "next", version: "0.6.0-rc.1" }, tag: "v0.6.0-rc.1" },
  { expected: { distTag: "latest", version: "0.5.0" }, tag: "0.5.0" },
])("$tag", ({ expected, tag }) => {
  expect(releaseOf(tag)).toEqual(expected);
});

test("a tag that is not a version is refused", () => {
  expect(() => releaseOf("main")).toThrow("the tag main is not a version");
});

test("a tag that is not the workspace's version is refused", () => {
  expect(() => checkVersion("v0.5.0", "0.4.0")).toThrow(
    "the tag v0.5.0 is not the workspace's version 0.4.0",
  );
});

test("the four platforms in order, before uraeda", () => {
  expect(publishOrder()).toEqual([
    "uraeda-binding-linux-x64-gnu",
    "uraeda-binding-linux-arm64-gnu",
    "uraeda-binding-darwin-x64",
    "uraeda-binding-darwin-arm64",
    "uraeda",
  ]);
});
