// Spec page US4 key 2 and Review focus 4: the Review tab's verdict is the page's one verdict. A
// hook's refusal of the tab's commit shows in the tab, and Try again, wherever it is pressed, starts
// the agent the verdict asked for.
import { writeFileSync } from "node:fs";
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
