// The run map's parts: a step's tile, the joint between two steps, the effort's meter, a reviewer's
// chip, and the colours of the sessions. A tile and a chip are buttons, so a tap picks them as the
// keys do; what differs from the defaults is in the accent, what the defaults give dimmed.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  spacingVars,
  typographyVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { HarnessMark } from "../HarnessMark.tsx";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { pickedStyles } from "../layout/picked.ts";
import type { PickerRuntime, SessionPick } from "../SessionPicker.tsx";
import type { Gate } from "./featureStages.ts";
import { Lock, Scissors } from "./glyphs.tsx";
import { runVars } from "./runVars.stylex.ts";
import { GateMark } from "./StageDetail.tsx";
import { changes, METER, resolved, type Reviewer } from "./runOptions.ts";

/** Each session's colour, in turn: a role apart from the accent, which marks a change. */
export const SESSION_COLOURS = [
  "var(--role-link)",
  "var(--role-added)",
  "var(--role-caution)",
  "var(--role-context)",
];

export const sessionColour = (index: number) => SESSION_COLOURS[index % SESSION_COLOURS.length]!;

/** The styles a session's colour or a place sets, drawn per element. */
export const drawn = stylex.create({
  // A session's bar along a step's start, on the phone.
  bar: (colour: string) => ({
    boxShadow: `inset 2px 0 0 0 ${colour}`,
    paddingInlineStart: spacingVars["--spacing-1"],
  }),
  border: (colour: string) => ({ borderColor: colour }),
  colour: (colour: string) => ({ color: colour }),
  place: (column: string, row: string) => ({ gridColumn: column, gridRow: row }),
  // The stripe at a tile's top, in its session's colour: which steps share a session, at a glance.
  stripe: (colour: string) => ({ boxShadow: `inset 0 2px 0 0 ${colour}` }),
});

export const partStyles = stylex.create({
  cell: {
    blockSize: spacingVars["--spacing-2"],
    borderColor: "currentColor",
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    inlineSize: spacingVars["--spacing-1-5"],
  },
  // A step done reads second, but stays readable: its files are links the human follows.
  dim: { opacity: 0.7 },
  filled: { backgroundColor: "currentColor" },
  joint: {
    alignItems: "center",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    justifyContent: "center",
    minBlockSize: spacingVars["--spacing-6"],
    minInlineSize: spacingVars["--spacing-6"],
    position: "relative",
  },
  // In a row, the joint stands as tall as a tile's pick, so its line and its scissors sit on the
  // axis of the tiles' faces, however much a feature's page puts under them.
  jointAcross: { alignSelf: "start", blockSize: runVars.faceHeight },
  // On the phone, the line runs down the column, on the same axis as the scissors: the middle.
  lineDown: {
    blockSize: spacingVars["--spacing-4"],
    borderBlockStartWidth: 0,
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    inlineSize: 0,
  },
  // A gate's mark, under the joint's axis in a row, before it in a column, so the scissors and the
  // line keep the middle.
  gateAcross: {
    insetBlockEnd: 0,
    insetInlineStart: "50%",
    position: "absolute",
    transform: "translateX(-50%)",
  },
  gateDown: {
    insetBlockStart: "50%",
    insetInlineEnd: "100%",
    marginInlineEnd: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
  },
  lockDown: {
    insetBlockStart: "50%",
    insetInlineStart: "100%",
    position: "absolute",
    transform: "translateY(-50%)",
  },
  // The line of a joint inside one session, in that session's colour.
  code: { fontFamily: typographyVars["--font-family-code"] },
  ellipsis: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  head: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    minInlineSize: 0,
  },
  line: {
    blockSize: 0,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    inlineSize: "100%",
  },
  lock: { insetBlockStart: 0, insetInlineEnd: spacingVars["--spacing-0-5"], position: "absolute" },
  meter: { alignItems: "center", display: "flex", gap: spacingVars["--spacing-0-5"] },
  tile: {
    alignItems: "stretch",
    backgroundColor: colorVars["--color-background-surface"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    inlineSize: "100%",
    minInlineSize: 0,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
    textAlign: "start",
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "150ms" },
    transitionProperty: "opacity, background-color, box-shadow",
  },
});

/** The effort as five cells, filled up to its level; Ultra fills them all, its frame doubled. */
export function Meter({
  effort,
  tone,
}: {
  effort: string | undefined;
  tone: "accent" | "dim" | "text";
}) {
  const level =
    effort === "ultra" ? METER.length : METER.indexOf(effort as (typeof METER)[number]) + 1;
  const colour = {
    accent: colorVars["--color-accent"],
    dim: colorVars["--color-text-secondary"],
    text: colorVars["--color-text-primary"],
  }[tone];
  return (
    <span
      aria-label={effort === undefined ? "No effort" : `Effort ${effort}`}
      role="img"
      {...stylex.props(partStyles.meter, drawn.colour(colour))}
    >
      {METER.map((each, index) => (
        <span key={each} {...stylex.props(partStyles.cell, index < level && partStyles.filled)} />
      ))}
    </span>
  );
}

