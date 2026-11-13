// The Mac's window, as macOS 26 draws an app's: no title bar of the system's, the window's content
// up to its top edge, and over it a toolbar with no background of its own, its controls on pieces
// of the system's Liquid Glass, as Apple's guidelines ask of it. The page under it, its panes and
// their tabs, stays Uraeda's own.
//
// - Leading, after the window's buttons: the sidebar's toggle on its glass, then the repository's
//   name, which opens the switcher. A title is no control, so it stands on no glass.
// - Trailing: Find and New, on one piece of glass, as the system groups a toolbar's buttons.
//
// The toolbar's empty room moves the window, and a double click there zooms it, as a title bar's.
// The commands are the menu bar's too (`app/screens/shell/MenuBar.tsx`). See `specs/ui/wide.md`,
// "macOS".
import { effect, View } from "nsh";
import { currentWindow, titleBar } from "nsh/desktop";
import { Icon, type IconName, Text } from "../controls";
import { mac } from "../native";
import { tokens } from "../tokens";

/** The toolbar's height: the system's window buttons are centred in it. */
export const MAC_BAR = 52;

/** A toolbar control's height, the system's regular size, as round as it is tall. */
const CONTROL = 32;

/** The system's glass, the regular one, with a blur where a system older than 26 has none. */
const glass = {
  backdropFilter: "blur(20px)",
  borderCurve: "continuous",
  borderRadius: CONTROL / 2,
  flexDirection: "row",
  glassEffect: "regular",
} as const;

/**
 * The window's title bar, hidden for the app's own, and the window's least size: set once, as the
 * app's root is first drawn, so no frame shows the system's bar over the toolbar. The toolbar sets
 * it too, for the checks' pages, which have no root of the app's.
 */
let titled = false;
export function hideTitleBar() {
  if (titled || !mac) return;
  titled = true;
  currentWindow().set({
    minSize: { height: 480, width: 640 },
    titleBar: { height: MAC_BAR, style: "hidden" },
  });
}

/** The room the window's buttons take, and none in full screen, where the system hides them. */
const leading = () => (titleBar().left > 0 ? titleBar().left + 6 : tokens.space.gap.wide + 4);

/** A button of the toolbar: an icon alone, on the glass that holds it, with its name as its tip. */
function BarButton(props: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <View
      accessibilityLabel={props.label}
      activeStyle={{ opacity: 0.55 }}
      hoverStyle={{ backgroundColor: tokens.role.ruleQuiet }}
      onPress={props.onPress}
      role="button"
      style={{
        alignItems: "center",
        borderCurve: "continuous",
        borderRadius: CONTROL / 2,
        height: CONTROL,
        justifyContent: "center",
        width: CONTROL + 6,
      }}
      tooltip={props.label}
    >
      <Icon colour={tokens.role.ink} name={props.icon} size={16} />
    </View>
  );
}

export type MacToolbarProps = {
  /** Find anything: the picker of every place, file, and session. */
  onFind?: () => void;
  /** New: a session, a change, or a feature. */
  onNew?: () => void;
  /** The sidebar's toggle: unfolds or folds the rail, or opens the sidebar's sheet. */
  onSidebar?: () => void;
  /** A press on the title: the repositories' switcher. */
  onTitle?: () => void;
  /** The repository's name: where the human is. */
  title?: string;
};

/** The Mac's toolbar, in the window's title bar. Nothing off the Mac. */
export function MacToolbar(props: MacToolbarProps) {
  effect(hideTitleBar);
  return (
    <View
      desktop={{ windowDrag: true }}
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        height: MAC_BAR,
        paddingLeft: leading(),
        paddingRight: tokens.space.gap.wide + 4,
      }}
      testID="mac-toolbar"
    >
      <If when={props.onSidebar}>
        {(toggle) => (
          <View style={glass}>
            <BarButton icon="panel-left" label="Toggle Sidebar" onPress={toggle()} />
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
          flexDirection: "row",
          flexShrink: 1,
          gap: 4,
          height: CONTROL,
          minWidth: 0,
          paddingHorizontal: 6,
        }}
        tooltip="Switch Repository…"
      >
        <Icon colour={tokens.role.added} name="folder-git-2" size={16} />
        <View style={{ flexShrink: 1 }}>
          <Text bold lines={1}>
            {props.title ?? "Uraeda"}
          </Text>
        </View>
        <If when={props.onTitle !== undefined}>
          <Icon colour={tokens.role.inkQuiet} name="chevron-down" size={14} />
        </If>
      </View>
      {/* The room between, which moves the window. */}
      <View style={{ alignSelf: "stretch", flex: 1 }} />
      <If when={props.onFind !== undefined || props.onNew !== undefined}>
        <View style={glass}>
          <If when={props.onFind}>
            {(find) => <BarButton icon="search" label="Find Anything…" onPress={find()} />}
          </If>
          <If when={props.onNew}>
            {(add) => <BarButton icon="plus" label="New…" onPress={add()} />}
          </If>
        </View>
      </If>
    </View>
  );
}
