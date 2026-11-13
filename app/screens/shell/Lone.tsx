// A page of its own, without the frame: what the app shows before it can draw a screen, while it
// starts or reaches the server, pairs the device, or cannot speak with the server. A raised card in
// the middle of the window's backdrop, its title, the words that name the cause, and the way out.
// On a phone, the middle is the room the keyboard leaves: a field's button stays above it. On a
// Mac, whose window has no title bar of the system's, its top moves the window, as the toolbar's.
import { type JSX, View } from "nsh";
import { Heading, Icon, type IconName, Text } from "../../ui/controls";
import { MAC_BAR } from "../../ui/layout/macBars";
import { mac } from "../../ui/native";
import { Backdrop, keyboardUp, safe, Surface } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";

export type LoneProps = {
  /** What follows the words: a field, a button, a spinner. */
  children?: JSX.Element;
  icon: IconName;
  testID?: string;
  title: string;
  /** The cause, and what to do: one or two sentences. */
  words?: string;
  /** The words' tone: `danger` for a failure the owner must deal with. */
  tone?: "danger";
};

export function Lone(props: LoneProps) {
  return (
    <Backdrop>
      <View
        style={{
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
          padding: 16,
          paddingBottom: keyboardUp() ? `calc(${safe.keyboard} + 16px)` : 16,
        }}
        testID={props.testID}
      >
        <Surface height="raised" style={{ gap: 14, maxWidth: 520, padding: 24, width: "100%" }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <Icon
              colour={props.tone === "danger" ? tokens.control.tone("danger") : tokens.role.action}
              name={props.icon}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading level={1}>{props.title}</Heading>
            </View>
          </View>
          <If when={props.words}>{(words) => <Text tone="quiet">{words()}</Text>}</If>
          {props.children}
        </Surface>
      </View>
      <If when={mac}>
        <View
          desktop={{ windowDrag: true }}
          style={{ height: MAC_BAR, left: 0, position: "absolute", right: 0, top: 0 }}
        />
      </If>
    </Backdrop>
  );
}
