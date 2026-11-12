// The session's Sub-agents: each a card, in the order they started, the list following its end as
// the Activity does. A workflow session's are the sub-sessions Uraeda runs, its implementers and
// reviewers: each card says what it works on, as a person would ("Task 6", "Review of wave 2",
// never the commits a reviewer read), its state with its cause, who runs it on which account,
// when it started and ended, and its tokens; `Enter` or a press opens its page. A chat's are its
// agent's own, while its turn runs: what each does, its calls, and since when; one that ended
// stays, "Done", for as long as the pane is in the visit.
import { effect, untracked, View } from "nsh";
import { navigate, record, serverTime } from "../../../store";
import type { Session, SubSession, Subagent } from "../../../store/protocol";
import { usePane } from "../../../ui/layout";
import { Card, type CardFact, createCursor, Empty, VirtualList } from "../../../ui/lists";
import { tokens } from "../../../ui/tokens";
import { ticking } from "../../../ui/clock";
import type { SessionArgs } from "../place";
import { runsOnWords, turnWords } from "../words";
import { Padded, WithSession } from "./read";
import { inStartOrder, ranFor, roleWord, subRunsOn, subState, tokenWords, topLevel } from "./words";
import { plural } from "../../../ui/words";

/** An agent's own sub-agent, as the pane keeps it: ended once its turn no longer lists it. */
type Own = {
  id: string;
  description: string;
  startedAt: number;
  endedAt: number | null;
  calls: number;
  /** What its last call acted on. */
  doing: string | null;
};

const NONE = (
  <Padded>
    <Empty
      icon="users"
      title="No sub-agent yet"
      words="A workflow run's implementers and reviewers, and the sub-agents a chat's agent starts, show here as they start, in that order."
    />
  </Padded>
);

export function SubagentsPane(props: { args: SessionArgs }) {
  return (
    <WithSession args={props.args} none={NONE}>
      {(session) => <Agents repo={props.args.repo} session={session} />}
    </WithSession>
  );
}

function Agents(props: { repo: string; session: () => Session }) {
  const pane = usePane();
  const now = ticking(1000);
  const kept = pane.remember<string | null>("at", null);
  // Kept as its JSON text: the visit keeps plain values.
  const goneText = pane.remember<string>("gone", "[]");
  const gone = (): Array<Own> => JSON.parse(goneText()) as Array<Own>;
  const latest = () => {
    const turn = props.session().turns.at(-1);
    return turn === undefined ? undefined : record("Turn", { id: turn, repo: props.repo })();
  };
  const running = (): ReadonlyArray<Subagent> => topLevel(latest()?.subagents ?? []);
  /** The agent's own, those that ended first, then those at work, each in its start's order. */
  const owns = (): Array<Own> => {
    const ended = gone();
    const known = new Set(ended.map((one) => one.id));
    const at = running()
      .filter((one) => !known.has(one.id))
      .map((one): Own => ({
        calls: one.calls,
        description: one.description,
        doing: one.latest?.target ?? null,
        endedAt: null,
        id: one.id,
        startedAt: one.startedAt,
      }));
    return [...ended, ...at].toSorted((a, b) => a.startedAt - b.startedAt);
  };
  // A sub-agent gone from its turn's list ended then: kept, with that end, in the visit.
  effect(() => {
    const listed = new Set(running().map((one) => one.id));
    const had = untracked(gone);
    const shown = untracked(owns);
    const ended = shown.filter((one) => one.endedAt === null && !listed.has(one.id));
    if (ended.length === 0) return;
    const at = Date.now();
    const closed = ended.map((one): Own => Object.assign({}, one, { endedAt: at }));
    goneText.set(JSON.stringify([...had, ...closed]));
  });
  const subs = () => inStartOrder(props.session().subSessions);
  const rows = () =>
    subs().length > 0
      ? subs().map((sub) => ({ id: `sub:${sub.id}` }))
      : owns().map((one) => ({ id: `own:${one.id}` }));
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const subById = () => new Map(subs().map((sub) => [`sub:${sub.id}`, sub]));
  const ownById = () => new Map(owns().map((one) => [`own:${one.id}`, one]));
  const open = (row: string) => {
    const sub = subById().get(row);
    if (sub !== undefined) navigate({ id: sub.id, page: "session-id", repo: props.repo });
  };
  return (
    <VirtualList
      cursor={cursor}
      empty={NONE}
      follow
      framed={false}
      onOpen={open}
      openLabel="open its session"
      row={(id) => (
        <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <If
            when={subById().get(id())}
            else={
              <If when={ownById().get(id())}>
                {(own) => <OwnCard now={now} own={own()} selected={cursor.holds(id())} />}
              </If>
            }
          >
            {(sub) => (
              <SubCard
                now={now}
                onPress={() => {
                  cursor.set(id());
                  open(id());
                }}
                repo={props.repo}
                selected={cursor.holds(id())}
                sub={sub()}
              />
            )}
          </If>
        </View>
      )}
      rowHeight={110}
      testID="subagents"
    />
  );
}

