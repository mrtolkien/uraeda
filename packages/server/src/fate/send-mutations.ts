// A message sent to a session, or to a feature, whose session is made with it: checked, sent, or
// kept while the feature's start, or its commits, are still in the write queue.
import type { Adapter } from "../runner/adapter.ts";
import type { Trigger } from "../runner/events.ts";
import type { ChatImage } from "../runner/images.ts";
import { pickOf } from "../runner/picks.ts";
import { messageRuntime } from "../runner/runtimes.ts";
import { onSession } from "./change-starts.ts";
import { sentImages } from "./chat-images.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";
import { maskedSession as session } from "./session-moves.ts";
import { TRIGGERS } from "./sessions.ts";
import { keptForStart } from "./starts.ts";
import { keptForCommits } from "./commit-messages.ts";

/**
 * The runtime a message goes to, as `messageRuntime` picks it: the session's, else the feature's
 * latest session's, else the one a new session of the repository's main checkout runs on (R19),
 * `runtime` when one was picked (R20).
 */
async function sendRuntime(
  ctx: RepoContext,
  input: { folder?: string; newSession?: boolean; runtime?: string; session?: string },
): Promise<Adapter | undefined> {
  const { cache, runtimes } = ctx.sessions;
  if (input.session !== undefined) {
    return ctx.sessions.runtimeOf(input.session);
  }
  const root = await ctx.sessions.mainRoot(ctx.repo);
  const latest =
    input.folder === undefined || input.newSession === true
      ? undefined
      : cache.latestSession(root, input.folder);
  return runtimes.get(latest?.agent ?? input.runtime ?? runtimes.defaultFor(root) ?? "");
}

/** The mutation sending a message. */
export const sendMutations = {
  "session.send": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{
      /** The effort a session made with this message runs on, else its agent's default. */
      effort?: string;
      /** Or the feature, whose session is created with its first message. */
      folder?: string;
      /** The chat images, as `POST /attach` saved them. */
      images?: Array<ChatImage>;
      /** The model a session made with this message runs on, else its agent's default. */
      model?: string;
      /**
       * With `folder`: a new session of the feature, as "New session" asks, created with this first
       * message, never before; without it, the feature's session, created if it has none.
       */
      newSession?: boolean;
      /**
       * The runtime a session made with this message runs on, else the first one on here: unused,
       * as `model` and `effort` are, for a message to a session that exists (R20).
       */
      runtime?: string;
      /** The session to send to. */
      session?: string;
      text: string;
      /**
       * The workflow's message, which starts the feature's step: in the session its step's options
       * give, or a new session of the feature when `fresh`, which answers. `step` is the step it
       * was read at: once the feature moved on, it runs as a chat.
       */
      workflow?: { file?: string; fresh?: boolean; step?: string; trigger: Trigger };
    }>) => {
      const { workflow } = input;
      if (workflow && !TRIGGERS.includes(workflow.trigger)) {
        throw callSiteError(`refused: no trigger ${workflow.trigger}`);
      }
      const runtime = await sendRuntime(ctx, input);
      const images = await sentImages(ctx, input.images, workflow !== undefined, runtime);
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
                ...(workflow.step === undefined ? {} : { step: workflow.step }),
              },
            }),
      };
      // A feature whose start, or whose commits, are still in the queue keeps the message until
      // they land.
      const kept = await onSession(
        ctx,
        async () =>
          (await keptForStart(ctx, input, message)) ?? keptForCommits(ctx, input, message),
      );
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
        const root = await ctx.sessions.mainRoot(ctx.repo);
        const latest =
          input.newSession === true
            ? undefined
            : ctx.sessions.cache.latestSession(root, input.folder);
        messageRuntime(ctx.sessions.runtimes, root, latest, input.runtime);
        // A folder that is no feature's gets no session.
        await ctx.binding.readFeature(ctx.repo, input.folder);
        const pick = pickOf(input);
        return input.newSession === true
          ? (await ctx.sessions.newSession(ctx.repo, input.folder, pick)).id
          : (await ctx.sessions.featureSession(ctx.repo, input.folder, pick)).id;
      });
      // A run may go to a new session of its step: the one it went to answers.
      const sent = await refusedOn(() => ctx.sessions.send(ctx.repo, id, message));
      return session(ctx, sent.session, select);
    },
    type: "Session",
  },
};
