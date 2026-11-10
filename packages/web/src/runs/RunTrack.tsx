// The run map drawn: the six steps in a row, their joints between them, the sessions as bands
// under the steps they span, and under the track the build's implementers and the reviewers, with
// where reviews happen. On the phone the track stands as a column: a session is the bar along its
// steps, a joint its line down the column's middle, and a cut a rule across it with its scissors on
// the same axis. On a feature's page, the proposal and the merge close the track at its two ends,
// each step shows its time and files under its pick, and the gates mark the joints.
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
import { type FeatureStages, type Gate, isOpen } from "./featureStages.ts";
import { drawn, Joint, partStyles, PickFace, ReviewerFace, sessionColour, Tile } from "./parts.tsx";
import {
  isForced,
  jointCuts,
  type RunOptions,
  sessionSpans,
  STEP_LOOKS,
  type StepId,
  STEPS,
} from "./runOptions.ts";
import { GateMark, MapEnd, StageDetail } from "./StageDetail.tsx";

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
  endLinkDown: {
    alignSelf: "center",
    blockSize: spacingVars["--spacing-4"],
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    position: "relative",
  },
  grid: { columnGap: 0, display: "grid", rowGap: spacingVars["--spacing-1"] },
  nested: { paddingInlineStart: spacingVars["--spacing-5"] },
  on: { borderColor: colorVars["--color-accent"], color: colorVars["--color-accent"] },
  // The reviewers' line down from the review, over its tile's middle.
  columns: (template: string) => ({ gridTemplateColumns: template }),
  dropNarrow: { marginInlineStart: "16%" },
  rule: {
    alignItems: "center",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    gap: spacingVars["--spacing-2"],
    justifyContent: "center",
  },
  ruleLine: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    flexGrow: 1,
  },
  ruleRoom: { marginInline: spacingVars["--spacing-5"] },
});

/** What the track draws, and what a press on one of its places does. */
export type TrackProps = {
  defaults: RunOptions;
  onPress: (pos: Pos) => void;
  pos: Pos | undefined;
  runtimes: ReadonlyArray<PickerRuntime>;
  /** A feature's history, on its page: its steps' times and files, its ends, and its gates. */
  stages?: FeatureStages | undefined;
  value: RunOptions;
};

/** The steps the track shows: a change's own, else all six. */
const shownOf = (props: TrackProps): ReadonlyArray<StepId> => props.stages?.shown ?? STEPS;

/** The session each step runs in, by its index. */
function sessionOf(props: TrackProps): Array<number> {
  return sessionSpans(props.runtimes, props.value).flatMap((span, session) =>
    Array.from({ length: span.last - span.first + 1 }, () => session),
  );
}

/** A step's name: a change's build is its fix. */
function nameOf(props: TrackProps, id: StepId): string {
  return props.stages?.isChange && id === "build" ? "Fix" : STEP_LOOKS[id].name;
}

function StepTile({ props, step }: { props: TrackProps; step: number }) {
  const id = STEPS[step]!;
  const look = STEP_LOOKS[id];
  const pos: Pos = { index: step * 2, row: "track" };
  const part = props.stages?.steps[id];
  const isCurrent = part?.state === "current";
  const name = nameOf(props, id);
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
          <Text color={isCurrent ? "accent" : "primary"} size="sm" weight="bold">
            {name}
          </Text>
        </>
      }
      isDone={part?.state === "done"}
      isPicked={props.pos !== undefined && posKey(props.pos) === posKey(pos)}
      label={
        isOpen(props.stages, id)
          ? name
          : `${name}, ${part?.state === "current" ? "at work" : "done"}`
      }
      onPress={() => props.onPress(pos)}
      pos={posKey(pos)}
    >
      <PickFace
        fallback={props.defaults.steps[id]}
        pick={props.value.steps[id]}
        runtimes={props.runtimes}
      />
      <StageDetail part={part} />
    </Tile>
  );
}

/**
 * Whether the joint before `step` cuts, and whether it is forced, over the steps a change hides
 * between it and the shown step before it: any cut among them is this joint's.
 */
function cutBefore(props: TrackProps, step: number): { forced: boolean; isCut: boolean } {
  const shown = shownOf(props);
  const before = STEPS.indexOf(shown[shown.indexOf(STEPS[step]!) - 1]!);
  const joints = Array.from({ length: step - before }, (_, index) => before + 1 + index);
  return {
    forced: joints.some((each) => isForced(props.runtimes, props.value, each)),
    isCut: joints.some((each) => jointCuts(props.runtimes, props.value, each)),
  };
}

/** The joint before `step`, after the shown step before it. */
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
  const shown = shownOf(props);
  const before = shown[shown.indexOf(STEPS[step]!) - 1]!;
  const { forced, isCut } = cutBefore(props, step);
  const names = `${nameOf(props, before)} to ${nameOf(props, STEPS[step]!)}`;
  const gate = props.stages?.gates[step];
  return (
    <Joint
      colour={sessionColour(sessionOf(props)[step]!)}
      gate={gate}
      isCut={isCut}
      isDown={isDown}
      isForced={forced}
      isPicked={props.pos !== undefined && posKey(props.pos) === posKey(pos)}
      label={`${names}: ${isCut ? "a clean session" : "the same session"}${forced ? ", as the models differ" : ""}${gate === "waiting" ? ", waiting for you" : gate ? ", your turn" : ""}`}
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
  // A step started, or a feature merged: its implementers or reviewers only read.
  const isDone = !isOpen(props.stages, item === "implementers" ? "build" : "review");
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
        isDone={isDone}
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
        isDone={isDone}
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
      isDone={isDone}
      isPicked={isPicked}
      label={`Reviewer ${item.reviewer + 1}`}
      onPress={press}
      pos={posKey(pos)}
    >
      {null}
    </Tile>
  );
}

