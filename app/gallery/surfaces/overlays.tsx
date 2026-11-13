// The overlays, each open over a busy page: a dialog, which is a sheet on a narrow window; the
// confirmation of an act that cannot be taken back, which says what it will do; a sheet; a popover, which stays a popover at every width; toasts, stacked from the top; an
// overlay in the corner; and a tip beside what the pointer rests on.
import { type JSX, signal, View, type ViewRef } from "nsh";
import { Busy, gapOf } from "../parts";
import { Button, Confirm, Icon, Kbd, Text } from "../../ui/controls";
import { Row } from "../../ui/lists";
import {
  Dialog,
  Overlay,
  Pane,
  Popover,
  Sheet,
  Toast,
  Toasts,
  Tooltip,
  Well,
} from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";

const nothing = () => {};

/** The page the overlays float over: a pane with the focus beside one at rest, both busy. */
function Under(props: { first?: JSX.Element; narrow: boolean; over?: JSX.Element }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: gapOf(props.narrow),
        height: props.narrow ? 560 : 640,
        paddingTop: tokens.pane.titleRise,
      }}
    >
      <Pane
        body={{ flex: 1, gap: 8 }}
        focused
        height="raised"
        more="· nsh-migration"
        running
        style={{ flex: 2 }}
        title="Session"
      >
        {props.first}
        <View style={{ flex: 1 }}>
          <Busy times={60} />
        </View>
      </Pane>
      <If when={!props.narrow}>
        <Pane
          body={{ flex: 1 }}
          height="raised"
          more="· 61 tasks"
          style={{ flex: 1 }}
          title="Plan"
          tone={tokens.role.heading1}
        >
          <View style={{ flex: 1 }}>
            <Busy times={30} />
          </View>
        </Pane>
      </If>
      {props.over}
    </View>
  );
}

export function dialog(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Dialog icon="triangle-alert" testID="dialog" title="Delete task 27?" width={460}>
          <Text>Its session and its 4 uncommitted changes go with it. This cannot be undone.</Text>
          <Well style={{ paddingHorizontal: 9, paddingVertical: 2 }}>
            <Text tone="faint">Type the task's number to confirm</Text>
          </Well>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <Button label="Keep it" onPress={nothing} />
            <Button icon="trash-2" label="Delete" onPress={nothing} variant="danger" />
          </View>
        </Dialog>
      }
    />
  );
}

export function confirm(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Confirm
          icon="arrow-up"
          keys="P"
          label="Push 3 commits"
          onClose={nothing}
          onConfirm={nothing}
          open
          title="Push 3 commits to origin/main?"
          words="They leave this machine for origin, where others pull them: a push is not taken back from here."
        />
      }
    />
  );
}

export function discard(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Confirm
          icon="trash-2"
          keep="Keep them"
          keys="d"
          label="Discard the changes"
          loses
          onClose={nothing}
          onConfirm={nothing}
          open
          title="Discard the changes to README.md?"
          words="The file goes back to its last commit. Nothing can bring the changes back."
        />
      }
    />
  );
}

const OUTLINE = ["Summary", "What changes", "Requirements", "Open questions", "Success criteria"];

export function sheet(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Sheet testID="sheet" title="Outline">
          {OUTLINE.map((line, at) => (
            <Row selected={at === 1}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text tone="faint">{String(at + 1)}</Text>
                <Text>{line}</Text>
              </View>
            </Row>
          ))}
        </Sheet>
      }
    />
  );
}

const MODELS: Array<[name: string, aside: string, picked: boolean]> = [
  ["Claude Fable", "default", true],
  ["Claude Opus", "", false],
  ["Codex", "off here", false],
];

export function popover(narrow: boolean) {
  const anchor = signal<ViewRef | null>(null);
  return (
    <Under
      first={
        <View
          ref={(node: ViewRef) => anchor.set(node)}
          style={{ alignSelf: "flex-start", marginLeft: narrow ? 0 : 120 }}
        >
          <Button label="Model: Claude Fable" onPress={nothing} state="hover" />
        </View>
      }
      narrow={narrow}
      over={
        <Popover anchor={anchor()} name="Model" testID="popover" width={260}>
          {MODELS.map(([name, aside, picked]) => (
            <Row selected={picked}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Icon
                  colour={picked ? tokens.role.action : tokens.role.inkFaint}
                  name={picked ? "check" : "square-dashed"}
                />
                <View style={{ flexGrow: 1 }}>
                  <Text>{name}</Text>
                </View>
                <Text size="under" tone="faint">
                  {aside}
                </Text>
              </View>
            </Row>
          ))}
        </Popover>
      }
    />
  );
}

export function toasts(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Toasts>
          <Toast icon="git-commit-horizontal" testID="toast" title="Landing in git">
            <Text>Approving the spec of Performance pass</Text>
            <Text size="under" tone="faint">
              1 more waits its turn
            </Text>
          </Toast>
          <Toast icon="check" title="Deleted the note">
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <View style={{ flexGrow: 1, flexShrink: 1 }}>
                <Text>“Glass bar over the transcript”</Text>
              </View>
              <Button label="Undo" onPress={nothing} />
            </View>
          </Toast>
        </Toasts>
      }
    />
  );
}

const LEADER: Array<[key: string, word: string]> = [
  ["f", "+find"],
  ["n", "+new"],
  ["u", "+ui"],
  ["?", "Keyboard shortcuts"],
];

export function corner(narrow: boolean) {
  return (
    <Under
      narrow={narrow}
      over={
        <Overlay name="Leader menu" place="corner" testID="corner" title="Space">
          {LEADER.map(([key, word]) => (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 8,
                minHeight: narrow ? 44 : tokens.space.row,
                minWidth: 220,
              }}
            >
              <Kbd keys={key} />
              <Text tone="faint">➜</Text>
              <Text>{word}</Text>
            </View>
          ))}
        </Overlay>
      }
    />
  );
}

export function tip(narrow: boolean) {
  return (
    <Under
      first={
        <Tooltip
          style={{ alignSelf: "flex-start", marginLeft: narrow ? 0 : 120, marginTop: 40 }}
          text="Send the message · Ctrl+⏎"
        >
          <View testID="tipped">
            <Button icon="send" label="Send" onPress={nothing} />
          </View>
        </Tooltip>
      }
      narrow={narrow}
    />
  );
}