/** A pick's agent mark and model name, then its meter: the accent where it differs from `fallback`. */
export function PickFace({
  fallback,
  pick,
  runtimes,
}: {
  fallback: SessionPick;
  pick: SessionPick;
  runtimes: ReadonlyArray<PickerRuntime>;
}) {
  const run = resolved(runtimes, pick);
  const changed = changes(pick, fallback);
  const isDefault = pick.model === undefined;
  return (
    <>
      <span {...stylex.props(partStyles.head)}>
        <HarnessMark color={changed.agent ? "accent" : "secondary"} kind={pick.runtime} />
        <Text
          color={changed.model ? "accent" : isDefault ? "secondary" : "primary"}
          size="sm"
          xstyle={partStyles.ellipsis}
        >
          {run.modelName ?? "Default"}
        </Text>
      </span>
      {run.effort !== undefined && (
        <Meter
          effort={run.effort}
          tone={changed.effort ? "accent" : pick.effort === undefined ? "dim" : "text"}
        />
      )}
    </>
  );
}

/** A tile: a button with its head line and what it holds, picked by the keys or a tap. */
export function Tile({
  children,
  colour,
  head,
  isDone = false,
  isPicked,
  label,
  onPress,
  pos,
}: {
  children: ReactNode;
  colour: string;
  head: ReactNode;
  isDone?: boolean;
  isPicked: boolean;
  label: string;
  onPress: () => void;
  pos: string;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a tile of the run map, a whole card pressed as one, its stripe and picked tint its own, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-label={label}
      data-pos={pos}
      onClick={onPress}
      tabIndex={isPicked ? 0 : -1}
      type="button"
      {...stylex.props(
        bareButtonStyles.bare,
        partStyles.tile,
        drawn.stripe(colour),
        isDone && partStyles.dim,
        isPicked && pickedStyles.picked,
      )}
    >
      <span {...stylex.props(partStyles.head)}>{head}</span>
      {children}
    </button>
  );
}

/**
 * The joint between two steps: a line in the session's colour when they share one, the scissors
 * when the next starts a clean session, locked when the two steps' models force it.
 */
export function Joint({
  colour,
  gate,
  isCut,
  isDown = false,
  isForced,
  isPicked,
  label,
  onPress,
  pos,
}: {
  colour: string;
  /** Where the workflow waits for the human, on a feature's page. */
  gate?: Gate | undefined;
  isCut: boolean;
  /** On the phone: the joint's line runs down the column. */
  isDown?: boolean;
  isForced: boolean;
  isPicked: boolean;
  label: string;
  onPress: () => void;
  pos: string;
}) {
  // A switch, cut or joined, so that Space is its own, as a switch's is, and not the leader's.
  return (
    // oxlint-disable-next-line react/forbid-elements -- a joint of the run map, a glyph or a line between two tiles pressed as one, which Astryx's Button does not draw (an Astryx gap)
    <button
      aria-checked={isCut}
      aria-disabled={isForced}
      aria-label={label}
      data-pos={pos}
      onClick={isForced ? undefined : onPress}
      role="switch"
      tabIndex={isPicked ? 0 : -1}
      type="button"
      {...stylex.props(
        bareButtonStyles.bare,
        partStyles.joint,
        !isDown && partStyles.jointAcross,
        isPicked && pickedStyles.picked,
      )}
    >
      {isCut ? (
        <>
          <Icon color={isForced ? "secondary" : "primary"} icon={Scissors} size="sm" />
          {isForced && (
            <span {...stylex.props(isDown ? partStyles.lockDown : partStyles.lock)}>
              <Icon color="secondary" icon={Lock} size="xsm" />
            </span>
          )}
        </>
      ) : (
        <span
          {...stylex.props(partStyles.line, isDown && partStyles.lineDown, drawn.border(colour))}
        />
      )}
      {gate && (
        <span {...stylex.props(isDown ? partStyles.gateDown : partStyles.gateAcross)}>
          <GateMark gate={gate} />
        </span>
      )}
    </button>
  );
}

/** A reviewer's face: an agent's mark, model, and meter, marked when it runs the agent's own review. */
export function ReviewerFace({
  fallback,
  reviewer,
  runtimes,
}: {
  fallback: SessionPick;
  reviewer: Reviewer;
  runtimes: ReadonlyArray<PickerRuntime>;
}) {
  if (reviewer.kind === "command") {
    return (
      <span {...stylex.props(partStyles.head)}>
        <Icon color="secondary" icon="uraeda:terminal" size="sm" />
        <Text size="sm" xstyle={[partStyles.code, partStyles.ellipsis]}>
          {reviewer.command}
        </Text>
      </span>
    );
  }
  return (
    <span {...stylex.props(partStyles.head)}>
      <PickFace fallback={fallback} pick={reviewer.pick} runtimes={runtimes} />
      {reviewer.ownReview && (
        <Icon
          color="secondary"
          icon="uraeda:badge-check"
          label="Runs the agent's own review"
          size="sm"
        />
      )}
    </span>
  );
}
