// A sheet: what rises from the bottom of a narrow window, across its width, over the page
// dimmed. A dialog and a picker become one there by themselves; a side column's tab on the phone
// is one at every width it shows. It takes the keys and the focus as a dialog does. A menu or a
// selector is never a sheet: it stays a popover.
import type { JSX, StyleProp, ViewStyle } from "nsh";
import { Float } from "./Float";
import { sheetPlace } from "./Overlay";

export type SheetProps = {
  children?: JSX.Element;
  icon?: JSX.Element;
  /** What the key map calls its layer: its title unless given. */
  name?: string;
  onClose?: () => void;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  title?: string;
};

export function Sheet(props: SheetProps) {
  return (
    <Float
      icon={props.icon}
      keys
      name={props.name ?? props.title ?? "Sheet"}
      onClose={props.onClose}
      open={props.open}
      place={() => sheetPlace(true)}
      scrim
      style={props.style}
      testID={props.testID}
      title={props.title}
      trap
    >
      {props.children}
    </Float>
  );
}
