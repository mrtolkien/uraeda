// A round of questions, answered one question at a time: its opening, each question asked, then
// its end, which submits. The one way to answer a question in the app: a feature's round, the
// inbox's triage, and the decisions check all draw it. Where the human is, is kept on the device;
// each answer is saved as it is made, in order, and the round is submitted only by its end's
// button. A letter picks and goes on, Shift and a letter adds it, `n` and `p` move, `i` writes a
// comment.
import { effect, View } from "nsh";
import type { FileView, QuestionItem } from "../../store/protocol";
import { Banner, Button, Progress, Text } from "../../ui/controls";
import { keyScope, type KeySpec, registerKey } from "../../ui/keys";
import { PaneScroll } from "../../ui/layout";
import { Card } from "../../ui/lists";
import { End } from "./End";
import { linksOf } from "./links";
import { Opening } from "./Opening";
import { answered, askedOf, END, type Position, positionOf, START } from "./position";
import { LETTERS, type OptionExtra, Question, type QuestionHands } from "./Question";
import { type RoundArgs, savesOf } from "./saves";
import { answerWords, followsRecommendation } from "./words";

/** The words of a place in the round, as its buttons and its list say them. */
export function stopWords(at: string, asked: ReadonlyArray<QuestionItem>): string {
  if (at === START) return "The round's context";
  if (at === END) return "Submit";
  return asked.find((question) => question.id === at)?.id ?? at;
}

/** The round's place for the panes beside it: the same position, read from the device. */
export const roundPosition = (args: RoundArgs, file: () => FileView | null | undefined) =>
  positionOf(args, () => file()?.current.items.clarifications);

/** A round waiting for the human's answers: `file` is its record, read. */
export function Answering(props: {
  args: RoundArgs;
  file: () => FileView;
  /** What the screen adds under an option. */
  optionExtra?: OptionExtra;
}) {
  const round = () => props.file().current.items.clarifications;
  const saves = savesOf(props.args, props.file);
  effect(() => saves.read(props.file()));
  const position: Position = roundPosition(props.args, props.file);
  const links = linksOf(props.args, props.file);
  const asked = () => askedOf(round());
  const done = () => asked().filter(answered).length;
  const index = () => asked().findIndex((question) => question.id === position.at());
  const next = () => {
    const stops = [START, ...asked().map((question) => question.id), END];
    return stops[stops.indexOf(position.at()) + 1];
  };

  registerKey([
    {
      hint: "n p",
      hintLabel: "move",
      keys: "n",
      label: "Next question",
      run: () => position.step(1),
    },
    { keys: "p", label: "Previous question", run: () => position.step(-1) },
  ]);
  // A question's own keys, in a selection's scope, so `b` answers B, not Back, while one is shown.
  const hands: QuestionHands = {};
  const shown = keyScope({
    kind: "selection",
    name: "Question",
    on: () => position.at() !== START && position.at() !== END,
  });
  registerKey(
    [
      ...LETTERS.map((key, place): KeySpec => ({
        // One hint for the six letters: a press on it opens the key map, never answers A.
        hint: place === 0 ? "a–f" : undefined,
        hintLabel: place === 0 ? "answer" : undefined,
        hintPress: place === 0 ? "?" : undefined,
        keys: key,
        label: `Answer ${key.toUpperCase()}, and go on`,
        run: () => hands.pick?.(key) ?? false,
      })),
      // Shift and a letter adds it to the answer, or takes it out, and stays: an answer of several.
      ...LETTERS.map((key): KeySpec => ({
        keys: key.toUpperCase(),
        label: `Add ${key.toUpperCase()} to the answer, or take it out`,
        run: () => hands.toggle?.(key) ?? false,
      })),
      {
        hint: "i",
        hintLabel: "comment",
        keys: "i",
        label: "Write a comment",
        run: () => hands.comment?.(),
      },
      {
        hint: "s",
        hintLabel: "ask",
        keys: "s",
        label: "Ask the agent about this question, beside",
        run: () => hands.ask?.() ?? false,
      },
    ],
    shown,
  );

  return (
    <View style={{ flex: 1, gap: 12 }}>
      <Progress
        label="Answers"
        testID="round-progress"
        value={asked().length === 0 ? 1 : done() / asked().length}
        words={`${done()} of ${asked().length} answered`}
      />
      <Each key={(at: string) => at} of={[position.at()]}>
        {(at) => (
          <PaneScroll name={`round:${at()}`} style={{ flex: 1 }}>
            <View style={{ gap: 16, paddingBottom: 24 }}>
              <If when={round()}>
                {(items) => (
                  <>
                    <If when={at() === START}>
                      <Opening
                        args={props.args}
                        file={props.file}
                        links={links}
                        round={items}
                        saves={saves}
                      />
                    </If>
                    <If when={at() === END}>
                      <End
                        args={props.args}
                        file={props.file}
                        links={links}
                        position={position}
                        round={items}
                        saves={saves}
                      />
                    </If>
                    <If when={asked().find((question) => question.id === at())}>
                      {(question) => (
                        <Question
                          args={props.args}
                          file={props.file}
                          hands={hands}
                          links={links}
                          onNext={() => position.step(1)}
                          optionExtra={props.optionExtra}
                          place={`Question ${index() + 1} of ${asked().length}`}
                          question={question}
                          saves={saves}
                        />
                      )}
                    </If>
                  </>
                )}
              </If>
              <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
                <Button
                  disabled={at() === START}
                  icon="arrow-left"
                  label="Previous"
                  onPress={() => position.step(-1)}
                />
                <If when={next()}>
                  {(to) => (
                    <Button
                      icon="arrow-right"
                      label={to() === END ? "To the submit" : `Next: ${stopWords(to(), asked())}`}
                      onPress={() => position.step(1)}
                      testID="round-next"
                    />
                  )}
                </If>
              </View>
            </View>
          </PaneScroll>
        )}
      </Each>
    </View>
  );
}

/** A round in any state but waiting: each question asked, with its answer, as a card. */
export function Answers(props: { file: FileView }) {
  const asked = () => askedOf(props.file.current.items.clarifications);
  return (
    <View style={{ gap: 8 }}>
      <Each of={asked()}>
        {(question) => (
          <Card
            body={
              <Text tone={answered(question()) ? "ink" : "faint"}>{answerWords(question())}</Text>
            }
            icon={answered(question()) ? "circle-check" : "circle-dot"}
            state={
              followsRecommendation(question())
                ? { label: "As recommended", tone: "quiet" }
                : undefined
            }
            title={`${question().id}: ${question().title}`}
          />
        )}
      </Each>
      <If when={props.file.current.items.clarifications?.notes}>
        {(notes) => (
          <Banner icon="pencil-line" title="Notes" tone="info">
            <Text>{notes()}</Text>
          </Banner>
        )}
      </If>
    </View>
  );
}
