import { bool, list, number, object, oneOf, text } from "./schema.ts";

/** What a run ends as. */
export const OUTCOMES = ["finished", "stalled", "usage-limit", "failed", "invalid"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Commit = { commit: string; dirty: boolean };

export type Tokens = { cacheRead: number; cacheWrite: number; input: number; output: number };

/** One session of a run. */
export type Step = {
  cost: { amount: number; kind: "reported" | "estimated" };
  /** What the human did at a gate: answered, approved, changes requested. Empty elsewhere. */
  gate: string;
  role: "agent" | "human" | "judge" | "plain";
  seconds: number;
  /** The workflow step `ura next --json` named. */
  step: string;
  tokens: Tokens;
};

export type Blocked = { rule: string; target?: string; tool: string };

/** How a run went, its facts: `record.json`. */
export type RunRecord = {
  "approved-by": string;
  blocked: Array<Blocked>;
  effort: string;
  ended: string;
  harness: { name: string; version: string };
  human: { guidelines: string; model: string };
  models: { answered: Array<string>; asked: string };
  outcome: Outcome;
  repository: Commit;
  skill: Commit;
  started: string;
  steps: Array<Step>;
  task: { id: string; image: string; source: string };
  transcripts: Array<{ file: string; sha256: string }>;
  urls: Array<string>;
  version: 1;
};

/** The graders' results: `scores.json`. The plain arm has `tests` only. */
export type Scores = {
  questions?: number;
  requirements?: {
    covered: number;
    items: Array<{
      line?: string;
      requirement: string;
      verdict: "covered" | "partial" | "missing";
    }>;
    total: number;
  };
  revisions?: number;
  rounds?: number;
  tests: { passed: number; resolved: boolean; total: number };
};

const commit = object({ commit: text, dirty: bool });
const tokens = object({ cacheRead: number, cacheWrite: number, input: number, output: number });
const step = object({
  cost: object({ amount: number, kind: oneOf("reported", "estimated") }),
  gate: text,
  role: oneOf("agent", "human", "judge", "plain"),
  seconds: number,
  step: text,
  tokens,
});

const recordShape = object({
  "approved-by": text,
  blocked: list(object({ rule: text, target: text, tool: text }, ["target"])),
  effort: text,
  ended: text,
  harness: object({ name: text, version: text }),
  human: object({ guidelines: text, model: text }),
  models: object({ answered: list(text), asked: text }),
  outcome: oneOf(...OUTCOMES),
  repository: commit,
  skill: commit,
  started: text,
  steps: list(step),
  task: object({ id: text, image: text, source: text }),
  transcripts: list(object({ file: text, sha256: text })),
  urls: list(text),
  version: (value, path) => {
    if (value !== 1) {
      throw new Error(`${path}: expected the format 1`);
    }
  },
});

const scoresShape = object(
  {
    questions: number,
    requirements: object({
      covered: number,
      items: list(
        object({ line: text, requirement: text, verdict: oneOf("covered", "partial", "missing") }, [
          "line",
        ]),
      ),
      total: number,
    }),
    revisions: number,
    rounds: number,
    tests: object({ passed: number, resolved: bool, total: number }),
  },
  ["questions", "requirements", "revisions", "rounds"],
);

/** The record in `json`, or an error naming the field that is missing or wrong. */
export function parseRecord(json: unknown): RunRecord {
  recordShape(json, "");
  return json as RunRecord;
}

/** The scores in `json`, or an error naming the field that is missing or wrong. */
export function parseScores(json: unknown): Scores {
  scoresShape(json, "");
  return json as Scores;
}
