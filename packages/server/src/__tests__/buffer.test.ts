import { expect, test } from "vite-plus/test";
import { addChange, byId, commitOnBranch, type Data, git, mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

const REFUSED = {
  code: "BAD_REQUEST",
  message: "refused: An agent is working on this feature. Stop it first, or wait for it.",
};

/** Sends a message to a folder's session, which the fake agent keeps running until stopped. */
async function send(server: Server, folder: string) {
  const sent = await mutate(server.app, "session.send", { folder, text: "Look at it" }, [
    "id",
    "turns",
  ]);
  expect(sent.error).toBeUndefined();
  return sent.data as Record<string, Data>;
}

// Break caught: a buffer's save that skips the refusal while an agent works, a nested file of the
// feature's folder included.
test("a feature's buffer is refused while its agent works", async () => {
  const server = await testServer();
  const folder = "2026-10-16-centred-x";
  const path = `specs/changes/${folder}/contracts/api.md`;
  addChange(server.repo, folder, { "contracts/api.md": "# API\n", "proposal.md": "# Centre\n" });
  const [before] = await byId(server.app, "Buffer", [path], ["id", "hash", "text", "branch"]);
  expect(before).toMatchObject({ branch: `change/${folder}`, text: "# API\n" });
  const saved = await mutate(
    server.app,
    "buffer.save",
    { hash: before.hash, path, text: "# API\n\nGET /x\n" },
    ["id", "hash", "text"],
  );
  expect(saved.error).toBeUndefined();
  expect(saved.data).toMatchObject({ text: "# API\n\nGET /x\n" });
  const session = await send(server, folder);

  const refused = await mutate(
    server.app,
    "buffer.save",
    { hash: (saved.data as Record<string, string>).hash, path, text: "# Mine\n" },
    ["id"],
  );

  expect(refused.error).toEqual(REFUSED);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id as string);
  await server.sessions.settled(Number((session.turns as Array<Data>).at(-1)));
});

const RECORD = `---
kind: feature
finished: 2026-10-11
pull-request: https://github.com/owner/repo/pull/1
---

# Record: Centred x

## What and why

A thing.
`;

// Break caught: the refusal decided from the path's first folder, not from the feature the core
// writes the file for: a finished feature's record, `specs/done/<folder>.md`, is written on its
// branch, in the worktree its agent works in.
test.each([
  ["a feature's file", (folder: string) => `specs/${folder}/spec.md`, "# Spec\n"],
  ["a finished feature's record", (folder: string) => `specs/done/${folder}.md`, RECORD],
])("%s is refused while its agent works", async (_, pathOf, text) => {
  const server = await testServer();
  const folder = "2026-10-16-centred-x";
  const path = pathOf(folder);
  git(server.repo, "branch", folder, "main");
  const proposal = `specs/${folder}/proposal.md`;
  commitOnBranch(server.repo, folder, { [proposal]: "# Centre\n" });
  const session = await send(server, folder);
  // Finishing a feature removes its folder beside the record.
  const finished = path.startsWith("specs/done/");
  commitOnBranch(server.repo, folder, { [path]: text, ...(finished ? { [proposal]: null } : {}) });
  const [before] = await byId(server.app, "Buffer", [path], ["id", "hash", "branch"]);
  expect(before).toMatchObject({ branch: folder });

  const refused = await mutate(
    server.app,
    "buffer.save",
    { hash: before.hash, path, text: "# Mine\n" },
    ["id"],
  );

  expect(refused.error).toEqual(REFUSED);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id as string);
  await server.sessions.settled(Number((session.turns as Array<Data>).at(-1)));
});

// Break caught: a feature pane's commit on the Commit page that skips the refusal while its agent
// works, committing the buffer's edits under it.
test("a feature pane is refused while its agent works", async () => {
  const server = await testServer();
  const folder = "2026-10-16-centred-x";
  const branch = `change/${folder}`;
  const path = `specs/changes/${folder}/proposal.md`;
  addChange(server.repo, folder, { "proposal.md": "# Centre\n" });
  const [before] = await byId(server.app, "Buffer", [path], ["id", "hash"]);
  const saved = await mutate(
    server.app,
    "buffer.save",
    { hash: before.hash, path, text: "# Centre\n\nMore.\n" },
    ["id"],
  );
  expect(saved.error).toBeUndefined();
  const [commit] = await byId(server.app, "CommitPanes", ["commit"], ["id", "panes"]);
  expect(commit.panes).toMatchObject([{ branch, folder, lines: ["- Edit proposal.md"] }]);
  const tip = git(server.repo, "rev-parse", branch);
  const session = await send(server, folder);

  const refused = await mutate(
    server.app,
    "changes.commit",
    { branch, message: "chore: centre the x" },
    ["id"],
  );

  expect(refused.error).toEqual(REFUSED);
  expect(git(server.repo, "rev-parse", branch)).toBe(tip);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id as string);
  await server.sessions.settled(Number((session.turns as Array<Data>).at(-1)));
});
