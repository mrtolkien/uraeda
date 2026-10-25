// The pieces the tail's walk settled on, drawn: each a page of a turn, from where the tail starts,
// with its turn's divider, its live line, and its ending.
import { Button } from "@astryxdesign/core/Button";
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { stepLabel } from "./labels.ts";
import { LiveRecap } from "./session/RecapLine.tsx";
import { useTurn, useTurnLog } from "./sessionData.ts";
import type { Piece } from "./tail.tsx";
import { type Actions, TranscriptItems } from "./TranscriptMessages.tsx";
import { Ending, ending } from "./TurnLines.tsx";

const styles = stylex.create({
  turn: {
    // A page's lines, spaced as the list spaces them, in a box the address's anchor scrolls to.
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
  },
});

/**
 * A piece of a turn: its workflow divider with its first page, its items from where the tail
 * starts, and its live line and ending with its last page, in a box the address's anchor scrolls to,
 * with the button above that offers the messages before it. The press keeps the place of the box's
 * first element, which the earlier messages are drawn before. `latest` for the session's latest turn.
 */
function TailPage({
  actions,
  follows,
  latest,
  onMore,
  piece,
}: {
  actions: Actions;
  /** Whether the piece before is its turn's page before, drawn whole to its end. */
  follows: boolean;
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
  // A running turn ends with its live line, which stands for its open stretch.
  const live = last && turn.state === "running" ? turn.activity : null;
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
            endsOpen={last && !live}
            follows={follows}
            latest={latest && last}
            piece={piece}
            queued={turn.state === "queued"}
          />
        )}
        {live && <LiveRecap actions={actions} activity={live} pages={turn.pages} turn={turn.id} />}
        {last && end && <Ending state={turn.state} text={end} />}
      </div>
    </>
  );
}

/** The items of a piece's page, from where the tail starts. */
function PageItems({
  actions,
  endsOpen,
  follows,
  latest,
  piece,
  queued,
}: {
  actions: Actions;
  /** Whether a stretch open at the page's end draws its line here. */
  endsOpen: boolean;
  follows: boolean;
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
      // Cut by the tail at a message, even the page's first, the items go on from no stretch of the
      // page before, and draw none of it: it is before the cut.
      after={follows ? piece.page - 1 : undefined}
      endsOpen={endsOpen}
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
export function Pieces({
  actions,
  last,
  onDrawn,
  onMore,
  sink,
}: {
  actions: Actions;
  last: string;
  /** Called with the pieces each commit draws, once they are on the page. */
  onDrawn: (pieces: ReadonlyArray<Piece>) => void;
  onMore: (anchor: Element | null) => void;
  sink: RefObject<ReadonlyArray<Piece>>;
  version: number;
}) {
  const pieces = sink.current;
  // The walk hands its pieces over as it renders, so a render React sets aside may still draw them
  // here: what is drawn is known from this commit, not from the walk's.
  useLayoutEffect(() => onDrawn(pieces));
  return pieces.map((piece, at) => (
    <TailPage
      actions={actions}
      follows={pieces[at - 1]?.turn === piece.turn && pieces[at - 1]?.page === piece.page - 1}
      key={`${piece.turn}:${piece.page}`}
      latest={piece.turn === last}
      onMore={onMore}
      piece={piece}
    />
  ));
}
