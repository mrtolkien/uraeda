// One stack of panes, drawn: as tabs, one pane whose title is the row of its panes' tabs and whose
// body is the pane shown, or split, a pane each, one under the other. A pane hidden behind its tab
// is not drawn at all: it keeps what it shows in the visit (`usePane`, `PaneScroll`), so it comes
// back as it was left.
import {
  effect,
  type JSX,
  type StyleProp,
  signal,
  Text,
  untracked,
  View,
  type ViewRef,
  type ViewStyle,
} from "nsh";
import { ResizablePanel, ResizablePanelGroup } from "nsh/base";
import { Arriving, type Landing } from "./arrival";
import type { PaneRef, Stack } from "./layout";
import { kindOf, type PaneHere, PaneContext, type PaneMark, titleOf } from "./panes";
import { barRoom, reachesBar } from "./underBar";
import { Kbd } from "../controls";
import { KeyScope, registerKey } from "../keys/registry";
import { Pane, type PaneTab } from "../surfaces";
import { focusNext, paneLeft, paneStops, type Stops, StopsContext } from "../surfaces/focus";
import { alpha, tokens } from "../tokens";
import { type WidthClass, widthClass } from "../width";

export type StackViewProps = {
  /** The key of the pane with the focus, wherever it is. */
  focus: string | null;
  /** Only the shown pane's title on its edge: the phone's bottom bar holds the tabs. */
  lone?: boolean;
  /** The key of the pane zoomed over the window: drawn alone, if it is this stack's. */
  zoomed?: string | null;
  onFocus: (key: string) => void;
  onShow: (key: string) => void;
  /** The focus is on the tabs of the focused pane's stack. */
  onTabs: boolean;
  stack: Stack;
  /** Drawn at the end of the tabs' row: the side stack's fold. */
  tabsEnd?: JSX.Element;
  /** The menu of the pane `key`, at the end of its title: the moves, by tap. */
  menu?: (key: string) => JSX.Element;
  /** A long press on a pane's tab: its menu. */
  onTabLongPress?: (key: string) => void;
  /** What a pane's tab calls as the pointer carries it. */
  drag?: (key: string) => PaneTab["drag"];
  /** A split pane's height, dragged. */
  onShare?: (key: string, size: number) => void;
  /** Whether a tab the pointer carries would land here, and is over it. */
  target?: "take" | "over" | null;
  /** Where its panes slide in from when they land: its name in the frame. */
  landing?: Landing;
  viewRef?: (view: ViewRef) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The mark of a pane's tab, read as its kind says. */
export const markOf = (pane: PaneRef): PaneMark => kindOf(pane)?.mark?.(pane.args) ?? {};

/**
 * Tab and Shift+Tab, in a pane's scope: they go through its controls and fields, in order, and
 * around, never into another pane. From a field too, as a dialog's do.
 */
function TabKeys(props: { stops: Stops }) {
  const here = { inField: true, repeat: true } as const;
  registerKey([
    { ...here, keys: "Tab", label: "Next control", run: () => focusNext(props.stops, false) },
    {
      ...here,
      keys: "shift+Tab",
      label: "Previous control",
      run: () => focusNext(props.stops, true),
    },
  ]);
  return null;
}

/** One pane's view, with what it knows of itself, and its keys on while it has the focus. */
function PaneBody(props: { focused: boolean; pane: PaneRef; width: WidthClass }) {
  const spec = kindOf(props.pane);
  const here: PaneHere = {
    focused: () => props.focused,
    key: props.pane.key,
    width: () => props.width,
  };
  if (spec === undefined) {
    return (
      <Text style={{ color: tokens.role.inkQuiet }}>
        No screen declares the pane "{props.pane.kind}".
      </Text>
    );
  }
  const Drawn = spec.view;
  const stops = paneStops();
  effect(() => {
    if (!props.focused) untracked(() => paneLeft(stops));
  });
  return (
    <PaneContext.Provider value={here}>
      <KeyScope kind="pane" name={titleOf(props.pane)} on={() => props.focused}>
        <StopsContext.Provider value={stops}>
          <Drawn args={props.pane.args} focused={props.focused} width={props.width} />
          {/* After the pane's own keys, which the key map lists first. */}
          <TabKeys stops={stops} />
        </StopsContext.Provider>
      </KeyScope>
    </PaneContext.Provider>
  );
}

/** A tab of a pane, with its icon and its mark. */
function tabOf(pane: PaneRef, current: boolean, onPress: () => void): PaneTab {
  const mark = markOf(pane);
  const icon = kindOf(pane)?.icon;
  return {
    current,
    icon,
    more: mark.count === undefined ? undefined : `· ${mark.count}`,
    needs: mark.needs,
    onPress,
    running: !current && mark.running === true,
    testID: `tab-${pane.key}`,
    title: titleOf(pane),
  };
}

/**
 * About how wide a tab is drawn, in points, with its title or, `compact`, its icon alone. Titles
 * are in the interface's monospace font, whose characters are a little over six tenths of its
 * size wide.
 */
function tabWidth(tab: PaneTab, compact: boolean) {
  const character = tokens.type.size * 0.62;
  const words = tab.title.length + (tab.more === undefined ? 0 : tab.more.length + 1);
  const icon = tab.icon === undefined ? 0 : 16 + 6;
  const padding = tokens.pane.titlePadding[0] + tokens.pane.titlePadding[1] + 1;
  return compact && tab.icon !== undefined ? padding + 16 : padding + icon + words * character;
}

/**
 * The tabs as they fit in `room` points, `extra` of them taken by what follows them. The shown
 * tab keeps its icon and title; the others first leave their icons out, and keep their titles,
 * which say more; past that, they keep their titles nearest the shown tab first, while the row
 * fits, and a tab past that draws its icon alone, its title in its tip and to screen readers, so the
 * row never runs past its pane.
 */
export function fitted(tabs: ReadonlyArray<PaneTab>, room: number, extra: number) {
  const free = room - 16 - extra;
  const whole = tabs.reduce((sum, tab) => sum + tabWidth(tab, false), 0);
  if (room === 0 || whole <= free) {
    return tabs;
  }
  const shown = Math.max(
    0,
    tabs.findIndex((tab) => tab.current),
  );
  const words = tabs.map((tab, at) => (at === shown ? tab : { ...tab, icon: undefined }));
  if (words.reduce((sum, tab) => sum + tabWidth(tab, false), 0) <= free) {
    return words;
  }
  const named = new Set([shown]);
  let width = tabs.reduce((sum, tab, at) => sum + tabWidth(tab, !named.has(at)), 0);
  const nearest = tabs
    .map((_, at) => at)
    .filter((at) => at !== shown)
    .toSorted((a, b) => Math.abs(a - shown) - Math.abs(b - shown) || a - b);
  for (const at of nearest) {
    const more = tabWidth(tabs[at], false) - tabWidth(tabs[at], true);
    if (width + more > free) {
      break;
    }
    named.add(at);
    width += more;
  }
  return tabs.map((tab, at) => (named.has(at) ? tab : { ...tab, compact: true }));
}

/** What the keys do on the tabs, beside them, while the focus is there. */
function TabKeysHint() {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 6, paddingHorizontal: 10 }}>
      <Kbd keys="h" />
      <Kbd keys="l" />
      <Text style={{ color: tokens.role.inkFaint, fontFamily: tokens.type.body }}>tab</Text>
    </View>
  );
}

