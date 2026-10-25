// What comes next: who acts and what, in a pane with its one button.
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { handOver } from "../sessions.ts";
import type { Next } from "./next.ts";

/**
 * "Next": a pane named "Next", peach when a human gate waits on you, active otherwise, holding what
 * comes next, its line, and its one button: a link, or "Continue", which opens the session with
 * the message in its composer and sends nothing.
 */
export function NextPane({
  folder,
  next,
  tone,
}: {
  folder: string;
  next: Next;
  tone: "active" | "attention";
}) {
  const here = useRepoPath();
  const { action } = next;
  return (
    <Pane
      id="next"
      isActive={tone === "active"}
      title="Next"
      tone={tone === "attention" ? tone : undefined}
    >
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={3}>{next.title}</Heading>
          {next.line && <Text color="secondary">{next.line}</Text>}
        </VStack>
        {action?.kind === "link" && (
          <Button
            href={action.external ? action.href : here(action.href)}
            label={action.label}
            {...(action.external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
            variant="primary"
          />
        )}
        {action?.kind === "continue" && (
          <Button
            clickAction={() => handOver(folder, action.trigger)}
            label={action.label}
            variant="primary"
          />
        )}
      </VStack>
    </Pane>
  );
}
