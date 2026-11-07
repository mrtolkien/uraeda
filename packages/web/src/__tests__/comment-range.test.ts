// How a comment's range grows and shrinks, for taps and for `J` `K` alike: the keys span the lines
// between their anchor and head in either order, under the upper block's heading, and never across
// two files; a tap adds its lines under the first block's heading.
import { expect, test } from "vite-plus/test";
import { merged, spanned } from "../commentRange.ts";
import type { Range } from "../useCommentDraft.ts";

const KEY = { end: 92, heading: "US2", start: 92 };
const NEXT = { end: 95, heading: "US3", start: 93 };
const DECISION = { decision: { name: "git", removed: false }, end: 15, heading: "Git", start: 15 };

test("a range spans its anchor and head in either order, under the upper heading, in one file", () => {
  const rows: Array<[string, Range, Range]> = [
    ["the head below the anchor", spanned(KEY, NEXT), { end: 95, heading: "US2", start: 92 }],
    ["the head above the anchor", spanned(NEXT, KEY), { end: 95, heading: "US2", start: 92 }],
    ["the head back on the anchor", spanned(KEY, KEY), KEY],
    ["the head in another file", spanned(KEY, DECISION), DECISION],
    ["a tap below the selection", merged(KEY, NEXT), { end: 95, heading: "US2", start: 92 }],
    ["a tap above the selection", merged(NEXT, KEY), { end: 95, heading: "US2", start: 92 }],
    ["a tap with no selection", merged(undefined, NEXT), NEXT],
    ["a tap in another file", merged(KEY, DECISION), DECISION],
  ];
  for (const [row, range, expected] of rows) {
    expect(range, row).toEqual(expected);
  }
});
