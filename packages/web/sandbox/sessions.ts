// The sample project's sessions, seeded in the sandbox's data folder through the session manager
// (R2): scripted turns on the sandbox's agent, so the runner alone writes the stored shape.
import { join } from "node:path";
import type { AgentEvent } from "uraeda-server/runner/events";
import { fakeSessions } from "uraeda-server/testing";
import { sandboxAgent } from "./agent.ts";

/** A turn's end, as the agent reports it. */
function result(end: Partial<Extract<AgentEvent, { type: "result" }>> = {}): AgentEvent {
  return { denials: [], errors: [], interrupted: false, ok: true, type: "result", ...end };
}

/** The usage limit's error, as Claude Code ends a turn with it. */
const USAGE_LIMIT = "Claude AI usage limit reached. Your limit resets at 3pm.";

/** Each sample chat: its message, and the turn the agent plays for it. */
const CHATS: Array<{ script: Array<AgentEvent>; text: string }> = [
  {
    script: [
      {
        id: "readme",
        input: { file_path: "README.md" },
        kind: "read",
        name: "Read",
        target: "README.md",
        type: "toolStart",
      },
      { id: "readme", isError: false, output: "# Todo", type: "toolEnd" },
      {
        text: "The README describes the todo app: its tasks, their due dates, and how they repeat.",
        type: "text",
      },
    ],
    text: "What does the README say?",
  },
  {
    script: [
      { text: "Looking at the failing test.", type: "text" },
      result({ errors: ["API Error: 500 Internal server error"], ok: false }),
    ],
    text: "Why does the due date test fail?",
  },
  {
    script: [
      { text: "Starting on the list's sort order.", type: "text" },
      result({ interrupted: true, ok: false }),
    ],
    text: "Sort the list by due date",
  },
  {
    script: [
      { fiveHour: { percentUsed: 100, resetsAt: "2026-10-16T15:00:00.000Z" }, type: "usage" },
      result({ errors: [USAGE_LIMIT], ok: false }),
    ],
    text: "Add a dark theme",
  },
];

/**
 * Writes the sample project's sessions in `dataDir`'s `runner.sqlite`: a finished chat, and chats
 * that failed, were stopped, and were stopped by the usage limit. The turn at work is not one: the
 * sandbox starts it as it starts, with `atWork`. The cache is closed after, releasing the file.
 */
export async function seedSessions(dataDir: string, sample: string): Promise<void> {
  const { adapter, sessions } = fakeSessions({
    adapter: sandboxAgent({ wait: async () => {} }),
    cache: join(dataDir, "runner.sqlite"),
  });
  try {
    await sessions.check();
    for (const { script, text } of CHATS) {
      const chat = await sessions.newChat(sample);
      adapter.script(script);
      const { turn } = await sessions.send(sample, chat.id, { text });
      await sessions.settled(turn);
    }
  } finally {
    await sessions.closeAll();
    sessions.close();
    sessions.cache.db.close();
  }
}
