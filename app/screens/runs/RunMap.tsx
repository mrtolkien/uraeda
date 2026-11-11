// The run map: how each step of a feature runs, the one component the settings, a start's dialog,
// and a feature's continue draw (rule 3 of "What makes a screen good"). The track's six steps, each
// a tile with its agent, model, and effort, the joints between them, where a new session starts,
// then the roles under them: the build's implementers, the reviewers, and where reviews happen. A
// change's start shows its fix and its reviewers alone.
//
// The keys are a selection's, on while `active` says so: `h` `l` and the arrows go along a row and
// `j` `k` between rows (along every place, in a column), each returning `false` at the map's edge so
// the page's keys go on; `Enter` picks the agent and model, or flips a joint or where reviews
// happen, or adds a reviewer; `e` picks the effort; `r` puts the place back to what it follows; `a`
// adds a reviewer and `d` removes the one selected. A press on a place selects it, and its controls
// are under the map. A change shows at once: `onChange` gets the options as the human set them,
// and the owner sends them; its `refusal` shows under the map.
import { signal, View } from "nsh";
import type { RunOptions, RuntimeRecord } from "../../store/protocol";
import { IconButton, Kbd, Text, Under } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { keyScope } from "../../ui/keys/registry";
import { SelectableCard } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { Detail } from "./Detail";
import {
  agentsOf,
  depthOf,
  isSet,
  joint,
  type Place,
  pickAt,
  pickWords,
  placeKey,
  reset,
  resolve,
  reviewer,
  reviewersOf,
  STEP_LOOKS,
  STEPS,
  withNewSession,
  withPick,
} from "./options";
import { type MapKind, type Move, moved, placeAt, rowsOf } from "./places";

export type RunMapProps = {
  /** The options this map sets, only what is set: the settings', a feature's own, a start's own. */
  value: RunOptions;
  /** What `value` falls back to, as the server reads it: the settings' options; none for theirs. */
  over?: RunOptions | null;
  /** Gets the options as the human set them: shown at once by the owner, and sent. */
  onChange: (next: RunOptions) => void;
  /** The Agent record's agents, for what each lists. */
  runtimes: ReadonlyArray<RuntimeRecord>;
  /** `runs.default_agent`: the agent a place that names none runs on, when it is on. */
  defaultAgent: string | null;
  /** A feature's six steps, or a change's start: its fix and its reviewers. */
  kind?: MapKind;
  /** A row of tiles, or a column, as a narrow width or a change's dialog asks. */
  column?: boolean;
  /** Whether its keys are on: while the settings' cursor is on its row, or while its dialog is open. */
  active: () => boolean;
  /** The cursor, kept by the owner where a move would lose it: the pane's visit. */
  cursor?: { (): string | null; set(value: string | null): void };
  /** The server's refusal of the last change, with the way out. */
  refusal?: string | null;
  /** Read only: nothing changes, as while a start runs. */
  disabled?: boolean;
  testID?: string;
};

/** The map's keys that move, each with its direction and its words. */
const MOVES: ReadonlyArray<[keys: string, move: Move, label: string]> = [
  ["h", "left", "Previous step or joint"],
  ["ArrowLeft", "left", "Previous step or joint"],
  ["l", "right", "Next step or joint"],
  ["ArrowRight", "right", "Next step or joint"],
  ["j", "down", "Down to the roles"],
  ["ArrowDown", "down", "Down to the roles"],
  ["k", "up", "Up to the steps"],
  ["ArrowUp", "up", "Up to the steps"],
];

