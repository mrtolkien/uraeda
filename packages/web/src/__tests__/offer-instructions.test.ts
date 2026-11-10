import { expect, test } from "vite-plus/test";
import { webUiInstructions } from "uraeda-server/instructions";
import { lastOffer } from "../offers.ts";

test("the offer the server's instructions show the agent is one the card reads", () => {
  // The instructions show the block inside a `markdown` fence, as a sample: inside that fence it is
  // text, so the agent's own message holds the block alone, which is what the card reads.
  const sample = /^````markdown\n([\s\S]*?)\n````$/mu.exec(webUiInstructions())?.[1];
  expect(lastOffer(webUiInstructions())).toBeUndefined();
  expect(lastOffer(sample ?? "")).toEqual({
    body: "# Login redirects twice\n\nAfter signing in, the app shows the home page, then the sign-in page again.",
    kind: "change",
  });
});
