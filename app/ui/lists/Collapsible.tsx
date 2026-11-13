// A part that folds: its title row, with a chevron and a count, over what it holds. It opens and
// closes with motion, its height easing from nothing to its content's, and what follows it moves
// along, never jumping. Whether it is open is the screen's to keep. Its title row is a control:
// pressed, or Enter or Space with the focus, it folds; with `keys`, a key folds it too.
import type { JSX } from "nsh";
import { Collapsible as Base, Button as Press } from "nsh/base";
import { Badge, Icon, type IconName, type PressState, pressable, Text } from "../controls";
import { registerKey } from "../keys/registry";
import { tokens } from "../tokens";
import { rowHeight } from "./Row";

export type CollapsibleProps = {
  children?: JSX.Element;
  /** How many it holds, said beside its title: `· 3`. */
  count?: number;
  icon?: IconName;
  /** A key that folds it, declared while it is shown. */
  keys?: string;
  onToggle: (open: boolean) => void;
  open: boolean;
  /** Drawn in a state, still: the gallery's. */
  state?: PressState;
  testID?: string;
  title: string;
};

/** The title row's looks: a row of a list, lit under the pointer. */
const looks = () => ({
  rest: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    minHeight: rowHeight(),
    paddingHorizontal: 8,
  },
  hover: { backgroundColor: tokens.row.selected },
});

export function Collapsible(props: CollapsibleProps) {
  // Native Shell's `reveal` eases the height, and moves what follows along.
  const toggle = () => props.onToggle(!props.open);
  const press = pressable(props, toggle);
  if (props.keys !== undefined && props.state === undefined) {
    registerKey({ keys: props.keys, label: `fold ${props.title}`, run: toggle });
  }
  return (
    <Base content={props.children} open={props.open} reveal testID={props.testID}>
      <Press
        accessibilityLabel={props.title}
        activeStyle={press.active(looks())}
        focusStyle={press.focusStyle(looks())}
        hoverStyle={press.hover(looks())}
        onPress={press.press}
        ref={press.ref}
        style={press.style(looks())}
      >
        <Icon name={props.open ? "chevron-down" : "chevron-right"} size={14} />
        <If when={props.icon}>{(name) => <Icon name={name()} />}</If>
        <Text bold tone="quiet">
          {props.title}
        </Text>
        <If when={props.count !== undefined}>
          <Badge tone="quiet">{props.count ?? 0}</Badge>
        </If>
      </Press>
    </Base>
  );
}
