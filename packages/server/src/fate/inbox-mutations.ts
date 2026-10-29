/**
 * The mutations of the inbox, each written on the default branch over the hash it was read at: its
 * notes' edits, their moves into the priorities and proposal files, the commit bar's Commit and
 * Discard,
 * and the answers of the default branch's rounds. None writes a feature's files, so none is
 * refused while an agent works: `writable` guards features only.
 */
import type { Resolver } from "./context.ts";
import type { RemovedImage } from "uraeda-binding";
import { refusable } from "./errors.ts";
import { inbox, priorities, proposalFile } from "./masked.ts";
import { sources } from "./sources.ts";
import { fileDataView, type FileRecord, sentFile } from "./views.ts";

/** A note's edit: the note's id, `note-3`, and the inbox's hash as read. */
type NoteInput = { hash: string; note: string };

/**
 * A note to add: its text, its category, none when left out, the feature or change it is about,
 * and `commit`, for "Add and commit".
 */
type AddInput = { about?: string; category?: string; commit?: boolean; hash: string; text: string };

/**
 * The Undo of a move: the note's lines as written, and its place, its category, none when left
 * out, and its index in it, which it goes back to.
 */
type UndoInput = { category?: string; index: number; lines: Array<string> };

/** A move into the priorities: both files' hashes as read, and the section's id, `next`. */
type ToProposalInput = NoteInput & { prioritiesHash: string; section: string };

/**
 * A move under a proposal of the priorities: both files' hashes as read, and the proposal's id,
 * `now-2`.
 */
type UnderProposalInput = NoteInput & { prioritiesHash: string; proposal: string };

