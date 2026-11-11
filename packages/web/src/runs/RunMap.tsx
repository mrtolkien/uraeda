// The run map (spec of Run options): how each step of a feature runs, as a diagram the keys and
// the pointer both drive. ← → (h l) move along the steps and the joints between them, ↓ ↑ (j k) go
// to the build's implementers and the reviewers under the track and back. Enter on a step, the
// implementers, or a reviewer opens the app's key picker, the agent and model, then the effort;
// Enter or Space on a joint cuts it, starting a clean session there, or joins it; `r` puts the
// selection back to the default; `a` adds a reviewer and `d` removes the one selected, unless it is
// the only one. The bar under the map says what the place selected can do, each by its key and by a
// press; the keys are the registry's, a selection's while the map holds the focus. The settings'
// Runs section draws it on the defaults, a feature's page on the feature's own options, with its
// history in place of the timeline: there a step that started, and every joint before it, keeps
// what it ran on, and a merged feature's map only reads. A start dialog draws it too, on what the
// start changes: a dialog is a layer the registry leaves to its owner, so there the map hears the
// same bindings itself (`keys/layerKeys.ts`), and a change's dialog (`isChange`) draws what a change
// runs alone, its fix and its reviewers, ↓ ↑ (j k) moving along them too, as they stand in a column.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type FocusEvent, useEffect, useRef, useState } from "react";
import { KeyCap } from "../keys/KeyCap.tsx";
import { useInLayer, useLayerKeys } from "../keys/layerKeys.ts";
import { type Binding, useKeys } from "../keys/registry.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";
import { PickSteps, type PickerRuntime, type SessionPick } from "../SessionPicker.tsx";
import {
  type Below,
  belowItems,
  CHANGE_STEPS,
  moved,
  type Pos,
  posKey,
  posOf,
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
  // A sheet's presses keep their line while the place selected has none, so nothing under it moves.
  presses: { minBlockSize: sizeVars["--size-element-md"] },
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

/**
 * Whether the place is a reviewer that can be removed: one of several, as no reviewers at all reads
 * back as the default reviewer.
 */
function isRemovable(
  place: ReturnType<typeof placeOf>,
  value: RunOptions,
): place is { reviewer: number } {
  return typeof place === "object" && "reviewer" in place && value.reviewers.length > 1;
}

/** What the map's presses do at the place selected: pick, cut or join, add, or switch; reset; remove. */
type Does = { act: () => void; remove: () => void; reset: () => void };

/**
 * What the place selected can do, each by its key and by a press of the bar under the map: pick,
 * cut or join, add a reviewer, or switch where reviews happen; put back the default; remove a
 * reviewer. The bar's icons are the phone's, where the press on a place does its Enter.
 */
function actionsOf(
  place: ReturnType<typeof placeOf>,
  value: RunOptions,
  isFixed: boolean,
  does: Does,
): Array<BarAction> {
  if (isFixed) {
    return [];
  }
  if (typeof place === "object" && "joint" in place) {
    return [{ keys: "⏎", label: value.cuts.includes(place.joint) ? "join" : "cut", run: does.act }];
  }
  if (place === "add" || place === "depth") {
    return [
      { keys: "⏎", label: place === "add" ? "add a reviewer" : "waves or branch", run: does.act },
    ];
  }
  return [
    { keys: "⏎", label: "pick", run: does.act },
    { icon: "uraeda:history", keys: "r", label: "reset", run: does.reset },
    ...(isRemovable(place, value)
      ? [{ icon: "uraeda:trash", keys: "d", label: "remove", run: does.remove } as const]
      : []),
  ];
}

/**
 * The moves' hints at the place selected: along the track, and down or back up; at a change's
 * start, down from its fix to its reviewers, along them, and back up.
 */
function movesOf(place: ReturnType<typeof placeOf>, isChange: boolean): Array<[string, string]> {
  if (isChange) {
    return typeof place === "object" && "step" in place ? [["↓", "reviewers"]] : [["↑ ↓", "move"]];
  }
  if (typeof place === "object" && "joint" in place) {
    return [["← →", "move"]];
  }
  if (place === "add" || place === "depth") {
    return [["↑", "review"]];
  }
  return [
    ["← →", "move"],
    ["↑ ↓", "below"],
  ];
}

/**
 * Under the map, what the place selected can do, its keys and presses, then the moves' keys. On the
 * phone, where keys are no help, only the presses, floating at the screen's bottom while the map
 * holds the focus, as a row's bar does; in a sheet (`isInLayer`), the top layer, which nothing of
 * the page floats over, they are buttons under the map.
 */
function MapBar({
  actions,
  holds,
  isInLayer,
  moves,
}: {
  actions: ReadonlyArray<BarAction>;
  holds: boolean;
  isInLayer: boolean;
  moves: ReadonlyArray<[string, string]>;
}) {
  if (isNarrow(useWidthClass())) {
    if (!isInLayer) {
      return holds ? <RowBar actions={actions} /> : null;
    }
    return (
      <HStack align="center" gap={2} wrap="wrap" xstyle={styles.presses}>
        {actions.map(
          (action) =>
            action.icon !== undefined && (
              <Button
                icon={<Icon icon={action.icon} />}
                key={action.label}
                label={action.label.charAt(0).toUpperCase() + action.label.slice(1)}
                onClick={action.run}
              />
            ),
        )}
      </HStack>
    );
  }
  return (
    <HStack align="center" wrap="wrap" xstyle={styles.hints}>
      {actions.length > 0 && <RowBar actions={actions} />}
      {moves.map(([keys, label]) => (
        <Text color="secondary" key={label} type="supporting">
          <KeyCap>{keys}</KeyCap> {label}
        </Text>
      ))}
    </HStack>
  );
}

/** The keys that move the cursor, each with the words the key map lists it under. */
const MOVES: ReadonlyArray<[keys: string, label: string]> = [
  ["ArrowLeft", "Previous step or joint"],
  ["h", "Previous step or joint"],
  ["ArrowRight", "Next step or joint"],
  ["l", "Next step or joint"],
  ["ArrowDown", "Down to the implementers or the reviewers"],
  ["j", "Down to the implementers or the reviewers"],
  ["ArrowUp", "Back up to the step"],
  ["k", "Back up to the step"],
];

const NO_KEYS: ReadonlyArray<Binding> = [];

/** The moves' bindings: each key takes the cursor from `pos` where `to` says, or does nothing. */
const moveBindings = (
  pos: Pos,
  to: (keys: string) => Pos,
  setPos: (pos: Pos) => void,
): Array<Binding> =>
  MOVES.map(([keys, label]) => ({
    keys,
    label,
    run: () => {
      const next = to(keys);
      if (posKey(next) === posKey(pos)) {
        return false;
      }
      setPos(next);
      return undefined;
    },
  }));

/**
 * What the map's keys and presses do: pick, cut or join, reset, add, and remove, then move, the
 * cursor going where `to` says. The `bindings` are the registry's, declared as a selection's while
 * the map holds the focus, so they run before the page's and never mean two things with its `j`
 * `k`: a key that does nothing here, as `j` on a step with nothing under it, goes on to the page's.
 * Space on a joint is the joint's own, a switch's.
 */
function useMapKeys({
  defaults,
  onChange,
  place,
  pos,
  runtimes,
  setPicking,
  setPos,
  stages,
  target,
  to,
  value,
}: {
  defaults: RunOptions;
  onChange: (value: RunOptions) => void;
  place: ReturnType<typeof placeOf>;
  pos: Pos;
  runtimes: ReadonlyArray<PickerRuntime>;
  setPicking: (step: "model" | "effort" | undefined) => void;
  setPos: (pos: Pos) => void;
  stages: FeatureStages | undefined;
  target: Target | undefined;
  to: (keys: string) => Pos;
  value: RunOptions;
}) {
  const act = (at: Pos) => {
    const here = placeOf(value, at);
    if (!isEditable(here, stages)) {
      return;
    }
    if (typeof here === "object" && "joint" in here) {
      onChange(withCut(runtimes, value, here.joint));
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
      return false;
    }
    if (typeof place === "object" && "joint" in place) {
      if (defaults.cuts.includes(place.joint) === value.cuts.includes(place.joint)) {
        return false;
      }
      onChange(withCut(runtimes, value, place.joint));
    } else if (target !== undefined) {
      const fallback = target === "implementers" ? defaults.implementers : pickOf(defaults, target);
      onChange(withPick(value, target, fallback));
    } else {
      return false;
    }
    return undefined;
  };
  const remove = () => {
    if (!(isRemovable(place, value) && isEditable(place, stages))) {
      return false;
    }
    onChange({
      ...value,
      reviewers: value.reviewers.filter((_, index) => index !== place.reviewer),
    });
    setPos({ index: Math.max(1, pos.index - 1), row: "below" });
    return undefined;
  };
  const bindings: Array<Binding> = [
    { keys: "Enter", label: "Pick, or cut or join", run: () => act(pos) },
    { keys: "r", label: "Back to the default", run: reset },
    {
      keys: "a",
      label: "Add a reviewer",
      run: () =>
        isEditable("add", stages)
          ? act({ index: value.reviewers.length + 1, row: "below" })
          : false,
    },
    { keys: "d", label: "Remove the reviewer", run: remove },
    ...moveBindings(pos, to, setPos),
  ];
  return { act, bindings, remove, reset };
}

/**
 * Whether the map holds the focus, `holds`, where its keys are the ones that act, and the focus and
 * the cursor as one: the keys' cursor takes the focus where it lands while the map holds it, and a
 * place focused otherwise, as by a screen reader, is where the cursor goes.
 */
function useMapFocus(pos: Pos, setPos: (pos: Pos) => void) {
  const [holds, setHolds] = useState(false);
  const map = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = map.current;
    if (element?.contains(document.activeElement)) {
      element.querySelector<HTMLElement>(`[data-pos="${posKey(pos)}"]`)?.focus();
    }
  }, [pos]);
  return {
    holds,
    map,
    onBlur: (event: FocusEvent) => setHolds(map.current?.contains(event.relatedTarget) ?? false),
    onFocus: (event: FocusEvent) => {
      setHolds(true);
      const at = posOf((event.target as HTMLElement).dataset?.pos);
      if (at !== undefined && posKey(at) !== posKey(pos)) {
        setPos(at);
      }
    },
  };
}

