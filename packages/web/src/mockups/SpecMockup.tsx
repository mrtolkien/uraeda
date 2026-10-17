// TEMPORARY: the spec page's mockup for the specs redesign (`specs/2026-10-17-redesign-specs/`),
// drawn by `SpecPage.stories.tsx`, over the mockup feature's spec and data model, written in the
// shape the redesign proposes (see `.storybook/specMockup.ts`). It walks the document tree for parts
// the core does not send yet, and shows a story's mockup as a box with its name: the implementation
// embeds it live, as today. Nothing here saves.
import { Badge } from "@astryxdesign/core/Badge";
import { Blockquote } from "@astryxdesign/core/Blockquote";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { SideColumn } from "../layout/SideColumn.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";
import { DecisionChange, NewDecision } from "./DecisionChange.tsx";
import {
  DUE_DATES_AFTER,
  DUE_DATES_BEFORE,
  REPEATING_TASKS,
  TASK_HISTORY,
  TASK_STORAGE_AFTER,
  TASK_STORAGE_BEFORE,
} from "./decisionTexts.ts";
import { itemsOf, Panel, storyHeadings, StoryList } from "./SpecStory.tsx";

const styles = stylex.create({
  band: {
    // On the phone, a band between the spec's groups, to the screen's edges.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginInline: `calc(-1 * ${spacingVars["--spacing-3"]})`,
  },
  indent: { paddingInlineStart: spacingVars["--spacing-4"] },
  page: {
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    padding: spacingVars["--spacing-6"],
  },
  pagePhone: {
    // On the phone, the text takes the screen's width, with the smallest inset.
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** The top-level blocks of each level-2 section, by its title, and those before the first one. */
function sectionsOf(document: Document): Map<string, Array<number>> {
  const sections = new Map<string, Array<number>>([["", []]]);
  let current = "";
  for (const block of document.blocks.filter((b) => b.parent === undefined)) {
    if (block.kind === "heading" && block.level === 2) {
      current = plain(block.spans);
      sections.set(current, []);
    } else {
      sections.get(current)?.push(block.id);
    }
  }
  return sections;
}

/** The answers to the last review, each under the comment it answers. */
function ReviewAnswers({
  comments,
  document,
  ids,
}: {
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  return (
    <VStack gap={4}>
      {itemsOf(document, ids).map((item) => {
        const number = Number(/^C(\d+)/.exec(item.spans[0]?.text ?? "")?.[1]);
        const comment = comments.find((c) => c.number === number);
        const [, ...answer] = item.spans;
        const verdict =
          plain(answer)
            .replace(/^\s*(\([^)]*\))?:\s*/, "")
            .split(".")[0] ?? "";
        return (
          <VStack gap={1} key={item.id}>
            <HStack align="center" gap={2}>
              <Text weight="semibold">Your comment</Text>
              <Badge label={verdict} variant={verdict.startsWith("done") ? "success" : "warning"} />
            </HStack>
            {comment && comment.quote.length > 0 && (
              <Blockquote>
                {comment.quote.map((line) => line.replace(/^>\s?/, "").trim()).join(" ")}
              </Blockquote>
            )}
            {comment && <Text color="secondary">“{comment.text}”</Text>}
            <Text>
              <Spans
                spans={answer.map((s, i) =>
                  i === 0 ? { ...s, text: s.text.replace(/^\s*(\([^)]*\))?:\s*\w+\.\s*/, "") } : s,
                )}
              />
            </Text>
          </VStack>
        );
      })}
    </VStack>
  );
}

/** Each kind of decision change, its badge, and the two versions the mockup compares. */
const KINDS = {
  Changed: { after: TASK_STORAGE_AFTER, before: TASK_STORAGE_BEFORE, variant: "warning" },
  New: { after: REPEATING_TASKS, before: "", variant: "success" },
  Removed: { after: "", before: TASK_HISTORY, variant: "error" },
} as const;

/** A decision's card: its badges, its note, then its text, its change, or its removed text. */
function DecisionCard({
  kind,
  listed = true,
  name,
  note,
}: {
  kind: keyof typeof KINDS;
  listed?: boolean;
  name: string;
  note: ReactNode;
}) {
  const { after, before, variant } = listed ? KINDS[kind] : UNLISTED;
  return (
    <Panel
      badges={
        <>
          <Badge label={kind} variant={variant} />
          {!listed && <Badge label="Not listed in the spec" variant="error" />}
        </>
      }
      crumbs={["Decisions"]}
      id={`decision-${name.toLowerCase().replaceAll(" ", "-")}`}
      title={name}
    >
      {note}
      {kind === "New" ? (
        <NewDecision text={after} />
      ) : (
        <DecisionChange after={after} before={before} />
      )}
    </Panel>
  );
}

/** The change the mockup's branch makes to due dates, which its spec does not list. */
const UNLISTED = { after: DUE_DATES_AFTER, before: DUE_DATES_BEFORE, variant: "warning" } as const;

/**
 * The decisions the spec lists, each a card with its text or its change, then a decision the branch
 * changes without listing it, then the decisions relied on.
 */
function Decisions({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const relied = ids.filter((id) => document.blocks[id]?.kind !== "list");
  return (
    <VStack gap={4}>
      {itemsOf(document, ids).map((item) => {
        const [lead, ...rest] = item.spans;
        const label = lead?.text ?? "";
        const kind = (["New", "Changed", "Removed"] as const).find((k) => label.startsWith(k));
        const name = item.spans.find((s) => s.link)?.text ?? label.replace(/^\w+:\s*/, "");
        const note = rest
          .filter((s) => !s.link && !s.code)
          .map((s) => s.text)
          .join("")
          .replace(/^[\s.()]+/, "");
        return (
          kind && <DecisionCard key={item.id} kind={kind} name={name} note={<Text>{note}</Text>} />
        );
      })}
      <DecisionCard kind="Changed" listed={false} name="Due dates" note={null} />
      <Blocks document={document} ids={relied} />
    </VStack>
  );
}

/** The parts after the stories, each its own panel, in the spec's order. */
const WEIGH = ["Edge cases", "Success criteria", "Architecture", "Assumptions"] as const;

/** The verdict's two buttons. */
function Verdict() {
  return (
    <HStack gap={2} wrap="wrap">
      <Button label="Request changes" variant="secondary" />
      <Button label="Approve" variant="primary" />
    </HStack>
  );
}

/** An entry of the index: a link to a part, indented when it belongs to the one above. */
function entry(href: string, label: string, nested = false) {
  const count = COMMENTS[href];
  return (
    <HStack align="center" gap={2} key={href} {...(nested ? { xstyle: styles.indent } : {})}>
      <Link href={href}>{label}</Link>
      {count !== undefined && <Badge label={String(count)} variant="neutral" />}
    </HStack>
  );
}

/** The pending comments per part the mockup shows: the implementation counts the review file's. */
const COMMENTS: Record<string, number> = { "#us1": 2 };

/** The right column: the spec's parts, its decisions and stories, then the verdict. */
function Index({
  document,
  sections,
}: {
  document: Document;
  sections: Map<string, Array<number>>;
}) {
  const stories = storyHeadings(document, sections.get("User stories") ?? []);
  const decisions = itemsOf(document, sections.get("Decisions") ?? []).map(
    (item) => item.spans.find((s) => s.link)?.text ?? "",
  );
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        {entry("#approve", "What you approve")}
        {entry("#review", "Your review, answered")}
        {entry("#decisions", "Decisions")}
        {decisions.map((name) =>
          entry(`#decision-${name.toLowerCase().replaceAll(" ", "-")}`, name, true),
        )}
        {entry("#stories", "What changes for users")}
        {stories.map((story) =>
          entry(`#${story.id.toLowerCase()}`, `${story.id} ${story.title}`, true),
        )}
        {entry("#data", "Data")}
        {entry("#weigh", "What else to weigh")}
      </VStack>
      <Text color="secondary" type="supporting">
        2 comments
      </Text>
      <Verdict />
    </VStack>
  );
}

/** A group of the spec's parts: its heading, on the phone after a band. */
function Group({ children, id, title }: { children: ReactNode; id: string; title: string }) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={wide ? 4 : 3}>
      {!wide && <div {...stylex.props(styles.band)} />}
      <Heading level={2}>
        <span id={id}>{title}</span>
      </Heading>
      {children}
    </VStack>
  );
}

