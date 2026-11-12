// The Git page's writes: each is a call of `git.*`, named for the write queue with what it does and
// the page it came from, so the queue's record shows "Committing 1 file in main" with git's output
// while it lands. Its control shows it pending at once, and a refusal comes back under that control,
// whole, in git's or the hook's own words: `where` names the control, `"sync"` or a group's
// `"commit:<folder>"`. A new write from the same control takes its refusal away.
import { signal } from "nsh";
import { type ActionName, call, type Input, pathOf } from "../../store";
import { refusalOf } from "../../ui/controls";

type Where = string;

const pending = signal<ReadonlySet<Where>>(new Set());
const refusals = signal<Readonly<Record<Where, string>>>({});

/** Whether a write from the control `where` is on its way. */
export const isPending = (where: Where) => pending().has(where);

/** Why the last write from `where` was refused, until the next one or a dismissal. */
export const refusalAt = (where: Where): string | null => refusals()[where] ?? null;

/** Takes the refusal under `where` away. */
export function dismiss(where: Where) {
  const { [where]: _gone, ...rest } = refusals();
  refusals.set(rest);
}

function setPending(where: Where, on: boolean) {
  const next = new Set(pending());
  if (on) next.add(where);
  else next.delete(where);
  pending.set(next);
}

/** The words a refusal shows: the server's, which hold git's or the hook's output whole. */
function wordsOf(error: unknown): string {
  const message = refusalOf(error);
  return message.trim() === "" ? "Git refused it, and said nothing more." : message.trim();
}

/**
 * Runs the write `name` from the control `where`, named `label` in the write queue: `true` once it
 * landed, `false` when it was refused, its words then under `where`.
 */
export async function write<A extends ActionName & `git.${string}`>(
  where: Where,
  name: A,
  input: Omit<Input<A>, "write">,
  label: string,
): Promise<boolean> {
  dismiss(where);
  setPending(where, true);
  const repo = (input as { repo: string }).repo;
  const named = { ...input, write: { href: pathOf({ page: "git", repo }), label } } as Input<A>;
  try {
    await call(name, named);
    return true;
  } catch (error) {
    refusals.set({ ...refusals(), [where]: wordsOf(error) });
    return false;
  } finally {
    setPending(where, false);
  }
}
