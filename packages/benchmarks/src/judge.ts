import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "uraeda-server/runner/adapter";
import type { Scores } from "./record.ts";
import { runSession, type SessionResult } from "./session.ts";

type Requirements = NonNullable<Scores["requirements"]>;

/** The judge's message: one binary check per requirement of the proposal, against the spec alone. */
export function judgeMessage(proposal: string, spec: string): string {
  return `You check a specification against the requirements it was written from.

Below are a proposal, with its requirements section, and a specification. For each item of the
proposal's "Requirements" section, decide whether the specification states it:

- "covered": the specification states the requirement, with its details.
- "partial": the specification states some of it, or states it vaguely.
- "missing": the specification does not state it.

Quote, for each item you mark covered or partial, the line of the specification that covers it. Judge
only from these two texts. Answer with one JSON object in a \`\`\`json block and nothing after it:
{"items": [{"requirement": "<the item's text>", "verdict": "covered", "line": "<quoted line>"}]}

## Proposal

${proposal.trimEnd()}

## Specification

${spec.trimEnd()}
`;
}

const VERDICTS = ["covered", "partial", "missing"];

/** The items of the judge's answer, or an error saying what it could not read. */
export function parseVerdicts(answer: string): Requirements {
  const block = /```json\s*([\s\S]*?)```/.exec(answer)?.[1] ?? answer;
  const parsed = JSON.parse(block) as { items?: Array<Record<string, unknown>> };
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("the judge's answer has no items");
  }
  const items = parsed.items.map((item) => {
    if (typeof item.requirement !== "string" || !VERDICTS.includes(String(item.verdict))) {
      throw new Error(`the judge's item is not readable: ${JSON.stringify(item)}`);
    }
    const line = typeof item.line === "string" && item.line !== "" ? { line: item.line } : {};
    return {
      ...line,
      requirement: item.requirement,
      verdict: item.verdict as Requirements["items"][number]["verdict"],
    };
  });
  return {
    covered: items.filter((item) => item.verdict === "covered").length,
    items,
    total: items.length,
  };
}

/**
 * Judges each requirement of the proposal against the approved spec, in a session of its own: blind
 * to the arm, in an empty folder, with the two texts in its message. The session is returned too,
 * for the record's step.
 */
export async function judgeRequirements(options: {
  adapter: Adapter;
  proposal: string;
  spec: string;
}): Promise<{ requirements: Requirements; session: SessionResult }> {
  const cwd = mkdtempSync(join(tmpdir(), "benchmarks-judge-"));
  try {
    const session = await runSession({
      adapter: options.adapter,
      cwd,
      message: judgeMessage(options.proposal, options.spec),
    });
    return { requirements: parseVerdicts(session.text), session };
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
}
