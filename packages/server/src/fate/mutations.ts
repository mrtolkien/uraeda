import type { Context } from "./context.ts";
import { refusable } from "./errors.ts";
import { sources } from "./sources.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  type DraftRecord,
  type FileRecord,
  type PrioritiesRecord,
} from "./views.ts";

type Resolver<Input> = { ctx: Context; input: Input; select: Array<string> };

/** The file a mutation changed, masked to the fields the client selected. */
const file = (ctx: Context, record: FileRecord, select: Array<string>) =>
  sources.masked(fileDataView, ctx, record, select);

const priorities = (ctx: Context, record: Omit<PrioritiesRecord, "id">, select: Array<string>) =>
  sources.masked(prioritiesDataView, ctx, { id: PRIORITIES_ID, ...record }, select);

const draft = (ctx: Context, record: Omit<DraftRecord, "id">, select: Array<string>) =>
  sources.masked(draftDataView, ctx, { id: record.path, ...record }, select);

type FileInput = { folder: string; file: string };

export const mutations = {
  "answer.save": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      folder: string;
      question: string;
      letters: Array<string>;
      comment: string;
      previous: string;
    }>) =>
      file(
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
      ),
  },
  "notes.save": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ folder: string; notes: string; previous: string }>) =>
      file(
        ctx,
        await refusable(() =>
          ctx.binding.saveNotes(ctx.repo, input.folder, input.notes, input.previous),
        ),
        select,
      ),
  },
  "answers.submit": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) =>
      file(ctx, await refusable(() => ctx.binding.submitAnswers(ctx.repo, input.folder)), select),
  },
  "commit.retry": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      await refusable(() => ctx.binding.retryCommit(ctx.repo, input.folder, input.file));
      return file(ctx, await ctx.binding.readFile(ctx.repo, input.folder, input.file), select);
    },
  },
  "review.comment": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { startLine?: number; endLine?: number; text: string }>) =>
      file(
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
      ),
  },
  "review.edit": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { number: number; text: string }>) =>
      file(
        ctx,
        await refusable(() =>
          ctx.binding.editComment(ctx.repo, input.folder, input.file, input.number, input.text),
        ),
        select,
      ),
  },
  "review.remove": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { number: number }>) =>
      file(
        ctx,
        await refusable(() =>
          ctx.binding.removeComment(ctx.repo, input.folder, input.file, input.number),
        ),
        select,
      ),
  },
  "review.startOver": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) =>
      file(
        ctx,
        await refusable(() => ctx.binding.startOver(ctx.repo, input.folder, input.file)),
        select,
      ),
  },
  "review.approve": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { summary?: string; tier?: string; planReview?: boolean }>) =>
      file(
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
      ),
  },
  "review.requestChanges": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { summary?: string }>) =>
      file(
        ctx,
        await refusable(() =>
          ctx.binding.requestChanges(ctx.repo, input.folder, input.file, input.summary),
        ),
        select,
      ),
  },
  "draft.create": {
    type: "Draft",
    resolve: async ({ ctx, input, select }: Resolver<{ line: string }>) =>
      draft(ctx, await refusable(() => ctx.binding.createDraft(ctx.repo, input.line)), select),
  },
  "text.save": {
    type: "Draft",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ path: string; text: string; hash: string }>) => {
      await refusable(() => ctx.binding.saveText(ctx.repo, input.path, input.text, input.hash));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
  },
  "text.commit": {
    type: "Draft",
    resolve: async ({ ctx, input, select }: Resolver<{ path: string }>) => {
      await refusable(() => ctx.binding.commitText(ctx.repo, input.path));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
  },
  "feature.start": {
    type: "Feature",
    resolve: async ({ ctx, input, select }: Resolver<{ draft: string; slug?: string }>) => {
      const started = await refusable(() =>
        ctx.binding.startFeature(ctx.repo, input.draft, input.slug),
      );
      const feature = await ctx.binding.readFeature(ctx.repo, started.folder);
      return sources.masked(featureDataView, ctx, { id: feature.folder, ...feature }, select);
    },
  },
  "priorities.add": {
    type: "Priorities",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ section: string; text: string; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.addPriority(ctx.repo, input.section, input.text, input.hash),
        ),
        select,
      ),
  },
  "priorities.move": {
    type: "Priorities",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ entry: string; section: string; index: number; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.movePriority(ctx.repo, input.entry, input.section, input.index, input.hash),
        ),
        select,
      ),
  },
  "priorities.edit": {
    type: "Priorities",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ entry: string; text: string; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.editPriority(ctx.repo, input.entry, input.text, input.hash),
        ),
        select,
      ),
  },
  "priorities.remove": {
    type: "Priorities",
    resolve: async ({ ctx, input, select }: Resolver<{ entry: string; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() => ctx.binding.removePriority(ctx.repo, input.entry, input.hash)),
        select,
      ),
  },
  "priorities.commit": {
    type: "Priorities",
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      priorities(ctx, await refusable(() => ctx.binding.commitPriorities(ctx.repo)), select),
  },
  "priorities.discard": {
    type: "Priorities",
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      priorities(ctx, await refusable(() => ctx.binding.discardPriorities(ctx.repo)), select),
  },
};
