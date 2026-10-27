// The New page's three kinds, Session, Change, and Feature, as cards: each a titled pane with its
// icon and a drawing of what it starts (`KindArt.tsx`), so that a card looks like what it is (US5);
// its one sentence is for screen readers. The cards are a group of radios, with the radios' keys. An Astryx gap
// (plan, Complexity tracking; R12): `SelectableCard` is a checkbox and `RadioList` draws round
// radios, which approval comment C3 forbids, so the group is drawn by the page, each card a raw
// element holding the shared `Pane`.
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, useId, useRef } from "react";
import { KindArt } from "./KindArt.tsx";
import { useKeys } from "./keys/registry.tsx";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import type { NewKind } from "./routes.tsx";

const styles = stylex.create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // A compact card: its icon and name on one line, as tall as a touch target, square like a pane.
  chip: {
    alignItems: "center",
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: 1,
    color: colorVars["--color-text-secondary"],
    display: "flex",
    gap: spacingVars["--spacing-1"],
    justifyContent: "center",
    minHeight: "2.75rem",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  chipPicked: { borderColor: colorVars["--color-accent"], color: colorVars["--color-text-accent"] },
  // A grid of one, so its pane stretches to the card's height.
  card: { cursor: "pointer", display: "grid", minWidth: 0 },
  // The cards side by side at semi-wide and wide, as tall as the tallest.
  cards: {
    display: "grid",
    gap: spacingVars["--spacing-3"],
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  // On the phone, stacked.
  stacked: { gridTemplateColumns: "minmax(0, 1fr)" },
  // On the phone once a card is picked: a row of three titles, so that the composer is in view.
  compact: { gap: spacingVars["--spacing-2"], gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
});

/** A kind's card: its name and icon, and its sentence. */
type Kind = {
  icon: string;
  /** The key that picks the card, a mnemonic of its name. */
  key: "c" | "f" | "s";
  kind: NewKind;
  name: string;
  sentence: string;
};

/** The three kinds, in the order the cards and the arrow keys follow. */
const KINDS: Array<Kind> = [
  {
    icon: "uraeda:bot",
    key: "s",
    kind: "session",
    name: "Session",
    sentence: "A plain chat with the agent.",
  },
  {
    icon: "uraeda:wrench",
    key: "c",
    kind: "change",
    name: "Change",
    sentence: "A message in, a pull request out.",
  },
  {
    icon: "uraeda:file-text",
    key: "f",
    kind: "feature",
    name: "Feature",
    sentence: "Questions, a spec you review, then a pull request.",
  },
];

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
 * click or Space picks a card, and the focus goes on to the composer; the arrow keys, Home, and End,
 * without a modifier, move the focus and the pick. `s c f` pick a card too, and the status line
 * names them.
 */
export function KindCards({
  kind,
  onPick,
}: {
  /** The picked kind, or none: the phone's New page starts with no card picked. */
  kind: NewKind | undefined;
  /** `focus` says the pick was an activation, a click or Space, which moves on to the composer. */
  onPick: (kind: NewKind, options?: { focus?: boolean }) => void;
}) {
  const narrow = isNarrow(useWidthClass());
  // The phone, once a card is picked: the drawings give way to the composer.
  const compact = narrow && kind !== undefined;
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const bodies = useId();
  // `s c f` pick a card as a click would; the radio's own keys, below, move between them.
  useKeys(
    KINDS.map((card) => ({
      hint: card.key,
      hintLabel: card.name.toLowerCase(),
      keys: card.key,
      label: `Pick ${card.name}`,
      run: () => onPick(card.kind),
    })),
  );
  const keyDown = (event: KeyboardEvent, index: number) => {
    // A key with a modifier is the browser's or the system's, as Alt+Left is Back.
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      onPick(KINDS[index].kind, { focus: true });
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
      {...stylex.props(
        styles.cards,
        narrow && styles.stacked,
        compact && styles.compact,
      )}
    >
      {KINDS.map((card, index) => {
        const isPicked = card.kind === kind;
        return (
          <div
            aria-checked={isPicked}
            // A radio's content is presentational: its name is the card's, and its body, the
            // sentence, is read as its description; the drawing is for the eye.
            aria-describedby={`${bodies}-${card.kind}`}
            aria-label={card.name}
            key={card.kind}
            onClick={() => onPick(card.kind, { focus: true })}
            onKeyDown={(event) => keyDown(event, index)}
            ref={(element) => {
              cards.current[index] = element;
            }}
            role="radio"
            // The group's one stop: the picked card, or the first while none is.
            tabIndex={isPicked || (kind === undefined && index === 0) ? 0 : -1}
            {...stylex.props(styles.card, focusOutlineStyles.focusVisible)}
          >
            {compact ? (
              <div {...stylex.props(styles.chip, isPicked && styles.chipPicked)}>
                <Icon icon={card.icon} size="sm" />
                {card.name}
                <VisuallyHidden id={`${bodies}-${card.kind}`}>{card.sentence}</VisuallyHidden>
              </div>
            ) : (
              <Pane icon={card.icon} isActive={isPicked} isGroup title={card.name}>
                <div {...stylex.props(styles.body)}>
                  {/* The drawing says what it is; the sentence is for screen readers. */}
                  <KindArt kind={card.kind} />
                  <VisuallyHidden id={`${bodies}-${card.kind}`}>{card.sentence}</VisuallyHidden>
                </div>
              </Pane>
            )}
          </div>
        );
      })}
    </div>
  );
}
