// The phone's bars on iOS: the navigation, in the system's glass, floating over the page, as
// Apple's guidelines ask of it. The page under it, its panes and their tabs, stays Uraeda's own.
//
// - At the top, a toolbar with no background of its own: the sidebar's toggle on the leading
//   side, the repository's name, which opens the switcher, and on the trailing side the places
//   seldom visited and New, on one piece of glass.
// - At the foot, the system's tab bar, the places, over the page's content, which scrolls beneath
//   it (`underBar.ts`). A tab bar navigates and takes no action: the page's one step is a button
//   of its own beside it, on glass tinted in the accent, the view's one prominent action.
//
// See the phone guide, "iOS".
import { signal, View, type ViewRef } from "nsh";
import { TabBar } from "nsh/mobile";
import type { PaneAction } from "./panes";
import type { RailPlace } from "./Rail";
import { setBarRoom } from "./underBar";
import { Icon, type IconName, Text } from "../controls";
import { Options } from "../controls/Options";
import { keyScope } from "../keys/registry";
import { feltChoice } from "../native";
import { Popover } from "../surfaces";
import { tokens } from "../tokens";

/** A control of the bars: a thumb's size, as round as it is tall. */
const SIZE = 44;

/** The system's glass, the regular one, with a blur where an older system has none. */
const glass = {
  backdropFilter: "blur(20px)",
  borderCurve: "continuous",
  borderRadius: SIZE / 2,
  glassEffect: "regular",
} as const;

/** An icon of a piece of glass: a thumb's target, the accent when it is where the human is. */
function GlassIcon(props: {
  current?: boolean;
  icon: IconName;
  label: string;
  onPress?: () => void;
  ref?: (node: ViewRef) => void;
}) {
  return (
    <View
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.current === true }}
      activeStyle={{ opacity: 0.55 }}
      onPress={props.onPress}
      ref={props.ref}
      role="button"
      style={{ alignItems: "center", height: SIZE, justifyContent: "center", width: SIZE }}
    >
      <Icon
        colour={props.current === true ? tokens.role.action : tokens.role.ink}
        name={props.icon}
      />
    </View>
  );
}

