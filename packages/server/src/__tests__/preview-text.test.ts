import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { addChange, byId, fixture, fixtureRepo, testApp } from "./helpers.ts";

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

// The key picker previews raw markdown for each kind of thing it lists. Each kind's text must reach
// the client through the real server, so no picker finds a kind it cannot preview.
test("each kind a preview shows has its raw text through the server", async () => {
  const repo = fixtureRepo();
  const change = "2026-10-16-centred-x";
  addChange(repo, change, { "proposal.md": "# Centre the x\n\nIt sits low.\n" });
  const { app } = await testApp(repo);

  // A feature's proposal, by the file source.
  const [feature] = await byId(
    app,
    "WorkflowFile",
    ["2026-10-11-web-ui/proposal.md"],
    ["id", "current"],
  );
  expect(feature.current.text).toBe(
    readFileSync(
      fixture("repo/branches/2026-10-11-web-ui/specs/2026-10-11-web-ui/proposal.md"),
      "utf8",
    ),
  );

  // A change's proposal, by the same source.
  const [changed] = await byId(app, "WorkflowFile", [`${change}/proposal.md`], ["id", "current"]);
  expect(changed.current.text).toBe("# Centre the x\n\nIt sits low.\n");

  // A decision's file, frontmatter included, from the ledger.
  const [ledger] = await byId(app, "Ledger", ["ledger"], ["decisions"]);
  const git_ = ledger.decisions.find((decision: { name: string }) => decision.name === "git");
  expect(git_.text).toBe(read(repo, "specs/decisions/git.md"));
  expect(git_.text.startsWith("---\n")).toBe(true);

  // A note's text, from the inbox.
  const [inbox] = await byId(app, "Inbox", ["inbox"], ["categories"]);
  const notes = inbox.categories.flatMap((category: { notes: Array<{ text: string }> }) =>
    category.notes.map((note) => note.text),
  );
  expect(notes).toContain("Text input feels laggy on the sessions page");

  // A priority's line, with its nested lines.
  const [priorities] = await byId(app, "Priorities", ["priorities"], ["sections"]);
  const entries = priorities.sections.flatMap(
    (section: { entries: Array<{ lines: Array<string>; nested: Array<string>; text: string }> }) =>
      section.entries,
  );
  const nix = entries.find((entry: { text: string }) => entry.text.startsWith("Nix + Docker"));
  expect(nix.lines).toEqual(["- Nix + Docker based execution environments", "  - with a cache"]);
  expect(nix.nested).toEqual(["  - with a cache"]);
});
