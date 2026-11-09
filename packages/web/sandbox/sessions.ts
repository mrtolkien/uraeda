// The sample project's sessions, seeded in the sandbox's data folder through the session manager
// (R2): scripted turns on the sandbox's agent, so the runner alone writes the stored shape.
import { join } from "node:path";
import type { AgentEvent } from "uraeda-server/runner/events";
import { fakeSessions } from "uraeda-server/testing";
import { sandboxAgent } from "./agent.ts";
import { seedLiveSession } from "./liveSession.ts";
import { REALISTIC_FOLDERS, ROUND_MOCKUPS } from "../samples/index.ts";

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
      {
        id: "round",
        input: { file_path: `specs/${ROUND_MOCKUPS.waiting}/clarifications-01.md` },
        kind: "read",
        name: "Read",
        target: `specs/${ROUND_MOCKUPS.waiting}/clarifications-01.md`,
        type: "toolStart",
      },
      { id: "round", isError: false, output: "# Questions", type: "toolEnd" },
      {
        text: [
          "The round's options A and C each show a prototype:",
          "",
          `[A new task under the completed one](specs/${ROUND_MOCKUPS.waiting}/mockups/new-task.svg)`,
          "",
          `![The same task, its due date moved](/specs/${ROUND_MOCKUPS.waiting}/mockups/moved-date.svg)`,
        ].join("\n"),
        type: "text",
      },
    ],
    text: "Show me the round's prototypes",
  },
  {
    script: [
      {
        id: "personas",
        input: { file_path: "README.md" },
        kind: "read",
        name: "Read",
        target: "README.md",
        type: "toolStart",
      },
      { id: "personas", isError: false, output: "# Todo", type: "toolEnd" },
      {
        text: [
          "What the book asks of a persona, and what ours have:",
          "",
          "| Section | Book | Our personas today |",
          "| --- | --- | --- |",
          "| **Info** | Name, a short tagline, age, job, and a photo, all reflecting what a real group shares | Name and device only |",
          "| **Details** | A short life story, behaviours, frustrations, goals and motivations, the tasks they do with the product | Mostly behaviours: input method, screen, rules a view must follow |",
          "| **Insights** | Their attitude and mindset, in direct quotes | None |",
          '| **Lens** (journey maps) | Persona + scenario + expectation ("Jane orders a ride and expects it within 10 minutes") | None. This is where "workflow" fits. |',
          "",
          "A table this wide takes the room right of the session, and scrolls past it.",
          "",
          "| Step | Reads | Writes | Waits on | Ends at | Commit | Next step |",
          "| --- | --- | --- | --- | --- | --- | --- |",
          "| Discovery | The proposal, the constitution, the decisions | `discovery-01.md`, `clarifications-01.md` | Nothing | The round's gate | `discovery(<slug>): <what it asks>` | The spec, once the round is answered |",
          "| Spec | The answered rounds, the notes | `spec.md`, the proposed decisions | The answers | The spec's gate | `spec(<slug>): <title>` | The approval, then the plan |",
        ].join("\n"),
        type: "text",
      },
    ],
    text: "Compare our personas with the book's",
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
      {
        type: "usage",
        windows: [{ id: "five_hour", label: "5h", resetsAt: "2026-10-16T15:00:00.000Z", used: 1 }],
      },
      result({ errors: [USAGE_LIMIT], ok: false }),
    ],
    text: "Add a dark theme",
  },
];

/** Runs `work` on the sessions of `dataDir`'s `runner.sqlite`, then closes them, releasing the file. */
async function withSessions(
  dataDir: string,
  work: (seeded: ReturnType<typeof fakeSessions>) => Promise<void>,
): Promise<void> {
  const seeded = fakeSessions({
    adapter: sandboxAgent({ wait: async () => {} }),
    cache: join(dataDir, "runner.sqlite"),
  });
  const { sessions } = seeded;
  try {
    await sessions.check();
    await work(seeded);
  } finally {
    await sessions.closeAll();
    sessions.close();
    sessions.cache.db.close();
  }
}

/**
 * Writes the sample project's sessions in `dataDir`'s `runner.sqlite`: three finished chats, the
 * second showing the round mockup's SVG prototypes, the third a table wider than the session's
 * column, and chats that failed, were stopped, and were
 * stopped by the usage limit; and with `realistic`, its leader key's spec session
 * (`seedRealisticSession`). The turn at work is not one: the sandbox starts it
 * as it starts, with `atWork`.
 */
export async function seedSessions(
  dataDir: string,
  sample: string,
  realistic?: string,
): Promise<void> {
  await withSessions(dataDir, async ({ adapter, sessions }) => {
    for (const { script, text } of CHATS) {
      const chat = await sessions.newChat(sample);
      adapter.script(script);
      const { turn } = await sessions.send(sample, chat.id, { text });
      await sessions.settled(turn);
    }
  });
  if (realistic !== undefined) {
    await seedRealisticSession(dataDir, realistic);
  }
}

/**
 * Writes the realistic project's session in `dataDir`'s `runner.sqlite`: its leader key's spec
 * session as a live run left it (`liveSession.ts`). The cache is closed after, releasing the file.
 */
export async function seedRealisticSession(dataDir: string, realistic: string): Promise<void> {
  await withSessions(dataDir, async ({ sessions }) => {
    // Under the repository's root as every session's, a path through a link resolved.
    seedLiveSession(
      sessions.cache,
      await sessions.mainRoot(realistic),
      REALISTIC_FOLDERS.reviewing,
    );
  });
}
