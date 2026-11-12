// The session's Activity: what its agent does, a line per call as it happens, what it reads,
// writes, and runs, each with its target and its state, under the head of the run it is in. A
// sub-agent's own calls sit under the call that started it. A call of `run_agent` says on a second
// line the implementer it started, its state, what it runs on, and for how long, and `Enter` opens
// its page. The list follows its end while the agent works, until the reader scrolls away.
//
// A session of an hour holds thousands of calls: the rows are read by pages, as the transcript's
// (`../pages.ts`), each row one structure that binds to its row (`specs/ui/components.md`), and
// each item its own signal, so a call that ends redraws its own row alone. At its foot, for a
// feature's session, the plan's progress.
import { computed, View } from "nsh";
import { navigate, record } from "../../../store";
import type { Session, SubSession } from "../../../store/protocol";
import { Icon, Text } from "../../../ui/controls";
import { usePane } from "../../../ui/layout";
import { createCursor, Empty, VirtualList } from "../../../ui/lists";
import { tokens } from "../../../ui/tokens";
import { ticking } from "../../../ui/clock";
import { type Feed, transcriptFeed } from "../pages";
import type { SessionArgs } from "../place";
import { PlanProgress } from "./Plan";
import { Padded, WithSession } from "./read";
import { type ActivityLine, activityLine, isActivity, runHead, subOf } from "./words";

export function ActivityPane(props: { args: SessionArgs }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, minHeight: 0 }}>
        <WithSession
          args={props.args}
          none={
            <Padded>
              <Empty
                icon="activity"
                title="No call yet"
                words="The session starts with its first message: what its agent reads, writes, and runs shows here as it happens."
              />
            </Padded>
          }
        >
          {(session) => <Calls repo={props.args.repo} session={session} />}
        </WithSession>
      </View>
      <PlanProgress args={props.args} />
    </View>
  );
}

/** What a row draws: its icon, its words, its state, and the sub-session line under it. */
type Drawn = ActivityLine & { head: boolean };

const READING: Drawn = {
  code: false,
  head: false,
  hue: "inkFaint",
  icon: "history",
  ink: "faint",
  meta: "",
  nested: false,
  opens: false,
  words: "Reading this part of the run…",
};

function Calls(props: { repo: string; session: () => Session }) {
  const pane = usePane();
  const now = ticking(1000);
  const feed: Feed = transcriptFeed(() => props.repo, props.session, {
    heads: true,
    keep: isActivity,
  });
  const kept = pane.remember<string | null>("at", null);
  const cursor = createCursor(feed.rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  // Their own signals: a change of the session's status leaves every row as it is drawn.
  const subs = computed((): ReadonlyArray<SubSession> => props.session().subSessions);
  const turns = computed(() => props.session().turns);

  /** The head of the run `turn`, its number its place in the session. */
  const head = (turn: string): Drawn => {
    const read = record("Turn", { id: turn, repo: props.repo })();
    return {
      ...runHead(read, turns().indexOf(turn) + 1, now),
      code: false,
      head: true,
      hue: "context",
      ink: "ink",
      nested: false,
      opens: false,
    };
  };
  const drawn = (row: string): Drawn | undefined => {
    const entry = feed.entry(row);
    if (entry === undefined) return undefined;
    // A turn's own row is its head, read or not: its calls follow once its pages are read.
    if (entry.kind === "waiting") return row.includes("#") ? READING : head(entry.turn);
    // A reply's blocks are rows of the transcript's only: its texts are never split here.
    if (entry.kind === "block") return undefined;
    const item = entry.item();
    if (item === undefined) return undefined;
    const line = activityLine(item, subOf(item, subs()), now);
    return line === undefined ? undefined : { ...line, head: false };
  };
  const open = (row: string) => {
    const entry = feed.entry(row);
    const item = entry?.kind === "item" ? entry.item() : undefined;
    const sub = item === undefined ? undefined : subOf(item, subs());
    if (sub !== undefined) navigate({ id: sub.id, page: "session-id", repo: props.repo });
  };

  return (
    <VirtualList
      cursor={cursor}
      empty={
        <Padded>
          <Empty
            icon="activity"
            title="No call yet"
            words="Its agent has only talked so far: what it reads, writes, and runs shows here as it happens."
          />
        </Padded>
      }
      follow
      onOpen={open}
      onShown={feed.shown}
      openLabel="open its sub-session"
      row={(id) => <ActivityRow line={drawn(id())} />}
      rowHeight={30}
      testID="activity"
    />
  );
}

/** A row, one structure for every kind: its bindings change with the row, never its views. */
function ActivityRow(props: { line: Drawn | undefined }) {
  const line = () => props.line ?? READING;
  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0, paddingLeft: line().nested ? 20 : 0 }}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
        <Icon colour={tokens.role[line().hue]} name={line().icon} style={{ marginTop: 4 }} />
        <Text
          bold={line().head}
          font={line().code ? "code" : "body"}
          lines={2}
          style={{ flex: 1, minWidth: 0 }}
          tone={line().head ? "ink" : line().ink}
        >
          {line().words}
        </Text>
        <Text size="under" tone={line().meta.startsWith("failed") ? "danger" : "faint"}>
          {line().meta}
        </Text>
      </View>
      <Text
        size="under"
        style={{ display: line().sub === undefined ? "none" : "flex", paddingLeft: 26 }}
        tone="quiet"
      >
        {line().sub ?? ""}
      </Text>
    </View>
  );
}
