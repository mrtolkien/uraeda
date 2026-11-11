// A round of questions: one component to answer it, wherever a round is asked. A feature's round
// is its file's page; the inbox's triage and the decisions check draw `Answering` in their own
// panes, and declare the same list of questions beside it.
import { definePane, type PaneRef } from "../../ui/layout";
import { roundFileOf as fileOf, WithRound } from "./read";
import { answered, askedOf, END } from "./position";
import { Questions } from "./Questions";
import { roundPosition } from "./Round";
import { RoundPage } from "./RoundPage";
import { type RoundArgs, targetOf } from "./saves";

export { Answering, Answers } from "./Round";
export type { RoundArgs } from "./saves";

/** The main pane a round of the default branch is drawn in, by its id: its screen says it. */
export const roundMains = new Map<string, (args: RoundArgs) => PaneRef>();

export const roundPane = definePane<RoundArgs>({
  // On a phone, the bar's one action moves the human on: to the next question left, then to the
  // submit, which they press there.
  action: (args) => {
    const file = fileOf(args)();
    if (file?.status !== "awaiting-human") return undefined;
    const position = roundPosition(args, () => file);
    const left = askedOf(file.current.items.clarifications).find(
      (one) => !answered(one) && one.id !== position.at(),
    );
    return left === undefined
      ? { icon: "check", label: "To the submit", run: () => position.go(END) }
      : { icon: "arrow-right", label: `Next: ${left.id}`, run: () => position.go(left.id) };
  },
  icon: "message-circle-question",
  kind: "round",
  mark: (args) => ({ needs: fileOf(args)()?.status === "awaiting-human" }),
  stack: "main",
  title: (args) => args.id.slice(args.id.lastIndexOf("/") + 1),
  view: (props) => <RoundPage args={props.args} />,
});

/** The main pane of a round: a feature's is `roundPane`, another's its screen's. */
const mainOf = (args: RoundArgs): PaneRef =>
  targetOf(args).kind === "feature" ? roundPane(args) : roundMains.get(args.id)!(args);

export const roundQuestionsPane = definePane<RoundArgs>({
  flush: true,
  icon: "list-checks",
  kind: "round-questions",
  mark: (args) => {
    const file = fileOf(args)();
    if (file?.status !== "awaiting-human") return undefined;
    const left = askedOf(file.current.items.clarifications).filter((one) => !answered(one));
    return { count: left.length };
  },
  stack: "side",
  title: "Questions",
  view: (props) => (
    <WithRound args={props.args}>
      {(file) => <Questions args={props.args} file={file} main={mainOf(props.args)} />}
    </WithRound>
  ),
});
