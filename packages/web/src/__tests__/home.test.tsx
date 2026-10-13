import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { git, read, refreshUntil, renderPage } from "./helpers.tsx";
import { temporaryFolder } from "uraeda-binding/test-utils";

/** The page's own content, without the navigation. */
async function main() {
  return within(await screen.findByRole("main"));
}

/** The home screen's row holding a text. */
async function row(text: string) {
  const page = await main();
  await page.findByText(text);
  return page
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(text) !== null) as HTMLElement;
}

/** US1.1 */
test("lists what waits on the human, by action, with the block's line", async () => {
  await renderPage();

  expect(await (await main()).findByText("Waiting on you")).toBeTruthy();
  const web = await row("Web UI for the workflow files");
  expect(within(web).getByText("Answer")).toBeTruthy();
  expect(within(web).getByText("11 questions on the web UI, about 35 minutes.")).toBeTruthy();
  const spec = await row("Recurring tasks");
  expect(within(spec).getByText("Review")).toBeTruthy();
});

/** US1.2 */
test("lists what agents work on, with their step", async () => {
  await renderPage();

  expect(await (await main()).findByText("Agents at work")).toBeTruthy();
  expect(within(await row("CLI TUIs")).getByText("Plan")).toBeTruthy();
});

/** US1.3 */
test("lists merged features as done", async () => {
  await renderPage();

  expect(within(await row("CLI core features")).getByText("Merged")).toBeTruthy();
  expect(within(await row("Stack decision")).getByText("Merged")).toBeTruthy();
});

/** US1.4, and US3: each Now and Next line not started opens its task view. */
test("lists Now and Next lines not started, each opening its task view", async () => {
  await renderPage();

  const page = await main();
  const runner = await page.findByRole("link", {
    name: /Claude Code runner \(triggered manually\)/,
  });
  expect(runner.getAttribute("href")).toBe("/priorities/claude-code-runner-triggered-manually");
  const listener = page.getByRole("link", { name: /Git listener process/ });
  expect(listener.getAttribute("href")).toBe("/priorities/git-listener");
  expect(page.queryByRole("button", { name: "Draft" })).toBeNull();
  expect(screen.queryByText("Nix + Docker based execution environments")).toBeNull();
});

test("says how to set Uraeda up in a repository without specs/", async () => {
  const repo = temporaryFolder("uraeda-bare");
  git(repo, "init", "--quiet", "--initial-branch", "main");
  writeFileSync(join(repo, "README.md"), "# Bare\n");

  await renderPage("/", repo);

  expect(
    await screen.findByText(`No specs/ folder in ${repo}. Set Uraeda up with ura init.`),
  ).toBeTruthy();
});

test("says when the server cannot be reached, with a way to try again", async () => {
  await renderPage("/", undefined, {
    fetch: () => Promise.reject(new TypeError("Failed to fetch")),
  });

  expect(await screen.findByText("Could not reach the Uraeda server.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

/** US6.6 */
test("reads the page again when it comes back to the foreground", async () => {
  const { repo } = await renderPage();
  const page = await main();
  await page.findByRole("link", { name: /Git listener process/ });
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("Git listener process", "Git watcher process"),
  );

  // No live update reaches these tests: the page shows the change only by reading it again.
  await refreshUntil(() =>
    expect(page.getByRole("link", { name: /Git watcher process/ })).toBeTruthy(),
  );
  expect(page.queryByRole("link", { name: /Git listener process/ })).toBeNull();
});

test("opens a feature from its row", async () => {
  await renderPage();

  fireEvent.click(await (await main()).findByText("CLI TUIs"));

  expect(window.location.pathname).toBe("/f/2026-10-12-cli-tuis");
});
