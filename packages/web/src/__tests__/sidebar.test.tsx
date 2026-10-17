// The redesigned sidebar's stories: the hierarchy's sections and their counts, each item as a card
// with its step, its status, its task, its background command, and the lines its branch changed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { addChange, addPlan, commitOnBranch, ELEVEN, fixture } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { fakeAgent, fixtureRepo, refreshUntil, renderPage } from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The side navigation, as drawn on a wide screen. */
function nav() {
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

/** Waits for the side navigation, and returns it. */
async function findNav() {
  return within(await screen.findByRole("navigation", { name: "Side navigation" }));
}

/** A card's link, by its name's start. */
function card(name: string) {
  return nav().getByRole("link", { name: new RegExp(`^${name}, `) });
}

/** US2.1, C1 */
test("the sidebar reads in the flow's order, the inbox's and Now's counts, and no drafts", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await (await findNav()).findByRole("group", { name: "Features" });

  const links = nav()
    .getAllByRole("link")
    .map((link) => link.getAttribute("aria-label") ?? link.textContent ?? "");
  const at = (start: string) => links.findIndex((name) => name.startsWith(start));
  expect(at("Home")).toBe(0);
  expect(at("Home")).toBeLessThan(at("web-ui, "));
  expect(at("web-ui, ")).toBeLessThan(at("Inbox"));
  expect(at("Inbox")).toBeLessThan(at("Priorities"));
  expect(at("Priorities")).toBeLessThan(at("＋New change"));
  expect(at("＋New change")).toBeLessThan(at("cli-tuis, "));
  expect(at("cli-tuis, ")).toBeLessThan(at("＋New chat"));
  // The inbox's count, drawn once its own read ends: read again until it is.
  await waitFor(() =>
    expect(nav().getByRole("link", { name: /^Inbox/ }).textContent).toContain("10"),
  );
  // The count of the entries under Now (C1), seen beside the row's label: the fixture's four are
  // started, and started entries are left out, as on the priorities page.
  expect(links[at("Priorities")]).toBe("Priorities0");
  expect(nav().queryByText(/Drafts?/)).toBeNull();
});

/** US2.2 */
test("a feature waiting on its answers is a card under Needs you only, by its step", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^web-ui, / });

  expect(link.getAttribute("aria-label")).toBe(
    "web-ui, Web UI for the workflow files, Questions to answer, Needs you",
  );
  expect(nav().getAllByRole("link", { name: /^web-ui, / })).toHaveLength(1);
});

/** US2.4 */
test("a card counts the lines its branch changed outside its folder", async () => {
  const repo = fixtureRepo();
  addPlan(repo, CLI, ELEVEN);
  commitOnBranch(repo, CLI, { "src/cli.ts": "one\ntwo\nthree\n" });
  await renderPage("/", repo, { agent: await fakeAgent() });

  await refreshUntil(() =>
    expect(card("cli-tuis").getAttribute("aria-label")).toContain("3 lines added, 0 removed"),
  );
  expect(nav().getByText("+3")).toBeTruthy();
  expect(nav().getByText("−0")).toBeTruthy();
});

/** US2.5 */
test("a change under Needs you says it is a change", async () => {
  const repo = fixtureRepo();
  const round = readFileSync(
    join(
      fixture("repo"),
      "branches",
      "2026-10-11-web-ui/specs/2026-10-11-web-ui/clarifications-01.md",
    ),
    "utf8",
  );
  addChange(repo, "2026-10-15-flaky-tests", {
    "clarifications-01.md": round,
    "proposal.md": "# Flaky tests\n\nThe session tests fail one run in ten.\n",
  });
  await renderPage("/", repo, { agent: await fakeAgent() });

  const group = within(await (await findNav()).findByRole("group", { name: "Needs you" }));
  const link = await group.findByRole("link", { name: /^flaky-tests, / });
  expect(link.getAttribute("aria-label")).toContain(", change, ");
  expect(group.getByText("Change")).toBeTruthy();
});

/** US1.9 */
test("a card shows its run's background command", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  await fake.sessions.send(repo, session.id, { text: "Review it" });
  fake.adapter.emit({ id: fake.adapter.sent[0].id, type: "accepted" });
  fake.adapter.emit({ tasks: [{ kind: "command", tool: "bash-1" }], type: "background" });
  await renderPage("/", repo, { agent: fake });

  await refreshUntil(() =>
    expect(card("cli-tuis").getAttribute("aria-label")).toContain(
      "Working, background command running",
    ),
  );
});

/** C4: the "…" is always there, so a card keeps its size under the pointer. */
test("every card has its settings button, without a pointer", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await (await findNav()).findByRole("group", { name: "Features" });

  for (const slug of ["recurring-tasks", "web-ui", "plan-review", "cli-tuis"]) {
    expect(nav().getByRole("button", { name: `Settings of ${slug}` })).toBeTruthy();
  }
});
