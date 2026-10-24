import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Block, Document, PlanItems, Span } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import type { useFile } from "./data.ts";
import { type Folds, useHashFold } from "./Folds.tsx";
import { Page } from "./layout/Page.tsx";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { type OpeningRun, type PlanSection, planParts } from "./planParts.ts";
import { ReviewEnd, ReviewHost, ReviewIntro, useReview } from "./review/useReview.tsx";
import { Selectable, type Selection } from "./Selection.tsx";
import { Spans } from "./Spans.tsx";
import { StoriesProvider } from "./stories.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The badge of a plan's status. */
const STATUSES: Record<string, { label: string; variant: "neutral" | "success" | "warning" }> = {
  approved: { label: "Approved", variant: "success" },
  "auto-approved": { label: "Auto-approved", variant: "success" },
  "awaiting-human": { label: "Waiting for your review", variant: "warning" },
};

/** What the plan's parts draw with: its tree, and while it waits, its review's folds and taps. */
type Drawing = { document: Document; folds?: Folds; selection?: Selection };

/** A lead paragraph's spans without its bold label: "**Goal:** the round…" reads "the round…". */
function withoutLabel(spans: ReadonlyArray<Span>): Array<Span> {
  const [first, ...rest] = spans.slice(1);
  return first ? [{ ...first, text: first.text.trimStart() }, ...rest] : [];
}

/** A lead pane's id: "lead-" then its label as an anchor, `lead-tech-stack`, apart from sections'. */
const leadId = (label: string) =>
  `lead-${label
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replaceAll(/\s+/g, "-")}`;

/** A lead paragraph, in a pane titled by its label, its text without the label. */
function LeadPane({ drawing, run }: { drawing: Drawing; run: OpeningRun & { kind: "lead" } }) {
  const override = (block: Block) =>
    block.id === run.block ? (
      <Selectable block={block} key={block.id} selection={drawing.selection}>
        <Text as="p" display="block" type="inherit">
          <Spans spans={withoutLabel(block.spans)} />
        </Text>
      </Selectable>
    ) : undefined;
  return (
    <Pane id={leadId(run.label)} title={run.label}>
      <Blocks {...drawing} ids={[run.block]} override={override} />
    </Pane>
  );
}

/**
 * A section in a pane titled by its heading, its anchor as id; a task's titled "Task N · <title>",
 * with its steps checked out of its total, so a link to the heading lands on its pane.
 */
function SectionPane({ drawing, section }: { drawing: Drawing; section: PlanSection }) {
  const { heading, ids, task } = section;
  const blocks = ids.length > 0 && <Blocks {...drawing} ids={ids} />;
  if (!task) {
    return (
      <Pane id={heading.anchor} title={heading.heading ?? ""}>
        {blocks}
      </Pane>
    );
  }
  const badge = (
    <Badge
      label={`${task.done}/${task.total}`}
      variant={task.done === task.total ? "success" : "neutral"}
    />
  );
  return (
    <Pane id={heading.anchor} title={`Task ${task.number} · ${task.title}`} titleSuffix={badge}>
      {blocks}
    </Pane>
  );
}

/**
 * The plan in its file's order: its title and status, the blocks before its first section, each
 * lead paragraph a pane, then each section a pane, a task's with its steps checked out of its total.
 */
function PlanParts({ drawing, file, items }: { drawing: Drawing; file: File; items?: PlanItems }) {
  const { document } = drawing;
  const { opening, sections } = planParts(document, items);
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  const status = STATUSES[file.status ?? ""];
  // Once for the page: a hash names a pane or a block in one, scrolled to once drawn.
  useHashFold(document, drawing.folds, true);
  return (
    <VStack gap={3}>
      {status && (
        <HStack>
          <Badge label={status.label} variant={status.variant} />
        </HStack>
      )}
      {title && (
        <Heading id={title.anchor} level={1}>
          <Spans spans={title.spans} />
        </Heading>
      )}
      {opening.map((run) =>
        run.kind === "lead" ? (
          <LeadPane drawing={drawing} key={run.block} run={run} />
        ) : (
          <Blocks {...drawing} ids={run.ids} key={run.ids[0]} />
        ),
      )}
      {sections.map((section) => (
        <SectionPane drawing={drawing} key={section.heading.id} section={section} />
      ))}
    </VStack>
  );
}

/**
 * A plan waiting for review, as committed at its branch's tip: tapping blocks selects lines to
 * comment on, pending comments show under their blocks, and the end of the page holds the verdict.
 * The comment field is drawn apart from the plan, by `CommentHost`, so typing renders it alone.
 */
function ReviewedPlan({ file }: { file: File }) {
  const wide = !isNarrow(useWidthClass());
  const review = useReview(file, wide);
  const { folds, selection, storyComments, tree, version } = review;
  return (
    <ReviewHost file={file} review={review}>
      <Page>
        <Crumbs current={file.name} folder={file.folder} />
        <VStack gap={3}>
          <ReviewIntro file={file} review={review} />
          <StoriesProvider
            comment={storyComments}
            folder={file.folder}
            mockups={version.mockups}
            stories={version.stories}
          >
            <PlanParts
              drawing={{ document: tree, folds, selection }}
              file={file}
              items={version.items.plan}
            />
          </StoriesProvider>
          <ReviewEnd file={file} review={review} />
        </VStack>
      </Page>
    </ReviewHost>
  );
}

/**
 * A plan, in panes in its file's order: waiting for review, with the review's selection, comments,
 * and verdict; otherwise read as it is now.
 */
export function PlanPage({ file }: { file: File }) {
  if (file.status === "awaiting-human") {
    return <ReviewedPlan file={file} />;
  }
  return (
    <StoriesProvider
      folder={file.folder}
      mockups={file.current.mockups}
      stories={file.current.stories}
    >
      <Page>
        <Crumbs current={file.name} folder={file.folder} />
        <PlanParts
          drawing={{ document: file.current.document }}
          file={file}
          items={file.current.items.plan}
        />
      </Page>
    </StoriesProvider>
  );
}
