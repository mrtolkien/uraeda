// A dialog: an overlay in the window's middle, over the page dimmed, for two jobs only:
// confirming what cannot be undone, and one short question at a decision point. It takes the
// focus as it opens, keeps Tab among its own fields, and gives the focus back where it was as it
// closes. Escape, the phone's Back, and a press outside it ask to close. On a narrow window it is
// a sheet. It never holds a view of its own to read: that is a page.
import type { JSX, StyleProp, ViewStyle } from "nsh";
import { Overlay } from "./Overlay";

export type DialogProps = {
  children?: JSX.Element;
  /** Before its title, on the plate. */
  icon?: JSX.Element;
  onClose?: () => void;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** What it asks, on its plate: also its layer's name in the key map. */
  title: string;
  /** As wide as what it holds needs, up to the window: 520 points unless given. */
  width?: number;
};

export function Dialog(props: DialogProps) {
  return (
    <Overlay
      icon={props.icon}
      name={props.title}
      onClose={props.onClose}
      open={props.open}
      style={props.style}
      testID={props.testID}
      title={props.title}
      width={props.width ?? 520}
    >
      {props.children}
    </Overlay>
  );
}
