// Home's Setup pane: the files a project needs before its first feature, each written or not, and
// the one button that opens a session to write them with the agent. It shows first on Home while a
// required file is missing, and goes once they are all written.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Pane } from "../layout/Pane.tsx";
import { MessageToCopy } from "../StartChat.tsx";

/** A file of the setup: `missing`, `template` when it is there but unwritten, `written`. */
export type SetupItem = {
  /** What it is for, in a few words. */
  about: string;
  /** Whether the project counts as set up without it, like the preview decision. */
  isOptional?: boolean;
  name: string;
  state: "missing" | "template" | "written";
};

/** Each state's words, after the item's name. */
const STATE: Record<SetupItem["state"], string> = {
  missing: "missing",
  template: "still the template",
  written: "written",
};

/** Where Claude Code's install is explained. */
const CLAUDE_CODE_SETUP = "https://code.claude.com/docs/en/setup";

/** One file of the setup: a check once written, its name, its state, and what it is for. */
function SetupRow({ item }: { item: SetupItem }) {
  const isDone = item.state === "written";
  return (
    <HStack align="start" gap={2}>
      <Icon color={isDone ? "success" : "secondary"} icon={isDone ? "check" : "uraeda:list"} />
      <VStack gap={0}>
        <Text weight={isDone ? undefined : "semibold"}>
          {item.name}
          <Text color="secondary" type="supporting">
            {` · ${item.isOptional ? "optional" : STATE[item.state]}`}
          </Text>
        </Text>
        <Text color="secondary" type="supporting">
          {item.about}
        </Text>
      </VStack>
    </HStack>
  );
}

/**
 * The Setup pane: `items` in the skill's order, and "Set up with the agent", which fills a new
 * session's composer with `message`; without the agent, `message` to copy, and where to install it.
 */
export function SetupPane({
  hasAgent,
  items,
  message,
  onSetUp,
}: {
  hasAgent: boolean;
  items: Array<SetupItem>;
  message: string;
  onSetUp: () => void;
}) {
  const left = items.filter((item) => !item.isOptional && item.state !== "written").length;
  return (
    <Pane count={left} icon="wrench" title="Setup" tone="attention">
      <VStack align="start" gap={3}>
        {items.map((item) => (
          <SetupRow item={item} key={item.name} />
        ))}
        {hasAgent ? (
          <Button label="Set up with the agent" onClick={onSetUp} variant="primary" />
        ) : (
          <VStack align="start" gap={2}>
            <MessageToCopy text={message} />
            <Link hasUnderline href={CLAUDE_CODE_SETUP}>
              Install Claude Code
            </Link>
          </VStack>
        )}
      </VStack>
    </Pane>
  );
}
