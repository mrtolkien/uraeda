// The feature's sessions, each a card: what it was started for, its state in words with their
// cause, who runs it and on which account, when it started, and its last run. The latest first, as
// the feature keeps them. `Enter` or a press opens one in its own page's panes; "New session"
// opens a new one, which its first message makes.
import { View } from "nsh";
import { navigate, record } from "../../store";
import type { Session } from "../../store/protocol";
import { Button, Spinner } from "../../ui/controls";
import { PaneScroll, usePane } from "../../ui/layout";
import { Card, type CardFact, createCursor, Empty, listKeys } from "../../ui/lists";
import { sessionBeside } from "../session";
import { toneOf } from "./Overview";
import { type FeatureArgs, ticking, WithFeature } from "./read";
import { clock, duration, endedWords, stepWord, waitWords, whoWords } from "./words";
import { plural } from "../../ui/words";

/** The page of a new session of the feature, which its first message makes. */
const newSession = (folder: string) => ({ folder, page: "session" as const, query: { new: "" } });

/** What a session was started for: its own name, else its first run's step, else "Session". */
function titleOf(
  session: Session,
  first: { kind: string; step: string | null } | null | undefined,
) {
  if (session.name !== null) return session.name;
  if (first?.kind === "workflow" && first.step !== null) return stepWord(first.step);
  return "Session";
}

function SessionCard(props: { id: string; repo: string; selected: boolean }) {
  const now = ticking(30_000);
  const session = record("Session", { id: props.id, repo: props.repo });
  const turnOf = (id: string | undefined) =>
    id === undefined ? undefined : record("Turn", { id, repo: props.repo })();
  const facts = (shown: Session): Array<CardFact> => {
    const out: Array<CardFact> = [];
    if (shown.wait !== null) {
      out.push({ icon: "clock", label: waitWords(shown.wait, shown.account, now()), tone: "live" });
    }
    const last = turnOf(shown.turns.at(-1));
    if (last) {
      const ended = endedWords(last);
      const what =
        last.kind === "workflow"
          ? stepWord(last.step ?? "")
          : last.kind === "allow"
            ? "Retry"
            : "Message";
      const ran =
        last.startedAt === null ? undefined : ((last.endedAt ?? now()) - last.startedAt) / 1000;
      const how =
        ran === undefined
          ? last.state
          : last.state === "running"
            ? `running for ${duration(ran)}`
            : last.state === "done"
              ? `done in ${duration(ran)}`
              : `${last.state} after ${duration(ran)}`;
      out.push({ icon: "play", label: `Last run: ${what}, ${how}` });
      if (ended !== undefined && !last.dismissed)
        out.push({ icon: "circle-alert", label: ended, tone: "danger" });
    }
    if (shown.subSessions.length > 0) {
      const working = shown.subSessions.filter((sub) => sub.state === "working").length;
      out.push({
        icon: "users",
        label: `${plural(shown.subSessions.length, "sub-session")}${working > 0 ? `, ${working} at work` : ""}`,
      });
    }
    if (shown.edited.length > 0)
      out.push({ icon: "file-text", label: `${plural(shown.edited.length, "file")} edited` });
    return out;
  };
  return (
    <If when={session()} else={<Spinner label="Reading the session" />}>
      {(shown) => (
        <Card
          facts={facts(shown())}
          icon="square-terminal"
          onPress={() => navigate({ id: props.id, page: "session-id" })}
          selected={props.selected}
          state={{
            label: shown().statusLabel,
            running: shown().status === "working",
            tone: toneOf(shown().status),
          }}
          testID={`feature-session-${props.id}`}
          time={{ started: clock(shown().startedAt, now()) }}
          title={titleOf(shown(), turnOf(shown().turns[0]))}
          who={whoWords(shown())}
        />
      )}
    </If>
  );
}

function Cards(props: { args: FeatureArgs; sessions: () => ReadonlyArray<string> }) {
  const kept = usePane().remember<string | null>("at", null);
  const rows = () => props.sessions().map((id) => ({ id }));
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  listKeys(cursor, {
    // Its conversation beside the feature's page, as a tab: `shift+Enter`.
    beside: (id) => sessionBeside({ folder: "", fresh: false, repo: props.args.repo, session: id }),
    onOpen: (id) => navigate({ id, page: "session-id" }),
    openLabel: "open the session",
  });
  return (
    <View style={{ gap: 8 }}>
      <If
        when={props.sessions().length > 0}
        else={
          <Empty
            action={{
              icon: "plus",
              keys: "S",
              label: "New session",
              run: () => navigate(newSession(props.args.folder)),
            }}
            icon="square-terminal"
            title="No session yet"
            words="An agent's session starts with its first message: the next step's continue, or one you write."
          />
        }
      >
        <Each key={(row: { id: string }) => row.id} of={rows()}>
          {(row) => (
            <SessionCard id={row().id} repo={props.args.repo} selected={cursor.holds(row().id)} />
          )}
        </Each>
        <View style={{ alignItems: "flex-start", paddingTop: 4 }}>
          <Button
            icon="plus"
            keys="S"
            label="New session"
            onPress={() => navigate(newSession(props.args.folder))}
          />
        </View>
      </If>
    </View>
  );
}

/** The pane "Sessions". */
export function Sessions(props: { args: FeatureArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFeature args={props.args}>
        {(feature) => <Cards args={props.args} sessions={() => feature().sessions} />}
      </WithFeature>
    </PaneScroll>
  );
}
