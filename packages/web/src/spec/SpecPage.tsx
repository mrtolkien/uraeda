// The spec page: a spec read as one page you approve in one sitting, waiting for your review or
// not, each part a titled pane. What you approve, your review answered, the decisions, the stories,
// the data, then how it is built, and its history, folded; a group's heading counts what it holds.
// The column of Contents and Review beside them, on the phone in the status line. The only file that wires the parts: each takes what it
// needs from here.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { DataModelItems, DecisionChange, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Crumbs } from "../Crumbs.tsx";
import { useFile } from "../data.ts";
import { type Folds, useHashFold } from "../Folds.tsx";
import { Page } from "../layout/Page.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { scrollMarginStyles } from "../layout/scrollMargin.ts";
import {
  ReviewEnd,
  ReviewHost,
  ReviewIntro,
  type Review,
  useReview,
} from "../review/useReview.tsx";
import { Spans } from "../Spans.tsx";
import { StoriesProvider } from "../stories.tsx";
import { useSpecFolds } from "../useOpenKeys.ts";
import { BuiltParts } from "./BuiltParts.tsx";
import { DataPart } from "./DataPart.tsx";
import { DecisionCards } from "./DecisionCards.tsx";
import {
  BUILT_PARTS,
  type File,
  GROUPS,
  groupId,
  type PartProps,
  otherParts,
  partOf,
  type SpecItems,
  storiesIntro,
} from "./parts.ts";
import { answeredComments, ReviewAnswers } from "./ReviewAnswers.tsx";
import { type PageSession, usePageSession } from "./pageSession.ts";
import { SpecColumn } from "./SpecColumn.tsx";
import { Contents, entriesOf } from "./SpecContents.tsx";
import { SpecHistory } from "./SpecHistory.tsx";
import { SpecOpening } from "./SpecOpening.tsx";
import { StoryCard } from "./StoryCard.tsx";

const styles = stylex.create({
  // What a group's heading counts, after its title, in the secondary colour.
  detail: { color: colorVars["--color-text-secondary"] },
  heading: { alignItems: "center", display: "flex", gap: spacingVars["--spacing-2"] },
  layer: {
    // The page's parts in a layer of their own, under the top bar.
    isolation: "isolate",
  },
  title: {
    // Focused by a jump from "Contents", without a ring: the jump shows where it went.
    outlineStyle: { ":focus:not(:focus-visible)": "none", default: null },
  },
});

/** The badge of a spec's status. */
const STATUSES: Record<string, { label: string; variant: "neutral" | "success" | "warning" }> = {
  approved: { label: "Approved", variant: "success" },
  "awaiting-human": { label: "Waiting for your review", variant: "warning" },
};

/**
 * A group of the spec's parts: its heading, its icon, title, and what it counts ("· 4"), then its
 * parts.
 */
function Group({
  children,
  detail,
  icon,
  id,
  title,
  wide,
}: {
  children: ReactNode;
  detail?: string;
  icon?: `uraeda:${string}`;
  id: string;
  title: string;
  wide: boolean;
}) {
  return (
    <VStack gap={wide ? 4 : 3}>
      <div
        id={id}
        {...stylex.props(wide ? scrollMarginStyles.belowNothing : scrollMarginStyles.belowBar)}
      >
        <Heading id={`${id}-title`} level={2} tabIndex={-1} xstyle={[styles.title, styles.heading]}>
          {icon && <Icon icon={icon} />}
          <span>
            {title}
            {detail && <span {...stylex.props(styles.detail)}> · {detail}</span>}
          </span>
        </Heading>
      </div>
      <VStack gap={wide ? 6 : 4}>{children}</VStack>
    </VStack>
  );
}

