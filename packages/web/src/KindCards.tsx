// The New page's three kinds, Session, Change, and Feature, as cards: each a titled pane with its
// icon, its sentence, its example, what it ends with, and what waits on the human (US5). The cards
// are a group of radios, with the radios' keys. An Astryx gap (plan, Complexity tracking; R12):
// `SelectableCard` is a checkbox and `RadioList` draws round radios, which approval comment C3
// forbids, so the group is drawn by the page, each card a raw element holding the shared `Pane`.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, useId, useRef } from "react";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { proseStyles } from "./Prose.tsx";
import type { NewKind } from "./routes.tsx";

const styles = stylex.create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // A grid of one, so its pane stretches to the card's height.
  card: { cursor: "pointer", display: "grid", minWidth: 0 },
  // The cards side by side at semi-wide and wide, as tall as the tallest.
  cards: {
    display: "grid",
    gap: spacingVars["--spacing-3"],
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  // A fact on one line: its icon and label, then its value right beside it (C3), which wraps in
  // its own room when the card is narrow. Both start at the line's top, in the same line height,
  // so their words share a baseline: the label's icon has none to align on.
  fact: {
    alignItems: "start",
    columnGap: spacingVars["--spacing-2"],
    display: "flex",
  },
  // On the picked card's tint, the rule in the accent, which keeps its 3:1 there in dark.
  pickedFacts: { borderBlockStartColor: colorVars["--color-accent"] },
  // The facts under a rule, as the mockup draws them apart from the sentence.
  facts: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    margin: 0,
    paddingBlockStart: spacingVars["--spacing-2"],
  },
  label: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-1"],
    margin: 0,
  },
  // On the phone, stacked.
  stacked: { gridTemplateColumns: "minmax(0, 1fr)" },
  value: { margin: 0, minWidth: 0 },
});

/** A kind's card: its name and icon, its sentence, its example, and its two facts. */
type Kind = {
  endsWith: string;
  example: string;
  icon: string;
  kind: NewKind;
  name: string;
  sentence: string;
  waitsOnYou: string;
};

/** The three kinds, in the order the cards and the arrow keys follow. */
const KINDS: Array<Kind> = [
  {
    endsWith: "the chat",
    example: "“Why is CI slow?”",
    icon: "uraeda:bot",
    kind: "session",
    name: "Session",
    sentence: "Talk to the agent in the main checkout, like plain Claude Code.",
    waitsOnYou: "nothing",
  },
  {
    endsWith: "a pull request",
    example: "“Fix the due-date typo”",
    icon: "uraeda:wrench",
    kind: "change",
    name: "Change",
    sentence: "A bug fix or a small change, on its own branch.",
    waitsOnYou: "the pull request",
  },
  {
    endsWith: "a spec, then a pull request",
    example: "“Add recurring tasks”",
    icon: "uraeda:file-text",
    kind: "feature",
    name: "Feature",
    sentence: "A larger piece of work, designed with the agent before any code.",
    waitsOnYou: "questions, then the spec",
  },
];

/** A fact: its icon, its label in secondary text, and its value beside it. */
function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div {...stylex.props(styles.fact)}>
      <dt {...stylex.props(styles.label)}>
        <Icon color="secondary" icon={icon} size="sm" />
        <Text color="secondary">{label}</Text>
      </dt>
      <dd {...stylex.props(styles.value)}>
        <Text>{value}</Text>
      </dd>
    </div>
  );
}

/** The index the keys move to from `index`, wrapping at the ends, or none for another key. */
function moved(key: string, index: number): number | undefined {
  const last = KINDS.length - 1;
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return index === last ? 0 : index + 1;
    case "ArrowLeft":
    case "ArrowUp":
      return index === 0 ? last : index - 1;
    case "End":
      return last;
    case "Home":
      return 0;
    default:
      return undefined;
  }
}

/**
 * The New page's cards: a `radiogroup` named "What to start" of three `radio` cards, Session,
 * Change, and Feature, the picked one the active pane and the group's one stop in the tab order. A
 * click or Space picks a card; the arrow keys, Home, and End, without a modifier, move the focus and
 * the pick. The examples are left out on the phone, where the cards stack.
 */
export function KindCards({ kind, onPick }: { kind: NewKind; onPick: (kind: NewKind) => void }) {
  const narrow = isNarrow(useWidthClass());
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const bodies = useId();
  const keyDown = (event: KeyboardEvent, index: number) => {
    // A key with a modifier is the browser's or the system's, as Alt+Left is Back.
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      onPick(KINDS[index].kind);
      return;
    }
    const next = moved(event.key, index);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onPick(KINDS[next].kind);
    cards.current[next]?.focus();
  };
  return (
    <div
      aria-label="What to start"
      role="radiogroup"
      {...stylex.props(styles.cards, narrow && styles.stacked)}
    >
      {KINDS.map((card, index) => {
        const isPicked = card.kind === kind;
        return (
          <div
            aria-checked={isPicked}
            // A radio's content is presentational: its name is the card's, and its body, the
            // sentence, example, and facts, is read as its description.
            aria-describedby={`${bodies}-${card.kind}`}
            aria-label={card.name}
            key={card.kind}
            onClick={() => onPick(card.kind)}
            onKeyDown={(event) => keyDown(event, index)}
            ref={(element) => {
              cards.current[index] = element;
            }}
            role="radio"
            tabIndex={isPicked ? 0 : -1}
            {...stylex.props(styles.card, focusOutlineStyles.focusVisible)}
          >
            <Pane
              icon={card.icon}
              isActive={isPicked}
              isGroup
              isTinted={isPicked}
              title={card.name}
            >
              <div id={`${bodies}-${card.kind}`} {...stylex.props(styles.body)}>
                <div {...stylex.props(proseStyles.reading)}>{card.sentence}</div>
                {!narrow && <Text color="secondary">{card.example}</Text>}
                <dl {...stylex.props(styles.facts, isPicked && styles.pickedFacts)}>
                  <Fact icon="uraeda:flag" label="Ends with" value={card.endsWith} />
                  <Fact icon="uraeda:hourglass" label="Waits on you" value={card.waitsOnYou} />
                </dl>
              </div>
            </Pane>
          </div>
        );
      })}
    </div>
  );
}
