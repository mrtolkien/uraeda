import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { fixture, fixtureRepo, git, mutate, port, testApp, testServer } from "./helpers.ts";

/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";
/** A proposal of a feature on its own branch. */
const PROPOSAL = "specs/2026-10-12-cli-tuis/proposal.md";

/** A test's server, and its repository's name in the list. */
type Served = Pick<Awaited<ReturnType<typeof testApp>>, "app" | "name">;

/** The address of the repository's routes, `/r/<name>`, on the test's server. */
const base = ({ name }: Served) => `http://127.0.0.1:${port}/r/${name}`;

/** Posts a file to the repository's `/attach`, as the UI does, with the query string given. */
function upload(
  served: Served,
  query: Record<string, string>,
  file = "desktop.png",
  headers: Record<string, string> = {},
) {
  const body = new FormData();
  body.set("file", new File([readFileSync(fixture(`images/${file}`))], file));
  return served.app.request(`${base(served)}/attach?${new URLSearchParams(query)}`, {
    body,
    headers,
    method: "POST",
  });
}

test("US1.1: an uploaded image is saved next to the proposal", async () => {
  const repo = fixtureRepo();

  const response = await upload(await testApp(repo), { name: "desktop.png", path: PROPOSAL });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    link: "![desktop](images/desktop.webp)",
    path: "specs/2026-10-12-cli-tuis/images/desktop.webp",
  });
  const saved = join(repo, ".worktrees/2026-10-12-cli-tuis/specs/2026-10-12-cli-tuis/images");
  expect(readdirSync(saved)).toEqual(["desktop.webp"]);
});

test("refuses an image the core refuses, with its code", async () => {
  const response = await upload(
    await testApp(),
    { name: "drawing.svg", path: PROPOSAL },
    "drawing.svg",
  );

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

  const response = await upload(server, {
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

  const served = await testApp();
  const response = await served.app.request(
    `${base(served)}/attach?name=huge.png&path=${PROPOSAL}`,
    {
      body,
      duplex: "half",
      headers: {
        "content-length": String(size),
        "content-type": "multipart/form-data; boundary=x",
      },
      method: "POST",
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
    await testApp(repo),
    { name: "desktop.png", path: PROPOSAL },
    "desktop.png",
    { origin: "https://evil.example" },
  );

  expect(response.status).toBe(403);
  expect(existsSync(join(repo, ".worktrees/2026-10-12-cli-tuis"))).toBe(false);
});

test("a chat image is saved in the data folder, never in the repository", async () => {
  const server = await testServer();

  const response = await upload(server, { chat: "1", name: "desktop.png" });

  expect(response.status).toBe(200);
  const image = (await response.json()) as { height: number; id: string; width: number };
  expect(image).toMatchObject({ height: 900, width: 1440 });
  expect(image.id).toMatch(/^[0-9a-f-]{36}\.webp$/);
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([image.id]);
  expect(git(server.repo, "status", "--porcelain")).toBe("");

  const url = `${base(server)}/chat-images/${image.id}`;
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
  const image = (await (await upload(server, { chat: "1", name: "desktop.png" })).json()) as {
    height: number;
    id: string;
    width: number;
  };
  const { cache } = server.sessions;
  const session = cache.createSession({
    agent: "fake",
    folder: null,
    nativeId: "native",
    repo: server.repo,
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session.id,
    state: "queued",
    step: null,
    trigger: null,
  });
  cache.appendItem(turn, {
    id: "m1",
    images: [image],
    kind: "message",
    origin: "human",
    state: "read",
    text: "",
  });

  const response = await server.app.request(`${base(server)}/chat-images/${image.id}`, {
    method: "DELETE",
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: `refused: ${image.id} is in a sent message.`,
  });
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([image.id]);
});

test("does not serve or delete a chat image outside the images folder", async () => {
  const server = await testApp();

  for (const id of ["..%2Frunner.sqlite", "missing.webp", "x"]) {
    expect((await server.app.request(`${base(server)}/chat-images/${id}`)).status).toBe(404);
  }
  const removed = await server.app.request(`${base(server)}/chat-images/..%2Frunner.sqlite`, {
    method: "DELETE",
  });
  expect(removed.status).toBe(404);
});

test("refuses a chunked upload over the body limit, said to be 21 MB", async () => {
  // No content-length: the body is counted as it is read, and refused past the limit.
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (sent++ < 22) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
  });

  const served = await testApp();
  const response = await served.app.request(
    `${base(served)}/attach?name=huge.png&path=${PROPOSAL}`,
    {
      body,
      duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      method: "POST",
    } as RequestInit,
  );

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: "refused: This image is over 20 MB: huge.png is 21 MB.",
  });
});

