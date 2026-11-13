// A line between parts: 1 px, `rule-quiet` between rows of one pane, `rule` where it is an edge.
// With words, they sit in its middle, "── Earlier ──".
import { View } from "nsh";
import { Text } from "./Text";
import { tokens } from "../tokens";

export type DividerProps = {
  /** An edge between parts, where it separates more than rows: the brighter line. */
  edge?: boolean;
  label?: string;
  vertical?: boolean;
};

export function Divider(props: DividerProps) {
  const colour = () => (props.edge === true ? tokens.role.rule : tokens.role.ruleQuiet);
  // Alone, a line spans what holds it; beside a label, it takes the room the label leaves.
  const line = (beside = false) => (
    <View
      style={
        props.vertical === true
          ? { alignSelf: "stretch", backgroundColor: colour(), width: 1 }
          : beside
            ? { backgroundColor: colour(), flexGrow: 1, height: 1 }
            : { alignSelf: "stretch", backgroundColor: colour(), height: 1 }
      }
    />
  );
  return (
    <If when={props.label !== undefined && props.vertical !== true} else={line()}>
      <View style={{ alignItems: "center", alignSelf: "stretch", flexDirection: "row", gap: 8 }}>
        {line(true)}
        <Text size="under" tone="faint">
          {props.label}
        </Text>
        {line(true)}
      </View>
    </If>
  );
}
