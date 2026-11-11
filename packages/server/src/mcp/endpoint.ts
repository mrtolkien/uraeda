// The MCP endpoint the workflow's agents reach Uraeda's tools at: MCP's streamable HTTP transport,
// stateless, for the four messages a client of tools sends.
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { McpTokens } from "./tokens.ts";

/** A tool of the endpoint: `call` answers its text, and throws to answer an error. */
export type McpTool = {
  /** Runs the tool for `session`'s process: `signal` aborts as its connection drops. */
  call(session: string, input: unknown, signal: AbortSignal): Promise<string>;
  description: string;
  /** The JSON schema of the tool's arguments. */
  inputSchema: object;
  name: string;
};

/** The server's address, `http://127.0.0.1:<port>`, which the agents reach `/mcp` at. */
export type ServerAddress = { url: string };

/** The endpoint's tokens and tools: tools are read at each request, so they may be added later. */
export type McpOptions = { tokens: McpTokens; tools: ReadonlyArray<McpTool> };

/**
 * The protocol versions the endpoint speaks, the latest first: a client's own is answered back.
 * 2025-03-26 stays for older clients, though its JSON-RPC batches are refused with an error.
 */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

/** How often a running call reports progress: an agent drops a call silent for long. */
export const PROGRESS_EVERY_MS = 30_000;

/** The largest message the endpoint reads. */
const MAX_BODY = 1024 * 1024;

