/** The mutations that change a workflow file of a feature, each returning the file. */
import { refusable } from "./errors.ts";
import type { Context, Resolver } from "./context.ts";
import { writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import { fileDataView, sentFile, type FileRecord } from "./views.ts";

/** The file a mutation changed, masked to the fields the client selected. */
const file = (ctx: Context, record: FileRecord, select: Array<string>) =>
  sources.masked(fileDataView, ctx, sentFile(record), select);

type FileInput = { file: string; folder: string };

/** The mutations of a feature's workflow files: answers, notes, and reviews. */
export const fileMutations = {
  "answer.save": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      comment: string;
      folder: string;
      letters: Array<string>;
      previous: string;
      question: string;
    }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.saveAnswer(
            ctx.repo,
            input.folder,
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
  "answers.submit": {
    resolve: async ({ ctx, input, select }: Resolver<{ file?: string; folder: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() => ctx.binding.submitAnswers(ctx.repo, input.folder, input.file)),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "commit.retry": {
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      await writable(ctx, input);
      await refusable(() => ctx.binding.retryCommit(ctx.repo, input.folder, input.file));
      return file(ctx, await ctx.binding.readFile(ctx.repo, input.folder, input.file), select);
    },
    type: "WorkflowFile",
  },
  "notes.save": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ folder: string; notes: string; previous: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.saveNotes(ctx.repo, input.folder, input.notes, input.previous),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.approve": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { planReview?: boolean; summary?: string; tier?: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.approve(
            ctx.repo,
            input.folder,
            input.file,
            input.summary,
            input.tier,
            input.planReview,
          ),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.comment": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { endLine?: number; startLine?: number; text: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.addComment(
            ctx.repo,
            input.folder,
            input.file,
            input.startLine,
            input.endLine,
            input.text,
          ),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.edit": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { number: number; text: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.editComment(ctx.repo, input.folder, input.file, input.number, input.text),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.remove": {
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { number: number }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.removeComment(ctx.repo, input.folder, input.file, input.number),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.requestChanges": {
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { summary?: string }>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.requestChanges(ctx.repo, input.folder, input.file, input.summary),
        ),
        select,
      );
    },
    type: "WorkflowFile",
  },
  "review.startOver": {
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      await writable(ctx, input);
      return file(
        ctx,
        await refusable(() => ctx.binding.startOver(ctx.repo, input.folder, input.file)),
        select,
      );
    },
    type: "WorkflowFile",
  },
};
