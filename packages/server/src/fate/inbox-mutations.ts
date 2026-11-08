/**
 * The mutations of the inbox, each written on the default branch over the hash it was read at: its
 * notes' edits, their moves into the priorities and proposal files, and the answers of the default
 * branch's rounds; the Git page's are `git-mutations.ts`'s. None writes a feature's files, so
 * none is refused while an agent works: `writable` guards features only.
 */
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { inbox, priorities, proposalFile, undoableInbox } from "./masked.ts";
import { undoable } from "./undo-mutations.ts";
import { sources } from "./sources.ts";
import { fileDataView, type FileRecord, sentFile } from "./views.ts";
import { listCommit, type Queued } from "./write-queue.ts";

/** A note's edit: the note's id, `note-3`, and the inbox's hash as read. */
type NoteInput = { hash: string; note: string };

/** A note to add: its text, its category, none when left out, and the feature or change it is about. */
type AddInput = { about?: string; category?: string; hash: string; text: string };

/** A move into the priorities: both files' hashes as read, and the section's id, `next`. */
type ToProposalInput = NoteInput & { prioritiesHash: string; section: string };

/**
 * A move under a proposal of the priorities: both files' hashes as read, and the proposal's id,
 * `now-2`.
 */
type UnderProposalInput = NoteInput & { prioritiesHash: string; proposal: string };

export const inboxMutations = {
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
  // The triage deleted, its deletion committed alone, so "Organize with AI" asks for a new one.
  // Answers with the inbox, which has no triage left.
  "defaultRound.dismiss": {
    resolve: async ({ ctx, input, select }: Resolver<Queued<{ previous: string }>>) => {
      await listCommit(ctx, input.write, () => ctx.binding.dismissTriage(ctx.repo, input.previous));
      return inbox(ctx, await ctx.binding.readInbox(ctx.repo), select);
    },
    type: "Inbox",
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
    resolve: async ({ ctx, input, select }: Resolver<Queued<{ id: string }>>) =>
      defaultRound(
        ctx,
        await listCommit(ctx, input.write, () => ctx.binding.retryRound(ctx.repo, input.id)),
        select,
      ),
    type: "WorkflowFile",
  },
  "defaultRound.submit": {
    resolve: async ({ ctx, input, select }: Resolver<Queued<{ id: string; previous: string }>>) =>
      defaultRound(
        ctx,
        await listCommit(ctx, input.write, () =>
          ctx.binding.submitRound(ctx.repo, input.id, input.previous),
        ),
        select,
      ),
    type: "WorkflowFile",
  },
  "inbox.add": {
    resolve: async ({ ctx, input, select }: Resolver<AddInput>) => {
      const { about, category, hash, text } = input;
      return undoableInbox(ctx, select, (undo) =>
        ctx.binding.addNote(ctx.repo, text, hash, category, about, undo),
      );
    },
    type: "Inbox",
  },
  "inbox.addCategory": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; name: string }>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.addCategory(ctx.repo, input.name, input.hash, undo),
      ),
    type: "Inbox",
  },
  "inbox.category": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { category?: string }>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.moveNoteToCategory(ctx.repo, input.note, input.hash, input.category, undo),
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
  // The proposal file as written, at its path now: a single file made a folder for a note file's
  // images moves.
  "inbox.intoProposal": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { file: string }>) => {
      const { answer: path, change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.noteIntoProposal(ctx.repo, input.note, input.file, input.hash, undo),
        ),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, path), select, change);
    },
    type: "ProposalFile",
  },
  // A note with a note file into a line of the priorities without a file: the line gets its
  // proposal file first. Answers with the new file as written.
  "inbox.intoProposalLine": {
    resolve: async ({ ctx, input, select }: Resolver<UnderProposalInput>) => {
      const { answer: path, change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.noteIntoProposalLine(
            ctx.repo,
            input.note,
            input.proposal,
            input.hash,
            input.prioritiesHash,
            undo,
          ),
        ),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, path), select, change);
    },
    type: "ProposalFile",
  },
  "inbox.outline": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ at?: number; hash: string; kind: string; note: string; text?: string }>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.outlineNote(
          ctx.repo,
          input.note,
          input.at ?? null,
          input.kind,
          input.text ?? null,
          input.hash,
          undo,
        ),
      ),
    type: "Inbox",
  },
  "inbox.place": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<NoteInput & { category?: string; index: number }>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.placeNote(ctx.repo, input.note, input.index, input.hash, input.category, undo),
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
      undoableInbox(ctx, select, (undo) =>
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
          undo,
        ),
      ),
    type: "Inbox",
  },
  "inbox.remove": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.removeNote(ctx.repo, input.note, input.hash, undo),
      ),
    type: "Inbox",
  },
  "inbox.removeCategory": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; keepNotes: boolean; name: string }>) => {
      const { answer, change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.removeCategory(ctx.repo, input.name, input.keepNotes, input.hash, undo),
        ),
      );
      return inbox(ctx, answer, select, { change });
    },
    type: "Inbox",
  },
  // An image taken out of a note: the note file's lines linking it go, over the file read at
  // `hash`; the image's file stays.
  "inbox.removeImage": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ file: string; hash: string; image: string }>) => {
      const { answer, change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.removeNoteImage(ctx.repo, input.file, input.image, input.hash, undo),
        ),
      );
      return inbox(ctx, answer, select, { change });
    },
    type: "Inbox",
  },
  "inbox.renameCategory": {
    resolve: async ({ ctx, input, select }: Resolver<{ from: string; hash: string; to: string }>) =>
      undoableInbox(ctx, select, (undo) =>
        ctx.binding.renameCategory(ctx.repo, input.from, input.to, input.hash, undo),
      ),
    type: "Inbox",
  },
  // Answers with the priorities, where the note now ends its section: the page the move opens
  // shows it from the move's own optimistic result, and the inbox follows by its live update.
  "inbox.toProposal": {
    resolve: async ({ ctx, input, select }: Resolver<ToProposalInput>) => {
      const { change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.noteToProposal(
            ctx.repo,
            input.note,
            input.section,
            input.hash,
            input.prioritiesHash,
            undo,
          ),
        ),
      );
      return priorities(ctx, await ctx.binding.readPriorities(ctx.repo), select, change);
    },
    type: "Priorities",
  },
  "inbox.toProposalFile": {
    resolve: async ({ ctx, input, select }: Resolver<ToProposalInput>) => {
      const { answer: path, change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.noteToProposalFile(
            ctx.repo,
            input.note,
            input.section,
            input.hash,
            input.prioritiesHash,
            undo,
          ),
        ),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, path), select, change);
    },
    type: "ProposalFile",
  },
  "inbox.underProposal": {
    resolve: async ({ ctx, input, select }: Resolver<UnderProposalInput>) => {
      const { change } = await refusable(() =>
        undoable(ctx, (undo) =>
          ctx.binding.noteUnderProposal(
            ctx.repo,
            input.note,
            input.proposal,
            input.hash,
            input.prioritiesHash,
            undo,
          ),
        ),
      );
      return inbox(ctx, await ctx.binding.readInbox(ctx.repo), select, { change });
    },
    type: "Inbox",
  },
};

/** The round on the default branch a mutation wrote, masked to the fields the client selected. */
function defaultRound(ctx: Resolver<unknown>["ctx"], record: FileRecord, select: Array<string>) {
  return sources.masked(fileDataView, ctx, sentFile(record), select);
}
