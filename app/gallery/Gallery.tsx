// The gallery: every component of the library in its states, in one app built in the layout shell,
// the frame every screen is drawn in. Its groups are the rail's places, `g s`, `g c`, and each
// group's pages are panes, the main stack's tabs; the side stack holds the gallery's own pane,
// Look, with the theme and the width, which `t` and `w` switch from anywhere.
//
// `just gallery` runs it; `just gallery-shots` and `just frames` open it with what their host
// names: `group`, `page`, `theme`, `layout` (`tabs`, `split`, `folded`, `open`), `open` (a keys'
// view), and `vim`.
import { colorScheme, computed, host, mount, signal, View, windowSize } from "nsh";
import { openKeys } from "./keys/keys";
import { GROUPS, type Group, PANES } from "./pages";
import { keep } from "../store/history";
import { Segmented, Text } from "../ui/controls";
import { KeyScope, KeysHost, registerKey } from "../ui/keys";
import {
  definePane,
  fold,
  focus,
  type Layout,
  layoutOf,
  type Place,
  split,
  Stacks,
  toTabs,
} from "../ui/layout";
import { setVimMode } from "../ui/text";
import { applyTheme } from "../ui/theme";
import { DEFAULT_THEMES, type Mode } from "../ui/tokens";

/** The widths the gallery is looked at: a desktop's, a semi-wide window's, and a phone's. */
const WIDTHS = ["1400", "900", "390"] as const;
type Width = "window" | (typeof WIDTHS)[number];

const asked = host.params;
const theme = signal<Mode>((asked.theme as Mode | undefined) ?? colorScheme());
const width = signal<Width>("window");
const shown = signal<Group>(
  GROUPS.find(
    (group) => group.name === asked.group || group.pages.some((page) => page.name === asked.page),
  ) ?? GROUPS[0]!,
);

const show = (mode: Mode) => {
  theme.set(mode);
  applyTheme(DEFAULT_THEMES[mode]);
};

/** The gallery's own pane: what it is looked at in. */
const look = definePane({
  icon: "monitor",
  kind: "gallery-look",
  stack: "side",
  title: "Look",
  view: () => (
    <View style={{ gap: 16 }}>
      <Segmented
        label="Theme"
        onChange={show}
        options={[
          { icon: "moon", label: "Dark", value: "dark" },
          { icon: "sun", label: "Light", value: "light" },
        ]}
        value={theme()}
      />
      <Segmented
        hint="The frame's width, in points: the window's, or a narrower one inside it."
        label="Width"
        onChange={(next: Width) => width.set(next)}
        options={[
          { label: "Window", value: "window" },
          ...WIDTHS.map((points) => ({ label: points, value: points })),
        ]}
        value={width()}
      />
      <Text size="under" tone="faint">
        t switches the theme, w the width, g and a group's letter goes to the group.
      </Text>
    </View>
  ),
});

const placeOf = (group: Group): Place => ({
  main: group.panes,
  side: [...(group.side ?? []), look({})],
});

/** A group's layout as it opens: its first page focused, the side stack folded but on Panes. */
const opening = (group: Group): Layout => layoutOf(placeOf(group), group.side === undefined);

/** The layouts the pictures ask for, from a group's opening one. */
const LAYOUTS: Record<string, (start: Layout, group: Group) => Layout> = {
  folded: (start) => fold(start, true),
  open: (start) => fold(start, false),
  split: (start, group) =>
    split(focus(fold(start, false), placeOf(group).side[1]!.key), "side", true),
  tabs: (start) => toTabs(start, true),
};

/** Opens `group`, at `page` when given, else its first. */
function go(group: Group, page?: string) {
  shown.set(group);
  let layout = opening(group);
  const pane = page === undefined ? undefined : PANES.get(page);
  if (pane !== undefined) layout = focus(layout, pane.key);
  const changed = LAYOUTS[String(asked.layout)];
  keep({ layout: changed === undefined ? layout : changed(layout, group) });
}

function Keys() {
  registerKey([
    {
      hint: "t",
      hintLabel: "theme",
      keys: "t",
      label: "Switch the theme",
      run: () => show(theme() === "dark" ? "light" : "dark"),
    },
    {
      hint: "w",
      hintLabel: "width",
      keys: "w",
      label: "Switch the width",
      run: () => {
        const order: ReadonlyArray<Width> = ["window", ...WIDTHS];
        width.set(order[(order.indexOf(width()) + 1) % order.length]!);
      },
    },
    ...GROUPS.map((group) => ({
      icon: group.icon,
      keys: `g ${group.key}`,
      label: group.label,
      run: () => go(group),
    })),
  ]);
  return null;
}

function Gallery() {
  show(theme());
  setVimMode(asked.vim === "on");
  go(shown(), asked.page === undefined ? undefined : String(asked.page));
  if (asked.open !== undefined) requestAnimationFrame(() => openKeys(String(asked.open)));
  const frameWidth = computed(() =>
    width() === "window" ? undefined : Math.min(Number(width()), windowSize().width),
  );
  const page = () => GROUPS.indexOf(shown()) + 1;
  return (
    <KeysHost place={shown().name}>
      <KeyScope name="Gallery">
        <Keys />
        <View style={{ alignItems: "center", flex: 1 }}>
          <View style={{ flex: 1, width: frameWidth() ?? "100%" }}>
            <Stacks
              place={placeOf(shown())}
              rail={{
                places: GROUPS.map((group) => ({
                  current: group === shown(),
                  icon: group.icon,
                  keys: `g ${group.key}`,
                  label: group.label,
                  onPress: () => go(group),
                })),
                title: "Gallery",
              }}
              status={{
                end: (
                  <Text tone="quiet">
                    {theme()} · {width() === "window" ? "window" : `${width()} pt`}
                  </Text>
                ),
                place: `${page()}:${GROUPS.length}`,
                start: <Text tone="quiet">{shown().label}</Text>,
              }}
            />
          </View>
        </View>
      </KeyScope>
    </KeysHost>
  );
}

mount(Gallery);
