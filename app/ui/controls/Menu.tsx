// A menu of actions, as a last resort for what has no better place: its trigger is an icon
// button, "more" unless named, and its rows open on a popover under it, at every width. A row
// shows the key the page declares for the same action. Picking runs it and closes the menu; the
// focus goes back to the trigger.
import { signal, View, type ViewRef } from "nsh";
import type { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Options, type Row } from "./Options";
import type { PressState } from "./press";
import { Popover } from "../surfaces";

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
  let anchor: ViewRef | undefined;
  const close = () => setOpen(false);
  return (
    <View ref={(node: ViewRef) => (anchor = node)} style={{ alignSelf: "flex-start" }}>
      <IconButton
        disabled={props.disabled}
        icon={props.icon ?? "ellipsis"}
        label={props.label}
        onPress={() => setOpen(true)}
        selected={isOpen()}
        state={props.state}
        testID={props.testID}
      />
      <Popover
        anchor={anchor}
        name={props.label}
        onClose={close}
        open={isOpen()}
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
          start={props.entries.findIndex((entry) => entry.disabled !== true)}
          testID={props.testID === undefined ? undefined : `${props.testID}-list`}
        />
      </Popover>
    </View>
  );
}
