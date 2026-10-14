// oxlint-disable max-lines -- over the limit before the code quality decision: the list's mutations and their helpers in a module of their own
import type { Trigger } from "../runner/events.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { type Context, inRepository, type RepoContext } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { featureRecord, readSession, TRIGGERS, writable } from "./sessions.ts";
import { homedir } from "node:os";
import { typedFolder } from "../folders.ts";
import { repositoriesRecord, sources } from "./sources.ts";
import {
  draftDataView,
  featureDataView,
  fileDataView,
  PRIORITIES_ID,
  prioritiesDataView,
  repositoriesDataView,
  sentFile,
  sessionDataView,
  type DraftRecord,
  type FileRecord,
  type PrioritiesRecord,
} from "./views.ts";

/** A repository's mutation's arguments: see `repositoryOnly`. */
type Resolver<Input> = { ctx: RepoContext; input: Input; select: Array<string> };
/** The arguments of a mutation of the list, which every endpoint serves. */
type ListResolver<Input> = { ctx: Context; input: Input; select: Array<string> };

/** The file a mutation changed, masked to the fields the client selected. */
const file = (ctx: Context, record: FileRecord, select: Array<string>) =>
  sources.masked(fileDataView, ctx, sentFile(record), select);

const priorities = (ctx: Context, record: Omit<PrioritiesRecord, "id">, select: Array<string>) =>
  sources.masked(prioritiesDataView, ctx, { id: PRIORITIES_ID, ...record }, select);

const draft = (ctx: Context, record: Omit<DraftRecord, "id">, select: Array<string>) =>
  sources.masked(draftDataView, ctx, { id: record.path, ...record }, select);

