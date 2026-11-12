// Every session of the repository, each a card: its title, its state in words with its cause,
// who runs it and on which account, when it started and when it last spoke. What needs the human
// comes first, then the latest, as the server orders them. `/` searches their titles, folders,
// and messages, and Enter there opens the match under the cursor; Enter or a press opens one,
// beside the list when there is room.
import { computed, View } from "nsh";
import { navigate, record, serverTime } from "../../store";
import type { SessionRow } from "../../store/protocol";
import { Banner, Button, Spinner } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { type PaneRef, usePane } from "../../ui/layout";
import { Card, createCursor, Empty, VirtualList } from "../../ui/lists";
import { TextField, type TextFieldRef } from "../../ui/text";
import { runTime } from "./panels/words";
import { rowState, runsOnWords, statusTone } from "./words";
import { ticking } from "../../ui/clock";

const open = (id: string) => navigate({ id, page: "session-id" });

export function SessionsPane(props: {
  /** The conversation of a session, opened beside the list: `shift+Enter`. */
  beside?: (id: string) => PaneRef;
  repo: string;
  session: string;
}) {
  const pane = usePane();
  const query = pane.remember("query", "");
  const kept = pane.remember<string | null>("at", props.session === "" ? null : props.session);
  // Held while the words searched stay the same: a new search reads its own record.
  const read = computed(() =>
    query().trim() === ""
      ? record("SessionList", { repo: props.repo })
      : record("SessionSearch", { query: query().trim(), repo: props.repo }),
  );
  const rows = () => read()()?.rows ?? [];
  const objects = new Map<string, { id: string }>();
  const ids = () =>
    rows().map((row) => {
      let object = objects.get(row.id);
      if (object === undefined) {
        object = { id: row.id };
        objects.set(row.id, object);
      }
      return object;
    });
  const byId = computed(() => new Map(rows().map((row) => [row.id, row])));
  const cursor = createCursor(ids, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const agent = record("Agent", { repo: props.repo });
  const nameOf = (id: string) => agent()?.runtimes.find((one) => one.id === id)?.name;
  let field: TextFieldRef | undefined;
  registerKey([
    {
      hint: "/",
      hintLabel: "search",
      icon: "search",
      keys: "/",
      label: "Search the sessions",
      run: () => field?.focus(),
    },
  ]);
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <TextField
            label="Search the sessions"
            lines="one"
            onChange={(value) => query.set(value)}
            // Enter opens the match under the cursor, else the first, as a picker's filter does.
            onEnter={() => {
              const at = cursor.at();
              const id = rows().some((row) => row.id === at) ? at : rows()[0]?.id;
              if (id !== undefined) open(id);
            }}
            placeholder="Search sessions"
            ref={(made) => (field = made)}
            value={query()}
          />
        </View>
        <Button
          icon="plus"
          label="New chat"
          onPress={() => navigate({ kind: "session", page: "new" })}
        />
      </View>
      <If
        when={read().error()}
        else={
          <If when={read()() !== undefined} else={<Spinner label="Reading the sessions" />}>
            <VirtualList
              beside={props.beside}
              cursor={cursor}
              empty={
                <Empty
                  icon="message-square"
                  title={query().trim() === "" ? "No session yet" : "No session holds that"}
                  words={
                    query().trim() === ""
                      ? "A session starts with a chat's first message, or a feature's first run."
                      : "No title, folder, or message of a session holds those words, whatever their case."
                  }
                />
              }
              framed={false}
              onOpen={open}
              row={(id) => (
                <If when={byId().get(id())}>
                  {(row) => (
                    <SessionCard
                      name={nameOf(row().agent)}
                      onPress={() => {
                        cursor.set(row().id);
                        open(row().id);
                      }}
                      repo={props.repo}
                      row={row()}
                      current={row().id === props.session}
                      selected={cursor.holds(row().id)}
                    />
                  )}
                </If>
              )}
              rowHeight={96}
              testID="sessions"
            />
          </If>
        }
      >
        {(error) => (
          <Banner title="The sessions could not be read" tone="danger">
            {error().message}
          </Banner>
        )}
      </If>
    </View>
  );
}

/** When it started, and when it last spoke, unless it still speaks or it was the same minute. */
function timeOf(row: SessionRow, working: boolean) {
  const started = serverTime(row.startedAt);
  const spoke = serverTime(row.updatedAt);
  return working || spoke === started ? { started } : { ended: spoke, started };
}

/** A session's card: who runs it is read from the session, the account with it. */
function SessionCard(props: {
  current: boolean;
  name: string | undefined;
  onPress: () => void;
  repo: string;
  row: SessionRow;
  selected: boolean;
}) {
  const session = () => record("Session", { id: props.row.id, repo: props.repo })();
  const working = () => props.row.status === "working";
  const now = ticking(30_000);
  const turn = () => {
    const id = session()?.turns.at(-1);
    return id === undefined ? undefined : record("Turn", { id, repo: props.repo })();
  };
  return (
    <View style={{ paddingBottom: 6, paddingHorizontal: 12 }}>
      <Card
        facts={props.row.folder === null ? [] : [{ icon: "git-branch", label: props.row.folder }]}
        icon={props.row.folder === null ? "message-square" : "square-terminal"}
        current={props.current}
        onPress={props.onPress}
        selected={props.selected}
        state={{
          label: props.row.archived
            ? "Archived"
            : rowState(props.row, session()?.statusReason ?? null),
          running: working(),
          tone: props.row.archived ? "quiet" : statusTone(props.row.status),
        }}
        testID={`session-${props.row.id}`}
        time={
          // At work, its run's time, "14:02 · 12 min", as Home says it: not the session's start.
          (working() ? runTime(turn(), now) : undefined) ?? timeOf(props.row, working())
        }
        title={props.row.title}
        who={(() => {
          const shown = session();
          return shown ? runsOnWords(shown, props.name) : (props.name ?? props.row.agent);
        })()}
      />
    </View>
  );
}
