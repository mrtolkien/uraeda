// US3 3 and its more scenario 2: a commit a hook refuses after the page moved on is undone, its
// hook's output where it happened, at the verdict, and in the toast, which opens that place; a
// message sent while it landed goes back in the composer.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigateHere } from "../routes.tsx";
import { RETURNED } from "../session/ReturnedMessages.tsx";
import { REFUSED_ID } from "../writes/useWriteQueue.ts";
import {
  click,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-06-recurring-tasks";
const OUTPUT = "spec.md:12: a sentence of 31 words";

today("2026-10-11");

/** A pre-commit hook in `repo` that refuses every commit, printing `OUTPUT`. */
function refusingHook(repo: string) {
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\necho "${OUTPUT}"\nexit 1\n`, { mode: 0o755 });
}

/** A pre-commit hook in `repo` that holds each commit until `gate` exists, then refuses it. */
function heldRefusingHook(repo: string, gate: string) {
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\nwhile [ ! -e "${gate}" ]; do sleep 0.02; done\necho "${OUTPUT}"\nexit 1\n`,
    { mode: 0o755 },
  );
}

/** The toast of the git writes still landing or refused. */
const toast = () => screen.getByRole("status", { name: "Git writes" });

/** The hook's refusal where it happened, on the page. */
const refusedHere = () => document.getElementById(REFUSED_ID);

test("a refused commit shows its output on its file and in the toast", async () => {
  const repo = fixtureRepo();
  refusingHook(repo);
  await renderPage(`/f/${FOLDER}/spec.md`, repo);

  await click(await screen.findByRole("button", { name: "Approve" }));

  // Live updates do not reach these tests: the page reads the queue again, as on coming back.
  await refreshUntil(() => {
    expect(within(toast()).getByText("Approving the spec of Recurring tasks")).toBeTruthy();
    expect(refusedHere()?.textContent).toContain(OUTPUT);
  });
  expect(toast().textContent).toContain(OUTPUT);
  expect(within(toast()).getByRole("button", { name: "Dismiss" })).toBeTruthy();
  // The approval is undone: the spec awaits its verdict again.
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();

  await act(async () => navigateHere("/"));
  expect(refusedHere()).toBeNull();
  await click(within(toast()).getByRole("button", { name: "Open" }));

  expect(window.location.pathname).toMatch(new RegExp(`/f/${FOLDER}/spec\\.md$`));
  expect(window.location.hash).toBe(`#${REFUSED_ID}`);
  await waitFor(() => expect(refusedHere()?.textContent).toContain(OUTPUT));
  // Opened, it leaves the toast, and stays where it happened until dismissed there.
  expect(screen.queryByRole("status", { name: "Git writes" })).toBeNull();
});

// Break: the session's composer not taking the refused write's `queued` back.
test("a message sent while its feature's commit lands goes back in the composer once refused", async () => {
  const repo = fixtureRepo();
  const gate = join(repo, ".git/hook-gate");
  heldRefusingHook(repo, gate);
  await renderPage(`/f/${FOLDER}/spec.md`, repo, { agent: await fakeAgent() });
  await click(await screen.findByRole("button", { name: "Approve" }));

  await act(async () => navigateHere(`/f/${FOLDER}/session`));
  const field = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(field, "Go on with the plan");
  await act(async () => {
    fireEvent.keyDown(field, { ctrlKey: true, key: "Enter" });
  });
  await waitFor(() => expect(field.textContent).toBe(""));
  expect(existsSync(gate)).toBe(false);
  writeFileSync(gate, "");

  // The server kept the message for the approval's commit, which the hook refused: it is back.
  await refreshUntil(() => {
    const back = screen.getByRole("textbox", { name: "Message Claude Code" });
    expect(back.textContent).toContain("Go on with the plan");
  });
  // Shown under the composer, not counting the screen reader's announcement.
  expect(
    screen.getByText(RETURNED, { ignore: "script, style, [data-astryx-live-region]" }),
  ).toBeTruthy();
});
