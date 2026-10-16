// What the decisions page's pane draws, read-only: a decision's or a principle's document, as the
// core's tree of the file, with `Blocks`.
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "../Blocks.tsx";
import {
  type LedgerConstitution,
  type LedgerPrinciple,
  principleName,
  versionLine,
} from "./ConstitutionRegion.tsx";
import type { LedgerDecision } from "./model.ts";

const STATUSES: Record<string, string> = {
  active: "Active",
  proposed: "Proposed",
};

/** A decision's status, as words. */
export function statusLabel(status: string): string {
  return STATUSES[status] ?? status;
}

/**
 * A principle: its number and title, its rules and its rationale, the blocks under its heading,
 * then the constitution's version line.
 */
export function PrincipleDetail({
  constitution,
  principle,
}: {
  constitution: LedgerConstitution;
  principle: LedgerPrinciple;
}) {
  // Its heading is the pane's.
  const [, ...ids] = principle.blocks;
  const version = versionLine(constitution);
  return (
    <article aria-label={principleName(principle)}>
      <VStack gap={4}>
        <VStack gap={1}>
          <Text color="secondary" type="supporting">
            Principle {principle.number}
          </Text>
          <Heading level={2}>{principle.title}</Heading>
        </VStack>
        <Blocks document={constitution.document} ids={ids} />
        {version && (
          <Text color="secondary" type="supporting">
            {version}
          </Text>
        )}
      </VStack>
    </article>
  );
}

/**
 * A decision: its title, status, and approver, the first problem `ura check` finds in it, as an
 * error when it cannot be parsed and a warning otherwise, then its document past its title.
 */
export function DecisionDetail({ decision }: { decision: LedgerDecision }) {
  const { document } = decision;
  // The title is the pane's heading already.
  const ids = document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  return (
    <article aria-label={decision.title}>
      <VStack gap={4}>
        <VStack gap={2}>
          <Heading level={2}>{decision.title}</Heading>
          {(decision.status !== null || decision.approvedBy !== null) && (
            <HStack align="center" gap={2} wrap="wrap">
              {decision.status !== null && (
                <Badge
                  label={statusLabel(decision.status)}
                  variant={decision.status === "active" ? "green" : "yellow"}
                />
              )}
              {decision.approvedBy !== null && (
                <Text color="secondary" type="supporting">
                  Approved by {decision.approvedBy}
                </Text>
              )}
            </HStack>
          )}
        </VStack>
        {decision.problem !== null &&
          (decision.unreadable ? (
            <Banner description={decision.problem} status="error" title="Can't read this file" />
          ) : (
            <Banner status="warning" title={decision.problem} />
          ))}
        <Blocks document={document} ids={ids} />
      </VStack>
    </article>
  );
}
