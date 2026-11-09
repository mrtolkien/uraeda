// The run map in one line, for a start dialog: "Runs", each step's agent mark in a small square,
// the scissors where a clean session starts, then what differs from the defaults in a few words. Tab
// reaches it; ← → (h l) move along the steps, Enter opens the key picker on the step selected, and
// Enter or Space on a joint cuts or joins it, as on the map. A change runs one step: its strip holds
// that step and its reviewers.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Fragment, type KeyboardEvent, useState } from "react";
import { HarnessMark } from "../HarnessMark.tsx";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { pickedStyles } from "../layout/picked.ts";
import { PickSteps, type PickerRuntime, type SessionPick } from "../SessionPicker.tsx";
import { Scissors } from "./glyphs.tsx";
import { drawn, sessionColour } from "./parts.tsx";
import {
  changes,
  differences,
  jointCuts,
  type Reviewer,
  type RunOptions,
  sessionSpans,
  withCut,
  STEP_LOOKS,
  STEPS,
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
  label,
  onPress,
  pick,
  stripe,
}: {
  isChanged: boolean;
  isPicked: boolean;
  label: string;
  onPress: () => void;
  pick: SessionPick | undefined;
  stripe: string;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a step of the strip, its agent's mark in a small square with its session's stripe, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-label={label}
      onClick={onPress}
      tabIndex={isPicked ? 0 : -1}
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
  label,
  onPress,
}: {
  colour: string;
  isCut: boolean;
  isPicked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a joint of the strip, a glyph or a line between two squares pressed as one, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-label={label}
      aria-pressed={isCut}
      onClick={onPress}
      tabIndex={-1}
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

/** A change's reviewers after its one step, each a square. */
function ChangeReviewers({
  cursor,
  onPick,
  reviewers,
}: {
  cursor: number;
  onPick: (cursor: number) => void;
  reviewers: ReadonlyArray<Reviewer>;
}) {
  return reviewers.map((reviewer, index) => (
    <Fragment key={index}>
      <span {...stylex.props(styles.joint)}>·</span>
      <Square
        isChanged={false}
        isPicked={cursor === index * 2 + 2}
        label={`Reviewer ${index + 1}`}
        onPress={() => onPick(index * 2 + 2)}
        pick={reviewer.kind === "agent" ? reviewer.pick : undefined}
        stripe="var(--role-sub-agent)"
      />
    </Fragment>
  ));
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
  const [cursor, setCursor] = useState(0);
  const [picking, setPicking] = useState<"model" | "effort">();
  const shown = isChange ? (["build"] as const) : STEPS;
  const spans = sessionSpans(runtimes, value);
  const sessionOf = (step: number) => spans.findIndex((span) => step <= span.last);
  const last = isChange ? value.reviewers.length * 2 : (STEPS.length - 1) * 2;
  const onKey = (event: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, h: -1, l: 1 }[event.key];
    if (step !== undefined) {
      setCursor(Math.max(0, Math.min(last, cursor + step)));
    } else if (event.key === "Enter" || event.key === " ") {
      if (cursor % 2 === 1 && !isChange) {
        onChange(withCut(value, (cursor + 1) / 2));
      } else {
        setPicking("model");
      }
    } else {
      return;
    }
    event.preventDefault();
  };
  const stepAtCursor = isChange ? 3 : Math.floor(cursor / 2);
  const words = differences(runtimes, value, defaults, shown);
  return (
    <HStack align="center" gap={3} wrap="wrap">
      <Text color="secondary">Runs</Text>
      <div
        aria-label="How each step runs"
        onKeyDown={onKey}
        role="group"
        {...stylex.props(styles.strip)}
      >
        {shown.map((id, index) => {
          const step = STEPS.indexOf(id);
          const pick = value.steps[id];
          const changed = changes(pick, defaults.steps[id]);
          return (
            <Fragment key={id}>
              {index > 0 && (
                <StripJoint
                  colour={sessionColour(sessionOf(step))}
                  isCut={jointCuts(runtimes, value, step)}
                  isPicked={cursor === index * 2 - 1}
                  label={`${STEP_LOOKS[STEPS[step - 1]!].name} to ${STEP_LOOKS[id].name}`}
                  onPress={() => onChange(withCut(value, step))}
                />
              )}
              <Square
                isChanged={changed.agent || changed.model || changed.effort}
                isPicked={cursor === index * 2}
                label={STEP_LOOKS[id].name}
                onPress={() => {
                  setCursor(index * 2);
                  setPicking("model");
                }}
                pick={pick}
                stripe={sessionColour(sessionOf(step))}
              />
            </Fragment>
          );
        })}
        {isChange && (
          <ChangeReviewers cursor={cursor} onPick={setCursor} reviewers={value.reviewers} />
        )}
      </div>
      <Text color={words === "defaults" ? "secondary" : "accent"} size="sm">
        {words}
      </Text>
      <PickSteps
        onChange={(pick) =>
          onChange({ ...value, steps: { ...value.steps, [STEPS[stepAtCursor]!]: pick } })
        }
        onStep={setPicking}
        pick={value.steps[STEPS[stepAtCursor]!]}
        runtimes={runtimes}
        step={picking}
      />
    </HStack>
  );
}
