import { afterEach, expect, test, vi } from "vite-plus/test";
import type { McpTool } from "../mcp/endpoint.ts";
import { McpTokens } from "../mcp/tokens.ts";
import { port, testApp } from "./helpers.ts";

const url = `http://127.0.0.1:${port}/mcp`;

afterEach(() => {
  vi.useRealTimers();
});

/** A tool the test answers: its calls are counted, and each waits for `answer`. */
function heldTool() {
  const held = {
    answer: (_text: string) => {},
    calls: 0,
    signal: undefined as AbortSignal | undefined,
  };
  const tool: McpTool = {
    call: (_session, _input, signal) => {
      held.calls += 1;
      held.signal = signal;
      return new Promise<string>((resolve) => {
        held.answer = resolve;
      });
    },
    description: "Waits for the test.",
    inputSchema: { type: "object" },
    name: "wait",
  };
  return { held, tool };
}

/** A JSON-RPC message posted with the given `Authorization` header. */
function post(authorization: string | undefined, message: object) {
  return {
    body: JSON.stringify({ jsonrpc: "2.0", ...message }),
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(authorization !== undefined && { authorization }),
    },
    method: "POST",
  };
}

/** A JSON-RPC `tools/call` of the held tool, with the given `Authorization` header. */
function call(authorization: string | undefined, progressToken?: string) {
  return post(authorization, {
    id: 7,
    method: "tools/call",
    params: { arguments: {}, name: "wait", ...(progressToken && { _meta: { progressToken } }) },
  });
}

/** The JSON-RPC messages of an event stream, in order. */
const messages = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));

// Break caught: a tool listed without the hint, which Claude Code then runs one call at a time, so
// a wave's implementers ran in turn.
test("every tool is listed as one an agent may call several times at once", async () => {
  const tokens = new McpTokens();
  const { app } = await testApp(undefined, {
    mcp: { tokens, tools: [heldTool().tool] },
    signIn: true,
  });
  const token = tokens.issue("session-1");

  const response = await app.request(
    url,
    post(`Bearer ${token}`, { id: 1, method: "tools/list", params: {} }),
  );

  const { result } = (await response.json()) as { result: { tools: Array<object> } };
  expect(result.tools).toEqual([
    {
      annotations: { readOnlyHint: true },
      description: "Waits for the test.",
      inputSchema: { type: "object" },
      name: "wait",
    },
  ]);
});

// US3 more 1, SC-003. Break caught: progress sent only at the start, the interval a single timeout.
test("a long call reports progress every 30 seconds", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  const tokens = new McpTokens();
  const { held, tool } = heldTool();
  const { app } = await testApp(undefined, { mcp: { tokens, tools: [tool] }, signIn: true });
  const token = tokens.issue("session-1");

  const response = await app.request(url, call(`Bearer ${token}`, "p1"));
  await vi.advanceTimersByTimeAsync(65_000);
  held.answer("done");
  const text = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  expect(messages(text)).toEqual([
    {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: { progress: 1, progressToken: "p1" },
    },
    {
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: { progress: 2, progressToken: "p1" },
    },
    { id: 7, jsonrpc: "2.0", result: { content: [{ text: "done", type: "text" }] } },
  ]);
});

// Review focus 3. Break caught: a revoked token still accepted.
test.each([
  ["no token", () => undefined],
  [
    "a revoked token",
    (tokens: McpTokens) => {
      const token = tokens.issue("session-1");
      tokens.revoke(token);
      return `Bearer ${token}`;
    },
  ],
  [
    "another process's token",
    (tokens: McpTokens) => {
      // The session's earlier process: its next one takes a new token.
      const earlier = tokens.issue("session-1");
      tokens.issue("session-1");
      return `Bearer ${earlier}`;
    },
  ],
  ["a token never issued", () => "Bearer not-a-token"],
] as const)("a call without its process's token is refused: %s", async (_, authorization) => {
  const tokens = new McpTokens();
  const { held, tool } = heldTool();
  const { app } = await testApp(undefined, { mcp: { tokens, tools: [tool] }, signIn: true });

  const response = await app.request(url, call(authorization(tokens)));

  expect(response.status).toBe(401);
  expect(await response.text()).toBe("Unauthorized");
  expect(held.calls).toBe(0);
});

// Wave 1 review. Break caught: null params read as an object, answering a 500.
test("a request with null params answers a JSON-RPC error", async () => {
  const tokens = new McpTokens();
  const { tool } = heldTool();
  const { app } = await testApp(undefined, { mcp: { tokens, tools: [tool] }, signIn: true });
  const token = tokens.issue("session-1");

  const response = await app.request(
    url,
    post(`Bearer ${token}`, { id: 7, method: "tools/call", params: null }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    error: { code: -32_602, message: "Unknown tool: undefined" },
    id: 7,
    jsonrpc: "2.0",
  });
});

// Wave 1 review. Break caught: a thrown string answered as `undefined`.
test.each([
  ["an error", new Error("No such feature.")],
  ["a string", "No such feature."],
])("a tool that throws %s answers it as an error", async (_, thrown) => {
  const tokens = new McpTokens();
  const tool: McpTool = {
    call: () => Promise.reject(thrown),
    description: "Throws.",
    inputSchema: { type: "object" },
    name: "wait",
  };
  const { app } = await testApp(undefined, { mcp: { tokens, tools: [tool] }, signIn: true });
  const token = tokens.issue("session-1");

  const response = await app.request(url, call(`Bearer ${token}`));

  expect(messages(await response.text())).toEqual([
    {
      id: 7,
      jsonrpc: "2.0",
      result: { content: [{ text: "No such feature.", type: "text" }], isError: true },
    },
  ]);
});

// Wave 1 review. Break caught: a client's cancellation ignored, its tool left running.
test.each([
  ["a dropped connection", (response: Response) => response.body?.cancel()],
  [
    "a cancellation",
    async (call: Response, app: Awaited<ReturnType<typeof testApp>>["app"], token: string) => {
      const cancelled = { method: "notifications/cancelled", params: { requestId: 7 } };
      const response = await app.request(url, post(`Bearer ${token}`, cancelled));
      expect(response.status).toBe(202);
      // The call's stream ends without a result: a cancelled request is never answered.
      expect(messages(await call.text())).toEqual([]);
    },
  ],
] as const)("%s aborts the tool's signal", async (_, stop) => {
  const tokens = new McpTokens();
  const { held, tool } = heldTool();
  const { app } = await testApp(undefined, { mcp: { tokens, tools: [tool] }, signIn: true });
  const token = tokens.issue("session-1");
  const response = await app.request(url, call(`Bearer ${token}`));
  // Another session's call of the same id is not this one.
  const cancelled = { method: "notifications/cancelled", params: { requestId: 7 } };
  await app.request(url, post(`Bearer ${tokens.issue("session-2")}`, cancelled));
  expect(held.signal?.aborted).toBe(false);

  await stop(response, app, token);

  expect(held.signal?.aborted).toBe(true);
});
