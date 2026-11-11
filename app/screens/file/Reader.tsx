// The reader: a workflow file, drawn from the core's tree, at the reading measure, scrolling by its
// blocks so a plan of thousands of lines opens at once. Above its title, what the file is and what
// it asks of the human. A spec waiting again after changes marks each part changed since the
// review its revision answers, in place. Its place is kept in the visit; a link to a heading, the
// address's `#heading`, and the outline's entries bring that heading to the top. A story or a
// mockup a paragraph links alone shows live in place.
import { effect, untracked, View } from "nsh";
import { imageOf, navigate, positions, route } from "../../store";
import type { Block, FileView, SinceChange, SpanImage, VersionView } from "../../store/protocol";
import { Banner, StatusDot, Text } from "../../ui/controls";
import { DocumentScroll, type DocumentScrollRef } from "../../ui/document";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { MockupEmbed, StoryEmbed } from "../preview";
import { follow, headingAt } from "./links";
import { atTop, jumps } from "./place";
import { facts } from "./facts";
import { type FileArgs, kindWord, shownOf, statusOf, WithFile } from "./read";

/** The part changed since the review a spec's revision answers that a block is in. */
function sinceAt(parts: ReadonlyArray<SinceChange>, block: Block) {
  // A list or a table spans its items and rows, which carry their own marks.
  if (block.kind === "list" || block.kind === "table") return undefined;
  return parts.find(
    (part) =>
      part.kind !== "removed" &&
      part.after !== null &&
      part.after.start <= block.endLine &&
      part.after.end >= block.startLine,
  );
}

/** The mark under a block changed since the human's review: what they read again first. */
function Since(props: { kind: string }) {
  return (
    <Text size="under" tone="caution">
      {props.kind === "added" ? "Added since your review" : "Changed since your review"}
    </Text>
  );
}

/** An image of the file: one of the repository's, fetched with the sign-in, or one of the web. */
function imageFor(repo: string, image: SpanImage): string | undefined {
  if (image.path !== null) return imageOf(repo, image.path)() ?? undefined;
  return /^https?:\/\//.test(image.target) ? image.target : undefined;
}

/** A story or a mockup its paragraph links alone, live in place, in the feature's checkout. */
function embedAt(args: FileArgs, version: VersionView, block: Block) {
  const link = version.stories.find((one) => one.block === block.id);
  if (link !== undefined) return <StoryEmbed folder={args.folder} link={link} repo={args.repo} />;
  const mockup = version.mockups.find((one) => one.block === block.id);
  if (mockup !== undefined) {
    return <MockupEmbed folder={args.folder} mockup={mockup} repo={args.repo} />;
  }
  return undefined;
}

/** What the file is, where it stands, and what it asks of the human. */
function Head(props: { file: FileView }) {
  const status = () => statusOf(props.file);
  const said = () => facts(props.file);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", columnGap: 14, flexDirection: "row", flexWrap: "wrap" }}>
        <StatusDot
          label={[kindWord(props.file), status()?.label].filter(Boolean).join(" · ")}
          tone={status()?.tone ?? "quiet"}
        />
        <Each of={said()}>{(fact) => <Text tone="faint">{`· ${fact()}`}</Text>}</Each>
      </View>
      {/* TASK 42: the file's one main action goes here, a `Button` of `variant="main"`: "Review
          the spec" or "Answer the round" while it waits for the human, which opens task 42's
          review, its approval and its request for changes. Never a second approve button. */}
      <If when={props.file.status === "awaiting-human" && props.file.committed !== null}>
        <Banner title="This is the version committed for your review" tone="info">
          The file on disk changed since: an agent is writing it again. What you review is what was
          committed.
        </Banner>
      </If>
      <If when={props.file.reviewStale}>
        <Banner title="Your review is on an older version" tone="caution">
          The comments you have not sent were written on a version before this one: read them again
          before you send them.
        </Banner>
      </If>
    </View>
  );
}

function Read(props: { args: FileArgs; file: () => FileView }) {
  const pane = usePane();
  const kept = positions();
  const name = `${pane.key}:document`;
  const opened = kept.at(name);
  const shown = () => shownOf(props.file());
  const since = () => props.file().sinceReview?.parts ?? [];
  let scroll: DocumentScrollRef | undefined;
  registerKey({
    icon: "file-pen-line",
    keys: "space b",
    label: "Open as a buffer",
    run: () => navigate({ page: "buffer", path: props.file().path }),
  });
  // A jump asked by a pane beside it: the outline's, the plan's tasks'.
  effect(() => {
    const asked = jumps(props.args)();
    if (asked !== undefined) untracked(() => scroll?.toBlock(asked.block));
  });
  // A heading the address names, `spec.md#architecture`, as the page opens or as it changes.
  effect(() => {
    const hash = route().hash;
    if (hash === undefined || hash === "") return;
    untracked(() => {
      const heading = headingAt(shown().document, hash);
      if (heading !== undefined) scroll?.toBlock(heading.id);
    });
  });
  return (
    <DocumentScroll
      document={shown().document}
      header={<Head file={props.file()} />}
      image={(image) => imageFor(props.args.repo, image)}
      mark={(block) => {
        // TASK 42: a review's comments and a round's question cards hang under their blocks here.
        const part = sinceAt(since(), block);
        return part === undefined ? undefined : <Since kind={part.kind} />;
      }}
      offset={opened}
      onLink={(link) => follow(link, props.args, props.file().path, shown().document)}
      onOffset={(offset) => kept.keep(name, offset)}
      onPlace={(block) => atTop(props.args, block)}
      override={(block) => embedAt(props.args, shown(), block)}
      ref={(ref) => {
        scroll = ref;
        const hash = untracked(route).hash;
        if (opened === undefined && hash !== undefined && hash !== "") ref.toAnchor(hash);
      }}
      testID="file-reader"
    />
  );
}

/** The pane of a file's document. */
export function Reader(props: { args: FileArgs }) {
  return <WithFile args={props.args}>{(file) => <Read args={props.args} file={file} />}</WithFile>;
}
