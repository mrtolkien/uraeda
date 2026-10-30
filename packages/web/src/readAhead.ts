// What the browser keeps of the pages it read: every page's request stays in memory for the session,
// so Back draws at once, and the selected row's page is read before the human opens it, so a key
// reaches it as fast as a click.
import { useEffect, useEffectEvent } from "react";
import { useFateClient, type useRequest } from "react-fate";
import { ProposalFileView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A page's request, as `useRequest` takes it. */
export type PageRequest = Parameters<typeof useRequest>[0];

/**
 * How many requests each client keeps, the one used longest ago let go first: every page of a
 * session over a repository the size of Uraeda's own (R13).
 */
const KEPT_REQUESTS = 1000;

/** The requests each client keeps, by their key, the one used last at the end. */
const kept = new WeakMap<Fate, Map<string, { dispose: () => void }>>();

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
 * takes no other number.
 */
export function keep(fate: Fate, request: PageRequest) {
  let requests = kept.get(fate);
  if (!requests) {
    requests = new Map();
    kept.set(fate, requests);
  }
  const key = keyOf(request);
  const held = requests.get(key);
  requests.delete(key);
  requests.set(key, held ?? fate.retain(request as never));
  if (requests.size > KEPT_REQUESTS) {
    const [oldest, handle] = requests.entries().next().value!;
    requests.delete(oldest);
    handle.dispose();
  }
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
 * Reads ahead `request`, the page of the row selected, each time the selection moves to another:
 * drawn by a list only for a row with a page, so a list without any needs no fate client.
 */
export function ReadAhead({ request }: { request: PageRequest }) {
  const fate = useFateClient();
  const read = useEffectEvent(() => readAhead(fate, request));
  const key = keyOf(request);
  useEffect(() => read(), [key]);
  return null;
}

/** The request of a proposal file's page, the editor's: as `useProposalFile` reads it. */
export function proposalFilePage(path: string) {
  return { proposalFile: { id: path, view: ProposalFileView } };
}
