import { Card } from "@astryxdesign/core/Card";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useContext } from "react";
import type { Document, QuestionItem } from "uraeda-binding";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { holdsVariants, Options, QuestionContext, QuestionHead } from "./Question.tsx";
import { AnswerComment } from "./QuestionComment.tsx";
import type { RoundTarget } from "./roundTarget.ts";
import { StoryContext } from "./stories.tsx";
import { useAnswer } from "./useAnswer.ts";

const styles = stylex.create({
  belowBar: {
    // A jump puts the question below the phone's top bar, which stays in view.
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  belowNothing: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  // A box left out of the layout: its children are laid out by its parent.
  contents: {
    display: "contents",
  },
  // The card's own inset at the end, which a list's rows would take back past their column's end,
  // where the list clips them: rows end with their text, as on the page.
  flat: {
    // On the phone, no card: no corners, and its options and header reach the screen's edges.
    borderRadius: 0,
    overflow: "visible",
  },
  rows: {
    "--container-padding-inline-end": "0px",
  },
  split: {
    // The title and context on the left, the options and comment on the right, 5 to 6.
    alignItems: "start",
    columnGap: spacingVars["--spacing-8"],
    display: "grid",
    gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
  },
  stickyHead: {
    // On the phone, the question's header stays below the top bar, the top bar's own height, over
    // the page's background, while its question scrolls under it.
    backgroundColor: colorVars["--color-background-surface"],
    insetBlockStart: spacingVars["--spacing-12"],
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
    position: "sticky",
    zIndex: 1,
  },
  stickyHeadFollowUp: {
    // A follow-up's header reaches its accent line, not past it.
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-3"]})`,
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/**
 * A question as a card: on a wide screen, an Astryx card, of two columns once `roomy` and none of
 * its options holds stories: its title and context on the left, its options and comment on the
 * right. On the phone, no card: its header sticks below the top bar while it scrolls. A tap on an
 * option toggles its letter and saves the answer, with the comment as saved; the comment saves
 * with its button, or with Submit. With `onAsk`, it offers "Ask the agent".
 */
export function QuestionCard({
  document,
  onAsk,
  path,
  question,
  readOnly,
  roomy,
  takes,
  target,
}: {
  document: Document;
  onAsk?: (question: QuestionItem) => void;
  /** The round's file, which the comments' images are attached to. */
  path: string;
  question: QuestionItem;
  readOnly: boolean;
  /** Whether its question's cards are wide enough for two columns. */
  roomy: boolean;
  /** Whether the round's file takes images, as the core says. */
  takes: boolean;
  /** The round the answer is written in. */
  target: RoundTarget;
}) {
  const answer = useAnswer(question, target, path);
  const wide = useWidthClass() === "wide";
  // A comment on one of its stories joins its answer, on a line of its own, while it can be
  // answered. Its unsaved text is the question's own: another question of the round may embed the
  // same story.
  const stories = useContext(StoryContext);
  const split = wide && roomy && !holdsVariants(stories, document, question);
  const comments =
    stories && !readOnly
      ? {
          ...stories,
          comment: {
            path: `${path}#${question.id}`,
            save: (_: unknown, text: string) => answer.appendLine(text),
          },
        }
      : stories;
  const head = <QuestionHead question={question} {...(onAsk ? { onAsk } : {})} />;
  const context = <QuestionContext document={document} question={question} />;
  const answering = (
    <div>
      <Options
        answer={answer}
        beside={split}
        document={document}
        question={question}
        readOnly={readOnly}
      />
      <AnswerComment
        answer={answer}
        id={question.id}
        path={path}
        readOnly={readOnly}
        saved={question.comment}
        takes={takes}
      />
    </div>
  );

  // One tree at every width, so a field being typed in stays as the window crosses the breakpoint.
  // On the phone, the card draws nothing, and its columns no box: the header sticks for the whole
  // question.
  return (
    <StoryContext value={comments}>
      <section id={question.id} {...stylex.props(wide ? styles.belowNothing : styles.belowBar)}>
        <Card
          padding={wide ? 6 : 0}
          variant={wide ? "default" : "transparent"}
          xstyle={!wide && styles.flat}
        >
          <div {...stylex.props(styles.rows, split ? styles.split : styles.contents)}>
            <div {...stylex.props(!split && styles.contents)}>
              <div
                {...stylex.props(
                  !wide && styles.stickyHead,
                  !wide && question.parent !== undefined && styles.stickyHeadFollowUp,
                )}
              >
                {head}
              </div>
              {context}
            </div>
            {answering}
          </div>
        </Card>
      </section>
    </StoryContext>
  );
}
