// The starts of a change that send its first run: from a typed text and its images, an inbox
// note, or a draft.
import type { ChatImage } from "../runner/images.ts";
import { changeImages } from "./chat-images.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";
import { featureRecord, readWorkflowMessage } from "./sessions.ts";
import { sources } from "./sources.ts";
import { featureDataView } from "./views.ts";

/**
 * Runs a call of the session manager that answers at once, after reading the repository's main
 * checkout, which it matches the session's repository with.
 */
export async function onSession<T>(ctx: RepoContext, call: () => T | Promise<T>): Promise<T> {
  return refusedOn(async () => {
    await ctx.sessions.mainRoot(ctx.repo);
    return call();
  });
}

/**
 * Sends a started change's first run to its session, through the queue a running turn would hold
 * it in (R3), with the agent available and its workflow message written: the session's ID, or
 * `null` when no run was sent.
 */
async function sendFirstRun(ctx: RepoContext, folder: string): Promise<string | null> {
  // Without the agent, or a run to start, the change's page offers its message unsent.
  const message = ctx.sessions.status().available
    ? await readWorkflowMessage(ctx, `${folder}:start`)
    : undefined;
  if (!message?.text) {
    return null;
  }
  // The change's latest session: its only one, made now, unless a session moved to it.
  const { id } = await onSession(ctx, () => ctx.sessions.featureSession(ctx.repo, folder));
  const sent = await refusedOn(() =>
    ctx.sessions.send(ctx.repo, id, { text: message.text, workflow: { trigger: "start" } }),
  );
  return sent.session;
}

/** The reason of a call's refusal, without its code, for the server's log. */
const reasonOf = (error: unknown) => (error as Error).message.replace(/^refused: /, "");

/**
 * Sends the started change's first run: whether one was sent. Once the change exists, a run that
 * could not be sent is logged, not refused (R12): the change's page offers it unsent.
 */
async function firstRunSent(ctx: RepoContext, folder: string): Promise<boolean> {
  try {
    return (await sendFirstRun(ctx, folder)) !== null;
  } catch (error) {
    process.stderr.write(
      `uraeda: ${folder} started, but its first run was not sent: ${reasonOf(error)}\n`,
    );
    return false;
  }
}

/**
 * Starts a change from a typed text and its images, then sends its first run. The core writes the
 * images into the change's folder: the workflow's message carries none.
 */
async function startTypedChange(
  ctx: RepoContext,
  input: { images?: Array<ChatImage>; slug?: string; text: string },
): Promise<{ folder: string; sent: boolean }> {
  const bytes = await changeImages(ctx, input.images);
  const { folder } = await refusable(() =>
    ctx.binding.startChange(ctx.repo, input.text, bytes, input.slug),
  );
  return { folder, sent: await firstRunSent(ctx, folder) };
}

/** A note's text as a typed change's: its text, then its nested lines, over the inbox as read. */
async function noteText(ctx: RepoContext, input: { hash: string; note: string }) {
  const inbox = await refusable(() => ctx.binding.readInbox(ctx.repo));
  const note = inbox.categories
    .flatMap((category) => category.notes)
    .find((found) => found.id === input.note);
  if (inbox.hash !== input.hash) {
    throw callSiteError("conflict: INBOX.md changed on disk. Your change was not applied.");
  }
  if (!note) {
    throw callSiteError(`refused: no note ${input.note}`);
  }
  return note.nested.length > 0 ? `${note.text}\n\n${note.nested.join("\n")}` : note.text;
}

/**
 * Starts a change from an inbox note, as from a typed text, which refuses only staged files (R10),
 * then takes the note out of the inbox, committing `INBOX.md` alone when it had no other change,
 * and sends the change's first run. A refused start leaves the note in the inbox; a note that
 * cannot leave it once the change started is logged, and stays.
 */
async function startFromNote(
  ctx: RepoContext,
  input: { hash: string; note: string; slug?: string },
): Promise<{ folder: string; sent: boolean }> {
  const text = await noteText(ctx, input);
  const { folder } = await refusable(() => ctx.binding.startChange(ctx.repo, text, [], input.slug));
  try {
    await ctx.binding.removeNoteAndCommit(ctx.repo, input.note, input.hash);
  } catch (error) {
    process.stderr.write(
      `uraeda: ${folder} started, but its note stayed in the inbox: ${reasonOf(error)}\n`,
    );
  }
  return { folder, sent: await firstRunSent(ctx, folder) };
}

/**
 * Starts a draft as a change, as `feature.start` with kind change does, then sends its first run:
 * a priority line's change starts with its agent at work, as a typed one does.
 */
async function startDraft(
  ctx: RepoContext,
  input: { draft: string; slug?: string },
): Promise<{ folder: string; sent: boolean }> {
  const { folder } = await refusable(() =>
    ctx.binding.startFeature(ctx.repo, input.draft, input.slug, "change"),
  );
  return { folder, sent: await firstRunSent(ctx, folder) };
}

/** The started change, masked to the fields the client selected: no session when no run was sent. */
async function started(
  ctx: RepoContext,
  { folder, sent }: { folder: string; sent: boolean },
  select: Array<string>,
) {
  const record = await featureRecord(ctx, await ctx.binding.readFeature(ctx.repo, folder));
  return sources.masked(featureDataView, ctx, sent ? record : { ...record, session: null }, select);
}

/** The starts of a change that send its first run, its session opening where its agent works. */
export const changeStarts = {
  "change.fromNote": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; note: string; slug?: string }>) =>
      started(ctx, await startFromNote(ctx, input), select),
    type: "Feature",
  },
  "change.start": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ images?: Array<ChatImage>; slug?: string; text: string }>) =>
      started(ctx, await startTypedChange(ctx, input), select),
    type: "Feature",
  },
  "change.startDraft": {
    resolve: async ({ ctx, input, select }: Resolver<{ draft: string; slug?: string }>) =>
      started(ctx, await startDraft(ctx, input), select),
    type: "Feature",
  },
};
