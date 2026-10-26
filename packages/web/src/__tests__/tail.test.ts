// The transcript's tail: the latest 20 messages draw, counting messages and not tool calls,
// "Show earlier messages" adds 20, and the address of a turn draws from that turn.
import { expect, test } from "vite-plus/test";
import { type Piece, shownAfterPress, stepPage, TAIL_MESSAGES } from "../tail.tsx";

type Item = { kind: string; seq: number };

/** A page's items from their kinds, `m` a message of the human's, `t` a text of the agent's, `x` a tool call. */
function page(kinds: string): Array<Item> {
  const names: Record<string, string> = { m: "message", t: "text", x: "tool" };
  return [...kinds].map((kind, at) => ({ kind: names[kind]!, seq: at + 1 }));
}

const TURNS = ["turn-1", "turn-2", "turn-3"];

/** A step with the walk's defaults: the last page of the last turn, with one before. */
function step(items: Array<Item>, options: Partial<Parameters<typeof stepPage>[0]> = {}) {
  const { count, earlier, from, goOn } = stepPage({
    anchor: Number.POSITIVE_INFINITY,
    hasPrevious: true,
    index: 2,
    items,
    need: TAIL_MESSAGES,
    page: 0,
    start: undefined,
    turns: TURNS,
    ...options,
  });
  return { count, earlier, from, goOn };
}

test("the tail draws the latest 20 messages", () => {
  expect(TAIL_MESSAGES).toBe(20);
});

test.each([
  { drawn: 20, expected: 40 },
  { drawn: 40, expected: 60 },
  { drawn: 21, expected: 41 },
  { drawn: 15, expected: 35 },
])("with $drawn messages drawn, a press asks for $expected", ({ drawn, expected }) => {
  const pieces = [{ count: drawn - 5 }, { count: 5 }] as unknown as Array<Piece>;

  expect(shownAfterPress(pieces)).toBe(expected);
});

test.each([
  {
    expected: { count: 20, earlier: true, from: 10, goOn: false },
    items: page("m".repeat(30)),
    what: "a page of 30 messages: the latest 20, with more before",
  },
  {
    expected: { count: 20, earlier: true, from: 20, goOn: false },
    items: page("mx".repeat(30)),
    what: "a page of 30 messages with a tool call after each: tool calls do not count",
  },
  {
    expected: { count: 20, earlier: false, from: 0, goOn: false },
    items: page("t".repeat(20)),
    what: "a page of exactly 20 messages: all of them, nothing before",
  },
  {
    expected: { count: 5, earlier: false, from: 0, goOn: true },
    items: page("xtxtxtxtxt"),
    what: "a page of 5 messages and 5 tool calls, with a page before: all of it, and the walk goes on",
  },
  {
    expected: { count: 5, earlier: false, from: 0, goOn: false },
    items: page("xtxtxtxtxt"),
    options: { hasPrevious: false },
    what: "the same page, the session's first: all of it, the walk ends",
  },
  {
    expected: { count: 0, earlier: false, from: 0, goOn: true },
    items: page("xxxx"),
    what: "a page of tool calls only, with a page before: nothing, and the walk goes on",
  },
  {
    expected: { count: 3, earlier: true, from: 4, goOn: false },
    items: page("mxmxmxmxmx"),
    options: { need: 3 },
    what: "a page of 5 messages and 3 needed: the 3 latest, with 2 before",
  },
  {
    expected: { count: 25, earlier: true, from: 10, goOn: false },
    items: page("t".repeat(35)),
    options: { need: 25 },
    what: "a press: 25 needed draws 25",
  },
])("$what", ({ expected, items, options }) => {
  expect(step(items, options)).toEqual(expected);
});

test.each([
  {
    expected: { count: 30, earlier: false, from: 0, goOn: true },
    options: { anchor: 0, index: 1, page: 0 },
    what: "a turn after the one the address names: all of its messages, the walk goes on",
  },
  {
    expected: { count: 30, earlier: false, from: 0, goOn: true },
    options: { anchor: 1, index: 1, page: 1 },
    what: "the named turn's later page: all of it, the walk goes on to its first",
  },
  {
    expected: { count: 30, earlier: false, from: 0, goOn: false },
    options: { anchor: 1, index: 1, page: 0 },
    what: "the named turn's first page: all of it, where the walk ends, past the 20 needed",
  },
])("a turn link draws from its turn: $what", ({ expected, options }) => {
  expect(step(page("t".repeat(30)), options)).toEqual(expected);
});

test.each([
  {
    expected: { count: 10, earlier: true, from: 20, goOn: false },
    options: { start: { page: 0, seq: 21, turn: "turn-3" } },
    what: "a start in this page: from its item, whatever the count needed",
  },
  {
    expected: { count: 30, earlier: false, from: 0, goOn: true },
    options: { start: { page: 0, seq: 5, turn: "turn-2" } },
    what: "a start in another turn: all of this page, the walk goes on back to it",
  },
  {
    expected: { count: 20, earlier: true, from: 10, goOn: false },
    options: { start: { page: 0, seq: 5, turn: "turn-9" } },
    what: "a start whose turn left the session: dropped, counting from the end again",
  },
])("the tail keeps its start: $what", ({ expected, options }) => {
  expect(step(page("t".repeat(30)), options)).toEqual(expected);
});