/** The `…` of the toolbar: the places seldom visited, in a menu under it. */
function More(props: { places: ReadonlyArray<RailPlace> }) {
  const open = signal(false);
  const anchor = signal<ViewRef | undefined>(undefined);
  const layer = keyScope({ kind: "layer", name: "More places", on: open });
  return (
    <>
      <GlassIcon
        current={props.places.some((place) => place.current === true)}
        icon="ellipsis"
        label="More places"
        onPress={() => open.set(true)}
        ref={(node) => anchor.set(node)}
      />
      <Popover
        align="end"
        anchor={anchor()}
        name="More places"
        onClose={() => open.set(false)}
        open={open()}
        scope={layer}
        style={{ minWidth: 220, paddingVertical: 6 }}
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
          scope={layer}
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
 * The toolbar: the sidebar's toggle, the repository's name, then the places seldom visited and
 * New on one piece of glass. It has no background: the backdrop shows between its pieces.
 */
export function Toolbar(props: {
  onSidebar?: () => void;
  /** A press on the title: the repositories' switcher. */
  onTitle?: () => void;
  places: ReadonlyArray<RailPlace>;
  /** The repository's name: where the human is, which no pane's title says. */
  title?: string;
}) {
  const on = (where: RailPlace["onPhone"]) =>
    props.places.filter((place) => place.onPhone === where);
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        paddingBottom: 8,
        paddingHorizontal: 12,
        paddingTop: 2,
      }}
      testID="toolbar"
    >
      <If when={props.onSidebar} else={<View style={{ width: SIZE }} />}>
        {(open) => (
          <View style={glass}>
            <GlassIcon icon="panel-left" label="Open the sidebar" onPress={open()} />
          </View>
        )}
      </If>
      <View
        accessibilityLabel={`Repository ${props.title ?? ""}: switch`}
        activeStyle={{ opacity: 0.55 }}
        onPress={props.onTitle}
        role="button"
        style={{
          alignItems: "center",
          flex: 1,
          flexDirection: "row",
          gap: 4,
          height: SIZE,
          justifyContent: "center",
          minWidth: 0,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text bold lines={1}>
            {props.title ?? ""}
          </Text>
        </View>
        <If when={props.onTitle !== undefined}>
          <Icon colour={tokens.role.inkQuiet} name="chevron-down" />
        </If>
      </View>
      <View style={[glass, { flexDirection: "row" }]}>
        <If when={on("more").length > 0}>
          <More places={on("more")} />
        </If>
        <Each key={(place: RailPlace) => place.label} of={on("end")}>
          {(place) => (
            <GlassIcon
              current={place().current}
              icon={place().icon}
              label={place().label}
              onPress={place().onPress}
            />
          )}
        </Each>
      </View>
    </View>
  );
}

/** Apple's symbol for a place's icon, in the system's tab bar: a square for one it has none for. */
const SYMBOLS: Partial<Record<IconName, string>> = {
  clock: "clock",
  "git-branch": "arrow.triangle.branch",
  house: "house",
  inbox: "tray",
  list: "list.bullet",
  "message-square": "bubble.left",
  plug: "powerplug",
  plus: "plus",
  scale: "scalemass",
  settings: "gearshape",
};

/** How tall the step's button is, the tab bar's own glass, and how far under the bar's top. */
const STEP = { height: 56, top: 4 } as const;

/**
 * The step's word on its button, its first, and no icon, as the system's "Done": "Next" of "Next:
 * Q1", so the tabs beside it keep their room. A screen reader hears it whole.
 */
const stepWord = (label: string) => label.split(/[\s:]/)[0] ?? label;

/**
 * The bar at the screen's foot, over the page: the system's tab bar, the places visited most, and
 * beside it the page's one step. The system draws no count on a tab: a place's count follows its
 * name, while the tabs have the bar's whole width.
 */
export function FloatingBar(props: { action?: PaneAction; places: ReadonlyArray<RailPlace> }) {
  const shown = () => props.places.filter((place) => place.onPhone === undefined);
  // The tabs as last drawn, for a tap: a listener reads no record, which nothing would let go.
  let drawn: ReadonlyArray<RailPlace> = [];
  // A page of no tab, a round or the settings, keeps the tab the human came from lit, as the
  // system's apps keep a section's tab while a page of it is pushed: a bar with none lit drew
  // its lens on the first all the same.
  let last = 0;
  const current = () => {
    const at = shown().findIndex((place) => place.current === true);
    if (at !== -1) last = at;
    return Math.min(last, Math.max(0, shown().length - 1));
  };
  return (
    <View
      onLayout={(event) => setBarRoom(event.bounds.size.height)}
      style={{ alignItems: "flex-start", flexDirection: "row" }}
      testID="floating-bar"
    >
      <TabBar
        items={(drawn = shown()).map((place) => ({
          icon: SYMBOLS[place.icon] ?? "square",
          title:
            (place.count ?? 0) > 0 && props.action === undefined
              ? `${place.label} · ${place.count}`
              : place.label,
        }))}
        onChange={({ index }) => {
          feltChoice();
          drawn[index]?.onPress();
        }}
        selectedIndex={current()}
        style={{ flex: 1 }}
        testID="places-bar"
      />
      <If when={props.action}>
        {(action) => (
          <View
            accessibilityLabel={action().label}
            activeStyle={{ opacity: 0.7 }}
            onPress={() => {
              feltChoice();
              action().run();
            }}
            role="button"
            style={[
              glass,
              {
                alignItems: "center",
                borderRadius: STEP.height / 2,
                flexDirection: "row",
                glassTintColor: tokens.role.action,
                height: STEP.height,
                justifyContent: "center",
                // Into the room the tab bar keeps beside its own glass: the tabs get the width.
                marginLeft: -12,
                marginRight: 16,
                marginTop: STEP.top,
                flexShrink: 0,
                minWidth: STEP.height,
                paddingHorizontal: 14,
              },
            ]}
            testID="step"
          >
            <Text bold colour={tokens.role.onAction} lines={1}>
              {stepWord(action().label)}
            </Text>
          </View>
        )}
      </If>
    </View>
  );
}
