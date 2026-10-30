// The repository's git writes still landing, or refused by a hook, as the server's write queue
// publishes them in its one record: the toast lists them, and each place a write happened shows its
// refusal. A committing call names its write with `writeHere`.
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { WriteQueue } from "uraeda-server/fate";
import { useRefreshOnShow } from "../data.ts";
import { localPath } from "../routeTable.ts";
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

/** A write as the queue's record holds it: where it happened too. */
export type Write = QueuedWrite & { file?: string; folder?: string; href: string };

/** The writes of the repository's queue, in the order they were made, the running one first. */
export function useWriteQueue(): ReadonlyArray<Write> {
  const request = { writeQueue: { id: WRITE_QUEUE_ID, view: WriteQueueView } };
  const { writeQueue } = useRequest(request);
  useRefreshOnShow(request);
  return (useLiveView(WriteQueueView, writeQueue)?.writes ?? []) as ReadonlyArray<Write>;
}

/** Whether a write happened at `where`: every place it names matches. */
const happenedAt = (write: Write, where: Where) =>
  (where.folder === undefined || write.folder === where.folder) &&
  (where.file === undefined || write.file === where.file) &&
  (where.href === undefined || write.href === where.href);

/** The write a hook refused at `where`, the latest, until it is dismissed. */
export function useRefusal(where: Where): Write | undefined {
  return useWriteQueue().findLast((write) => write.state === "refused" && happenedAt(write, where));
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
 * What a place calls as it writes again: the refusal of its last write, dealt with by the new one,
 * leaves the queue.
 */
export function useClearRefusal(where: Where): () => void {
  const refused = useRefusal(where);
  const dismiss = useDismissWrite();
  return () => {
    if (refused) {
      void dismiss(refused.id);
    }
  };
}
