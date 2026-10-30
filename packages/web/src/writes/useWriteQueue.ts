// The repository's git writes still landing, or refused by a hook, as the server's write queue
// publishes them in its one record: the toast lists them, and each place a write happened shows its
// refusal. A committing call names its write with `writeHere`.
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { WriteQueue } from "uraeda-server/fate";
import { useSharedRefreshOnShow } from "../readAhead.ts";
import { localPath } from "../routeTable.ts";
import type { StartStep } from "../session/StartSteps.tsx";
import type { QueuedWrite } from "./CommitToast.tsx";

/** The id of the repository's one record of its write queue, as the server names it. */
const WRITE_QUEUE_ID = "write-queue";

/** The queue's record: its writes come whole. */
const WriteQueueView = view<WriteQueue>()({ id: true, writes: true });

/**
 * The element of a hook's refusal where it happened: the toast's Open goes to it, and one page shows
 * one at a time.
 */
export const REFUSED_ID = "write:refused";

/** Where a write happened: its feature and file, or the page it was made on. */
export type Where = { file?: string; folder?: string; href?: string };

/**
 * A write as the queue's record holds it: where it happened too, and, for a feature's start, its
 * steps and the messages sent meanwhile, which its agent starts with once it lands.
 */
export type Write = QueuedWrite & {
  href: string;
  queued?: string;
  steps?: ReadonlyArray<StartStep>;
};

/** The one request every reader of the queue makes: the same object, so they share its read. */
const REQUEST = { writeQueue: { id: WRITE_QUEUE_ID, view: WriteQueueView } };

/** The writes of the repository's queue, in the order they were made, the running one first. */
export function useWriteQueue(): ReadonlyArray<Write> {
  const { writeQueue } = useRequest(REQUEST);
  useSharedRefreshOnShow(REQUEST);
  return (useLiveView(WriteQueueView, writeQueue)?.writes ?? []) as ReadonlyArray<Write>;
}

/** Whether a write happened at `where`: every place it names matches. */
const happenedAt = (write: Write, where: Where) =>
  (where.folder === undefined || write.folder === where.folder) &&
  (where.file === undefined || write.file === where.file) &&
  (where.href === undefined || write.href === where.href);

/** Whether `write` was refused at `where`: messages not sent belong to their composer. */
const refusedAt = (write: Write, where: Where) =>
  write.state === "refused" && write.failure !== "unsent" && happenedAt(write, where);

/**
 * The write a hook refused at `where`, the latest, until it is dismissed.
 */
export function useRefusal(where: Where): Write | undefined {
  return useWriteQueue().findLast((write) => refusedAt(write, where));
}

/** Takes a refused write out of the queue's record, in every tab. */
export function useDismissWrite(): (id: string) => Promise<unknown> {
  const fate = useFateClient();
  return (id) => fate.mutations.writes.dismiss({ input: { id }, view: WriteQueueView });
}

/**
 * The name of a write a button makes, for the toast: `label`, what it does, as "Approving the spec
 * of Performance pass", and the page it is made on, where its refusal shows.
 */
export function writeHere(label: string): { href: string; label: string } {
  return { href: localPath(window.location.pathname), label };
}

/**
 * What a place calls as it writes again: the refusals of its writes, dealt with by the new one,
 * leave the queue, every one, not only the latest the place shows.
 */
export function useClearRefusal(where: Where): () => void {
  const writes = useWriteQueue();
  const dismiss = useDismissWrite();
  return () => {
    for (const write of writes) {
      if (refusedAt(write, where)) {
        void dismiss(write.id);
      }
    }
  };
}
