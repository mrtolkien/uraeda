// The run map (spec of Run options): how each step of a feature runs, as a diagram the keys and
// the pointer both drive. ← → (h l) move along the steps and the joints between them, ↓ ↑ (j k) go
// to the build's implementers and the reviewers under the track and back. Enter on a step, the
// implementers, or a reviewer opens the app's key picker, the agent and model, then the effort;
// Enter or Space on a joint cuts it, starting a clean session there, or joins it; `r` puts the
// selection back to the default; `a` adds a reviewer and `d` removes the one selected. The hints
// under the map say the keys of what is selected. The settings' Runs section draws it on the
// defaults, a feature's page on the feature's own options, with its history in place of the
// timeline: there a step that started, and every joint before it, keeps what it ran on, and a
// merged feature's map only reads.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { PickSteps, type PickerRuntime, type SessionPick } from "../SessionPicker.tsx";
import {
  type Below,
  belowItems,
  moved,
  type Pos,
  posKey,
  stepAfterJoint,
  stepAt,
} from "./runCursor.ts";
import { type FeatureStages, isOpen } from "./featureStages.ts";
import { type RunOptions, STEPS, withCut } from "./runOptions.ts";
import { RunTrack } from "./RunTrack.tsx";

const styles = stylex.create({
  hints: {
    columnGap: spacingVars["--spacing-4"],
    minBlockSize: spacingVars["--spacing-6"],
    rowGap: spacingVars["--spacing-1"],
  },
  map: { outlineStyle: "none" },
});

/** What the picker changes: a step's pick, the implementers', or a reviewer's. */
type Target = { step: number } | "implementers" | { reviewer: number };

/** The pick a target holds. */
function pickOf(value: RunOptions, target: Target): SessionPick {
  if (target === "implementers") {
    return value.implementers;
  }
  if ("step" in target) {
    return value.steps[STEPS[target.step]!];
  }
  const reviewer = value.reviewers[target.reviewer];
  return reviewer?.kind === "agent" ? reviewer.pick : value.steps.review;
}

/** The options with `target` on `pick`. */
function withPick(value: RunOptions, target: Target, pick: SessionPick): RunOptions {
  if (target === "implementers") {
    return { ...value, implementers: pick };
  }
  if ("step" in target) {
    return { ...value, steps: { ...value.steps, [STEPS[target.step]!]: pick } };
  }
  const reviewers = value.reviewers.map((each, index) =>
    index === target.reviewer && each.kind === "agent" ? { ...each, pick } : each,
  );
  return { ...value, reviewers };
}

/** What a place of the map holds, for its keys: a pick, a joint, the reviewer to add, the depth. */
function placeOf(value: RunOptions, pos: Pos): Target | { joint: number } | Below {
  if (pos.row === "track") {
    const step = stepAt(pos.index);
    return step === undefined ? { joint: stepAfterJoint(pos.index) } : { step };
  }
  const item = belowItems(value.reviewers.length)[pos.index]!;
  return item;
}

/** Whether the place can still change: the step, or the step after the joint, has not started. */
function isEditable(place: ReturnType<typeof placeOf>, stages: FeatureStages | undefined): boolean {
  if (stages === undefined) {
    return true;
  }
  if (typeof place === "object" && "step" in place) {
    return isOpen(stages, STEPS[place.step]!);
  }
  if (typeof place === "object" && "joint" in place) {
    return isOpen(stages, STEPS[place.joint]!);
  }
  if (place === "implementers") {
    return isOpen(stages, "build");
  }
  return isOpen(stages, "review");
}

/** The hints of the place selected: its keys, then the moves. */
function hintsOf(
  place: ReturnType<typeof placeOf>,
  value: RunOptions,
  isFixed: boolean,
): Array<[string, string]> {
  if (isFixed) {
    return [
      ["← →", "move"],
      ["↑ ↓", "below"],
    ];
  }
  if (typeof place === "object" && "joint" in place) {
    return [
      ["⏎", value.cuts.includes(place.joint) ? "join" : "cut"],
      ["← →", "move"],
    ];
  }
  if (place === "add") {
    return [
      ["⏎", "add a reviewer"],
      ["↑", "review"],
    ];
  }
  if (place === "depth") {
    return [
      ["⏎", "waves or branch"],
      ["↑", "review"],
    ];
  }
  const isReviewer = typeof place === "object" && "reviewer" in place;
  return [
    ["⏎", "pick"],
    ["r", "reset"],
    ...(isReviewer ? ([["d", "remove"]] as Array<[string, string]>) : []),
    ["← →", "move"],
    ["↑ ↓", "below"],
  ];
}

