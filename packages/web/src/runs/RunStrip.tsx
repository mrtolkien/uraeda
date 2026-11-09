// The run map in one line, for a start dialog: "Runs", each step's agent mark in a small square,
// the scissors where a clean session starts, then what differs from the defaults in a few words. Tab
// reaches it; ← → (h l) move along the steps and the joints between them, as on the map, the focus
// with them; Enter opens the key picker on the step selected, and Enter or Space on a joint cuts or
// joins it. A change runs one step: its strip holds that step and its reviewers, Enter on an agent
// reviewer picking its agent and model. The strip is drawn in a dialog, a layer the key registry
// leaves to its owner: its keys are its own, as a radio group's are (run options R26).
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, type Ref, useRef, useState } from "react";
import { HarnessMark } from "../HarnessMark.tsx";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { useSingleKeys } from "../keys/registry.tsx";
import { pickedStyles } from "../layout/picked.ts";
import { PickSteps, type PickerRuntime, type SessionPick } from "../SessionPicker.tsx";
import { Scissors } from "./glyphs.tsx";
import { drawn, sessionColour } from "./parts.tsx";
import {
  changes,
  differences,
  jointCuts,
  reviewerChanged,
  type RunOptions,
  sessionSpans,
  withCut,
  STEP_LOOKS,
  STEPS,
  type StepId,
} from "./runOptions.ts";

const styles = stylex.create({
  changed: { borderColor: colorVars["--color-accent"] },
  joint: {
    alignItems: "center",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    inlineSize: spacingVars["--spacing-4"],
    justifyContent: "center",
    minBlockSize: spacingVars["--spacing-7"],
  },
  line: {
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    inlineSize: "100%",
  },
  square: {
    alignItems: "center",
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    display: "flex",
    justifyContent: "center",
    minBlockSize: spacingVars["--spacing-7"],
    minInlineSize: spacingVars["--spacing-7"],
  },
  strip: { alignItems: "center", display: "flex", outlineStyle: "none" },
});

/** One small square: a step's or a reviewer's agent mark, in the accent when it changed. */
function Square({
  isChanged,
  isPicked,
  isStop,
  label,
  onPress,
  pick,
  ref,
  stripe,
}: {
  isChanged: boolean;
  /** Drawn as the cursor's, while the strip has the focus. */
  isPicked: boolean;
  /** The strip's one tab stop, where the cursor is. */
  isStop: boolean;
  label: string;
  onPress: () => void;
  pick: SessionPick | undefined;
  ref: Ref<HTMLButtonElement>;
  stripe: string;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a step of the strip, its agent's mark in a small square with its session's stripe, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-label={label}
      onClick={onPress}
      ref={ref}
      tabIndex={isStop ? 0 : -1}
      type="button"
      {...stylex.props(
        bareButtonStyles.bare,
        styles.square,
        drawn.stripe(stripe),
        isChanged && styles.changed,
        isPicked && pickedStyles.picked,
      )}
    >
      {pick ? (
        <HarnessMark color={isChanged ? "accent" : "secondary"} kind={pick.runtime} />
      ) : (
        <Icon color="secondary" icon="uraeda:terminal" size="sm" />
      )}
    </button>
  );
}

/** A joint of the strip: the scissors where a clean session starts, else a line in its colour. */
function StripJoint({
  colour,
  isCut,
  isPicked,
  isStop,
  label,
  onPress,
  ref,
}: {
  colour: string;
  isCut: boolean;
  isPicked: boolean;
  isStop: boolean;
  label: string;
  onPress: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a joint of the strip, a glyph or a line between two squares pressed as one, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-label={label}
      aria-pressed={isCut}
      onClick={onPress}
      ref={ref}
      tabIndex={isStop ? 0 : -1}
      type="button"
      {...stylex.props(bareButtonStyles.bare, styles.joint, isPicked && pickedStyles.picked)}
    >
      {isCut ? (
        <Icon icon={Scissors} size="xsm" />
      ) : (
        <span {...stylex.props(styles.line, drawn.border(colour))} />
      )}
    </button>
  );
}

/** A place of the strip, in its order: a step's square, the joint before a step, or a reviewer. */
type Place =
  | { kind: "step"; step: StepId }
  | { index: number; kind: "joint" }
  | { index: number; kind: "reviewer" };

/** The strip's places: a feature's six steps and the joints between them, or a change's build and its reviewers. */
function placesOf(isChange: boolean, reviewers: number): Array<Place> {
  if (isChange) {
    return [
      { kind: "step", step: "build" },
      ...Array.from({ length: reviewers }, (_, index) => ({ index, kind: "reviewer" as const })),
    ];
  }
  return STEPS.flatMap((step, index): Array<Place> => [
    ...(index === 0 ? [] : [{ index, kind: "joint" as const }]),
    { kind: "step", step },
  ]);
}

/** What the picker edits: a step's pick, or an agent reviewer's. */
function pickAt(value: RunOptions, place: Place | undefined): SessionPick | undefined {
  if (place?.kind === "step") {
    return value.steps[place.step];
  }
  const reviewer = place?.kind === "reviewer" ? value.reviewers[place.index] : undefined;
  return reviewer?.kind === "agent" ? reviewer.pick : undefined;
}

/** `value` with the pick at `place` replaced by `pick`. */
function withPickAt(value: RunOptions, place: Place, pick: SessionPick): RunOptions {
  if (place.kind === "step") {
    return { ...value, steps: { ...value.steps, [place.step]: pick } };
  }
  return {
    ...value,
    reviewers: value.reviewers.map((reviewer, index) =>
      index === place.index && reviewer.kind === "agent" ? { ...reviewer, pick } : reviewer,
    ),
  };
}