/**
 * The mockup feature's spec as the redesign draws it: what is approved, the answers to the last
 * review, the decisions with their change, the stories, the data, then what else to weigh. On a
 * wide screen, each part is a card, and the index sits in the right column.
 */
export function SpecMockup({ folder }: { folder: string }) {
  const file = useFile(folder, "spec.md");
  const data = useFile(folder, "data-model.md");
  const wide = useWidthClass() === "wide";
  const [indexShown, setIndexShown] = useState(true);
  if (!file) {
    return null;
  }
  const document = file.current.document;
  const sections = sectionsOf(document);
  const opening = sections.get("") ?? [];
  const title = opening.map((id) => document.blocks[id]).find((b) => b?.kind === "heading");
  const block = opening.filter((id) => document.blocks[id]?.kind === "callout");
  const name = title ? plain(title.spans).replace(/^Spec: /, "") : "";
  const page = (
    <div {...stylex.props(styles.page, !wide && styles.pagePhone)}>
      <VStack gap={wide ? 8 : 4}>
        <VStack gap={2}>
          <HStack align="center" gap={2}>
            <Badge label="Revision 2" variant="neutral" />
            <Badge label="Waiting for your review" variant="warning" />
          </HStack>
          <Heading level={1}>{name}</Heading>
        </VStack>
        <Panel crumbs={[name]} id="approve" title="What you approve" variant="purple">
          <Blocks document={document} ids={block} />
        </Panel>
        <Panel crumbs={[name]} id="review" title="Your review, answered" variant="blue">
          <ReviewAnswers
            comments={file.review?.review?.comments ?? []}
            document={document}
            ids={sections.get("Your review") ?? []}
          />
        </Panel>
        <Group id="decisions" title="Decisions">
          <Decisions document={document} ids={sections.get("Decisions") ?? []} />
        </Group>
        <Group id="stories" title="What changes for users">
          <StoryList
            crumbs={["What changes for users"]}
            document={document}
            ids={sections.get("User stories") ?? []}
          />
        </Group>
        {data && (
          <Group id="data" title="Data">
            {[...sectionsOf(data.current.document)]
              .filter(([entity]) => entity !== "")
              .map(([entity, ids]) => (
                <Panel crumbs={["Data"]} key={entity} title={entity}>
                  <Blocks document={data.current.document} ids={ids} />
                </Panel>
              ))}
          </Group>
        )}
        <Group id="weigh" title="What else to weigh">
          {WEIGH.map((part) => (
            <Panel crumbs={["What else to weigh"]} key={part} title={part}>
              <Blocks document={document} ids={sections.get(part) ?? []} />
            </Panel>
          ))}
          <Panel crumbs={["What else to weigh"]} title="Constitution and risk">
            <Blocks document={document} ids={sections.get("Constitution check") ?? []} />
            <Blocks document={document} ids={sections.get("Risk tier") ?? []} />
          </Panel>
        </Group>
        <Collapsible defaultIsOpen={false} trigger={<Text weight="semibold">History</Text>}>
          <Blocks document={document} ids={sections.get("History") ?? []} />
        </Collapsible>
        {!wide && <Verdict />}
      </VStack>
    </div>
  );
  return (
    <SideColumn
      content={page}
      isShown={indexShown}
      label="Contents"
      onShownChange={setIndexShown}
      storageKey="uraeda.mockup.spec-index"
    >
      <div {...stylex.props(styles.indent)}>
        <Index document={document} sections={sections} />
      </div>
    </SideColumn>
  );
}
