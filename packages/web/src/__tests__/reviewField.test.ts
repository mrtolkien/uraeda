// Where an edit of a review comment is kept: by the place the comment points to, a decision's part
// never taken for the spec's same lines.
import type { CommentItem } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { placeOf } from "../reviewField.ts";

const COMMENT: CommentItem = {
  endLine: 20,
  general: false,
  number: 1,
  quote: [],
  removed: false,
  startLine: 19,
  text: "",
};

test.each([
  { comment: COMMENT, place: "lines 19–20", what: "lines of the spec" },
  { comment: { ...COMMENT, endLine: 19 }, place: "line 19", what: "one line of the spec" },
  {
    comment: { ...COMMENT, decision: "task-storage" },
    place: "decision task-storage, lines 19–20",
    what: "the same lines of a decision",
  },
  {
    comment: { ...COMMENT, decision: "task-storage", removed: true },
    place: "decision task-storage, lines 19–20 removed",
    what: "the same lines of a decision, removed",
  },
  { comment: { ...COMMENT, general: true }, place: "general", what: "the whole file" },
  {
    comment: { ...COMMENT, decision: "task-storage", general: true },
    place: "general",
    what: "the whole file, whatever lines it holds",
  },
])("a comment on $what is kept as $place", ({ comment, place }) => {
  expect(placeOf(comment)).toBe(place);
});
