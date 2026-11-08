/** A stand-in for `codex app-server` and the helpers of the tests that run it. */
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentEvent } from "../events.ts";

/** Two pages of `model/list`, as Codex 0.163.0 gives them, a hidden model among them. */
export const PAGES = [
  {
    data: [
      {
        defaultReasoningEffort: "medium",
        description: "The default.",
        displayName: "GPT-6.1-Sol",
        hidden: false,
        id: "gpt-6.1-sol",
        isDefault: true,
        model: "gpt-6.1-sol",
        supportedReasoningEfforts: [
          { description: "", reasoningEffort: "low" },
          { description: "", reasoningEffort: "ultra" },
        ],
      },
      {
        defaultReasoningEffort: "medium",
        description: "",
        displayName: "GPT-Reserve",
        hidden: true,
        id: "gpt-reserve",
        isDefault: false,
        model: "gpt-reserve",
        supportedReasoningEfforts: [{ description: "", reasoningEffort: "low" }],
      },
    ],
    nextCursor: "2",
  },
  {
    data: [
      {
        defaultReasoningEffort: "low",
        description: "Fast.",
        displayName: "GPT-6-Luna",
        hidden: false,
        id: "gpt-6-luna",
        isDefault: false,
        model: "gpt-6-luna",
        supportedReasoningEfforts: [{ description: "", reasoningEffort: "xhigh" }],
      },
    ],
    nextCursor: null,
  },
];
export const CONFIG = { config: { model: "gpt-6-luna", model_reasoning_effort: "high" } };

/**
 * A stand-in for `codex app-server`, which runs no agent: it answers the requests a session makes
 * as Codex 0.163.0 does, from `PAGES` and `CONFIG`. A turn whose text says `ask` sends the client
 * a question and completes once answered; one that says `wait` completes when steered; any other
 * completes at once. It writes what it read to `<dir>/stdin`.
 */
export function appServer(dir: string): string {
  const agent = join(dir, "agent.cjs");
  writeFileSync(
    agent,
    `const { appendFileSync } = require("node:fs");
const pages = ${JSON.stringify(PAGES)};
const config = ${JSON.stringify(CONFIG)};
const out = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
let turns = 0;
let threadId = "t-1";
let waiting;
const note = (name, params) => out({ method: name, params });
const complete = (id, status) => note("turn/completed", { threadId, turn: { id, status } });
require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
  appendFileSync(${JSON.stringify(join(dir, "stdin"))}, line + "\\n");
  const message = JSON.parse(line);
  const ok = (result) => out({ id: message.id, result });
  const { params } = message;
  switch (message.method) {
    case undefined:
      if (message.id === "ask-1") complete(waiting, "completed");
      return;
    case "model/list": return ok(pages[params.cursor === "2" ? 1 : 0]);
    case "config/read": return ok(config);
    case "thread/start": ok({ thread: { id: "t-1" } }); return note("thread/started", { thread: { id: "t-1" } });
    case "thread/resume":
      threadId = params.threadId;
      return ok({ model: "gpt-6-luna", reasoningEffort: "xhigh", thread: { id: threadId } });
    case "turn/start": {
      const id = "turn-" + ++turns;
      ok({ turn: { id } });
      note("turn/started", { threadId, turn: { id } });
      const text = params.input[0].text;
      waiting = id;
      if (text.includes("ask")) return out({ id: "ask-1", method: "item/tool/requestUserInput", params: {} });
      if (!text.includes("wait")) complete(id, "completed");
      return;
    }
    case "turn/steer": ok({ turnId: params.expectedTurnId }); return complete(waiting, "completed");
    case "turn/interrupt": ok({}); return complete(waiting, "interrupted");
    default: return ok({});
  }
});
`,
  );
  const path = join(dir, "codex");
  writeFileSync(path, `#!/bin/sh\nexec "${process.execPath}" "${agent}" "$@"\n`);
  chmodSync(path, 0o755);
  return path;
}

/** The JSON lines the stand-in read on its stdin. */
export const written = (dir: string) =>
  readFileSync(join(dir, "stdin"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((text) => JSON.parse(text) as Record<string, unknown>);

/** Reads `events` until one of `type`, and gives all read. */
export async function until(events: AsyncIterator<AgentEvent>, type: AgentEvent["type"]) {
  const read: Array<AgentEvent> = [];
  for (;;) {
    const { done, value } = await events.next();
    if (done) {
      throw new Error(`no ${type} in ${JSON.stringify(read)}`);
    }
    read.push(value);
    if (value.type === type) {
      return read;
    }
  }
}

export const message = (id: string, text: string, when: "steer" | "queue" = "queue") => ({
  id,
  images: [],
  text,
  when,
});
