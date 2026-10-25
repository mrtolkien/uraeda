// The status line at the bottom of every page (US2): the hints of the keys that work on the page,
// then what needs the human and the running sessions.
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, atWidth, click, fixtureRepo, git, renderPage } from "./helpers.tsx";

/** The status line's text. */
async function statusLine() {
  return (await screen.findByRole("contentinfo", { name: "Status line" })).textContent ?? "";
}

test("on the priorities, the status line names the list's keys, but Escape with no pane open", async () => {
  await renderPage("/priorities");
  await waitFor(async () => {
    const text = await statusLine();
    expect(text).toContain("j k move");
    expect(text).toContain("⏎ open");
  });
  // R36: Escape closes nothing without a pane open.
  expect(await statusLine()).not.toContain("esc");
});

test("with a priority's overlay open at 1440 px, the status line names Escape, not the list's keys (R20)", async () => {
  atWidth(1440);
  await renderPage("/priorities/claude-code-runner-triggered-manually");
  await screen.findByRole("dialog", { name: "Priority" });
  await waitFor(async () => expect(await statusLine()).toContain("esc close"));
  // The overlay holds the keys: the list's own are off while it shows.
  expect(await statusLine()).not.toContain("j k move");
});

test("on a round at 1440 px, the status line names n and p", async () => {
  atWidth(1440);
  await renderPage("/f/2026-10-11-web-ui/clarifications-01.md");
  await waitFor(async () => expect(await statusLine()).toContain("n p unanswered"));
  expect(await statusLine()).toContain("[ fold");
});

test("with one feature waiting on the human, the status line reads 1 need you (US2 more 2)", async () => {
  // The fixture's other two features waiting on the human are gone: web-ui alone waits.
  const repo = fixtureRepo();
  git(repo, "branch", "--quiet", "-D", "2026-10-06-recurring-tasks", "2026-10-13-plan-review");
  await renderPage("/", repo);
  const nav = within(await screen.findByRole("navigation", { name: "Navigation" }));
  const needs = await nav.findByRole("group", { name: "Needs you" });
  expect(within(needs).getAllByRole("link")).toHaveLength(1);
  await waitFor(async () => expect(await statusLine()).toContain("1 need you"));
});

// Break: the hints of the page before stay once it is left.
test("the home shows no list hints, after the priorities showed theirs", async () => {
  await renderPage("/priorities");
  await waitFor(async () => expect(await statusLine()).toContain("j k move"));
  await click(
    within(screen.getByRole("navigation", { name: "Navigation" })).getByRole("link", {
      name: "Home",
    }),
  );
  expect(window.location.pathname).toBe(atRepo("/"));
  await waitFor(async () => expect(await statusLine()).not.toContain("j k move"));
  const text = await statusLine();
  expect(text).not.toContain("⏎ open");
  expect(text).not.toContain("esc close");
});

// Break: the decisions list naming Escape "close", where it takes the reader back to the
// constitution.
test("on a decision, Escape is named for the constitution", async () => {
  await renderPage("/decisions/ui-behaviour");
  await waitFor(async () => expect(await statusLine()).toContain("esc constitution"));
  expect(await statusLine()).not.toContain("esc close");
});

// Break: an Escape hint while the constitution shows, where Escape does nothing.
test("on the constitution, Escape has no hint", async () => {
  await renderPage("/decisions");
  await waitFor(async () => expect(await statusLine()).toContain("j k move"));
  const text = await statusLine();
  expect(text).not.toContain("esc constitution");
  expect(text).not.toContain("esc close");
});
