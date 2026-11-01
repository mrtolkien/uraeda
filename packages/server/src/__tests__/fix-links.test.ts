// A done feature's record linking a file that moved since: its page notes the link, and "Fix moved
// links" rewrites the record without committing, for the commit page to commit.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { binding, byId, commitOnBranch, git, mutate, testServer } from "./helpers.ts";

/** The done feature whose record links the proposal. */
const DONE = "2026-10-28-inbox-again";
const RECORD = `specs/done/${DONE}.md`;
const PROPOSAL = "/specs/2026-10-30-proposal-start/proposal.md";
const MOVED = `no file ${PROPOSAL}: it became the record /specs/done/2026-10-30-proposal-start.md`;

/**
 * A record of the feature `title`, finished on 2026-10-31, with its required sections: `body` is
 * its "What and why".
 */
const record = (title: string, body: string) =>
  [
    `---\nkind: feature\nfinished: 2026-10-31\n---\n\n# Record: ${title}\n\n> [!NOTE]\n>\n> A record.\n`,
    `## What and why\n\n${body}`,
    "## Behaviour\n\nIt works.\n",
    "## Design\n\nPlain.\n",
  ].join("\n");

/** A repository whose done feature's record links a proposal started and finished since. */
function movedLink(repo: string) {
  commitOnBranch(repo, "main", {
    [PROPOSAL.slice(1)]: "# Proposal start\n\nStart a proposal from its file.\n",
    [RECORD]: record("Inbox again", `See [the start](${PROPOSAL}).\n`),
  });
  commitOnBranch(repo, "main", {
    [PROPOSAL.slice(1)]: null,
    "specs/done/2026-10-30-proposal-start.md": record("Proposal start", "Started.\n"),
  });
}

/** US3: a done feature's page notes the moved link, and its Fix rewrites it, uncommitted. */
test("a done feature's moved link is noted, and fixed without a commit", async () => {
  const server = await testServer();
  movedLink(server.repo);
  const head = git(server.repo, "rev-parse", "HEAD");

  const [feature] = await byId(server.app, "Feature", [DONE], ["id", "notes", "source"]);

  expect(feature.source).toBe("default-branch");
  expect(feature.notes).toContainEqual(
    expect.objectContaining({ file: RECORD, fixable: true, message: MOVED }),
  );

  const fixed = await mutate(server.app, "feature.fixLinks", { folder: DONE }, ["id", "notes"]);

  expect(fixed.error).toBeUndefined();
  expect(fixed.data.notes).toEqual([]);
  expect(git(server.repo, "rev-parse", "HEAD")).toBe(head);
  expect(git(server.repo, "status", "--porcelain")).toBe(` M ${RECORD}\n`);
  expect(readFileSync(join(server.repo, RECORD), "utf8")).toContain(
    "[the start](/specs/done/2026-10-30-proposal-start.md)",
  );
  const priorities = await binding.readPriorities(server.repo);
  expect(priorities.changeLines).toContain(`- Repair links: ${DONE}.md`);
});
