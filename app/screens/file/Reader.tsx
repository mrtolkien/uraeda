// The reader: a workflow file, drawn from the core's tree, at the reading measure, scrolling by its
// blocks so a plan of thousands of lines opens at once. Above its title, what the file is and what
// it asks of the human. A spec waiting again after changes marks each part changed since the
// review its revision answers, in place. Its place is kept in the visit; a link to a heading, the
// address's `#heading`, and the outline's entries bring that heading to the top. A story or a
// mockup a paragraph links alone shows live in place.
import { effect, untracked, View } from "nsh";
import { imageOf, navigate, positions, route } from "../../store";
import type { Block, FileView, SinceChange, SpanImage, VersionView } from "../../store/protocol";
import { Banner, Button, StatusDot, Text } from "../../ui/controls";
import { DocumentScroll, type DocumentScrollRef } from "../../ui/document";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { isNarrow } from "../../ui/width";
import { reviewMark, reviewable } from "../review/Marks";
import { reviewOf } from "../review/state";
import { StaleReview } from "../review/Stale";
import { MockupEmbed, StoryEmbed } from "../preview";
import { quoted, useAsk } from "../session";
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
export function imageFor(repo: string, image: SpanImage): string | undefined {
  if (image.path !== null) return imageOf(repo, image.path)() ?? undefined;
  return /^https?:\/\//.test(image.target) ? image.target : undefined;
}

/**
 * A story or a mockup its paragraph links alone, live in place, in the feature's checkout. With
 * `comment`, while the file waits for its review, a comment on it, or on an element picked in it,
 * opens under its block.
 */
export function embedAt(
  args: FileArgs,
  version: VersionView,
  block: Block,
  comment?: { on: () => boolean; open: (block: Block, about: string) => void },
) {
  const on =
    comment === undefined
      ? undefined
      : { on: comment.on, open: (about: string) => comment.open(block, about) };
  const link = version.stories.find((one) => one.block === block.id);
  if (link !== undefined) {
    return <StoryEmbed comment={on} folder={args.folder} link={link} repo={args.repo} />;
  }
  const mockup = version.mockups.find((one) => one.block === block.id);
  if (mockup !== undefined) {
    return <MockupEmbed comment={on} folder={args.folder} mockup={mockup} repo={args.repo} />;
  }
  return undefined;
}

/** What the file is, where it stands, and what it asks of the human. */
function Head(props: { args: FileArgs; file: FileView; onVerdict?: () => void }) {
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
      <If when={props.onVerdict !== undefined && reviewable(props.file)}>
        <View style={{ alignItems: "flex-start", gap: 6 }}>
          {/* The verdict is the Review pane's, the page's one main action: this only leads there,
              and on a phone the bottom bar's Verdict does. */}
          <If when={!isNarrow()}>
            <Button
              icon="badge-check"
              label="Go to your verdict"
              onPress={() => props.onVerdict?.()}
              testID="review-verdict"
            />
          </If>
          <Text tone="quiet">
            {isNarrow()
              ? "Tap a part to comment on it. Your verdict is under Verdict, at the bottom."
              : "Press a part, or c on the one at the cursor, to comment on it, s to ask the agent about it beside; J and K move between parts. Your verdict is in the Review pane."}
          </Text>
        </View>
      </If>
      <If when={props.file.status === "awaiting-human" && props.file.committed !== null}>
        <Banner title="This is the version committed for your review" tone="info">
          The file on disk changed since: an agent is writing it again. What you review is what was
          committed.
        </Banner>
      </If>
      <If when={props.file.reviewStale}>
        <StaleReview args={props.args} />
      </If>
    </View>
  );
}

