// Images: the attachments decision's rules that a workflow file's image is saved beside it, that a
// chat image stays out of git, and that the server serves them so a browser cannot run them.
import { existsSync, readdirSync, readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { chatImages } from "../attach.ts";
import { SessionCache } from "../runner/cache.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startSessions } from "../server.ts";
import {
  fixture,
  fixtureRepo,
  git,
  mutate,
  port,
  testApp,
  testServer,
} from "../__tests__/helpers.ts";

/** A feature on its own branch, with its worktree. */
const FEATURE = "2026-10-12-cli-tuis";
const PROPOSAL = `specs/${FEATURE}/proposal.md`;

type Served = Pick<Awaited<ReturnType<typeof testApp>>, "app" | "name">;

const base = ({ name }: Served) => `http://127.0.0.1:${port}/r/${name}`;

/** Posts an image of the fixtures to `/attach`, as the web UI does. */
function upload(
  served: Served,
  query: Record<string, string>,
  { file = "desktop.png", headers = {} }: { file?: string; headers?: Record<string, string> } = {},
) {
  const body = new FormData();
  body.set("file", new File([readFileSync(fixture(`images/${file}`))], file));
  return served.app.request(`${base(served)}/attach?${new URLSearchParams(query)}`, {
    body,
    headers,
    method: "POST",
  });
}

const isWebp = (bytes: Uint8Array) =>
  Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" &&
  Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";

test("an image attached to a workflow file is saved beside it, as a small WebP", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);

  const response = await upload(served, { name: "desktop.png", path: PROPOSAL });

  expect(response.status).toBe(200);
  const { link, path } = (await response.json()) as { link: string; path: string };
  // A relative markdown image, beside the file, in the feature's own folder.
  expect(link).toMatch(/^!\[[^\]]*\]\([^/)]+\/[^/)]+\.webp\)$/);
  expect(path.startsWith(`specs/${FEATURE}/`)).toBe(true);
  const saved = readFileSync(join(repo, ".worktrees", FEATURE, path));
  expect(isWebp(saved)).toBe(true);
});

test("an image the core refuses is refused, and nothing is written", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);

  const svg = await upload(
    served,
    { name: "drawing.svg", path: PROPOSAL },
    { file: "drawing.svg" },
  );

  expect(svg.status).toBe(400);
  expect(existsSync(join(repo, ".worktrees", FEATURE, "specs", FEATURE, "images"))).toBe(false);
});

test("an upload is refused while the feature's agent works", async () => {
  const server = await testServer();
  const human = "2026-10-11-web-ui";
  const sent = await mutate(server.app, "session.send", { folder: human, text: "Hi" }, [
    "id",
    "turns",
  ]);

  const refused = await upload(server, { name: "desktop.png", path: `specs/${human}/proposal.md` });

  expect(refused.status).toBe(400);
  expect(existsSync(join(server.repo, ".worktrees", human, "specs", human, "images"))).toBe(false);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, sent.data.id);
  await server.sessions.settled(Number(sent.data.turns.at(-1)));
});

test("an upload over the limit, from another site, or with no target is refused", async () => {
  const served = await testApp();
  const big = new FormData();
  big.set("file", new File([new Uint8Array(22 * 1024 * 1024)], "huge.png"));

  const over = await served.app.request(`${base(served)}/attach?name=huge.png&path=${PROPOSAL}`, {
    body: big,
    method: "POST",
  });
  const crossSite = await upload(
    served,
    { chat: "1" },
    { headers: { origin: "https://evil.example" } },
  );
  const noOrigin = await upload(
    served,
    { chat: "1" },
    { headers: { "sec-fetch-site": "cross-site" } },
  );
  const neither = await upload(served, {});
  const both = await upload(served, { chat: "1", path: PROPOSAL });

  expect(over.status).toBe(400);
  expect(crossSite.status).toBe(403);
  expect(noOrigin.status).toBe(403);
  expect(neither.status).toBe(400);
  expect(both.status).toBe(400);
});

test("a chat image is kept in the data folder, never in the repository", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const before = git(repo, "status", "--porcelain", "--ignored");

  const response = await upload(served, { chat: "1", name: "desktop.png" });

  expect(response.status).toBe(200);
  const { id } = (await response.json()) as { id: string };
  expect(readdirSync(join(served.dataDir, "images"))).toContain(id);
  expect(git(repo, "status", "--porcelain", "--ignored")).toBe(before);
  expect(git(repo, "ls-files", "--others", "--cached").includes(id)).toBe(false);
});

test("a start deletes the chat images no message holds, a day old, and keeps the rest", async () => {
  const dataDir = temporaryFolder("uraeda-data");
  const images = chatImages(dataDir);
  const encoded = {
    bytes: Buffer.from("RIFF0000WEBP"),
    extension: "webp" as const,
    height: 1,
    width: 1,
  };
  const [sent, unusedOld, unusedFresh] = [
    await images.save(encoded),
    await images.save(encoded),
    await images.save(encoded),
  ];
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  for (const old of [sent, unusedOld]) {
    utimesSync(join(images.dir, old.id), twoDaysAgo, twoDaysAgo);
  }
  const cache = SessionCache.open(join(dataDir, "runner.sqlite"));
  const session = cache.createSession({
    agent: "fake",
    folder: null,
    nativeId: "n",
    repo: "/r",
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session.id,
    state: "running",
    step: null,
    trigger: null,
  });
  cache.appendItem(turn, {
    id: "m1",
    images: [sent],
    kind: "message",
    origin: "human",
    state: "read",
    text: "Look",
  });
  cache.db.close();

  const started = await startSessions({
    adapter: new FakeAdapter(),
    binding: await import("uraeda-binding"),
    dataDir,
    hosts: () => undefined,
  });

  expect(readdirSync(images.dir).sort()).toEqual([sent.id, unusedFresh.id].sort());
  expect(readdirSync(images.dir)).not.toContain(unusedOld.id);
  await started.stop();
});

test("images are served as images only: never sniffed, never run, never framed by another site", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  const { id } = (await (await upload(served, { chat: "1", name: "desktop.png" })).json()) as {
    id: string;
  };
  const attached = (await (
    await upload(served, { name: "desktop.png", path: PROPOSAL })
  ).json()) as {
    path: string;
  };

  const chat = await served.app.request(`${base(served)}/chat-images/${id}`);
  const file = await served.app.request(`${base(served)}/images/${attached.path}`);

  for (const image of [chat, file]) {
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toMatch(/^image\//);
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(image.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
    expect(image.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(isWebp(new Uint8Array(await image.arrayBuffer()))).toBe(true);
  }
});

test("the image routes serve no other file: markdown, a path outside, or a chat image of nobody", async () => {
  const served = await testApp();

  for (const path of [
    `/images/${PROPOSAL}`,
    "/images/../../etc/passwd",
    "/images/%2e%2e/%2e%2e/etc/passwd",
    "/chat-images/..%2f..%2fsign-in.json",
    "/chat-images/not-an-image.webp",
  ]) {
    const response = await served.app.request(`${base(served)}${path}`);
    expect(response.status, path).toBe(404);
  }
});
