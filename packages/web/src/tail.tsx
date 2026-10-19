// The transcript's tail: only the latest messages of a session draw, "Show earlier messages" adds
// more. The walk from the latest turn backward, page by page, decides which pieces of which pages
// draw. The pieces draw in a flat list, keyed by their page, so a message arriving at the end, or a
// page added to the latest turn, leaves the pieces drawn as they are.
import { Button } from "@astryxdesign/core/Button";
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type RefObject,
  startTransition,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { stepLabel } from "./labels.ts";
import { keepPlace, topOf } from "./keepPlace.ts";
import { currentEntry, updateEntry } from "./routes.tsx";
import { useTurn, useTurnLog } from "./sessionData.ts";
import { type Actions, TranscriptItems } from "./TranscriptMessages.tsx";
import { Activity, Ending, ending } from "./TurnLines.tsx";

/** How many messages the tail draws, and how many "Show earlier messages" adds. */
export const TAIL_MESSAGES = 20;

const styles = stylex.create({
  turn: {
    // A page's lines, spaced as the list spaces them, in a box the address's anchor scrolls to.
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
  },
});

/** What the tail draws of one page of a turn: its items from `from` on. */
type Piece = {
  /** The messages it draws. */
  count: number;
  /** Whether messages lie before this piece: it offers "Show earlier messages". */
  earlier: boolean;
  /** Where its items start: the message that completes the count, else 0. */
  from: number;
  page: number;
  /** The `seq` of its first item drawn, which the tail may keep as its start. */
  seq: number | undefined;
  turn: string;
};

/** A press of "Show earlier messages" waiting for its messages to draw, from the pieces it left. */
type Press = { done: () => void; from: string };

/** Where the tail starts, kept while the page is open: the first item it drew. */
type Start = { page: number; seq: number | undefined; turn: string };

/** The pieces' identity: what makes the drawn list change. */
const keyOf = (pieces: ReadonlyArray<Piece>) =>
  pieces.map((piece) => `${piece.turn}:${piece.page}:${piece.from}:${piece.earlier}`).join(" ");

/** The turn the address's `#turn-<id>` names, as its index in `turns`, else infinitely late. */
function anchoredTurn(turns: ReadonlyArray<string>): number {
  const { hash } = window.location;
  const index = hash.startsWith("#turn-") ? turns.indexOf(hash.slice("#turn-".length)) : -1;
  return index < 0 ? Number.POSITIVE_INFINITY : index;
}

type Walking = {
  /** The pieces walked so far, the earliest first. */
  acc: ReadonlyArray<Piece>;
  /** The index of the turn the address names, or infinity. */
  anchor: number;
  index: number;
  /** Keeps the pieces the walk ended up on, for the tail to draw in the same pass. */
  keep: (pieces: ReadonlyArray<Piece>) => void;
  /** The messages still needed, from this page back. */
  need: number;
  /** Called once those pieces are committed. */
  onPieces: (pieces: ReadonlyArray<Piece>) => void;
  /** A page of the turn, or its last. */
  page: number | "last";
  /** Whether this is the session's latest turn's last page, which may still grow. */
  root: boolean;
  /** Where the tail starts: new messages draw after it. */
  start: RefObject<Start | undefined>;
  turns: ReadonlyArray<string>;
};

/** Where the walk goes on from a page, or `undefined` before the session's first. */
function before({ index, turns }: Walking, page: number) {
  if (page > 0) {
    return { index, page: page - 1 };
  }
  return index > 0 ? { index: index - 1, page: "last" as const } : undefined;
}

/** Whether a page's item is a message: one of the human's, or one text of the agent's. */
const isMessage = (item: { kind: string }) => item.kind === "message" || item.kind === "text";

/**
 * Where a page's items start: at the kept start when it is here, else at the message that
 * completes `need` counting from the end, else at the first.
 */
function cut(
  items: ReadonlyArray<{ seq: number }>,
  messages: ReadonlyArray<number>,
  kept: Start | undefined,
  need: number,
) {
  if (kept) {
    return Math.max(
      items.findIndex((item) => item.seq >= (kept.seq ?? 0)),
      0,
    );
  }
  return need > 0 && messages.length >= need ? (messages[messages.length - need] ?? 0) : 0;
}

/**
 * Hands the pieces to the tail, drawing nothing. Its layout effect runs with the commit that shows
 * them, and has the tail draw again if they changed since.
 */
function Settled({
  keep,
  onPieces,
  pieces,
}: Pick<Walking, "keep" | "onPieces"> & { pieces: ReadonlyArray<Piece> }) {
  keep(pieces);
  useLayoutEffect(() => onPieces(pieces));
  return null;
}

/**
 * One step of the walk, for a page `pages` long: it counts the page's messages, and either draws
 * from the message that completes the count or goes on to the page before. The walk goes past the
 * count while the address names an older turn, to that turn's first page.
 */
