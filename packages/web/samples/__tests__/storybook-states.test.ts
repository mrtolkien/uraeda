// @vitest-environment node
// Storybook's fixture after the sample builders moved to `samples/`.
import { SPEC_FEATURE } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { SPEC_PAGES } from "../index.ts";

test("the spec page's waiting feature is the one addSpecFeature builds by default", () => {
  // `folders.ts` cannot import the binding's test utilities, which browsers do not load.
  expect(SPEC_PAGES.waiting).toBe(SPEC_FEATURE);
});
