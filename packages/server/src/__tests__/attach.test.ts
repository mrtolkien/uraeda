import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture, fixtureRepo, git, mutate, port, testApp, testServer } from "./helpers.ts";

/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";
/** A proposal of a feature on its own branch. */
const PROPOSAL = "specs/2026-10-12-cli-tuis/proposal.md";

type App = ReturnType<typeof testApp>;

/** Posts a file to `/attach`, as the UI does, with the query string given. */
function upload(
  app: App,
  query: Record<string, string>,
  file = "desktop.png",
  headers: Record<string, string> = {},
) {
  const body = new FormData();
  body.set("file", new File([readFileSync(fixture(`images/${file}`))], file));
  return app.request(`http://127.0.0.1:${port}/attach?${new URLSearchParams(query)}`, {
    method: "POST",
    body,
    headers,
  });
}

test("US1_1: an uploaded image is saved next to the proposal", async () => {
  const repo = fixtureRepo();

  const response = await upload(testApp(repo), { name: "desktop.png", path: PROPOSAL });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    path: "specs/2026-10-12-cli-tuis/images/desktop.webp",
    link: "![desktop](images/desktop.webp)",
  });
  const saved = join(repo, ".worktrees/2026-10-12-cli-tuis/specs/2026-10-12-cli-tuis/images");
  expect(readdirSync(saved)).toEqual(["desktop.webp"]);
});

test("refuses an image the core refuses, with its code", async () => {
  const response = await upload(testApp(), { name: "drawing.svg", path: PROPOSAL }, "drawing.svg");

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.",
  });
});

test("refuses an upload while the feature's agent works", async () => {
  const server = await testServer();
  const sent = await mutate(server.app, "session.send", { folder: HUMAN, text: "Hi" }, [
    "id",
    "turns",
  ]);
  expect(sent.error).toBeUndefined();

  const response = await upload(server.app, {
    name: "desktop.png",
    path: `specs/${HUMAN}/proposal.md`,
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "refused: An agent is working on this feature. Stop it first, or wait for it.",
  });
  expect(existsSync(join(server.repo, `.worktrees/${HUMAN}/specs/${HUMAN}/images`))).toBe(false);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

test("refuses an upload over the body limit without reading it", async () => {
  let read = false;
  // Pulled only when read: no chunk is queued ahead.
  const body = new ReadableStream(
    {
      pull() {
        read = true;
        throw new Error("the body was read");
      },
    },
    { highWaterMark: 0 },
  );
  // 22 MiB and one byte: rounded up, as the core rounds.
  const size = 22 * 1024 * 1024 + 1;

  const response = await testApp().request(
    `http://127.0.0.1:${port}/attach?name=huge.png&path=${PROPOSAL}`,
    {
      method: "POST",
      body,
      headers: {
        "content-length": String(size),
        "content-type": "multipart/form-data; boundary=x",
      },
      duplex: "half",
    } as RequestInit,
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "refused: This image is over 20 MB: huge.png is 22.1 MB.",
  });
  expect(read).toBe(false);
});

test("refuses a cross-site upload", async () => {
  const repo = fixtureRepo();

  const response = await upload(
    testApp(repo),
    { name: "desktop.png", path: PROPOSAL },
    "desktop.png",
    { origin: "https://evil.example" },
  );

  expect(response.status).toBe(403);
  expect(existsSync(join(repo, ".worktrees/2026-10-12-cli-tuis"))).toBe(false);
});

test("a chat image is saved in the data folder, never in the repository", async () => {
  const server = await testServer();

  const response = await upload(server.app, { name: "desktop.png", chat: "1" });

  expect(response.status).toBe(200);
  const image = (await response.json()) as { id: string; width: number; height: number };
  expect(image).toMatchObject({ width: 1440, height: 900 });
  expect(image.id).toMatch(/^[0-9a-f-]{36}\.webp$/);
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([image.id]);
  expect(git(server.repo, "status", "--porcelain")).toBe("");

  const url = `http://127.0.0.1:${port}/chat-images/${image.id}`;
  const served = await server.app.request(url);
  expect(served.status).toBe(200);
  expect(served.headers.get("content-type")).toBe("image/webp");
  expect(served.headers.get("x-content-type-options")).toBe("nosniff");
  expect(served.headers.get("content-security-policy")).toBe("default-src 'none'");
  expect(
    Buffer.from(await served.arrayBuffer())
      .subarray(8, 12)
      .toString("latin1"),
  ).toBe("WEBP");

  const removed = await server.app.request(url, { method: "DELETE" });
  expect(removed.status).toBe(204);
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([]);
  expect((await server.app.request(url)).status).toBe(404);
});

test("a chat image a message holds is not deleted", async () => {
  const server = await testServer();
  const image = (await (await upload(server.app, { name: "desktop.png", chat: "1" })).json()) as {
    id: string;
    width: number;
    height: number;
  };
  const { cache } = server.sessions;
  const session = cache.createSession({
    repo: server.repo,
    folder: null,
    agent: "fake",
    nativeId: "native",
    title: null,
  });
  const turn = cache.addTurn({
    sessionId: session.id,
    kind: "chat",
    trigger: null,
    step: null,
    allowed: null,
    state: "queued",
  });
  cache.appendItem(turn, {
    kind: "message",
    id: "m1",
    text: "",
    origin: "human",
    state: "read",
    images: [image],
  });

  const response = await server.app.request(`http://127.0.0.1:${port}/chat-images/${image.id}`, {
    method: "DELETE",
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: `refused: ${image.id} is in a sent message.`,
  });
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([image.id]);
});

test("does not serve or delete a chat image outside the images folder", async () => {
  const app = testApp();

  for (const id of ["..%2Frunner.sqlite", "missing.webp", "x"]) {
    expect((await app.request(`http://127.0.0.1:${port}/chat-images/${id}`)).status).toBe(404);
  }
  const removed = await app.request(`http://127.0.0.1:${port}/chat-images/..%2Frunner.sqlite`, {
    method: "DELETE",
  });
  expect(removed.status).toBe(404);
});