function WalkPage({ pages, ...walking }: Walking & { pages: number }) {
  const { anchor, index, need, root, turns } = walking;
  const page = walking.page === "last" ? pages - 1 : walking.page;
  const turn = turns[index]!;
  const log = useTurnLog(`${turn}:${page}`, root && page === pages - 1);
  const items = log?.items ?? [];
  const messages = items.flatMap((item, at) => (isMessage(item) ? [at] : []));
  const previous = before(walking, page);
  // The tail keeps its start: a message arriving moves nothing the reader sees.
  const kept = walking.start.current;
  const keptHere = kept?.turn === turn && kept.page === page;
  const goOn =
    previous !== undefined &&
    ((kept ? !keptHere : messages.length < need) ||
      anchor < index ||
      (anchor === index && page > 0));
  const reached = anchor === index && page === 0;
  const from =
    goOn || reached ? 0 : cut(items, messages, keptHere ? kept : undefined, kept ? 0 : need);
  const earlier = !goOn && (previous !== undefined || messages.some((at) => at < from));
  const count = messages.filter((at) => at >= from).length;
  const acc = [{ count, earlier, from, page, seq: items[from]?.seq, turn }, ...walking.acc];
  return goOn ? (
    <Walk
      {...walking}
      acc={acc}
      {...previous}
      need={Math.max(need - messages.length, 0)}
      root={false}
    />
  ) : (
    <Settled keep={walking.keep} onPieces={walking.onPieces} pieces={acc} />
  );
}

/**
 * Walks back from a turn's page: the turn's record says how many pages it has. A turn with no item
 * yet draws nothing and does not stop the walk. It draws nothing itself, and suspends until what it
 * reads is in, so the tail's pieces appear at once.
 */
function Walk(props: Walking) {
  const { index, root, turns } = props;
  const turn = useTurn(turns[index]!, root);
  const pages = turn?.pages ?? 0;
  if (pages > 0) {
    return <WalkPage {...props} pages={pages} />;
  }
  const previous = before(props, 0);
  const piece: Piece = {
    count: 0,
    earlier: false,
    from: 0,
    page: 0,
    seq: undefined,
    turn: turns[index]!,
  };
  if (previous === undefined) {
    return <Settled keep={props.keep} onPieces={props.onPieces} pieces={[piece, ...props.acc]} />;
  }
  return <Walk {...props} acc={[piece, ...props.acc]} {...previous} root={false} />;
}

/**
 * A piece of a turn: its workflow divider with its first page, its items from where the tail
 * starts, and its activity and ending with its last page, in a box the address's anchor scrolls to,
 * with the button above that offers the messages before it. The press keeps the place of the box's
 * first element, which the earlier messages are drawn before. `latest` for the session's latest turn.
 */
function TailPage({
  actions,
  latest,
  onMore,
  piece,
}: {
  actions: Actions;
  latest: boolean;
  onMore: (anchor: Element | null) => void;
  piece: Piece;
}) {
  const box = useRef<HTMLDivElement>(null);
  const turn = useTurn(piece.turn);
  if (!turn) {
    return null;
  }
  const last = turn.pages === 0 || piece.page === turn.pages - 1;
  const ended = turn.state !== "running" && turn.state !== "queued";
  const end = ending(turn.state, turn.reason);
  return (
    <>
      {piece.earlier && (
        <Button
          clickAction={() => onMore(box.current?.firstElementChild ?? box.current)}
          label="Show earlier messages"
          variant="ghost"
        />
      )}
      <div
        id={piece.page === 0 ? `turn-${turn.id}` : undefined}
        ref={box}
        {...stylex.props(styles.turn)}
      >
        {piece.page === 0 && turn.kind === "workflow" && (
          <ChatSystemMessage variant="divider">Run: {stepLabel(turn.step ?? "")}</ChatSystemMessage>
        )}
        {turn.pages > 0 && (
          <PageItems
            actions={actions}
            ended={ended}
            latest={latest && last}
            piece={piece}
            queued={turn.state === "queued"}
          />
        )}
        {last && turn.state === "running" && turn.activity && (
          <Activity label={turn.activity.label} since={turn.activity.since} />
        )}
        {last && end && <Ending state={turn.state} text={end} />}
      </div>
    </>
  );
}

/** The items of a piece's page, from where the tail starts. */
function PageItems({
  actions,
  ended,
  latest,
  piece,
  queued,
}: {
  actions: Actions;
  ended: boolean;
  latest: boolean;
  piece: Piece;
  queued: boolean;
}) {
  const page = useTurnLog(`${piece.turn}:${piece.page}`, latest);
  if (!page) {
    return null;
  }
  // The turn's first message, which started it, is the first of its first page, whatever the tail
  // cuts.
  const first = piece.page === 0 ? page.items.find((item) => item.kind === "message") : undefined;
  return (
    <TranscriptItems
      actions={actions}
      ended={ended}
      firstMessage={first?.kind === "message" ? first.id : undefined}
      items={page.items.slice(piece.from)}
      queued={queued}
      turn={piece.turn}
    />
  );
}

