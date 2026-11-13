// The layout shell: the frame every screen of the app is drawn in. It takes the panes of the page
// shown (`placeOf(route())`, or `place`), keeps their layout in the visit, and draws it at the
// window's width: on a wide and a semi-wide window the rail, the main stack, the side stack, and
// the status line; on a narrow one the places' bar, one stack holding every pane, and its bar of
// tiles. The rail's, the status line's, and the bars' contents are the app's shell's slots.
import {
  computed,
  effect,
  type Signal,
  signal,
  untracked,
  View,
  type ViewRef,
  windowSize,
} from "nsh";
import { ResizablePanel, ResizablePanelGroup } from "nsh/base";
import { BottomBar, NavBar } from "./bars";
import { kindOfKey } from "./arrangement";
import { tabDrags } from "./drag";
import { choices, frameState, same } from "./frame";
import { Drawer } from "./Drawer";
import { FloatingBar, Toolbar } from "./iosBars";
import { besideOffer } from "./here";
import { FrameKeys } from "./keys";
import {
  fold,
  focus,
  type Layout,
  narrowed,
  type Place,
  show,
  type StackName,
  stackOf,
} from "./layout";
import { menuEntries, MoveKeys } from "./moveKeys";
import { share } from "./moves";
import { actionOf, focusWanted, placeOf } from "./panes";
import { Rail, type RailSlots } from "./Rail";
import { SideRail } from "./SideRail";
import { StackView } from "./Stack";
import { swipeBack } from "./swipeBack";
import { setBarRoom } from "./underBar";
import { type StatusSlots, StatusLine } from "./StatusLine";
import { route } from "../../store/history";
import { IconButton, Menu, Text } from "../controls";
import { KeyScope } from "../keys/registry";
import { ios } from "../native";
import { aboveHome, Backdrop, keyboardUp, safe, Sheet } from "../surfaces";
import { tokens } from "../tokens";
import { measured, width, windowWidth } from "../width";

export type StacksProps = {
  /** The panes to draw: the page shown's, by `placeOf`, unless given, as the gallery gives its own. */
  place?: Place;
  rail?: RailSlots;
  status?: StatusSlots;
};

/**
 * The side stack's width until the human changes it, and its limits, in points. On a wide window
 * it takes 400, and up to 440 while the main stack keeps `reading`, the width a reading pane's
 * prose and its room need: three tabs' titles then fit, as the feature page's and Git's.
 */
const SIDE = { least: 280, semiWide: 340, wide: 400, roomy: 440, reading: 680 } as const;

/** The side stack's width on a wide window, by the rule above, in `room` points for both. */
const wideSide = (room: number) =>
  Math.min(SIDE.roomy, Math.max(SIDE.wide, room - SIDE.reading - tokens.space.gap.wide));

/** Whether the rail is folded: the human's choice, else on all but a wide window. */
const railFolded = () => choices.kept().rail ?? width() !== "wide";

/** Whether the window is narrow: one stack of tabs. */
const narrow = () => width() === "narrow";

/** The layout the frame draws now: `undefined` before it is drawn. */
const drawn = signal<Layout | undefined>(undefined);
export const frameLayout = () => drawn();

