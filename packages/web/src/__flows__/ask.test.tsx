// Flow: asking the agent about what the human reads. With an agent installed, selected lines of a
// spec, or a question of a round, open the feature's session with the quoted text in the composer,
// unsent. Without an agent the review flow's selection offers no such action.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, startApp } from "./harness.tsx";
import { addRound } from "./rounds.ts";

const SPEC = "2026-10-24-ask-spec";
const ROUND = "2026-10-24-ask-round";
const STORY = "us2-complete-a-repeating-task-p1";

const app = startApp({
  agent: true,
  repo: () => {
    const repo = fixtureRepo();
    addSpecFeature(repo, { folder: SPEC, revision: 1 });
    addRound(repo, ROUND);
    return repo;
  },
});

/** The composer's text: the one editable text of the session page. */
function composer() {
  return screen
    .getAllByRole("textbox")
    .find((box) => box.getAttribute("contenteditable") === "true") as HTMLElement;
}

test("two lines selected on a spec open the session with both quoted, unsent", async () => {
  await app.open(`/f/${SPEC}/spec.md`);
  const story = await waitFor(() => {
    const found = document.getElementById(STORY);
    expect(found).toBeTruthy();
    return found as HTMLElement;
  });
  const [first, second] = within(story)
    .getAllByRole("button")
    .filter((block) => block.hasAttribute("aria-pressed"));
  await click(first);
  await click(second);

  await click(await screen.findByRole("button", { name: /ask the agent/i }));

  expect(window.location.pathname).toBe(app.path(`/f/${SPEC}/session`));
  const lines = git(app.repo, "show", `${SPEC}:specs/${SPEC}/spec.md`).split("\n");
  await waitFor(() => {
    const text = composer().textContent ?? "";
    // The quote holds the lines the human selected, as the file has them, and nothing is sent.
    expect(text).toContain(`specs/${SPEC}/spec.md`);
    const quoted = text.split("\n").filter((line) => line.startsWith("> "));
    expect(quoted.length).toBeGreaterThan(0);
    for (const line of quoted) {
      expect(lines).toContain(line.slice(2));
    }
  });
  expect(app.agent.sent).toHaveLength(0);
});

test("a question of a round can be asked about, and the session opens with its title quoted", async () => {
  cleanup();
  await app.open(`/f/${ROUND}/clarifications-01.md`);
  const question = await waitFor(() => {
    const found = document.getElementById("Q2");
    expect(found).toBeTruthy();
    return found as HTMLElement;
  });

  await click(
    within(question)
      .getAllByRole("button")
      .find((button) => /ask/i.test(button.textContent ?? ""))!,
  );

  expect(window.location.pathname).toBe(app.path(`/f/${ROUND}/session`));
  await waitFor(() => expect(composer().textContent ?? "").toContain("Q2"));
  expect(app.agent.sent).toHaveLength(0);
});
