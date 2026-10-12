import type { Trigger } from "../runner/events.ts";
import type { Context } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { featureRecord, readRun, writable } from "./runs.ts";
import { sources } from "./sources.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  runDataView,
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

/** A run, masked to the fields the client selected. */
const run = async (ctx: Context, id: number | string, select: Array<string>) => {
  const record = await readRun(ctx, String(id));
  if (!record) {
    throw callSiteError(`refused: no run ${id}`);
  }
  return sources.masked(runDataView, ctx, record, select);
};

/** The triggers `run.start` takes: "Allow and continue" goes through `run.allow`. */
const TRIGGERS: Array<Trigger> = ["answers", "approval", "changes", "proposal", "start", "manual"];

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
    }>) => {
      writable(ctx, input);
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
  },
  "notes.save": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ folder: string; notes: string; previous: string }>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.saveNotes(ctx.repo, input.folder, input.notes, input.previous),
        ),
        select,
      );
    },
  },
  "answers.submit": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() => ctx.binding.submitAnswers(ctx.repo, input.folder)),
        select,
      );
    },
  },
  "commit.retry": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      writable(ctx, input);
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
    }: Resolver<FileInput & { startLine?: number; endLine?: number; text: string }>) => {
      writable(ctx, input);
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
  },
  "review.edit": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { number: number; text: string }>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.editComment(ctx.repo, input.folder, input.file, input.number, input.text),
        ),
        select,
      );
    },
  },
  "review.remove": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { number: number }>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.removeComment(ctx.repo, input.folder, input.file, input.number),
        ),
        select,
      );
    },
  },
  "review.startOver": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() => ctx.binding.startOver(ctx.repo, input.folder, input.file)),
        select,
      );
    },
  },
  "review.approve": {
    type: "WorkflowFile",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<FileInput & { summary?: string; tier?: string; planReview?: boolean }>) => {
      writable(ctx, input);
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
  },
  "review.requestChanges": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput & { summary?: string }>) => {
      writable(ctx, input);
      return file(
        ctx,
        await refusable(() =>
          ctx.binding.requestChanges(ctx.repo, input.folder, input.file, input.summary),
        ),
        select,
      );
    },
  },
  "draft.create": {
    type: "Draft",
    resolve: async ({ ctx, input, select }: Resolver<{ line: string; hash: string }>) =>
      draft(
        ctx,
        await refusable(() => ctx.binding.createDraft(ctx.repo, input.line, input.hash)),
        select,
      ),
  },
  "text.save": {
    type: "Draft",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ path: string; text: string; hash: string }>) => {
      writable(ctx, input);
      await refusable(() => ctx.binding.saveText(ctx.repo, input.path, input.text, input.hash));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
  },
  "text.commit": {
    type: "Draft",
    resolve: async ({ ctx, input, select }: Resolver<{ path: string }>) => {
      writable(ctx, input);
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
      return sources.masked(featureDataView, ctx, await featureRecord(ctx, feature), select);
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
  "run.start": {
    type: "Run",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ folder: string; trigger: Trigger; file?: string }>) => {
      if (!TRIGGERS.includes(input.trigger)) {
        throw callSiteError(`refused: no trigger ${input.trigger}`);
      }
      const id = await refusable(() =>
        ctx.runner.start(ctx.repo, input.folder, {
          trigger: input.trigger,
          ...(input.file === undefined ? {} : { file: input.file }),
        }),
      );
      return run(ctx, id, select);
    },
  },
  "run.allow": {
    type: "Run",
    resolve: async ({ ctx, input, select }: Resolver<{ run: string; seq: number }>) => {
      const id = await refusable(() => ctx.runner.allow(ctx.repo, Number(input.run), input.seq));
      return run(ctx, id, select);
    },
  },
  "run.stop": {
    type: "Run",
    resolve: async ({ ctx, input, select }: Resolver<{ run: string }>) => {
      const record = await run(ctx, input.run, select);
      ctx.runner.stop(Number(input.run));
      return record;
    },
  },
};
