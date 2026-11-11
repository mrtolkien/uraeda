// Buttons and keys in every state: the main action's lamp, which breathes at rest, the tube, the
// red tube, a button with its key and one with its icon, an icon button, and the key's three
// looks; then the same on a raised card and on glass, where every button is a tube.
import { type JSX, View } from "nsh";
import { asked, Line, Page, Part, STATES } from "../parts";
import { Button, IconButton, Kbd, Text } from "../../ui/controls";
import { Surface } from "../../ui/surfaces";

const nothing = () => {};
const each = (draw: (state: (typeof STATES)[number]) => JSX.Element) => STATES.map(draw);

export function buttons(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Buttons" wide>
        <Line name="" narrow={narrow}>
          {each((state) => (
            <View style={{ width: 120 }}>
              <Text size="under" tone="faint">
                {state}
              </Text>
            </View>
          ))}
        </Line>
        <Line name="main" narrow={narrow}>
          {each((state) => (
            <View style={{ width: 120 }}>
              <Button
                breathes={state === "rest"}
                disabled={state === "disabled"}
                label="Approve"
                onPress={nothing}
                state={asked(state)}
                variant="main"
              />
            </View>
          ))}
        </Line>
        <Line name="tube" narrow={narrow}>
          {each((state) => (
            <View style={{ width: 120 }}>
              <Button disabled={state === "disabled"} label="Cancel" state={asked(state)} />
            </View>
          ))}
        </Line>
        <Line name="danger" narrow={narrow}>
          {each((state) => (
            <View style={{ width: 120 }}>
              <Button
                disabled={state === "disabled"}
                icon="trash-2"
                label="Delete"
                state={asked(state)}
                variant="danger"
              />
            </View>
          ))}
        </Line>
        <Line name="icon" narrow={narrow}>
          {each((state) => (
            <View style={{ width: 120 }}>
              <IconButton
                disabled={state === "disabled"}
                icon="pencil"
                label="Edit"
                state={asked(state)}
              />
            </View>
          ))}
        </Line>
        <Line name="with a key" narrow={narrow}>
          <Button keys="Enter" label="Send" state="rest" variant="main" />
          <Button keys="Escape" label="Keep it" state="hover" />
          <Button icon="send" label="Send" state="pressed" variant="main" />
          <Button label="Saving" pending state="rest" />
          <Button label="Wrap" selected state="rest" />
          <IconButton icon="panel-left" label="Column" selected state="rest" />
        </Line>
        <Line name="key" narrow={narrow}>
          <Kbd keys="g" />
          <Kbd keys="g" state="hover" />
          <Kbd keys="g" state="pressed" />
          <Kbd keys="g h" />
          <Kbd keys="mod+k" />
          <Kbd keys="Enter" />
          <Kbd keys="g" look="glow" />
          <Kbd keys="g" look="cap" />
        </Line>
      </Part>
      <View style={{ flexBasis: narrow ? "100%" : "30%", flexGrow: 1, gap: 34 }}>
        <Part inColumn narrow title="On a card">
          <Surface
            height="raised"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10 }}
          >
            <Button label="Approve" state="rest" variant="main" />
            <Button label="Cancel" state="rest" />
            <Button icon="trash-2" label="Delete" state="rest" variant="danger" />
          </Surface>
        </Part>
        <Part inColumn narrow title="On glass">
          <Surface
            height="overlay"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10 }}
          >
            <Button label="Approve" state="rest" variant="main" />
            <Button keys="Escape" label="Keep it" state="rest" />
            <Button label="Open" state="hover" />
            <IconButton icon="x" label="Close" state="rest" />
          </Surface>
        </Part>
      </View>
    </Page>
  );
}
