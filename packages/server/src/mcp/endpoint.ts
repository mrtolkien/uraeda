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

/** The protocol versions the endpoint speaks, the latest first: a client's own is answered back. */
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

/** How often a running call reports progress: an agent drops a call silent for long. */
export const PROGRESS_EVERY_MS = 30_000;

/** The largest message the endpoint reads. */
const MAX_BODY = 1024 * 1024;

type Id = string | number;
type Message = { id?: Id; method?: unknown; params?: Record<string, unknown> };

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

/** A tool's answer as a call's result: a tool that throws answers its message as an error. */
async function answer(tool: McpTool, session: string, input: unknown, signal: AbortSignal) {
  try {
    const text = await tool.call(session, input, signal);
    return { content: [{ text, type: "text" }] };
  } catch (error) {
    return { content: [{ text: (error as Error).message, type: "text" }], isError: true };
  }
}

/**
 * A call answered as an event stream: a progress notification every `every` milliseconds with the
 * client's progress token, a comment without one, so the connection never goes silent, then the
 * result. A dropped connection aborts the tool's signal.
 */
function callStream(
  id: Id,
  call: { input: unknown; progressToken: unknown; session: string; tool: McpTool },
  every: number,
): Response {
  const aborted = new AbortController();
  let timer: ReturnType<typeof setInterval> | undefined;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      clearInterval(timer);
      aborted.abort();
    },
    start(out) {
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
        clearInterval(timer);
        if (!aborted.signal.aborted) {
          out.enqueue(event(result(id, value)));
          out.close();
        }
      });
    },
  });
  return new Response(body, {
    headers: { "cache-control": "no-cache", "content-type": "text/event-stream" },
  });
}

/** The answer to one request, a JSON-RPC message, or the stream of a call. */
function respond(
  context: Context,
  message: Message & { id: Id },
  session: string,
  { every, tools }: { every: number; tools: ReadonlyArray<McpTool> },
): Response {
  const { id, params = {} } = message;
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
          tools: tools.map(({ description, inputSchema, name }) => ({
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
      return callStream(id, call, every);
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
 * of why; the tool runs for that token's session. Notifications are accepted with 202, a `GET`'s
 * stream is refused with 405, and a batch with an error.
 */
export function mcpRoutes({
  every = PROGRESS_EVERY_MS,
  tokens,
  tools,
}: McpOptions & { every?: number }) {
  const routes = new Hono<{ Variables: { mcpSession: string } }>();
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
    if (typeof message !== "object" || message === null || Array.isArray(message)) {
      return context.json(failure(null, -32_600, "Invalid request"), 400);
    }
    const { id } = message as Message;
    if (typeof id !== "string" && typeof id !== "number") {
      // A notification, or a response to the server, which never asks: nothing to answer.
      return context.body(null, 202);
    }
    const session = context.get("mcpSession");
    return respond(context, { ...(message as Message), id }, session, { every, tools });
  });
  routes.all("/", (context) => context.text("Method Not Allowed", 405, { allow: "POST" }));
  return routes;
}