/** The padding of a pane's body: none on the sides for a pane that draws to its edges. */
const bodyOf = (pane: PaneRef) => {
  const flush = kindOf(pane)?.flush === true;
  // Under a bar that floats over the page, a pane no scroller of which goes on beneath the bar
  // keeps its content above it (`underBar.ts`).
  const under = reachesBar(pane.key) ? 0 : barRoom();
  if (under === 0) return flush ? { paddingBottom: 1, paddingHorizontal: 0 } : undefined;
  return flush
    ? { paddingBottom: 1 + under, paddingHorizontal: 0 }
    : { paddingBottom: tokens.space.panePadding - 1 + under };
};

/** The room a pane's menu takes at the end of its title, in points. */
const MENU = 36;

/** What a stack shows over itself while a tab carried by the pointer would land in it. */
function DropTarget(props: { over: boolean }) {
  return (
    <View
      style={{
        alignItems: "center",
        pointerEvents: "none",
        backgroundColor: props.over ? alpha(tokens.light.focus, 0.12) : undefined,
        borderColor: tokens.light.focus,
        borderWidth: props.over ? 2 : 1,
        bottom: 0,
        justifyContent: "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: tokens.pane.titleRise,
      }}
      testID="drop-target"
    >
      <Text style={{ color: tokens.light.focus, fontFamily: tokens.type.body }}>
        {props.over ? "Let go to move it here" : "Drop here"}
      </Text>
    </View>
  );
}

