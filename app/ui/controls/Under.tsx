// What sits under a control: why the server refused what it showed, with the way out, or a hint
// while nothing is refused. Every control that takes a value draws it, so a form's refusals all
// read the same, under the control they concern, never only in a toast. What it pushes down
// glides there, as any content that moves.
import { effect, type JSX, LayoutAnimation, type StyleProp, View, type ViewStyle } from "nsh";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { tokens } from "../tokens";

export type UnderProps = {
  children?: JSX.Element;
  /** Words that help, under it while nothing is refused. */
  hint?: string;
  /** Why the server refused the last change, and what to do: "A time is from 00:00 to 23:59." */
  refusal?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A refusal's line: its mark and its words, in the removed role. */
export function Refusal(props: { testID?: string; words: string }) {
  return (
    <View
      style={{ alignItems: "flex-start", alignSelf: "stretch", flexDirection: "row", gap: 6 }}
      testID={props.testID}
    >
      <Icon colour={tokens.control.tone("danger")} name="circle-alert" style={{ marginTop: 4 }} />
      <Text size="under" style={{ flexShrink: 1 }} tone="danger">
        {props.words}
      </Text>
    </View>
  );
}

export function Under(props: UnderProps) {
  const words = () => props.refusal ?? null;
  // A refusal that comes or goes moves what is under it: it glides there.
  let first = true;
  effect(() => {
    words();
    if (!first) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(tokens.motion.glide, "easeInEaseOut", "opacity"),
      );
    }
    first = false;
  });
  return (
    <View
      style={[{ alignItems: "flex-start", flexShrink: 1, gap: 2, maxWidth: "100%" }, props.style]}
      testID={props.testID}
    >
      {props.children}
      <If
        when={words()}
        else={
          <If when={props.hint}>
            {(hint) => (
              <Text size="under" tone="faint">
                {hint()}
              </Text>
            )}
          </If>
        }
      >
        {(refused) => <Refusal words={refused()} />}
      </If>
    </View>
  );
}
