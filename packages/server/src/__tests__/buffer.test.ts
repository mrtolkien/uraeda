import { expect, test } from "vite-plus/test";
import { addChange, byId, type Data, mutate, testServer } from "./helpers.ts";

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
