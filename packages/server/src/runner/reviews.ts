// The reviews of a feature (the run options decision): every reviewer of a review runs at once, an
// agent through its own review in a sub-session of the feature, a command the human wrote in the
// feature's worktree, and their findings are committed in `findings-NN.md` before they are fixed.
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { McpTool } from "../mcp/endpoint.ts";
import { reasonOf } from "../reason.ts";
import { type Reviewer, type StepPick, toMap } from "../run-options.ts";
import type { ReviewAsk, ReviewMessage } from "./adapter.ts";
import type { SessionRow } from "./cache.ts";
import { endShortProcess, spawnGrouped } from "./child.ts";
import { agentsOf, reviewerPick } from "./run-session.ts";
import type { SessionContext } from "./session-state.ts";

/** The answer of a wave's review on a feature whose reviews run on the branch only. */
export const BRANCH_ONLY = "No review: this feature's reviews run on the branch only.";

/** The input `review` takes: what is reviewed, its range of commits, and what the reviewers read. */
type ReviewInput = { base: string; context?: string; head: string; reviewed: string };

/** A reviewer's section of the findings: its name, as the run map shows it, and its findings. */
type Section = { reviewer: string; text: string };

/** The review that runs on a feature's commits, and what it is called by. */
type Review = ReviewInput & { cwd: string; parent: SessionRow; signal: AbortSignal | undefined };

/**
 * The reviews workflow sessions call: `review` runs every reviewer of the feature's options at once
 * and commits their findings.
 */
export class Reviews {
  #context: SessionContext;
  /**
   * The findings a hook refused to commit, written in their worktree, by `findingsKey`: the same
   * review asked again commits them instead of running its reviewers again.
   */
  #unsaved = new Map<string, string>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /**
   * Runs `review` for the workflow session `parent`: on a feature whose reviews run on the branch
   * only, a wave's review runs nothing; else every reviewer at once, each giving its section, a
   * reviewer that fails saying why, then the findings committed. Answers with the file's path and
   * its text. Counted as the parent's call: its watchdog waits meanwhile.
   */
  review(parent: string, input: unknown, signal?: AbortSignal): Promise<string> {
    return this.#context.subSessions.counted(parent, () => this.#review(parent, input, signal));
  }

  async #review(parent: string, input: unknown, signal?: AbortSignal): Promise<string> {
    const asked = reviewInput(input);
    const { binding, cache, runOptions, runtimes } = this.#context;
    const row = cache.session(parent);
    if (!row || row.folder === null || row.parent !== null) {
      throw new Error("Only a workflow session of a feature runs reviews.");
    }
    const folder = row.folder;
    const map = toMap(
      runOptions(row.repo, folder),
      agentsOf(runtimes, row.repo).runtime() ?? row.agent,
    );
    if (map.depth === "branch" && asked.reviewed !== "branch") {
      return BRANCH_ONLY;
    }
    const commits = `${asked.base}..${asked.head}`;
    const key = findingsKey(row.repo, folder, asked.reviewed, commits);
    try {
      const cwd = await binding.workDir(row.repo, folder);
      const unsaved = this.#unsaved.get(key);
      if (unsaved !== undefined) {
        return await this.#commitAgain(key, row.repo, folder, join(cwd, unsaved));
      }
      const review: Review = { ...asked, cwd, parent: row, signal };
      const names = map.reviewers.map((reviewer) => this.#name(reviewer));
      const sections = await Promise.all(
        map.reviewers.map((reviewer, index) =>
          this.#section(review, reviewer, uniqueName(names, index)),
        ),
      );
      if (signal?.aborted) {
        throw new Error("The call was cancelled.");
      }
      const findings = { commits, reviewed: asked.reviewed, sections };
      try {
        return await answerOf(join(cwd, await binding.writeFindings(row.repo, folder, findings)));
      } catch (error) {
        if (!isHookRefusal(error)) {
          throw error;
        }
        const path = await this.#lastFindings(row.repo, folder);
        this.#unsaved.set(key, path);
        return notCommitted(join(cwd, path), error);
      }
    } catch (error) {
      throw new Error(reasonOf(error), { cause: error });
    }
  }

