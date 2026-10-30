// The starts through the write queue (US4): a proposal file's start answers once the core planned
// it, with the workflow's message of its first step, and the queue runs it, its steps in its write.
// A message sent to its folder meanwhile waits in the runner, and goes once the start lands.
import type { PlannedView, StartedView, StartStepView } from "uraeda-binding";
import { reasonOf } from "../reason.ts";
import { runMessage } from "../runner/message.ts";
import { checkSend, type SendInput } from "../runner/send-input.ts";
import { REFUSALS } from "../runner/sessions.ts";
import type { WriteInput, WriteQueue } from "../writes/queue.ts";
import { STEP, StartProgress, startSteps } from "../writes/start-steps.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { sendKept } from "./kept-sends.ts";
import { refusedOn } from "./list-mutations.ts";
import { sources } from "./sources.ts";
import { startPlanDataView, type StartPlanRecord } from "./views-start-plan.ts";
import { featureKeys, LISTS, type Queued } from "./write-queue.ts";

type Kind = "change" | "feature";

/** A start's run in the core, its steps given to `onStep`. */
type StartRun = (onStep: (step: StartStepView) => void) => Promise<StartedView>;

/**
 * A start to queue: its write's name, the feature it makes and its branch when planned, its run,
 * and what follows once it ran, the agent's step, whose result the start's write lands with.
 */
type QueuedStart<R> = {
  branch?: string;
  folder?: string;
  run: StartRun;
  then: (started: StartedView) => Promise<R>;
  write: WriteInput;
};

/**
 * The workflow's message of a planned start's first step, as `readWorkflowMessage` reads it once
 * the start landed: a committed proposal and nothing else is the core's `discovery` step for a
 * feature, and its `change` step for a change (R49).
 */
export function startMessage(planned: PlannedView, kind: Kind): string {
  const step = kind === "change" ? "change" : "discovery";
  return runMessage({
    branch: planned.branch,
    feature: { kind, path: `specs/${kind === "change" ? "changes/" : ""}${planned.folder}` },
    reference: `skills/uraeda/references/${step}.md`,
    step,
    trigger: "start",
  });
}

/** The core's refusal of a taken slug, in a feature's words or a change's (R32). */
const taken = (kind: Kind, { folder, slug }: PlannedView) =>
  kind === "feature"
    ? `refused: A feature named ${slug} exists already`
    : `refused: ${folder} exists: choose another slug with --slug`;

/** Whether a start of `folder` is still in the queue, landing or waiting. */
const startQueued = (queue: WriteQueue, folder: string) =>
  queue
    .writes()
    .some(
      ({ folder: of, state, steps }) => steps !== undefined && of === folder && state !== "refused",
    );

/**
 * Queues a start behind the writes queued before it, its steps in its write, holding the lists'
 * key until its commit landed, and its feature's: their next calls wait for it. Its run takes the committing calls' turn,
 * so no call is between its write and the take of its commit while the start checks the checkout.
 * `refused` is told of a refusal.
 */
async function queueStart<R>(
  ctx: RepoContext,
  queue: WriteQueue,
  start: QueuedStart<R>,
  refused: () => void,
): Promise<{ id: string; landed: Promise<R> }> {
  const { defaultBranch } = await ctx.binding.readWorkspace(ctx.repo);
  const steps = startSteps(defaultBranch ?? "the default branch", start.branch);
  const keys = start.folder === undefined ? [LISTS] : [LISTS, ...featureKeys(start.folder)];
  let id = "";
  const progress = new StartProgress(steps, (changed) => queue.update(id, { steps: changed }));
  const write = { ...start.write, ...(start.folder === undefined ? {} : { folder: start.folder }) };
  const added = queue.add(
    { ...write, steps },
    async (onOutput) => {
      progress.to(STEP.commit);
      try {
        const started = await queue.inTurn(() =>
          start.run((step) => {
            // Its commit landed: the lists' calls no longer wait for the start (R69).
            if (step.step === "branching") {
              queue.free(id, [LISTS]);
            }
            progress.step(step, onOutput);
          }),
        );
        progress.to(STEP.agent);
        const result = await start.then(started);
        progress.done();
        return result;
      } catch (error) {
        progress.refused(reasonOf(error));
        refused();
        throw error;
      }
    },
    keys,
  );
  id = added.id;
  return { id, landed: added.landed as Promise<R> };
}

/**
 * Sends the messages kept for the started folder, in order, to the session they were kept for,
 * made for them: one that cannot be sent comes back to its composer, with the ones after it, as a
 * started change's first run is not refused.
 */
async function sendStartKept(ctx: RepoContext, root: string, folder: string): Promise<void> {
  const { inputs, session } = ctx.sessions.starts.take(root, folder);
  if (session !== undefined) {
    await sendKept(
      ctx,
      folder,
      inputs.map((input) => ({ input, made: true, session })),
    );
  }
}

