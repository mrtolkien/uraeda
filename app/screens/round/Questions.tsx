// Beside a round, the round at a glance: its context, each question asked with its state, its
// answer in a few words and whether it follows the recommendation, then its end. The place shown
// in the round is the list's current row; `Enter` or a press shows another, and focuses the round.
import type { FileView } from "../../store/protocol";
import { focusPane, usePane } from "../../ui/layout";
import { createCursor, Line, List } from "../../ui/lists";
import { answered, askedOf, END, START } from "./position";
import { roundPosition } from "./Round";
import type { RoundArgs } from "./saves";
import { answerWords, followsRecommendation } from "./words";
import type { PaneRef } from "../../ui/layout";

export function Questions(props: { args: RoundArgs; file: () => FileView; main: PaneRef }) {
  const kept = usePane().remember<string | null>("at", null);
  const position = roundPosition(props.args, props.file);
  const asked = () => askedOf(props.file().current.items.clarifications);
  const rows = () => [
    { id: START },
    ...asked().map((question) => ({ id: question.id })),
    { id: END },
  ];
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const left = () => asked().filter((question) => !answered(question)).length;
  return (
    <List
      cursor={cursor}
      onOpen={(id) => {
        position.go(id);
        focusPane(props.main);
      }}
      openLabel="show it"
      row={(id) => {
        const question = () => asked().find((one) => one.id === id());
        return (
          <If
            when={question()}
            else={
              <Line
                current={position.at() === id()}
                icon={id() === START ? "book-open" : "check"}
                label={id() === START ? "Context and points to check" : "Notes and submit"}
                meta={id() === END ? (left() === 0 ? "ready" : `${left()} left`) : undefined}
                metaTone={id() === END && left() === 0 ? "done" : "needs"}
              />
            }
          >
            {(shown) => (
              <Line
                current={position.at() === id()}
                icon={answered(shown()) ? "circle-check" : "circle-dot"}
                label={`${shown().id}: ${shown().title}`}
                meta={`${answerWords(shown())}${followsRecommendation(shown()) ? " · recommended" : ""}`}
                metaTone={answered(shown()) ? "quiet" : "needs"}
                quiet={false}
              />
            )}
          </If>
        );
      }}
      testID="round-questions"
    />
  );
}
