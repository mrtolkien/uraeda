// What a screen reader hears of a session: a turn starting and ending, and the plan's current task
// moving, never the words the agent streams nor what the page found when it opened.
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useFeatureFollowed, useSessionFollowed, useTurnFollowed } from "./data.ts";
import { stepLabel } from "./labels.ts";
import { currentEntry, updateEntry } from "./routes.tsx";

/** A turn as the announcer compares it. */
type Seen = { id: string; kind: string; reason: string | null; state: string; step: string | null };

/** The states a turn ends in, until the agent goes on by itself. */
const ENDED = new Set(["done", "failed", "stopped"]);

/** How many announcements the region keeps: one draw can make more than one. */
const KEPT = 3;

/** What a turn moving from `before`, or from nothing, to `now` says, if anything. */
function turnNews(before: Seen | undefined, now: Seen): string | undefined {
  if (before?.state === now.state) {
    return undefined;
  }
  switch (now.state) {
    case "running":
      return now.kind === "workflow"
        ? `The agent started: ${stepLabel(now.step ?? "")}`
        : "The agent started";
    case "done":
      return "The agent finished";
    case "failed":
      return now.reason ? `The agent failed: ${now.reason}` : "The agent failed";
    case "stopped":
      // A message taken back, or dropped, before its turn ran: the agent did not stop.
      return before?.state === "queued" ? undefined : "The agent stopped";
    default:
      return undefined;
  }
}

/** Reports a turn as it is read, and as its live updates change it. */
function TurnReport({ id, onSeen }: { id: string; onSeen: (seen: Seen) => void }) {
  const turn = useTurnFollowed(id);
  const kind = turn?.kind;
  const reason = turn?.reason ?? null;
  const state = turn?.state;
  const step = turn?.step ?? null;
  const report = useEffectEvent(onSeen);
  useEffect(() => {
    if (kind !== undefined && state !== undefined) {
      report({ id, kind, reason, state, step });
    }
  }, [id, kind, reason, state, step]);
  return null;
}

/**
 * Reports each of a session's turns that may still change: every turn not seen ended, and the
 * latest, which the agent may go on with. `found` tells whether the turn was there when the
 * session was first read, unless `created` under the announcer.
 */
function SessionTurns({
  created,
  id,
  onSeen,
}: {
  created: boolean;
  id: string;
  onSeen: (seen: Seen, found: boolean) => void;
}) {
  const turns = useSessionFollowed(id)?.turns ?? [];
  const [found] = useState(() => new Set(created ? [] : turns));
  const [ended, setEnded] = useState<ReadonlySet<string>>(() => new Set());
  const seen = (turn: Seen) => {
    onSeen(turn, found.has(turn.id));
    if (ENDED.has(turn.state) && !ended.has(turn.id)) {
      setEnded((now) => new Set(now).add(turn.id));
    }
  };
  return turns
    .filter((turn, index) => index === turns.length - 1 || !ended.has(turn))
    .map((turn) => <TurnReport id={turn} key={turn} onSeen={seen} />);
}

/** Reports a feature's current task, as "Task 8 of 11: Jump to the latest", or `null`. */
function CurrentTask({
  folder,
  onSeen,
}: {
  folder: string;
  onSeen: (task: string | null) => void;
}) {
  const progress = useFeatureFollowed(folder)?.step.progress ?? null;
  const task = progress && `Task ${progress.position} of ${progress.total}: ${progress.title}`;
  const report = useEffectEvent(onSeen);
  useEffect(() => {
    report(task);
  }, [task]);
  return null;
}

/**
 * Whether the page's session was just created by its first message, on the page it left, so its
 * first turn is news. The history entry says so once, and forgets it: Back and a reload do not.
 */
export function useCreatedHere(): boolean {
  const [created] = useState(() => currentEntry().created === true);
  useEffect(() => {
    if (created) {
      updateEntry({ created: false });
    }
  }, [created]);
  return created;
}

/**
 * A visually hidden status region, "Agent updates", for a session and its feature. It announces
 * what changed after it was drawn, never what it found: each turn starting, "The agent started:
 * Implementation" for a workflow turn, and ending, finished, failed with the reason, or stopped,
 * and the feature's current task moving. A session created under it, from none, or `created` by
 * the page before, starts with no turn.
 */
export function SessionAnnouncer({
  created = false,
  feature,
  session,
}: {
  created?: boolean;
  feature?: string;
  session?: string;
}) {
  const [said, setSaid] = useState<Array<{ key: number; text: string }>>([]);
  const count = useRef(0);
  // Each turn's last state seen, by its ID.
  const turns = useRef(new Map<string, Seen>());
  const task = useRef<{ seen: string | null } | undefined>(undefined);
  const [fresh] = useState(created || session === undefined);
  const say = (text: string) => {
    count.current += 1;
    const key = count.current;
    setSaid((now) => [...now, { key, text }].slice(-KEPT));
  };

  const onTurn = (seen: Seen, found: boolean) => {
    const before = turns.current.get(seen.id);
    turns.current.set(seen.id, seen);
    const news = before === undefined && found ? undefined : turnNews(before, seen);
    if (news) {
      say(news);
    }
  };
  const onTask = (seen: string | null) => {
    const before = task.current;
    task.current = { seen };
    if (before !== undefined && seen !== null && seen !== before.seen) {
      say(seen);
    }
  };

  return (
    <>
      {/* A new node for each announcement, so the same words said again are heard again. */}
      <VisuallyHidden aria-label="Agent updates" as="div" role="status">
        {said.map(({ key, text }) => (
          <p key={key}>{text}</p>
        ))}
      </VisuallyHidden>
      <Suspense fallback={null}>
        {session !== undefined && (
          <SessionTurns created={fresh} id={session} key={session} onSeen={onTurn} />
        )}
        {feature !== undefined && <CurrentTask folder={feature} onSeen={onTask} />}
      </Suspense>
    </>
  );
}
