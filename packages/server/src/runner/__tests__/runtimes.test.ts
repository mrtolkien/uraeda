import { afterEach, expect, test, vi } from "vite-plus/test";
import { FakeAdapter } from "../fake.ts";
import { Runtimes } from "../runtimes.ts";
import { flush, restart, testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

const OFF = "pi-durable is off: turn it on to continue this session";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Two fake runtimes, `claude` first, then `pi-durable`, each on while `on` says so, both by
 * default, whose turns end at once, done.
 */
function twoRuntimes(on: Record<string, boolean> = {}) {
  const claude = new FakeAdapter();
  const durable = new FakeAdapter();
  claude.fallback = () => [];
  durable.fallback = () => [];
  const runtimes = new Runtimes({ isOn: (name) => on[name] ?? true });
  runtimes.register("claude", claude);
  const unregister = runtimes.register("pi-durable", durable);
  return { claude, durable, on, runtimes, unregister };
}

test.each<[string, boolean | undefined, string]>([
  ["on", true, "sends"],
  ["off", false, OFF],
  ["removed", undefined, OFF],
])("a session runs on the runtime it was started with (%s)", async (_, state, expected) => {
  const { claude, durable, on, runtimes, unregister } = twoRuntimes();
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });
  const session = await sessions.featureSession(repo, AGENT, "pi-durable");
  expect(cache.session(session.id)?.agent).toBe("pi-durable");
  const { turn } = await sessions.send(repo, session.id, { text: "Plan it" });
  await sessions.settled(turn);
  expect(durable.opens).toHaveLength(1);

  if (state === undefined) {
    unregister();
  } else {
    on["pi-durable"] = state;
  }
  const next = await restart(sessions);
  expect(next.runtimeOf(session.id)).toBe(state === undefined ? undefined : durable);
  const send = next.send(repo, session.id, { text: "Go on" });
  if (expected === "sends") {
    await next.settled((await send).turn);
    await flush();
    expect(durable.opens).toHaveLength(2);
    expect(durable.opens[1]).toMatchObject({ nativeId: session.nativeId, resume: true });
  } else {
    await expect(send).rejects.toThrow(expected);
  }
  // Never moved onto the first runtime, and still stored with its own.
  expect(claude.opens).toHaveLength(0);
  expect(cache.session(session.id)?.agent).toBe("pi-durable");
  next.close();
});

test("starting a session with no runtime on is refused", async () => {
  const { claude, durable, runtimes } = twoRuntimes({ claude: false, "pi-durable": false });
  const { cache, repo, sessions } = await testSessions(undefined, { runtimes });

  await expect(sessions.featureSession(repo, AGENT)).rejects.toThrow(
    "No agent runtime is on here: turn one on in Settings, Extensions",
  );
  await expect(sessions.newChat(repo)).rejects.toThrow("No agent runtime is on here");
  expect(cache.folderSessions(await sessions.mainRoot(repo), AGENT)).toHaveLength(0);
  expect([...claude.opens, ...durable.opens]).toHaveLength(0);
});

test("a new session runs on the first runtime on in its repository", async () => {
  const { runtimes } = twoRuntimes({ claude: false });
  const { repo, sessions } = await testSessions(undefined, { runtimes });

  const session = await sessions.featureSession(repo, AGENT);

  expect(session.agent).toBe("pi-durable");
});
