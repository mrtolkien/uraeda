// The spec page: a spec read as one page you approve in one sitting, waiting for your review or
// not. What you approve, your review answered, the decisions, the stories, the data, then how it is
// built and its limits, and its history, folded. On a wide screen, each part is a card, "Contents"
// beside them; on the phone, bands between the groups, each part's title sticking under the top
// bar. The only file that wires the parts: each takes what it needs from here.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { DecisionChange, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Crumbs } from "../Crumbs.tsx";
import { useFile } from "../data.ts";
import { type Folds, useHashFold } from "../Folds.tsx";
import { Page } from "../layout/Page.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
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
import { YourVerdict } from "../YourReview.tsx";
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
import { entriesOf, SpecContents, useContentsShown } from "./SpecContents.tsx";
import { SpecHistory } from "./SpecHistory.tsx";
import { SpecOpening } from "./SpecOpening.tsx";
import { StoryCard } from "./StoryCard.tsx";

const styles = stylex.create({
  band: {
    // On the phone, a band between the spec's groups, to the screen's edges.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginInline: "var(--page-bleed)",
  },
  group: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  groupPhone: {
    // A jump puts the group below the phone's top bar, which stays in view.
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  layer: {
    // The page's parts in a layer of their own, under the top bar: on the phone, a part's sticking
    // head, pushed up as its part scrolls away, slides under the bar rather than over it.
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

/** On the phone, a band between the spec's groups, to the screen's edges. */
function Band() {
  return <div {...stylex.props(styles.band)} />;
}

/** A group of the spec's parts: on the phone, after a band; its title, then its parts. */
function Group({
  children,
  id,
  title,
  wide,
}: {
  children: ReactNode;
  id: string;
  title: string;
  wide: boolean;
}) {
  return (
    <VStack gap={wide ? 4 : 3}>
      {!wide && <Band />}
      <div id={id} {...stylex.props(wide ? styles.group : styles.groupPhone)}>
        <Heading id={`${id}-title`} level={2} tabIndex={-1} xstyle={styles.title}>
          {title}
        </Heading>
      </div>
      <VStack gap={wide ? 6 : 4}>{children}</VStack>
    </VStack>
  );
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
  data: NonNullable<ReturnType<typeof useFile>> | undefined;
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
          id={groupId(items, GROUPS.decisions)}
          title={GROUPS.decisions.title}
          wide={part.wide}
        >
          <DecisionCards {...part} changes={changes} items={items.decisions} part={decisions} />
        </Group>
      )}
      {stories && (
        <Group id={groupId(items, GROUPS.stories)} title={GROUPS.stories.title} wide={part.wide}>
          {intro.length > 0 && (
            <Blocks document={part.document} ids={intro} selection={part.selection} />
          )}
          {items.stories.map((story) => (
            <StoryCard {...part} key={story.id} story={story} />
          ))}
        </Group>
      )}
      {data && (
        <Group id={GROUPS.data.id} title={GROUPS.data.title} wide={part.wide}>
          <DataPart document={data.current.document} folder={part.folder} wide={part.wide} />
        </Group>
      )}
      {hasBuilt && (
        <Group id={GROUPS.built.id} title={GROUPS.built.title} wide={part.wide}>
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
 * comments, its selection, and its verdict, at the foot of "Contents" while it shows, at the
 * page's end otherwise.
 */
function SpecLayout({
  file,
  folds,
  review,
  wide,
}: {
  file: File;
  folds: Folds | undefined;
  review: Review | undefined;
  wide: boolean;
}) {
  const shown = useContentsShown();
  const dataFile = useFile(file.folder, "data-model.md");
  const data = dataFile && !dataFile.missing ? dataFile : undefined;
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
  const inColumn = wide && shown[0];
  const verdict = review && (
    <YourVerdict comments={comments.length} file={file} refusals={review.refusals} />
  );
  return (
    <SpecContents
      entries={entriesOf({ changes, comments, document, hasData: !!data, items })}
      shown={shown}
      verdict={inColumn && verdict}
    >
      <Page isTight>
        <Crumbs current={file.name} folder={file.folder} />
        <VStack gap={wide ? 8 : 4} xstyle={styles.layer}>
          <VStack gap={3}>
            <SpecTitle document={document} file={file} items={items} />
            {review && <ReviewIntro file={file} review={review} />}
          </VStack>
          <SpecOpening document={document} items={items} selection={part.selection} />
          {items.answers.length > 0 && (
            <>
              {!wide && <Band />}
              <ReviewAnswers
                comments={answeredComments(file)}
                document={document}
                items={items}
                selection={part.selection}
                wide={wide}
              />
            </>
          )}
          <Groups changes={changes} data={data} items={items} part={part} />
          <SpecHistory document={document} items={items} />
          {review && <ReviewEnd file={file} hasVerdict={!inColumn} review={review} />}
        </VStack>
      </Page>
    </SpecContents>
  );
}

/** A spec waiting for your review: its parts take comments, and "Contents" holds the verdict. */
function WaitingSpec({ file }: { file: File }) {
  const wide = useWidthClass() === "wide";
  const review = useReview(file, wide);
  return (
    <ReviewHost file={file} review={review}>
      <StoriesProvider
        comment={review.storyComments}
        folder={file.folder}
        stories={review.version.stories}
      >
        <SpecLayout file={file} folds={review.folds} review={review} wide={wide} />
      </StoriesProvider>
    </ReviewHost>
  );
}

/** A spec not waiting for you, approved or being written: the same page, read-only. */
function ReadSpec({ file }: { file: File }) {
  const wide = useWidthClass() === "wide";
  const folds = useSpecFolds(file.current.items.spec);
  return (
    <StoriesProvider folder={file.folder} stories={file.current.stories}>
      <SpecLayout file={file} folds={folds} review={undefined} wide={wide} />
    </StoriesProvider>
  );
}

/** A feature's `spec.md`, waiting for your review or not. */
export function SpecPage({ file }: { file: File }) {
  return file.status === "awaiting-human" ? <WaitingSpec file={file} /> : <ReadSpec file={file} />;
}
