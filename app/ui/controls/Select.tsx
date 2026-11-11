// A select: one value of a list. Its trigger is a field's well with the value's words and a
// chevron; a press, or Enter or Space with the focus, opens the list on a popover under it, or on
// a sheet across a narrow window, where a long list needs the room. Picking closes it, and the
// focus goes back to the trigger. It moves at once; a refusal puts it back and says why under it.
import { signal, type ViewRef } from "nsh";
import { Button as Base } from "nsh/base";
import { pressHeight } from "./Button";
import { type IconName, Icon } from "./Icon";
import { type Option, Options } from "./Options";
import { type Looks, type PressProps, pressable } from "./press";
import { Text } from "./Text";
import { Under } from "./Under";
import { Popover, Sheet } from "../surfaces";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type SelectProps<Value extends string> = PressProps & {
  hint?: string;
  icon?: IconName;
  /** What it chooses: the list's title on a sheet, and what screen readers say. */
  label: string;
  onChange: (next: Value) => void;
  /** Open as it is drawn: the gallery's. */
  open?: boolean;
  options: ReadonlyArray<Option<Value>>;
  pending?: boolean;
  /** What it shows while nothing is chosen. */
  placeholder?: string;
  refusal?: string | null;
  testID?: string;
  value: Value | null;
  /** Its trigger's width; the list is as wide, or wider for its words. */
  width?: number;
};

function triggerLooks(width: number | undefined): Looks {
  const c = tokens.control;
  return {
    disabled: {
      backgroundColor: "transparent",
      borderColor: c.disabledEdge,
      borderStyle: "dashed",
    },
    focus: { borderColor: c.hotEdge },
    hover: { borderColor: c.hotEdge },
    pressed: { backgroundColor: tokens.height.recessed.fillIn.deeper },
    rest: {
      alignItems: "center",
      backgroundColor: c.well,
      borderColor: c.edge,
      borderWidth: 1,
      boxShadow: tokens.height.recessed.lip,
      flexDirection: "row",
      gap: 8,
      height: pressHeight(),
      paddingHorizontal: 9,
      width,
    },
  };
}

export function Select<Value extends string>(props: SelectProps<Value>) {
  const isOpen = signal(props.open === true);
  let anchor: ViewRef | undefined;
  const width = signal(0);
  const press = pressable(props, () => {
    // The trigger holds the focus, so it gets it back as the list closes.
    press.focus();
    isOpen.set(true);
  });
  const chosen = () => props.options.find((option) => option.value === props.value);
  const close = () => isOpen.set(false);
  const pick = (at: number) => {
    const option = props.options[at];
    close();
    if (option !== undefined && option.value !== props.value) {
      props.onChange(option.value);
    }
  };
  const list = () => (
    <Options
      onPick={pick}
      rows={props.options.map((option) => ({ ...option, picked: option.value === props.value }))}
      testID={props.testID === undefined ? undefined : `${props.testID}-list`}
    />
  );
  return (
    <Under hint={props.hint} refusal={props.refusal}>
      <Base
        accessibilityLabel={props.label}
        activeStyle={press.active(triggerLooks(props.width))}
        disabled={press.isOff()}
        focusStyle={press.focusStyle(triggerLooks(props.width))}
        hoverStyle={press.hover(triggerLooks(props.width))}
        onLayout={(event) => width.set(event.bounds.size.width)}
        onPress={press.press}
        ref={(node: ViewRef) => {
          anchor = node;
          press.ref(node);
        }}
        role="combobox"
        style={press.style(triggerLooks(props.width))}
        testID={props.testID}
      >
        <If when={props.icon ?? chosen()?.icon}>
          {(icon) => <Icon colour={tokens.role.inkQuiet} name={icon()} />}
        </If>
        <Text
          lines={1}
          style={{ flexGrow: 1, flexShrink: 1 }}
          tone={props.disabled === true || chosen() === undefined ? "faint" : "ink"}
        >
          {chosen()?.label ?? props.placeholder ?? "Choose…"}
        </Text>
        <If when={props.pending === true}>
          <Text size="under" tone="faint">
            saving…
          </Text>
        </If>
        <Icon
          colour={props.disabled === true ? tokens.role.inkFaint : tokens.role.inkQuiet}
          name="chevron-down"
        />
      </Base>
      <If
        when={isNarrow()}
        else={
          <Popover
            anchor={anchor}
            name={props.label}
            onClose={close}
            open={isOpen()}
            style={{ minWidth: width(), paddingVertical: 4 }}
          >
            {list()}
          </Popover>
        }
      >
        <Sheet name={props.label} onClose={close} open={isOpen()} title={props.label}>
          {list()}
        </Sheet>
      </If>
    </Under>
  );
}