export const inboxMutations = {
  "changes.commit": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) => {
      await refusable(() => ctx.binding.commitChanges(ctx.repo));
      return priorities(ctx, await ctx.binding.readPriorities(ctx.repo), select);
    },
    type: "Priorities",
  },
  "changes.discard": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) => {
      await refusable(() => ctx.binding.discardChanges(ctx.repo));
      return priorities(ctx, await ctx.binding.readPriorities(ctx.repo), select);
    },
    type: "Priorities",
  },
  "defaultRound.answer": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      /** The hash of the round as the page read or wrote it last. */
      base: string;
      comment: string;
      /** The round's id among workflow files: `inbox-triage` or `decisions-check`. */
      id: string;
      letters: Array<string>;
      previous: string;
      question: string;
    }>) => {
      return defaultRound(
        ctx,
        await refusable(() =>
          ctx.binding.saveRoundAnswer(
            ctx.repo,
            input.id,
            input.question,
            input.letters,
            input.comment,
            input.previous,
            input.base,
          ),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "defaultRound.notes": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ base: string; id: string; notes: string; previous: string }>) => {
      return defaultRound(
        ctx,
        await refusable(() =>
          ctx.binding.saveRoundNotes(ctx.repo, input.id, input.notes, input.previous, input.base),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "defaultRound.retry": {
    resolve: async ({ ctx, input, select }: Resolver<{ id: string }>) =>
      defaultRound(ctx, await refusable(() => ctx.binding.retryRound(ctx.repo, input.id)), select),
    type: "WorkflowFile",
  },
  "defaultRound.submit": {
    resolve: async ({ ctx, input, select }: Resolver<{ id: string; previous: string }>) =>
      defaultRound(
        ctx,
        await refusable(() => ctx.binding.submitRound(ctx.repo, input.id, input.previous)),
        select,
      ),
    type: "WorkflowFile",
  },
  "inbox.add": {
    resolve: async ({ ctx, input, select }: Resolver<AddInput>) => {
      const { about, category, hash, text } = input;
      if (!input.commit) {
        return inbox(
          ctx,
          await refusable(() => ctx.binding.addNote(ctx.repo, text, hash, category, about)),
          select,
        );
      }
      const result = await refusable(() =>
        ctx.binding.addNoteAndCommit(ctx.repo, text, hash, category, about),
      );
      return inbox(ctx, result.inbox, select, { added: result.added });
    },
    type: "Inbox",
  },
  "inbox.addCategory": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; name: string }>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.addCategory(ctx.repo, input.name, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.category": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { category?: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.moveNoteToCategory(ctx.repo, input.note, input.hash, input.category),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.edit": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { text: string }>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.editNote(ctx.repo, input.note, input.text, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.insert": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ category?: string; hash: string; index: number; lines: Array<string> }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.insertNote(ctx.repo, input.index, input.lines, input.hash, input.category),
        ),
        select,
      ),
    type: "Inbox",
  },
  // The proposal file as written, at its path now: a single file made a folder for a note file's
  // images moves.
  "inbox.intoProposal": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { file: string }>) => {
      const path = await refusable(() =>
        ctx.binding.noteIntoProposal(ctx.repo, input.note, input.file, input.hash),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, path), select);
    },
    type: "ProposalFile",
  },
  "inbox.outline": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ at?: number; hash: string; kind: string; note: string; text?: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.outlineNote(
            ctx.repo,
            input.note,
            input.at ?? null,
            input.kind,
            input.text ?? null,
            input.hash,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.place": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<NoteInput & { category?: string; index: number }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.placeNote(ctx.repo, input.note, input.index, input.hash, input.category),
        ),
        select,
      ),
    type: "Inbox",
  },
  // A drop: the note, or its nested item `at`, under the note `under` (its nested item `underAt`),
  // or a note of `category`, or of the notes without one, at `index` there.
  "inbox.drop": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      at?: number;
      category?: string;
      hash: string;
      index: number;
      note: string;
      under?: string;
      underAt?: number;
    }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.dropNote(
            ctx.repo,
            input.note,
            input.at ?? null,
            {
              index: input.index,
              list: input.category,
              under: input.under,
              underAt: input.underAt,
            },
            input.hash,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.remove": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.removeNote(ctx.repo, input.note, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.removeCategory": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; keepNotes: boolean; name: string }>) => {
      const result = await refusable(() =>
        ctx.binding.removeCategory(ctx.repo, input.name, input.keepNotes, input.hash),
      );
      return inbox(ctx, result.inbox, select, { removed: result.before });
    },
    type: "Inbox",
  },
  // An image taken out of a note: the note file's lines linking it go, over the file read at
  // `hash`; the image's file stays. The answer's `imageRemoved` is what `inbox.restoreImage` takes
  // back.
  "inbox.removeImage": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ file: string; hash: string; image: string }>) => {
      const result = await refusable(() =>
        ctx.binding.removeNoteImage(ctx.repo, input.file, input.image, input.hash),
      );
      return inbox(ctx, result.inbox, select, { imageRemoved: result.removed });
    },
    type: "Inbox",
  },
  "inbox.renameCategory": {
    resolve: async ({ ctx, input, select }: Resolver<{ from: string; hash: string; to: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.renameCategory(ctx.repo, input.from, input.to, input.hash),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.restoreCategory": {
    resolve: async ({ ctx, input, select }: Resolver<{ before: string; hash: string }>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.restoreCategory(ctx.repo, input.before, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.restoreImage": {
    resolve: async ({ ctx, input, select }: Resolver<{ removed: RemovedImage }>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.restoreNoteImage(ctx.repo, input.removed)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.toProposal": {
    resolve: async ({ ctx, input, select }: Resolver<ToProposalInput>) => {
      await refusable(() =>
        ctx.binding.noteToProposal(
          ctx.repo,
          input.note,
          input.section,
          input.hash,
          input.prioritiesHash,
        ),
      );
      return inbox(ctx, await ctx.binding.readInbox(ctx.repo), select);
    },
    type: "Inbox",
  },
  "inbox.toProposalFile": {
    resolve: async ({ ctx, input, select }: Resolver<ToProposalInput>) => {
      const path = await refusable(() =>
        ctx.binding.noteToProposalFile(
          ctx.repo,
          input.note,
          input.section,
          input.hash,
          input.prioritiesHash,
        ),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, path), select);
    },
    type: "ProposalFile",
  },
  "inbox.underProposal": {
    resolve: async ({ ctx, input, select }: Resolver<UnderProposalInput>) => {
      await refusable(() =>
        ctx.binding.noteUnderProposal(
          ctx.repo,
          input.note,
          input.proposal,
          input.hash,
          input.prioritiesHash,
        ),
      );
      return inbox(ctx, await ctx.binding.readInbox(ctx.repo), select);
    },
    type: "Inbox",
  },
  "inbox.undoAdd": {
    resolve: async ({ ctx, input, select }: Resolver<{ lines: Array<string> }>) =>
      inbox(ctx, await refusable(() => ctx.binding.undoNoteAdd(ctx.repo, input.lines)), select),
    type: "Inbox",
  },
  "inbox.undoAsFile": {
    resolve: async ({ ctx, input, select }: Resolver<{ lines: Array<string> }>) =>
      inbox(ctx, await refusable(() => ctx.binding.undoNoteAsFile(ctx.repo, input.lines)), select),
    type: "Inbox",
  },
  "inbox.undoCategory": {
    resolve: async ({ ctx, input, select }: Resolver<UndoInput>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteCategory(ctx.repo, input.lines, input.index, input.category),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoCommitted": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; lines: Array<string> }>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.undoCommittedNote(ctx.repo, input.lines, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoIntoProposal": {
    resolve: async ({ ctx, input, select }: Resolver<UndoInput & { file: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteIntoProposal(
            ctx.repo,
            input.file,
            input.lines,
            input.index,
            input.category,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoToProposal": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<UndoInput & { proposalKey?: string; section: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteToProposal(
            ctx.repo,
            input.lines,
            input.index,
            input.section,
            input.category,
            input.proposalKey,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoUnderProposal": {
    resolve: async ({ ctx, input, select }: Resolver<UndoInput & { proposalKey: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteUnderProposal(
            ctx.repo,
            input.lines,
            input.index,
            input.proposalKey,
            input.category,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
};

/** The round on the default branch a mutation wrote, masked to the fields the client selected. */
function defaultRound(ctx: Resolver<unknown>["ctx"], record: FileRecord, select: Array<string>) {
  return sources.masked(fileDataView, ctx, sentFile(record), select);
}
