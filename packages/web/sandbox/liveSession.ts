// A session as a live run left it, seeded in the sandbox's cache: Uraeda's own leader key feature,
// its discovery, its spec, and two revisions, from `fixtures/sessions/leader-key-spec.json`, with
// its thoughts, sub-agents, and tool calls as the agent made them. It is written through the
// cache's own writers, then given its times back, moved to end two hours before the seed.
import { readFileSync } from "node:fs";
import type { Item, Trigger, TurnKind, TurnState } from "uraeda-server/runner/events";
import type { Sessions } from "uraeda-server/testing";
import { fixture } from "uraeda-binding/test-utils";

/** The sessions' cache. */
type SessionCache = Sessions["cache"];

/** A turn of the fixture: its row, its tokens, and its items with the times they came at. */
type LiveTurn = {
  allowed: string | null;
  endedAt: string | null;
  items: Array<{ at: string; item: Item }>;
  kind: TurnKind;
  reason: string | null;
  startedAt: string | null;
  state: TurnState;
  step: string | null;
  tokens: { cacheRead: number; cacheWrite: number; input: number; output: number };
  trigger: Trigger | null;
};

/** How long before the seed the session's last turn ends. */
const ENDED_AGO_MS = 2 * 60 * 60 * 1000;

/** The fixture's turns. */
function liveTurns(): Array<LiveTurn> {
  return (
    JSON.parse(readFileSync(fixture("sessions/leader-key-spec.json"), "utf8")) as {
      turns: Array<LiveTurn>;
    }
  ).turns;
}

/**
 * Writes the live session in `cache`, on the feature `folder` of the repository `repo`, its times
 * the live ones, moved so that its last turn ended two hours ago.
 */
export function seedLiveSession(cache: SessionCache, repo: string, folder: string) {
  const turns = liveTurns();
  const last = Date.parse(turns.at(-1)?.endedAt ?? new Date().toISOString());
  const shift = Date.now() - ENDED_AGO_MS - last;
  const moved = (at: string | null) =>
    at === null ? null : new Date(Date.parse(at) + shift).toISOString();

  const session = cache.createSession({
    agent: "claude",
    folder,
    nativeId: "sandbox-live-leader-key",
    repo,
    title: null,
  });
  for (const turn of turns) {
    const id = cache.addTurn({
      allowed: turn.allowed,
      kind: turn.kind,
      sessionId: session.id,
      state: "running",
      step: turn.step,
      trigger: turn.trigger,
    });
    const times: Array<[number, string | null]> = turn.items.map(({ at, item }) => [
      cache.appendItem(
        id,
        item.kind === "message" && item.at ? { ...item, at: moved(item.at)! } : item,
      ),
      moved(at),
    ]);
    cache.addTurnTokens(id, turn.tokens);
    cache.endTurn(id, { ...(turn.reason ? { reason: turn.reason } : {}), state: turn.state });
    // The live times, which the writers set to now.
    const items = cache.db.prepare("UPDATE items SET at = ? WHERE turn_id = ? AND seq = ?");
    for (const [seq, at] of times) {
      items.run(at, id, seq);
    }
    cache.db
      .prepare("UPDATE turns SET started_at = ?, ended_at = ? WHERE id = ?")
      .run(moved(turn.startedAt), moved(turn.endedAt), id);
  }
  const first = moved(turns[0]?.startedAt ?? null);
  const end = moved(turns.at(-1)?.endedAt ?? null);
  cache.db
    .prepare("UPDATE sessions SET created_at = ?, updated_at = ?, seen_at = ? WHERE id = ?")
    .run(first, end, end, session.id);
}
