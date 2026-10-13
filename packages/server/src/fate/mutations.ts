import type { Trigger } from "../runner/events.ts";
import { REFUSALS } from "../runner/sessions.ts";
import type { Context } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { featureRecord, readSession, TRIGGERS, writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  sentFile,
  sessionDataView,
  type DraftRecord,
  type FileRecord,
  type PrioritiesRecord,
} from "./views.ts";

type Resolver<Input> = { ctx: Context; input: Input; select: Array<string> };

/** The file a mutation changed, masked to the fields the client selected. */
const file = (ctx: Context, record: FileRecord, select: Array<string>) =>
  sources.masked(fileDataView, ctx, sentFile(record), select);

const priorities = (ctx: Context, record: Omit<PrioritiesRecord, "id">, select: Array<string>) =>
  sources.masked(prioritiesDataView, ctx, { id: PRIORITIES_ID, ...record }, select);

const draft = (ctx: Context, record: Omit<DraftRecord, "id">, select: Array<string>) =>
  sources.masked(draftDataView, ctx, { id: record.path, ...record }, select);

/** A session, masked to the fields the client selected. */
const session = async (ctx: Context, id: string, select: Array<string>) => {
  const record = await readSession(ctx, id);
  if (!record) {
    throw callSiteError(`refused: no session ${id}`);
  }
  return sources.masked(sessionDataView, ctx, record, select);
};

/** Runs a session manager's call, its errors as refusals the client shows where it called. */
async function refusedOn<T>(call: () => T | Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw callSiteError(/^(refused|conflict|hook): /.test(message) ? error : `refused: ${message}`);
  }
}

/**
 * Runs a call of the session manager that answers at once, after reading the repository's main
 * checkout, which it matches the session's repository with.
 */
async function onSession<T>(ctx: Context, call: () => T | Promise<T>): Promise<T> {
  return refusedOn(async () => {
    await ctx.sessions.mainRoot(ctx.repo);
    return call();
  });
}

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
  },
  "notes.save": {
    type: "WorkflowFile",
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
  },
  "answers.submit": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) => {
      await writable(ctx, input);
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
      await writable(ctx, input);
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
  },
  "review.edit": {
    type: "WorkflowFile",
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
  },
  "review.remove": {
    type: "WorkflowFile",
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
  },
  "review.startOver": {
    type: "WorkflowFile",
    resolve: async ({ ctx, input, select }: Resolver<FileInput>) => {
      await writable(ctx, input);
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
  },
  "review.requestChanges": {
    type: "WorkflowFile",
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
      await writable(ctx, input);
      await refusable(() => ctx.binding.saveText(ctx.repo, input.path, input.text, input.hash));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
  },
  "text.commit": {
    type: "Draft",
    resolve: async ({ ctx, input, select }: Resolver<{ path: string }>) => {
      await writable(ctx, input);
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
  "priorities.insert": {
    type: "Priorities",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ section: string; index: number; lines: Array<string>; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.insertPriority(ctx.repo, input.section, input.index, input.lines, input.hash),
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
  "session.send": {
    type: "Session",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      /** The session to send to. */
      session?: string;
      /** Or the feature, whose session is created with its first message. */
      folder?: string;
      text: string;
      /** The workflow's message, which starts the feature's step. */
      workflow?: { trigger: Trigger; file?: string };
    }>) => {
      const { workflow } = input;
      if (workflow && !TRIGGERS.includes(workflow.trigger)) {
        throw callSiteError(`refused: no trigger ${workflow.trigger}`);
      }
      const id = await onSession(ctx, async () => {
        if (input.session !== undefined) {
          return input.session;
        }
        if (input.folder === undefined) {
          throw new Error("a message goes to a session or a feature");
        }
        if (!ctx.sessions.status().available) {
          throw new Error(`refused: ${REFUSALS.unavailable(ctx.sessions.adapter.name)}`);
        }
        // A folder that is no feature's gets no session.
        await ctx.binding.readFeature(ctx.repo, input.folder);
        return (await ctx.sessions.featureSession(ctx.repo, input.folder)).id;
      });
      await refusedOn(() =>
        ctx.sessions.send(ctx.repo, id, {
          text: input.text,
          ...(workflow === undefined
            ? {}
            : {
                workflow: {
                  trigger: workflow.trigger,
                  ...(workflow.file === undefined ? {} : { file: workflow.file }),
                },
              }),
        }),
      );
      return session(ctx, id, select);
    },
  },
  "session.newChat": {
    type: "Session",
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      session(ctx, (await refusedOn(() => ctx.sessions.newChat(ctx.repo))).id, select),
  },
  "session.takeBack": {
    type: "Session",
    resolve: async ({ ctx, input, select }: Resolver<{ session: string; message: string }>) => {
      await onSession(ctx, () => ctx.sessions.takeBack(ctx.repo, input.session, input.message));
      return session(ctx, input.session, select);
    },
  },
  "session.stop": {
    type: "Session",
    resolve: async ({ ctx, input, select }: Resolver<{ session: string }>) => {
      await onSession(ctx, () => ctx.sessions.stop(ctx.repo, input.session));
      return session(ctx, input.session, select);
    },
  },
  "session.allow": {
    type: "Session",
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ session: string; turn: string; seq: number }>) => {
      await refusedOn(() =>
        ctx.sessions.allow(ctx.repo, input.session, Number(input.turn), input.seq),
      );
      return session(ctx, input.session, select);
    },
  },
  "session.rename": {
    type: "Session",
    resolve: async ({ ctx, input, select }: Resolver<{ session: string; title: string }>) => {
      await onSession(ctx, () => ctx.sessions.rename(ctx.repo, input.session, input.title));
      return session(ctx, input.session, select);
    },
  },
  "session.archive": {
    type: "Session",
    resolve: async ({ ctx, input, select }: Resolver<{ session: string; archived: boolean }>) => {
      await onSession(ctx, () => ctx.sessions.archive(ctx.repo, input.session, input.archived));
      return session(ctx, input.session, select);
    },
  },
  "session.seen": {
    type: "Session",
    resolve: async ({ ctx, input, select }: Resolver<{ session: string }>) => {
      await onSession(ctx, () => ctx.sessions.seen(ctx.repo, input.session));
      return session(ctx, input.session, select);
    },
  },
};
