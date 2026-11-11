// The session's pane: its head, its conversation, and its composer, one pane, as the composer
// belongs to the conversation. The conversation opens at its newest message and follows it while
// the agent writes, until the reader scrolls away; "Jump to the latest" then shows, and `G` or the
// button follow again (rule 9: never lost in a long session). Its rows are read by pages
// (`pages.ts`); each message has its own signal, and a reply grows by blocks (`Rows.tsx`).
import { effect, signal, untracked, View } from "nsh";
import { call, navigate, record, redirect, StoreError } from "../../store";
import type { Session } from "../../store/protocol";
import { Button, Spinner } from "../../ui/controls";
import { keysWorkHere, registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { createCursor, Empty, VirtualList, type VirtualListRef } from "../../ui/lists";
import { droppedImages } from "../images";
import { attach, draftKey, putBack, SessionComposer } from "./Composer";
import { SessionBanners, SessionHead } from "./Head";
import { OfferCard } from "./Offer";
import { openedOffer, openOffer } from "./offers";
import { type Feed, transcriptFeed } from "./pages";
import { allow, answerable } from "./Permission";
import { type SessionArgs, sessionIdOf } from "./place";
import { type RowHands, TranscriptRow } from "./Rows";

/** The pane's view: the session its arguments name, or why there is none. */
export function TranscriptPane(props: { args: SessionArgs }) {
  const id = sessionIdOf(props.args);
  return (
    <If when={id() !== undefined} else={<Spinner label="Reading the feature" />}>
      <If when={id()} else={<Unstarted args={props.args} />}>
        {(shown) => (
          // Made again for another session: its rows, its cursor, and its draft are its own.
          <Each of={[shown()]}>{(one) => <ById args={props.args} id={one()} />}</Each>
        )}
      </If>
    </If>
  );
}

/** A feature's session before its first message: what the message does, and the composer. */
function Unstarted(props: { args: SessionArgs }) {
  const agent = record("Agent", { repo: props.args.repo });
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 12 }}>
        <Empty
          icon="message-square"
          title={props.args.fresh ? "A new session" : "No session yet"}
          words="Your first message starts the agent's session in the feature's worktree, on its next step's agent, model, and effort."
        />
      </View>
      <SessionComposer
        folder={props.args.folder}
        fresh={props.args.fresh}
        onSent={(session) => redirect({ id: session, page: "session-id" })}
        repo={props.args.repo}
        runtime={agent()?.runtimes.find((one) => one.isOn)}
        session={null}
      />
    </View>
  );
}

function ById(props: { args: SessionArgs; id: string }) {
  const session = record("Session", { id: props.id, repo: props.args.repo });
  return (
    <If
      when={session.error()}
      else={
        <If when={session() !== undefined} else={<Spinner label="Reading the session" />}>
          <If
            when={session()}
            else={
              <View style={{ padding: 12 }}>
                <Empty
                  action={{
                    icon: "message-square",
                    label: "Every session",
                    run: () => navigate({ page: "sessions" }),
                  }}
                  icon="message-square"
                  title="No such session"
                  words="This repository keeps no session of that id: it was archived with its feature, or the address was typed by hand."
                />
              </View>
            }
          >
            {(shown) => <Conversation args={props.args} session={shown} />}
          </If>
        </If>
      }
    >
      {(error) => (
        <View style={{ padding: 12 }}>
          <Empty
            icon="circle-alert"
            title="The session could not be read"
            words={error().message}
          />
        </View>
      )}
    </If>
  );
}

