// A menu of actions, as a last resort for what has no better place: its trigger is an icon
// button, "more" unless named, and its rows open on a popover under it, at every width. A row
// shows the key the page declares for the same action. Picking runs it and closes the menu; the
// focus goes back to the trigger. On a Mac the rows open as the system's menu (`systemMenu.ts`).
import { effect, signal, untracked, View, type ViewRef } from "nsh";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Options, type Row } from "./Options";
import type { PressState } from "./press";
import { popUnder, systemMenus } from "./systemMenu";
import { Popover } from "../surfaces";
import { keyScope } from "../keys/registry";

/** An action of a menu: what it says, and what it does. */
export type MenuEntry = Row & { run: () => void };

export type MenuProps = {
  disabled?: boolean;
  entries: ReadonlyArray<MenuEntry>;
  /** The trigger's icon: `ellipsis` unless given. */
  icon?: IconName;
  /** What the menu holds, said by the trigger: "More of the row". */
  label: string;
  /** Draws its trigger in a state, still: the gallery's. */
  state?: PressState;
  testID?: string;
  /** Open as it is drawn: the gallery's. */
  open?: boolean;
  /**
   * Open while it says so, as its owner keeps it, told of each change by `onOpenChange`: a menu
   * that something else opens too, as a pane's by a long press on its tab.
   */
  shown?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Menu(props: MenuProps) {
  const own = signal(props.open === true);
  const isOpen = () => props.shown ?? own();
  const setOpen = (open: boolean) => {
    own.set(open);
    props.onOpenChange?.(open);
  };
  // A signal: the popover reads it once it is drawn, after the ref was set.
  const anchor = signal<ViewRef | undefined>(undefined);
  const close = () => setOpen(false);
  // The menu's layer, for its rows' keys: see `Float`'s `scope`.
  const layer = keyScope({ kind: "layer", name: props.label, on: isOpen });
  // On a Mac, opened by a press or by its owner, the system's menu shows, until it closes.
  if (systemMenus) {
    effect(() => {
      if (!isOpen()) return;
      untracked(() => {
        const entries = props.entries;
        void popUnder(anchor(), entries, (at) => entries[at]?.run()).finally(close);
      });
    });
  }
  return (
    <View ref={(node: ViewRef) => anchor.set(node)} style={{ alignSelf: "flex-start" }}>
      <IconButton
        disabled={props.disabled}
        icon={props.icon ?? "ellipsis"}
        label={props.label}
        onPress={() => setOpen(true)}
        selected={isOpen()}
        state={props.state}
        testID={props.testID}
        tipOff={isOpen()}
      />
      <Popover
        anchor={anchor()}
        name={props.label}
        onClose={close}
        open={isOpen() && !systemMenus}
        scope={layer}
        style={{ minWidth: 200, paddingVertical: 4 }}
      >
        <Options
          onPick={(at) => {
            // Taken before it closes: an owner may draw no entries while it is closed.
            const entry = props.entries[at];
            close();
            entry?.run();
          }}
          rows={props.entries}
          scope={layer}
          start={props.entries.findIndex((entry) => entry.disabled !== true)}
          testID={props.testID === undefined ? undefined : `${props.testID}-list`}
        />
      </Popover>
    </View>
  );
}
