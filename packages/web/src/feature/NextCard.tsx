// What comes next: who acts and what, with its one primary button.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useRepoPath } from "../routes.tsx";
import type { Next } from "./next.ts";

export const cardStyles = stylex.create({
  eyebrow: { textTransform: "uppercase" },
  // A card fills its cell of the row, so "Next" and the agent's card share one height.
  fill: { height: "100%" },
});

/** "Next": a region with its heading, its line, and its one button. */
export function NextCard({ next }: { next: Next }) {
  const here = useRepoPath();
  const { action } = next;
  return (
    <section aria-label="Next" {...stylex.props(cardStyles.fill)}>
      <Card padding={4} variant="muted" xstyle={cardStyles.fill}>
        <VStack gap={3}>
          <VStack gap={1}>
            <Text color="secondary" type="label" xstyle={cardStyles.eyebrow}>
              Next
            </Text>
            <Heading level={2}>{next.title}</Heading>
            {next.line && <Text color="secondary">{next.line}</Text>}
          </VStack>
          {action && (
            <HStack>
              <Button
                href={action.external ? action.href : here(action.href)}
                label={action.label}
                {...(action.external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                variant="primary"
              />
            </HStack>
          )}
        </VStack>
      </Card>
    </section>
  );
}
