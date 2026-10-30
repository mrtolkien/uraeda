import { publish } from "../live.ts";
import type { Trigger } from "../runner/events.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { type Context, inRepository, type Resolver } from "./context.ts";
import { fileMutations } from "./file-mutations.ts";
import { inboxMutations } from "./inbox-mutations.ts";
import type { ChatImage } from "../runner/images.ts";
import { sentImages } from "./chat-images.ts";
import { changeStarts, onSession } from "./change-starts.ts";
import { draftMutations } from "./draft-mutations.ts";
import { keptForStart, startMutations } from "./starts.ts";
import { callSiteError, refusable } from "./errors.ts";
import { previewDataView, restartPreview } from "./preview.ts";
import { maskedSession, sessionMoves } from "./session-moves.ts";
import { featureRecord, TRIGGERS, writable } from "./sessions.ts";
import { type ListResolver, listMutations, refusedOn } from "./list-mutations.ts";
import { settingsMutations } from "./settings-mutations.ts";
import { sources } from "./sources.ts";
import { priorities, proposalFile } from "./masked.ts";
import { featureDataView } from "./views.ts";
import {
  LISTS,
  listCommit,
  type Queued,
  queued,
  writeQueue,
  writeQueueDataView,
} from "./write-queue.ts";

/** A session, masked to the fields the client selected. */
const session = maskedSession;

