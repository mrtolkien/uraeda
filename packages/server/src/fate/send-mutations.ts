// A message sent to a session, or to a feature, whose session is made with it: checked, sent, or
// kept while the feature's start, or its commits, are still in the write queue.
import type { Trigger } from "../runner/events.ts";
import type { ChatImage } from "../runner/images.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { onSession } from "./change-starts.ts";
import { sentImages } from "./chat-images.ts";
import type { Resolver } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";
import { maskedSession as session } from "./session-moves.ts";
import { TRIGGERS } from "./sessions.ts";
import { keptForStart } from "./starts.ts";
import { keptForCommits } from "./commit-messages.ts";

/** The mutation sending a message. */
export const sendMutations = {
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
};
