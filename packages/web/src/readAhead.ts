// What the browser keeps of the pages it read: every page's request stays in memory for the session,
// so Back draws at once, and the selected row's page is read before the human opens it, so a key
// reaches it as fast as a click.
import { useEffect, useEffectEvent } from "react";
import { useFateClient, type useRequest } from "react-fate";
import type { StoryTarget } from "uraeda-binding";
import { FileView, ProposalFileView, StoryView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A page's request, as `useRequest` takes it. */
export type PageRequest = Parameters<typeof useRequest>[0];

/**
 * How many requests each client keeps, the one used longest ago let go first: every page of a
 * session over a repository the size of Uraeda's own.
 */
const KEPT_REQUESTS = 1000;

/**
 * How long a page's data stays current without a live subscription: a new subscription is sent
 * the records changed in the server's last 2 seconds, so a page off screen for longer may
 * have missed a change.
 */
const REPLAYED_MS = 2000;

/** A request kept: its retained data, and when that data was last known current. */
type Kept = { current: number; dispose: () => void };

/** The requests each client keeps, by their key, the one used last at the end. */
const kept = new WeakMap<Fate, Map<string, Kept>>();

/** A number for each view, which tells two requests of the same record apart by their fields. */
const views = new WeakMap<object, number>();
let lastView = 0;

function viewNumber(view: object) {
  const known = views.get(view);
  if (known !== undefined) {
    return known;
  }
  lastView += 1;
  views.set(view, lastView);
  return lastView;
}

/** A request's key: each root's name, its records' ids, its arguments, and its view. */
function keyOf(request: PageRequest) {
  const roots = Object.entries(request as Record<string, Record<string, unknown>>);
  return roots
    .map(([root, { args, id, ids, view }]) =>
      JSON.stringify([root, id ?? ids ?? null, args ?? null, viewNumber(view as object)]),
    )
    .sort()
    .join(",");
}

/**
 * Keeps the data of `request` in `fate`'s memory, past the page that read it: fate's own collector
 * keeps only the last 10 requests no page shows, and its client as the server's types make it
 * takes no other number. A request kept anew is current now, as it is about to be read.
 */
export function keep(fate: Fate, request: PageRequest): Kept {
  let requests = kept.get(fate);
  if (!requests) {
    requests = new Map();
    kept.set(fate, requests);
  }
  const key = keyOf(request);
  const held = requests.get(key) ?? {
    current: performance.now(),
    dispose: fate.retain(request as never).dispose,
  };
  requests.delete(key);
  requests.set(key, held);
  if (requests.size > KEPT_REQUESTS) {
    const [oldest, handle] = requests.entries().next().value!;
    requests.delete(oldest);
    handle.dispose();
  }
  return held;
}

/**
 * Keeps the request of a page shown, drawn from memory at once, and reads it again from the
 * server behind when what memory holds may have missed a change. Returns what to call as the
 * page leaves the screen: its live subscription kept it current until then.
 */
export function show(fate: Fate, request: PageRequest): () => void {
  const held = keep(fate, request);
  if (performance.now() - held.current > REPLAYED_MS) {
    held.current = performance.now();
    void fate.request(request as never, { mode: "network-only" }).catch(() => {});
  }
  return () => {
    held.current = performance.now();
  };
}

/** The reads a tab's return started, by client and request, each shared until it ends. */
const sharedReads = new WeakMap<object, Map<object, Promise<unknown>>>();

/**
 * `useRefreshOnShow` for a request many components make at once, the same object each time: the
 * tab's return reads it again once per client, however many listen.
 */
export function useSharedRefreshOnShow(request: PageRequest) {
  const fate = useFateClient();
  useEffect(() => {
    const hide = show(fate, request);
    const reads = sharedReads.get(fate) ?? new Map<object, Promise<unknown>>();
    sharedReads.set(fate, reads);
    const refresh = () => {
      if (document.visibilityState === "visible" && !reads.has(request)) {
        reads.set(
          request,
          fate
            .request(request as never, { mode: "network-only" })
            .catch(() => {})
            .finally(() => reads.delete(request)),
        );
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      hide();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fate, request]);
}

/**
 * Reads a page's request ahead of its page, from memory when the browser holds it already, and
 * keeps it: the page then draws without waiting.
 */
export function readAhead(fate: Fate, request: PageRequest) {
  keep(fate, request);
  void fate.request(request as never).catch(() => {});
}

/**
 * Reads `requests` together, as a page draws, before the first of them suspends it: each is sent
 * once, a read under way or held by the browser not again, so a page drawn again sends nothing. A
 * page whose parts each read their own record would read them one after another.
 */
export function readAlong(fate: Fate, requests: ReadonlyArray<PageRequest>) {
  for (const request of requests) {
    readAhead(fate, request);
  }
}

/**
 * How long the selection rests on a row before its page is read ahead: a held j or k passes rows
 * faster, and reads and keeps none of them.
 */
const RESTED_MS = 50;

/**
 * Reads ahead `request`, the page of the row selected, each time the selection moves to another
 * and rests there: drawn by a list only for a row with a page, so a list without any needs no
 * fate client.
 */
export function ReadAhead({ request }: { request: PageRequest }) {
  const fate = useFateClient();
  const read = useEffectEvent(() => readAhead(fate, request));
  const key = keyOf(request);
  useEffect(() => {
    const rested = setTimeout(read, RESTED_MS);
    return () => clearTimeout(rested);
  }, [key]);
  return null;
}

/** The request of a workflow file's page, by its feature's folder and its name, as `useFile` reads it. */
export function filePage(folder: string, name: string) {
  return { workflowFile: { id: `${folder}/${name}`, view: FileView } };
}

/** The request of a story embedded in a page, by its checkout's folder, as `useStory` reads it. */
export function storyRead(folder: string, story: StoryTarget) {
  return { story: { id: `${folder}:${story.path}#${story.export}`, view: StoryView } };
}

/** The request of a proposal file's page, the editor's: as `useProposalFile` reads it. */
export function proposalFilePage(path: string) {
  return { proposalFile: { id: path, view: ProposalFileView } };
}