test("refuses an upload with both a path and chat=1, or neither", async () => {
  const server = await testApp();
  const queries: Array<Record<string, string>> = [
    { chat: "1", name: "desktop.png", path: PROPOSAL },
    { name: "desktop.png" },
  ];
  for (const query of queries) {
    const response = await upload(server, query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "refused: Give either a path or chat=1." });
  }
});

/** A multipart body that fails the test when read. */
function unread() {
  const state = { read: false };
  const body = new ReadableStream(
    {
      pull() {
        state.read = true;
        throw new Error("the body was read");
      },
    },
    { highWaterMark: 0 },
  );
  return { body, state };
}

test("refuses an upload to a working feature, or without a target, before reading the body", async () => {
  const server = await testServer();
  const sent = await mutate(server.app, "session.send", { folder: HUMAN, text: "Hi" }, [
    "id",
    "turns",
  ]);
  expect(sent.error).toBeUndefined();

  for (const [query, error] of [
    [
      `path=specs/${HUMAN}/proposal.md`,
      "refused: An agent is working on this feature. Stop it first, or wait for it.",
    ],
    ["chat=1&path=x.md", "refused: Give either a path or chat=1."],
  ]) {
    const { body, state } = unread();
    const response = await server.app.request(`${base(server)}/attach?name=desktop.png&${query}`, {
      body,
      method: "POST",
      // Under the limit, as a browser declares it: the limit lets it through unread.
      duplex: "half",
      headers: { "content-length": "1000", "content-type": "multipart/form-data; boundary=x" },
    } as RequestInit);
    expect(response.status, query).toBe(400);
    expect(await response.json()).toEqual({ error });
    expect(state.read, query).toBe(false);
  }
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

test("a chat image that cannot be written is refused with the system's error", async () => {
  const server = await testServer();
  // The images folder is a file: the write fails on disk.
  writeFileSync(join(server.dataDir, "images"), "");

  const response = await upload(server, { chat: "1", name: "desktop.png" });

  expect(response.status).toBe(400);
  const { error } = (await response.json()) as { error: string };
  expect(error).toMatch(/^refused: The image could not be saved: E[A-Z]+: .+\.$/);
});

test("refuses a cross-site upload or deletion without an Origin header", async () => {
  const server = await testServer();
  const headers = { "sec-fetch-site": "cross-site" };

  const posted = await upload(server, { chat: "1", name: "desktop.png" }, "desktop.png", headers);
  const deleted = await server.app.request(
    `${base(server)}/chat-images/00000000-0000-0000-0000-000000000000.webp`,
    { headers, method: "DELETE" },
  );

  expect(posted.status).toBe(403);
  expect(deleted.status).toBe(403);
  expect(existsSync(join(server.dataDir, "images"))).toBe(false);
});

test("a chat image is private to its owner, served cached and same-origin only", async () => {
  const server = await testServer();
  const image = (await (await upload(server, { chat: "1", name: "desktop.png" })).json()) as {
    id: string;
  };
  const dir = join(server.dataDir, "images");

  const served = await server.app.request(`${base(server)}/chat-images/${image.id}`);

  expect(statSync(dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(dir, image.id)).mode & 0o777).toBe(0o600);
  expect(served.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(served.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
});

test("the image routes are a repository's: outside its prefix, or of another name, they are not found", async () => {
  const server = await testServer();
  const image = (await (await upload(server, { chat: "1", name: "desktop.png" })).json()) as {
    id: string;
  };
  const origin = `http://127.0.0.1:${port}`;

  const outside = [
    await server.app.request(`${origin}/chat-images/${image.id}`),
    await server.app.request(`${origin}/r/missing/chat-images/${image.id}`),
    await server.app.request(`${origin}/images/specs/2026-10-12-cli-tuis/images/x.webp`),
    await server.app.request(`${origin}/attach?chat=1`, { body: new FormData(), method: "POST" }),
    await upload({ app: server.app, name: "missing" }, { chat: "1", name: "desktop.png" }),
  ];

  expect(outside.map((response) => response.status)).toEqual([404, 404, 404, 404, 404]);
  expect(readdirSync(join(server.dataDir, "images"))).toEqual([image.id]);
});
