// Spec page US4 key 3 and more 1, SC-004, Review focus 5, and the edge case "The agent is
// unavailable, or the spec is on the default branch": "Ask the agent" on any selection, a
// decision's part included, writes its quote into the Session tab's composer, the decision quoted
// from its own file and lines, a removed part from the default branch's; on the phone, it opens the
// session's page, and Back returns to the block. The plan page asks the same way.
import { readFileSync } from "node:fs";
import { act, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch, SPEC_FEATURE } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  click,
  fixture,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";

const PAGE = `/f/${SPEC_FEATURE}/spec.md`;
const SPEC = `specs/${SPEC_FEATURE}/spec.md`;
/** The block's pane, titled by its first line. */
const BLOCK = "Spec to review, revision 2, about 10 minutes.";
/** A point of the block's pane, the block asked about. */
const POINT = "Every saved due date is converted once";

const PLAN_FOLDER = "2026-10-13-plan-review";
const PLAN = `specs/${PLAN_FOLDER}/plan.md`;

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

/** The column's tab list. */
const tabList = () => screen.getByRole("tablist", { name: /^The (spec|plan)'s column$/ });

/** The open tab's name. */
const openTab = () =>
  ["Contents", "Review", "Session"].find((name) =>
    within(tabList()).queryByRole("tab", { name: new RegExp(`^${name}`), selected: true }),
  );

/** The session's composer, in the column's Session tab. */
function columnComposer() {
  const panel = screen.getByRole("tabpanel", { name: /^Session/ });
  return within(panel).findByRole("textbox", { name: "Message Claude Code" });
}

/** A block's toggle, by a phrase of its text. */
async function blockOf(phrase: string) {
  return waitFor(() => {
    const toggle = [...document.querySelectorAll<HTMLElement>("button[aria-pressed]")].find(
      (button) => {
        const label = document.getElementById(button.getAttribute("aria-labelledby") ?? "");
        return label?.textContent?.replaceAll(/\s+/g, " ").includes(phrase);
      },
    );
    expect(toggle).toBeTruthy();
    return toggle as HTMLElement;
  });
}

/** The spec page's feature, its spec waiting for review, drawn with the fake agent or without. */
async function openSpec(agent = true, repo = specRepo()) {
  await renderPage(PAGE, repo, { agent });
  await screen.findByRole("region", { name: BLOCK });
  return repo;
}

function specRepo() {
  const repo = fixtureRepo();
  addSpecFeature(repo);
  return repo;
}

/** Selects a rule of Task storage by its first words, and asks the agent about it. */
async function askAboutRule(words: RegExp) {
  const storage = await screen.findByRole("region", { name: "Task storage" });
  await click(within(storage).getByText(words));
  await click(await screen.findByRole("button", { name: "Ask the agent" }));
}

/** US4 key 3, SC-004: a part's words quoted as the ledger reads them, without markdown (R17). */
test("asking about a rule quotes the decision's file and lines", async () => {
  await openSpec();
  expect(within(tabList()).getByRole("tab", { name: "Session" })).toBeTruthy();

  await askAboutRule(/^Data MUST be stored in IndexedDB/);

  expect(openTab()).toBe("Session");
  expect(window.location.pathname).toBe(atRepo(PAGE));
  const box = await columnComposer();
  await waitFor(() =>
    expect(box.textContent).toBe(
      "About specs/decisions/task-storage.md, lines 15–16:\n" +
        "> Data MUST be stored in IndexedDB, only through src/store/: components never reach the" +
        " database themselves.\n\n",
    ),
  );
});

/** The page's draft is the page's, whatever the spec's status. */
test("the draft stays when the spec's status changes", async () => {
  const repo = await openSpec();
  await askAboutRule(/^Data MUST be stored in IndexedDB/);
  const quoted = (await columnComposer()).textContent;
  expect(quoted).toMatch(/^About specs\/decisions\/task-storage.md/);

  const spec = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`);
  commitOnBranch(repo, SPEC_FEATURE, {
    [SPEC]: spec.replace(/^status: .*$/m, "status: approved"),
  });
  await refreshUntil(() =>
    expect(within(tabList()).queryByRole("tab", { name: /^Review/ })).toBeNull(),
  );

  expect(openTab()).toBe("Session");
  expect((await columnComposer()).textContent).toBe(quoted);
});

/** Review focus 5 */
test("asking about a removed rule names it removed", async () => {
  await openSpec();

  await askAboutRule(/^Components MUST NOT call IndexedDB/);

  const box = await columnComposer();
  await waitFor(() =>
    expect(box.textContent).toBe(
      "About the removed rule of specs/decisions/task-storage.md, lines 16–17:\n" +
        "> Components MUST NOT call IndexedDB or the idb library directly.\n\n",
    ),
  );
});

/** US4 more 1 */
test("on the phone, asking opens the session's page, Back returns", async () => {
  atWidth(402);
  const repo = await openSpec();
  const lines = git(repo, "show", `${SPEC_FEATURE}:${SPEC}`).split("\n");
  const at = lines.findIndex((line) => line.includes(POINT));

  await click(await blockOf(POINT));
  const ask = await screen.findByRole("button", { name: "Ask the agent" });
  window.scrollTo(0, 120);
  await click(ask);

  expect(window.location.pathname).toBe(atRepo(`/f/${SPEC_FEATURE}/session`));
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() =>
    expect(box.textContent).toBe(`About ${SPEC}, line ${at + 1}:\n> ${lines[at]}\n\n`),
  );

  await act(async () => window.history.back());

  expect(window.location.pathname).toBe(atRepo(PAGE));
  expect(await blockOf(POINT)).toBeTruthy();
  expect(window.scrollY).toBe(120);
});

/** The edge case "The agent is unavailable" */
test("without an agent, no Session tab and no Ask", async () => {
  await openSpec(false);

  await click(await blockOf(POINT));

  await screen.findByLabelText("Comment text");
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
  expect(within(tabList()).queryByRole("tab", { name: "Session" })).toBeNull();
  expect(within(tabList()).getByRole("tab", { name: /^Review/ })).toBeTruthy();
});

/** The edge case "the spec is on the default branch" */
test("on the default branch, no Session tab and no Ask", async () => {
  const repo = specRepo();
  git(repo, "merge", "--quiet", "--ff-only", SPEC_FEATURE);
  git(repo, "branch", "--quiet", "-D", SPEC_FEATURE);
  await openSpec(true, repo);

  await click(await blockOf(POINT));

  await screen.findByLabelText("Comment text");
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
  expect(within(tabList()).queryByRole("tab", { name: "Session" })).toBeNull();
  expect(within(tabList()).getByRole("tab", { name: /^Review/ })).toBeTruthy();
});

/**
 * The plan-review feature, in `repo`, its plan the questions page's at `status`, drawn with the
 * fake agent.
 */
async function openPlan(status: string, repo = fixtureRepo()) {
  const plan = readFileSync(fixture("plan-page/plan.md"), "utf8").replace(
    /^status: .*$/m,
    `status: ${status}`,
  );
  commitOnBranch(repo, PLAN_FOLDER, { [PLAN]: plan });
  await renderPage(`/f/${PLAN_FOLDER}/plan.md`, repo, { agent: true });
  return plan;
}

/** The settled "The plan's session" */
test("the plan page asks about a step the same way", async () => {
  const plan = await openPlan("awaiting-human");
  const lines = plan.split("\n");
  const at = lines.findIndex((line) => line.includes("**Step 3: Run them to check they fail**"));

  await click(await blockOf("Step 3: Run them to check they fail"));
  await click(await screen.findByRole("button", { name: "Ask the agent" }));

  expect(openTab()).toBe("Session");
  const box = await columnComposer();
  await waitFor(() =>
    expect(box.textContent).toMatch(new RegExp(`^About ${PLAN}, lines? ${at + 1}`)),
  );
  expect(box.textContent).toContain(`> ${lines[at]}`);
});

/** The plan page's draft is the page's, whatever the plan's status. */
test("the plan's draft stays when its status changes", async () => {
  const repo = fixtureRepo();
  const plan = await openPlan("awaiting-human", repo);
  await click(await blockOf("Step 3: Run them to check they fail"));
  await click(await screen.findByRole("button", { name: "Ask the agent" }));
  const box = await columnComposer();
  await waitFor(() => expect(box.textContent).toMatch(/^About /));
  const quoted = box.textContent;

  commitOnBranch(repo, PLAN_FOLDER, { [PLAN]: plan.replace(/^status: .*$/m, "status: approved") });
  await refreshUntil(() =>
    expect(within(tabList()).queryByRole("tab", { name: /^Review/ })).toBeNull(),
  );

  expect(openTab()).toBe("Session");
  expect((await columnComposer()).textContent).toBe(quoted);
});

/** The settled "The plan's session" */
test("an approved plan has Session beside it", async () => {
  await openPlan("auto-approved");
  await screen.findByRole("region", { name: "Goal" });

  expect(within(tabList()).getByRole("tab", { name: "Session" })).toBeTruthy();
});

/** The mockup's phone status line: the plan's Session */
test("on the phone, an approved plan's status line opens the session", async () => {
  atWidth(402);
  await openPlan("auto-approved");

  await click(await screen.findByRole("button", { name: "Session" }));

  expect(window.location.pathname).toBe(atRepo(`/f/${PLAN_FOLDER}/session`));
});
