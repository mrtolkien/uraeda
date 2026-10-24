// An option of a question: a card the human picks, its letter in its border, with its sentence, its
// pros, cons, and why, and its other blocks.
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  fontWeightVars,
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
import { proseStyles } from "./Prose.tsx";
import { plain, Spans } from "./Spans.tsx";
import { holdsStory, StoryContext } from "./stories.tsx";

const styles = stylex.create({
  // A point's box on the phone, its sign in its top border, its text at its inner edge.
  box: {
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    paddingBlockEnd: spacingVars["--spacing-1"],
    paddingBlockStart: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
    position: "relative",
  },
  boxes: {
    // Room above each box for the half of its sign over its border.
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    listStyle: "none",
    margin: 0,
    marginBlockStart: spacingVars["--spacing-1"],
    padding: 0,
  },
  boxSign: {
    backgroundColor: colorVars["--color-background-card"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetBlockStart: 0,
    insetInlineStart: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
  },
  con: { color: colorVars["--color-error"] },
  conBox: { borderColor: colorVars["--color-border-red"] },
  legend: {
    // The letter, "★ Recommended", and "picked", centred on the option's top border, over it.
    alignItems: "center",
    backgroundColor: colorVars["--color-background-card"],
    display: "inline-flex",
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    gap: spacingVars["--spacing-2"],
    insetBlockStart: "var(--option-legend-top)",
    insetInlineStart: "var(--option-legend-start)",
    lineHeight: typeScaleVars["--text-supporting-leading"],
    maxWidth: "var(--option-legend-width)",
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
    whiteSpace: "nowrap",
  },
  letter: {
    color: colorVars["--color-text-primary"],
    paddingInline: spacingVars["--spacing-1"],
  },
  letterOn: {
    backgroundColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  option: {
    // One square border, the text inset by `--option-inset` from its outer edge, whatever the
    // border's width: a picked option's thicker border takes the inset's room, so its text stays.
    // The legend's place follows: centred on the border, its letter at the text's edge.
    "--option-border": borderVars["--border-width"],
    "--option-inset": spacingVars["--spacing-3"],
    "--option-legend-start": `calc(var(--option-pad) - ${spacingVars["--spacing-1"]})`,
    "--option-legend-top": "calc(var(--option-border) / -2)",
    "--option-legend-width": "calc(100% - 2 * var(--option-pad))",
    "--option-pad": "calc(var(--option-inset) - var(--option-border))",
    borderRadius: 0,
    borderWidth: "var(--option-border)",
    overflow: "visible",
    paddingBlockEnd: "var(--option-pad)",
    paddingBlockStart: `calc(var(--option-pad) + ${spacingVars["--spacing-1"]})`,
    paddingInlineEnd: "var(--option-pad)",
    paddingInlineStart: "var(--option-pad)",
  },
  optionPhone: {
    // On the phone, the option's border runs at the screen's edges, its text close to them.
    "--option-inset": spacingVars["--spacing-2"],
  },
  optionReadOnly: {
    // An answered round's options show their letters as picked, at full contrast, untappable.
    opacity: 1,
  },
  picked: {
    // Picked: the accent's border, twice as thick, without Astryx's inner ring.
    "--_card-ring": "0 0 transparent",
    "--option-border": `calc(2 * ${borderVars["--border-width"]})`,
    borderColor: colorVars["--color-accent"],
  },
  pickedTag: { color: colorVars["--color-text-accent"] },
  point: {
    paddingInlineStart: spacingVars["--spacing-5"],
    position: "relative",
  },
  points: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  pro: { color: colorVars["--color-success"] },
  proBox: { borderColor: colorVars["--color-border-green"] },
  recommended: { borderColor: colorVars["--color-border-yellow"] },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetInlineStart: 0,
    position: "absolute",
  },
  summary: {
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
  tag: { color: colorVars["--color-warning"] },
  variants: {
    // An option's stories, under its card, at its text's inset: on the phone, the embed takes it
    // back, to the screen's edges.
    paddingInline: spacingVars["--spacing-4"],
  },
  why: { color: colorVars["--color-warning"] },
  whyBox: { borderColor: colorVars["--color-border-yellow"] },
});

/** A point's sign, its colour, and its box's border's colour. */
type Sign = { box: stylex.StyleXStyles; sign: string; tone: stylex.StyleXStyles };
const PRO: Sign = { box: styles.proBox, sign: "+", tone: styles.pro };
const CON: Sign = { box: styles.conBox, sign: "−", tone: styles.con };
const WHY: Sign = { box: styles.whyBox, sign: "★", tone: styles.why };

/**
 * An option's pros, cons, and why: on a wide screen, each after its sign, hanging beside its text;
 * on the phone, each a box with its sign in its top border, so its text keeps the screen's width.
 */
function Points({ choice, document }: { choice: Choice; document: Document }) {
  const wide = !isNarrow(useWidthClass());
  const point = (id: number, { box, sign, tone }: Sign) => (
    <li
      key={`${sign}${id}`}
      {...stylex.props(
        proseStyles.reading,
        proseStyles.measure,
        wide ? styles.point : [styles.box, box],
      )}
    >
      <span {...stylex.props(wide ? styles.sign : styles.boxSign, tone)}>{sign}</span>
      <Spans spans={document.blocks[id]?.spans ?? []} />
    </li>
  );
  if (choice.pros.length === 0 && choice.cons.length === 0 && choice.why === undefined) {
    return null;
  }
  return (
    <ul {...stylex.props(wide ? styles.points : styles.boxes)}>
      {choice.pros.map((id) => point(id, PRO))}
      {choice.cons.map((id) => point(id, CON))}
      {choice.why !== undefined && point(choice.why, WHY)}
    </ul>
  );
}

/** An option's accessible name: its letter, "recommended" when it is, and its sentence. */
function optionName(choice: Choice) {
  const recommended = choice.recommended ? " (recommended)" : "";
  return `Option ${choice.letter}${recommended}: ${plain(choice.summary)}`;
}

/**
 * An option as a card the human picks, one border with its letter and "★ Recommended" in it, then
 * "picked" once picked, the border telling which: its sentence, its points, and its other blocks;
 * its stories under the card, never inside it, where their frames would be inert. An Astryx gap
 * (plan, Complexity tracking): `SelectableCard` has no title in its border, so the letter is
 * placed over it, as `Pane`'s title is.
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
        xstyle={[
          styles.option,
          !wide && styles.optionPhone,
          choice.recommended && styles.recommended,
          selected && styles.picked,
          disabled && styles.optionReadOnly,
        ]}
      >
        <span {...stylex.props(styles.legend)}>
          <span {...stylex.props(styles.letter, selected && styles.letterOn)}>{choice.letter}</span>
          {choice.recommended && <span {...stylex.props(styles.tag)}>★ Recommended</span>}
          {selected && <span {...stylex.props(styles.pickedTag)}>picked</span>}
        </span>
        {/* A tap on an image picks the option: its images open no lightbox. */}
        <StaticImages>
          <VStack gap={2}>
            <span {...stylex.props(proseStyles.reading, proseStyles.measure, styles.summary)}>
              <Spans spans={choice.summary} />
            </span>
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