export function StackView(props: StackViewProps) {
  // The stack's own width, which its panes lay out by: known once it is laid out, and its panes
  // are drawn only then, so none is made at a phone's width first, then made again.
  const room = signal(0);
  const width = () => widthClass(room());
  const has = (key: string | null) => props.stack.panes.some((pane) => pane.key === key);
  const shown = () => props.stack.panes.find((pane) => pane.key === props.stack.shown);
  const lit = () => has(props.focus);
  /** A pane of this stack is zoomed: it is drawn alone, with its own title. */
  const zoomedHere = () => props.zoomed != null && has(props.zoomed);
  /** A pane's tab, with its long press and its drag. */
  const tab = (one: PaneRef, current: boolean, onPress: () => void): PaneTab =>
    props.lone === true
      ? // The phone's one pane: its title is a label, and its menu the `…` beside it, a thumb's
        // size, where a press of a title 25 points high showed the pane already shown.
        { ...tabOf(one, current, onPress), onPress: undefined }
      : {
          ...tabOf(one, current, onPress),
          drag: props.drag?.(one.key),
          onLongPress:
            props.onTabLongPress === undefined ? undefined : () => props.onTabLongPress?.(one.key),
        };

  return (
    <View
      onLayout={(event) => room.set(event.bounds.size.width)}
      ref={props.viewRef}
      style={[{ flex: 1, minWidth: 0 }, props.style]}
      testID={props.testID}
    >
      <Arriving name={props.landing ?? "main"}>
        <If
          when={props.stack.split && !zoomedHere()}
          else={
            <If when={shown()}>
              {(pane) => (
                <Pane
                  body={bodyOf(pane())}
                  focused={lit()}
                  onPress={() => props.onFocus(pane().key)}
                  running={markOf(pane()).running}
                  style={{ flex: 1 }}
                  tabs={fitted(
                    (props.lone === true || zoomedHere() ? [pane()] : props.stack.panes).map(
                      (one) => tab(one, one.key === pane().key, () => props.onShow(one.key)),
                    ),
                    room(),
                    (props.tabsEnd === undefined ? 0 : 36) +
                      (props.menu === undefined ? 0 : MENU) +
                      (props.onTabs && lit() ? 110 : 0),
                  )}
                  tabsEnd={
                    <>
                      {props.onTabs && lit() ? <TabKeysHint /> : undefined}
                      {props.menu?.(pane().key)}
                      {props.tabsEnd}
                    </>
                  }
                >
                  <Each key={(one: PaneRef) => one.key} of={room() > 0 ? [pane()] : []}>
                    {(one) => (
                      <PaneBody
                        focused={props.focus === one().key && !props.onTabs}
                        pane={one()}
                        width={width()}
                      />
                    )}
                  </Each>
                </Pane>
              )}
            </If>
          }
        >
          <SplitPanes {...props} tab={tab} width={width()} ready={room() > 0} />
        </If>
      </Arriving>
      <If when={props.target}>{(target) => <DropTarget over={target() === "over"} />}</If>
    </View>
  );
}

/**
 * A split stack: its panes one under the other, in the heights the human dragged them to, else in
 * equal shares; the border between two drags.
 */
function SplitPanes(
  props: StackViewProps & {
    ready: boolean;
    tab: (one: PaneRef, current: boolean, onPress: () => void) => PaneTab;
    width: WidthClass;
  },
) {
  return (
    <ResizablePanelGroup
      axis="vertical"
      handleAccessibilityLabel="Resize the panes"
      renderHandle={(handle) => (
        <View
          style={{
            backgroundColor: handle.state === "idle" ? "transparent" : tokens.light.focus,
            height: 1,
            width: "100%",
          }}
        />
      )}
    >
      <Each key={(one: PaneRef) => one.key} of={props.stack.panes}>
        {(one) => (
          <ResizablePanel
            minSize={96}
            onResize={({ size }) => props.onShare?.(one().key, size)}
            size={props.stack.sizes?.[one().key] ?? kindOf(one())?.height ?? null}
            style={{ paddingVertical: (tokens.space.gap.wide - 2) / 2 }}
          >
            <Pane
              body={bodyOf(one())}
              focused={props.focus === one().key}
              onPress={() => props.onFocus(one().key)}
              running={markOf(one()).running}
              style={{ flex: 1 }}
              tabs={[props.tab(one(), true, () => props.onFocus(one().key))]}
              tabsEnd={
                <>
                  {props.menu?.(one().key)}
                  {/* The stack's own, as the side stack's fold, on its first pane's title. */}
                  {props.stack.panes[0]?.key === one().key ? props.tabsEnd : undefined}
                </>
              }
            >
              <If when={props.ready}>
                <PaneBody focused={props.focus === one().key} pane={one()} width={props.width} />
              </If>
            </Pane>
          </ResizablePanel>
        )}
      </Each>
    </ResizablePanelGroup>
  );
}
