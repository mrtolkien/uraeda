import type { Trigger } from "../runner/events.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { type Context, inRepository, type RepoContext, type Resolver } from "./context.ts";
import { fileMutations } from "./file-mutations.ts";
import { inboxMutations } from "./inbox-mutations.ts";
import type { ChatImage } from "../runner/images.ts";
import { changeImages, sentImages } from "./chat-images.ts";
import { callSiteError, refusable } from "./errors.ts";
import { previewDataView, restartPreview } from "./preview.ts";
import { featureRecord, readSession, readWorkflowMessage, TRIGGERS, writable } from "./sessions.ts";
import { type ListResolver, listMutations, refusedOn } from "./list-mutations.ts";
import { settingsMutations } from "./settings-mutations.ts";
import { sources } from "./sources.ts";
import { draft, priorities } from "./masked.ts";
import { featureDataView, sessionDataView } from "./views.ts";

/** A session, masked to the fields the client selected. */
const session = async (ctx: RepoContext, id: string, select: Array<string>) => {
  const record = await readSession(ctx, id);
  if (!record) {
    throw callSiteError(`refused: no session ${id}`);
  }
  return sources.masked(sessionDataView, ctx, record, select);
};

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
  const { id } = await onSession(ctx, () => ctx.sessions.featureSession(ctx.repo, folder));
  await refusedOn(() =>
    ctx.sessions.send(ctx.repo, id, { text: message.text, workflow: { trigger: "start" } }),
  );
  return id;
}

/**
 * Starts a change from a typed text and its images, then sends its first run. The core writes the
 * images into the change's folder: the workflow's message carries none. Once the change exists, a
 * run that could not be sent is logged, not refused (R12): the change's page offers it unsent.
 */
async function startTypedChange(
  ctx: RepoContext,
  input: { images?: Array<ChatImage>; slug?: string; text: string },
): Promise<{ folder: string; sent: boolean }> {
  const bytes = await changeImages(ctx, input.images);
  const { folder } = await refusable(() =>
    ctx.binding.startChange(ctx.repo, input.text, bytes, input.slug),
  );
  try {
    return { folder, sent: (await sendFirstRun(ctx, folder)) !== null };
  } catch (error) {
    const reason = (error as Error).message.replace(/^refused: /, "");
    process.stderr.write(`uraeda: ${folder} started, but its first run was not sent: ${reason}\n`);
    return { folder, sent: false };
  }
}

const repositoryMutations = {
  ...fileMutations,
  "change.start": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ images?: Array<ChatImage>; slug?: string; text: string }>) => {
      const { folder, sent } = await startTypedChange(ctx, input);
      const record = await featureRecord(ctx, await ctx.binding.readFeature(ctx.repo, folder));
      return sources.masked(
        featureDataView,
        ctx,
        sent ? record : { ...record, session: null },
        select,
      );
    },
    type: "Feature",
  },
  ...inboxMutations,
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
  "preview.restart": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) =>
      sources.masked(previewDataView, ctx, await restartPreview(ctx, input.folder), select),
    type: "Preview",
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
      /** The chat images, as `POST /attach` saved them. */
      images?: Array<ChatImage>;
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
      const images = await sentImages(ctx, input.images, workflow !== undefined);
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
          ...(images.length === 0 ? {} : { images }),
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

export const mutations = {
  ...repositoryOnly(repositoryMutations),
  ...listMutations,
  ...settingsMutations,
};
