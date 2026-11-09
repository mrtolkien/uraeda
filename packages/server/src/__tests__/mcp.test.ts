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
  const held = { answer: (_text: string) => {}, calls: 0 };
  const tool: McpTool = {
    call: () => {
      held.calls += 1;
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
