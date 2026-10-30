// A done feature's record, drawn in place: its what and why and its behaviour, its decisions drawn
// as the spec page draws them, or as its record lists them when its commits were not found, its
// questions folded, then its follow-ups, each part a pane. Its file is the Merged stage's link.
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { DecisionChange, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import type { OpenKeys } from "../useOpenKeys.ts";
import { DecisionCard } from "../spec/DecisionCard.tsx";
import { decisionId, GROUPS } from "../spec/parts.ts";
import { plural } from "../labels.ts";

const styles = stylex.create({
  // The decisions in a layer of their own, under the top bar: on the phone, a card's sticking head,
  // pushed up as its card scrolls away, slides under the bar rather than over it.
  layer: { isolation: "isolate" },
});

/** What the record reads of the history: its counts and its decisions' changes. */
export type RecordHistory = {
  decisions: ReadonlyArray<DecisionChange>;
  /** Whether its commits were found on the default branch, with its decisions' changes. */
  found: boolean;
  questions?: number | null;
  rounds?: number | null;
};

/**
 * A `##` section's blocks, found by its heading's anchor: its heading, then each top-level block up
 * to the next heading of its level or above. None when the record has no such section.
 */
function section(document: Document, anchor: string): { body: Array<number>; title?: string } {
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
    title: top[start]!.heading ?? anchor,
  };
}

/** A section of the record as a pane titled by its heading, its anchor as id, as its file has it. */
function RecordSection({ anchor, document }: { anchor: string; document: Document }) {
  const { body, title } = section(document, anchor);
  if (title === undefined) {
    return null;
  }
  return (
    <Pane id={anchor} isSnugOnPhone title={title}>
      <Blocks document={document} ids={body} />
    </Pane>
  );
}

/** The decisions the feature made or changed, each drawn as its change, in the pane `#record-decisions`. */
function Decisions({ decisions }: { decisions: ReadonlyArray<DecisionChange> }) {
  const here = useRepoPath();
  if (decisions.length === 0) {
    return null;
  }
  return (
    <Pane count={decisions.length} id="record-decisions" isSnugOnPhone title="Decisions">
      <VStack gap={4} xstyle={styles.layer}>
        {decisions.map((change) => (
          <DecisionCard
            change={change}
            comments={[]}
            crumbs={[GROUPS.decisions.title]}
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
    </Pane>
  );
}

/** The key of the record's questions in the history entry's open items. */
export const QUESTIONS_KEY = "record:questions";

/** The record's questions, a pane folded to its count at `#record-questions`, open as `keys` keep them. */
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
  return (
    <Pane
      count={history.questions ?? 0}
      fold={{
        isOpen: keys.open.includes(QUESTIONS_KEY),
        onOpenChange: (isOpen) => keys.onOpenChange(QUESTIONS_KEY, isOpen),
      }}
      id="record-questions"
      title="Questions"
      titleSuffix={`in ${plural(rounds, "round")}`}
    >
      <Blocks document={document} ids={body} />
    </Pane>
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
  const file = useFile(folder, name);
  const document = file?.current?.document;
  if (!file || file.missing || !document) {
    return null;
  }
  return (
    <VStack gap={6}>
      <RecordSection anchor="what-and-why" document={document} />
      <RecordSection anchor="behaviour" document={document} />
      {history.found ? (
        <Decisions decisions={history.decisions} />
      ) : (
        // Its commits not found, as after a squash merge: the record's own list of them.
        <RecordSection anchor="decisions" document={document} />
      )}
      <Questions document={document} history={history} keys={keys} />
      <RecordSection anchor="follow-ups" document={document} />
    </VStack>
  );
}
