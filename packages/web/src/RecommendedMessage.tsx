// The one workflow message the server recommends for a feature now, which the session's composer
// offers to insert.
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import type { Trigger } from "uraeda-server/fate";
import { useRecommendedMessage } from "./data.ts";

/** A recommended message, inserted: its text, and the step and trigger its run carries. */
export type Inserted = { step: string; text: string; trigger: Trigger };

/** The composer's text once `message` is inserted: the message, then what was typed, kept. */
export function withInserted(message: string, typed: string): string {
  const text = message.trimEnd();
  return typed.trim() ? `${text}\n${typed}` : text;
}

/**
 * The composer's offer of the feature's recommended message: "Insert: <name>", which hands it to
 * `onInsert`, unsent, or why none applies, as supporting text. Nothing before it is read.
 */
export function RecommendedMessage({
  folder,
  onInsert,
}: {
  folder: string;
  onInsert: (message: Inserted) => void;
}) {
  const recommended = useRecommendedMessage(folder);
  if (!recommended) {
    return null;
  }
  const { name, reason, step, text, trigger } = recommended;
  if (name === null || step === null || trigger === null) {
    return reason === null ? null : (
      <Text color="secondary" type="supporting">
        {reason}
      </Text>
    );
  }
  return (
    <Button
      clickAction={() => onInsert({ step, text, trigger })}
      label={`Insert: ${name}`}
      tooltip="Insert the recommended message"
      variant="secondary"
    />
  );
}