/** What the decisions' heading counts: "1 new, 1 changed, 1 removed", of the decisions listed. */
function decisionCounts(items: SpecItems, changes: ReadonlyArray<DecisionChange>) {
  const byName = new Map(changes.map((change) => [change.name, change]));
  const kinds = items.decisions.map((item) => {
    const change = byName.get(item.name);
    return change?.compared ? change.kind : item.kind;
  });
  return ["new", "changed", "removed"]
    .map((kind) => [kind, kinds.filter((k) => k === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`)
    .join(", ");
}

/** The spec's title, after its status. */
function SpecTitle({
  document,
  file,
  items,
}: {
  document: Document;
  file: File;
  items: SpecItems;
}) {
  const first = items.parts[0]?.heading ?? document.blocks.length;
  const title = document.blocks.find((b) => b.id < first && b.kind === "heading" && b.level === 1);
  const status = STATUSES[file.status ?? ""];
  return (
    <VStack gap={2}>
      {status && (
        <HStack>
          <Badge label={status.label} variant={status.variant} />
        </HStack>
      )}
      <Heading level={1}>
        <Spans spans={title?.spans ?? []} />
      </Heading>
    </VStack>
  );
}

/** The groups after the answers: the decisions, the stories, the data, and how it is built. */
function Groups({
  changes,
  data,
  items,
  part,
}: {
  changes: ReadonlyArray<DecisionChange>;
  data: { document: Document; model: DataModelItems } | undefined;
  items: SpecItems;
  part: PartProps;
}) {
  const decisions = partOf(items, "Decisions");
  const hasBuilt = BUILT_PARTS.some((title) => partOf(items, title));
  const stories = partOf(items, "User stories");
  const intro = storiesIntro(items);
  return (
    <>
      {(decisions || changes.length > 0) && (
        <Group
          detail={decisionCounts(items, changes)}
          icon="uraeda:scale"
          id={groupId(items, GROUPS.decisions)}
          title={GROUPS.decisions.title}
          wide={part.wide}
        >
          <DecisionCards {...part} changes={changes} items={items.decisions} part={decisions} />
        </Group>
      )}
      {stories && (
        <Group
          detail={String(items.stories.length)}
          icon="uraeda:map"
          id={groupId(items, GROUPS.stories)}
          title={GROUPS.stories.title}
          wide={part.wide}
        >
          {intro.length > 0 && (
            <Blocks document={part.document} ids={intro} selection={part.selection} />
          )}
          {items.stories.map((story) => (
            <StoryCard {...part} key={story.id} story={story} />
          ))}
        </Group>
      )}
      {data && (
        <Group
          detail={`data-model.md · ${data.model.sections.length}`}
          icon="uraeda:database"
          id={GROUPS.data.id}
          title={GROUPS.data.title}
          wide={part.wide}
        >
          <DataPart document={data.document} model={data.model} />
        </Group>
      )}
      {hasBuilt && (
        <Group
          icon="uraeda:layers"
          id={GROUPS.built.id}
          title={GROUPS.built.title}
          wide={part.wide}
        >
          <BuiltParts {...part} items={items} />
        </Group>
      )}
      {otherParts(items).map((other) => (
        <Group id={other.anchor} key={other.heading} title={other.title} wide={part.wide}>
          <Blocks document={part.document} ids={other.blocks} selection={part.selection} />
        </Group>
      ))}
    </>
  );
}

/**
 * The page of a spec, `version` of `file`, drawn from its items, with `review` while it waits: its
 * comments, its selection, and its verdict, at the page's end.
 */
function SpecLayout({
  file,
  folds,
  review,
  session,
  wide,
}: {
  file: File;
  folds: Folds | undefined;
  review: Review | undefined;
  session: PageSession | undefined;
  wide: boolean;
}) {
  const dataFile = useFile(file.folder, "data-model.md");
  // As the spec, the data model waiting for a review is the committed one, not the disk's.
  const dataVersion =
    dataFile && !dataFile.missing
      ? review
        ? (dataFile.committed ?? dataFile.current)
        : dataFile.current
      : undefined;
  const dataModel = dataVersion?.items.dataModel;
  const data = dataVersion && dataModel && { document: dataVersion.document, model: dataModel };
  const version = review?.version ?? file.current;
  const items = version.items.spec;
  // Once for the page: a hash into a story's more scenarios opens them, any other scrolls to its part.
  useHashFold(version.document, folds, true);
  if (!items) {
    return null;
  }
  const changes = file.decisionChanges;
  const comments = review?.comments ?? [];
  const document = version.document;
  const part: PartProps = {
    comments,
    document,
    folder: file.folder,
    folds,
    selection: review?.selection,
    wide,
  };
  const page = (
    <Page isTight>
      <Crumbs current={file.name} folder={file.folder} />
      <VStack gap={wide ? 8 : 4} xstyle={styles.layer}>
        <VStack gap={3}>
          <SpecTitle document={document} file={file} items={items} />
          {review && <ReviewIntro file={file} review={review} />}
        </VStack>
        <SpecOpening document={document} items={items} selection={part.selection} />
        {partOf(items, "Your review") && (
          <ReviewAnswers
            comments={answeredComments(file)}
            document={document}
            items={items}
            selection={part.selection}
            wide={wide}
          />
        )}
        <Groups changes={changes} data={data} items={items} part={part} />
        <SpecHistory document={document} items={items} />
        {review && <ReviewEnd file={file} review={review} />}
      </VStack>
    </Page>
  );
  return (
    <SpecColumn
      content={page}
      contents={
        <Contents entries={entriesOf({ changes, comments, document, hasData: !!data, items })} />
      }
      extra={session ? [session.tab] : []}
      file={file}
      review={review}
    />
  );
}

/** A spec waiting for your review: its parts take comments, and its verdict is at the page's end. */
function WaitingSpec({ file }: { file: File }) {
  const wide = !isNarrow(useWidthClass());
  const session = usePageSession(file);
  const review = useReview(file, wide, session?.ask);
  return (
    <ReviewHost file={file} review={review}>
      <StoriesProvider
        comment={review.storyComments}
        folder={file.folder}
        mockups={review.version.mockups}
        stories={review.version.stories}
      >
        <SpecLayout
          file={file}
          folds={review.folds}
          review={review}
          session={session}
          wide={wide}
        />
      </StoriesProvider>
    </ReviewHost>
  );
}

/** A spec not waiting for you, approved or being written: the same page, read-only. */
function ReadSpec({ file }: { file: File }) {
  const wide = !isNarrow(useWidthClass());
  const folds = useSpecFolds(file.current.items.spec);
  const session = usePageSession(file);
  return (
    <StoriesProvider
      folder={file.folder}
      mockups={file.current.mockups}
      stories={file.current.stories}
    >
      <SpecLayout file={file} folds={folds} review={undefined} session={session} wide={wide} />
    </StoriesProvider>
  );
}

/** A feature's `spec.md`, waiting for your review or not. */
export function SpecPage({ file }: { file: File }) {
  return file.status === "awaiting-human" ? <WaitingSpec file={file} /> : <ReadSpec file={file} />;
}
