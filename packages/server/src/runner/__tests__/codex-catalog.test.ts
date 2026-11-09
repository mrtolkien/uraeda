import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { OpenOptions } from "../adapter.ts";
import { CodexAdapter } from "../codex.ts";
import { catalogPath, CodexCatalogs, withoutSubAgents } from "../codex-catalog.ts";
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
    command: appServer(dir),
    pluginDir: "/p",
  });
  const agents = [adapter.open({ ...open, cwd: dir }), adapter.open({ ...open, cwd: dir })];
  // The opens return before `codex debug models` ran: a run that held them wrote the catalog first.
  expect(existsSync(catalogPath(folder, dir))).toBe(false);
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

test("a session whose catalog cannot be written says Codex's sub-agents may run in it", async () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const dir = temporaryFolder("uraeda-codex");
    const agent = new CodexAdapter({
      catalogDir: join(dir, "catalog"),
      command: appServer(dir, { catalogFails: true }),
      pluginDir: "/p",
    }).open({ ...open, cwd: dir });
    const events = agent.events[Symbol.asyncIterator]();
    agent.send(message("m1", "Hi"));
    const read = await until(events, "result");
    expect(read).toContainEqual({
      text: expect.stringContaining("Codex's own sub-agents may run in this session"),
      type: "notice",
    });
    expect(read.at(-1)).toMatchObject({ ok: true, type: "result" });
    agent.close();
    await until(events, "exit");
    expect(linesOf(dir, "argv")).toEqual([JSON.stringify(["app-server"])]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Codex's sub-agents stay on"));
  } finally {
    log.mockRestore();
  }
});

test("a catalog that cannot be put in place leaves no temporary file", async () => {
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const dir = temporaryFolder("uraeda-codex");
    const folder = join(dir, "catalog");
    const path = catalogPath(folder, dir);
    // A folder where the catalog goes: the rename fails.
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "kept"), "");
    const catalog = await new CodexCatalogs(appServer(dir), folder).write(dir);
    expect(catalog).toHaveProperty("problem");
    expect(readdirSync(dirname(path))).toEqual([basename(path)]);
  } finally {
    log.mockRestore();
  }
});
