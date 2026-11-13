// An overlay: glass that floats over the page, for what is not the page's own. Two places:
//
// - `middle`: in the window's middle, over the page dimmed. It takes the keys and the focus, and
//   Escape, the phone's Back, or a press outside it asks to close. A dialog and a picker are this.
// - `corner`: at the window's bottom right, above the status line. The page is still pressed and
//   typed around it, and it takes neither the keys nor the focus: the leader's menu is this.
//
// On a narrow window either is a sheet: across the width, at the bottom, from where it rises.
import type { JSX, StyleProp, ViewStyle } from "nsh";
import type { SurfaceIcon } from "./mark";
import type { Scope } from "../keys/store";
import { Float, type Place } from "./Float";
import { belowStatus, keyboardUp, safe } from "./safe";
import { ios } from "../native";
import { isNarrow } from "../width";
import { tokens } from "../tokens";

/** The gap a sheet, or a corner's overlay, keeps from the window's edges. */
const GAP = 8;

/** A sheet: across the window's width, at its bottom. It rises four times what an overlay does. */
export const sheetPlace = (scrim: boolean): Place =>
  scrim && ios
    ? {
        // On iOS a sheet stands on the screen's foot, across its width, over the floating bar:
        // the screen's round corners would cut a square box set in from them. What it holds
        // ends above the home indicator (`Float`).
        box: { marginTop: GAP, maxHeight: "88%" },
        rise: tokens.motion.rise * 4,
        window: {
          alignItems: "stretch",
          justifyContent: "flex-end",
          paddingBottom: keyboardUp() ? safe.keyboard : 0,
          paddingTop: belowStatus(tokens.control.touch),
        },
      }
    : scrim
      ? {
          box: { margin: GAP, maxHeight: "85%" },
          rise: tokens.motion.rise * 4,
          // Above the home indicator, or lifted by the whole keyboard; never over the places' bar.
          window: {
            alignItems: "stretch",
            justifyContent: "flex-end",
            paddingBottom: keyboardUp() ? safe.keyboard : safe.bottom,
            paddingTop: belowStatus(tokens.control.touch),
          },
        }
      : {
          box: { bottom: GAP, left: GAP, marginBottom: safe.bottom, right: GAP },
          rise: tokens.motion.rise * 4,
        };

export type OverlayProps = {
  children?: JSX.Element;
  /** Before its title, on the plate. */
  icon?: SurfaceIcon;
  /** What the key map calls its layer. */
  name: string;
  /** Asked to close: Escape, the phone's Back, a press outside it. Closing is its owner's. */
  onClose?: () => void;
  /** Shown while true, and for its way out after: true unless given. */
  open?: boolean;
  /** `middle` unless given. Fixed for as long as it is drawn. */
  place?: "corner" | "middle";
  /** Its layer's key scope, for content that declares keys (`Float`'s `scope`). */
  scope?: Scope;
  /** The style of its box: its padding, its gap. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** On a small plate on its top edge. */
  title?: string;
  /**
   * In the window's middle, its top stays where it opened, a fifth of the way down, as a command
   * palette's: a picker whose list grows and shrinks as it is searched never jumps.
   */
  top?: boolean;
  /** Its width in the window's middle. A sheet spans the window. */
  width?: number;
};

export function Overlay(props: OverlayProps) {
  const middle = props.place !== "corner";
  const place = (): Place => {
    if (isNarrow()) {
      return sheetPlace(middle);
    }
    return middle
      ? {
          box: { maxHeight: "80%", maxWidth: "100%", width: props.width },
          rise: tokens.motion.rise,
          window:
            props.top === true
              ? { alignItems: "center", justifyContent: "flex-start", paddingTop: "12%" }
              : { alignItems: "center", justifyContent: "center" },
        }
      : { box: { bottom: tokens.status.height + GAP, right: 12 }, rise: tokens.motion.rise };
  };
  return (
    <Float
      icon={props.icon}
      keys={middle}
      name={props.name}
      onClose={props.onClose}
      open={props.open}
      place={place}
      scrim={middle}
      scope={props.scope}
      style={props.style}
      testID={props.testID}
      title={props.title}
      trap={middle}
    >
      {props.children}
    </Float>
  );
}