type Id = string | number;
type Message = { id?: Id; method?: unknown; params?: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const encoder = new TextEncoder();

/** A JSON-RPC message as an event of a stream. */
const event = (message: object) =>
  encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`);

const result = (id: Id, value: object) => ({ id, jsonrpc: "2.0", result: value });

const failure = (id: Id | null, code: number, message: string) => ({
  error: { code, message },
  id,
  jsonrpc: "2.0",
});

/**
 * A tool's answer as a call's result: a tool that throws answers its error's message, or what it
 * threw as text, as an error.
 */
async function answer(tool: McpTool, session: string, input: unknown, signal: AbortSignal) {
  try {
    const text = await tool.call(session, input, signal);
    return { content: [{ text, type: "text" }] };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { content: [{ text, type: "text" }], isError: true };
  }
}

/**
 * A call answered as an event stream: a progress notification every `every` milliseconds with the
 * client's progress token, a comment without one, so the connection never goes silent, then the
 * result. A dropped connection aborts the tool's signal, as `aborted` does, which ends the stream
 * without a result; `done` runs once the call is over, either way.
 */
function callStream(
  id: Id,
  call: { input: unknown; progressToken: unknown; session: string; tool: McpTool },
  { aborted, done, every }: { aborted: AbortController; done: () => void; every: number },
): Response {
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      closed = true;
      aborted.abort();
    },
    start(out) {
      const close = () => {
        clearInterval(timer);
        done();
        if (!closed) {
          closed = true;
          out.close();
        }
      };
      aborted.signal.addEventListener("abort", close);
      let progress = 0;
      timer = setInterval(() => {
        const { progressToken } = call;
        progress += 1;
        out.enqueue(
          progressToken === undefined
            ? encoder.encode(": working\n\n")
            : event({
                jsonrpc: "2.0",
                method: "notifications/progress",
                params: { progress, progressToken },
              }),
        );
      }, every);
      void answer(call.tool, call.session, call.input, aborted.signal).then((value) => {
        if (!aborted.signal.aborted) {
          out.enqueue(event(result(id, value)));
        }
        close();
      });
    },
  });
  return new Response(body, {
    headers: { "cache-control": "no-cache", "content-type": "text/event-stream" },
  });
}

/** The key of a call in the running ones: its session's, as two sessions' ids may be the same. */
const callKey = (session: string, id: Id) => JSON.stringify([session, id]);

/** The answer to one request, a JSON-RPC message, or the stream of a call. */
function respond(
  context: Context,
  message: Message & { id: Id },
  session: string,
  {
    every,
    running,
    tools,
  }: { every: number; running: Map<string, AbortController>; tools: ReadonlyArray<McpTool> },
): Response {
  const { id } = message;
  // Params absent, null, or not an object are read as none: a missing name answers its error.
  const params = isObject(message.params) ? message.params : {};
  switch (message.method) {
    case "initialize": {
      const asked = params.protocolVersion;
      return context.json(
        result(id, {
          capabilities: { tools: {} },
          protocolVersion:
            typeof asked === "string" && VERSIONS.includes(asked) ? asked : VERSIONS[0],
          serverInfo: { name: "uraeda", version: "1" },
        }),
      );
    }
    case "ping":
      return context.json(result(id, {}));
    case "tools/list":
      return context.json(
        result(id, {
          // `readOnlyHint` is what lets an agent run several calls of a turn at once: Claude Code
          // runs a tool without it one call after another, so a wave's implementers ran in turn.
          // None of the tools changes the caller's own checkout: an implementer works in its
          // task's worktree, and a review changes nothing.
          tools: tools.map(({ description, inputSchema, name }) => ({
            annotations: { readOnlyHint: true },
            description,
            inputSchema,
            name,
          })),
        }),
      );
    case "tools/call": {
      const tool = tools.find((each) => each.name === params.name);
      if (!tool) {
        return context.json(failure(id, -32_602, `Unknown tool: ${String(params.name)}`));
      }
      const meta = params._meta as { progressToken?: unknown } | undefined;
      const call = {
        input: params.arguments ?? {},
        progressToken: meta?.progressToken,
        session,
        tool,
      };
      const key = callKey(session, id);
      const aborted = new AbortController();
      running.set(key, aborted);
      const done = () => {
        if (running.get(key) === aborted) {
          running.delete(key);
        }
      };
      return callStream(id, call, { aborted, done, every });
    }
    default:
      return context.json(failure(id, -32_601, `Unknown method: ${String(message.method)}`));
  }
}

/**
 * The `/mcp` routes, mounted at `/mcp`: MCP's streamable HTTP transport, stateless, for
 * `initialize`, `ping`, `tools/list`, and `tools/call`, the last answered as an event stream with
 * progress every `every` milliseconds, 30 seconds by default, until the tool answers. Every request
 * needs `Authorization: Bearer <token>` of a process `tokens` issued, or gets 401, saying nothing
 * of why; the tool runs for that token's session. Notifications are accepted with 202, and a
 * `notifications/cancelled` of a call of the same session aborts it; a `GET`'s stream is refused
 * with 405, and a batch with an error.
 */
export function mcpRoutes({
  every = PROGRESS_EVERY_MS,
  tokens,
  tools,
}: McpOptions & { every?: number }) {
  const routes = new Hono<{ Variables: { mcpSession: string } }>();
  const running = new Map<string, AbortController>();
  routes.use(async (context, next) => {
    const session = tokens.sessionOf(context.req.header("authorization"));
    if (session === undefined) {
      return context.text("Unauthorized", 401);
    }
    context.set("mcpSession", session);
    await next();
  });
  routes.post("/", bodyLimit({ maxSize: MAX_BODY }), async (context) => {
    let message: unknown;
    try {
      message = await context.req.json();
    } catch {
      return context.json(failure(null, -32_700, "Parse error"), 400);
    }
    if (!isObject(message)) {
      return context.json(failure(null, -32_600, "Invalid request"), 400);
    }
    const { id, method, params } = message as Message;
    const session = context.get("mcpSession");
    if (typeof id !== "string" && typeof id !== "number") {
      // A notification, or a response to the server, which never asks: nothing to answer.
      const requestId = isObject(params) ? params.requestId : undefined;
      if (
        method === "notifications/cancelled" &&
        (typeof requestId === "string" || typeof requestId === "number")
      ) {
        running.get(callKey(session, requestId))?.abort();
      }
      return context.body(null, 202);
    }
    return respond(context, { ...(message as Message), id }, session, { every, running, tools });
  });
  routes.all("/", (context) => context.text("Method Not Allowed", 405, { allow: "POST" }));
  return routes;
}
