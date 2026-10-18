// A done feature's record, drawn in place: its what and why and its behaviour, its decisions drawn
// as the spec page draws them, its questions folded, then its follow-ups and its file.
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { DecisionChange, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { useRepoPath } from "../routes.tsx";
import type { OpenKeys } from "../useOpenKeys.ts";
import { DecisionCard } from "../spec/DecisionCard.tsx";
import { decisionId } from "../spec/parts.ts";
import { Section } from "./Section.tsx";

/** What the record reads of the history: its counts and its decisions' changes. */
export type RecordHistory = {
  decisions: ReadonlyArray<DecisionChange>;
  questions?: number | null;
  rounds?: number | null;
};

/**
 * A `##` section's blocks, found by its heading's anchor: its heading, then each top-level block up
 * to the next heading of its level or above. None when the record has no such section.
 */
function section(document: Document, anchor: string): { body: Array<number>; heading?: number } {
  const top = document.blocks.filter((block) => block.parent === undefined);
  const start = top.findIndex(
    (block) => block.kind === "heading" && block.level === 2 && block.anchor === anchor,
  );
  if (start < 0) {
    return { body: [] };
  }
  const rest = top.slice(start + 1);
  const end = rest.findIndex((block) => block.kind === "heading" && (block.level ?? 0) <= 2);
  return {
    body: (end < 0 ? rest : rest.slice(0, end)).map((block) => block.id),
    heading: top[start]!.id,
  };
}

/** A section of the record, its heading included, as its file has it. */
function RecordSection({ anchor, document }: { anchor: string; document: Document }) {
  const { body, heading } = section(document, anchor);
  if (heading === undefined) {
    return null;
  }
  return <Blocks document={document} ids={[heading, ...body]} />;
}

/** The decisions the feature made or changed, each drawn as its change, at `#decisions`. */
function Decisions({ decisions }: { decisions: ReadonlyArray<DecisionChange> }) {
  const here = useRepoPath();
  if (decisions.length === 0) {
    return null;
  }
  return (
    <Section id="decisions" title="Decisions">
      <VStack gap={4}>
        {decisions.map((change) => (
          <DecisionCard
            change={change}
            comments={[]}
            crumbs={[]}
            href={change.kind === "removed" ? undefined : here(`/decisions/${change.name}`)}
            id={decisionId(change.name)}
            key={change.name}
            kind={change.kind}
            name={change.name}
            parts={undefined}
            title={change.title}
          />
        ))}
      </VStack>
    </Section>
  );
}

/** The key of the record's questions in the history entry's open items. */
export const QUESTIONS_KEY = "record:questions";

/** The record's questions, folded under their count, at `#questions`, open as `keys` keep them. */
function Questions({
  document,
  history,
  keys,
}: {
  document: Document;
  history: RecordHistory;
  keys: OpenKeys;
}) {
  const { body } = section(document, "questions");
  const rounds = history.rounds ?? 0;
  if (body.length === 0 || rounds === 0) {
    return null;
  }
  const title = `Questions · ${history.questions ?? 0} in ${rounds} ${rounds === 1 ? "round" : "rounds"}`;
  return (
    <section aria-label="Questions" id="questions">
      <Collapsible
        isOpen={keys.open.includes(QUESTIONS_KEY)}
        onOpenChange={(isOpen: boolean) => keys.onOpenChange(QUESTIONS_KEY, isOpen)}
        trigger={
          // A button holds no heading: the section is named, as the spec's folded history.
          <Text size="xl" weight="semibold">
            {title}
          </Text>
        }
      >
        <Blocks document={document} ids={body} />
      </Collapsible>
    </section>
  );
}

/**
 * A done item's record, read from its file `name`, drawn in place; its questions open as `keys`,
 * the page's open items, keep them.
 */
export function Record({
  folder,
  history,
  keys,
  name,
}: {
  folder: string;
  history: RecordHistory;
  keys: OpenKeys;
  name: string;
}) {
  const here = useRepoPath();
  const file = useFile(folder, name);
  const document = file?.current?.document;
  if (!file || file.missing || !document) {
    return null;
  }
  return (
    <VStack gap={6}>
      <RecordSection anchor="what-and-why" document={document} />
      <RecordSection anchor="behaviour" document={document} />
      <Decisions decisions={history.decisions} />
      <Questions document={document} history={history} keys={keys} />
      <RecordSection anchor="follow-ups" document={document} />
      <Link hasUnderline href={here(`/f/${folder}/${name}`)}>
        Open the record file
      </Link>
    </VStack>
  );
}
