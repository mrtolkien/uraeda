// What a switch, a checkbox, and a radio share: a row of the control's mark and its label, which
// takes the press and the focus as one target, a finger's on a narrow window, with its hint or
// refusal under it.
import type { JSX, ViewStyle } from "nsh";
import type { Looks, PressProps } from "./press";
import { Text } from "./Text";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type ChoiceProps = PressProps & {
  /** Words under it while nothing is refused. */
  hint?: string;
  label: string;
  /** Its change is on its way to the server: it shows the new value already. */
  pending?: boolean;
  /** Why the server refused the last change: it is back to what it was, and says so under it. */
  refusal?: string | null;
  testID?: string;
};

/** The row's looks: a faint block of the accent under the pointer, the ring with the focus. */
export function choiceLooks(): Looks {
  const rest: ViewStyle = {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginHorizontal: -4,
    minHeight: isNarrow() ? tokens.control.touch : tokens.type.line,
    paddingHorizontal: 4,
  };
  return {
    disabled: {},
    focus: {},
    hover: { backgroundColor: tokens.control.tint(tokens.role.action) },
    pressed: { backgroundColor: tokens.control.tint(tokens.role.action) },
    rest,
  };
}

/** The label after the mark, faint while disabled, and "saving" while its change is on its way. */
export function ChoiceLabel(props: {
  disabled?: boolean;
  label: string;
  pending?: boolean;
}): JSX.Element {
  return (
    <>
      <Text tone={props.disabled === true ? "faint" : "ink"}>{props.label}</Text>
      <If when={props.pending === true}>
        <Text size="under" tone="faint">
          saving…
        </Text>
      </If>
    </>
  );
}

/** A mark's edge and fill in each state of its control. */
export function markColours(on: boolean, disabled: boolean) {
  const c = tokens.control;
  if (disabled) {
    return { edge: c.disabledEdge, fill: "transparent", mark: c.disabledInk };
  }
  return on
    ? { edge: c.on, fill: c.on, mark: c.onMark }
    : { edge: c.edge, fill: c.well, mark: c.off };
}