/** A sub-session's title, as a person says it: its task, or what a review reads. */
function subTitle(sub: SubSession): string {
  if (sub.role === "implementer") return sub.about;
  return `Review of ${sub.about === "branch" ? "the branch" : sub.about}`;
}

function SubCard(props: {
  now: () => number;
  onPress: () => void;
  repo: string;
  selected: boolean;
  sub: SubSession;
}) {
  const own = record("Session", { id: props.sub.id, repo: props.repo });
  const agents = record("Agent", { repo: props.repo });
  const lastTurn = () => {
    const turn = own()?.turns.at(-1);
    return turn === undefined ? undefined : record("Turn", { id: turn, repo: props.repo })();
  };
  const who = () => {
    const session = own();
    const name = agents()?.runtimes.find((one) => one.id === props.sub.agent)?.name;
    const runs = session
      ? runsOnWords(session, name)
      : `${name ?? props.sub.agent} · ${subRunsOn(props.sub)}`;
    return `${roleWord(props.sub.role)} · ${runs}`;
  };
  const facts = (): Array<CardFact> => {
    const out: Array<CardFact> = [];
    const turn = lastTurn();
    const why = turn ? turnWords(turn) : undefined;
    if (why !== undefined && props.sub.state !== "working") {
      out.push({ icon: "circle-alert", label: why, tone: "danger" });
    }
    if (props.sub.usage !== null) {
      out.push({
        icon: "arrow-right-left",
        label: `${tokenWords(props.sub.usage.input)} in · ${tokenWords(props.sub.usage.output)} out`,
      });
    }
    return out;
  };
  return (
    <Card
      facts={facts()}
      hue={tokens.role.subAgent}
      icon={props.sub.role === "implementer" ? "users" : "scan-eye"}
      onPress={props.onPress}
      selected={props.selected}
      state={subState(props.sub.state)}
      testID="subagent-card"
      time={{
        ended: props.sub.endedAt === null ? undefined : serverTime(props.sub.endedAt),
        started: serverTime(props.sub.startedAt),
        took: ranFor(props.sub.startedAt, props.sub.endedAt, props.now),
      }}
      title={subTitle(props.sub)}
      who={who()}
    />
  );
}

function OwnCard(props: { now: () => number; own: Own; selected: boolean }) {
  const working = () => props.own.endedAt === null;
  return (
    <Card
      hue={tokens.role.subAgent}
      icon="bot"
      selected={props.selected}
      state={
        working()
          ? { label: "Working", running: true, tone: "live" }
          : { label: "Done", tone: "done" }
      }
      time={{
        ended: props.own.endedAt === null ? undefined : serverTime(props.own.endedAt),
        started: serverTime(props.own.startedAt),
        took: ranFor(props.own.startedAt, props.own.endedAt, props.now),
      }}
      facts={[
        { icon: "wrench", label: plural(props.own.calls, "call") },
        ...(props.own.doing === null || !working()
          ? []
          : [{ icon: "play" as const, label: `Now: ${props.own.doing}` }]),
      ]}
      title={props.own.description}
      who="The agent's own sub-agent"
    />
  );
}