function Conversation(props: { args: SessionArgs; session: () => Session }) {
  const repo = props.args.repo;
  const pane = usePane();
  const agent = record("Agent", { repo });
  const runtime = () => agent()?.runtimes.find((one) => one.id === props.session().agent);
  const feature = () => {
    const folder = props.session().folder;
    return folder === null ? undefined : record("Feature", { id: folder, repo })();
  };
  const feed: Feed = transcriptFeed(() => repo, props.session);
  const kept = pane.remember<string | null>("at", null);
  const cursor = createCursor(feed.rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const following = signal(true);
  let list: VirtualListRef | undefined;

  // Shown: the human saw its latest turn, whatever its status says, as "Needs you" at a gate.
  effect(() => {
    const shown = props.session();
    if (shown.unseen) void call("session.seen", { repo, session: shown.id }).catch(() => {});
  });

  const working = () => props.session().status === "working";
  const draft = () => draftKey(repo, props.session().id, props.args.folder);
  const hands: RowHands = {
    allowable: () => props.session().allowable,
    canTakeBack: () => runtime()?.capabilities.takeBack === true,
    folder: () => props.session().folder,
    kind: () => {
      if (props.session().folder === null) return "chat";
      return feature()?.kind === "change" ? "change" : "feature";
    },
    offerTurn: () => (working() ? undefined : props.session().turns.at(-1)),
    repo,
    select: (row) => cursor.set(row),
    selected: (row) => cursor.holds(row),
    lit: keysWorkHere(),
    session: props.session().id,
    takeBack: async (message) => {
      try {
        await call("session.takeBack", {
          message: message.message,
          repo,
          session: props.session().id,
        });
        putBack(untracked(draft), message.text);
        return null;
      } catch (error) {
        return error instanceof StoreError ? error.message : String(error);
      }
    },
    working,
  };

  /** The blocked action under the cursor, when it can be allowed now. */
  const denialAt = () => {
    const at = cursor.at();
    const entry = at === undefined ? undefined : feed.entry(at);
    const item = entry?.kind === "item" ? entry.item() : undefined;
    return item?.kind === "denial" && answerable(item) && !working() && entry !== undefined
      ? { denial: item.id, repo, row: at!, session: props.session().id, turn: entry.turn }
      : undefined;
  };
  registerKey([
    {
      icon: "shield",
      keys: "a",
      label: "Allow the blocked action, and retry",
      run: () => void allow(denialAt()!),
      when: () => denialAt() !== undefined,
    },
    {
      icon: "shield",
      keys: "A",
      label: "Allow every blocked action of the latest turn",
      run: () => void allow(denialAt()!, true),
      when: () => denialAt() !== undefined && props.session().allowable >= 2,
    },
    {
      icon: "git-branch",
      keys: "c",
      label: "Make the chat a change…",
      run: () => openOffer(props.session().id, "change"),
      when: () => props.session().folder === null && props.session().parent === null,
    },
  ]);

  return (
    <View
      onFileDrop={(event) =>
        void droppedImages(event.uris).then((held) => attach(repo, untracked(draft), held))
      }
      style={{ flex: 1 }}
    >
      <SessionHead repo={repo} runtime={runtime()} session={props.session()} />
      <SessionBanners repo={repo} session={props.session()} />
      <View style={{ flex: 1, minHeight: 0 }}>
        <VirtualList
          cursor={cursor}
          empty={
            <View style={{ padding: 12 }}>
              <Empty
                icon="message-square"
                title="Nothing said yet"
                words="The agent's words, its tool calls, and your messages show here as they come."
              />
            </View>
          }
          follow
          framed={false}
          onFollowing={(now) => following.set(now)}
          onShown={feed.shown}
          ref={(made) => (list = made)}
          row={(id) => <TranscriptRow feed={feed} hands={hands} id={id} />}
          rowHeight={30}
          testID="transcript"
        />
        <If when={!following()}>
          <View style={{ bottom: 8, position: "absolute", right: 16 }}>
            <Button
              icon="arrow-down"
              label="Jump to the latest"
              onPress={() => list?.toEnd()}
              testID="jump-to-latest"
            />
          </View>
        </If>
      </View>
      <If when={openedOffer(props.session().id)}>
        {(kind) => (
          <View style={{ paddingHorizontal: 12 }}>
            <OfferCard
              body=""
              cardKey={`opened:${props.session().id}`}
              folder={props.session().folder}
              kind={kind()}
              live
              repo={repo}
              session={props.session().id}
            />
          </View>
        )}
      </If>
      <SessionComposer
        folder={props.args.folder}
        fresh={false}
        readOnly={props.session().parent !== null}
        repo={repo}
        runtime={runtime()}
        session={props.session()}
      />
    </View>
  );
}
