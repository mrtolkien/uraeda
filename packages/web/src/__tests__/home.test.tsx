import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { git, renderPage, sent } from "./helpers.tsx";

/** The page's own content, without the navigation. */
async function main() {
  return within(await screen.findByRole("main"));
}

/** The home screen's row holding a text. */
async function row(text: string) {
  const found = await (await main()).findByText(text);
  return found.closest(".row") as HTMLElement;
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

/** US1.4 */
test("lists Now and Next lines not started, with Draft or Start", async () => {
  await renderPage();

  const runner = await row("Claude Code runner (triggered manually)");
  expect(within(runner).getByRole("button", { name: "Draft" })).toBeTruthy();
  const listener = await row("Git listener process");
  expect(within(listener).getByRole("button", { name: "Start" })).toBeTruthy();
  expect(screen.queryByText("Nix + Docker based execution environments")).toBeNull();
});

test("says how to set Uraeda up in a repository without specs/", async () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), "uraeda-bare-")));
  git(repo, "init", "--quiet", "--initial-branch", "main");
  writeFileSync(join(repo, "README.md"), "# Bare\n");

  await renderPage("/", repo);

  expect(
    await screen.findByText(`No specs/ folder in ${repo}. Set Uraeda up with ura init.`),
  ).toBeTruthy();
});

test("says when the server cannot be reached, with a way to try again", async () => {
  await renderPage("/", undefined, () => Promise.reject(new TypeError("Failed to fetch")));

  expect(await screen.findByText("Could not reach the Uraeda server.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

/** US6.6 */
test("reads the page again when it comes back to the foreground", async () => {
  await renderPage();
  await (await main()).findByText("Waiting on you");
  const before = sent.length;

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  expect(sent.length).toBeGreaterThan(before);
});

test("opens a feature from its row", async () => {
  await renderPage();

  fireEvent.click(await (await main()).findByText("CLI TUIs"));

  expect(window.location.pathname).toBe("/f/2026-10-12-cli-tuis");
});