/** Each queue's plans, one after the other: a plan sees the starts queued before it. */
const plans = new WeakMap<WriteQueue, Promise<unknown>>();

/** Runs `plan` after the plans of `queue` before it. */
function inPlanTurn<T>(queue: WriteQueue, plan: () => Promise<T>): Promise<T> {
  const turn = (plans.get(queue) ?? Promise.resolve()).then(plan);
  plans.set(
    queue,
    turn.catch(() => {}),
  );
  return turn;
}

/**
 * Plans the start of a proposal file, and queues it: one plan at a time, so a slug a start still in
 * the queue planned is taken. It waits for no queued write, and answers once queued, with the plan;
 * the messages sent to its folder meanwhile wait for it, and go once it lands.
 */
async function startPlanned(
  ctx: RepoContext,
  input: Queued<{ kind?: Kind; proposal: string; slug?: string }>,
): Promise<StartPlanRecord> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    throw callSiteError("refused: no repository");
  }
  const kind = input.kind ?? "feature";
  const root = await refusedOn(() => ctx.sessions.mainRoot(ctx.repo));
  const { starts } = ctx.sessions;
  return inPlanTurn(queue, async () => {
    const planned = await refusable(() =>
      ctx.binding.planStart(ctx.repo, input.proposal, input.slug, kind),
    );
    const { branch, folder, title } = planned;
    if (startQueued(queue, folder)) {
      throw callSiteError(taken(kind, planned));
    }
    let id = "";
    // A message kept before the start's write is queued waits for its id.
    let early: string | undefined;
    starts.open(root, folder, (text) => {
      if (id === "") {
        early = text;
      } else {
        queue.update(id, { queued: text });
      }
    });
    const start = {
      branch,
      folder,
      run: (onStep: (step: StartStepView) => void) =>
        ctx.binding.startFeature(ctx.repo, input.proposal, planned.slug, kind, onStep),
      then: () => sendStartKept(ctx, root, folder),
      write: input.write ?? { href: "", label: `Starting the ${kind} ${title}` },
    };
    const queued = await queueStart(ctx, queue, start, () => starts.drop(root, folder)).catch(
      (error: unknown) => {
        starts.drop(root, folder);
        throw error;
      },
    );
    id = queued.id;
    if (early !== undefined) {
      queue.update(id, { queued: early });
    }
    // A refusal stays in the record, with the messages kept for the composer.
    queued.landed.catch(() => {});
    return { folder, id: folder, message: startMessage(planned, kind), title };
  });
}

/** The write of a change's start, which the core cannot plan. */
const CHANGE_START: WriteInput = { href: "", label: "Starting a change" };

/**
 * Runs a start the core cannot plan, a typed change's, through the queue, then `then`, and
 * answers with its result once it landed (R50): a refusal is the call's, and leaves the record.
 * Without a host, at once.
 */
export async function landedStart<R>(
  ctx: RepoContext,
  run: StartRun,
  then: (started: StartedView) => Promise<R>,
): Promise<R> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    return then(await refusable(() => run(() => {})));
  }
  const { id, landed } = await queueStart(ctx, queue, { run, then, write: CHANGE_START }, () => {});
  try {
    return await refusable(() => landed);
  } catch (error) {
    queue.dismiss(id);
    throw error;
  }
}

/**
 * Keeps a message sent to a feature, or to its session, while its start is still in the queue,
 * checked as sending it would be: the session it goes to once the start lands, made now, or
 * undefined when no start of its folder is in the queue.
 */
export async function keptForStart(
  ctx: RepoContext,
  to: { folder?: string; session?: string },
  input: SendInput,
): Promise<string | undefined> {
  const root = await ctx.sessions.mainRoot(ctx.repo);
  const { adapter, cache, starts } = ctx.sessions;
  const row = to.session === undefined ? undefined : cache.session(to.session);
  const folder = to.session === undefined ? to.folder : row?.repo === root ? row.folder : null;
  if (!folder || !starts.waits(root, folder)) {
    return undefined;
  }
  if (!ctx.sessions.status().available) {
    throw new Error(`refused: ${REFUSALS.unavailable(adapter.name)}`);
  }
  checkSend(input, adapter.capabilities);
  const session = row?.id ?? (await ctx.sessions.featureSession(ctx.repo, folder)).id;
  // The start may have landed meanwhile: the message then goes as to any feature.
  return starts.keep(root, folder, session, input) ? session : undefined;
}

/** The start of a proposal file, answered once planned. */
export const startMutations = {
  "feature.start": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<Queued<{ kind?: Kind; proposal: string; slug?: string }>>) =>
      sources.masked(startPlanDataView, ctx, await startPlanned(ctx, input), select),
    type: "StartPlan",
  },
};
