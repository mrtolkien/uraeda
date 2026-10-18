// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The session's composer, with the one recommended workflow message to insert beside Send.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { Page } from "../layout/Page.tsx";

/** The message the server recommends now: its name, as the button reads it. */
export const RECOMMENDED = "Address the pull request's comments";

/** Why nothing is recommended. */
export const NOTHING = "No recommended message: the feature waits on you";

/** The recommended message, inserted into the composer, unsent. */
export const FILLED_TEXT =
  "/uraeda Continue the feature specs/2026-10-18-redesign-feature/ on branch 2026-10-18-redesign-feature: Address the comments on its pull request, starting with skills/uraeda/references/implementation.md.";

/**
 * The composer: its text, the button inserting the recommended message when there is one, or why
 * there is none, and Send, named by what it starts.
 */
export function ComposerMessages({
  recommended,
  text = "",
}: {
  recommended?: string;
  text?: string;
}) {
  const inserted = text !== "";
  return (
    <Page>
      <Card padding={3}>
        <VStack gap={2}>
          <TextArea isLabelHidden label="Message" rows={7} value={text} />
          <HStack align="center" gap={2} justify="between" wrap="wrap">
            {recommended && !inserted ? (
              <Button
                label={`Insert: ${recommended}`}
                tooltip="Insert the recommended message"
                variant="secondary"
              />
            ) : !recommended ? (
              <Text color="secondary" type="supporting">
                {NOTHING}
              </Text>
            ) : (
              <span />
            )}
            <Button
              isDisabled={!inserted}
              label={inserted ? "Start the agent" : "Send"}
              variant="primary"
            />
          </HStack>
        </VStack>
      </Card>
    </Page>
  );
}