  /**
   * Commits again the findings a hook refused, at `file`, `key`'s: answers as a review does once
   * committed, else again that they are written, not committed.
   */
  async #commitAgain(key: string, repo: string, folder: string, file: string): Promise<string> {
    try {
      await this.#context.binding.retryCommit(repo, folder, basename(file));
    } catch (error) {
      if (isHookRefusal(error)) {
        return notCommitted(file, error);
      }
      this.#unsaved.delete(key);
      throw error;
    }
    this.#unsaved.delete(key);
    return answerOf(file);
  }

  /**
   * The path, from the top level, of the feature's last findings in its worktree: the ones just
   * written, which a hook refused to commit.
   */
  async #lastFindings(repo: string, folder: string): Promise<string> {
    const { binding } = this.#context;
    const [feature, cwd] = await Promise.all([
      binding.readFeature(repo, folder),
      binding.workDir(repo, folder),
    ]);
    const names = (await readdir(join(cwd, feature.path))).filter((name) =>
      /^findings-\d+\.md$/.test(name),
    );
    const last = names.sort((one, other) => roundOf(one) - roundOf(other)).at(-1);
    if (last === undefined) {
      throw new Error("The findings a hook refused to commit are not in the worktree.");
    }
    return `${feature.path}/${last}`;
  }

  /**
   * A reviewer's name, as the run map shows it: its agent's and its model's names for people, the
   * agent's default model's when it picks none; a command's own text.
   */
  #name(reviewer: Reviewer): string {
    if (reviewer.kind === "command") {
      return reviewer.command;
    }
    const { runtimes } = this.#context;
    const { model, runtime } = reviewer.pick;
    const agent = runtimes.get(runtime)?.name ?? runtimes.title(runtime);
    const list = runtimes.models(runtime);
    const id = model ?? list?.defaults.model;
    const name = list?.models.find((one) => one.id === id)?.name ?? id;
    return name === undefined ? agent : `${agent} · ${name}`;
  }

  /** A reviewer's section: its findings, or why it did not review. */
  async #section(review: Review, reviewer: Reviewer, name: string): Promise<Section> {
    try {
      const text =
        reviewer.kind === "command"
          ? await runCommand(reviewer.command, review.cwd, review.signal)
          : await this.#agentReview(review, reviewer.pick, reviewer.instructions, name);
      return { reviewer: name, text: text.trim() || "No findings given." };
    } catch (error) {
      return { reviewer: name, text: `Did not review: ${reasonOf(error)}` };
    }
  }

  /**
   * An agent reviewer's findings: its last message, from a sub-session of the parent in the
   * feature's worktree, on its pick, given the agent's own review of the range, at its effort, else
   * its model's default.
   */
  async #agentReview(
    review: Review,
    pick: StepPick,
    instructions: string | undefined,
    name: string,
  ): Promise<string> {
    const { runtimes, subSessions } = this.#context;
    const picked = reviewerPick(this.#context, review.parent.repo, pick);
    const effort = pick.effort ?? runtimes.models(pick.runtime)?.defaults.effort;
    const added = [review.context, instructions].filter((text) => text?.trim()).join("\n\n");
    const ask: ReviewAsk = {
      base: review.base,
      head: review.head,
      ...(effort === undefined ? {} : { effort }),
      ...(added === "" ? {} : { instructions: added }),
    };
    const message = runtimes.get(pick.runtime)?.reviewMessage?.(ask) ?? plainReview(ask);
    return subSessions.start(
      review.parent.id,
      "reviewer",
      {
        about: `${name} on ${review.base}..${review.head}`,
        cwd: review.cwd,
        message: message.text,
        pick: picked,
        review: message.review === true,
      },
      review.signal,
    );
  }
}

/** The key of a review's findings: its feature, what it reviewed, and its commits. */
const findingsKey = (repo: string, folder: string, reviewed: string, commits: string) =>
  [repo, folder, reviewed, commits].join("\0");

/** Whether the binding's error is a hook's refusal of a commit. */
const isHookRefusal = (error: unknown) =>
  error instanceof Error && error.message.startsWith("hook: ");

/** The round of a findings file, from its name. */
const roundOf = (name: string) => Number(/\d+/.exec(name)?.[0] ?? 0);

/** The answer of a review whose findings are committed: their file's path, then their text. */
async function answerOf(file: string): Promise<string> {
  return `${file}\n\n${await readFile(file, "utf8")}`;
}

/** The answer of a review whose findings a hook refused: their file's path, and the hook's output. */
function notCommitted(file: string, error: unknown): string {
  return `${file}\n\nwritten, not committed: ${reasonOf(error)}`;
}

