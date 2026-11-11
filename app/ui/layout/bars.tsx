// The phone's two bars, on a narrow window: at the top the places, as a terminal's tab line, with
// the sidebar's toggle on its far left; at the foot the panes of the one stack, as tiles of glass,
// an icon over a word each, the shown one in the accent. Both are the frame's, as the rail and the
// status line are on a wider window.
import { View } from "nsh";
import type { PaneRef, Stack } from "./layout";
import { kindOf, titleOf } from "./panes";
import type { RailPlace } from "./Rail";
import { markOf } from "./Stack";
import { Icon, Text } from "../controls";
import { Surface } from "../surfaces";
import { tokens } from "../tokens";

/** The top bar: the sidebar's toggle, then each place's icon and count, the current one lit. */
export function NavBar(props: { onSidebar?: () => void; places: ReadonlyArray<RailPlace> }) {
  return (
    <View
      role="tablist"
      style={{
        borderBottomWidth: 1,
        borderColor: tokens.role.ruleQuiet,
        flexDirection: "row",
        height: tokens.control.touch,
      }}
      testID="nav-bar"
    >
      <If when={props.onSidebar}>
        {(open) => (
          <View
            accessibilityLabel="Open the sidebar"
            onPress={open()}
            role="button"
            style={{
              alignItems: "center",
              borderColor: tokens.role.ruleQuiet,
              borderRightWidth: 1,
              justifyContent: "center",
              width: tokens.control.touch,
            }}
          >
            <Icon colour={tokens.role.inkQuiet} name="panel-left" />
          </View>
        )}
      </If>
      <Each key={(place: RailPlace) => place.label} of={props.places}>
        {(place) => {
          const current = () => place().current === true;
          return (
            <View
              accessibilityLabel={place().label}
              accessibilityState={{ selected: current() }}
              onPress={place().onPress}
              role="tab"
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 3,
                justifyContent: "center",
                minWidth: tokens.control.touch,
                paddingHorizontal: 6,
              }}
            >
              <Icon
                colour={current() ? tokens.role.action : tokens.role.inkQuiet}
                name={place().icon}
              />
              <If when={place().count !== undefined && (place().count ?? 0) > 0}>
                <Text
                  bold={place().needs === true}
                  colour={place().needs === true ? tokens.light.needs : undefined}
                  size="under"
                  tone="quiet"
                >
                  {String(place().count)}
                </Text>
              </If>
              <View
                style={{
                  backgroundColor: current() ? tokens.role.action : "transparent",
                  bottom: -1,
                  height: 2,
                  left: 0,
                  position: "absolute",
                  right: 0,
                }}
              />
            </View>
          );
        }}
      </Each>
    </View>
  );
}

/** The bottom bar: a tile per pane of the one stack, an icon over its word, pressed to show it. */
export function BottomBar(props: { onShow: (key: string) => void; stack: Stack }) {
  return (
    <Surface
      glass
      height="raised"
      style={{ flexDirection: "row", height: tokens.control.touch + 8 }}
      testID="bottom-bar"
    >
      <Each key={(pane: PaneRef) => pane.key} of={props.stack.panes}>
        {(pane) => {
          const current = () => pane().key === props.stack.shown;
          const colour = () => {
            if (current()) {
              return tokens.role.action;
            }
            return markOf(pane()).needs === true ? tokens.light.needs : tokens.role.inkQuiet;
          };
          const icon = kindOf(pane())?.icon ?? "square";
          return (
            <View
              accessibilityLabel={titleOf(pane())}
              accessibilityState={{ selected: current() }}
              onPress={() => props.onShow(pane().key)}
              role="tab"
              style={{
                alignItems: "center",
                flex: 1,
                gap: 1,
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              <Icon colour={colour()} name={icon} />
              <Text bold={current()} colour={colour()} lines={1} size="under">
                {titleOf(pane())}
              </Text>
              <If when={markOf(pane()).running === true && !current()}>
                <View
                  style={{
                    backgroundColor: tokens.light.running,
                    height: 5,
                    position: "absolute",
                    right: "30%",
                    top: 8,
                    width: 5,
                  }}
                />
              </If>
            </View>
          );
        }}
      </Each>
    </Surface>
  );
}
