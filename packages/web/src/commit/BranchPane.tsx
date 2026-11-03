// One branch's pane of the Commit page: what its commit holds, a change to a line, its message in
// the shared editor, the core's suggestion until the human rewrites it, and its own Commit and
// Discard, which the phone's bottom bar holds instead while the page has one pane.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { TextField } from "../fields/TextField.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { Pane } from "../layout/Pane.tsx";
import { markVars } from "../marks.stylex.ts";
import { WriteButton } from "../writes/WriteButton.tsx";
import { messageField } from "./usePaneWrites.ts";

const styles = stylex.create({
  // One change: its kind, small, over what it is about.
  change: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: markVars["--mark-change-bar"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/** A pane as the server sends it: its branch, its feature's folder, its lines, its suggestion. */
export type CommitPane = {
  branch: string;
  count: number;
  folder: string | null;
  lines: ReadonlyArray<string>;
  message: string;
};

/** A change line of the core, `- Add to the inbox: text`, as its kind and its text. */
function parts(line: string) {
  const body = line.replace(/^- /, "");
  const at = body.indexOf(": ");
  if (at !== -1) {
    return { kind: body.slice(0, at), text: body.slice(at + 2) };
  }
  // A file a buffer edited, `- Edit spec.md`: its kind over its path.
  const edit = /^Edit (.+)$/.exec(body);
  return edit ? { kind: "Edit", text: edit[1]! } : { kind: "", text: body };
}

/** What the commit holds: one change to a line, its kind over its text. */
function Changes({ lines }: { lines: ReadonlyArray<string> }) {
  return (
    <VStack gap={2}>
      {lines.map((line, at) => {
        const { kind, text } = parts(line);
        return (
          <div key={at} {...stylex.props(styles.change)}>
            {kind && (
              <Text color="secondary" display="block" type="supporting">
                {kind}
              </Text>
            )}
            <Text display="block">{text}</Text>
          </div>
        );
      })}
    </VStack>
  );
}

/** What the restore notice adds when the core's suggestion changed since the message was typed. */
const SUGGESTION_CHANGED = "The suggested message changed since.";

/**
 * A branch's pane. Its message is the suggestion until rewritten, then unsaved text, kept by
 * branch until its commit lands, and marked; "Use the suggested message" brings the core's back.
 * Ctrl+Enter in the field commits the pane, as its Commit button does. `hasButtons` is false on the
 * phone with one pane, whose bottom bar holds them.
 */
export function BranchPane({
  hasButtons,
  isPicked,
  onCommit,
  onDiscard,
  pane,
}: {
  hasButtons: boolean;
  isPicked: boolean;
  onCommit: () => Promise<unknown>;
  onDiscard: () => void;
  pane: CommitPane;
}) {
  const field = useTextField(messageField(pane.branch), pane.message);
  const rewritten = field.text !== pane.message;
  return (
    <Pane icon="uraeda:git-branch" isActive={isPicked} title={pane.branch}>
      <VStack gap={3}>
        <Changes lines={pane.lines} />
        {field.restored && (
          <RestoreNotice
            changed={SUGGESTION_CHANGED}
            onDiscard={field.discard}
            restored={field.restored}
          />
        )}
        <TextField
          kind={pane.count > 1 ? "comment" : "line"}
          label="Message"
          onChange={field.change}
          onSubmit={() => void onCommit()}
          value={field.text}
        />
        {(hasButtons || rewritten) && (
          <HStack align="center" gap={2} wrap="wrap">
            {hasButtons && (
              <>
                <WriteButton
                  endContent={<Icon aria-hidden="true" icon="uraeda:enter" label="Enter" />}
                  label="Commit"
                  onClick={onCommit}
                  variant="primary"
                />
                {/* Not `clickAction`: its pending state closes the question this opens. */}
                <Button label="Discard" onClick={onDiscard} variant="ghost" />
              </>
            )}
            {rewritten && (
              <>
                <Button label="Use the suggested message" onClick={field.discard} variant="ghost" />
                <Text color="secondary" type="supporting">
                  Unsaved message
                </Text>
              </>
            )}
          </HStack>
        )}
      </VStack>
    </Pane>
  );
}
