// US2.3: the cards in flight follow the workflow's order, which the core gives each step.
import { expect, test } from "vite-plus/test";
import { byStep, type Feature } from "../sidebar/cards.ts";

/** A feature at a step of the core's order, in its folder. */
const at = (folder: string, order: number) =>
  ({ folder, step: { name: "", order } }) as unknown as Feature;

test.each<[string, Array<Feature>, Array<string>]>([
  [
    "the earliest step first",
    [at("2026-10-16-c", 8), at("2026-10-16-a", 1), at("2026-10-16-b", 6)],
    ["2026-10-16-a", "2026-10-16-b", "2026-10-16-c"],
  ],
  [
    "the newest folder first, at one step",
    [at("2026-10-14-old", 3), at("2026-10-16-new", 3)],
    ["2026-10-16-new", "2026-10-14-old"],
  ],
])("cards by step: %s", (_, features, folders) => {
  expect(byStep(features).map((feature) => feature.folder)).toEqual(folders);
});
