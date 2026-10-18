import type { Binding } from "../fate/context.ts";
import type { Capabilities } from "./adapter.ts";
import type { Item, Trigger } from "./events.ts";
import type { ChatImage } from "./images.ts";
import { MAX_IMAGES } from "../limits.ts";
import { chatOpening, sentAsChat } from "./message.ts";
import { type Live, type Queued, REFUSALS, refused, type SessionContext } from "./session-state.ts";

/** A chat image sent with a message: its ID and size, which its item keeps, and its file's path. */
export type SentImage = ChatImage & { path: string };

/**
 * A message to send: its text, its chat images, and for the workflow's, what started it, whether
 * its run starts a new agent session, `fresh`, and the step its message was read at, `step`.
 * Without `fresh`, the run after a spec's approval starts one as the `build_in_fresh_session`
 * setting says, `freshByDefault`, on by default.
 */
export type SendInput = {
  images?: Array<SentImage>;
  text: string;
  workflow?: {
    file?: string;
    fresh?: boolean;
    freshByDefault?: boolean;
    step?: string;
    trigger: Trigger;
  };
};

/**
 * A message checked before any session work: text, or images alone, as `checkImages` allows
 * them. Its item keeps the images' IDs and sizes, `held`; the agent gets their paths.
 */
export function checkSend(input: SendInput, capabilities: Capabilities) {
  const images = input.images ?? [];
  const blank = input.text.trim() === "";
  if (blank && images.length === 0) {
    throw refused(REFUSALS.blank);
  }
  checkImages(images, input.workflow !== undefined, capabilities);
  const held: { images?: Array<ChatImage> } =
    images.length === 0
      ? {}
      : { images: images.map(({ height, id, width }) => ({ height, id, width })) };
  return {
    held,
    paths: images.map(({ path }) => ({ path })),
    text: blank ? "" : input.text,
    workflow: input.workflow,
  };
}

/**
 * Refuses a message's images: more than 10, to an agent that does not declare images, or with the
 * workflow's message, which is the workflow's own text.
 */
export function checkImages(
  images: Array<unknown>,
  workflow: boolean,
  capabilities: Capabilities,
): void {
  if (images.length === 0) {
    return;
  }
  if (workflow) {
    throw refused(REFUSALS.workflowImages);
  }
  if (images.length > MAX_IMAGES) {
    throw refused(REFUSALS.tooManyImages);
  }
  if (!capabilities.images) {
    throw refused(REFUSALS.noImages);
  }
}

/** A message's item, pending until the agent reads it, as it is sent now. */
export function messageItem(
  id: string,
  origin: "human" | "workflow",
  text: string,
): Extract<Item, { kind: "message" }> {
  return { at: new Date().toISOString(), id, kind: "message", origin, state: "pending", text };
}

/**
 * Where a message goes: its feature's branch, refused once merged, and for the workflow's, the
 * step its run starts, or the line saying it runs as a chat, `asChat`, as `sentAsChat` decides.
 */
export async function sendPlace(
  binding: Binding,
  live: { folder: string | null; repo: string },
  workflow: SendInput["workflow"],
): Promise<{ asChat?: string; branch?: string; step: string | null }> {
  const { folder, repo } = live;
  if (folder === null) {
    if (workflow) {
      throw new Error("a chat has no workflow to continue");
    }
    return { step: null };
  }
  const next = await binding.nextStep(repo, folder);
  const { branch } = next;
  if (branch === undefined) {
    throw refused(REFUSALS.noBranch);
  }
  if (!workflow) {
    return { branch, step: null };
  }
  const feature = () => binding.readFeature(repo, folder);
  const asChat = await sentAsChat({ feature, next, workflow });
  return asChat === undefined ? { branch, step: next.step.name } : { asChat, branch, step: null };
}

/**
 * The chat opening a chat message on a feature starts with: on its session's first turn, or after
 * a workflow run. A queued turn's, `before`, looks at the turns before it.
 */
export async function openingOf(
  { binding, cache }: Pick<SessionContext, "binding" | "cache">,
  live: Live,
  branch: string | undefined,
  before?: number,
): Promise<string | undefined> {
  if (live.folder === null || branch === undefined) {
    return undefined;
  }
  const last = cache
    .turns(live.id)
    .filter((turn) => turn.kind !== "allow" && (before === undefined || turn.id < before))
    .at(-1);
  if (last !== undefined && last.kind !== "workflow") {
    return undefined;
  }
  return chatOpening({ branch, feature: await binding.readFeature(live.repo, live.folder) });
}

/**
 * Checks a queued workflow run again as it starts, with `sendPlace`'s rule: one that no longer
 * applies starts as a chat, from the human, with the line saying so, and the chat opening when a
 * chat there opens with it. Refused once its feature is merged.
 */
export async function recheckQueued(
  context: SessionContext,
  live: Live,
  queued: Queued,
): Promise<void> {
  const { workflow } = queued;
  if (!workflow) {
    return;
  }
  const { cache, changed } = context;
  const { asChat, branch } = await sendPlace(context.binding, live, workflow);
  if (asChat === undefined) {
    return;
  }
  const opening = await openingOf(context, live, branch, queued.id);
  // A take-back, or Stop, may have ended it meanwhile.
  const sent = live.messages.get(queued.message.id);
  if (!sent || !live.queue.includes(queued)) {
    return;
  }
  const { text } = sent.item;
  sent.item = { ...sent.item, origin: "human", ...(opening === undefined ? {} : { opening }) };
  cache.updateItem(queued.id, sent.seq, sent.item);
  cache.retypeTurn(queued.id, { kind: "chat", step: null, trigger: null });
  cache.appendItem(queued.id, { kind: "system", text: asChat });
  queued.message = {
    ...queued.message,
    text: opening === undefined ? text : `${opening}\n${text}`,
  };
  delete queued.fresh;
  delete queued.workflow;
  changed(live, queued.id);
}
