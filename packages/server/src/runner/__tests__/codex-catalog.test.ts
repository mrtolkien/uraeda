import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { OpenOptions } from "../adapter.ts";
import { CodexAdapter } from "../codex.ts";
import { catalogPath, withoutSubAgents } from "../codex-catalog.ts";
import { appServer, message, until } from "./codex-stand-in.ts";

const tools = { token: "secret-token", url: "http://127.0.0.1:4000/mcp" };
const open: OpenOptions = { cwd: "/w", nativeId: "id", resume: false, skills: [], tools };

/** The lines a stand-in wrote to `<dir>/<name>`, none when it wrote none. */
const linesOf = (dir: string, name: string) =>
  existsSync(join(dir, name))
    ? readFileSync(join(dir, name), "utf8").split("\n").filter(Boolean)
    : [];

test("the catalog without sub-agents keeps every model and field, its sub-agents disabled", () => {
  expect(
    withoutSubAgents({
      models: [
        { multi_agent_version: "v2", slug: "gpt-6-luna" },
        { slug: "gpt-reserve", visibility: "hide" },
      ],
      version: 3,
    }),
  ).toEqual({
    models: [
      { multi_agent_version: "disabled", slug: "gpt-6-luna" },
      { multi_agent_version: "disabled", slug: "gpt-reserve", visibility: "hide" },
    ],
    version: 3,
  });
  expect(() => withoutSubAgents({ error: "signed out" })).toThrow(/no models/);
});

test("sessions opening together share one catalog of their folder's, never holding the open", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const other = temporaryFolder("uraeda-codex-other");
  const folder = join(dir, "catalog");
  const adapter = new CodexAdapter({
    catalogDir: folder,
    command: appServer(dir, { catalogMs: 1000 }),
    pluginDir: "/p",
  });
  const started = performance.now();
  const agents = [adapter.open({ ...open, cwd: dir }), adapter.open({ ...open, cwd: dir })];
  // `codex debug models` takes a second: the opens return before it ends.
  expect(performance.now() - started).toBeLessThan(500);
  agents.push(adapter.open({ ...open, cwd: other }));
  for (const agent of agents) {
    const events = agent.events[Symbol.asyncIterator]();
    agent.send(message("m1", "Hi"));
    await until(events, "result");
    agent.close();
    await until(events, "exit");
  }
  // One run per folder, in that folder, as its own Codex configuration may change the catalog.
  expect(linesOf(dir, "debug").sort()).toEqual([dir, other].sort());
  const own = catalogPath(folder, dir);
  expect(catalogPath(folder, other)).not.toBe(own);
  expect(JSON.parse(readFileSync(own, "utf8"))).toEqual({
    models: [{ multi_agent_version: "disabled", slug: "gpt-6-luna" }],
  });
  const argv = linesOf(dir, "argv").map((line) => JSON.parse(line) as Array<string>);
  expect(argv).toContainEqual(["app-server", "-c", `model_catalog_json=${JSON.stringify(own)}`]);
  expect(argv).toContainEqual([
    "app-server",
    "-c",
    `model_catalog_json=${JSON.stringify(catalogPath(folder, other))}`,
  ]);
});