function Read(props: { args: FileArgs; file: () => FileView; onVerdict?: () => void }) {
  const pane = usePane();
  const kept = positions();
  const name = `${pane.key}:document`;
  const opened = kept.at(name);
  const shown = () => shownOf(props.file());
  const since = () => props.file().sinceReview?.parts ?? [];
  let scroll: DocumentScrollRef | undefined;
  const review = reviewOf(props.args);
  const reviewing = () => reviewable(props.file());
  const asks = useAsk(props.args.repo, props.args.folder);
  /** Asks the agent about a part, quoted from the version read, in the session beside. */
  const askAbout = (block: Block, text?: string) => {
    const to = untracked(asks);
    if (to === undefined) return false;
    const lines = shown()
      .text.split("\n")
      .slice(block.startLine - 1, block.endLine);
    const where =
      block.startLine === block.endLine
        ? `line ${block.startLine}`
        : `lines ${block.startLine}–${block.endLine}`;
    to(quoted(`About ${props.file().path}, ${where}:`, lines), text);
    return undefined;
  };
  const hung = reviewMark(props.args, props.file, (block, text) => void askAbout(block, text));
  /** The top-level blocks, in order: what the review's cursor moves through. */
  const tops = () => shown().document.blocks.filter((block) => block.parent === null);
  const moveCursor = (by: number) => {
    const all = tops();
    const at = all.findIndex((block) => block.id === review.cursor());
    const next = all[Math.max(0, Math.min(all.length - 1, (at === -1 ? 0 : at) + by))];
    if (next === undefined) return false;
    review.cursor.set(next.id);
    scroll?.toBlock(next.id);
    return undefined;
  };
  /** Opens a comment on a part: it comes to the top, its field under it, as J and K bring it. */
  const comment = (block: number, about?: string) => {
    review.cursor.set(block);
    review.writing.set(about === undefined ? { block } : { about, block });
    scroll?.toBlock(block);
  };
  registerKey([
    {
      hint: "c",
      hintLabel: "comment",
      keys: "c",
      label: "Comment on the part at the cursor",
      run: () => {
        const at = review.cursor() ?? tops()[0]?.id;
        if (at === undefined) return false;
        comment(at);
        return undefined;
      },
      when: reviewing,
    },
    {
      hint: "J K",
      hintLabel: "part",
      keys: "J",
      label: "Next part",
      run: () => moveCursor(1),
      when: reviewing,
    },
    { keys: "K", label: "Previous part", run: () => moveCursor(-1), when: reviewing },
    {
      hint: "s",
      hintLabel: "ask",
      keys: "s",
      label: "Ask the agent about the part at the cursor, beside",
      run: () => {
        const at = tops().find((block) => block.id === (review.cursor() ?? tops()[0]?.id));
        return at === undefined ? false : askAbout(at);
      },
      when: () => reviewing() && asks() !== undefined,
    },
  ]);
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
  // A heading the address names, `spec.md#architecture`, as the page opens or as it changes: only
  // the address of this file's own page, not a page it is opened beside.
  effect(() => {
    const now = route();
    if (now.page !== "file" || now.folder !== props.args.folder || now.name !== props.args.name) {
      return;
    }
    const hash = now.hash;
    if (hash === undefined || hash === "") return;
    untracked(() => {
      const heading = headingAt(shown().document, hash);
      if (heading !== undefined) scroll?.toBlock(heading.id);
    });
  });
  return (
    <DocumentScroll
      document={shown().document}
      header={<Head args={props.args} file={props.file()} onVerdict={props.onVerdict} />}
      image={(image) => imageFor(props.args.repo, image)}
      mark={(block) => {
        const part = sinceAt(since(), block);
        return (
          <>
            {part === undefined ? undefined : <Since kind={part.kind} />}
            {hung(block)}
          </>
        );
      }}
      onPress={(block) => {
        if (!untracked(reviewing)) return;
        comment(block.id);
      }}
      selected={(block) => reviewing() && review.cursor() === block.id}
      offset={opened}
      onLink={(link) => follow(link, props.args, props.file().path, shown().document)}
      onOffset={(offset) => kept.keep(name, offset)}
      onPlace={(block) => {
        atTop(props.args, block);
        if (untracked(review.writing) === null) review.cursor.set(block);
      }}
      override={(block) =>
        embedAt(props.args, shown(), block, {
          on: reviewing,
          open: (at, about) => comment(at.id, about),
        })
      }
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
export function Reader(props: { args: FileArgs; onVerdict?: () => void }) {
  return (
    <WithFile args={props.args}>
      {(file) => <Read args={props.args} file={file} onVerdict={props.onVerdict} />}
    </WithFile>
  );
}
