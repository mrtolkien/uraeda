// US5 2 of the worker lifecycle: while Continue all is under the pointer, home tints the runs it
// continues and dims every other row, by the server's own rule; its description names them.
import { act, fireEvent, screen } from "@testing-library/react";
import * as stylex from "@stylexjs/stylex";
import { expect, test } from "vite-plus/test";
import { previewStyles } from "../home/ContinueAll.tsx";
import { pickedStyles } from "../layout/picked.ts";
import { fakeAgent, fixtureRepo, renderPage } from "./helpers.tsx";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

type Fake = Awaited<ReturnType<typeof fakeAgent>>;

/** A session of the folder whose one workflow turn failed, not logged in. */
async function failedRun({ sessions }: Fake, repo: string, folder: string) {
  const { cache } = sessions;
  const root = await sessions.mainRoot(repo);
  const session = cache.createSession({
    agent: "fake",
    folder,
    nativeId: "n",
    repo: root,
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "plan",
    trigger: "manual",
  });
  cache.endTurn(turn, { reason: "Not logged in · Please run /login", state: "failed" });
}

/** The classes of a style. */
const classesOf = (style: stylex.StyleXStyles) => stylex.props(style).className!.split(" ");

/** Home's card of the feature in `folder`. */
const card = (folder: string) => document.querySelector(`[data-core-key="f:${folder}"]`)!;

test("Continue all's preview tints the runs it continues and dims the rest", async () => {
  const agent = await fakeAgent();
  const repo = fixtureRepo();
  await failedRun(agent, repo, AGENT);
  // A run that failed at a human gate asks too, but Continue all leaves the gate to the human.
  await failedRun(agent, repo, HUMAN);
  await renderPage("/", repo, { agent });

  // A screen reader hears what it continues, as the preview shows it.
  const button = await screen.findByRole("button", {
    description: "Continues cli-tuis",
    name: "Continue all",
  });
  await act(async () => {
    fireEvent.pointerEnter(button);
  });

  expect([...card(AGENT).classList]).toEqual(
    expect.arrayContaining(classesOf(pickedStyles.picked)),
  );
  expect([...card(HUMAN).classList]).toEqual(
    expect.arrayContaining(classesOf(previewStyles.dimmed)),
  );
  expect([...card(HUMAN).classList]).not.toEqual(
    expect.arrayContaining(classesOf(pickedStyles.picked)),
  );
});
