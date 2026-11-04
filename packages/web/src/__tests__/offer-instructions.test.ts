import { expect, test } from "vite-plus/test";
import { WEB_UI_INSTRUCTIONS } from "uraeda-server/instructions";
import { lastOffer } from "../offers.ts";

test("the offer the server's instructions show the agent is one the card reads", () => {
  expect(lastOffer(WEB_UI_INSTRUCTIONS)).toEqual({
    body: "# Login redirects twice\n\nAfter signing in, the app shows the home page, then the sign-in page again.",
    kind: "change",
  });
});
