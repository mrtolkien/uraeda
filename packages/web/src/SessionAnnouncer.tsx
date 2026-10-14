// What a screen reader hears of a session: a turn starting and ending, and the plan's current task
// moving, never the words the agent streams nor what the page found when it opened.
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useFeature, useSession, useTurn } from "./data.ts";
import { stepLabel } from "./labels.ts";

/** The latest turn as the announcer compares it, or `null` before a session's first turn. */
type Seen = { id: string; kind: string; reason: string | null; state: string; step: string | null };

/** What changed from `before` to `now` says, if anything. */
function turnNews(before: Seen | null, now: Seen | null): string | undefined {
  if (now === null) {
    return undefined;
  }
  const same = before !== null && before.id === now.id;
  if (same && before.state === now.state) {
    return undefined;
  }
  if (now.state === "running") {
    return now.kind === "workflow"
      ? `The agent started: ${stepLabel(now.step ?? "")}`
      : "The agent started";
  }
  if (now.state === "done") {
    return "The agent finished";
  }
  if (now.state === "failed") {
    return now.reason ? `The agent failed: ${now.reason}` : "The agent failed";
  }
  if (now.state === "stopped") {
    return "The agent stopped";
  }
  return undefined;
}

/** Reports a turn as it is read, and as its live updates change it. */
function TurnReport({ id, onSeen }: { id: string; onSeen: (seen: Seen) => void }) {
  const turn = useTurn(id);
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

/** Reports a session's latest turn, or `null` while it has none. */
function LatestTurn({ id, onSeen }: { id: string; onSeen: (seen: Seen | null) => void }) {
  const session = useSession(id);
  const read = session !== undefined;
  const latest = session?.turns.at(-1);
  const report = useEffectEvent(onSeen);
  useEffect(() => {
    if (read && latest === undefined) {
      report(null);
    }
  }, [read, latest]);
  return latest === undefined ? null : <TurnReport id={latest} onSeen={onSeen} />;
}

/** Reports a feature's current task, as "Task 8 of 11: Jump to the latest", or `null`. */
function CurrentTask({
  folder,
  onSeen,
}: {
  folder: string;
  onSeen: (task: string | null) => void;
}) {
  const progress = useFeature(folder)?.step.progress ?? null;
  const task = progress && `Task ${progress.position} of ${progress.total}: ${progress.title}`;
  const report = useEffectEvent(onSeen);
  useEffect(() => {
    report(task);
  }, [task]);
  return null;
}

/**
 * A visually hidden status region, "Agent updates", for a session and its feature. It announces
 * what changed after it was drawn, never what it found: a turn starting, "The agent started:
 * Implementation" for a workflow turn, its end, finished, failed with the reason, or stopped, and
 * the feature's current task moving. A session created under it, from none, starts with no turn.
 */
export function SessionAnnouncer({ feature, session }: { feature?: string; session?: string }) {
  const [said, setSaid] = useState({ count: 0, text: "" });
  // What the first read found, per session: `undefined` until then. No session yet is no turn.
  const turn = useRef<{ seen: Seen | null; session: string } | undefined>(undefined);
  const task = useRef<{ seen: string | null } | undefined>(undefined);
  const created = useRef(session === undefined);
  const say = (text: string) => setSaid((now) => ({ count: now.count + 1, text }));

  const onTurn = (id: string, seen: Seen | null) => {
    const before = turn.current?.session === id ? turn.current.seen : undefined;
    turn.current = { seen, session: id };
    // A session read for the first time is news only when it was created under the announcer.
    const news =
      before !== undefined || created.current ? turnNews(before ?? null, seen) : undefined;
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
        {said.text && <span key={said.count}>{said.text}</span>}
      </VisuallyHidden>
      <Suspense fallback={null}>
        {session !== undefined && (
          <LatestTurn id={session} onSeen={(seen) => onTurn(session, seen)} />
        )}
        {feature !== undefined && <CurrentTask folder={feature} onSeen={onTask} />}
      </Suspense>
    </>
  );
}