/**
 * The map over `value`, `defaults` marking what differs; `start` puts the cursor somewhere, and
 * `opened` opens the picker there, as a story does.
 */
export function RunMap({
  defaults,
  isChange = false,
  isColumn = false,
  onChange,
  opened,
  runtimes,
  stages,
  start = { index: isChange ? STEPS.indexOf("build") * 2 : 0, row: "track" },
  value,
}: {
  defaults: RunOptions;
  /** A change's start: its fix and its reviewers alone. */
  isChange?: boolean;
  /** The track as a column whatever the width, as a semi-wide screen's dialog asks. */
  isColumn?: boolean;
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
  const { holds, map, onBlur, onFocus } = useMapFocus(pos, setPos);
  const place = placeOf(value, pos);
  const target: Target | undefined =
    place === "implementers" || (typeof place === "object" && !("joint" in place))
      ? place
      : undefined;
  const shown = stages?.shown ?? (isChange ? CHANGE_STEPS : STEPS);
  const { act, bindings, remove, reset } = useMapKeys({
    defaults,
    onChange,
    place,
    pos,
    runtimes,
    setPicking,
    setPos,
    stages,
    target,
    to: (keys) => moved(pos, keys, value.reviewers.length, shown, isChange),
    value,
  });
  // On a page the keys are the registry's; in a dialog, a layer it leaves alone, the map's own.
  useKeys(holds ? bindings : NO_KEYS, "selection");
  const keyed = useLayerKeys(bindings);
  const isInLayer = useInLayer(map);
  const isFixed = !isEditable(place, stages);
  const does: Does = {
    act: () => act(pos),
    remove: () => void remove(),
    reset: () => void reset(),
  };
  return (
    <VStack gap={3}>
      <div
        aria-label="How each step runs"
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={keyed}
        ref={map}
        role="group"
        {...stylex.props(styles.map)}
      >
        <RunTrack
          defaults={defaults}
          isChange={isChange}
          isColumn={isColumn}
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
      <MapBar
        actions={actionsOf(place, value, isFixed, does)}
        holds={holds}
        isInLayer={isInLayer}
        moves={movesOf(place, isChange)}
      />
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
