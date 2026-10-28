/**
 * The mutations of the inbox, each written on the default branch over the hash it was read at: its
 * notes' edits, their moves into the priorities and drafts, the commit bar's Commit and Discard,
 * and the answers of the default branch's rounds. None writes a feature's files, so none is
 * refused while an agent works: `writable` guards features only.
 */
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { draft, inbox, priorities } from "./masked.ts";
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
type ToPrioritiesInput = NoteInput & { prioritiesHash: string; section: string };

/** A move under an entry of the priorities: both files' hashes as read, and the entry's id, `now-2`. */
type UnderPriorityInput = NoteInput & { entry: string; prioritiesHash: string };

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
      return inbox(ctx, result.inbox, select, result.added);
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
      return inbox(ctx, result.inbox, select, null, result.before);
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
  "inbox.toDraft": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { draft: string }>) => {
      await refusable(() => ctx.binding.noteToDraft(ctx.repo, input.note, input.draft, input.hash));
      return inbox(ctx, await ctx.binding.readInbox(ctx.repo), select);
    },
    type: "Inbox",
  },
  "inbox.toNewDraft": {
    resolve: async ({ ctx, input, select }: Resolver<ToPrioritiesInput>) => {
      const path = await refusable(() =>
        ctx.binding.noteToNewDraft(
          ctx.repo,
          input.note,
          input.section,
          input.hash,
          input.prioritiesHash,
        ),
      );
      return draft(ctx, await ctx.binding.readText(ctx.repo, path), select);
    },
    type: "Draft",
  },
  "inbox.toPriorities": {
    resolve: async ({ ctx, input, select }: Resolver<ToPrioritiesInput>) => {
      await refusable(() =>
        ctx.binding.noteToPriorities(
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
  "inbox.underPriority": {
    resolve: async ({ ctx, input, select }: Resolver<UnderPriorityInput>) => {
      await refusable(() =>
        ctx.binding.noteUnderPriority(
          ctx.repo,
          input.note,
          input.entry,
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
  "inbox.undoAsDraft": {
    resolve: async ({ ctx, input, select }: Resolver<{ lines: Array<string> }>) =>
      inbox(ctx, await refusable(() => ctx.binding.undoNoteAsDraft(ctx.repo, input.lines)), select),
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
  "inbox.undoToDraft": {
    resolve: async ({ ctx, input, select }: Resolver<UndoInput & { draft: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteToDraft(
            ctx.repo,
            input.draft,
            input.lines,
            input.index,
            input.category,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoToPriorities": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<UndoInput & { entryKey?: string; section: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteToPriorities(
            ctx.repo,
            input.lines,
            input.index,
            input.section,
            input.category,
            input.entryKey,
          ),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.undoUnderPriority": {
    resolve: async ({ ctx, input, select }: Resolver<UndoInput & { entryKey: string }>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.undoNoteUnderPriority(
            ctx.repo,
            input.lines,
            input.index,
            input.entryKey,
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
