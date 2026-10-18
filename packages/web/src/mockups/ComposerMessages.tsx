// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The session's composer, with the workflow messages that apply now in a menu beside Send.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import type { DropdownMenuItemData } from "@astryxdesign/core/DropdownMenu";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { HStack } from "@astryxdesign/core/HStack";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { Page } from "../layout/Page.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";

/** A workflow message the server offers: its name, and why it applies now. */
export type MockMessage = { disabled?: boolean; label: string; line?: string };

/** The messages when the agent has a step to run, and a pull request is open. */
export const MESSAGES: Array<MockMessage> = [
  { label: "Continue: write the plan", line: "The step waiting on the agent" },
  { label: "Address the pull request's comments", line: "Pull request #31 is open" },
];

/** The menu when nothing applies: the feature waits on you, and has no pull request. */
export const NOTHING: Array<MockMessage> = [
  { disabled: true, label: "No workflow message now: the feature waits on you" },
];

/** A picked message, filled into the composer, unsent. */
export const FILLED_TEXT =
  "/uraeda Continue the feature specs/2026-10-18-redesign-feature/ on branch 2026-10-18-redesign-feature: Address the comments on its pull request, starting with skills/uraeda/references/implementation.md.";

/** The composer: its text, the messages menu, open or not, and Send, named by what it starts. */
export function ComposerMessages({
  isMenuOpen = false,
  messages,
  text = "",
}: {
  isMenuOpen?: boolean;
  messages: Array<MockMessage>;
  text?: string;
}) {
  const wide = useWidthClass() === "wide";
  const items: Array<DropdownMenuItemData> = messages.map((message) => ({
    description: message.line,
    isDisabled: message.disabled,
    label: message.label,
  }));
  return (
    <Page>
      <Card padding={3}>
        <VStack gap={2}>
          <TextArea isLabelHidden label="Message" rows={7} value={text} />
          <HStack gap={2} justify="end">
            <DropdownMenu
              alignment="end"
              button={{ label: "Messages", variant: "secondary" }}
              isMenuOpen={isMenuOpen}
              items={items}
              presentation={wide ? "popover" : "bottom-sheet"}
            />
            <Button
              isDisabled={text === ""}
              label={text === "" ? "Send" : "Start the agent"}
              variant="primary"
            />
          </HStack>
        </VStack>
      </Card>
    </Page>
  );
}