/** The name of the reviewer at `index`, numbered after the first reviewer of the same name. */
function uniqueName(names: ReadonlyArray<string>, index: number): string {
  const name = names[index];
  const before = names.slice(0, index).filter((one) => one === name).length;
  return before === 0 ? name : `${name} (${before + 1})`;
}

/** A review asked in plain words, for an agent without a review of its own. */
function plainReview({ base, head, instructions }: ReviewAsk): ReviewMessage {
  const range = `${base}..${head}`;
  const prompt =
    `Review the code changes of the commits ${range}, from \`git diff ${range}\`, without ` +
    "changing any file. Answer with your findings only, as a list, most important first, each " +
    "with its file and line.";
  return { text: instructions ? `${prompt}\n\n${instructions}` : prompt };
}

/**
 * Runs a command reviewer, `sh -c <command>` in `cwd`, its stdin closed: its output, stdout and
 * stderr as they came, and its exit code when it failed. `signal` ends it.
 */
async function runCommand(command: string, cwd: string, signal?: AbortSignal): Promise<string> {
  const started = spawnGrouped("sh", ["-c", command], cwd);
  const { child, exited } = started;
  child.stdin.end();
  let output = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data: string) => (output += data));
  child.stderr.on("data", (data: string) => (output += data));
  const stop = () => endShortProcess(started);
  signal?.addEventListener("abort", stop, { once: true });
  try {
    const { code, stderr } = await exited;
    if (code === null) {
      throw new Error(stderr || `${command} did not run.`);
    }
    return code === 0 ? output : `${output.trimEnd()}\n\nexit code ${code}`;
  } finally {
    signal?.removeEventListener("abort", stop);
  }
}

/** What a review reviews: the whole branch, or a wave, `wave 2`. */
const REVIEWED = /^(branch|wave [0-9]+)$/;

/**
 * A commit as a review takes it, `base` or `head`: one word on one line, without a colon, as a
 * reviewer's message and the findings' `commits` name the range.
 */
const COMMIT = /^[^\s:]+$/;

/**
 * The input of `review`, each field a text that is not blank, `context` optional: else refused.
 * `reviewed` is `branch` or `wave <N>`, and `base` and `head` each a commit, one word without a
 * colon: checked before any reviewer runs.
 */
function reviewInput(input: unknown): ReviewInput {
  const fields = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const text = (name: keyof ReviewInput, valid: RegExp, what: string) => {
    const value = fields[name];
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!valid.test(trimmed)) {
      throw new Error(`review needs \`${name}\`, ${what}.`);
    }
    return trimmed;
  };
  const context = typeof fields.context === "string" ? fields.context.trim() : "";
  return {
    base: text("base", COMMIT, "a commit, one word without a colon"),
    head: text("head", COMMIT, "a commit, one word without a colon"),
    reviewed: text("reviewed", REVIEWED, "`branch` or `wave <N>`"),
    ...(context === "" ? {} : { context }),
  };
}

/**
 * The `review` tool of Uraeda's MCP endpoint: a workflow session has the feature's commits
 * reviewed by every reviewer at once, `Reviews.review`.
 */
export function reviewTool(reviews: Reviews): McpTool {
  return {
    call: (session, input, signal) => reviews.review(session, input, signal),
    description:
      "Reviews the feature's commits `base..head` with every reviewer of the feature at once, " +
      "each an agent's own review in its own session or a command, then commits their findings " +
      "in the feature's folder as the next findings-NN.md. Answers with the file's path and its " +
      "text, a section per reviewer. When a hook refuses the commit, it answers with the file's " +
      "path and `written, not committed:` with the hook's output: fix what the hook says, then " +
      "call it again with the same `reviewed`, `base`, and `head`, which commits the file and " +
      "runs no reviewer. Call it once per review: after a wave is merged, with " +
      "`reviewed` `wave <N>`, and on the whole branch, with `reviewed` `branch`.",
    inputSchema: {
      properties: {
        base: {
          description: "The commit the reviewed changes start after.",
          pattern: "^[^\\s:]+$",
          type: "string",
        },
        context: {
          description: "What the reviewers should know: what the changes do, what to look at.",
          type: "string",
        },
        head: { description: "The last commit reviewed.", pattern: "^[^\\s:]+$", type: "string" },
        reviewed: {
          description: "What is reviewed: `wave 2`, or `branch`.",
          pattern: "^(branch|wave [0-9]+)$",
          type: "string",
        },
      },
      required: ["reviewed", "base", "head"],
      type: "object",
    },
    name: "review",
  };
}
