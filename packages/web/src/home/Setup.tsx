// Home's Setup pane: the files a project needs before its first feature, each written or not, and
// the one button that opens a session to write them with the agent. It shows first on Home while a
// required file is missing, and goes once they are all written.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState } from "react";
import type { SetupItem } from "uraeda-binding";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { MessageToCopy } from "../StartChat.tsx";

/** Each state's words, after the item's name: the core's `missing`, `template`, or `written`. */
const STATE: Record<string, string> = {
  missing: "missing",
  template: "still the template",
  written: "written",
};

/** What each item of the setup is for, in a few words, by the core's key. */
const ABOUT: Record<string, string> = {
  "code-quality": "The limits your linters hold",
  constitution: "Your project's principles, written with you",
  preview: "For a project with a UI: mockups as live stories",
  specs: "Where Uraeda keeps the workflow's files",
  testing: "What your tests cover at this stage",
};

/** Where Claude Code's install is explained. */
const CLAUDE_CODE_SETUP = "https://code.claude.com/docs/en/setup";

/**
 * One file of the setup: a check once written, its name, its state, and what it is for. On the
 * phone, what it is for takes the full width under the head line, not a column beside the icon.
 */
function SetupRow({ item }: { item: SetupItem }) {
  const isDone = item.state === "written";
  const narrow = isNarrow(useWidthClass());
  const head = (
    <Text weight={isDone ? undefined : "semibold"}>
      {item.name}
      <Text color="secondary" type="supporting">
        {` · ${item.required ? (STATE[item.state] ?? item.state) : "optional"}`}
      </Text>
    </Text>
  );
  const about = ABOUT[item.key] !== undefined && (
    <Text color="secondary" type="supporting">
      {ABOUT[item.key]}
    </Text>
  );
  const icon = (
    <Icon color={isDone ? "success" : "secondary"} icon={isDone ? "check" : "uraeda:list"} />
  );
  if (narrow) {
    return (
      <VStack gap={0}>
        <HStack align="start" gap={2}>
          {icon}
          {head}
        </HStack>
        {about}
      </VStack>
    );
  }
  return (
    <HStack align="start" gap={2}>
      {icon}
      <VStack gap={0}>
        {head}
        {about}
      </VStack>
    </HStack>
  );
}

/** How many announcements the region keeps: one draw can make more than one. */
const KEPT = 3;

/**
 * What a screen reader hears of the setup: "Testing decision written." as an item turns written
 * while the pane shows, or leaves the list as the `specs/` folder's does once it exists, never the
 * states it found when it opened. Beside the pane, not in it, so it is still heard as the pane
 * closes.
 */
export function SetupAnnouncer({ items }: { items: ReadonlyArray<SetupItem> }) {
  const seen = useRef<Map<string, SetupItem> | undefined>(undefined);
  const count = useRef(0);
  const [said, setSaid] = useState<ReadonlyArray<{ key: number; text: string }>>([]);
  useEffect(() => {
    const before = seen.current;
    seen.current = new Map(items.map((item) => [item.key, item]));
    if (before === undefined) {
      return;
    }
    const now = seen.current;
    const left = [...before.values()].filter(
      (item) => item.state !== "written" && !now.has(item.key),
    );
    const turned = items.filter(
      (item) => item.state === "written" && before.get(item.key)?.state !== "written",
    );
    const written = items.length > 0 ? [...left, ...turned] : turned;
    if (written.length > 0) {
      setSaid((kept) =>
        [
          ...kept,
          ...written.map((item) => {
            count.current += 1;
            return { key: count.current, text: `${item.name} written.` };
          }),
        ].slice(-KEPT),
      );
    }
  }, [items]);
  // A new node for each announcement, so the same words said again are heard again. Not atomic,
  // unlike `status`'s default: only the new node is read, not those kept.
  return (
    <VisuallyHidden aria-atomic="false" aria-label="Setup updates" as="div" role="status">
      {said.map(({ key, text }) => (
        <p key={key}>{text}</p>
      ))}
    </VisuallyHidden>
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
  const left = items.filter((item) => item.required && item.state !== "written").length;
  return (
    // Closing, its last file written, it has none to count.
    <Pane count={left > 0 ? left : undefined} icon="wrench" title="Setup" tone="attention">
      <VStack align="start" gap={3}>
        {items.map((item) => (
          <SetupRow item={item} key={item.key} />
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
