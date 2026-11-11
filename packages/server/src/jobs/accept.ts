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
import { endingOffer, proposalTitle } from "../runner/offers.ts";
import { REFUSALS } from "../runner/session-state.ts";
import { Busy } from "./busy.ts";
import { works } from "./guards.ts";
import { impossible } from "./problem.ts";

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
 * The proposal of the change the text offers: the text ends on a `change` offer, with nothing after
 * its closing fence. A `feature` offer, a block left open, or any word after the offer offers no
 * change: the offer must be the run's last word.
 */
function proposalOf(text: string): string | undefined {
  const offer = endingOffer(text);
  return offer?.kind === "change" ? offer.body : undefined;
}

/** Whether the human wrote in the session: any message of the origin `human`, of any turn. */
function humanWrote(cache: SessionCache, session: string): boolean {
  return cache
    .turns(session)
    .some((turn) => cache.itemsOf(turn.id, "message").some((item) => item.origin === "human"));
}

/**
 * Starts the change the run's turn offered, when the run, the job, and the session allow it. The
 * checks of what the human may have done meanwhile, the job's place included (R51), come after the
 * only wait, the read of the jobs, so nothing but `toChange`'s own hold separates them from the start.
 */
async function accept(shared: Omit<RepoContext, "repo">, session: string, turn: number) {
  const { binding, extensions, hosts, sessions, settings } = shared;
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
  // Where the job runs, by the names the scheduler uses: the repository in Uraeda's list for the
  // session's path (R51).
  const host = row && hosts.byPath(row.repo);
  if (
    job === undefined ||
    // The rule "Run now" uses (R23): a schedule not understood after the run started, or when it was
    // run by hand, does not take back the human's yes; any other problem does.
    impossible(jobs, job) !== undefined ||
    job.reportOnly ||
    // The job still runs here, as the scheduler reads it: a human who turned the Jobs extension off
    // for the repository, took it out of the job, or removed it from the list took their yes back.
    host === undefined ||
    host.missing ||
    !job.repositories.includes(host.name) ||
    !(extensions?.isOn("jobs", host.name) ?? true) ||
    // The run's row is the session's own repository's, and the turn is the session's last.
    row === undefined ||
    row.repo !== run.repository ||
    row.folder !== null ||
    row.archivedAt !== null ||
    ended?.id !== turn ||
    ended.state !== "done" ||
    ended.dismissedAt !== null ||
    // A run's offer is accepted at most once: after a refusal, dismissed or not, the card is the way.
    run.refusedTurn !== null ||
    humanWrote(cache, session) ||
    // The scheduler's own reading (R44): a turn that left a wakeup pending is not the run's last word.
    works({ ...shared, repo: row.repo }, session)
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
 * writes the repository's main checkout. The run's job is held in `busy`, the scheduler's too, from
 * the turn's end until its acceptance ends, whatever it decides: the change being opened is the run
 * still working (R18). Gives its stop, which also has `settled`.
 */
export function acceptOffers(shared: Omit<RepoContext, "repo">, busy = new Busy()): Accepting {
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
    const run = shared.sessions.cache.jobs.ofSession(session);
    if (run === undefined) {
      return;
    }
    const leave = busy.enter(run.job, run.repository);
    tail = tail
      .then(() => (stopped ? undefined : accept(shared, session, turn)))
      .catch((error: unknown) =>
        process.stderr.write(`uraeda: a job's offer was not accepted: ${reasonOf(error)}\n`),
      )
      .finally(leave);
  });
  return Object.assign(
    () => {
      stopped = true;
      stop();
    },
    { settled: async () => void (await tail) },
  );
}
