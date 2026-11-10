// The acceptance of a job's offer: scheduling a job is the human's yes for the change its run
// offers (the agents decision), so a run that ends on a change offer has that change started, as
// the offer's card would start it, unless the job only reports. Every way the human could have
// stepped in, or the offer could be less than the run's last word, leaves the card waiting.
import { onSessionChange } from "../live.ts";
import type { RepoContext } from "../fate/context.ts";
import { toChange } from "../fate/session-moves.ts";
import { reasonOf } from "../reason.ts";
import type { SessionCache } from "../runner/cache.ts";
import type { Item } from "../runner/events.ts";
import { jobChangeLine } from "../runner/message.ts";
import { lastOffer, proposalTitle } from "../runner/offers.ts";
import { REFUSALS } from "../runner/session-state.ts";

/** The start of an offer block's first line, in any kind. */
const OPENING = /^```uraeda-offer\b/gmu;

/**
 * The agent's text that is the run's last word: the last of the turn's texts and calls of its own
 * agent, when it is a text. A call after the text, or a sub-agent's, is not its last word.
 */
function lastWord(items: Array<Item>): string | undefined {
  const last = items.findLast(
    (item) => item.kind === "text" || (item.kind === "tool" && item.parent === undefined),
  );
  return last?.kind === "text" ? last.text : undefined;
}

/**
 * The proposal of the change the text offers: its last closed block is a `change` offer, and no
 * block opens after it. A `feature` offer, or a block left open, offers no change.
 */
function proposalOf(text: string): string | undefined {
  const offer = lastOffer(text);
  if (offer?.kind !== "change") {
    return undefined;
  }
  const last = [...text.matchAll(OPENING)].at(-1);
  return last?.index !== undefined && lastOffer(text.slice(last.index)) === undefined
    ? undefined
    : offer.body;
}

/** Whether the human wrote in the session: any message of the origin `human`, of any turn. */
function humanWrote(cache: SessionCache, session: string): boolean {
  return cache
    .turns(session)
    .some((turn) => cache.itemsOf(turn.id, "message").some((item) => item.origin === "human"));
}

/**
 * Starts the change the run's turn offered, when the run, the job, and the session allow it. The
 * checks of what the human may have done meanwhile come after the only wait, the read of the jobs,
 * so nothing but `toChange`'s own hold separates them from the start.
 */
async function accept(shared: Omit<RepoContext, "repo">, session: string, turn: number) {
  const { binding, sessions, settings } = shared;
  const { cache } = sessions;
  const run = cache.jobs.ofSession(session);
  const proposal = run && proposalOf(lastWord(cache.items(turn, 0, cache.itemCount(turn))) ?? "");
  if (!run || proposal === undefined) {
    return;
  }
  const { jobs, problem } = await binding.readJobs(settings.dir);
  const job = problem === undefined ? jobs.find((one) => one.name === run.job) : undefined;
  const row = cache.session(session);
  const ended = cache.turns(session).at(-1);
  if (
    job === undefined ||
    job.problem !== undefined ||
    job.reportOnly ||
    // The run's row is the session's own repository's, and the turn is the session's last.
    row === undefined ||
    row.repo !== run.repository ||
    row.folder !== null ||
    row.archivedAt !== null ||
    ended?.id !== turn ||
    ended.state !== "done" ||
    ended.dismissedAt !== null ||
    run.refusedTurn === turn ||
    humanWrote(cache, session) ||
    sessions.sessionWorking(session)
  ) {
    return;
  }
  try {
    await toChange({ ...shared, repo: row.repo }, { session, text: proposal });
  } catch (error) {
    const reason = reasonOf(error);
    // The human got to the session first, by a message or by the card: that one decides.
    if (humanWrote(cache, session) || reason.endsWith(REFUSALS.agentWorking)) {
      return;
    }
    cache.jobs.setRefusal(run.id, { text: reason.replace(/^refused: /u, ""), turn });
    sessions.announce(row.repo, session);
    return;
  }
  cache.appendItem(turn, { kind: "system", text: jobChangeLine(run.job, proposalTitle(proposal)) });
  sessions.announce(row.repo, session, turn);
}

/** The acceptance's stop, which also tells when the offers it has so far are done. */
export type Accepting = (() => void) & { settled(): Promise<void> };

/**
 * Starts accepting the offers of the jobs' runs: each turn that ends done, in a session of a run
 * without a change, is read for a change offer. Acceptances go one after another, as each one
 * writes the repository's main checkout. Gives its stop, which also has `settled`.
 */
export function acceptOffers(shared: Omit<RepoContext, "repo">): Accepting {
  let tail: Promise<unknown> = Promise.resolve();
  let stopped = false;
  const stop = onSessionChange(shared.sessions, (change) => {
    if (
      "agent" in change ||
      change.state !== "done" ||
      change.dismissed ||
      change.turn === undefined
    ) {
      return;
    }
    const { session, turn } = change;
    if (change.folder !== null) {
      return;
    }
    tail = tail
      .then(() => (stopped ? undefined : accept(shared, session, turn)))
      .catch((error: unknown) =>
        process.stderr.write(`uraeda: a job's offer was not accepted: ${reasonOf(error)}\n`),
      );
  });
  return Object.assign(
    () => {
      stopped = true;
      stop();
    },
    { settled: async () => void (await tail) },
  );
}
