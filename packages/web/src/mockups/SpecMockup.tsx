// TEMPORARY: the spec page's mockup for the specs redesign (`specs/2026-10-17-redesign-specs/`),
// drawn by `SpecPage.stories.tsx`, over the mockup feature's spec and data model, written in the
// shape the redesign proposes (see `.storybook/specMockup.ts`). It walks the document tree for parts
// the core does not send yet, and shows a story's mockup as a box with its name: the implementation
// embeds it live, as today. Nothing here saves.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { CommentItem, Document, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { SideColumn } from "../layout/SideColumn.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";
import { DecisionChange, NewDecision, RemovedDecision } from "./DecisionChange.tsx";
import {
  DUE_DATES_AFTER,
  DUE_DATES_BEFORE,
  REPEATING_TASKS,
  TASK_HISTORY,
  TASK_STORAGE_AFTER,
  TASK_STORAGE_BEFORE,
} from "./decisionTexts.ts";
import {
  Architecture,
  Assumptions,
  Criteria,
  DataTable,
  EdgeCases,
  Principles,
} from "./SpecParts.tsx";
import { itemsOf, Panel, storyHeadings, StoryList } from "./SpecStory.tsx";

const styles = stylex.create({
  answer: {
    // On a wide screen, your comment on the left, its answer on the right.
    display: "grid",
    gap: spacingVars["--spacing-4"],
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
  band: {
    // On the phone, a band between the spec's groups, to the screen's edges.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginInline: `calc(-1 * ${spacingVars["--spacing-3"]})`,
  },
  indent: { paddingInlineStart: spacingVars["--spacing-4"] },
  lead: {
    // What you approve, in one sentence: the largest text of the page after its title.
    fontSize: typeScaleVars["--text-heading-3-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-heading-3-leading"],
    margin: 0,
  },
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
  quote: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-0-5"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  row: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    paddingBlockStart: spacingVars["--spacing-3"],
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

/**
 * What you approve: the block's first item as the page's lead sentence, its other items under it,
 * then the time, the risk tier, and the constitution's principles.
 */
function Opening({
  document,
  sections,
}: {
  document: Document;
  sections: Map<string, Array<number>>;
}) {
  const callout = (sections.get("") ?? []).find((id) => document.blocks[id]?.kind === "callout");
  const inside = document.blocks.filter((b) => b.parent === callout);
  const first = plain(inside.find((b) => b.kind === "paragraph")?.spans ?? []);
  const [lead, ...items] = itemsOf(
    document,
    inside.map((b) => b.id),
  );
  const minutes = /about (\d+) minutes/.exec(first)?.[1];
  const risk = document.blocks[(sections.get("Risk tier") ?? [])[0] ?? -1];
  const tier = risk?.spans[0]?.text ?? "";
  return (
    <Panel crumbs={[]} id="approve" title="What you approve">
      <HStack gap={2} wrap="wrap">
        {minutes && (
          <Badge
            icon={<Icon icon="clock" />}
            label={`About ${minutes} minutes`}
            variant="neutral"
          />
        )}
        <Badge
          label={`Risk ${tier.toLowerCase()}`}
          variant={tier === "High" ? "error" : "warning"}
        />
      </HStack>
      <p {...stylex.props(styles.lead)}>
        <Spans spans={lead?.spans ?? []} />
      </p>
      <VStack gap={2}>
        {items.map((item) => (
          <HStack align="start" gap={2} key={item.id}>
            <Icon color="secondary" icon="chevronRight" size="sm" />
            <Text>
              <Spans spans={item.spans} />
            </Text>
          </HStack>
        ))}
      </VStack>
      <VStack gap={1}>
        <Text color="secondary" type="supporting">
          Constitution
        </Text>
        <Principles document={document} ids={sections.get("Constitution check") ?? []} />
      </VStack>
    </Panel>
  );
}

/** Each answer to the last review: your comment beside it, then whether it was done. */
function ReviewAnswers({
  comments,
  document,
  ids,
}: {
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={3}>
      {itemsOf(document, ids).map((item) => {
        const number = Number(/^C(\d+)/.exec(item.spans[0]?.text ?? "")?.[1]);
        const comment = comments.find((c) => c.number === number);
        const text = plain(item.spans.slice(1)).replace(/^\s*(\([^)]*\))?:\s*/, "");
        const [verdict = "", ...answer] = text.split(". ");
        const done = verdict.startsWith("done");
        return (
          <div key={item.id} {...stylex.props(styles.row, wide && styles.answer)}>
            <VStack gap={1}>
              {comment && comment.quote.length > 0 && (
                <div {...stylex.props(styles.quote)}>
                  <Text color="secondary" type="supporting">
                    {comment.quote.map((line) => line.replace(/^>\s?/, "").trim()).join(" ")}
                  </Text>
                </div>
              )}
              <Text>{comment ? `“${comment.text}”` : ""}</Text>
            </VStack>
            <HStack align="start" gap={2}>
              <Icon
                color={done ? "success" : "warning"}
                icon={done ? "success" : "info"}
                size="md"
              />
              <VStack gap={0.5}>
                <Text weight="semibold">{done ? "Done" : "Declined"}</Text>
                <Text>{answer.join(". ")}</Text>
              </VStack>
            </HStack>
          </div>
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

/** The change the mockup's branch makes to due dates, which its spec does not list. */
const UNLISTED = { after: DUE_DATES_AFTER, before: DUE_DATES_BEFORE, variant: "warning" } as const;

/** A decision's card: its title, its badges, its note, then its text, its change, or its removal. */
function DecisionCard({
  kind,
  listed = true,
  name,
  note,
}: {
  kind: keyof typeof KINDS;
  listed?: boolean;
  name: string;
  note: string;
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
      {note !== "" && <Text weight="semibold">{note}</Text>}
      {kind === "New" && <NewDecision text={after} />}
      {kind === "Removed" && <RemovedDecision text={before} />}
      {kind === "Changed" && <DecisionChange after={after} before={before} />}
    </Panel>
  );
}

/** A decision item's name: its link's text, or, for a removed one, the words after its kind. */
function decisionName(spans: ReadonlyArray<Span>): string {
  const link = spans.find((s) => s.link);
  return link?.text ?? plain(spans.slice(0, 1)).replace(/^\w+:\s*/, "");
}

/** The decisions the spec lists, then one the branch changes without listing, then those relied on. */
function Decisions({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const relied = ids.filter((id) => document.blocks[id]?.kind !== "list");
  return (
    <VStack gap={4}>
      {itemsOf(document, ids).map((item) => {
        const [lead, ...rest] = item.spans;
        const label = lead?.text ?? "";
        const kind = (["New", "Changed", "Removed"] as const).find((k) => label.startsWith(k));
        const note = rest
          .filter((s) => !s.link && !s.code)
          .map((s) => s.text)
          .join("")
          .replace(/^[\s.()]+/, "");
        return (
          kind && (
            <DecisionCard key={item.id} kind={kind} name={decisionName(item.spans)} note={note} />
          )
        );
      })}
      <DecisionCard kind="Changed" listed={false} name="Due dates" note="" />
      <Blocks document={document} ids={relied} />
    </VStack>
  );
}

/** The verdict's two buttons. */
function Verdict() {
  return (
    <HStack gap={2} wrap="wrap">
      <Button label="Request changes" variant="secondary" />
      <Button label="Approve" variant="primary" />
    </HStack>
  );
}

/** The pending comments per part the mockup shows: the implementation counts the review file's. */
const COMMENTS: Record<string, number> = { "#us1": 2 };

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

/** The parts after the stories, in the page's order, each drawn its own way. */
const WEIGH = [
  { id: "architecture", render: Architecture, title: "Architecture" },
  { id: "edge-cases", render: EdgeCases, title: "Edge cases" },
  { id: "success-criteria", render: Criteria, title: "Success criteria" },
  { id: "assumptions", render: Assumptions, title: "Assumptions" },
] as const;

/** The right column: the spec's parts, its decisions and stories, then the verdict. */
function Index({
  document,
  sections,
}: {
  document: Document;
  sections: Map<string, Array<number>>;
}) {
  const stories = storyHeadings(document, sections.get("User stories") ?? []);
  const decisions = itemsOf(document, sections.get("Decisions") ?? []).map((item) =>
    decisionName(item.spans),
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
        {WEIGH.map((part) => entry(`#${part.id}`, part.title))}
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

/** The data model's entities, each a panel with its table. */
function Data({ document }: { document: Document }) {
  return [...sectionsOf(document)]
    .filter(([entity]) => entity !== "")
    .map(([entity, ids]) => (
      <Panel crumbs={["Data"]} key={entity} title={entity}>
        <DataTable document={document} ids={ids} />
      </Panel>
    ));
}

/**
 * The mockup feature's spec as the redesign draws it: what is approved, the answers to the last
 * review, the decisions with their change, the stories, the data, then each other part drawn its
 * own way. On a wide screen, each part is a card, and the index sits in the right column.
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
  const title = (sections.get("") ?? [])
    .map((id) => document.blocks[id])
    .find((b) => b?.kind === "heading");
  const page = (
    <div {...stylex.props(styles.page, !wide && styles.pagePhone)}>
      <VStack gap={wide ? 8 : 4}>
        <VStack gap={2}>
          <HStack align="center" gap={2}>
            <Badge label="Revision 2" variant="neutral" />
            <Badge label="Waiting for your review" variant="warning" />
          </HStack>
          <Heading level={1}>{title ? plain(title.spans).replace(/^Spec: /, "") : ""}</Heading>
        </VStack>
        <Opening document={document} sections={sections} />
        <Panel crumbs={[]} id="review" title="Your review, answered">
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
            <Data document={data.current.document} />
          </Group>
        )}
        <Group id="weigh" title="How it is built, and its limits">
          {WEIGH.map(({ id, render: Render, title: name }) => (
            <Panel crumbs={["How it is built"]} id={id} key={id} title={name}>
              <Render document={document} ids={sections.get(name) ?? []} />
            </Panel>
          ))}
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
