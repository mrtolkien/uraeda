// The phone's two bars, on a narrow window: at the top the places, as a terminal's tab line, with
// the sidebar's toggle on its far left; at the foot the panes of the one stack, as tiles of glass,
// an icon over a word each, the shown one in the accent, or icons alone where the words do not fit. Both are the frame's, as the rail and the
// status line are on a wider window.
import { Scroll, signal, View } from "nsh";
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
      {/* More places than a phone's width holds scroll sideways, never cut. */}
      <Scroll horizontal scrollbar={false} style={{ flex: 1 }}>
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
      </Scroll>
    </View>
  );
}

/** About how wide a tile's word is drawn, with the room around it, in points. */
const wordWidth = (title: string) => title.length * tokens.type.under * 0.62 + 12;

/**
 * The bottom bar: a tile per pane of the one stack, an icon over its word, pressed to show it.
 * Each tile is as wide as its word, and the bar shares what is left. When the words do not all fit,
 * as five panes on a phone, the tiles keep their icons, and only the shown one keeps its word: a
 * cut word reads worse than none, and the icon still names a pane to screen readers.
 */
export function BottomBar(props: { onShow: (key: string) => void; stack: Stack }) {
  const room = signal(0);
  const worded = () =>
    room() === 0 ||
    props.stack.panes.reduce((sum, pane) => sum + wordWidth(titleOf(pane)), 0) <= room();
  return (
    <Surface
      glass
      height="raised"
      onLayout={(event) => room.set(event.bounds.size.width)}
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
          const word = () => worded() || current();
          return (
            <View
              accessibilityLabel={titleOf(pane())}
              accessibilityState={{ selected: current() }}
              onPress={() => props.onShow(pane().key)}
              role="tab"
              style={{
                alignItems: "center",
                flexBasis: word() ? wordWidth(titleOf(pane())) : tokens.control.touch,
                flexGrow: 1,
                flexShrink: word() ? 0 : 1,
                gap: 1,
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              <Icon colour={colour()} name={icon} />
              <If when={word()}>
                <Text bold={current()} colour={colour()} lines={1} size="under">
                  {titleOf(pane())}
                </Text>
              </If>
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