/** A session, masked to the fields the client selected. */
const session = async (ctx: RepoContext, id: string, select: Array<string>) => {
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
async function onSession<T>(ctx: RepoContext, call: () => T | Promise<T>): Promise<T> {
  return refusedOn(async () => {
    await ctx.sessions.mainRoot(ctx.repo);
    return call();
  });
}

/**
 * The list after a change through the binding, read again by the hosts, which sends it to every
 * view: masked to the fields the client selected.
 */
async function listChanged(ctx: Context, select: Array<string>, added: string | null = null) {
  await ctx.hosts.reload();
  return sources.masked(repositoriesDataView, ctx, repositoriesRecord(ctx, added), select);
}

type FileInput = { file: string; folder: string };

const repositoryMutations = {
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
  "draft.create": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; line: string }>) =>
      draft(
        ctx,
        await refusable(() => ctx.binding.createDraft(ctx.repo, input.line, input.hash)),
        select,
      ),
    type: "Draft",
  },
  "feature.start": {
    resolve: async ({ ctx, input, select }: Resolver<{ draft: string; slug?: string }>) => {
      const started = await refusable(() =>
        ctx.binding.startFeature(ctx.repo, input.draft, input.slug),
      );
      const feature = await ctx.binding.readFeature(ctx.repo, started.folder);
      return sources.masked(featureDataView, ctx, await featureRecord(ctx, feature), select);
    },
    type: "Feature",
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
  "priorities.add": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; section: string; text: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.addPriority(ctx.repo, input.section, input.text, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "priorities.commit": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      priorities(ctx, await refusable(() => ctx.binding.commitPriorities(ctx.repo)), select),
    type: "Priorities",
  },
  "priorities.discard": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      priorities(ctx, await refusable(() => ctx.binding.discardPriorities(ctx.repo)), select),
    type: "Priorities",
  },
  "priorities.edit": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ entry: string; hash: string; text: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.editPriority(ctx.repo, input.entry, input.text, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "priorities.insert": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; index: number; lines: Array<string>; section: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.insertPriority(ctx.repo, input.section, input.index, input.lines, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "priorities.move": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ entry: string; hash: string; index: number; section: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.movePriority(ctx.repo, input.entry, input.section, input.index, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "priorities.remove": {
    resolve: async ({ ctx, input, select }: Resolver<{ entry: string; hash: string }>) =>
      priorities(
        ctx,
        await refusable(() => ctx.binding.removePriority(ctx.repo, input.entry, input.hash)),
        select,
      ),
    type: "Priorities",
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
  "session.allow": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ seq: number; session: string; turn: string }>) => {
      await refusedOn(() =>
        ctx.sessions.allow(ctx.repo, input.session, Number(input.turn), input.seq),
      );
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "session.archive": {
    resolve: async ({ ctx, input, select }: Resolver<{ archived: boolean; session: string }>) => {
      await onSession(ctx, () => ctx.sessions.archive(ctx.repo, input.session, input.archived));
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "session.newChat": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      session(ctx, (await refusedOn(() => ctx.sessions.newChat(ctx.repo))).id, select),
    type: "Session",
  },
  "session.rename": {
    resolve: async ({ ctx, input, select }: Resolver<{ session: string; title: string }>) => {
      await onSession(ctx, () => ctx.sessions.rename(ctx.repo, input.session, input.title));
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "session.seen": {
    resolve: async ({ ctx, input, select }: Resolver<{ session: string }>) => {
      await onSession(ctx, () => ctx.sessions.seen(ctx.repo, input.session));
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "session.send": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      /** Or the feature, whose session is created with its first message. */
      folder?: string;
      /** The session to send to. */
      session?: string;
      text: string;
      /** The workflow's message, which starts the feature's step. */
      workflow?: { file?: string; trigger: Trigger };
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
    type: "Session",
  },
  "session.stop": {
    resolve: async ({ ctx, input, select }: Resolver<{ session: string }>) => {
      await onSession(ctx, () => ctx.sessions.stop(ctx.repo, input.session));
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "session.takeBack": {
    resolve: async ({ ctx, input, select }: Resolver<{ message: string; session: string }>) => {
      await onSession(ctx, () => ctx.sessions.takeBack(ctx.repo, input.session, input.message));
      return session(ctx, input.session, select);
    },
    type: "Session",
  },
  "text.commit": {
    resolve: async ({ ctx, input, select }: Resolver<{ path: string }>) => {
      await writable(ctx, input);
      await refusable(() => ctx.binding.commitText(ctx.repo, input.path));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
    type: "Draft",
  },
  "text.discovery": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; level: string; path: string }>) => {
      await writable(ctx, input);
      return draft(
        ctx,
        await refusable(() =>
          ctx.binding.setDiscovery(ctx.repo, input.path, input.level, input.hash),
        ),
        select,
      );
    },
    type: "Draft",
  },
  "text.save": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; path: string; text: string }>) => {
      await writable(ctx, input);
      await refusable(() => ctx.binding.saveText(ctx.repo, input.path, input.text, input.hash));
      return draft(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
    type: "Draft",
  },
};

/** The list's mutations, served by every endpoint, the global one too. */
const listMutations = {
  "repositories.add": {
    resolve: async ({ ctx, input, select }: ListResolver<{ folder: string }>) => {
      const folder = await refusedOn(() => typedFolder(input.folder, homedir()));
      const { repository } = await refusable(() => ctx.binding.addRepository(ctx.dataDir, folder));
      return listChanged(ctx, select, repository.name);
    },
    type: "Repositories",
  },
  "repositories.open": {
    resolve: async ({ ctx, input, select }: ListResolver<{ name: string }>) => {
      await refusable(() => ctx.binding.openRepository(ctx.dataDir, input.name));
      return listChanged(ctx, select);
    },
    type: "Repositories",
  },
  "repositories.remove": {
    resolve: async ({ ctx, input, select }: ListResolver<{ name: string }>) => {
      const host = ctx.hosts.get(input.name);
      if (host && ctx.sessions.busy(host.path)) {
        throw callSiteError(`refused: An agent is working in ${input.name}: stop it first.`);
      }
      await refusable(() => ctx.binding.removeRepository(ctx.dataDir, input.name));
      return listChanged(ctx, select);
    },
    type: "Repositories",
  },
};

type RepositoryMutations = typeof repositoryMutations;

/**
 * The repository's mutations, refused on the global endpoint, which has no repository: their
 * resolvers take the same arguments, with fate's context, whose repository may be null.
 */
function repositoryOnly(definitions: RepositoryMutations) {
  return Object.fromEntries(
    Object.entries(definitions).map(([name, { resolve, type }]) => [
      name,
      {
        resolve: (args: ListResolver<unknown>) =>
          (resolve as (args: Resolver<unknown>) => unknown)({
            ...args,
            ctx: inRepository(args.ctx),
          }),
        type,
      },
    ]),
  ) as {
    [Name in keyof RepositoryMutations]: {
      resolve: (
        args: Omit<Parameters<RepositoryMutations[Name]["resolve"]>[0], "ctx"> & { ctx: Context },
      ) => ReturnType<RepositoryMutations[Name]["resolve"]>;
      type: RepositoryMutations[Name]["type"];
    };
  };
}

export const mutations = { ...repositoryOnly(repositoryMutations), ...listMutations };
