// @vitest-environment node
// What the page reads of a story's sandboxed frame: only the messages of its own frame's window,
// only objects with a `uraeda` field, a height only when it is a finite number above 0, and an
// element picked only when it gives its role and name as text.
import { expect, test } from "vite-plus/test";
import { frameMessage, heightOf, isFrameMessage, pickedOf } from "../frameMessages.ts";

/** The frame's window, and another window: the page's own, or another embed's frame. */
const FRAME = { name: "frame" };
const OTHER = { name: "other" };

test.each([
  ["a message of its own frame", FRAME, FRAME, { height: 300, uraeda: "size" }, true],
  ["a message of the page's own window", OTHER, FRAME, { height: 300, uraeda: "size" }, false],
  ["another embed's frame", OTHER, FRAME, { uraeda: "ready" }, false],
  ["a message from no window", null, FRAME, { uraeda: "ready" }, false],
  ["a message while the frame has no window", OTHER, undefined, { uraeda: "ready" }, false],
  ["a message from the frame that is not an object", FRAME, FRAME, "ready", false],
  ["a message from the frame with no `uraeda` field", FRAME, FRAME, { height: 300 }, false],
  ["a null message", FRAME, FRAME, null, false],
])("%s is read: %s", (_, source, frame, data, read) => {
  expect(frameMessage(source, frame, data)).toBe(read ? data : undefined);
});

test.each([
  [{ uraeda: "ready" }, true],
  [{ uraeda: undefined }, true],
  [{}, false],
  [[], false],
  [null, false],
  ["uraeda", false],
])("%j is a frame message: %s", (data, is) => {
  expect(isFrameMessage(data)).toBe(is);
});

test.each([
  [300, 300],
  [0.5, 0.5],
  [0, undefined],
  [-20, undefined],
  [Number.NaN, undefined],
  [Number.POSITIVE_INFINITY, undefined],
  ["300", undefined],
  [undefined, undefined],
  [null, undefined],
])("a size message of height %j gives %j", (height, kept) => {
  expect(heightOf({ height, uraeda: "size" })).toBe(kept);
});

test.each([
  ["a role and a name", { name: "Save", role: "button" }, { name: "Save", role: "button" }],
  [
    "a role, a name, and a text",
    { name: "Save", role: "button", text: "Save the draft" },
    { name: "Save", role: "button", text: "Save the draft" },
  ],
  [
    "an empty name, which an unnamed element has",
    { name: "", role: "heading", text: "Title" },
    { name: "", role: "heading", text: "Title" },
  ],
  [
    "an empty text, left out",
    { name: "Save", role: "button", text: "" },
    { name: "Save", role: "button" },
  ],
  [
    "a text that is no text, left out",
    { name: "Save", role: "button", text: 3 },
    { name: "Save", role: "button" },
  ],
  ["no role", { name: "Save" }, undefined],
  ["an empty role", { name: "Save", role: "" }, undefined],
  ["a role that is no text", { name: "Save", role: 1 }, undefined],
  ["no name", { role: "button" }, undefined],
  ["a name that is no text", { name: {}, role: "button" }, undefined],
])("a picked message with %s", (_, message, picked) => {
  expect(pickedOf({ ...message, uraeda: "picked" })).toEqual(picked);
});
