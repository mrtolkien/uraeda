// The success criteria: each criterion's id and measure as pills before its sentence.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Selectable } from "../../Selection.tsx";
import { SinceWords, wordCount } from "../../sinceMarks.tsx";
import { plain, Spans } from "../../Spans.tsx";
import type { PartProps, SpecItems } from "../parts.ts";
import { builtStyles, type DrawingProps, inOrder, Leftover, Nested, parentsOf } from "./shared.tsx";
import { ruleStyles } from "../../layout/rules.ts";
import { proseStyles } from "../../Prose.tsx";

/** A criterion: its id and measure as pills, then its sentence, as the core cuts it (R75). */
function Criterion({
  criterion,
  props,
}: {
  criterion: SpecItems["criteria"][number];
  props: PartProps;
}) {
  const item = props.document.blocks[criterion.block]!;
  return (
    <li {...stylex.props(ruleStyles.between, builtStyles.row)}>
      <Selectable block={item} selection={props.selection}>
        <HStack align="start" gap={2}>
          <Icon color="success" icon="check" size="md" />
          <VStack gap={1}>
            <HStack align="center" gap={2} wrap="wrap">
              <Badge label={criterion.id} variant="neutral" />
              {criterion.measure != null && <Badge label={criterion.measure} variant="info" />}
            </HStack>
            <Text display="block" type="inherit" xstyle={proseStyles.reading}>
              {/* Changed since your review: its words after the id and measure, its pills'. */}
              <SinceWords
                block={item}
                lead={wordCount(plain(item.spans)) - wordCount(plain(criterion.sentence))}
                spans={criterion.sentence}
              >
                <Spans spans={criterion.sentence} />
              </SinceWords>
            </Text>
            <Nested item={item} props={props} />
          </VStack>
        </HStack>
      </Selectable>
    </li>
  );
}

/**
 * The success criteria: their list drawn as rows, its items without an id as written, and the
 * part's other blocks as written.
 */
export function Criteria({ items, part, props }: DrawingProps) {
  const byBlock = new Map(items.criteria.map((c) => [c.block, c]));
  const lists = parentsOf(props, [...byBlock.keys()]);
  return inOrder(part, props, (block) =>
    lists.has(block.id) ? (
      <VStack as="ul" gap={3} key={block.id} xstyle={builtStyles.list}>
        {props.document.blocks
          .filter((item) => item.parent === block.id)
          .map((item) => {
            const criterion = byBlock.get(item.id);
            return criterion ? (
              <Criterion criterion={criterion} key={item.id} props={props} />
            ) : (
              <li key={item.id} {...stylex.props(ruleStyles.between, builtStyles.row)}>
                <Leftover item={item} props={props} />
              </li>
            );
          })}
      </VStack>
    ) : undefined,
  );
}
