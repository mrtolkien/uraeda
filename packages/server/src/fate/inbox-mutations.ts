/**
 * The mutations of the inbox, each written on the default branch over the hash it was read at: its
 * notes' edits, their moves into the priorities and drafts, the commit bar's Commit and Discard,
 * and the triage's answers.
 */
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { draft, inbox, priorities } from "./masked.ts";
import { writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import { fileDataView, type FileRecord, sentFile } from "./views.ts";

/** The triage's path, from the top level. */
const TRIAGE_PATH = "specs/INBOX-TRIAGE.md";

/** A note's edit: the note's id, `note-3`, and the inbox's hash as read. */
type NoteInput = { hash: string; note: string };

/** A note to add: its text, its category, none when left out, and the feature or bug it is about. */
type AddInput = { about?: string; category?: string; hash: string; text: string };

/** A move into the priorities: both files' hashes as read, and the section's id, `next`. */
type ToPrioritiesInput = NoteInput & { prioritiesHash: string; section: string };

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
  "inbox.add": {
    resolve: async ({ ctx, input, select }: Resolver<AddInput>) =>
      inbox(
        ctx,
        await refusable(() =>
          ctx.binding.addNote(ctx.repo, input.text, input.hash, input.category, input.about),
        ),
        select,
      ),
    type: "Inbox",
  },
  "inbox.addAsDraft": {
    resolve: async ({ ctx, input, select }: Resolver<AddInput>) => {
      const path = await refusable(() =>
        ctx.binding.addNoteAsDraft(ctx.repo, input.text, input.hash, input.category, input.about),
      );
      return draft(ctx, await ctx.binding.readText(ctx.repo, path), select);
    },
    type: "Draft",
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
  "inbox.remove": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput>) =>
      inbox(
        ctx,
        await refusable(() => ctx.binding.removeNote(ctx.repo, input.note, input.hash)),
        select,
      ),
    type: "Inbox",
  },
  "inbox.toDraft": {
    resolve: async ({ ctx, input, select }: Resolver<NoteInput & { draft: string }>) => {
      await writable(ctx, { path: input.draft });
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
  "triage.answer": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      comment: string;
      letters: Array<string>;
      previous: string;
      question: string;
    }>) => {
      await writable(ctx, { path: TRIAGE_PATH });
      return triage(
        ctx,
        await refusable(() =>
          ctx.binding.saveTriageAnswer(
            ctx.repo,
            input.question,
            input.letters,
            input.comment,
            input.previous,
          ),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "triage.notes": {
    resolve: async ({ ctx, input, select }: Resolver<{ notes: string; previous: string }>) => {
      await writable(ctx, { path: TRIAGE_PATH });
      return triage(
        ctx,
        await refusable(() => ctx.binding.saveTriageNotes(ctx.repo, input.notes, input.previous)),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "triage.submit": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) => {
      await writable(ctx, { path: TRIAGE_PATH });
      return triage(ctx, await refusable(() => ctx.binding.submitTriage(ctx.repo)), select);
    },
    type: "WorkflowFile",
  },
};

/** The triage a mutation wrote, masked to the fields the client selected. */
function triage(ctx: Resolver<unknown>["ctx"], record: FileRecord, select: Array<string>) {
  return sources.masked(fileDataView, ctx, sentFile(record), select);
}
