// The session's pane: its head, its conversation, and its composer, one pane, as the composer
// belongs to the conversation. The conversation opens at its newest message and follows it while
// the agent writes, until the reader scrolls away; "Jump to the latest" then shows, and `G` or the
// button follow again (rule 9: never lost in a long session). Its rows are read by pages
// (`pages.ts`); each message has its own signal, and a reply grows by blocks (`Rows.tsx`).
import { effect, signal, untracked, View } from "nsh";
import { call, navigate, positions, record, redirect, route, StoreError } from "../../store";
import type { Session } from "../../store/protocol";
import { Button, Spinner } from "../../ui/controls";
import { keysWorkHere, registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { createCursor, Empty, VirtualList, type VirtualListRef } from "../../ui/lists";
import { say } from "../../ui/announce";
import { droppedImages } from "../images";
import { attach, draftKey, putBack, SessionComposer } from "./Composer";
import { SessionBanners, SessionHead } from "./Head";
import { OfferCard } from "./Offer";
import { focusProposal, openedOffer, openOffer } from "./offers";
import { type Feed, transcriptFeed } from "./pages";
import { AllowQuestion, answerable, askAllow } from "./Permission";
import { type SessionArgs, sessionIdOf } from "./place";
import { type RowHands, TranscriptRow } from "./Rows";
import { statusNews } from "./words";

/**
 * The pane's view: the session its arguments name, or why there is none. `beside`, opened beside
 * another page: a feature's first message leaves that page where it is, and the pane follows the
 * feature to its new session.
 */
export function TranscriptPane(props: { args: SessionArgs; beside?: boolean }) {
  const id = sessionIdOf(props.args);
  return (
    <If when={id() !== undefined} else={<Spinner label="Reading the feature" />}>
      <If when={id()} else={<Unstarted args={props.args} beside={props.beside === true} />}>
        {(shown) => (
          // Made again for another session: its rows, its cursor, and its draft are its own.
          <Each of={[shown()]}>{(one) => <ById args={props.args} id={one()} />}</Each>
        )}
      </If>
    </If>
  );
}

/** A feature's session before its first message: what the message does, and the composer. */
function Unstarted(props: { args: SessionArgs; beside: boolean }) {
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
        onSent={(session) => {
          if (!props.beside) redirect({ id: session, page: "session-id" });
        }}
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
  // Where the conversation was read, kept in the visit: a move to the other stack, a zoom, or its
  // tab shown again opens it there, or at its end, following a reply that streams, as it was left.
  const followed = pane.remember("following", true);
  const where = positions();
  const place = `${pane.key}:transcript`;
  const following = signal(untracked(followed));
  let list: VirtualListRef | undefined;

  // An address naming a turn, `#turn-<id>`, as an old run's link does: the page's conversation
  // opens at that turn, once per visit, and stops following the end.
  const turnShown = pane.remember("turn", "");
  effect(() => {
    const hash = route().hash ?? "";
    if (!hash.startsWith("turn-") || !pane.key.startsWith("session-transcript")) return;
    if (untracked(turnShown) === hash) return;
    const turn = hash.slice("turn-".length);
    const row = feed
      .rows()
      .find(
        (one) => one.id === turn || one.id.startsWith(`${turn}/`) || one.id.startsWith(`${turn}#`),
      );
    if (row === undefined) return;
    untracked(() => {
      turnShown.set(hash);
      followed.set(false);
      following.set(false);
      cursor.set(row.id, { reveal: true });
    });
  });

  // A screen reader hears the agent start and end, never what the page found as it opened.
  let heard = untracked(props.session).status;
  effect(() => {
    const now = props.session().status;
    if (now === heard) return;
    const words = statusNews(heard, now);
    heard = now;
    if (words !== undefined) say(words);
  });

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
      ? {
          item,
          of: { denial: item.id, repo, row: at!, session: props.session().id, turn: entry.turn },
        }
      : undefined;
  };
  /** Asks about the blocked action under the cursor: one, or with `all` the latest turn's. */
  const askAt = (all: boolean) => {
    const at = denialAt();
    if (at !== undefined) askAllow(at.of, at.item, all ? props.session().allowable : null);
  };
  registerKey([
    {
      // Hinted on its row only, where its guard holds, as the row exists for it.
      hint: "a",
      hintLabel: "allow…",
      icon: "shield",
      keys: "a",
      label: "Allow the blocked action, and retry…",
      run: () => askAt(false),
      when: () => denialAt() !== undefined,
    },
    {
      icon: "shield",
      keys: "A",
      label: "Allow every blocked action of the latest turn…",
      run: () => askAt(true),
      when: () => denialAt() !== undefined && props.session().allowable >= 2,
    },
    {
      icon: "git-branch",
      keys: "c",
      label: "Make the chat a change…",
      // The agent's offer on screen first: one card, its proposal written, never a second empty.
      run: () => {
        if (!focusProposal(props.session().id)) openOffer(props.session().id, "change");
      },
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
      <AllowQuestion session={props.session().id} />
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
          // A transcript always follows its end once the reader is there: opened at a kept place,
          // it opens there, and "Jump to the latest" follows from then on.
          follow
          framed={false}
          offset={untracked(followed) ? undefined : where.at(place)}
          onFollowing={(now) => {
            following.set(now);
            if (untracked(followed) !== now) followed.set(now);
          }}
          onOffset={(offset) => where.keep(place, offset)}
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
