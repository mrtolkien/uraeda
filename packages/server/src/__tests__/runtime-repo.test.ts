import { expect, test } from "vite-plus/test";
import { chatImages } from "../attach.ts";
import { agentRecord } from "../fate/sessions.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { Runtimes } from "../runner/runtimes.ts";
import { testSessions } from "../runner/__tests__/helpers.ts";
import { binding, mutate, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

test("Agent reads where each runtime is on by the repository's main checkout (R19)", async () => {
  const root = "/main/checkout";
  const runtimes = new Runtimes({ isOn: (_, repo) => repo === root });
  runtimes.register("fake", new FakeAdapter());
  const { sessions } = await testSessions(undefined, {
    binding: { ...binding, mainRoot: async () => root },
    runtimes,
  });

  const agent = await agentRecord({
    repo: "/main/checkout/.worktrees/a-change",
    sessions,
  } as never);

  expect(agent.runtimes.map((runtime) => runtime.isOn)).toEqual([true]);
  sessions.close();
});

test("session.send checks a feature's images against its latest session's runtime", async () => {
  const server = await testServer();
  // The first runtime on reads no images; the feature's session runs on one that does.
  server.adapter.capabilities = { ...server.adapter.capabilities, images: false };
  const seeing = new FakeAdapter();
  seeing.fallback = () => [];
  server.sessions.runtimes.register("seeing", seeing);
  await server.sessions.check();
  await server.sessions.featureSession(server.repo, AGENT, { runtime: "seeing" });
  const image = await chatImages(server.dataDir).save({
    bytes: Buffer.from("RIFF....WEBP"),
    extension: "webp",
    height: 900,
    width: 1440,
  });

  const sent = await mutate(
    server.app,
    "session.send",
    { folder: AGENT, images: [image], text: "Look" },
    ["id", "agent"],
  );

  expect(sent.error).toBeUndefined();
  expect(sent.data).toMatchObject({ agent: "seeing" });
  expect(server.adapter.opens).toEqual([]);
});
