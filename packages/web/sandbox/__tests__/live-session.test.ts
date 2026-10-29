// The realistic project's live session is a real one, exported from Uraeda's own data folder: it
// keeps no path of the machine it ran on and no address but the placeholder, so a new export that
// forgets to scrub them fails here rather than in a published repository.
import { readFileSync } from "node:fs";
import { fixture } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";

const text = readFileSync(fixture("sessions/leader-key-spec.json"), "utf8");

test("the live session names no home folder but the placeholder's", () => {
  // Claude Code's project folder names the home folder too: scrubbed to `-home-me-`.
  const homes = text.match(/\/home\/[^"\\/~]+|\/Users\/[^"\\/~]+|-home-[a-z]+-/g) ?? [];
  expect(homes.filter((home) => home !== "-home-me-")).toEqual([]);
});

test("the live session's only email address is the placeholder", () => {
  const addresses = new Set(text.match(/[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi) ?? []);
  expect([...addresses].filter((address) => address !== "someone@example.com")).toEqual([]);
});