// oxlint-disable-next-line max-lines-per-function -- the two stacks' moves, focus, and markup share one scope; each stack's markup can be a component
export function Stacks(props: StacksProps) {
  const place = computed(() => props.place ?? placeOf(route()), { equals: same });
  const { layout, mover, set } = frameState(place, narrow);
  effect(() => drawn.set(layout()));
  /** The pane whose menu is open, by its key. */
  const menuOf = signal<string | null>(null);
  const views: Partial<Record<StackName, ViewRef>> = {};
  const drags = tabDrags(layout, (next) => void mover.move(next), views);
  /** The menu of the pane `key`: the moves, each with its key. Opening it focuses the pane. */
  const menu = (key: string) => (
    <Menu
      entries={menuOf() === key ? menuEntries(mover, besideOffer(key)) : []}
      label="Move the pane"
      onOpenChange={(open) => {
        if (open) onFocus(key);
        menuOf.set(open ? key : null);
      }}
      shown={menuOf() === key}
      testID={`pane-menu-${kindOfKey(key)}`}
    />
  );
  const onTabLongPress = (key: string) => {
    onFocus(key);
    menuOf.set(key);
  };
  /** Whether a tab carried by the pointer would land in `name`, and is over it. */
  const target = (name: StackName) =>
    drags.takes(name) ? (drags.over() === name ? "over" : "take") : null;
  const room = signal(0);
  const sideWidth = () => {
    const most = Math.max(SIDE.least, Math.round(room() * 0.6));
    const chosen =
      choices.kept().sideWidth ?? (width() === "wide" ? wideSide(room()) : SIDE.semiWide);
    return Math.min(most, Math.max(SIDE.least, chosen));
  };
  const hasSide = () => layout().side.panes.length > 0;
  /** The side stack is drawn: it has a pane and is not folded, or a tab carried may land there. */
  const sideShown = () => (hasSide() && !layout().folded) || drags.takes("side");
  const onShow = (key: string) => set(narrow() ? focus(layout(), key) : show(layout(), key));
  /** A split pane's height, dragged. */
  const onShare = (key: string, size: number) => set(share(layout(), key, size));
  const onFocus = (key: string) => {
    if (layout().focus !== key || layout().onTabs) {
      set(focus(layout(), key));
    }
  };
  // A pane's view asked for the focus to go to a pane: it goes, once.
  effect(() => {
    const wanted = focusWanted();
    if (wanted === null) return;
    untracked(() => {
      focusWanted.set(null);
      onFocus(wanted);
    });
  });
  const sheet: Signal<boolean> = signal(false);
  // On iOS, a swipe from the left edge goes back, unless a sheet is over the page.
  const swipe = swipeBack(() => ios && narrow() && !sheet());
  /** The phone's bottom bar: for several panes or a pane's action, under the keyboard while up. */
  const barShown = () =>
    !keyboardUp() &&
    (narrowed(layout()).panes.length > 1 || actionOf(narrowed(layout()).panes) !== undefined);
  /**
   * On iOS the navigation floats over the page, in the system's glass: the places' tab bar at the
   * foot, which the page's content scrolls beneath, gone while the keyboard is up.
   */
  const floats = () => ios && props.rail !== undefined;
  const barFloats = () => floats() && !keyboardUp();
  effect(() => {
    if (!barFloats()) setBarRoom(0);
  });

  const stack = (name: StackName) => (
    <StackView
      drag={drags.of}
      focus={layout().focus}
      landing={name}
      menu={menu}
      onFocus={onFocus}
      onShare={onShare}
      onShow={onShow}
      onTabLongPress={onTabLongPress}
      onTabs={layout().onTabs}
      stack={layout()[name]}
      target={target(name)}
      viewRef={(view) => (views[name] = view)}
      zoomed={layout().zoomed}
      tabsEnd={
        name === "side" ? (
          <IconButton
            icon="panel-right"
            label="Fold the side stack"
            onPress={() => mover.move(fold(layout(), true))}
          />
        ) : undefined
      }
      testID={`stack-${name}`}
    />
  );

  /**
   * The stack of the pane zoomed over both stacks' room, which takes it whole: the other stack's
   * panel is hidden, so the zoomed pane is not drawn again, and a web view or a page in it stays.
   */
  const zoomedIn = () => {
    const key = layout().zoomed;
    return key === null ? null : stackOf(layout(), key);
  };
  /** The two stacks side by side, the side one's edge dragged to resize it. */
  const group = () => (
    <ResizablePanelGroup
      axis="horizontal"
      handleAccessibilityLabel="Resize the side stack"
      renderHandle={(handle) => (
        <View
          style={{
            backgroundColor: handle.state === "idle" ? "transparent" : tokens.light.focus,
            height: "100%",
            width: 1,
          }}
        />
      )}
    >
      <ResizablePanel
        minSize={320}
        style={{ paddingRight: zoomedIn() === null && sideShown() ? tokens.space.gap.wide / 2 : 0 }}
        visible={zoomedIn() !== "side"}
      >
        {stack("main")}
      </ResizablePanel>
      <ResizablePanel
        fixed={zoomedIn() !== "side"}
        maxSize={zoomedIn() === "side" ? null : Math.max(SIDE.least, Math.round(room() * 0.6))}
        minSize={SIDE.least}
        onResize={({ size }) => choices.set({ sideWidth: Math.round(size) })}
        size={zoomedIn() === "side" ? null : sideWidth()}
        style={{ paddingLeft: zoomedIn() === null ? tokens.space.gap.wide / 2 : 0 }}
        visible={zoomedIn() === "side" || (zoomedIn() === null && sideShown())}
      >
        {stack("side")}
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <Backdrop>
      <View
        onLayout={(event) => measured(event.bounds.size.width)}
        style={{ flex: 1 }}
        testID="frame"
      >
        <KeyScope name="Layout">
          <MoveKeys mover={mover} />
          <FrameKeys
            hasSide={hasSide}
            layout={layout}
            narrow={narrow}
            resize={(by) => choices.set({ sideWidth: sideWidth() + by })}
            set={(next) => void mover.move(next)}
            toggleRail={() => choices.set({ rail: !railFolded() })}
          />
          <If when={windowWidth() > 0}>
            <If
              when={!narrow()}
              else={
                // Clear of the status bar, the rounded corners, and the keyboard while it is up.
                <View
                  style={{
                    flex: 1,
                    paddingBottom: safe.keyboard,
                    paddingLeft: safe.left,
                    paddingRight: safe.right,
                    paddingTop: safe.top,
                  }}
                >
                  <If when={props.rail}>
                    {(rail) => (
                      <If
                        when={ios}
                        else={
                          <NavBar
                            onSidebar={
                              rail().sidebar === undefined ? undefined : () => sheet.set(true)
                            }
                            places={rail().places}
                          />
                        }
                      >
                        <Toolbar
                          onSidebar={
                            rail().sidebar === undefined ? undefined : () => sheet.set(true)
                          }
                          onTitle={rail().onTitle}
                          places={rail().places}
                          title={rail().title}
                        />
                      </If>
                    )}
                  </If>
                  <View
                    {...swipe.props}
                    style={{
                      flex: 1,
                      transform: [{ translateX: swipe.by() }],
                      paddingHorizontal: tokens.space.gap.phone,
                      // Under a floating bar the page goes on to the screen's foot, its last
                      // border past it: its content scrolls beneath the bar. Else its end is
                      // above the home indicator, where no bar stands under it.
                      marginBottom: barFloats() ? -2 : 0,
                      paddingBottom: barFloats()
                        ? 0
                        : barShown() || keyboardUp()
                          ? tokens.space.gap.phone
                          : aboveHome(tokens.space.gap.phone),
                    }}
                  >
                    {/* On iOS the panes are the stack's own tabs, as on a wide window: the bar
                        at the foot is the places'. */}
                    <StackView
                      focus={layout().focus}
                      lone={!floats()}
                      // A phone's one stack has nowhere to move a pane to: on iOS its tabs
                      // have no menu, which held the layout's resets alone.
                      menu={floats() ? undefined : menu}
                      onFocus={onFocus}
                      onTabLongPress={floats() ? undefined : onTabLongPress}
                      onShow={onShow}
                      onTabs={layout().onTabs}
                      stack={narrowed(layout())}
                      testID="stack-one"
                    />
                  </View>
                  <If
                    when={floats()}
                    else={
                      <If when={barShown()}>
                        <BottomBar onShow={onShow} stack={narrowed(layout())} />
                      </If>
                    }
                  >
                    <If when={barFloats()}>
                      <View style={{ bottom: 0, left: 0, position: "absolute", right: 0 }}>
                        <FloatingBar
                          action={actionOf(narrowed(layout()).panes)}
                          places={props.rail?.places ?? []}
                        />
                      </View>
                    </If>
                  </If>
                  <If
                    when={ios}
                    else={
                      <Sheet
                        onClose={() => sheet.set(false)}
                        open={sheet()}
                        // The sidebar's panes fill what holds them: a sheet as tall as its
                        // content had none, and showed its title alone.
                        style={{ height: Math.round(windowSize().height * 0.75) }}
                        title={props.rail?.title ?? "Sidebar"}
                      >
                        {props.rail?.sidebar}
                      </Sheet>
                    }
                  >
                    {/* On iOS the sidebar is a drawer from the leading edge, as on an iPhone. */}
                    <Drawer
                      onClose={() => sheet.set(false)}
                      onTitle={props.rail?.onTitle}
                      open={sheet()}
                      title={props.rail?.title ?? "Uraeda"}
                    >
                      {props.rail?.sidebar}
                    </Drawer>
                  </If>
                </View>
              }
            >
              <View style={{ flex: 1, gap: tokens.space.gap.wide - 2 }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    gap: tokens.space.gap.wide,
                    paddingHorizontal: tokens.space.gap.wide,
                    paddingTop: tokens.space.gap.wide,
                  }}
                >
                  <If when={props.rail}>
                    {(rail) => (
                      <Rail
                        bar={rail().bar}
                        folded={railFolded()}
                        onTitle={rail().onTitle}
                        onFold={(folded) => choices.set({ rail: folded })}
                        places={rail().places}
                        sidebar={rail().sidebar}
                        title={rail().title}
                      />
                    )}
                  </If>
                  <View
                    onLayout={(event) => room.set(event.bounds.size.width)}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <If when={layout().main.panes.length > 0} else={<Empty />}>
                      {group()}
                    </If>
                  </View>
                  <If when={hasSide() && layout().folded}>
                    <SideRail
                      layout={layout()}
                      onShow={(key) => mover.move(focus(layout(), key))}
                    />
                  </If>
                </View>
                <View
                  style={{
                    paddingBottom: tokens.space.gap.wide / 2,
                    paddingHorizontal: tokens.space.gap.wide,
                  }}
                >
                  {/* Each slot read where it is drawn: a spread would read them once. */}
                  <StatusLine
                    end={props.status?.end}
                    mode={props.status?.mode}
                    place={props.status?.place}
                    start={props.status?.start}
                  />
                </View>
              </View>
            </If>
          </If>
        </KeyScope>
      </View>
    </Backdrop>
  );
}

/** A page that declares no pane. */
function Empty() {
  return (
    <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
      <Text tone="quiet">No screen draws this page yet.</Text>
    </View>
  );
}