/**
 * The pieces the walk settled on, drawn after it in the same pass: it is a component of its own
 * since the walk is read when it renders, not when the tail does. `version` changes with each
 * redraw the walk asks for.
 */
function Pieces({
  actions,
  drawnKey,
  last,
  onMore,
  sink,
}: {
  actions: Actions;
  drawnKey: RefObject<string>;
  last: string;
  onMore: (anchor: Element | null) => void;
  sink: RefObject<ReadonlyArray<Piece>>;
  version: number;
}) {
  drawnKey.current = keyOf(sink.current);
  return sink.current.map((piece) => (
    <TailPage
      actions={actions}
      key={`${piece.turn}:${piece.page}`}
      latest={piece.turn === last}
      onMore={onMore}
      piece={piece}
    />
  ));
}

/**
 * The start of the tail, kept while the page is open: what arrives draws after the pieces, and
 * moves nothing the reader sees, at the end or above it (R8). `release` lets the walk count again
 * from the end, as a press does.
 */
function useKeptStart(sink: RefObject<ReadonlyArray<Piece>>, version: number) {
  const start = useRef<Start | undefined>(undefined);
  useLayoutEffect(() => {
    start.current = sink.current[0];
  }, [start, sink, version]);
  const release = () => {
    start.current = undefined;
  };
  return { release, start };
}

/**
 * Calls `onSettled` once, with the commit that first draws the pieces: the page's own scrolling ran
 * with the commit that opened it, before the pieces drew in the next, and found a page too short.
 */
function useSettled(sink: RefObject<ReadonlyArray<Piece>>, version: number, onSettled: () => void) {
  const settled = useRef(false);
  useLayoutEffect(() => {
    if (!settled.current && sink.current.length > 0) {
      settled.current = true;
      onSettled();
    }
  }, [sink, version, onSettled]);
}

/**
 * The latest messages of a session's turns, in order, `TAIL_MESSAGES` at first, and more at the
 * button's press, with the reader's place kept. The count is kept in the history entry, so Back
 * and a reload draw as many.
 */
export function Tail({
  actions,
  onSettled,
  turns,
}: {
  actions: Actions;
  /** Called once, when the tail first draws. */
  onSettled: () => void;
  turns: ReadonlyArray<string>;
}) {
  const [shown, setShown] = useState(() => currentEntry().shown ?? TAIL_MESSAGES);
  // What the walk settled on, which draws in the same pass; `version` counts the redraws the walk
  // asks for when it settles on others than those drawn.
  const sink = useRef<ReadonlyArray<Piece>>([]);
  const drawnKey = useRef("");
  const [version, redraw] = useReducer((count: number) => count + 1, 0);
  // A press is done once its count is drawn, so the place is kept after it, not before.
  const presses = useRef<Array<Press>>([]);
  useEffect(() => {
    const waiting = presses.current;
    return () => waiting.splice(0).forEach(({ done }) => done());
  }, []);
  const { release, start } = useKeptStart(sink, version);
  useSettled(sink, version, onSettled);
  if (turns.length === 0) {
    return null;
  }
  const more = (anchor: Element | null) => {
    // As many as drawn now, and 20 more: the start is not kept for the walk to go back from it.
    const next = sink.current.reduce((total, piece) => total + piece.count, 0) + TAIL_MESSAGES;
    release();
    void keepPlace(
      anchor ? topOf(anchor) : () => Number.NaN,
      () =>
        new Promise<void>((done) => {
          presses.current.push({ done, from: drawnKey.current });
          startTransition(() => {
            setShown(next);
            updateEntry({ shown: next });
          });
        }),
    );
  };
  const last = turns.at(-1);
  return (
    <>
      <Walk
        acc={[]}
        anchor={anchoredTurn(turns)}
        index={turns.length - 1}
        keep={(settled) => {
          sink.current = settled;
        }}
        need={shown}
        onPieces={(settled) => {
          const key = keyOf(settled);
          if (key !== drawnKey.current) {
            redraw();
            return;
          }
          // Drawn: the presses that left other pieces than these are done.
          const waiting = presses.current.filter((press) => press.from !== key);
          presses.current = presses.current.filter((press) => press.from === key);
          waiting.forEach(({ done }) => done());
        }}
        page="last"
        root
        start={start}
        turns={turns}
      />
      <Pieces
        actions={actions}
        drawnKey={drawnKey}
        last={last!}
        onMore={more}
        sink={sink}
        version={version}
      />
    </>
  );
}
