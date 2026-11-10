// Runtimes on a started server: a runtime of yours, or a built-in's, reloads only once its turns
// end, its row saying which session it waits for; a session gets the skills of the extensions on
// in its repository; and only a server given the fake agent has its runtime.
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { account, flush } from "../../runner/__tests__/helpers.ts";
import { FakeAccounts, FakeAdapter } from "../../runner/fake.ts";
import { STATUS_FILE } from "../status-file.ts";
import { writeFiles } from "./helpers.ts";
import { FEATURE, mutate, runtime, serve, stateOf } from "./serve.ts";

/** A turn's script that holds until `ends` resolves, telling `started` once it runs. */
function held(adapter: FakeAdapter) {
  const started = Promise.withResolvers<void>();
  const ends = Promise.withResolvers<void>();
  adapter.script([
    async () => {
      started.resolve();
      await ends.promise;
    },
    { text: "Done.", type: "text" },
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  return { ends: ends.resolve, started: started.promise };
}

test("a runtime reloads once its turns end", async () => {
  const opened = await serve({ durable: runtime(1) }, "");
  const { adapter } = opened.sink;
  const { sessions } = opened.server;
  await sessions.check();
  expect(opened.sink.activations).toBe(1);
  const session = await sessions.featureSession(opened.uraeda, FEATURE, { runtime: "durable" });
  const turnEnds = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  adapter.script([
    async () => {
      started.resolve();
      await turnEnds.promise;
    },
    { text: "Done.", type: "text" },
    { denials: [], errors: [], interrupted: false, ok: true, type: "result" },
  ]);
  const { turn } = await sessions.send(opened.uraeda, session.id, { text: "Go on" });
  await started.promise;

  writeFiles(join(opened.configDir, "extensions", "durable"), runtime(2));
  await expect.poll(() => stateOf(opened.server, "durable")?.state).toBe("waiting");
  expect(stateOf(opened.server, "durable")?.waitingFor).toBe(FEATURE);
  expect(opened.sink.activations).toBe(1);

  turnEnds.resolve();
  await sessions.settled(turn);
  await expect.poll(() => opened.sink.activations).toBe(2);
  expect(stateOf(opened.server, "durable")?.state).toBe("on");
  expect(sessions.runtimeOf(session.id)).toBe(adapter);
});

/** An extension's files: its manifest, without entries, and one skill. */
const skills = (name: string) => ({
  "extension.toml": `name = "${name}"\ntitle = "${name}"\napi = 1\n`,
  "skills/astryx-docs/SKILL.md": "---\nname: astryx-docs\ndescription: Astryx.\n---\n",
});

test("a session gets the skills of the extensions on in its repository only", async () => {
  const opened = await serve(
    { "docs-ext": skills("docs-ext"), durable: runtime(1), "off-ext": skills("off-ext") },
    `[extensions.docs-ext]\non = ["uraeda"]\n\n[extensions.off-ext]\non = []\n`,
  );
  const { adapter } = opened.sink;
  const { sessions } = opened.server;
  await sessions.check();
  const sent = async (repo: string) => {
    const session = await sessions.featureSession(repo, FEATURE, { runtime: "durable" });
    adapter.script([{ denials: [], errors: [], interrupted: false, ok: true, type: "result" }]);
    const { turn } = await sessions.send(repo, session.id, { text: "Go on" });
    await sessions.settled(turn);
    return adapter.opens.at(-1)?.skills;
  };

  expect(await sent(opened.uraeda)).toEqual([
    join(opened.configDir, "extensions", "docs-ext", "skills"),
  ]);
  expect(await sent(opened.other)).toEqual([]);
});

test("a reload waits for the sessions still at work, naming the one at work now", async () => {
  const opened = await serve({ durable: runtime(1) }, "");
  const { adapter } = opened.sink;
  const { sessions } = opened.server;
  await sessions.check();
  const feature = await sessions.featureSession(opened.uraeda, FEATURE, { runtime: "durable" });
  const chat = await sessions.newChat(opened.uraeda, { runtime: "durable" });
  sessions.rename(opened.uraeda, chat.id, "Second chat");
  const first = held(adapter);
  const { turn: firstTurn } = await sessions.send(opened.uraeda, feature.id, { text: "Go on" });
  await first.started;
  const second = held(adapter);
  const { turn: secondTurn } = await sessions.send(opened.uraeda, chat.id, { text: "Go on" });
  await second.started;

  writeFiles(join(opened.configDir, "extensions", "durable"), runtime(2));
  await expect.poll(() => stateOf(opened.server, "durable")?.state).toBe("waiting");
  expect(stateOf(opened.server, "durable")?.waitingFor).toBe(FEATURE);

  first.ends();
  await sessions.settled(firstTurn);
  await expect.poll(() => stateOf(opened.server, "durable")?.waitingFor).toBe("Second chat");
  expect(opened.sink.activations).toBe(1);

  second.ends();
  await sessions.settled(secondTurn);
  await expect.poll(() => opened.sink.activations).toBe(2);
});

test("a built-in's settings change registers it again once its runtime's turns end", async () => {
  const claude = new FakeAdapter();
  const opened = await serve({}, "", { agents: { claude } });
  const { server } = opened;
  const { sessions } = server;
  await sessions.check();
  const register = vi.spyOn(server.extensions.runtimes, "register");
  const session = await sessions.featureSession(opened.uraeda, FEATURE, { runtime: "claude" });
  const turn = held(claude);
  const sent = await sessions.send(opened.uraeda, session.id, { text: "Go on" });
  await turn.started;

  const [written] = await mutate(server, "extensions.setSetting", {
    key: "command",
    name: "claude",
    repository: null,
    valueJson: '"claude-next"',
  });
  expect(written.ok).toBe(true);
  await expect.poll(() => stateOf(server, "claude")?.state).toBe("waiting");
  expect(stateOf(server, "claude")?.waitingFor).toBe(FEATURE);
  expect(register).not.toHaveBeenCalled();
  expect(server.extensions.runtimes.get("claude")).toBe(claude);

  turn.ends();
  await sessions.settled(sent.turn);
  await expect.poll(() => stateOf(server, "claude")?.state).toBe("on");
  expect(register).toHaveBeenCalledExactlyOnceWith("claude", claude);
  expect(sessions.runtimeOf(session.id)).toBe(claude);
});

test("a server given no agents has no fake runtime", async () => {
  const opened = await serve({}, "", { agents: null });

  expect(opened.server.extensions.runtimes.get("fake")).toBeUndefined();
  expect(opened.server.extensions.runtimes.get("claude")).toBeDefined();
  expect(stateOf(opened.server, "fake")?.state).toBe("off");
});

// Break: the extensions closed before the sessions stop watching the runtimes, as before.
test("a server stopping checks no runtime as its extensions unload", async () => {
  const opened = await serve({ durable: runtime(1) }, "");
  const { sessions } = opened.server;
  await sessions.check();
  expect(opened.sink.activations).toBe(1);
  const check = vi.spyOn(sessions, "check");

  await opened.server.stop();

  expect(check).not.toHaveBeenCalled();
});

test("a runtime's account problems are its extension's", async () => {
  const claude = new FakeAdapter();
  const opened = await serve({ durable: runtime(1) }, "", { agents: { claude } });
  const { server } = opened;
  await server.sessions.check();
  const accounts = new FakeAccounts();
  accounts.accounts = [account("b", 0.2)];
  accounts.problemList = ["account b is signed out, in ~/.claude-b"];
  claude.accounts = accounts;

  // The problem is the extension's own, with no file, and its state is still on.
  const row = stateOf(server, "claude");
  expect(row?.problems).toContainEqual({ file: "", message: accounts.problemList[0] });
  expect(row?.state).toBe("on");
  // A change of the runtimes announces the record: the status file, which `ura extension list`
  // reads, follows it.
  const status = () =>
    readFileSync(join(opened.dataDir, "run", STATUS_FILE), "utf8").includes("signed out");
  server.extensions.runtimes.changed();
  await expect.poll(status).toBe(true);
  // Signed in again: the next announce clears it.
  accounts.problemList = [];
  expect(stateOf(server, "claude")?.problems).toEqual([]);

  // A refresh that asked nothing announces nothing, even as pages read it.
  const { runtimes } = server.extensions;
  const changed = vi.spyOn(runtimes, "changed");
  const problems = vi.spyOn(runtimes, "accountsChanged");
  for (let read = 0; read < 3; read++) {
    server.sessions.refreshAccounts();
    await flush();
  }
  expect(accounts.asks).toBe(1);
  expect(changed).not.toHaveBeenCalled();
  expect(problems).not.toHaveBeenCalled();
  // One that read a change of the usage announces it, once, through the accounts' own hook: the
  // runtimes' versions are not asked again, and the problem it brings reaches the status file.
  const version = vi.spyOn(claude, "version");
  vi.spyOn(accounts, "refresh").mockImplementationOnce(async () => {
    accounts.accounts = [account("b", 0.9)];
    accounts.problemList = ["account b is signed out, in ~/.claude-b"];
  });
  rmSync(join(opened.dataDir, "run", STATUS_FILE), { force: true });
  server.sessions.refreshAccounts();
  await flush();
  expect(problems).toHaveBeenCalledTimes(1);
  expect(changed).not.toHaveBeenCalled();
  expect(version).not.toHaveBeenCalled();
  await expect.poll(status).toBe(true);

  // An extension's own runtime shows its accounts' problems too, as docs/extensions.md says.
  await expect.poll(() => opened.sink.activations).toBe(1);
  const mine = new FakeAccounts();
  mine.problemList = ["account x is signed out"];
  opened.sink.adapter.accounts = mine;
  expect(stateOf(server, "durable")?.problems).toContainEqual({
    file: "",
    message: "account x is signed out",
  });
  expect(stateOf(server, "durable")?.state).toBe("on");
  mine.problemList = [];
  expect(stateOf(server, "durable")?.problems).toEqual([]);
});
