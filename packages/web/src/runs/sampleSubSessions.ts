// The sub-sessions the stories draw (spec of Run options): a build's wave of three implementers,
// one working, one done, one failed, and two reviewers of the wave before, one working on Codex's
// review and one stopped. Those at work started a few minutes before the story opens.
import type { SubSession } from "./subSessions.ts";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** The sub-sessions of the build's session `parent`, in mixed states. */
export function sampleSubSessions(parent: string): Array<SubSession> {
  return [
    {
      about: "Task 4: Next due date on completion",
      agent: "claude",
      effort: "Low",
      id: `${parent}-sub-1`,
      model: "Sonnet 5.5",
      parent,
      role: "implementer",
      startedAt: ago(6),
      state: "working",
      usage: { input: 412_000, output: 9800 },
    },
    {
      about: "Task 5: The repeat icon in the list",
      agent: "claude",
      effort: "Low",
      endedAt: ago(2),
      id: `${parent}-sub-2`,
      model: "Sonnet 5.5",
      parent,
      role: "implementer",
      startedAt: ago(14),
      state: "done",
      usage: { input: 655_000, output: 14_200 },
    },
    {
      about: "Task 6: Upgrade the saved due dates",
      agent: "codex",
      effort: "Medium",
      endedAt: ago(1),
      id: `${parent}-sub-3`,
      model: "GPT-6.1-Sol",
      parent,
      role: "implementer",
      startedAt: ago(9),
      state: "failed",
    },
    {
      about: "Wave 1, through Codex's review",
      agent: "codex",
      effort: "High",
      id: `${parent}-sub-4`,
      model: "GPT-6.1-Sol",
      parent,
      role: "reviewer",
      startedAt: ago(3),
      state: "working",
    },
    {
      about: "Wave 1",
      agent: "claude",
      effort: "High",
      endedAt: ago(4),
      id: `${parent}-sub-5`,
      model: "Opus 5.5",
      parent,
      role: "reviewer",
      startedAt: ago(5),
      state: "stopped",
      usage: { input: 1_240_000, output: 21_000 },
    },
  ];
}
