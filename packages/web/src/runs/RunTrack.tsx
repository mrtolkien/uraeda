// The run map drawn: the six steps in a row, their joints between them, the sessions as bands
// under the steps they span, and under the track the build's implementers and the reviewers, with
// where reviews happen. On the phone the track stands as a column: a session is the bar along its
// steps, and a cut a rule across the column with its scissors.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Fragment } from "react";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { pickedStyles } from "../layout/picked.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { PickerRuntime } from "../SessionPicker.tsx";
import { belowItems, type Pos, posKey } from "./runCursor.ts";
import { drawn, Joint, partStyles, PickFace, ReviewerFace, sessionColour, Tile } from "./parts.tsx";
import {
  isForced,
  jointCuts,
  type RunOptions,
  sessionSpans,
  STEP_LOOKS,
  STEPS,
} from "./runOptions.ts";

const styles = stylex.create({
  band: {
    blockSize: spacingVars["--spacing-1-5"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
    borderInlineStyle: "solid",
    borderInlineWidth: borderVars["--border-width"],
  },
  bandLabel: { textAlign: "center" },
  column: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-1"] },
  depth: { display: "flex", gap: spacingVars["--spacing-1"] },
  depthButton: {
    alignItems: "center",
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    display: "flex",
    gap: spacingVars["--spacing-1"],
    minBlockSize: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // The 1 px line from a step down to what runs under it.
  drop: {
    blockSize: spacingVars["--spacing-3"],
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    marginInlineStart: "50%",
  },
  grid: {
    columnGap: 0,
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(88px, 1fr) minmax(28px, 40px)) minmax(88px, 1fr)",
    rowGap: spacingVars["--spacing-1"],
  },
  nested: { paddingInlineStart: spacingVars["--spacing-5"] },
  on: { borderColor: colorVars["--color-accent"], color: colorVars["--color-accent"] },
  // The reviewers' line down from the review, over its tile's middle.
  dropNarrow: { marginInlineStart: "16%" },
  rule: {
    alignItems: "center",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    gap: spacingVars["--spacing-2"],
  },
  ruleLine: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    flexGrow: 1,
  },
});

/** What the track draws, and what a press on one of its places does. */
export type TrackProps = {
  /** The step at work, on a feature's page: the steps before it are done. */
  current?: number | undefined;
  defaults: RunOptions;
  onPress: (pos: Pos) => void;
  pos: Pos | undefined;
  runtimes: ReadonlyArray<PickerRuntime>;
  value: RunOptions;
};

/** The session each step runs in, by its index. */
function sessionOf(props: TrackProps): Array<number> {
  return sessionSpans(props.runtimes, props.value).flatMap((span, session) =>
    Array.from({ length: span.last - span.first + 1 }, () => session),
  );
}

function StepTile({ props, step }: { props: TrackProps; step: number }) {
  const id = STEPS[step]!;
  const look = STEP_LOOKS[id];
  const pos: Pos = { index: step * 2, row: "track" };
  const isCurrent = props.current === step;
  return (
    <Tile
      colour={sessionColour(sessionOf(props)[step]!)}
      head={
        <>
          <Icon
            color={isCurrent ? "accent" : "secondary"}
            icon={isCurrent ? "uraeda:play" : look.icon}
            size="sm"
          />
          <Text size="sm" weight="bold">
            {look.name}
          </Text>
        </>
      }
      isDone={props.current !== undefined && step < props.current}
      isPicked={props.pos !== undefined && posKey(props.pos) === posKey(pos)}
      label={look.name}
      onPress={() => props.onPress(pos)}
      pos={posKey(pos)}
    >
      <PickFace
        fallback={props.defaults.steps[id]}
        pick={props.value.steps[id]}
        runtimes={props.runtimes}
      />
    </Tile>
  );
}

function StepJoint({
  isDown = false,
  props,
  step,
}: {
  isDown?: boolean;
  props: TrackProps;
  step: number;
}) {
  const pos: Pos = { index: step * 2 - 1, row: "track" };
  const isCut = jointCuts(props.runtimes, props.value, step);
  const forced = isForced(props.runtimes, props.value, step);
  const names = `${STEP_LOOKS[STEPS[step - 1]!].name} to ${STEP_LOOKS[STEPS[step]!].name}`;
  return (
    <Joint
      colour={sessionColour(sessionOf(props)[step]!)}
      isCut={isCut}
      isDown={isDown}
      isForced={forced}
      isPicked={props.pos !== undefined && posKey(props.pos) === posKey(pos)}
      label={`${names}: ${isCut ? "a clean session" : "the same session"}${forced ? ", as the models differ" : ""}`}
      onPress={() => props.onPress(pos)}
      pos={posKey(pos)}
    />
  );
}