/** A step's tile: its name, what it runs on, and whether this map changed it. */
function Tile(props: {
  map: RunMapProps;
  onSelect: () => void;
  place: Place;
  selected: boolean;
  title: string;
  icon: Parameters<typeof SelectableCard>[0]["icon"];
}) {
  const agents = () => agentsOf(props.map.runtimes, props.map.defaultAgent);
  const words = () => {
    const pick = pickAt(props.map.value, props.map.over ?? null, props.place);
    if (props.place.kind === "add") return "Press to add one";
    if (props.place.kind === "depth") {
      return depthOf(props.map.value, props.map.over ?? null) === "waves"
        ? "Each wave and the branch"
        : "The branch only";
    }
    if (pick === undefined) {
      const held = reviewersOf(props.map.value, props.map.over ?? null);
      return props.place.kind === "reviewer"
        ? `Runs ${held[props.place.index]?.command ?? ""}`
        : "";
    }
    const set = props.map.over != null && isSet(props.map.value, props.place) ? " · changed" : "";
    return `${pickWords(resolve(pick, agents()))}${set}`;
  };
  return (
    <View style={{ flexBasis: 0, flexGrow: 1, minWidth: 128 }}>
      <SelectableCard
        disabled={props.map.disabled}
        icon={props.icon}
        onSelect={props.onSelect}
        selected={props.selected}
        testID={
          props.map.testID === undefined
            ? undefined
            : `${props.map.testID}-${placeKey(props.place)}`
        }
        title={props.title}
        words={words()}
      />
    </View>
  );
}

/** A joint between two steps: scissors where a new session starts, a link where it goes on. */
function Joint(props: {
  map: RunMapProps;
  index: number;
  onSelect: () => void;
  selected: boolean;
}) {
  const now = () =>
    joint(
      props.map.value,
      props.map.over ?? null,
      agentsOf(props.map.runtimes, props.map.defaultAgent),
      props.index,
    );
  const words = () =>
    `${now().cuts ? "New session" : "Same session"} before ${STEP_LOOKS[STEPS[props.index]!].name}`;
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: props.map.column === true ? "row" : "column",
        gap: 6,
        justifyContent: "center",
        paddingLeft: props.map.column === true ? 12 : 0,
      }}
    >
      <IconButton
        colour={now().forced ? tokens.role.inkFaint : undefined}
        disabled={props.map.disabled}
        icon={now().cuts ? "scissors" : "link"}
        label={words()}
        onPress={props.onSelect}
        selected={props.selected}
      />
      <If when={props.map.column === true}>
        <Text size="under" tone="quiet">
          {words()}
        </Text>
      </If>
    </View>
  );
}

/** One key under the map, with its words. */
const hint = (keys: string, words: string) => (
  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
    <Kbd keys={keys} />
    <Text size="under" tone="faint">
      {words}
    </Text>
  </View>
);

/** The keys under the map, wide: what the cursor's place takes. */
function Hints(props: { column: boolean }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {props.column ? hint("j k", "move") : hint("h l", "along")}
      {props.column ? null : hint("j k", "steps and roles")}
      {hint("Enter", "pick or flip")}
      {hint("e", "effort")}
      {hint("r", "back to what it follows")}
      {hint("a", "add a reviewer")}
      {hint("d", "remove it")}
    </View>
  );
}

