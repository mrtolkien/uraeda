// The composer's text once a workflow's message is inserted: the message goes before what was typed.
import { expect, test } from "vite-plus/test";
import { withInserted } from "../RecommendedMessage.tsx";

const MESSAGE = "Continue the feature: write the plan.";

test.each([
  { expected: MESSAGE, message: MESSAGE, typed: "", what: "nothing typed" },
  {
    expected: MESSAGE,
    message: MESSAGE,
    typed: " \n  ",
    what: "only spaces and line breaks typed",
  },
  {
    expected: `${MESSAGE}\nWhy A in Q6?`,
    message: MESSAGE,
    typed: "Why A in Q6?",
    what: "text typed, which is kept after the message",
  },
  {
    expected: `${MESSAGE}\nmy note`,
    message: `${MESSAGE}\n\n`,
    typed: "my note",
    what: "a message ending in blank lines, which the typed text follows on the next line",
  },
  {
    expected: `${MESSAGE}\n  indented\nsecond line\n`,
    message: MESSAGE,
    typed: "  indented\nsecond line\n",
    what: "typed text kept as it is, spaces and line breaks included",
  },
])("with $what, the composer holds the message first", ({ expected, message, typed }) => {
  expect(withInserted(message, typed)).toBe(expected);
});