const repositoryMutations = {
  ...fileMutations,
  ...sessionMoves,
  ...changeStarts,
  ...inboxMutations,
  ...draftMutations,
  ...startMutations,
  "item.settings": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ folder: string; label?: string | null }>) => {
      const host = ctx.hosts.byPath(ctx.repo);
      if (!host) {
        throw callSiteError("refused: no repository");
      }
      await refusable(() =>
        ctx.binding.setItemSettings(ctx.dataDir, host.name, input.folder, input.label ?? null),
      );
      // The hosts read the list again, so the records join the new name.
      await ctx.hosts.reload();
      publish(
        {
          branchDecisions: [],
          decisions: false,
          features: [input.folder],
          files: [],
          inbox: false,
          priorities: false,
          workspace: true,
        },
        host,
      );
      const feature = await ctx.binding.readFeature(ctx.repo, input.folder);
      return sources.masked(featureDataView, ctx, await featureRecord(ctx, feature), select);
    },
    type: "Feature",
  },
  "preview.restart": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string }>) =>
      sources.masked(previewDataView, ctx, await restartPreview(ctx, input.folder), select),
    type: "Preview",
  },
  "priorities.commit": {
    resolve: async ({ ctx, input, select }: Resolver<Queued<object>>) =>
      priorities(
        ctx,
        await listCommit(ctx, input.write, () => ctx.binding.commitPriorities(ctx.repo)),
        select,
      ),
    type: "Priorities",
  },
  "priorities.discard": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) =>
      priorities(ctx, await refusable(() => ctx.binding.discardPriorities(ctx.repo)), select),
    type: "Priorities",
  },
  "proposals.add": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; section: string; text: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.addProposal(ctx.repo, input.section, input.text, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "proposals.edit": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; proposal: string; text: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.editProposal(ctx.repo, input.proposal, input.text, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "proposals.expand": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; proposal: string }>) =>
      proposalFile(
        ctx,
        await refusable(() => ctx.binding.expandProposal(ctx.repo, input.proposal, input.hash)),
        select,
      ),
    type: "ProposalFile",
  },
  "proposals.insert": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; index: number; lines: Array<string>; section: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.insertProposal(ctx.repo, input.section, input.index, input.lines, input.hash),
        ),
        select,
      ),
    type: "Priorities",
  },
  "proposals.move": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; index: number; proposal: string; section: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.moveProposal(
            ctx.repo,
            input.proposal,
            input.section,
            input.index,
            input.hash,
          ),
        ),
        select,
      ),
    type: "Priorities",
  },
  "proposals.outline": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ at?: number; hash: string; kind: string; proposal: string; text?: string }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.outlineProposal(
            ctx.repo,
            input.proposal,
            input.at ?? null,
            input.kind,
            input.text ?? null,
            input.hash,
          ),
        ),
        select,
      ),
    type: "Priorities",
  },
  // A drop: the proposal, or its nested item `at`, under the proposal `under` (its nested item
  // `underAt`), or a proposal of `section`, at `index` there.
  "proposals.drop": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      at?: number;
      hash: string;
      index: number;
      proposal: string;
      section?: string;
      under?: string;
      underAt?: number;
    }>) =>
      priorities(
        ctx,
        await refusable(() =>
          ctx.binding.dropProposal(
            ctx.repo,
            input.proposal,
            input.at ?? null,
            {
              index: input.index,
              list: input.section,
              under: input.under,
              underAt: input.underAt,
            },
            input.hash,
          ),
        ),
        select,
      ),
    type: "Priorities",
  },
  "proposals.remove": {
    resolve: async ({ ctx, input, select }: Resolver<{ hash: string; proposal: string }>) =>
      priorities(
        ctx,
        await refusable(() => ctx.binding.removeProposal(ctx.repo, input.proposal, input.hash)),
        select,
      ),
    type: "Priorities",
  },
  "proposals.undoCommitted": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<Queued<{ hash: string; lines: Array<string> }>>) =>
      priorities(
        ctx,
        await listCommit(ctx, input.write, () =>
          ctx.binding.undoCommittedProposal(ctx.repo, input.lines, input.hash),
        ),
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
  "session.allowAll": {
    resolve: async ({ ctx, input, select }: Resolver<{ session: string }>) => {
      await refusedOn(() => ctx.sessions.allowAll(ctx.repo, input.session));
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
      /**
       * With `folder`: a new session of the feature, as "New session" asks, created with this first
       * message, never before; without it, the feature's session, created if it has none.
       */
      newSession?: boolean;
      /** The session to send to. */
      session?: string;
      text: string;
      /**
       * The workflow's message, which starts the feature's step: in a new session of the feature
       * when `fresh`, which answers. `step` is the step it was read at: once the feature moved on,
       * it runs as a chat.
       */
      workflow?: { file?: string; fresh?: boolean; step?: string; trigger: Trigger };
    }>) => {
      const { workflow } = input;
      if (workflow && !TRIGGERS.includes(workflow.trigger)) {
        throw callSiteError(`refused: no trigger ${workflow.trigger}`);
      }
      const images = await sentImages(ctx, input.images, workflow !== undefined);
      const message = {
        text: input.text,
        ...(images.length === 0 ? {} : { images }),
        ...(workflow === undefined
          ? {}
          : {
              workflow: {
                trigger: workflow.trigger,
                ...(workflow.file === undefined ? {} : { file: workflow.file }),
                ...(workflow.fresh === undefined ? {} : { fresh: workflow.fresh }),
                freshByDefault: ctx.settings.runs().buildInFreshSession.inForce,
                ...(workflow.step === undefined ? {} : { step: workflow.step }),
              },
            }),
      };
      // A feature whose start is still in the queue keeps the message until the start lands.
      const kept = await onSession(ctx, () => keptForStart(ctx, input, message));
      if (kept !== undefined) {
        return session(ctx, kept, select);
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
        return input.newSession === true
          ? (await ctx.sessions.newSession(ctx.repo, input.folder)).id
          : (await ctx.sessions.featureSession(ctx.repo, input.folder)).id;
      });
      // A run that starts fresh went to a new session: the one it went to answers.
      const sent = await refusedOn(() => ctx.sessions.send(ctx.repo, id, message));
      return session(ctx, sent.session, select);
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
    resolve: async ({ ctx, input, select }: Resolver<Queued<{ path: string }>>) => {
      await writable(ctx, input);
      // A proposal file's commit takes the priorities and the inbox along when they changed.
      await queued(ctx, [LISTS], input.write, { file: input.path }, () =>
        ctx.binding.commitText(ctx.repo, input.path),
      );
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
    type: "ProposalFile",
  },
  "text.discovery": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; level: string; path: string }>) => {
      await writable(ctx, input);
      return proposalFile(
        ctx,
        await refusable(() =>
          ctx.binding.setDiscovery(ctx.repo, input.path, input.level, input.hash),
        ),
        select,
      );
    },
    type: "ProposalFile",
  },
  "text.save": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; path: string; text: string }>) => {
      await writable(ctx, input);
      await refusable(() => ctx.binding.saveText(ctx.repo, input.path, input.text, input.hash));
      return proposalFile(ctx, await ctx.binding.readText(ctx.repo, input.path), select);
    },
    type: "ProposalFile",
  },
  "writes.dismiss": {
    resolve: async ({ ctx, input, select }: Resolver<{ id: string }>) => {
      ctx.hosts.byPath(ctx.repo)?.queue.dismiss(input.id);
      return sources.masked(writeQueueDataView, ctx, writeQueue(ctx), select);
    },
    type: "WriteQueue",
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
