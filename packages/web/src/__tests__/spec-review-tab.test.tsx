// Spec page US4 key 2 and Review focus 4: the Review tab's verdict is the page's one verdict. A
// hook's refusal of the tab's commit shows in the tab, and Try again, wherever it is pressed, starts
// the agent the verdict asked for.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atRepo, atWidth, click, fixtureRepo, git, renderPage } from "./helpers.tsx";

const RECURRING = "2026-10-06-recurring-tasks";
const SPEC = `/f/${RECURRING}/spec.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** A pre-commit hook that refuses every commit until `pass` is called. */
function refusingHook(repo: string) {
  const hooks = join(repo, ".git/hooks");
  git(repo, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho 'refused'\nexit 1\n", { mode: 0o755 });
  return { pass: () => writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n") };
}

/** The column's Review tab, opened. */
async function reviewTab() {
  const list = await screen.findByRole("tablist", { name: "The spec's column" });
  await click(within(list).getByRole("tab", { name: /^Review/ }));
  return screen.getByRole("tabpanel", { name: /^Review/ });
}

/** Review focus 4: one verdict, its Try again at the page's end starting the agent. */
test("Try again at the end after the tab's refused approval starts the agent", async () => {
  const repo = fixtureRepo();
  const hook = refusingHook(repo);
  const { agent } = await renderPage(SPEC, repo, { agent: true });

  const tab = await reviewTab();
  await click(within(tab).getByRole("button", { name: "Approve and start the agent" }));
  await screen.findAllByRole("button", { name: "Try again" });
  hook.pass();
  const end = screen
    .getAllByRole("button", { name: "Try again" })
    .find((button) => !tab.contains(button));
  await click(end!);

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}/session`)));
  expect(window.location.search).toBe("?continue=approval&file=spec.md");
  expect(git(repo, "log", "-1", "--format=%s", RECURRING).trim()).toBe(
    "spec(recurring-tasks): approve",
  );
  expect(agent.sent).toHaveLength(0);
});

/** Review focus 4: the tab's refused verdict shows in the tab, its Try again starting the agent. */
test("the tab shows its refused verdict, and its Try again starts the agent", async () => {
  const repo = fixtureRepo();
  const hook = refusingHook(repo);
  await renderPage(SPEC, repo, { agent: true });

  const tab = await reviewTab();
  await click(within(tab).getByRole("button", { name: "Approve and start the agent" }));
  expect(
    await within(tab).findByText(
      "The pre-commit hook refused the commit. Your review is saved, not committed.",
    ),
  ).toBeTruthy();
  hook.pass();
  await click(within(tab).getByRole("button", { name: "Try again" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${RECURRING}/session`)));
  expect(window.location.search).toBe("?continue=approval&file=spec.md");
});

/** Review C2, in the tab: no verdict on a spec whose file differs from what the page shows. */
test("the tab says the spec has changes not committed", async () => {
  const repo = fixtureRepo();
  const worktree = join(repo, ".worktrees", RECURRING);
  git(repo, "worktree", "add", "--quiet", worktree, RECURRING);
  const path = join(worktree, "specs", RECURRING, "spec.md");
  writeFileSync(path, `${readFileSync(path, "utf8")}\nUnfinished edit.\n`);
  await renderPage(SPEC, repo);

  const tab = await reviewTab();
  expect(
    await within(tab).findByText(
      "spec.md has changes not committed: the review is of the committed version. Commit or discard them first.",
    ),
  ).toBeTruthy();
});
