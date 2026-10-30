// The New page's start of a feature: the Feature card's text, named in one dialog with its slug and
// its research effort, starts the feature and opens its session, the discovery's message unsent.
// The text stays in the composer until the start lands.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { unsavedKey } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import {
  atRepo,
  click,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  quiet,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-16");

const TEXT = "Dark mode: follow the system theme";
const FOLDER = "2026-10-16-dark-mode";

/** A pre-commit hook in `repo` that holds every commit until `release` is called. */
function heldCommits(repo: string) {
  const gate = join(repo, ".git/gate");
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(join(repo, ".git/hooks"), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\nwhile [ ! -e "${gate}" ]; do sleep 0.02; done\n`, {
    mode: 0o755,
  });
  return { release: () => writeFileSync(gate, "") };
}

/** The address now, in the repository's own path. */
const address = () => `${window.location.pathname}${window.location.search}`;

/** Sends the Feature card's text: the dialog it opens, once its slug is proposed. */
async function sendFeature() {
  await click(await screen.findByRole("button", { name: "Start the feature" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the feature" });
  await waitFor(() =>
    expect((within(dialog).getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe(
      "dark-mode",
    ),
  );
  return dialog;
}

test("a feature typed in the Feature card starts into its session", async () => {
  const repo = fixtureRepo();
  const hook = heldCommits(repo);
  const fake = await fakeAgent();
  await renderPage("/new?kind=feature", repo, {
    agent: fake,
    fetch: serverFetch(repo, fake.sessions),
  });
  await type(await screen.findByRole("textbox", { name: "Write Proposal" }), TEXT);

  const dialog = await sendFeature();
  expect(within(dialog).getByRole("radio", { name: "High" }).getAttribute("aria-checked")).toBe(
    "true",
  );
  await click(within(dialog).getByRole("radio", { name: "Low" }));
  await click(within(dialog).getByRole("button", { name: "Start the feature" }));

  await waitFor(() => expect(address().split("?")[0]).toBe(atRepo(sessionPath(FOLDER))));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
      `specs/${FOLDER}/`,
    ),
  );
  // While its commit is held, the New page still holds the text.
  await act(async () => navigate(atRepo("/new?kind=feature")));
  const held = await screen.findByRole("textbox", { name: "Write Proposal" });
  await quiet();
  expect(held.textContent).toBe(TEXT);
  // Row: an image pasted meanwhile is the human's newer draft: the landing leaves it.
  const png = new File([readFileSync(fixture("images/phone.png"))], "later.png", {
    type: "image/png",
  });
  await act(async () => {
    fireEvent.paste(held, { clipboardData: { files: [png], getData: () => "" } });
  });
  await screen.findByRole("button", { name: /^Remove/ });
  hook.release();
  // The start lands, its commit on main.
  await waitFor(
    () =>
      expect(git(repo, "ls-tree", "--name-only", "main", `specs/${FOLDER}/`)).toContain(
        "proposal.md",
      ),
    { timeout: 10_000 },
  );
  expect(git(repo, "show", `main:specs/${FOLDER}/proposal.md`)).toBe(
    `---\ndiscovery: low\n---\n\n# ${TEXT}\n`,
  );
  await quiet();
  // Row: once its session page saw it land, the New page's composer is empty.
  await act(async () => navigate(atRepo(sessionPath(FOLDER))));
  await waitFor(
    () => expect(window.localStorage.getItem(unsavedKey(repo, "new-draft"))).toBeNull(),
    {
      timeout: 10_000,
    },
  );
  await act(async () => navigate(atRepo("/new?kind=feature")));
  const box = await screen.findByRole("textbox", { name: "Write Proposal" });
  await waitFor(() => expect(box.textContent).toBe(""));
  expect(screen.getByRole("button", { name: /^Remove/ })).toBeTruthy();
  // Row: a second start of the slug is refused in the dialog, which stays open, the text kept.
  await type(box, TEXT);
  const again = await sendFeature();
  await click(within(again).getByRole("button", { name: "Start the feature" }));
  await within(again).findByText("A feature named dark-mode exists already.");
  expect(screen.getByRole("dialog", { name: "Name the feature" })).toBe(again);
  expect(box.textContent).toBe(TEXT);
});
