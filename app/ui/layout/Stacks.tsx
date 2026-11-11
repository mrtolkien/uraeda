// The layout shell: the frame every screen of the app is drawn in. It takes the panes of the page
// shown (`placeOf(route())`, or `place`), keeps their layout in the visit, and draws it at the
// window's width: on a wide and a semi-wide window the rail, the main stack, the side stack, and
// the status line; on a narrow one the places' bar, one stack holding every pane, and its bar of
// tiles. The rail's, the status line's, and the bars' contents are the app's shell's slots.
import { computed, effect, type Signal, signal, untracked, View } from "nsh";
import { ResizablePanel, ResizablePanelGroup } from "nsh/base";
import { BottomBar, NavBar } from "./bars";
import { FrameKeys } from "./keys";
import {
  fold,
  focus,
  type Layout,
  layoutOf,
  narrowed,
  type Place,
  show,
  type StackName,
  sync,
} from "./layout";
import { actionOf, focusWanted, placeOf } from "./panes";
import { Rail, type RailSlots } from "./Rail";
import { SideRail } from "./SideRail";
import { StackView } from "./Stack";
import { type StatusSlots, StatusLine } from "./StatusLine";
import { device, type DeviceKeys } from "../../store/device";
import { entry, keep, route } from "../../store/history";
import { IconButton, Text } from "../controls";
import { KeyScope } from "../keys/registry";
import { Backdrop, Sheet } from "../surfaces";
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

/** Two values equal as data: what the layout and the place are compared by. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The frame's choices on this device, and their writer. */
const choices = {
  kept: () => device.get("frame") ?? {},
  set: (values: DeviceKeys["frame"]) => device.set("frame", { ...choices.kept(), ...values }),
};

/** Whether the rail is folded: the human's choice, else on all but a wide window. */
const railFolded = () => choices.kept().rail ?? width() !== "wide";

/** Whether the window is narrow: one stack of tabs. */
const narrow = () => width() === "narrow";

export function Stacks(props: StacksProps) {
  const place = computed(() => props.place ?? placeOf(route()), { equals: same });
  // The layout the visit keeps, else the place's default, always made to hold the place's panes.
  const layout = computed(
    () => sync(entry().kept.layout ?? layoutOf(place(), choices.kept().side === true), place()),
    { equals: same },
  );
  const set = (next: Layout) => {
    if (next.folded !== layout().folded) {
      choices.set({ side: next.folded });
    }
    keep({ layout: next });
  };
  const room = signal(0);
  const sideWidth = () => {
    const most = Math.max(SIDE.least, Math.round(room() * 0.6));
    const chosen =
      choices.kept().sideWidth ?? (width() === "wide" ? wideSide(room()) : SIDE.semiWide);
    return Math.min(most, Math.max(SIDE.least, chosen));
  };
  const hasSide = () => layout().side.panes.length > 0;
  const onShow = (key: string) => set(narrow() ? focus(layout(), key) : show(layout(), key));
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

  const stack = (name: StackName) => (
    <StackView
      focus={layout().focus}
      onFocus={onFocus}
      onShow={onShow}
      onTabs={layout().onTabs}
      stack={layout()[name]}
      tabsEnd={
        name === "side" ? (
          <IconButton
            icon="panel-right"
            label="Fold the side stack"
            onPress={() => set(fold(layout(), true))}
          />
        ) : undefined
      }
      testID={`stack-${name}`}
    />
  );

  /** The pane zoomed over both stacks' room. */
  const zoomed = () => {
    const key = layout().zoomed;
    return [...layout().main.panes, ...layout().side.panes].find((pane) => pane.key === key);
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
      <ResizablePanel minSize={320} style={{ paddingRight: tokens.space.gap.wide / 2 }}>
        {stack("main")}
      </ResizablePanel>
      <ResizablePanel
        fixed
        maxSize={Math.max(SIDE.least, Math.round(room() * 0.6))}
        minSize={SIDE.least}
        onResize={({ size }) => choices.set({ sideWidth: Math.round(size) })}
        size={sideWidth()}
        style={{ paddingLeft: tokens.space.gap.wide / 2 }}
        visible={hasSide() && !layout().folded}
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
        <KeyScope name="Panes">
          <FrameKeys
            hasSide={hasSide}
            layout={layout}
            narrow={narrow}
            resize={(by) => choices.set({ sideWidth: sideWidth() + by })}
            set={set}
            toggleRail={() => choices.set({ rail: !railFolded() })}
          />
          <If when={windowWidth() > 0}>
            <If
              when={!narrow()}
              else={
                <View style={{ flex: 1 }}>
                  <If when={props.rail}>
                    {(rail) => (
                      <NavBar
                        onSidebar={rail().sidebar === undefined ? undefined : () => sheet.set(true)}
                        places={rail().places}
                      />
                    )}
                  </If>
                  <View
                    style={{
                      flex: 1,
                      paddingHorizontal: tokens.space.gap.phone,
                      paddingBottom: tokens.space.gap.phone,
                    }}
                  >
                    <StackView
                      focus={layout().focus}
                      lone
                      onFocus={onFocus}
                      onShow={onShow}
                      onTabs={layout().onTabs}
                      stack={narrowed(layout())}
                      testID="stack-one"
                    />
                  </View>
                  <If
                    when={
                      narrowed(layout()).panes.length > 1 ||
                      actionOf(narrowed(layout()).panes) !== undefined
                    }
                  >
                    <BottomBar onShow={onShow} stack={narrowed(layout())} />
                  </If>
                  <Sheet
                    onClose={() => sheet.set(false)}
                    open={sheet()}
                    title={props.rail?.title ?? "Sidebar"}
                  >
                    {props.rail?.sidebar}
                  </Sheet>
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
                      <If when={zoomed()} else={group()}>
                        {(pane) => (
                          <StackView
                            focus={layout().focus}
                            onFocus={onFocus}
                            onShow={onShow}
                            onTabs={false}
                            stack={{ panes: [pane()], shown: pane().key, split: false }}
                            testID="stack-zoomed"
                          />
                        )}
                      </If>
                    </If>
                  </View>
                  <If when={hasSide() && layout().folded}>
                    <SideRail layout={layout()} onShow={(key) => set(focus(layout(), key))} />
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
