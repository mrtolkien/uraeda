// The text field's gallery page: the field at rest, focused, in each Vim mode, refused, disabled,
// of one line and of many, the composer, and the picker's field. The gallery's host turns Vim's
// keys on with `vim`, for the typing test on the hidden display.
import { type JSX, signal, View } from "nsh";
import { vimKeys } from "uraeda/native";
import { Page, Part } from "../parts";
import { Button, Text } from "../../ui/controls";
import { Composer, PickerField, SaveStatus, TextField, vimStatus } from "../../ui/text";

const NOTE = `# Recurring tasks

A task that comes back on its own: **daily**, weekly, or on a day of the month.

- Its next date shows on its row, as \`Tomorrow\`.
- A [link](https://example.com) and a long line that wraps at the field's width, never scrolling sideways, however long it gets.
`;

const MODES = ["NORMAL", "INSERT", "VISUAL", "REPLACE", "COMMAND"];

const FILES = [
  { id: "spec", title: "specs/recurring-tasks/spec.md" },
  { id: "plan", title: "specs/recurring-tasks/plan.md" },
  { id: "decision", aside: "decision", title: "specs/decisions/text-editing.md" },
];

/** A line of the page: its name, then a field that takes the rest of the width. */
function Line(props: { children?: JSX.Element; name: string; narrow: boolean }) {
  return (
    <View
      style={{
        alignItems: props.narrow ? "stretch" : "flex-start",
        flexDirection: props.narrow ? "column" : "row",
        gap: props.narrow ? 2 : 12,
      }}
    >
      <View style={{ paddingTop: props.narrow ? 0 : 4, width: props.narrow ? undefined : 96 }}>
        <Text size="under" tone="faint">
          {props.name}
        </Text>
      </View>
      <View style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}>{props.children}</View>
    </View>
  );
}

/** What the Vim layer cost so far, read again as the mode changes: calls, and microseconds each. */
function cost() {
  vimStatus();
  const { keys, micros } = vimKeys();
  return keys === 0 ? "Vim: no call" : `Vim: ${keys} calls, ${Math.round(micros / keys)} µs each`;
}

function Fields(props: { narrow: boolean }) {
  const note = signal(NOTE);
  const slug = signal("recurring-tasks");
  const message = signal("Run the tests again, then open the pull request.");
  const typed = signal("");
  return (
    <Page narrow={props.narrow}>
      <Part narrow={props.narrow} title="One line">
        <Line name="at rest" narrow={props.narrow}>
          <TextField label="Search" lines="one" placeholder="Find a file…" value="" />
        </Line>
        <Line name="typed in" narrow={props.narrow}>
          <TextField
            autoFocus
            label="Typed in"
            lines="one"
            onChange={(value) => typed.set(value)}
            onSave={() => typed.set("")}
            testID="typed"
            value={typed()}
          />
        </Line>
        <Line name="focused" narrow={props.narrow}>
          <TextField
            label="Slug"
            lines="one"
            onChange={(value) => slug.set(value)}
            shown="focus"
            value={slug()}
          />
        </Line>
        <Line name="refused" narrow={props.narrow}>
          <TextField
            label="Slug"
            lines="one"
            refusal="A slug is letters, digits, and dashes: try recurring-tasks."
            value="recurring tasks!"
          />
        </Line>
        <Line name="hint" narrow={props.narrow}>
          <TextField hint="Shown in the branch's name." label="Slug" lines="one" value="rt" />
        </Line>
        <Line name="disabled" narrow={props.narrow}>
          <TextField disabled label="Slug" lines="one" value="recurring-tasks" />
        </Line>
      </Part>
      <Part narrow={props.narrow} title="Vim's modes">
        <Each of={MODES}>
          {(mode: () => string) => (
            <Line name={mode().toLowerCase()} narrow={props.narrow}>
              <TextField label={mode()} lines="one" shown={mode()} value="A field in this mode." />
            </Line>
          )}
        </Each>
        <Text
          size="under"
          tone="faint"
        >{`Live: ${vimStatus().mode || "no field"} ${vimStatus().pending}`}</Text>
        <Text size="under" tone="faint">
          {cost()}
        </Text>
      </Part>
      <Part narrow={props.narrow} title="Many lines" wide>
        <TextField
          label="Notes"
          onChange={(value) => note.set(value)}
          rows={{ max: 12, min: 4 }}
          value={note()}
        />
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <Button keys="mod+Enter" label="Save" />
          <SaveStatus dirty={note() !== NOTE} state={{ kind: "idle" }} />
        </View>
        <SaveStatus dirty={false} state={{ kind: "saved" }} />
        <SaveStatus dirty state={{ kind: "refused", why: "The file changed on disk." }} />
      </Part>
      <Part narrow={props.narrow} title="The composer">
        <Composer
          label="Message"
          onChange={(value) => message.set(value)}
          onSend={() => message.set("")}
          queued="Sent once this turn ends"
          value={message()}
        />
      </Part>
      <Part narrow={props.narrow} title="A picker's field">
        <PickerField items={FILES} label="Attach a file" onPick={() => {}} placeholder="@ a file" />
      </Part>
    </Page>
  );
}

/** The page, as the gallery draws it. */
export function fields(narrow: boolean) {
  return <Fields narrow={narrow} />;
}
