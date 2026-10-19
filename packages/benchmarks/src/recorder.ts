import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRecord, parseScores, type RunRecord, type Scores } from "./record.ts";

/** Which run a folder holds. */
export type RunFolder = {
  arm: "uraeda" | "plain";
  case: string;
  date: string;
  n: number;
  suite: string;
};

/** `<root>/runs/<date>-<suite>/<case>--<arm>--<n>`. */
export function runFolderPath(root: string, run: RunFolder): string {
  return join(root, "runs", `${run.date}-${run.suite}`, `${run.case}--${run.arm}--${run.n}`);
}

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * Writes a run's folder: its record and scores, a copy of the feature's `specs/` folder, and the
 * final diff. The raw transcripts already in `<folder>/transcripts/` stay there, outside git, and
 * the record keeps their SHA-256.
 */
export function writeRun(
  folder: string,
  input: {
    diff: string;
    record: Omit<RunRecord, "transcripts">;
    scores: Scores;
    specs?: string;
  },
): void {
  const transcripts = join(folder, "transcripts");
  mkdirSync(transcripts, { recursive: true });
  const record: RunRecord = {
    ...input.record,
    transcripts: readdirSync(transcripts)
      .toSorted()
      .map((file) => ({ file, sha256: sha256(join(transcripts, file)) })),
  };
  parseRecord(record);
  parseScores(input.scores);
  writeFileSync(join(folder, "record.json"), `${JSON.stringify(record, null, 2)}\n`);
  writeFileSync(join(folder, "scores.json"), `${JSON.stringify(input.scores, null, 2)}\n`);
  writeFileSync(join(folder, "final.diff"), input.diff);
  if (input.specs !== undefined) {
    cpSync(input.specs, join(folder, "specs"), { recursive: true });
  }
}

export type ListedRun = { folder: string; record: RunRecord; scores?: Scores };

/** Every run folder under `<root>/runs`, in name order. */
export function listRuns(root: string): Array<ListedRun> {
  const runs = join(root, "runs");
  let suites: Array<string>;
  try {
    suites = readdirSync(runs).toSorted();
  } catch {
    return [];
  }
  return suites.flatMap((suite) =>
    readdirSync(join(runs, suite))
      .toSorted()
      .map((name) => join(runs, suite, name))
      .filter((folder) => readdirSync(folder).includes("record.json"))
      .map((folder) => {
        const record = parseRecord(JSON.parse(readFileSync(join(folder, "record.json"), "utf8")));
        const scoresPath = join(folder, "scores.json");
        return readdirSync(folder).includes("scores.json")
          ? { folder, record, scores: parseScores(JSON.parse(readFileSync(scoresPath, "utf8"))) }
          : { folder, record };
      }),
  );
}
