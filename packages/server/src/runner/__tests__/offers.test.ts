import { expect, test } from "vite-plus/test";
import { endingOffer, lastOffer } from "../offers.ts";

const OFFER = "```uraeda-offer change\n# Example\n\nBody.\n```";

/** What an offer inside, or beside, other fences reads as: the text, and the offer it holds. */
const rows: Array<[string, string, ReturnType<typeof lastOffer>]> = [
  ["a plain block", OFFER, { body: "# Example\n\nBody.", kind: "change" }],
  [
    "a block indented by three spaces",
    `   ${OFFER.replaceAll("\n", "\n   ")}`,
    { body: "# Example\n\nBody.", kind: "change" },
  ],
  ["a block indented by four spaces is code", `    ${OFFER.replaceAll("\n", "\n    ")}`, undefined],
  ["after prose", `Intro.\n\n${OFFER}\n\nMore.`, { body: "# Example\n\nBody.", kind: "change" }],
  [
    "a feature block",
    "```uraeda-offer feature\nBecause.\n```",
    { body: "Because.", kind: "feature" },
  ],
  ["a tilde block", "~~~uraeda-offer change\n# Tilde\n~~~", { body: "# Tilde", kind: "change" }],
  ["a longer closing fence", "```uraeda-offer change\n# A\n`````", { body: "# A", kind: "change" }],
  // Quoted in an outer fence: the markdown draws a code sample, so it is no offer.
  ["in a four-backtick fence", `\`\`\`\`md\n${OFFER}\n\`\`\`\``, undefined],
  ["in a tilde fence", `~~~md\n${OFFER}\n~~~`, undefined],
  ["in a tilde fence closed by more", `~~~md\n${OFFER}\n~~~~~`, undefined],
  ["in a backtick fence of three", `\`\`\`md\n${OFFER}\n\`\`\``, undefined],
  // A tilde closes a tilde fence only: the backtick lines inside stay text.
  [
    "a tilde fence around a block",
    `~~~\n${OFFER}\n~~~\n\n${OFFER.replace("Example", "Real")}`,
    {
      body: "# Real\n\nBody.",
      kind: "change",
    },
  ],
  // The outer fence is not closed by a shorter one, so the block after it is still inside.
  ["an outer fence a short fence does not close", `\`\`\`\`md\n\`\`\`\n${OFFER}`, undefined],
  // An offer closed by a fence shorter than its opening is still open.
  ["a fence closed too short", "````uraeda-offer change\n# A\n```", undefined],
  // A closing fence has no text after it.
  ["a fence with text after it is no closing", "```uraeda-offer change\n# A\n``` more", undefined],
  ["a block left open", "```uraeda-offer change\n# A\n\nNever closed.", undefined],
  [
    "a closed block before an open one",
    `${OFFER}\n\n\`\`\`uraeda-offer change\n# B\nOpen.`,
    {
      body: "# Example\n\nBody.",
      kind: "change",
    },
  ],
  [
    "CRLF lines",
    "```uraeda-offer change\r\n# A\r\n\r\nB.\r\n```\r\n",
    { body: "# A\n\nB.", kind: "change" },
  ],
];

test.each(rows)("an offer read as markdown reads it: %s", (_name, text, expected) => {
  expect(lastOffer(text)).toEqual(expected);
});

test("an offer is the text's last word only with nothing but blanks after it", () => {
  const offer = { body: "# Example\n\nBody.", kind: "change" };
  expect(endingOffer(`Intro.\n\n${OFFER}\n\n  \n`)).toEqual(offer);
  expect(endingOffer(`${OFFER}\r\n`)).toEqual(offer);
  expect(endingOffer(`${OFFER}\n\nDo not start it.`)).toBeUndefined();
  expect(endingOffer(`${OFFER}\n\`\`\`sh\nls\n\`\`\`\n`)).toBeUndefined();
  expect(endingOffer(`${OFFER}\n\`\`\`uraeda-offer change\n# B\nOpen.`)).toBeUndefined();
  expect(endingOffer("Nothing to do.")).toBeUndefined();
});

/** The text with `by` before each of its lines. */
const indented = (text: string, by: string) => text.replaceAll("\n", `\n${by}`).replace(/^/u, by);

/**
 * Codex P1 of the review of wave 5. Catches: an offer in a list item, a quote, or indented, which
 * the card may draw but nobody wrote as the run's last word, accepted for a change by itself: only a
 * fence at column 0, outside any other, is.
 */
test("the automatic acceptance takes an offer at column 0 only", () => {
  // The card still draws these, as markdown does.
  expect(lastOffer(indented(OFFER, "  "))).toBeDefined();
  expect(endingOffer(indented(OFFER, "  "))).toBeUndefined();
  expect(endingOffer(indented(OFFER, " "))).toBeUndefined();
  // An outer fence opened on a list item, with the offer indented under it, never closed.
  expect(endingOffer(`- \`\`\`\`md\n${indented(OFFER, "  ")}`)).toBeUndefined();
  expect(endingOffer(`1. Example:\n\n${indented(OFFER, "   ")}\n`)).toBeUndefined();
  expect(endingOffer(indented(OFFER, "> "))).toBeUndefined();
  // At column 0 after a list: the list ended, so the block is the text's own.
  expect(endingOffer(`- one\n- two\n\n${OFFER}\n`)).toEqual({
    body: "# Example\n\nBody.",
    kind: "change",
  });
});
