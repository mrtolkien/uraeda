// Where the human is in a round: its opening, a question, or its end. Kept on the device, by the
// round, so a round of 12 questions answered over a day, on the desktop or on the phone, opens
// where that device left it. A round never visited opens at its opening, its context before its
// first question; one with answers at its first question left without one.
import { type Accessor, untracked } from "nsh";
import { device } from "../../store";
import type { QuestionItem, RoundItems } from "../../store/protocol";
import type { RoundArgs } from "./saves";

/** The round's opening: its verdict, its context, and the points to check. */
export const START = "start";
/** The round's end: the points settled without the human, the notes, and the submit. */
export const END = "end";

/** The questions the round asks now, in the file's order, each follow-up after its parent. */
export const askedOf = (round: RoundItems | null | undefined): ReadonlyArray<QuestionItem> =>
  round?.questions.filter((question) => question.asked) ?? [];

/** Whether a question has an answer in the file. */
export const answered = (question: QuestionItem) => question.answer.trim() !== "";

/** Every place of a round, in order: its opening, each question asked, its end. */
export const stopsOf = (round: RoundItems | null | undefined): ReadonlyArray<string> => [
  START,
  ...askedOf(round).map((question) => question.id),
  END,
];

const keyOf = (args: RoundArgs) => `round.at:${args.repo}\n${args.id}` as const;

/**
 * Where a round with no place kept opened, by its key, for the run of the app: chosen once, so an
 * answer saved never moves the round from under the human, as "the first question left" would.
 */
const opened = new Map<string, string>();

export type Position = {
  /** The place shown: a question's id, `START`, or `END`. */
  at: Accessor<string>;
  /** Shows a place. */
  go: (to: string) => void;
  /** Shows the place `by` steps after the one shown, or before it. */
  step: (by: number) => void;
};

export function positionOf(args: RoundArgs, round: () => RoundItems | null | undefined): Position {
  const stops = () => stopsOf(round());
  const first = () => {
    const asked = askedOf(untracked(round));
    if (!asked.some(answered)) return START;
    return asked.find((question) => !answered(question))?.id ?? END;
  };
  const at = () => {
    const key = keyOf(args);
    const kept = device.get(key);
    // A question no longer asked, a follow-up whose parent's answer changed, opens its round anew.
    if (kept !== undefined && stops().includes(kept)) return kept;
    const chosen = opened.get(key);
    if (chosen !== undefined && stops().includes(chosen)) return chosen;
    // Before the round is read, nothing is chosen: its opening shows only once it is.
    if (untracked(round) == null) return START;
    const made = first();
    opened.set(key, made);
    return made;
  };
  const go = (to: string) => device.set(keyOf(args), to);
  return {
    at,
    go,
    step(by) {
      const all = untracked(stops);
      const index = all.indexOf(untracked(at));
      go(all[Math.max(0, Math.min(all.length - 1, index + by))] ?? START);
    },
  };
}
