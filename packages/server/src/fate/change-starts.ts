// The starts of a change that send its first run: from a typed text and its images, an inbox
// note, or a proposal file.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

/**
 * The body of a note file as a typed change's text holds it: the file as it is on disk, without its
 * title, which the change takes from the note, nor its paragraphs of images alone, which the core
 * links again as it writes the change's images. Cut by the core's document tree, not by a pattern.
 * The cut of the images goes once the core keeps a note file's image names and links.
 */
async function noteFileBody(ctx: RepoContext, path: string): Promise<string> {
  const read = await refusable(() => ctx.binding.readText(ctx.repo, path));
  const cut = read.document.blocks.filter(
    (block) =>
      block.parent === undefined &&
      ((block.kind === "heading" && block.level === 1) ||
        (block.kind === "paragraph" &&
          block.spans.every((span) => span.image !== undefined || span.text.trim() === ""))),
  );
  // The document's lines count from 1, both ends included.
  const kept = read.text
    .split("\n")
    .filter((_, index) => !cut.some((b) => b.startLine <= index + 1 && index + 1 <= b.endLine));
  return kept
    .join("\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * A note as a typed change's text and images, over the inbox as read: its text, or for a note with
 * a note file its title and the file's body, then its nested lines, and the bytes of the images its
 * note file links. Read before the note leaves the inbox, which takes its note file with it.
 */
async function noteChange(ctx: RepoContext, input: { hash: string; note: string }) {
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
  const parts =
    note.file === undefined
      ? [note.text]
      : [note.fileTitle ?? note.text, await noteFileBody(ctx, note.file)];
  const text = [...parts, note.nested.join("\n")].filter((part) => part !== "").join("\n\n");
  // An image whose file is gone is left out: the change starts with the others.
  const read = await Promise.allSettled(note.images.map((path) => readFile(join(ctx.repo, path))));
  const images = read.flatMap((one) => (one.status === "fulfilled" ? [one.value] : []));
  return { images, text };
}

/**
 * Starts a change from an inbox note, as from a typed text with the note file's images, which
 * refuses only staged files (R10), then takes the note out of the inbox, its note file with it,
 * committing `INBOX.md` alone when it had no other change, and sends the change's first run. A
 * refused start leaves the note in the inbox; a note that cannot leave it once the change started
 * is logged, and stays.
 */
async function startFromNote(
  ctx: RepoContext,
  input: { hash: string; note: string; slug?: string },
): Promise<{ folder: string; sent: boolean }> {
  const { images, text } = await noteChange(ctx, input);
  const { folder } = await refusable(() =>
    ctx.binding.startChange(ctx.repo, text, images, input.slug),
  );
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
 * Starts a proposal file as a change, as `feature.start` with kind change does, then sends its
 * first run: a proposal's change starts with its agent at work, as a typed one does.
 */
async function startProposal(
  ctx: RepoContext,
  input: { proposal: string; slug?: string },
): Promise<{ folder: string; sent: boolean }> {
  const { folder } = await refusable(() =>
    ctx.binding.startFeature(ctx.repo, input.proposal, input.slug, "change"),
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
  "change.startProposal": {
    resolve: async ({ ctx, input, select }: Resolver<{ proposal: string; slug?: string }>) =>
      started(ctx, await startProposal(ctx, input), select),
    type: "Feature",
  },
};
