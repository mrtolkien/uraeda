// The starts through the write queue (US4): a proposal file's start answers once the core planned
// it, with the workflow's message of its first step, and the queue runs it, its steps in its write.
// A message sent to its folder meanwhile waits in the runner, and goes once the start lands.
import type { PlannedView, StartedView, StartStepView } from "uraeda-binding";
import { reasonOf } from "../reason.ts";
import type { ChatImage } from "../runner/images.ts";
import { runMessage } from "../runner/message.ts";
import { checkSend, type SendInput } from "../runner/send-input.ts";
import { REFUSALS } from "../runner/sessions.ts";
import type { WriteInput, WriteQueue } from "../writes/queue.ts";
import { STEP, StartProgress, startSteps } from "../writes/start-steps.ts";
import { changeImages } from "./chat-images.ts";
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
 * feature, and its `change` step for a change.
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

/** The core's refusal of a taken slug, in a feature's words or a change's. */
const taken = (kind: Kind, { folder, slug }: PlannedView) =>
  kind === "feature"
    ? `refused: A feature named ${slug} exists already`
    : `refused: ${folder} exists: choose another slug with --slug`;

/** The slugs of the starts the core cannot plan, typed changes', named, while in the queue. */
const typedSlugs = new WeakMap<WriteQueue, Map<string, number>>();

/** Whether a start of `folder`, or a typed change's of its slug, is still in the queue. */
const startQueued = (queue: WriteQueue, { folder, slug }: PlannedView) =>
  (typedSlugs.get(queue)?.has(slug) ?? false) ||
  queue
    .writes()
    .some(
      ({ folder: of, state, steps }) => steps !== undefined && of === folder && state !== "refused",
    );

/** Holds `slug` as taken while `landed` is in the queue: a planned start of it is refused. */
function holdSlug(queue: WriteQueue, slug: string | undefined, landed: Promise<unknown>): void {
  if (slug === undefined) {
    return;
  }
  const held = typedSlugs.get(queue) ?? new Map<string, number>();
  typedSlugs.set(queue, held);
  held.set(slug, (held.get(slug) ?? 0) + 1);
  const release = () => {
    const count = (held.get(slug) ?? 1) - 1;
    if (count === 0) {
      held.delete(slug);
    } else {
      held.set(slug, count);
    }
  };
  landed.then(release, release);
}

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
            // Its commit landed: the lists' calls no longer wait for the start.
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
 * A start the core plans: its kind, the write it queues, or the page its refusal opens when the
 * call names none, its plan, and its run as planned.
 */
type Plannable = {
  href: string;
  kind: Kind;
  plan: () => Promise<PlannedView>;
  run: (planned: PlannedView, onStep: (step: StartStepView) => void) => Promise<StartedView>;
  write: WriteInput | undefined;
};

/**
 * Plans a start, of a proposal file or of a typed feature, and queues it: one plan at a time, so a
 * slug a start still in the queue planned is taken. It waits for no queued write, and answers once
 * queued, with the plan; the messages sent to its folder meanwhile wait for it, and go once it
 * lands.
 */
async function startPlanned(
  ctx: RepoContext,
  { href, kind, plan, run, write }: Plannable,
): Promise<StartPlanRecord> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    throw callSiteError("refused: no repository");
  }
  const root = await refusedOn(() => ctx.sessions.mainRoot(ctx.repo));
  const { starts } = ctx.sessions;
  return inPlanTurn(queue, async () => {
    const planned = await refusable(plan);
    const { branch, folder, title } = planned;
    if (startQueued(queue, planned)) {
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
      run: (onStep: (step: StartStepView) => void) => run(planned, onStep),
      then: () => sendStartKept(ctx, root, folder),
      write: write ?? { href, label: `Starting the ${kind} ${title}` },
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
 * answers with its result once it landed: a refusal is the call's, and leaves the record.
 * Its `slug`, when named, is taken while it is in the queue. Without a host, at once.
 */
export async function landedStart<R>(
  ctx: RepoContext,
  run: StartRun,
  then: (started: StartedView) => Promise<R>,
  slug?: string,
): Promise<R> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    return then(await refusable(() => run(() => {})));
  }
  const held = Promise.withResolvers<void>();
  holdSlug(queue, slug, held.promise);
  try {
    const { id, landed } = await queueStart(
      ctx,
      queue,
      { run, then, write: CHANGE_START },
      () => {},
    );
    try {
      return await refusable(() => landed);
    } catch (error) {
      queue.dismiss(id);
      throw error;
    }
  } finally {
    held.resolve();
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
  const made = row === undefined && cache.folderSessions(root, folder).length === 0;
  const session = row?.id ?? (await ctx.sessions.featureSession(ctx.repo, folder)).id;
  if (starts.keep(root, folder, session, input)) {
    return session;
  }
  // The start landed or was refused meanwhile: the message goes as to any feature, which makes
  // its session again, and the one made here goes while it has no turn.
  if (made) {
    cache.removeEmptySession(session);
  }
  return undefined;
}

/** A proposal file's start, as `feature.start` plans and runs it. */
function proposalStart(
  ctx: RepoContext,
  input: Queued<{ kind?: Kind; proposal: string; slug?: string }>,
): Plannable {
  const kind = input.kind ?? "feature";
  return {
    href: "",
    kind,
    plan: () => ctx.binding.planStart(ctx.repo, input.proposal, input.slug, kind),
    run: (planned, onStep) =>
      ctx.binding.startFeature(ctx.repo, input.proposal, planned.slug, kind, onStep, planned.day),
    write: input.write,
  };
}

/** What `feature.startText` starts: a typed text, its images, its line of Now, and its effort. */
type TypedFeature = Queued<{
  discovery?: string;
  images?: Array<ChatImage>;
  line?: string;
  slug: string;
  text: string;
}>;

/**
 * A typed feature's start, as `feature.startText` plans and runs it: its images read before it is
 * planned, so an image gone refuses it before anything is queued.
 */
async function typedStart(ctx: RepoContext, input: TypedFeature): Promise<Plannable> {
  const images = await changeImages(ctx, input.images);
  const options = {
    ...(input.discovery === undefined ? {} : { discovery: input.discovery }),
    kind: "feature" as const,
    ...(input.line === undefined ? {} : { line: input.line }),
    slug: input.slug,
  };
  return {
    // No file to open: the session page of a refused start sends the human back to the New page.
    href: "",
    kind: "feature",
    plan: () => ctx.binding.planTextStart(ctx.repo, input.text, options),
    run: (planned, onStep) =>
      ctx.binding.startText(ctx.repo, input.text, images, { ...options, day: planned.day }, onStep),
    write: input.write,
  };
}

/** The starts of a proposal file and of a typed feature, answered once planned. */
export const startMutations = {
  "feature.start": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<Queued<{ kind?: Kind; proposal: string; slug?: string }>>) =>
      sources.masked(
        startPlanDataView,
        ctx,
        await startPlanned(ctx, proposalStart(ctx, input)),
        select,
      ),
    type: "StartPlan",
  },
  "feature.startText": {
    resolve: async ({ ctx, input, select }: Resolver<TypedFeature>) =>
      sources.masked(
        startPlanDataView,
        ctx,
        await startPlanned(ctx, await typedStart(ctx, input)),
        select,
      ),
    type: "StartPlan",
  },
};
