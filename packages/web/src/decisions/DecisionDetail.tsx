// What the decisions page's pane draws, read-only: a decision's or a principle's document, as the
// core's tree of the file, with `Blocks`.
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useLayoutEffect } from "react";
import type { Block } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useHash } from "../routes.tsx";
import { decisionIcon } from "../theme/icons.ts";
import {
  type LedgerConstitution,
  type LedgerPrinciple,
  principleName,
  versionLine,
} from "./ConstitutionRegion.tsx";
import { DecisionRules } from "./DecisionRules.tsx";
import type { LedgerDecision } from "./model.ts";

const styles = stylex.create({
  icon: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
  },
});

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
 * The top-level blocks past the title, as ids. With `drawn` rules, the blocks up to and including
 * the `## Rules` heading come first, `before`, and those after the section, `after`: the section's
 * own blocks are left out, for `DecisionRules` to draw. Without, all are `before` and `after` is
 * null.
 */
function aroundRules(
  blocks: ReadonlyArray<Block>,
  drawn: boolean,
): { after: Array<number> | null; before: Array<number> } {
  const before: Array<number> = [];
  const after: Array<number> = [];
  let state: "before" | "in" | "after" = "before";
  for (const block of blocks) {
    if (block.parent !== undefined || (block.kind === "heading" && block.level === 1)) {
      continue;
    }
    const section = block.kind === "heading" && block.level === 2;
    if (drawn && section && state === "before" && block.heading === "Rules") {
      state = "in";
    } else if (state === "in" && section) {
      state = "after";
    } else if (state === "in") {
      continue;
    }
    (state === "after" ? after : before).push(block.id);
  }
  return { after: drawn ? after : null, before };
}

/**
 * A decision: its icon and title, status, and approver, the first problem `ura check` finds in it, as an
 * error when it cannot be parsed and a warning otherwise, then its document past its title.
 */
export function DecisionDetail({ decision }: { decision: LedgerDecision }) {
  const { document } = decision;
  // A link's anchor, a section's heading in the file: the page scrolls to it once drawn.
  const hash = decodeURIComponent(useHash().slice(1));
  useLayoutEffect(() => {
    if (hash) {
      window.document.getElementById(hash)?.scrollIntoView?.({ block: "start" });
    }
  }, [hash, decision.name]);
  // The title is the pane's heading already.
  const { after, before } = aroundRules(document.blocks, decision.rules.length > 0);
  return (
    <article aria-label={decision.title}>
      <VStack gap={4}>
        <VStack gap={2}>
          <HStack align="center" gap={2}>
            <span {...stylex.props(styles.icon)}>
              <Icon icon={decisionIcon(decision.icon)} />
            </span>
            <Heading level={2}>{decision.title}</Heading>
          </HStack>
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
        <Blocks document={document} ids={before} />
        {after !== null && <DecisionRules parts={decision.rules} />}
        {after !== null && after.length > 0 && <Blocks document={document} ids={after} />}
      </VStack>
    </article>
  );
}
