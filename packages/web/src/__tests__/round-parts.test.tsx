// US1 key 1 and more scenarios 1 and 2, US4 key 1 and more scenarios 1 to 3: the round's parts in
// titled panes, on the merge-chats round. Its block is a pane titled by its first line, the
// verdict's badge before its sentence; Goal, Today, Scope, and Sources are panes, Today folded;
// "Check these" is a pane after Sources, its points with their comments; Under the hood is folded to
// its count.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { PointActions } from "../RoundParts.tsx";
import { click, fixture, fixtureRepo, git, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const MERGE_CHATS = readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8");
const BLOCK = "7 questions and 1 follow-up, about 20 minutes.";
const VERDICT = "a chat cannot become a change today";
const TODAY = /^A change becomes a feature through a round of questions\./;
const LIGHT_FLOW = "The light flow stays.";
const PROPOSAL = "The change's proposal";

today("2026-10-24");

/** A repository whose web-ui round, in the feature's worktree, is the merge-chats round, edited. */
function round(edit: (text: string) => string = (text) => text) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  writeFileSync(join(repo, ".worktrees", FOLDER, ROUND), edit(MERGE_CHATS));
  return repo;
}

/** A pane of the round, by its title. */
const pane = (title: string) => screen.getByRole("region", { name: title });

/** Whether `first` comes before `second` in the page. */
function before(first: Node, second: Node) {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** US1 key 1 */
test("the block is a pane titled by its count, with its badge", async () => {
  await renderPage(PAGE, round());

  const block = await screen.findByRole("region", { name: BLOCK });
  const badge = within(block).getByText("With changes");
  const sentence = within(block).getByText(VERDICT, { exact: false });
  expect(before(badge, sentence)).toBe(true);
  // The badge says the verdict: its sentence starts after the phrase, which the page never shows.
  expect(block.textContent).not.toContain("worth building");
  expect(block.textContent).not.toContain("Verdict:");
  expect(within(block).getByText(/^Who may upgrade lasts beyond this feature\./)).toBeTruthy();
  expect(block.id).toBe("summary");
});

/** US1 key 1, as the core reads the verdict: its kind, never the text's words. */
test("the badge reads the verdict's kind", async () => {
  await renderPage(
    PAGE,
    round((text) =>
      text.replace("Verdict: worth building, with changes:", "Verdict: not as proposed:"),
    ),
  );

  const block = await screen.findByRole("region", { name: BLOCK });
  expect(within(block).getByText("Not as proposed")).toBeTruthy();
  expect(within(block).queryByText("With changes")).toBeNull();
});

/** US1 more 1 */
test("Today is folded, and a link to it unfolds it", async () => {
  await renderPage(PAGE, round());
  await screen.findByRole("region", { name: BLOCK });

  for (const [title, id] of [
    ["Goal", "goal"],
    ["Scope", "scope"],
    ["Sources", "sources"],
  ]) {
    expect(pane(title!).id).toBe(id);
  }
  const fold = within(pane("Today")).getByRole("button", { name: "Today" });
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText(TODAY)).toBeNull();

  await click(fold);

  expect(screen.getByText(TODAY)).toBeTruthy();
  expect(pane("Today").id).toBe("today");
});

/** US1 more 2 */
test("a link to #today opens Today", async () => {
  await renderPage(`${PAGE}#today`, round());
  await screen.findByRole("region", { name: BLOCK });

  await waitFor(() => expect(screen.getByText(TODAY)).toBeTruthy());
  const fold = within(pane("Today")).getByRole("button", { name: "Today" });
  expect(fold.getAttribute("aria-expanded")).toBe("true");
});

/** US4 key 1, more 1, and review focus 3 */
test("Check these comes after Sources, with Ask and its comments", async () => {
  const comment = "Say so in the PR.";
  await renderPage(
    PAGE,
    round((text) => text.replace("**Notes:**", `**Notes:**\n\n- **${LIGHT_FLOW}**: ${comment}`)),
  );
  await screen.findByRole("region", { name: BLOCK });

  const check = pane("Check these");
  expect(check.id).toBe("check-these");
  expect(within(check).getByRole("heading").textContent).toContain("· 2");
  expect(
    within(check).getByText("Settled without you. Object here before answering, if one is wrong."),
  ).toBeTruthy();
  expect(before(pane("Sources"), check)).toBe(true);
  for (const subject of [PROPOSAL, LIGHT_FLOW]) {
    expect(within(check).getByRole("button", { name: `Comment on "${subject}"` })).toBeTruthy();
  }
  // The comment on a point to check, whose subject no other point has, shows under it.
  const shown = within(check).getByRole("group", { name: `Your comment on "${LIGHT_FLOW}"` });
  expect(within(shown).getByText(comment)).toBeTruthy();
  // No Ask without asking: the page passes none until the column's session asks.
  expect(within(check).queryByRole("button", { name: "Ask" })).toBeNull();
});

/** US4 key 1: a point's actions, "Ask" when the page asks. */
test("a point's actions are Ask and its comment button", async () => {
  const onAsk = vi.fn();
  const onComment = vi.fn();
  render(<PointActions onAsk={onAsk} onComment={onComment} subject={LIGHT_FLOW} />);

  await click(screen.getByRole("button", { name: "Ask" }));
  await click(screen.getByRole("button", { name: `Comment on "${LIGHT_FLOW}"` }));

  expect(onAsk).toHaveBeenCalledWith(LIGHT_FLOW);
  expect(onComment).toHaveBeenCalledOnce();
});

/** US4 key 1: the comment button opens the point's form. */
test("a point's comment button opens its form", async () => {
  await renderPage(PAGE, round());
  await screen.findByRole("region", { name: BLOCK });

  await click(
    within(pane("Check these")).getByRole("button", { name: `Comment on "${PROPOSAL}"` }),
  );

  expect(screen.getByText(`On "${PROPOSAL}"`)).toBeTruthy();
  expect(screen.getByLabelText("Comment text")).toBeTruthy();
});

/** US4 more 3 */
test("Under the hood is folded to its count", async () => {
  await renderPage(PAGE, round());
  await screen.findByRole("region", { name: BLOCK });

  const hood = pane("Under the hood");
  expect(hood.id).toBe("under-the-hood");
  expect(pane("Behaviour").id).toBe("behaviour");
  expect(within(hood).queryByText(/^The branch/)).toBeNull();

  await click(within(hood).getByRole("button", { name: "3 choices in the code only" }));

  expect(within(pane("Under the hood")).getByText(/^The branch/)).toBeTruthy();
});

/** US4 more 2 */
test("no Check these without points", async () => {
  await renderPage(
    PAGE,
    round(
      (text) => text.slice(0, text.indexOf("## Check these")) + text.slice(text.indexOf("## Q1:")),
    ),
  );
  await screen.findByRole("region", { name: BLOCK });

  expect(screen.queryByRole("region", { name: "Check these" })).toBeNull();
  expect(screen.getByRole("region", { name: "Behaviour" })).toBeTruthy();
});
