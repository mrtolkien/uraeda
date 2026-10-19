// What the server flows share: the real server on a port, with the fake Storybook behind it.
import { createServer } from "node:http";
import { basename, join } from "node:path";
import { getRequestListener } from "@hono/node-server";
import { onTestFinished } from "vite-plus/test";
import {
  addStoryFeature,
  type FakeMode,
  fixtureRepo,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";
import { checkoutOf, ready } from "../preview/__tests__/helpers.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer } from "../server.ts";
import { testSettings } from "../testing.ts";

const binding = await import("uraeda-binding");

/**
 * The server, started as `main.ts` starts it, listening on a free port of this machine, in a
 * repository with the test feature whose Storybook is the fake preview in `mode`, viewed and ready.
 * With `signIn`, devices sign in with the key it made. Everything is closed after the test.
 */
export async function liveServer({
  dataDir = temporaryFolder("uraeda-data"),
  mode = "ok",
  signIn = false,
}: { dataDir?: string; mode?: FakeMode; signIn?: boolean } = {}) {
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo, { preview: { mode } });
  const http = createServer();
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as { port: number };
  const server = await startServer({
    adapter: new FakeAdapter(),
    allowOrigins: [],
    binding,
    dataDir,
    given: false,
    port,
    repo,
    settings: await testSettings(),
    ...(!signIn && { signIn: false as const }),
  });
  http.on("request", getRequestListener(server.app.fetch));
  http.on("upgrade", server.upgrade);
  onTestFinished(async () => {
    http.closeAllConnections();
    await new Promise<void>((resolve) => http.close(() => resolve()));
    await server.stop();
  });
  const name = basename(repo);
  const origin = `http://127.0.0.1:${port}`;
  const dir = join(repo, ".worktrees", STORY_FEATURE);
  /** The feature's Storybook, viewed and ready under the frame secret in force now. */
  const view = async () => {
    const base = `/r/${name}/preview/${server.frames.current()}/${STORY_FEATURE}/`;
    const commit = (await binding.checkoutCommit(dir)) ?? undefined;
    const checkout = { ...(await checkoutOf(dir, base)), commit };
    server.previews.view(checkout);
    await ready(server.previews, checkout);
    return base;
  };
  return { dir, log: log!, name, origin, port, repo, server, view };
}
