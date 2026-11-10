// The data views of a session's turns and their items' pages, which the session's transcript reads.
import { dataView } from "@nkzw/fate/server";
import type { Item, Trigger, TurnActivity, TurnKind, TurnState } from "../runner/events.ts";

/** A turn of a session, without its items. */
export type TurnRecord = {
  /** What it does now while it runs, "Thinking" or "Writing spec.md", and since when. */
  activity: TurnActivity | null;
  /** An allow turn's rule. */
  allowed: string | null;
  endedAt: string | null;
  id: string;
  kind: TurnKind;
  /** The count of its item pages, of 100 items each. */
  pages: number;
  /** Why it failed or stopped. */
  reason: string | null;
  session: string;
  startedAt: string | null;
  state: TurnState;
  /** A workflow turn's step when it started. */
  step: string | null;
  trigger: Trigger | null;
};

/**
 * A page of 100 items of a turn, `<turn>:<page>`, from page 0, by their `seq`. Messages taken
 * back are left out: they leave the transcript.
 */
export type TurnLogRecord = {
  id: string;
  items: Array<Item & { seq: number }>;
  page: number;
  turn: string;
};

export const turnDataView = dataView<TurnRecord>("Turn")({
  activity: true,
  allowed: true,
  endedAt: true,
  id: true,
  kind: true,
  pages: true,
  reason: true,
  session: true,
  startedAt: true,
  state: true,
  step: true,
  trigger: true,
});

export const turnLogDataView = dataView<TurnLogRecord>("TurnLog")({
  id: true,
  items: true,
  page: true,
  turn: true,
});
