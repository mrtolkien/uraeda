// What the Git page's lists picked, which its Diff pane shows: a changed file of a group, a commit,
// or a conflicted file. The lists and the Diff are separate panes, so the pick is kept in the
// visit, under the page's own key: a move, a hidden tab, and Back keep it.
import { entry, keep } from "../../store";

export type Picked =
  | { kind: "file"; folder: string | null; path: string }
  | { kind: "commit"; id: string }
  | { kind: "conflict"; path: string };

/** Where the page keeps its own values in the visit, beside its panes'. */
const KEY = "git";

/** A value the page keeps in the visit, as plain text. */
function kept(name: string): string | undefined {
  const value = entry().kept.panes?.[KEY]?.[name];
  return typeof value === "string" ? value : undefined;
}

function keepValue(name: string, value: string | null) {
  const panes = entry().kept.panes ?? {};
  keep({ panes: { ...panes, [KEY]: { ...panes[KEY], [name]: value } } });
}

/** What the lists picked last, read as a signal. */
export function picked(): Picked | undefined {
  const raw = kept("picked");
  return raw === undefined ? undefined : (JSON.parse(raw) as Picked);
}

/** Picks a row, for the Diff pane: nothing changes when it is picked already. */
export function pick(next: Picked) {
  const raw = JSON.stringify(next);
  if (kept("picked") !== raw) keepValue("picked", raw);
}
