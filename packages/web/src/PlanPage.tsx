import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Block, CommentItem, Document, PlanItems } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import type { useFile } from "./data.ts";
import { type Folds, useHashFold } from "./Folds.tsx";
import { Page } from "./layout/Page.tsx";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { type OpeningRun, type PlanSection, planParts, sectionId } from "./planParts.ts";
import { ReviewEnd, ReviewHost, ReviewIntro, useReview } from "./review/useReview.tsx";
import { usePageSession } from "./spec/pageSession.ts";
import { SpecColumn } from "./spec/SpecColumn.tsx";
import { Contents, type Entry } from "./spec/SpecContents.tsx";
import { Selectable, type Selection } from "./Selection.tsx";
import { Spans } from "./Spans.tsx";
import { StoriesProvider } from "./stories.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The badge of a plan's status, a request red as in the files' list. */
const STATUSES: Record<string, { label: string; variant: "error" | "success" | "warning" }> = {
  approved: { label: "Approved", variant: "success" },
  "auto-approved": { label: "Auto-approved", variant: "success" },
  "awaiting-human": { label: "Waiting for your review", variant: "warning" },
  "changes-requested": { label: "Changes requested", variant: "error" },
};

/** What the plan's parts draw with: its tree, and while it waits, its review's folds and taps. */
type Drawing = { document: Document; folds?: Folds; selection?: Selection };

/** A lead pane's id: "lead-" then its label as an anchor, `lead-tech-stack`, unlike a section's. */
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
          <Spans spans={run.text} />
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
 * While the plan waits for review, its section's heading line, as written, which its pane's title
 * says: tapped, it takes a comment, shown under it. Read-only, nothing.
 */
function HeadingLine({ heading, selection }: { heading: Block; selection?: Selection }) {
  if (!selection) {
    return null;
  }
  return (
    <Selectable block={heading} selection={selection}>
      <Text as="div" color="secondary" display="block" type="inherit">
        {"## "}
        <Spans spans={heading.spans} />
      </Text>
    </Selectable>
  );
}

/**
 * A section in a pane titled by its heading, its anchor as id; a task's titled "Task N · <title>",
 * with its steps checked out of its total, so a link to the heading lands on its pane.
 */
function SectionPane({ drawing, section }: { drawing: Drawing; section: PlanSection }) {
  const { heading, ids, task } = section;
  const blocks = (
    <>
      <HeadingLine heading={heading} selection={drawing.selection} />
      {ids.length > 0 && <Blocks {...drawing} ids={ids} />}
    </>
  );
  if (!task) {
    return (
      <Pane id={sectionId(heading)} title={heading.heading ?? ""}>
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
    <Pane id={sectionId(heading)} title={`Task ${task.number} · ${task.title}`} titleSuffix={badge}>
      {blocks}
    </Pane>
  );
}

/**
 * The plan in its file's order: its title and status, the blocks before its first section, each
 * lead paragraph a pane, then each section a pane, a task's with its steps checked out of its
 * total.
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
        <Selectable block={title} selection={drawing.selection}>
          <Heading id={title.anchor} level={1}>
            <Spans spans={title.spans} />
          </Heading>
        </Selectable>
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
 * The plan's entries in Contents, in its file's order: each lead pane, then each section's, a
 * task's "N <title>", each with the pending comments on its lines; a comment on a block of no pane,
 * like the title, counts on the first entry.
 */
function planEntries(
  document: Document,
  items: PlanItems | undefined,
  comments: ReadonlyArray<CommentItem>,
): Array<Entry> {
  const { opening, sections } = planParts(document, items);
  const lastLine = (ids: ReadonlyArray<number>, from: Block) =>
    document.blocks[ids.at(-1) ?? from.id]?.endLine ?? from.endLine;
  const panes = [
    ...opening.flatMap((run) => {
      const block = run.kind === "lead" ? document.blocks[run.block] : undefined;
      return run.kind === "lead" && block
        ? [{ first: block.startLine, id: leadId(run.label), label: run.label, last: block.endLine }]
        : [];
    }),
    ...sections.map(({ heading, ids, task }) => ({
      first: heading.startLine,
      id: sectionId(heading),
      label: task ? `${task.number} ${task.title}` : (heading.heading ?? ""),
      last: lastLine(ids, heading),
    })),
  ];
  const counts = new Map<string, number>();
  for (const c of comments.filter((c) => !c.general && c.decision == null)) {
    const pane = panes.find(({ first, last }) => c.endLine >= first && c.endLine <= last);
    const id = (pane ?? panes[0])?.id;
    if (id !== undefined) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return panes.map(({ id, label }) => ({ count: counts.get(id) ?? 0, id, label, nested: false }));
}

/**
 * A plan waiting for review, as committed at its branch's tip: tapping blocks selects lines to
 * comment on, pending comments show under their blocks, and the end of the page holds the verdict.
 * The comment field is drawn apart from the plan, by `CommentHost`, so typing renders it alone.
 */
function ReviewedPlan({ file }: { file: File }) {
  const wide = !isNarrow(useWidthClass());
  const session = usePageSession(file);
  const review = useReview(file, wide, session?.ask);
  const { comments, folds, selection, storyComments, tree, version } = review;
  const page = (
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
  );
  return (
    <ReviewHost file={file} review={review}>
      <SpecColumn
        content={page}
        contents={<Contents entries={planEntries(tree, version.items.plan, comments)} />}
        extra={session ? [session.tab] : []}
        file={file}
        review={review}
      />
    </ReviewHost>
  );
}

/**
 * A plan, in panes in its file's order, its column of Contents, and Session where the agent can be
 * asked, beside it: waiting for review, with the review's selection, comments, and verdict;
 * otherwise read as it is now.
 */
export function PlanPage({ file }: { file: File }) {
  return file.status === "awaiting-human" ? <ReviewedPlan file={file} /> : <ReadPlan file={file} />;
}

/** A plan not waiting for review: read as it is now, its session beside it. */
function ReadPlan({ file }: { file: File }) {
  const session = usePageSession(file);
  return (
    <StoriesProvider
      folder={file.folder}
      mockups={file.current.mockups}
      stories={file.current.stories}
    >
      <SpecColumn
        content={
          <Page>
            <Crumbs current={file.name} folder={file.folder} />
            <PlanParts
              drawing={{ document: file.current.document }}
              file={file}
              items={file.current.items.plan}
            />
          </Page>
        }
        contents={
          <Contents entries={planEntries(file.current.document, file.current.items.plan, [])} />
        }
        extra={session ? [session.tab] : []}
        file={file}
        review={undefined}
      />
    </StoriesProvider>
  );
}
