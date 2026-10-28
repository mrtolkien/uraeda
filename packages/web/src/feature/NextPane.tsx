// What comes next: who acts and what, in a pane with its one button, which `n` presses too.
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect } from "react";
import { Pane } from "../layout/Pane.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
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
  onRun,
  tone,
}: {
  folder: string;
  next: Next;
  /** Hears what its button does, for `n`, or that it does nothing. */
  onRun?: (run: (() => void) | undefined) => void;
  tone: "active" | "attention";
}) {
  const here = useRepoPath();
  const { action } = next;
  // `n` does what its button does: opens the next step, or hands it to the session.
  const run = () => {
    if (action?.kind === "link") {
      if (action.external) {
        window.open(action.href, "_blank", "noopener,noreferrer");
      } else {
        navigate(here(action.href));
      }
    } else if (action?.kind === "continue") {
      handOver(folder, action.trigger);
    }
  };
  // Told to the page at each render, which declares `n` (see `NextKey`).
  useEffect(() => onRun?.(action ? run : undefined));
  useEffect(() => () => onRun?.(undefined), [onRun]);
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
