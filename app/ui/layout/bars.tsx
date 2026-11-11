// The phone's two bars, on a narrow window: at the top the places, as a terminal's tab line, with
// the sidebar's toggle on its far left, the places seldom visited in the menu of a `…`, so the bar
// holds a phone's width without scrolling; at the foot the panes of the one stack, as tiles of glass,
// an icon over a word each, the shown one in the accent, or icons alone where the words do not fit. Both are the frame's, as the rail and the
// status line are on a wider window.
import { Scroll, signal, View, type ViewRef } from "nsh";
import type { PaneRef, Stack } from "./layout";
import { actionOf, kindOf, titleOf } from "./panes";
import type { RailPlace } from "./Rail";
import { markOf } from "./Stack";
import { Icon, Text } from "../controls";
import { Options } from "../controls/Options";
import { Popover, Surface } from "../surfaces";
import { tokens } from "../tokens";

/** A tab of the top bar: an icon, and its count, lit when `current`, with a line under it. */
function Tab(props: {
  count?: number;
  current: boolean;
  icon: RailPlace["icon"];
  label: string;
  needs?: boolean;
  onPress: () => void;
  ref?: (node: ViewRef) => void;
}) {
  return (
    <View
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.current }}
      onPress={props.onPress}
      ref={props.ref}
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
      <Icon colour={props.current ? tokens.role.action : tokens.role.inkQuiet} name={props.icon} />
      <If when={(props.count ?? 0) > 0}>
        <Text
          bold={props.needs === true}
          colour={props.needs === true ? tokens.light.needs : undefined}
          size="under"
          tone="quiet"
        >
          {String(props.count)}
        </Text>
      </If>
      <View
        style={{
          backgroundColor: props.current ? tokens.role.action : "transparent",
          bottom: -1,
          height: 2,
          left: 0,
          position: "absolute",
          right: 0,
        }}
      />
    </View>
  );
}

/** A place's tab. */
function PlaceTab(props: { place: RailPlace }) {
  return (
    <Tab
      count={props.place.count}
      current={props.place.current === true}
      icon={props.place.icon}
      label={props.place.label}
      needs={props.place.needs}
      onPress={props.place.onPress}
    />
  );
}

/**
 * The `…`: the places seldom visited, in a menu under it. It is the current tab while one of them
 * is shown, and its count is theirs.
 */
function MoreTab(props: { places: ReadonlyArray<RailPlace> }) {
  const open = signal(false);
  let anchor: ViewRef | undefined;
  const count = () => props.places.reduce((sum, place) => sum + (place.count ?? 0), 0);
  return (
    <>
      <Tab
        count={count()}
        current={props.places.some((place) => place.current === true)}
        icon="ellipsis"
        label="More places"
        needs={props.places.some((place) => place.needs === true && (place.count ?? 0) > 0)}
        onPress={() => open.set(true)}
        ref={(node) => (anchor = node)}
      />
      <Popover
        align="end"
        anchor={anchor}
        name="More places"
        onClose={() => open.set(false)}
        open={open()}
        style={{ minWidth: 200, paddingVertical: 4 }}
      >
        <Options
          onPick={(at) => {
            open.set(false);
            props.places[at]?.onPress();
          }}
          rows={props.places.map((place) => ({
            hint: place.count ? String(place.count) : undefined,
            icon: place.icon,
            label: place.label,
            picked: place.current === true,
          }))}
          start={Math.max(
            0,
            props.places.findIndex((place) => place.current === true),
          )}
        />
      </Popover>
    </>
  );
}

/**
 * The top bar: the sidebar's toggle, then each place's icon and count, the current one lit; the
 * places `onPhone: "more"` in the `…`'s menu, and those `onPhone: "end"` after it.
 */
export function NavBar(props: { onSidebar?: () => void; places: ReadonlyArray<RailPlace> }) {
  const on = (where: RailPlace["onPhone"]) =>
    props.places.filter((place) => place.onPhone === where);
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
      {/* On a phone narrower than the bar's tabs, they scroll sideways, never cut. */}
      <Scroll horizontal scrollbar={false} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", flexGrow: 1, justifyContent: "space-between" }}>
          <Each key={(place: RailPlace) => place.label} of={on(undefined)}>
            {(place) => <PlaceTab place={place()} />}
          </Each>
          <If when={on("more").length > 0}>
            <MoreTab places={on("more")} />
          </If>
          <Each key={(place: RailPlace) => place.label} of={on("end")}>
            {(place) => <PlaceTab place={place()} />}
          </Each>
        </View>
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
 * cut word reads worse than none, and the icon still names a pane to screen readers. The page's
 * one action, as a job's "Run now", ends the bar, tinted, after a rule: a press runs it.
 */
export function BottomBar(props: { onShow: (key: string) => void; stack: Stack }) {
  const room = signal(0);
  const worded = () =>
    room() === 0 ||
    props.stack.panes.reduce((sum, pane) => sum + wordWidth(titleOf(pane)), 0) +
      (actionOf(props.stack.panes) === undefined
        ? 0
        : wordWidth(actionOf(props.stack.panes)?.label ?? "")) <=
      room();
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
      <If when={actionOf(props.stack.panes)}>
        {(action) => (
          <View
            accessibilityLabel={action().label}
            onPress={() => action().run()}
            role="button"
            style={{
              alignItems: "center",
              backgroundColor: tokens.control.tint(tokens.role.action),
              borderLeftColor: tokens.role.ruleQuiet,
              borderLeftWidth: 1,
              flexBasis: wordWidth(action().label),
              flexShrink: 0,
              gap: 1,
              justifyContent: "center",
            }}
            testID="bottom-bar-action"
          >
            <Icon colour={tokens.role.action} name={action().icon} />
            <Text bold colour={tokens.role.action} lines={1} size="under">
              {action().label}
            </Text>
          </View>
        )}
      </If>
    </Surface>
  );
}
