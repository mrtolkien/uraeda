// SC-003: every link a repository's pages build starts with `/r/<name>/`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { pathLink } from "../routes.tsx";
import { addMockup, answered, atRepo, fixtureRepo, git, quiet, renderPage } from "./helpers.tsx";

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
});

/** Every page kind of the fixture, and a text it shows once drawn. */
const PAGES: Array<[path: string, text: string]> = [
  ["/", "Git listener process"],
  ["/f/2026-10-11-web-ui", "Answer questions"],
  ["/f/2026-10-11-web-ui/proposal.md", "the code"],
  ["/f/2026-10-06-recurring-tasks/session", "Message Claude Code"],
  ["/f/2026-10-06-recurring-tasks/mockups/repeat.html", "Open in a new tab"],
  ["/priorities", "Now · 4"],
  ["/priorities/git-listener", "Git listener process"],
  ["/edit/specs/drafts/git-listener.md", "Git listener"],
  ["/chats/new", "New chat"],
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
