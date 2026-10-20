import type { Trigger } from "../runner/events.ts";
import { editedFiles, movedOpening } from "../runner/moves.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";
import { featureRecord, readSession, readWorkflowMessage } from "./sessions.ts";
import { sources } from "./sources.ts";
import { droppedDataView } from "./views-dropped.ts";
import { featureDataView, sessionDataView } from "./views.ts";

/**
 * The core's refusals of a taken name: a record, a branch, or a folder, whose `--slug` hint is the
 * CLI's, or the worktree's folder. The dated folder is the name, whatever letters its slug holds.
 */
const TAKEN = [
  /^refused: (?:specs\/done\/)?(\d{4}-\d{2}-\d{2}-[^\s/]+?)(?:\.md)? exists: /u,
  /^refused: cannot create the worktree: \.worktrees\/(\d{4}-\d{2}-\d{2}-[^\s/]+) exists$/u,
];

/** A session, masked to the fields the client selected. */
export async function maskedSession(ctx: RepoContext, id: string, select: Array<string>) {
  const record = await readSession(ctx, id);
  if (!record) {
    throw callSiteError(`refused: no session ${id}`);
  }
  return sources.masked(sessionDataView, ctx, record, select);
}

/** The change or the feature, masked to the fields the client selected. */
async function maskedFeature(ctx: RepoContext, folder: string, select: Array<string>) {
  const feature = await ctx.binding.readFeature(ctx.repo, folder);
  return sources.masked(featureDataView, ctx, await featureRecord(ctx, feature), select);
}

/**
 * Runs `body` holding the change or the feature, or the session without one: refused while one of
 * its sessions works, and its sessions take no message until it ends.
 */
async function moving<T>(
  ctx: RepoContext,
  target: { folder: string } | { session: string },
  body: () => Promise<T>,
): Promise<T> {
  const release = await refusedOn(() => ctx.sessions.hold(ctx.repo, target));
  try {
    return await body();
  } finally {
    release();
  }
}

/**
 * Sends the folder's workflow run for `trigger` to `session`, or to its latest session, with the
 * agent available and a run to start. Once the move is done, a run that could not be sent is
 * logged, not refused, as a started change's first run is: the page offers it unsent.
 */
async function sendRun(
  ctx: RepoContext,
  folder: string,
  run: { opening?: string; session?: string; trigger: Trigger },
): Promise<void> {
  try {
    const message = ctx.sessions.status().available
      ? await readWorkflowMessage(ctx, `${folder}:${run.trigger}`)
      : undefined;
    if (!message?.text) {
      return;
    }
    const session = run.session ?? (await ctx.sessions.featureSession(ctx.repo, folder)).id;
    await ctx.sessions.send(ctx.repo, session, {
      text: message.text,
      ...(run.opening === undefined ? {} : { opening: run.opening }),
      workflow: {
        freshByDefault: ctx.settings.runs().buildInFreshSession.inForce,
        trigger: run.trigger,
      },
    });
  } catch (error) {
    const reason = (error as Error).message.replace(/^refused: /, "");
    process.stderr.write(`uraeda: ${folder} moved, but its run was not sent: ${reason}\n`);
  }
}

/** Starts the change from the card's text and slug: a taken slug is refused in the card's words. */
async function startChange(ctx: RepoContext, text: string, slug?: string) {
  return refusable(async () => {
    try {
      return await ctx.binding.startChange(ctx.repo, text, [], slug);
    } catch (error) {
      const message = (error as Error).message;
      const taken = TAKEN.map((pattern) => pattern.exec(message)).find((match) => match !== null);
      if (!taken) {
        throw error;
      }
      throw new Error(`refused: A branch or folder named ${taken[1]} exists: pick another slug`, {
        cause: error,
      });
    }
  });
}

/**
 * Makes a session without a workflow the change of the card's text and slug: the change starts,
 * the session moves to it, and its first run goes to the session, after the line telling the
 * agent where it works now and which files to carry over. A session that cannot move once the
 * change started stays without a workflow, and the refusal names the change.
 */
async function toChange(
  ctx: RepoContext,
  input: { session: string; slug?: string; text: string },
): Promise<string> {
  const row = await refusedOn(async () => {
    const root = await ctx.sessions.mainRoot(ctx.repo);
    const found = ctx.sessions.cache.session(input.session);
    if (!found || found.repo !== root) {
      throw new Error(`no session ${input.session}`);
    }
    if (found.folder !== null) {
      throw new Error(`refused: the session already belongs to ${found.folder}`);
    }
    return found;
  });
  const { branch, folder } = await moving(ctx, { session: row.id }, async () => {
    const started = await startChange(ctx, input.text, input.slug);
    try {
      await ctx.sessions.attach(ctx.repo, row.id, started.folder);
    } catch (error) {
      const reason = (error as Error).message.replace(/^refused: /, "");
      throw callSiteError(
        `refused: The change ${started.folder} started, but this session could not move to it: ${reason}`,
      );
    }
    return started;
  });
  const opening = movedOpening({
    branch,
    edited: editedFiles(ctx.sessions.cache, row.id),
    folder,
    worktree: await ctx.binding.workDir(ctx.repo, folder),
  });
  await sendRun(ctx, folder, { opening, session: row.id, trigger: "start" });
  return folder;
}

/**
 * The moves a human makes from a session: a session becoming a change, a change becoming a feature
 * in place, a new session of a change or a feature, and dropping one.
 */
export const sessionMoves = {
  "feature.drop": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) => {
      const dropped = await moving(ctx, { folder: input.folder }, async () => {
        const left = await refusable(() => ctx.binding.dropItem(ctx.repo, input.folder));
        await ctx.sessions.archiveFolder(ctx.repo, input.folder);
        return left;
      });
      const record = {
        branch: dropped.branch,
        committed: dropped.committed,
        id: input.folder,
        worktreeLeft: dropped.worktreeLeft ?? null,
      };
      return sources.masked(droppedDataView, ctx, record, select);
    },
    type: "Dropped",
  },
  "feature.promote": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) => {
      const { folder } = await moving(ctx, { folder: input.folder }, () =>
        refusable(() => ctx.binding.promoteChange(ctx.repo, input.folder)),
      );
      await sendRun(ctx, folder, { trigger: "manual" });
      return maskedFeature(ctx, folder, select);
    },
    type: "Feature",
  },
  "session.new": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) => {
      const row = await refusedOn(async () => {
        // A folder that is no change's or feature's gets no session.
        await ctx.binding.readFeature(ctx.repo, input.folder);
        return ctx.sessions.newSession(ctx.repo, input.folder);
      });
      return maskedSession(ctx, row.id, select);
    },
    type: "Session",
  },
  "session.toChange": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ session: string; slug?: string; text: string }>) =>
      maskedFeature(ctx, await toChange(ctx, input), select),
    type: "Feature",
  },
};
