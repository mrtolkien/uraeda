// Tabs: the views of one place, as a terminal's tab line. The current tab's words are the ink,
// bold, over a line of light; the others are quiet, and the ink under the pointer. A count
// follows a tab's name, "Sessions · 3". The keys that move between tabs are the screen's, in the
// registry: the tabs take a press, and the focus in an overlay.
import { View } from "nsh";
import { Button as Base } from "nsh/base";
import { type IconName, Icon } from "./Icon";
import { type Looks, type PressState, pressable } from "./press";
import { Text } from "./Text";
import { tokens } from "../tokens";
import { isNarrow } from "../width";

export type Tab<Value extends string = string> = {
  count?: number;
  disabled?: boolean;
  icon?: IconName;
  label: string;
  value: Value;
};

export type TabsProps<Value extends string> = {
  /** What the tabs choose between, said by screen readers. */
  label: string;
  onChange: (next: Value) => void;
  /** Draws the tabs in a state, still: the gallery's. */
  state?: PressState;
  tabs: ReadonlyArray<Tab<Value>>;
  testID?: string;
  value: Value;
};

const looks = (): Looks => ({
  disabled: {},
  focus: {},
  hover: { backgroundColor: tokens.control.tint(tokens.role.action) },
  pressed: {},
  rest: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    flexShrink: 1,
    height: isNarrow() ? tokens.control.touch : tokens.space.row + 2,
    minWidth: 0,
    paddingHorizontal: 10,
  },
});

function TabOf<Value extends string>(props: {
  current: boolean;
  onPick: () => void;
  state?: PressState;
  tab: Tab<Value>;
}) {
  const press = pressable(
    {
      get disabled() {
        return props.tab.disabled;
      },
      get state() {
        return props.current ? undefined : props.state;
      },
    },
    () => props.onPick(),
  );
  const hot = () => press.state() === "hover" || press.state() === "focus";
  const tone = () => {
    if (props.tab.disabled === true) {
      return "faint" as const;
    }
    return props.current || hot() ? ("ink" as const) : ("quiet" as const);
  };
  return (
    <Base
      accessibilityLabel={props.tab.label}
      activeStyle={press.active(looks())}
      disabled={press.isOff()}
      focusStyle={press.focusStyle(looks())}
      hoverStyle={press.hover(looks())}
      onPress={press.press}
      ref={press.ref}
      role="tab"
      selected={props.current}
      // The shown tab keeps its words; the others cut theirs when the row is short.
      style={[press.style(looks()), props.current ? { flexShrink: 0 } : null]}
    >
      <If when={props.tab.icon}>
        {(icon) => <Icon colour={props.current ? tokens.role.action : undefined} name={icon()} />}
      </If>
      <Text bold={props.current} lines={1} style={{ flexShrink: 1 }} tone={tone()}>
        {props.tab.label}
      </Text>
      <If when={props.tab.count !== undefined}>
        <Text tone="faint">· {String(props.tab.count)}</Text>
      </If>
      <View
        style={{
          backgroundColor: props.current ? tokens.light.focus : "transparent",
          bottom: 0,
          boxShadow: props.current ? tokens.row.barGlow : undefined,
          height: 2,
          left: 0,
          position: "absolute",
          right: 0,
          transitionDuration: tokens.light.glide,
          transitionProperty: "background-color",
        }}
      />
    </Base>
  );
}

export function Tabs<Value extends string>(props: TabsProps<Value>) {
  return (
    <View
      accessibilityLabel={props.label}
      role="tablist"
      style={{
        borderBottomWidth: 1,
        borderColor: tokens.role.ruleQuiet,
        // One row: a tab that does not fit cuts its words, as a stack's tabs do, where a second
        // row read as tabs of another bar.
        flexDirection: "row",
      }}
      testID={props.testID}
    >
      <Each of={props.tabs}>
        {(tab) => (
          <TabOf
            current={tab().value === props.value}
            onPick={() => {
              if (tab().value !== props.value) {
                props.onChange(tab().value);
              }
            }}
            state={props.state}
            tab={tab()}
          />
        )}
      </Each>
    </View>
  );
}
