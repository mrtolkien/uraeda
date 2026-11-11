// One stack of panes, drawn: as tabs, one pane whose title is the row of its panes' tabs and whose
// body is the pane shown, or split, a pane each, one under the other. A pane hidden behind its tab
// is not drawn at all: it keeps what it shows in the visit (`usePane`, `PaneScroll`), so it comes
// back as it was left.
import { type JSX, type StyleProp, signal, Text, View, type ViewStyle } from "nsh";
import type { PaneRef, Stack } from "./layout";
import { kindOf, type PaneHere, PaneContext, type PaneMark, titleOf } from "./panes";
import { Kbd } from "../controls";
import { KeyScope } from "../keys/registry";
import { Pane, type PaneTab } from "../surfaces";
import { tokens } from "../tokens";
import { type WidthClass, widthClass } from "../width";

export type StackViewProps = {
  /** The key of the pane with the focus, wherever it is. */
  focus: string | null;
  /** Only the shown pane's title on its edge: the phone's bottom bar holds the tabs. */
  lone?: boolean;
  onFocus: (key: string) => void;
  onShow: (key: string) => void;
  /** The focus is on the tabs of the focused pane's stack. */
  onTabs: boolean;
  stack: Stack;
  /** Drawn at the end of the tabs' row: the side stack's fold. */
  tabsEnd?: JSX.Element;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The mark of a pane's tab, read as its kind says. */
export const markOf = (pane: PaneRef): PaneMark => kindOf(pane)?.mark?.(pane.args) ?? {};

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
  return (
    <PaneContext.Provider value={here}>
      <KeyScope kind="pane" name={titleOf(props.pane)} on={() => props.focused}>
        <Drawn args={props.pane.args} focused={props.focused} width={props.width} />
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
const bodyOf = (pane: PaneRef) =>
  kindOf(pane)?.flush === true ? { paddingBottom: 1, paddingHorizontal: 0 } : undefined;

export function StackView(props: StackViewProps) {
  // The stack's own width, which its panes lay out by: known once it is laid out, and its panes
  // are drawn only then, so none is made at a phone's width first, then made again.
  const room = signal(0);
  const width = () => widthClass(room());
  const has = (key: string | null) => props.stack.panes.some((pane) => pane.key === key);
  const shown = () => props.stack.panes.find((pane) => pane.key === props.stack.shown);
  const lit = () => has(props.focus);

  return (
    <View
      onLayout={(event) => room.set(event.bounds.size.width)}
      style={[{ flex: 1, gap: tokens.space.gap.wide - 2, minWidth: 0 }, props.style]}
      testID={props.testID}
    >
      <If
        when={props.stack.split}
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
                  (props.lone === true ? [pane()] : props.stack.panes).map((one) =>
                    tabOf(one, one.key === pane().key, () => props.onShow(one.key)),
                  ),
                  room(),
                  (props.tabsEnd === undefined ? 0 : 36) + (props.onTabs && lit() ? 110 : 0),
                )}
                tabsEnd={
                  <>
                    {props.onTabs && lit() ? <TabKeysHint /> : undefined}
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
        <Each key={(one: PaneRef) => one.key} of={props.stack.panes}>
          {(one) => (
            <Pane
              body={bodyOf(one())}
              focused={props.focus === one().key}
              onPress={() => props.onFocus(one().key)}
              running={markOf(one()).running}
              style={{ flex: 1 }}
              tabs={[tabOf(one(), true, () => props.onFocus(one().key))]}
            >
              <If when={room() > 0}>
                <PaneBody focused={props.focus === one().key} pane={one()} width={width()} />
              </If>
            </Pane>
          )}
        </Each>
      </If>
    </View>
  );
}
