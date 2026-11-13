// The side stack folded: a rail of its panes' icons at the window's right, as the rail of places is
// at its left, so the fold shows what it holds. A press on one unfolds the stack on that pane.
import { View } from "nsh";
import type { Layout, PaneRef } from "./layout";
import { kindOf, titleOf } from "./panes";
import { markOf } from "./Stack";
import { IconButton } from "../controls";
import { tokens } from "../tokens";

export function SideRail(props: { layout: Layout; onShow: (key: string) => void }) {
  return (
    <View
      style={{ alignItems: "center", gap: 4, paddingTop: tokens.pane.titleRise, width: 40 }}
      testID="side-rail"
    >
      <IconButton
        icon="panel-right"
        label="Unfold the side stack"
        onPress={() => props.onShow(props.layout.side.shown ?? "")}
      />
      <View
        style={{ backgroundColor: tokens.role.ruleQuiet, height: 1, marginVertical: 4, width: 20 }}
      />
      <Each key={(pane: PaneRef) => pane.key} of={props.layout.side.panes}>
        {(pane) => (
          <IconButton
            colour={markOf(pane()).needs === true ? tokens.light.needs : undefined}
            icon={kindOf(pane())?.icon ?? "square"}
            label={titleOf(pane())}
            onPress={() => props.onShow(pane().key)}
            selected={pane().key === props.layout.side.shown}
          />
        )}
      </Each>
    </View>
  );
}
