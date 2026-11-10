import { expect, test } from "vite-plus/test";
import { lastOffer } from "../offers.ts";

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