/** What the map's keys and presses do: pick, cut or join, reset, add, and remove, then move. */
function useMapKeys({
  defaults,
  onChange,
  place,
  pos,
  setPicking,
  setPos,
  stages,
  target,
  value,
}: {
  defaults: RunOptions;
  onChange: (value: RunOptions) => void;
  place: ReturnType<typeof placeOf>;
  pos: Pos;
  setPicking: (step: "model" | "effort" | undefined) => void;
  setPos: (pos: Pos) => void;
  stages: FeatureStages | undefined;
  target: Target | undefined;
  value: RunOptions;
}) {
  const act = (at: Pos) => {
    const here = placeOf(value, at);
    if (!isEditable(here, stages)) {
      return;
    }
    if (typeof here === "object" && "joint" in here) {
      onChange(withCut(value, here.joint));
    } else if (here === "depth") {
      onChange({ ...value, depth: value.depth === "waves" ? "branch" : "waves" });
    } else if (here === "add") {
      onChange({
        ...value,
        reviewers: [...value.reviewers, { kind: "agent", pick: defaults.steps.review }],
      });
    } else {
      setPicking("model");
    }
  };
  const reset = () => {
    if (!isEditable(place, stages)) {
      return;
    }
    if (typeof place === "object" && "joint" in place) {
      const isDefault = defaults.cuts.includes(place.joint) === value.cuts.includes(place.joint);
      onChange(isDefault ? value : withCut(value, place.joint));
    } else if (target !== undefined) {
      const fallback = target === "implementers" ? defaults.implementers : pickOf(defaults, target);
      onChange(withPick(value, target, fallback));
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      act(pos);
    } else if (event.key === "r") {
      reset();
    } else if (event.key === "a" && isEditable("add", stages)) {
      act({ index: value.reviewers.length + 1, row: "below" });
    } else if (
      event.key === "d" &&
      typeof place === "object" &&
      "reviewer" in place &&
      isEditable(place, stages)
    ) {
      onChange({
        ...value,
        reviewers: value.reviewers.filter((_, index) => index !== place.reviewer),
      });
      setPos({ index: Math.max(1, pos.index - 1), row: "below" });
    } else {
      const next = moved(pos, event.key, value.reviewers.length, stages?.shown);
      if (next === pos) {
        return;
      }
      setPos(next);
    }
    event.preventDefault();
  };
  return { act, onKeyDown };
}

/**
 * The map over `value`, `defaults` marking what differs; `start` puts the cursor somewhere, and
 * `opened` opens the picker there, as a story does.
 */
export function RunMap({
  defaults,
  onChange,
  opened,
  runtimes,
  stages,
  start = { index: 0, row: "track" },
  value,
}: {
  defaults: RunOptions;
  onChange: (value: RunOptions) => void;
  opened?: "model" | "effort";
  runtimes: ReadonlyArray<PickerRuntime>;
  /** A feature's history, on its page. */
  stages?: FeatureStages | undefined;
  start?: Pos;
  value: RunOptions;
}) {
  const [pos, setPos] = useState<Pos>(start);
  const [picking, setPicking] = useState<"model" | "effort" | undefined>(opened);
  const map = useRef<HTMLDivElement>(null);
  const place = placeOf(value, pos);
  const target: Target | undefined =
    place === "implementers" || (typeof place === "object" && !("joint" in place))
      ? place
      : undefined;
  // The keys' cursor takes the focus where it lands, while the map holds it.
  useEffect(() => {
    const element = map.current;
    if (element?.contains(document.activeElement)) {
      element.querySelector<HTMLElement>(`[data-pos="${posKey(pos)}"]`)?.focus();
    }
  }, [pos]);
  const { act, onKeyDown } = useMapKeys({
    defaults,
    onChange,
    place,
    pos,
    setPicking,
    setPos,
    stages,
    target,
    value,
  });
  const isFixed = !isEditable(place, stages);
  return (
    <VStack gap={3}>
      <div
        aria-label="How each step runs"
        onKeyDown={onKeyDown}
        ref={map}
        role="group"
        {...stylex.props(styles.map)}
      >
        <RunTrack
          defaults={defaults}
          onPress={(at) => {
            setPos(at);
            act(at);
          }}
          pos={pos}
          runtimes={runtimes}
          stages={stages}
          value={value}
        />
      </div>
      <HStack wrap="wrap" xstyle={styles.hints}>
        {hintsOf(place, value, isFixed).map(([keys, label]) => (
          <Text color="secondary" key={label} size="sm">
            <KeyCap>{keys}</KeyCap> {label}
          </Text>
        ))}
      </HStack>
      {target !== undefined && !isFixed && (
        <PickSteps
          onChange={(pick) => onChange(withPick(value, target, pick))}
          onStep={setPicking}
          pick={pickOf(value, target)}
          runtimes={runtimes}
          step={picking}
        />
      )}
    </VStack>
  );
}
