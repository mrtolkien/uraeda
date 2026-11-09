// The sub-sessions of the feature page's building feature (spec of Run options), as the runner's
// cache keeps them: its build's wave of three implementers, one at work, one done, one failed, and
// two reviewers of the wave before, one at work on Codex's review and one stopped. Those at work
// wait to continue after their agent's limit, as a stored running turn would be stopped once the
// server starts.
import { type RecordedSubSession, recordSubSessions } from "uraeda-server/testing";
import { FEATURE_PAGES } from "./folders.ts";

/** A run at work: failed at its agent's limit, it waits to continue, long after the stories. */
const atLimit = (at: string, ended: string, text: string) => ({
  at,
  continues: "2099-01-01T00:00:00Z",
  ended,
  state: "failed" as const,
  text,
});

const SUB_SESSIONS: ReadonlyArray<RecordedSubSession> = [
  {
    about: "Task 4: Next due date on completion",
    agent: "claude",
    effort: "Low",
    model: "Sonnet 5.5",
    role: "implementer",
    run: atLimit(
      "2026-10-17T15:09:00Z",
      "2026-10-17T15:14:00Z",
      "The next due date reads the task's rule.",
    ),
  },
  {
    about: "Task 5: The repeat icon in the list",
    agent: "claude",
    effort: "Low",
    model: "Sonnet 5.5",
    role: "implementer",
    run: {
      at: "2026-10-17T15:09:00Z",
      ended: "2026-10-17T15:21:00Z",
      state: "done",
      text: "Task 5 is done: the list shows the repeat icon beside a recurring task's title.",
      tokens: { cacheRead: 4_120_000, cacheWrite: 640_000, input: 15_000, output: 14_200 },
    },
  },
  {
    about: "Task 6: Upgrade the saved due dates",
    agent: "codex",
    effort: "Medium",
    model: "GPT-6.1-Sol",
    role: "implementer",
    run: {
      at: "2026-10-17T15:09:00Z",
      ended: "2026-10-17T15:17:00Z",
      state: "failed",
      text: "The upgrade's test fails: a saved date without a time zone reads as UTC.",
    },
  },
  {
    about: "Wave 1, through Codex's review",
    agent: "codex",
    effort: "High",
    model: "GPT-6.1-Sol",
    role: "reviewer",
    run: atLimit("2026-10-17T15:05:00Z", "2026-10-17T15:08:00Z", "Codex's review reads the wave."),
  },
  {
    about: "Wave 1",
    agent: "claude",
    effort: "High",
    model: "Opus 5.5",
    role: "reviewer",
    run: {
      at: "2026-10-17T15:04:00Z",
      ended: "2026-10-17T15:05:00Z",
      state: "stopped",
      text: "Reading the wave's commits.",
      tokens: { cacheRead: 9_800_000, cacheWrite: 1_220_000, input: 20_000, output: 21_000 },
    },
  },
];

/** Writes the building feature's sub-sessions in `dataDir`'s cache, once its runs are recorded. */
export function recordSubSessionRuns(dataDir: string, repo: string) {
  recordSubSessions(dataDir, repo, FEATURE_PAGES.working, SUB_SESSIONS);
}