/** The row under the track's places: the implementers, each reviewer, the one to add, the depth. */
function BelowPlace({ index, props }: { index: number; props: TrackProps }) {
  const item = belowItems(props.value.reviewers.length)[index]!;
  const pos: Pos = { index, row: "below" };
  const isPicked = props.pos !== undefined && posKey(props.pos) === posKey(pos);
  const press = () => props.onPress(pos);
  if (item === "implementers") {
    return (
      <Tile
        colour="var(--role-sub-agent)"
        head={
          <>
            <Icon color="secondary" icon="uraeda:users" size="sm" />
            <Text size="sm" weight="bold">
              Implementers
            </Text>
          </>
        }
        isPicked={isPicked}
        label="Implementers"
        onPress={press}
        pos={posKey(pos)}
      >
        <PickFace
          fallback={props.defaults.implementers}
          pick={props.value.implementers}
          runtimes={props.runtimes}
        />
      </Tile>
    );
  }
  if (item === "add") {
    return (
      <Tile
        colour="transparent"
        head={
          <>
            <Icon color="secondary" icon="uraeda:plus" size="sm" />
            <Text color="secondary" size="sm">
              Reviewer
            </Text>
          </>
        }
        isPicked={isPicked}
        label="Add a reviewer"
        onPress={press}
        pos={posKey(pos)}
      >
        {null}
      </Tile>
    );
  }
  if (item === "depth") {
    const waves = props.value.depth === "waves";
    return (
      // oxlint-disable-next-line react/forbid-elements -- where reviews happen, two framed choices pressed as one toggle, as the keys do, which Astryx's SegmentedControl does not draw with icons alone (an Astryx gap)
      <button
        aria-label={
          waves ? "Reviews after each wave and on the branch" : "Reviews on the branch only"
        }
        data-pos={posKey(pos)}
        onClick={press}
        tabIndex={isPicked ? 0 : -1}
        type="button"
        {...stylex.props(bareButtonStyles.bare, styles.depth, isPicked && pickedStyles.picked)}
      >
        <span {...stylex.props(styles.depthButton, waves && styles.on)}>
          <Icon icon="uraeda:layers" size="sm" />
          <Text color="inherit" size="sm">
            Waves
          </Text>
        </span>
        <span {...stylex.props(styles.depthButton, !waves && styles.on)}>
          <Icon icon="uraeda:git-branch" size="sm" />
          <Text color="inherit" size="sm">
            Branch
          </Text>
        </span>
      </button>
    );
  }
  const reviewer = props.value.reviewers[item.reviewer]!;
  const fallback = props.defaults.steps.review;
  return (
    <Tile
      colour="transparent"
      head={<ReviewerFace fallback={fallback} reviewer={reviewer} runtimes={props.runtimes} />}
      isPicked={isPicked}
      label={`Reviewer ${item.reviewer + 1}`}
      onPress={press}
      pos={posKey(pos)}
    >
      {null}
    </Tile>
  );
}

/** The bands under the track: one per session, under the steps it spans, numbered. */
function Bands({ props }: { props: TrackProps }) {
  return sessionSpans(props.runtimes, props.value).map((span, session) => (
    <div
      key={span.first}
      {...stylex.props(drawn.place(`${span.first * 2 + 1} / ${span.last * 2 + 2}`, "2"))}
    >
      <div {...stylex.props(styles.band, drawn.border(sessionColour(session)))} />
      <div {...stylex.props(styles.bandLabel, drawn.colour(sessionColour(session)))}>
        <Text color="inherit" size="xsm">{`Session ${session + 1}`}</Text>
      </div>
    </div>
  ));
}

/** The track on wide and semi-wide screens: a row of steps, the bands, and the row under it. */
function TrackRow({ props }: { props: TrackProps }) {
  const below = belowItems(props.value.reviewers.length);
  return (
    <div {...stylex.props(styles.grid)}>
      {STEPS.map((_, step) => (
        <Fragment key={step}>
          {step > 0 && <StepJoint props={props} step={step} />}
          <StepTile props={props} step={step} />
        </Fragment>
      ))}
      <Bands props={props} />
      <div {...stylex.props(drawn.place("7", "3"))}>
        <div {...stylex.props(styles.drop)} />
        <BelowPlace index={0} props={props} />
      </div>
      <div {...stylex.props(styles.column, drawn.place("9 / 12", "3"))}>
        <div {...stylex.props(styles.drop, styles.dropNarrow)} />
        {below.slice(1).map((_, index) => (
          <BelowPlace index={index + 1} key={index} props={props} />
        ))}
      </div>
    </div>
  );
}

/** The track on the phone: a column of steps, each session a bar along its steps. */
function TrackColumn({ props }: { props: TrackProps }) {
  const sessions = sessionOf(props);
  const below = belowItems(props.value.reviewers.length);
  return (
    <div {...stylex.props(styles.column)}>
      {STEPS.map((id, step) => (
        <Fragment key={id}>
          {step > 0 && (
            <div {...stylex.props(styles.rule)}>
              {jointCuts(props.runtimes, props.value, step) && (
                <span {...stylex.props(styles.ruleLine)} />
              )}
              <StepJoint isDown props={props} step={step} />
              {jointCuts(props.runtimes, props.value, step) && (
                <span {...stylex.props(styles.ruleLine)} />
              )}
            </div>
          )}
          <div {...stylex.props(drawn.bar(sessionColour(sessions[step]!)))}>
            <StepTile props={props} step={step} />
          </div>
          {id === "build" && (
            <div {...stylex.props(styles.nested)}>
              <BelowPlace index={0} props={props} />
            </div>
          )}
          {id === "review" && (
            <div {...stylex.props(styles.nested, styles.column)}>
              {below.slice(1).map((_, index) => (
                <BelowPlace index={index + 1} key={index} props={props} />
              ))}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** The track, as the width draws it. */
export function RunTrack(props: TrackProps) {
  return isNarrow(useWidthClass()) ? <TrackColumn props={props} /> : <TrackRow props={props} />;
}

// Shared with the strip, which draws the same tiles small.
export { partStyles };