export function RunMap(props: RunMapProps) {
  const kind = () => props.kind ?? "feature";
  const column = () => props.column === true || kind() === "change";
  const over = () => props.over ?? null;
  const agents = () => agentsOf(props.runtimes, props.defaultAgent);
  const rows = () => rowsOf(props.value, over(), kind());
  const own = signal<string | null>(null);
  const cursor = props.cursor ?? own;
  const place = () => placeAt(rows(), cursor());
  const at = () => placeKey(place());
  const go = (key: string) => cursor.set(key);
  const change = (next: RunOptions) => {
    if (props.disabled !== true) props.onChange(next);
  };
  let openModel: (() => void) | undefined;
  let openEffort: (() => void) | undefined;

  /** What `Enter`, or a press, does at a place. */
  const act = (here: Place) => {
    if (props.disabled === true) return;
    switch (here.kind) {
      case "joint": {
        const now = joint(props.value, over(), agents(), here.index);
        if (now.forced) return;
        change(withNewSession(props.value, here.index, !now.cuts));
        return;
      }
      case "depth":
        change({
          ...props.value,
          reviewDepth: depthOf(props.value, over()) === "waves" ? "branch" : "waves",
        });
        return;
      case "add":
        addReviewer();
        return;
      default:
        if (pickAt(props.value, over(), here) !== undefined) openModel?.();
    }
  };
  const addReviewer = () => {
    const held = reviewersOf(props.value, over());
    change({
      ...props.value,
      reviewers: [...held, reviewer(held[0]?.agent ?? agents().fallback?.id ?? null)],
    });
  };
  const remove = (index: number) => {
    const held = reviewersOf(props.value, over());
    if (held.length < 2) return false;
    change({ ...props.value, reviewers: held.filter((_, other) => other !== index) });
    go(placeKey({ index: Math.max(0, index - 1), kind: "reviewer" }));
    return undefined;
  };

  const scope = keyScope({ kind: "selection", name: "Run map", on: () => props.active() });
  registerKey(
    [
      ...MOVES.map(([keys, move, label]) => ({
        keys,
        label,
        repeat: true,
        run: () => {
          const to = moved(rows(), at(), move, column());
          if (to === undefined) return false;
          go(to);
          return undefined;
        },
      })),
      { keys: "Enter", label: "Pick, or flip", run: () => act(place()) },
      {
        keys: "e",
        label: "Pick the effort",
        run: () => (pickAt(props.value, over(), place()) === undefined ? false : openEffort?.()),
      },
      {
        keys: "r",
        label: "Back to what it follows",
        run: () => {
          if (props.disabled === true || !isSet(props.value, place())) return false;
          change(reset(props.value, place()));
          return undefined;
        },
      },
      {
        keys: "a",
        label: "Add a reviewer",
        run: () => (props.disabled === true ? false : addReviewer()),
      },
      {
        keys: "d",
        label: "Remove the reviewer",
        run: () => {
          const here = place();
          return here.kind === "reviewer" && props.disabled !== true ? remove(here.index) : false;
        },
      },
    ],
    scope,
  );

  const tile = (here: Place) => {
    const select = () => {
      go(placeKey(here));
      if (here.kind === "add" || here.kind === "depth") act(here);
    };
    const selected = () => at() === placeKey(here);
    switch (here.kind) {
      case "joint":
        return <Joint index={here.index} map={props} onSelect={select} selected={selected()} />;
      case "step":
        return (
          <Tile
            icon={STEP_LOOKS[here.step].icon}
            map={props}
            onSelect={select}
            place={here}
            selected={selected()}
            title={kind() === "change" ? "The fix" : STEP_LOOKS[here.step].name}
          />
        );
      case "implementers":
        return (
          <Tile
            icon="users"
            map={props}
            onSelect={select}
            place={here}
            selected={selected()}
            title="Implementers"
          />
        );
      case "reviewer":
        return (
          <Tile
            icon="scan-eye"
            map={props}
            onSelect={select}
            place={here}
            selected={selected()}
            title={`Reviewer ${here.index + 1}`}
          />
        );
      case "add":
        return (
          <Tile
            icon="plus"
            map={props}
            onSelect={select}
            place={here}
            selected={selected()}
            title="Add a reviewer"
          />
        );
      case "depth":
        return (
          <Tile
            icon="layers"
            map={props}
            onSelect={select}
            place={here}
            selected={selected()}
            title="Reviews"
          />
        );
    }
  };

  return (
    <View style={{ gap: 14 }} testID={props.testID}>
      <Each of={rows()}>
        {(places) => (
          <View
            style={{
              alignItems: "stretch",
              flexDirection: column() ? "column" : "row",
              flexWrap: column() ? "nowrap" : "wrap",
              gap: 8,
            }}
          >
            <Each key={placeKey} of={places()}>
              {(here) => tile(here())}
            </Each>
          </View>
        )}
      </Each>
      <Detail
        agents={agents()}
        disabled={props.disabled === true}
        onChange={change}
        onPick={(here, pick) => change(withPick(props.value, over(), here, pick))}
        onRemove={(index) => void remove(index)}
        onReset={(here) => change(reset(props.value, here))}
        openers={{ effort: (open) => (openEffort = open), model: (open) => (openModel = open) }}
        over={over()}
        own={props.value}
        place={place()}
      />
      <Under refusal={props.refusal} />
      <If when={props.active() && props.disabled !== true}>
        <Hints column={column()} />
      </If>
    </View>
  );
}
