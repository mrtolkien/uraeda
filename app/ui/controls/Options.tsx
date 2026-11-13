// The rows a select or a menu opens: one list, in the overlay it opens on, with its keys declared
// in that overlay's layer of the registry. `j` `k` and the arrows move the row the keys are on,
// Enter and Space pick it, Escape closes (the overlay's). The row the keys are on has a selected
// row's look: a fill one step up, and a bar of light on its left edge. A press picks a row too.
import { type JSX, signal, untracked, View } from "nsh";
import { Button as Base } from "nsh/base";
import { type IconName, Icon } from "./Icon";
import { Kbd } from "./Kbd";
import { Text } from "./Text";
import { registerKey } from "../keys/registry";
import type { Scope } from "../keys/store";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

/** One option of a select or a radio group. */
export type Option<Value extends string = string> = {
  /** Shown after its label, fainter: what it means, "every hour". */
  hint?: string;
  disabled?: boolean;
  icon?: IconName;
  label: string;
  value: Value;
};

/** A row of the list: an option, or an action of a menu. */
export type Row = {
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  icon?: IconName;
  /** A key the page declares for the same action, shown at the row's end. */
  keys?: string;
  label: string;
  /** Ticked: the value a select holds. */
  picked?: boolean;
  /** A line above it: a menu's next group. */
  ruled?: boolean;
};

export type OptionsProps = {
  /**
   * The layer whose keys these are, the popover's or the sheet's that holds them: in a browser a
   * layer's content is made where it was written, outside the layer, so its scope is given.
   */
  scope?: Scope;
  /** The row the keys start on: the picked one, else the first that can be picked. */
  start?: number;
  onPick: (at: number) => void;
  rows: ReadonlyArray<Row>;
  testID?: string;
};

const ROW_PADDING = 8;

function OptionRow(props: { at: number; held: boolean; onPick: () => void; row: Row }) {
  const ink = () => {
    if (props.row.disabled === true) {
      return tokens.role.inkFaint;
    }
    return props.row.danger === true ? tokens.role.removed : tokens.role.ink;
  };
  return (
    <View>
      <If when={props.row.ruled === true && props.at > 0}>
        <View style={{ backgroundColor: tokens.role.ruleQuiet, height: 1, marginVertical: 4 }} />
      </If>
      <Base
        accessibilityLabel={props.row.label}
        disabled={props.row.disabled === true}
        hoverStyle={{ backgroundColor: tokens.row.selected }}
        onPress={props.onPick}
        role="menuitem"
        selected={props.row.picked === true}
        style={{
          alignItems: "center",
          backgroundColor: props.held ? tokens.row.selected : undefined,
          flexDirection: "row",
          gap: 8,
          minHeight: isNarrow() ? tokens.control.touch : tokens.space.row,
          paddingHorizontal: ROW_PADDING,
        }}
      >
        <If when={props.held}>
          <View
            style={{
              backgroundColor: tokens.light.focus,
              bottom: 0,
              boxShadow: tokens.row.barGlow,
              left: 0,
              position: "absolute",
              top: 0,
              width: tokens.row.bar,
            }}
          />
        </If>
        <If when={props.row.icon}>{(icon) => <Icon colour={ink()} name={icon()} />}</If>
        <Text colour={ink()} lines={1} style={{ flexShrink: 1 }}>
          {props.row.label}
        </Text>
        <If when={props.row.hint}>
          {(hint) => (
            <Text lines={1} style={{ flexShrink: 1 }} tone="faint">
              {hint()}
            </Text>
          )}
        </If>
        <View style={{ flexGrow: 1, minWidth: 16 }} />
        {/* A phone has no keys to hint, and a row's keys ran past its screen's edge. */}
        <If when={isNarrow() ? undefined : props.row.keys}>{(keys) => <Kbd keys={keys()} />}</If>
        <If when={props.row.picked === true}>
          <Icon colour={tokens.role.action} name="check" />
        </If>
      </Base>
    </View>
  );
}

export function Options(props: OptionsProps): JSX.Element {
  const can = (at: number) => props.rows[at] !== undefined && props.rows[at]?.disabled !== true;
  const first = () => {
    const start = props.start ?? props.rows.findIndex((row) => row.picked === true);
    return can(start) ? start : props.rows.findIndex((_, at) => can(at));
  };
  const held = signal(untracked(first));
  const move = (by: 1 | -1) => {
    const count = props.rows.length;
    for (let step = 1; step <= count; step += 1) {
      const at = (untracked(held) + by * step + count) % count;
      if (can(at)) {
        held.set(at);
        return;
      }
    }
  };
  const pick = () => {
    const at = untracked(held);
    if (!can(at)) {
      return false;
    }
    props.onPick(at);
  };
  const near = { repeat: true } as const;
  registerKey(
    [
      { ...near, hint: "j k", hintLabel: "move", keys: "j", label: "Next", run: () => move(1) },
      { ...near, keys: "k", label: "Previous", run: () => move(-1) },
      { ...near, keys: "ArrowDown", label: "Next", run: () => move(1) },
      { ...near, keys: "ArrowUp", label: "Previous", run: () => move(-1) },
      { hint: "↵", hintLabel: "pick", keys: "Enter", label: "Pick", run: pick },
      { keys: "space", label: "Pick", run: pick },
    ],
    props.scope,
  );
  return (
    <View role="menu" style={{ marginHorizontal: -ROW_PADDING / 2 }} testID={props.testID}>
      <Each key="index" of={props.rows}>
        {(row, at) => (
          <OptionRow
            at={at()}
            held={held() === at()}
            onPick={() => {
              if (can(at())) {
                held.set(at());
                props.onPick(at());
              }
            }}
            row={row()}
          />
        )}
      </Each>
    </View>
  );
}
