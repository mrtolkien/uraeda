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
};

export function Menu(props: MenuProps) {
  const isOpen = signal(props.open === true);
  let anchor: ViewRef | undefined;
  const close = () => isOpen.set(false);
  return (
    <View ref={(node: ViewRef) => (anchor = node)} style={{ alignSelf: "flex-start" }}>
      <IconButton
        disabled={props.disabled}
        icon={props.icon ?? "ellipsis"}
        label={props.label}
        onPress={() => isOpen.set(true)}
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
            close();
            props.entries[at]?.run();
          }}
          rows={props.entries}
          start={props.entries.findIndex((entry) => entry.disabled !== true)}
          testID={props.testID === undefined ? undefined : `${props.testID}-list`}
        />
      </Popover>
    </View>
  );
}
