import { Card } from "@astryxdesign/core/Card";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useContext } from "react";
import type { Document, QuestionItem } from "uraeda-binding";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import { holdsVariants, holdsWide, Options, QuestionContext, QuestionHead } from "./Question.tsx";
import { AnswerComment } from "./QuestionComment.tsx";
import type { RoundTarget } from "./roundTarget.ts";
import { StoryContext } from "./stories.tsx";
import { useAnswer } from "./useAnswer.ts";

const styles = stylex.create({
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
  // A card of one column, on a wide screen: a pane's width, centred, as the page's single panes; a
  // split one takes the page's, two context panes' wide.
  single: {
    marginInline: "var(--pane-centre, 0)",
    maxWidth: "var(--pane-max, none)",
  },
  rows: {
    "--container-padding-inline-end": "0px",
    // A table keeps to the card: it scrolls rather than reach past it.
    "--table-reach": "0px",
  },
  // On a wide screen, a table's rows' lines run into the card's room, as far as its cells' own
  // room at their edges, Astryx's 12 px: its columns' text then at the card's text's edges.
  tableBleed: { "--table-bleed": spacingVars["--spacing-3"] },
  split: {
    // The title and context on the left, the options and comment on the right, 5 to 6.
    alignItems: "start",
    columnGap: spacingVars["--spacing-8"],
    display: "grid",
    gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
  },
  // The left column of a split card, as tall as the card: its header sticks for the whole card.
  stickyHead: {
    // The question's header stays at the top of the window, over its card's background, while its
    // card is on screen, and leaves with it: its card holds it.
    backgroundColor: colorVars["--color-background-card"],
    insetBlockStart: 0,
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
    zIndex: 1,
  },
  stickyHeadPhone: {
    // On the phone, below the tabs, a row of `--spacing-12`, over the page's background, from
    // edge to edge.
    backgroundColor: colorVars["--color-background-surface"],
    insetBlockStart: spacingVars["--spacing-12"],
    marginInline: "var(--page-bleed)",
    paddingInline: "var(--page-inset)",
  },
  stretch: {
    alignSelf: "stretch",
  },
});

/**
 * A question as a card: on a wide screen, an Astryx card, of two columns once `roomy`, none of
 * its options holding stories and none of its parts a table, a mockup, or a story: its title and context on the left, its options and comment on the
 * right. On the phone, no card. At every width, its header sticks at the top while its card is on
 * screen, below the top bar on the phone, and a question taller than the screen scrolls under it.
 * A tap on an option toggles its letter and saves the answer, with the comment as saved; the
 * comment saves with its button, or with Submit. With `onAsk`, it offers "Ask the agent".
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
  const wide = !isNarrow(useWidthClass());
  const margin = useScrollMargin();
  // A comment on one of its stories joins its answer, on a line of its own, while it can be
  // answered. Its unsaved text is the question's own: another question of the round may embed the
  // same story.
  const stories = useContext(StoryContext);
  const split =
    wide &&
    roomy &&
    !holdsVariants(stories, document, question) &&
    !holdsWide(stories, document, question);
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
      <Options answer={answer} document={document} question={question} readOnly={readOnly} />
      <AnswerComment
        answer={answer}
        id={question.id}
        options={question.options.map((option) => option.letter)}
        path={path}
        readOnly={readOnly}
        saved={question.comment}
        takes={takes}
      />
    </div>
  );

  // One tree at every width, so a field being typed in stays as the window crosses the breakpoint.
  // On the phone and in one column, the card's columns draw no box: the header sticks for the whole
  // card; split, the left column is as tall as the card.
  return (
    <StoryContext value={comments}>
      <section id={question.id} {...stylex.props(margin, wide && !split && styles.single)}>
        <Card
          padding={wide ? 6 : 0}
          variant={wide ? "default" : "transparent"}
          xstyle={!wide && styles.flat}
        >
          <div
            {...stylex.props(
              styles.rows,
              wide && styles.tableBleed,
              split ? styles.split : styles.contents,
            )}
          >
            <div {...stylex.props(split ? styles.stretch : styles.contents)}>
              <div {...stylex.props(styles.stickyHead, !wide && styles.stickyHeadPhone)}>
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
