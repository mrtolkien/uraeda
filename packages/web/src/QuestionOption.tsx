// An option of a question: a card the human picks, with its letter, its sentence, its pros, cons,
// and why, and its other blocks.
import { HStack } from "@astryxdesign/core/HStack";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useContext } from "react";
import type { Choice, Document } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { CandidateCard } from "./decisions/Candidates.tsx";
import { StaticImages } from "./ImageView.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { plain, Spans } from "./Spans.tsx";
import { holdsStory, StoryContext } from "./stories.tsx";

const styles = stylex.create({
  con: { color: colorVars["--color-error"] },
  letter: {
    alignItems: "center",
    borderColor: colorVars["--color-text-secondary"],
    borderRadius: radiusVars["--radius-full"],
    borderStyle: "solid",
    borderWidth: spacingVars["--spacing-0-5"],
    boxSizing: "border-box",
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
    flexShrink: 0,
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    height: spacingVars["--spacing-7"],
    justifyContent: "center",
    width: spacingVars["--spacing-7"],
  },
  letterOn: {
    backgroundColor: colorVars["--color-accent"],
    borderColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  optionPhone: {
    // On the phone, options run to the screen's edges, as today, split by hairlines.
    borderBlockStartWidth: 0,
    borderInlineWidth: 0,
    borderRadius: 0,
  },
  optionReadOnly: {
    // An answered round's options show their letters as picked, at full contrast, untappable.
    opacity: 1,
  },
  point: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    paddingInlineStart: spacingVars["--spacing-5"],
    position: "relative",
  },
  points: {
    listStyle: "none",
    margin: 0,
    maxWidth: "var(--size-reading-measure)",
    padding: 0,
  },
  pro: { color: colorVars["--color-success"] },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetInlineStart: 0,
    position: "absolute",
  },
  summary: {
    // An option's text keeps the reading measure, its card as wide as its column.
    fontSize: "var(--text-reading-size)",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    textWrap: "pretty",
  },
  tag: {
    color: colorVars["--color-warning"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
  variants: {
    // An option's stories, under its card, at its text's inset: on the phone, the embed takes it
    // back, to the screen's edges.
    paddingInline: spacingVars["--spacing-4"],
  },
  why: { color: colorVars["--color-warning"] },
});

/** An option's pros, cons, and why, each after its sign. */
function Points({ choice, document }: { choice: Choice; document: Document }) {
  const point = (id: number, sign: string, tone: stylex.StyleXStyles) => (
    <li key={`${sign}${id}`} {...stylex.props(styles.point)}>
      <span {...stylex.props(styles.sign, tone)}>{sign}</span>
      <Spans spans={document.blocks[id]?.spans ?? []} />
    </li>
  );
  if (choice.pros.length === 0 && choice.cons.length === 0 && choice.why === undefined) {
    return null;
  }
  return (
    <ul {...stylex.props(styles.points)}>
      {choice.pros.map((id) => point(id, "+", styles.pro))}
      {choice.cons.map((id) => point(id, "−", styles.con))}
      {choice.why !== undefined && point(choice.why, "★", styles.why)}
    </ul>
  );
}

/** An option's accessible name: its letter, "recommended" when it is, and its sentence. */
function optionName(choice: Choice) {
  const recommended = choice.recommended ? " (recommended)" : "";
  return `Option ${choice.letter}${recommended}: ${plain(choice.summary)}`;
}

/**
 * An option as a card the human picks: "Recommended", its letter and sentence, its points, and its
 * other blocks; its stories under the card, never inside it, where their frames would be inert.
 */
export function OptionCard({
  choice,
  disabled,
  document,
  onToggle,
  question,
  selected,
}: {
  choice: Choice;
  disabled: boolean;
  document: Document;
  onToggle: () => void;
  /** The id of the question the option belongs to, which names its candidate. */
  question: string;
  selected: boolean;
}) {
  const wide = !isNarrow(useWidthClass());
  const stories = useContext(StoryContext);
  const isStory = (id: number) => holdsStory(stories, document, id);
  const other = choice.other.filter((id) => !isStory(id));
  const variants = choice.other.filter(isStory);
  return (
    <div>
      <SelectableCard
        isDisabled={disabled}
        isSelected={selected}
        label={optionName(choice)}
        onChange={onToggle}
        padding={wide ? 3 : 4}
        xstyle={[!wide && styles.optionPhone, disabled && styles.optionReadOnly]}
      >
        {/* A tap on an image picks the option: its images open no lightbox. */}
        <StaticImages>
          <VStack gap={2}>
            {choice.recommended && <span {...stylex.props(styles.tag)}>Recommended</span>}
            <HStack align="start" gap={2}>
              <span {...stylex.props(styles.letter, selected && styles.letterOn)}>
                {choice.letter}
              </span>
              <span {...stylex.props(styles.summary)}>
                <Spans spans={choice.summary} />
              </span>
            </HStack>
            <Points choice={choice} document={document} />
            {other.length > 0 && <Blocks document={document} ids={other} />}
          </VStack>
        </StaticImages>
      </SelectableCard>
      {variants.length > 0 && (
        <div {...stylex.props(styles.variants)}>
          <Blocks document={document} ids={variants} />
        </div>
      )}
      <CandidateCard id={question} letter={choice.letter} />
    </div>
  );
}
