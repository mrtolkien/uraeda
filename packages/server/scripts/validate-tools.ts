/**
 * The check of Uraeda's tools that `validate-claude.ts` and `validate-codex.ts` share: a session
 * given a stand-in of the tool on a temporary `/mcp` calls it, waits past its progress for its
 * answer, 70 seconds later, and has no built-in sub-agent of its own, and the agent's settings file
 * is left byte for byte as it was.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Adapter, OpenOptions } from "../src/runner/adapter.ts";
import type { AgentEvent } from "../src/runner/events.ts";
import { mcpRoutes } from "../src/mcp/endpoint.ts";
import { McpTokens } from "../src/mcp/tokens.ts";

/** The stand-in's call answers after this long, past two progress reports. */
const CALL_MS = 70_000;
/** A turn that has not ended after this long is stopped, and its check fails. */
const TURN_TIMEOUT_MS = 360_000;
/** The tool names that start an agent's own sub-agent: Claude Code's, then Codex's. */
const SUB_AGENT_TOOLS = ["Agent", "Task", "Workflow", "TeamCreate", "spawnAgent", "spawn_agent"];

type Report = (name: string, ok: boolean, got: unknown) => void;

/** A temporary `/mcp` serving a stand-in of `run_agent`, which answers `answer` after 70 s. */
async function standIn() {
  const tokens = new McpTokens();
  const token = tokens.issue("validation");
  const answer = `answer-${randomUUID().slice(0, 8)}`;
  const seen = { calls: 0, refused: 0 };
  const app = new Hono();
  app.use(async (context, next) => {
    await next();
    if (context.res.status === 401) {
      seen.refused += 1;
    }
  });
  const tool = {
    async call(_session: string, _input: unknown, signal: AbortSignal) {
      seen.calls += 1;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, CALL_MS);
        signal.addEventListener("abort", () => clearTimeout(timer));
      });
      return answer;
    },
    description: "Starts a sub-agent and answers its last message. Takes about 70 seconds.",
    inputSchema: { properties: { task: { type: "string" } }, type: "object" },
    name: "run_agent",
  };
  app.route("/mcp", mcpRoutes({ tokens, tools: [tool] }));
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { answer, close, seen, tools: { token, url: `http://127.0.0.1:${port}/mcp` } };
}

/** Opens a session given `tools`, sends `text`, and reads its turn, each event with its time. */
async function turn(adapter: Adapter, options: OpenOptions, text: string) {
  const agent = adapter.open(options);
  const timeout = setTimeout(() => agent.kill("SIGKILL"), TURN_TIMEOUT_MS);
  const sent = Date.now();
  const events: Array<{ at: number; event: AgentEvent }> = [];
  agent.send({ id: randomUUID(), images: [], text, when: "queue" });
  try {
    for await (const event of agent.events) {
      events.push({ at: Date.now() - sent, event });
      if (event.type === "result" || (event.type === "init" && event.problem !== undefined)) {
        agent.close();
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  return events;
}

/**
 * The check: a session in `cwd`, on `pick`, given the stand-in, calls it once, and its turn says
 * the answer; the call lasted the 70 seconds; asked to start a sub-agent of its own if it can, it
 * starts none; and
 * `settings`, the agent's settings file, is unchanged.
 */
export async function toolsCheck(
  adapter: Adapter,
  {
    cwd,
    pick,
    report,
    settings,
    spawned = () => [],
  }: {
    cwd: string;
    pick: Partial<OpenOptions>;
    report: Report;
    settings: string;
    /** The sub-agents a session started that its events do not show, by its agent's session ID. */
    spawned?: (sessionId: string) => Array<unknown>;
  },
) {
  const before = existsSync(settings) ? readFileSync(settings) : undefined;
  const tool = await standIn();
  try {
    const events = await turn(
      adapter,
      { cwd, nativeId: randomUUID(), resume: false, skills: [], ...pick, tools: tool.tools },
      [
        'First call the `run_agent` tool of the `uraeda` MCP server once, with `{"task": "validate"}`, and wait for its answer: it takes about 70 seconds.',
        "Then, only if you have a built-in tool that starts a sub-agent of your own (as Agent, Task, or spawn_agent), use it once to start a sub-agent whose whole job is to reply with the word hi. If you have none, do not look for one.",
        "Finally reply with the exact text `run_agent` answered, and nothing else.",
      ].join(" "),
    );
    const starts = events.flatMap(({ at, event }) =>
      event.type === "toolStart" ? [{ at, ...event }] : [],
    );
    const call = starts.find((start) => start.name === "mcp__uraeda__run_agent");
    const end = events.find(({ event }) => event.type === "toolEnd" && event.id === call?.id);
    const ended = end?.event.type === "toolEnd" ? end.event : undefined;
    const said = events
      .flatMap(({ event }) => (event.type === "text" ? [event.text] : []))
      .join("\n");
    const lasted = call && end ? end.at - call.at : undefined;
    report(
      `a session given Uraeda's tool calls it and gets its answer after ${lasted} ms`,
      tool.seen.calls >= 1 &&
        ended?.isError === false &&
        ended.output.includes(tool.answer) &&
        lasted !== undefined &&
        lasted >= CALL_MS - 1000 &&
        said.includes(tool.answer),
      {
        ended,
        said,
        seen: tool.seen,
        summary: events
          .filter(({ event }) => !["textDelta", "activity", "usage", "tokens"].includes(event.type))
          .slice(0, 40),
      },
    );
    const init = events.find(({ event }) => event.type === "init")?.event;
    const own = [
      ...starts.filter(
        (start) => start.subagent !== undefined || SUB_AGENT_TOOLS.includes(start.name),
      ),
      ...(init?.type === "init" && init.sessionId !== "" ? spawned(init.sessionId) : []),
    ];
    report("a session given Uraeda's tool starts no sub-agent of its own", own.length === 0, own);
  } finally {
    await tool.close();
    const after = existsSync(settings) ? readFileSync(settings) : undefined;
    report(
      `${settings} is left byte for byte as it was`,
      before === undefined || after === undefined ? before === after : before.equals(after),
      { after: after?.length ?? "absent", before: before?.length ?? "absent" },
    );
  }
}
