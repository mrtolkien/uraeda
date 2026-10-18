// SC-003: every link a repository's pages build starts with `/r/<name>/`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { addChange, commitOnBranch } from "uraeda-binding/test-utils";
import { pathLink } from "../links.tsx";
import {
  addMockup,
  answered,
  atRepo,
  click,
  fixtureRepo,
  git,
  quiet,
  renderPage,
} from "./helpers.tsx";

test("a feature's workflow file opens in the UI", () => {
  expect(pathLink("specs/2026-10-11-web-ui/spec.md#us1", "uraeda")).toEqual({
    href: "/r/uraeda/f/2026-10-11-web-ui/spec.md#us1",
    inApp: true,
  });
});

/** A change's files open in the UI too, at its page's address. */
test("a change's workflow file opens in the UI", () => {
  expect(pathLink("specs/changes/2026-10-11-crash/proposal.md", "uraeda")).toEqual({
    href: "/r/uraeda/f/2026-10-11-crash/proposal.md",
    inApp: true,
  });
});

test("a draft opens in its editor, other files as text", () => {
  expect(pathLink("specs/drafts/idea.md", "uraeda").href).toBe(
    "/r/uraeda/edit/specs/drafts/idea.md",
  );
  expect(pathLink("crates/core/src/api.rs", "uraeda")).toEqual({
    href: "/r/uraeda/raw/crates/core/src/api.rs",
    inApp: false,
  });
  expect(pathLink("specs/x/mockups/ui.html", "uraeda")).toEqual({
    href: "/r/uraeda/mockups/specs/x/mockups/ui.html",
    inApp: false,
  });
  // The mockup route serves only a mockups folder's files: other HTML opens as text.
  expect(pathLink("docs/page.html", "uraeda")).toEqual({
    href: "/r/uraeda/raw/docs/page.html",
    inApp: false,
  });
});

/** US8 6: the constitution and the decisions open on their page, not as text. */
test("a decision and the constitution open on the decisions page", () => {
  expect(pathLink("specs/decisions/git.md", "uraeda")).toEqual({
    href: "/r/uraeda/decisions/git",
    inApp: true,
  });
  expect(pathLink("specs/decisions/git.md#rules", "uraeda").href).toBe("/r/uraeda/decisions/git");
  expect(pathLink("specs/CONSTITUTION.md", "uraeda")).toEqual({
    href: "/r/uraeda/decisions",
    inApp: true,
  });
  // A file under a decision's folder, like an image, is no decision.
  expect(pathLink("specs/decisions/images/a.md", "uraeda").inApp).toBe(false);
});

/** US2 more 5: from an item's file, a decision opens as its branch has it, at its anchor. */
test("a spec's decision link opens the branch's decision at its anchor", () => {
  const folder = "2026-10-17-spec-page";
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", "rules", { folder })).toEqual({
    href: `/r/uraeda/f/${folder}/decisions/task-storage#rules`,
    inApp: true,
  });
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", undefined, { folder }).href).toBe(
    `/r/uraeda/f/${folder}/decisions/task-storage`,
  );
  // From elsewhere, the decisions page, as the default branch has it.
  expect(pathLink("specs/decisions/task-storage.md", "uraeda", "rules").href).toBe(
    "/r/uraeda/decisions/task-storage",
  );
  // A feature's own file keeps its anchor, from its folder or not.
  expect(pathLink("specs/2026-10-11-web-ui/spec.md", "uraeda", "us1", { folder }).href).toBe(
    "/r/uraeda/f/2026-10-11-web-ui/spec.md#us1",
  );
});

/** US2 more 7 */
test("a change's round links its decision with the change marked", async () => {
  const repo = fixtureRepo();
  const folder = "2026-10-16-header-logo";
  addChange(repo, folder, {
    "clarifications-01.md": [
      "---\nstatus: awaiting-human\n---\n\n# Clarifications, round 01: A home logo\n",
      "> [!IMPORTANT]\n>\n> 1 question.\n",
      "## Context\n\nThe logo changes [how git is read](../../decisions/git.md#rules).\n",
      "## Q1: Does the logo replace the name?\n",
      "- **A (recommended). Yes.**\n  - [pro] simple.\n- **B. No.**\n  - [con] harder.\n",
      "**Answer:**\n",
    ].join("\n"),
    "proposal.md": "# A home logo\n",
  });
  const decision = git(repo, "show", "main:specs/decisions/git.md");
  commitOnBranch(repo, `change/${folder}`, {
    "specs/decisions/git.md": decision.replace("read git through gix", "read git only through gix"),
  });
  await renderPage(`/f/${folder}/clarifications-01.md`, repo);

  await click(await screen.findByRole("link", { name: "how git is read" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${folder}/decisions/git`)));
  expect(window.location.hash).toBe("#rules");
  const card = await screen.findByRole("region", { name: "Git" });
  expect(
    within(card)
      .getAllByRole("insertion")
      .map((run) => run.textContent),
  ).toEqual(["only"]);
});

/** Every page kind of the fixture, and a text it shows once drawn. */
const PAGES: Array<[path: string, text: string]> = [
  ["/", "Recently done"],
  ["/f/2026-10-11-web-ui", "You answer the questions"],
  ["/f/2026-10-11-web-ui/proposal.md", "the code"],
  ["/f/2026-10-06-recurring-tasks/session", "Message Claude Code"],
  ["/f/2026-10-06-recurring-tasks/mockups/repeat.html", "Open in a new tab"],
  ["/priorities", "Ongoing · 4"],
  ["/priorities/git-listener", "Git listener process"],
  ["/edit/specs/drafts/git-listener.md", "Git listener"],
  ["/chats/new", "New chat"],
  ["/changes/new", "Describe the bug or the change."],
  ["/decisions", "Decisions · 5"],
  ["/decisions/git", "Approved by mrtolkien"],
];

/** The web UI's proposal, on its checkout, links a workflow file, a draft, code, and the web. */
const PROPOSAL = `# Web UI

See [the spec](spec.md), [the draft](/specs/drafts/git-listener.md),
[the code](/packages/server/src/app.ts), and [Vite](https://vite.dev).
`;

/** SC-003 */
test.each(PAGES)("every link of %s starts with its repository's prefix", async (path, text) => {
  const repo = fixtureRepo();
  addMockup(repo, "2026-10-06-recurring-tasks", "repeat.html");
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/proposal.md"), PROPOSAL);
  const { name } = await renderPage(path, repo);
  await waitFor(() => expect(document.body.textContent).toContain(text));
  await answered("Workspace");
  await quiet();

  const prefix = `/r/${name}/`;
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!);
  const sources = [...document.querySelectorAll("iframe[src]")].map((f) => f.getAttribute("src")!);
  const own = [...links, ...sources].filter((href) => href.startsWith("/"));
  expect(own.length).toBeGreaterThan(0);
  expect(own.filter((href) => !href.startsWith(prefix))).toEqual([]);
  expect(window.location.pathname).toBe(atRepo(path));
  expect(screen.queryByText("Nothing here.")).toBeNull();
});