/**
 * The strip's cursor and its keys: ← → (h l, while single keys are on) move it, the focus with it,
 * Enter and Space act on its place. `act` is what a tap does too.
 */
function useStripKeys({
  onChange,
  places,
  runtimes,
  setPicking,
  value,
}: {
  onChange: (value: RunOptions) => void;
  places: ReadonlyArray<Place>;
  runtimes: ReadonlyArray<PickerRuntime>;
  setPicking: (step: "model" | "effort" | undefined) => void;
  value: RunOptions;
}) {
  const [cursor, setCursor] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const singleKeys = useSingleKeys();
  const act = (at: number) => {
    const place = places[at];
    setCursor(at);
    if (place?.kind === "joint") {
      onChange(withCut(runtimes, value, place.index));
    } else if (pickAt(value, place) !== undefined) {
      setPicking("model");
    }
  };
  const onKey = (event: KeyboardEvent) => {
    const letters = singleKeys ? { h: -1, l: 1 } : {};
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ...letters } as Record<string, number>)[
      event.key
    ];
    if (step !== undefined) {
      const next = Math.max(0, Math.min(places.length - 1, cursor + step));
      setCursor(next);
      buttons.current[next]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      act(cursor);
    } else {
      return;
    }
    event.preventDefault();
  };
  const refAt = (at: number) => (button: HTMLButtonElement | null) => {
    buttons.current[at] = button;
  };
  return { act, cursor: Math.min(cursor, places.length - 1), onKey, refAt };
}

/** The strip of a feature, its six steps, or of a change (`isChange`), its one step and reviewers. */
export function RunStrip({
  defaults,
  isChange = false,
  onChange,
  runtimes,
  value,
}: {
  defaults: RunOptions;
  isChange?: boolean;
  onChange: (value: RunOptions) => void;
  runtimes: ReadonlyArray<PickerRuntime>;
  value: RunOptions;
}) {
  const [picking, setPicking] = useState<"model" | "effort">();
  // The cursor shows while the strip has the focus: elsewhere, it would read as a change.
  const [isFocused, setFocused] = useState(false);
  const places = placesOf(isChange, value.reviewers.length);
  const { act, cursor, onKey, refAt } = useStripKeys({
    onChange,
    places,
    runtimes,
    setPicking,
    value,
  });
  const spans = sessionSpans(runtimes, value);
  const sessionOf = (step: number) => spans.findIndex((span) => step <= span.last);
  const shown = isChange ? (["build"] as const) : STEPS;
  const words = differences(runtimes, value, defaults, shown);
  const place = places[cursor];
  const pick = pickAt(value, place);
  return (
    <HStack align="center" gap={3} wrap="wrap">
      <Text color="secondary">Runs</Text>
      <div
        aria-label="How each step runs"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocused(false);
          }
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={onKey}
        role="group"
        {...stylex.props(styles.strip)}
      >
        {places.map((each, at) => (
          <StripPlace
            act={() => act(at)}
            defaults={defaults}
            isPicked={isFocused && cursor === at}
            isStop={cursor === at}
            key={each.kind === "step" ? each.step : `${each.kind}-${each.index}`}
            place={each}
            refAt={refAt(at)}
            runtimes={runtimes}
            sessionOf={sessionOf}
            value={value}
          />
        ))}
      </div>
      <Text color={words === "defaults" ? "secondary" : "accent"} size="sm">
        {words}
      </Text>
      {pick && place && (
        <PickSteps
          onChange={(next) => onChange(withPickAt(value, place, next))}
          onStep={setPicking}
          pick={pick}
          runtimes={runtimes}
          step={picking}
        />
      )}
    </HStack>
  );
}

/** One place of the strip: a step's square, a joint, or a reviewer's square after a dot. */
function StripPlace({
  act,
  defaults,
  isPicked,
  isStop,
  place,
  refAt,
  runtimes,
  sessionOf,
  value,
}: {
  act: () => void;
  defaults: RunOptions;
  isPicked: boolean;
  isStop: boolean;
  place: Place;
  refAt: Ref<HTMLButtonElement>;
  runtimes: ReadonlyArray<PickerRuntime>;
  sessionOf: (step: number) => number;
  value: RunOptions;
}) {
  if (place.kind === "joint") {
    const after = STEPS[place.index]!;
    return (
      <StripJoint
        colour={sessionColour(sessionOf(place.index))}
        isCut={jointCuts(runtimes, value, place.index)}
        isPicked={isPicked}
        isStop={isStop}
        label={`${STEP_LOOKS[STEPS[place.index - 1]!].name} to ${STEP_LOOKS[after].name}`}
        onPress={act}
        ref={refAt}
      />
    );
  }
  if (place.kind === "reviewer") {
    const reviewer = value.reviewers[place.index]!;
    return (
      <>
        <span {...stylex.props(styles.joint)}>·</span>
        <Square
          isChanged={reviewerChanged(reviewer, defaults.reviewers[place.index])}
          isPicked={isPicked}
          isStop={isStop}
          label={
            reviewer.kind === "agent"
              ? `Reviewer ${place.index + 1}`
              : `Reviewer ${place.index + 1}: ${reviewer.command}`
          }
          onPress={act}
          pick={reviewer.kind === "agent" ? reviewer.pick : undefined}
          ref={refAt}
          stripe="var(--role-sub-agent)"
        />
      </>
    );
  }
  const changed = changes(value.steps[place.step], defaults.steps[place.step]);
  return (
    <Square
      isChanged={changed.agent || changed.model || changed.effort}
      isPicked={isPicked}
      isStop={isStop}
      label={STEP_LOOKS[place.step].name}
      onPress={act}
      pick={value.steps[place.step]}
      ref={refAt}
      stripe={sessionColour(sessionOf(STEPS.indexOf(place.step)))}
    />
  );
}
