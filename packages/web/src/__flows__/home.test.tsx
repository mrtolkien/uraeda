// Flow: the home page. A feature at a gate is listed with the action the human takes, and the
// action reaches the round or the spec; agents' work and the priorities are listed apart; only a
// problem is a fix; the page survives a server that fails. No assertion reads a heading's words.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, within } from "@testing-library/react";
import { addPlan, commitOnBranch, ELEVEN, expectLogged, fixture } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, git, read, refreshUntil, startApp } from "./harness.tsx";

const WEB_UI = "2026-10-11-web-ui";
const RECURRING = "2026-10-06-recurring-tasks";
const TUIS = "2026-10-12-cli-tuis";
const PLAN_REVIEW = "2026-10-13-plan-review";

/**
 * The fixture repository where the CLI TUIs' spec cannot be read, a problem that stops its
 * workflow, and the plan review's plan has a format slip, a note that stops nothing.
 */
function repository() {
  const repo = fixtureRepo();
  const spec = `specs/${TUIS}/spec.md`;
  const text = readFileSync(fixture(`repo/branches/${TUIS}/${spec}`), "utf8");
  commitOnBranch(repo, TUIS, { [spec]: text.replace("status: approved", "status: aproved") });
  // The tests' plan has no "## Waves": `ura check` finds the section missing.
  addPlan(repo, PLAN_REVIEW, ELEVEN);
  git(repo, "switch", "--quiet", "main");
  return repo;
}

/** A server that cannot be reached. */
const down: typeof globalThis.fetch = () => Promise.reject(new TypeError("Failed to fetch"));

const app = startApp({ repo: repository });

/** Every link of the page to an address. */
function linksTo(path: string) {
  return screen.queryAllByRole("link").filter((link) => link.getAttribute("href") === path);
}

/** The card of the page holding a link to an address: the page's own sections are regions. */
function cardOf(path: string) {
  const card = screen.queryAllByRole("region").find((region) =>
    within(region)
      .queryAllByRole("link")
      .some((l) => l.getAttribute("href") === path),
  );
  if (!card) {
    throw new Error(`no card with a link to ${path}`);
  }
  return card;
}

/** US1 1 and 2: the feature at a gate, its action, and where the action goes. */
test("a feature at a gate is listed with its Answer action, which opens the round", async () => {
  await app.open("/");
  const round = app.path(`/f/${WEB_UI}/clarifications-01.md`);
  await screen.findAllByRole("link");

  const [row] = linksTo(round).map((link) => within(link.closest("li") as HTMLElement));
  expect(row, "the feature is listed with a link to its round").toBeTruthy();
  expect(row.getByText("Answer")).toBeTruthy();

  await click(linksTo(round)[0]);

  expect(window.location.pathname).toBe(round);
  // The round asks its questions: each option is a checkbox the human ticks.
  expect((await screen.findAllByRole("checkbox")).length).toBeGreaterThan(0);
});

test("a spec waiting for review is listed with the action that opens the spec", async () => {
  await app.open("/");
  const spec = app.path(`/f/${RECURRING}/spec.md`);
  await screen.findAllByRole("link");

  const [row] = linksTo(spec).map((link) => within(link.closest("li") as HTMLElement));
  expect(row.getByText("Review")).toBeTruthy();
  await click(linksTo(spec)[0]);

  expect(window.location.pathname).toBe(spec);
});

test("what waits on the human and what agents do are listed apart, a problem as a fix", async () => {
  await app.open("/");
  await screen.findAllByRole("link");
  const round = cardOf(app.path(`/f/${WEB_UI}/clarifications-01.md`));

  // The spec that cannot be read blocks its workflow: it is the human's, with a Fix action.
  const broken = within(round).getAllByRole("link", { name: /CLI TUIs/ })[0];
  expect(within(broken.closest("li") as HTMLElement).getByText("Fix")).toBeTruthy();
  expect(broken.getAttribute("href")).toBe(app.path(`/f/${TUIS}`));
  // A plan with a format slip is only a note: the feature stays with the agent, with no Fix.
  const agents = cardOf(app.path(`/f/${PLAN_REVIEW}`));
  expect(agents).not.toBe(round);
  expect(within(agents).queryByText("Fix")).toBeNull();
  expect(within(round).queryAllByRole("link", { name: /Plan review/ })).toHaveLength(0);
});

test("the priorities card opens an entry's feature, and keeps the section chosen across a reload", async () => {
  await app.open("/");
  await screen.findAllByRole("link");
  const card = within(cardOf(app.path("/priorities")));

  // A started entry of Now opens its feature.
  expect(
    card.getAllByRole("link").some((l) => l.getAttribute("href") === app.path(`/f/${WEB_UI}`)),
  ).toBe(true);
  const [now, next] = card.getAllByRole("radio");
  expect(now.getAttribute("aria-checked")).toBe("true");

  await click(next);
  expect(next.getAttribute("aria-checked")).toBe("true");
  // An entry of Next, which no feature runs, opens its pane on the priorities page.
  expect(
    card
      .getAllByRole("link")
      .some((l) => l.getAttribute("href")?.startsWith(app.path("/priorities/"))),
  ).toBe(true);

  await app.open("/", { reload: true });
  await screen.findAllByRole("link");
  const [, reopened] = within(cardOf(app.path("/priorities"))).getAllByRole("radio");
  expect(reopened.getAttribute("aria-checked")).toBe("true");
});

test("the inbox, the priorities, and the decisions are one tap away", async () => {
  await app.open("/");
  await screen.findAllByRole("link");

  for (const target of ["/inbox", "/priorities", "/decisions"]) {
    expect(linksTo(app.path(target)).length, `a link to ${target}`).toBeGreaterThan(0);
  }
});

test("the page reads the server again when it comes back to the foreground", async () => {
  await app.open("/");
  await screen.findAllByRole("link");
  const feature = app.path(`/f/${PLAN_REVIEW}`);
  const card = () => within(cardOf(app.path("/priorities")));
  const opens = () =>
    card()
      .queryAllByRole("link")
      .filter((l) => l.getAttribute("href") === feature);
  expect(opens().length).toBeGreaterThan(0);

  // The entry leaves Now behind the page's back.
  const lines = read(app.repo).split("\n");
  writeFileSync(
    join(app.repo, "specs/PRIORITIES.md"),
    lines.filter((line) => !line.includes(PLAN_REVIEW)).join("\n"),
  );

  // No live update reaches these flows: the page shows the change by reading again.
  await refreshUntil(() => expect(opens()).toHaveLength(0));
});

test("a server that cannot be reached says so, with a way to try again; a reload recovers", async () => {
  const logged = expectLogged(console, "error", /Failed to fetch|The above error occurred/s);
  await app.open("/", { fetch: down });

  const retry = await screen.findByRole("button", { name: "Try again" });
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(logged).toHaveBeenCalled();
  // Trying again against a server still down says so again, and offers it again.
  await click(retry);
  expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();

  await app.open("/", { reload: true });
  expect((await screen.findAllByRole("link")).length).toBeGreaterThan(0);
});
