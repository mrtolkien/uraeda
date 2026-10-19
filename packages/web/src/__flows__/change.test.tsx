// Flow: a change, which is a small feature of its own. Its session has crumbs back to its page and
// links the round that waits; starting one opens its session with the agent, or with the workflow's
// message unsent without it; a start that answers after the human left opens nothing.
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { addChange } from "uraeda-binding/test-utils";
import { beforeEach, expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atWidth,
  click,
  DESKTOP,
  fixtureRepo,
  holding,
  quiet,
  startApp,
  type,
} from "./harness.tsx";
import { composer, composerText, resetAgent } from "./session-helpers.tsx";

const FOLDER = "2026-10-16-header-logo";

/** A question with its options and an empty or given answer. */
function question(title: string, answer = "") {
  return `## ${title}\n\nContext.\n\nWhy it matters: it decides the header.\n\n- **A (recommended). Yes.**\n  - [pro] simple.\n  - [con] more work.\n  - Why recommended: it is simple.\n- **B. No.**\n  - [pro] cheap.\n  - [con] harder.\n\n**Answer:**${answer ? ` ${answer}` : ""}\n`;
}

/** A round of questions, waiting on the human unless answered. */
function round(number: string, titles: Array<string>, answered = false) {
  const status = answered ? "answered" : "awaiting-human";
  const block = answered
    ? "> [!NOTE]\n>\n> Answered on 2026-10-16.\n>\n> - A point.\n\n"
    : `> [!IMPORTANT]\n>\n> ${titles.length} questions, about 5 minutes.\n>\n> - A point.\n\n`;
  const context =
    "### Goal\n\nThe [proposal](proposal.md).\n\n### Today\n\nToday.\n\n### Scope\n\nA scope.\n\n### Sources\n\n- The code.\n\n";
  const questions = titles
    .map((title, index) => question(`Q${index + 1}: ${title}`, answered ? "A" : ""))
    .join("\n");
  const settled =
    "\n## Settled without the human\n\n### Behaviour\n\n- **A point** settled.\n\n**Notes:**\n";
  return `---\nstatus: ${status}\n---\n\n# Clarifications, round ${number}: A home logo\n\n${block}## Context\n\n${context}${questions}${settled}`;
}

/** The repository with a change whose first round is answered and whose second waits. */
function repository() {
  const repo = fixtureRepo();
  addChange(repo, FOLDER, {
    "clarifications-01.md": round("01", ["Does the logo replace the name?"], true),
    "clarifications-02.md": round("02", ["Is it a link?", "Does it shrink?"]),
    "proposal.md": "# A home logo\n",
  });
  return repo;
}

const app = startApp({ agent: true, repo: repository });

beforeEach(() => resetAgent(app));

test("a change's session has crumbs back to its page, as a feature's does", async () => {
  await app.open(`/f/${FOLDER}/session`);

  const crumbs = within(await screen.findByRole("navigation", { name: "Breadcrumbs" }));
  await waitFor(() =>
    expect(
      crumbs
        .getAllByRole("link")
        .some((link) => link.getAttribute("href") === app.path(`/f/${FOLDER}`)),
    ).toBe(true),
  );
});

test("the session's column links the round that waits", async () => {
  atWidth(DESKTOP);
  await app.open(`/f/${FOLDER}/session`);
  const column = within(await screen.findByRole("complementary"));

  await waitFor(() =>
    expect(
      column
        .getAllByRole("link")
        .some(
          (link) => link.getAttribute("href") === app.path(`/f/${FOLDER}/clarifications-02.md`),
        ),
    ).toBe(true),
  );
});

/** Types a change's message, waits for its slug, and returns the button that starts it. */
async function describe(text: string) {
  await type(await composer(), text);
  const slug = screen.getByRole<HTMLInputElement>("textbox", { name: /slug/i });
  await waitFor(() => expect(slug.value).not.toBe(""));
  return { slug, start: screen.getByRole("button", { name: "Start the change" }) };
}

test("starting a change with the agent opens its session, where its agent works", async () => {
  app.agent.script([]);
  await app.open("/changes/new");

  const { start } = await describe("Centre the x in failure circles");
  await click(start);

  await waitFor(() =>
    expect(window.location.pathname).toMatch(/\/f\/\d{4}-\d\d-\d\d-[\w-]+\/session$/),
  );
  expect(window.location.search).toBe("");
  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
});

test("without the agent, the change's session opens with its message unsent", async () => {
  app.agent.installed = false;
  await app.sessions.check();
  await app.open("/changes/new");

  const { slug, start } = await describe("Widen the sidebar\n\nIt is too narrow to read.");
  await click(start);

  await waitFor(() => expect(window.location.pathname).toContain(`${slug.value}/session`));
  expect(window.location.search).toBe("?continue=start");
  await waitFor(() => expect(composerText()).not.toBe(""));
  expect(app.agent.sent).toHaveLength(0);
  app.agent.installed = true;
  await app.sessions.check();
});

test("a start that answers after the human left opens nothing, and shows progress until then", async () => {
  const held = holding("change.start");
  await app.open("/changes/new");
  const { start } = await describe("Dim the header on scroll");

  await click(start);
  await waitFor(() => expect(held.seen()).toBe(1));
  // Busy while the change starts.
  expect(start.getAttribute("aria-busy")).toBe("true");
  await act(async () => navigate(app.path("/priorities")));
  held.release();
  await quiet();

  expect(window.location.pathname).toBe(app.path("/priorities"));
  expect(window.location.search).toBe("");
  // The change started: its text and slug are gone, so it cannot be started twice.
  cleanup();
  await app.open("/changes/new");
  expect((await composer()).textContent).toBe("");
});