/** The bands under the track: one per session, under the shown steps it spans, numbered. */
function Bands({ column, props }: { column: (step: number) => number; props: TrackProps }) {
  const shown = shownOf(props).map((id) => STEPS.indexOf(id));
  return sessionSpans(props.runtimes, props.value).flatMap((span, session) => {
    const steps = shown.filter((step) => step >= span.first && step <= span.last);
    if (steps.length === 0) {
      return [];
    }
    const from = column(steps[0]!);
    const to = column(steps.at(-1)!) + 1;
    return [
      <div key={span.first} {...stylex.props(drawn.place(`${from} / ${to}`, "2"))}>
        <div {...stylex.props(styles.band, drawn.border(sessionColour(session)))} />
        <div {...stylex.props(styles.bandLabel, drawn.colour(sessionColour(session)))}>
          <Text color="inherit" size="xsm">{`Session ${session + 1}`}</Text>
        </div>
      </div>,
    ];
  });
}

/** The line from an end of a feature's map to its first or last step, down the column's middle. */
function EndLink({ gate }: { gate?: Gate | undefined }) {
  return (
    <span {...stylex.props(styles.endLinkDown)}>
      {gate && (
        <span {...stylex.props(partStyles.gateDown)}>
          <GateMark gate={gate} />
        </span>
      )}
    </span>
  );
}

/** The track on wide and semi-wide screens: a row of steps, the bands, and the row under it. */
function TrackRow({ props }: { props: TrackProps }) {
  const below = belowItems(props.value.reviewers.length);
  const shown = shownOf(props);
  const column = (step: number) => shown.indexOf(STEPS[step]!) * 2 + 1;
  const template = `repeat(${shown.length - 1}, minmax(88px, 1fr) minmax(28px, 40px)) minmax(88px, 1fr)`;
  return (
    <div {...stylex.props(styles.grid, styles.columns(template))}>
      {shown.map((id, index) => {
        const step = STEPS.indexOf(id);
        return (
          <Fragment key={id}>
            {index > 0 && <StepJoint props={props} step={step} />}
            <StepTile props={props} step={step} />
          </Fragment>
        );
      })}
      <Bands column={column} props={props} />
      <div {...stylex.props(drawn.place(`${column(STEPS.indexOf("build"))}`, "3"))}>
        <div {...stylex.props(styles.drop)} />
        <BelowPlace index={0} props={props} />
      </div>
      <div
        {...stylex.props(
          styles.column,
          drawn.place(`${column(STEPS.indexOf("review"))} / ${shown.length * 2}`, "3"),
        )}
      >
        <div {...stylex.props(styles.drop, styles.dropNarrow)} />
        {below.slice(1).map((_, index) => (
          <BelowPlace index={index + 1} key={index} props={props} />
        ))}
      </div>
    </div>
  );
}

/** A joint on the phone: a line down the column's middle, or a rule across it with its scissors. */
function JointDown({ props, step }: { props: TrackProps; step: number }) {
  const { forced, isCut } = cutBefore(props, step);
  // Room either side of the scissors for the lock and the gate, so the scissors keep the middle.
  const hasMarks = forced || props.stages?.gates[step];
  return (
    <div {...stylex.props(styles.rule)}>
      {isCut && <span {...stylex.props(styles.ruleLine)} />}
      <span {...stylex.props(hasMarks && styles.ruleRoom)}>
        <StepJoint isDown props={props} step={step} />
      </span>
      {isCut && <span {...stylex.props(styles.ruleLine)} />}
    </div>
  );
}

/** The track on the phone: a column of steps, each session a bar along its steps. */
function TrackColumn({ props }: { props: TrackProps }) {
  const sessions = sessionOf(props);
  const below = belowItems(props.value.reviewers.length);
  const stages = props.stages;
  return (
    <div {...stylex.props(styles.column)}>
      {stages && (
        <>
          <MapEnd kind="proposal" part={stages.ends.proposal} />
          <EndLink />
        </>
      )}
      {shownOf(props).map((id, index) => {
        const step = STEPS.indexOf(id);
        return (
          <Fragment key={id}>
            {index > 0 && <JointDown props={props} step={step} />}
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
        );
      })}
      {stages && (
        <>
          <EndLink gate={stages.endGate} />
          <MapEnd kind="merged" part={stages.ends.merged} />
        </>
      )}
    </div>
  );
}

/**
 * The track, as the width draws it: a row on wide screens, a column on the phone, and on a
 * feature's page at every width, where each step holds its history.
 */
export function RunTrack(props: TrackProps) {
  const isColumn = isNarrow(useWidthClass()) || props.stages !== undefined;
  return isColumn ? <TrackColumn props={props} /> : <TrackRow props={props} />;
}

// Shared with the strip, which draws the same tiles small.
export { partStyles };
