// The feature page against the sandbox (`just app-test` starts one): every pane of it draws, and
// the keys reach each. A pane's keys are declared only once it is drawn, and a key that means two
// things throws then, stopping the page: a hidden tab hides that until the human opens it.
import { type App, open, test } from "nsh/test";

/** Waits until a text of the app is `words`, whole: a word in another text does not count. */
const says = (app: App, words: string) =>
  app.waitUntil(() => app.texts().includes(words), { timeout: 20_000 });

test("every pane of the feature page draws, and the keys reach each", async () => {
  const app = await open("../../App.tsx", { height: 800, network: "live", width: 1400 });
  // The sandbox's feature at work, task 7 of 11 of its plan, in the sidebar once it is read.
  await app.waitFor("text:Redesign clarifications", { timeout: 30_000 });
  // The sidebar's row, the first: Home's In progress lists the feature too.
  await app.press("text:Redesign clarifications >> nth=0");
  await says(app, "The agent builds the plan");
  await says(app, "Follow the session");
  // The side stack's first pane, shown beside: the feature's session at work, and its run.
  await app.waitUntil(() => app.texts().some((text) => text.startsWith("Last run: Build")), {
    timeout: 20_000,
  });
  await app.keyboard.press("l");
  // The focus there: the status line names its list's keys.
  await says(app, "move");
  // Its first card, then past it its tabs, where `l` shows each of its other panes.
  await app.keyboard.press("j");
  await app.keyboard.press("k");
  await says(app, "tab");
  await app.keyboard.press("l");
  // The decision its branch adds, new to the ledger.
  await says(app, "redesign-clarifications");
  await app.keyboard.press("l");
  await says(app, "Produced so far");
  // Back past its first tab, into the main stack's subject; up to its tabs, and its other pane:
  // Steps, the stages and their files.
  await app.keyboard.press("h");
  await app.keyboard.press("h");
  await app.keyboard.press("h");
  await app.keyboard.press("k");
  await says(app, "tab");
  await app.keyboard.press("l");
  await says(app, "Pull request");
});

test("postpone and drop are reached by their keys, each asking first", async () => {
  const app = await open("../../App.tsx", { height: 800, network: "live", width: 1400 });
  await app.waitFor("text:Redesign clarifications", { timeout: 30_000 });
  await app.press("text:Redesign clarifications >> nth=0");
  await says(app, "Postpone the feature…");
  await app.keyboard.press("shift+p");
  await says(app, "Postpone the feature?");
  await app.keyboard.press("Escape");
  await app.keyboard.press("shift+d");
  await says(app, "Drop the feature?");
  await app.keyboard.press("Escape");
  await app.waitUntil(() => !app.texts().includes("Drop the feature?"), { timeout: 5_000 });
  await says(app, "Postpone the feature…");
});

test("on a phone, the bottom bar ends with the feature's next step, which asks as Next's button does", async () => {
  const app = await open("../../App.tsx", { height: 844, network: "live", width: 390 });
  // Home's Needs you: the sandbox's feature of Now that waits for its Continue.
  await app.waitFor("text:cli-tuis", { timeout: 30_000 });
  await app.press("text:cli-tuis >> nth=0");
  await says(app, "Continue, write the plan");
  await app.press("id:bottom-bar-action");
  await app.waitFor("id:continue-start", { timeout: 10_000 });
});
