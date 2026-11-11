// The navigation at the window's left, on a wide and a semi-wide window: the places of the app and,
// unfolded, what the app's shell shows under them (the features, what needs the human, the usage).
// Folded, it is a rail of the places' icons. It is the frame's, not a pane: the keys reach it by
// its places' own sequences (`g h`, `g i`), not by `h`.
import { type JSX, View } from "nsh";
import { Icon, IconButton, type IconName, Text } from "../controls";
import { Pane } from "../surfaces";
import { tokens } from "../tokens";

/** A place the rail leads to. */
export type RailPlace = {
  /** A count after its name: what waits there. */
  count?: number;
  /** It is the place shown. */
  current?: boolean;
  icon: IconName;
  /** The keys that go there, as typed, `g h`: shown at the row's end, faint. */
  keys?: string;
  label: string;
  /** Its count is of what waits on the human: in `needs-you`. */
  needs?: boolean;
  onPress: () => void;
};

/** What the app's shell puts in the rail: its slots. */
export type RailSlots = {
  /** At the folded rail's foot, under the places' icons: what stands in for the sidebar. */
  bar?: JSX.Element;
  /** A press on the title: the repositories' switcher. */
  onTitle?: () => void;
  places: ReadonlyArray<RailPlace>;
  /** Under the places, unfolded: the shell's own panes, as Features and Usage. */
  sidebar?: JSX.Element;
  /** The places' pane's title: the repository's name. */
  title?: string;
};

/** The rail's width, folded and unfolded, in points. */
export const RAIL = { folded: 40, open: 248 } as const;

/** One place, unfolded: its icon, its name, and its count, the current one lit at its start. */
function PlaceRow(props: { place: RailPlace }) {
  const current = () => props.place.current === true;
  return (
    <View
      accessibilityLabel={props.place.label}
      accessibilityState={{ selected: current() }}
      onPress={props.place.onPress}
      role="link"
      style={{
        alignItems: "center",
        backgroundColor: current() ? tokens.row.selected : undefined,
        flexDirection: "row",
        gap: 8,
        height: tokens.space.row,
        paddingHorizontal: 8,
      }}
    >
      <View
        style={{
          backgroundColor: current() ? tokens.light.focus : "transparent",
          bottom: 0,
          boxShadow: current() ? tokens.row.barGlow : undefined,
          left: 0,
          position: "absolute",
          top: 0,
          width: tokens.row.bar,
        }}
      />
      <Icon
        colour={current() ? tokens.role.action : tokens.role.inkQuiet}
        name={props.place.icon}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text bold={current()} lines={1} tone={current() ? "ink" : "quiet"}>
          {props.place.label}
        </Text>
      </View>
      <If when={props.place.keys}>
        {(keys) => (
          <Text font="code" size="under" tone="faint">
            {keys().replace(" ", "")}
          </Text>
        )}
      </If>
      <If when={props.place.count !== undefined && props.place.count > 0}>
        <Text
          bold={props.place.needs === true}
          colour={props.place.needs === true ? tokens.light.needs : undefined}
          tone="faint"
        >
          {String(props.place.count)}
        </Text>
      </If>
    </View>
  );
}

/** The rail: unfolded, the places' pane and the sidebar's; folded, a column of icons. */
export function Rail(props: RailSlots & { folded: boolean; onFold: (folded: boolean) => void }) {
  return (
    <If
      when={!props.folded}
      else={
        <View
          style={{
            alignItems: "center",
            gap: 4,
            paddingTop: tokens.pane.titleRise,
            width: RAIL.folded,
          }}
        >
          <IconButton
            icon="panel-left"
            label="Unfold the sidebar"
            onPress={() => props.onFold(false)}
          />
          <View
            style={{
              backgroundColor: tokens.role.ruleQuiet,
              height: 1,
              marginVertical: 4,
              width: 20,
            }}
          />
          <Each key={(place: RailPlace) => place.label} of={props.places}>
            {(place) => (
              <IconButton
                icon={place().icon}
                label={place().label}
                onPress={place().onPress}
                selected={place().current === true}
              />
            )}
          </Each>
          {props.bar}
        </View>
      }
    >
      <View style={{ gap: tokens.space.gap.wide - 2, width: RAIL.open }}>
        <Pane
          body={{ gap: 0, paddingHorizontal: 0 }}
          tabs={[
            {
              current: true,
              icon: props.onTitle === undefined ? undefined : "folder-git-2",
              onPress: props.onTitle,
              title: props.title ?? "Places",
            },
          ]}
          tabsEnd={
            <IconButton
              icon="panel-left"
              label="Fold the sidebar"
              onPress={() => props.onFold(true)}
            />
          }
        >
          <Each key={(place: RailPlace) => place.label} of={props.places}>
            {(place) => <PlaceRow place={place()} />}
          </Each>
        </Pane>
        {props.sidebar}
      </View>
    </If>
  );
}
