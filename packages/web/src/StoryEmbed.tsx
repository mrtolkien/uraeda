// A story embedded where a workflow file links it: the story running in the checkout's Storybook,
// through Uraeda's own address, at a phone and a desktop width on wide screens and at the phone's
// alone on narrow ones, in Uraeda's colour mode. Its frames are sandboxed without
// `allow-same-origin`: the embed takes messages from their windows only, and sends them nothing
// but the colour mode and pick mode. Where a comment can go, it offers pick mode and a comment.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense, useId, useState } from "react";
import { useFateClient } from "react-fate";
import type { StoryTarget } from "uraeda-binding";
import { useStory } from "./data.ts";
import { refusal } from "./errors.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useRepoPath } from "./routes.tsx";
import { storybookHref } from "./stories.tsx";
import { StoryFrames, type Widths } from "./StoryFrames.tsx";
import {
  type EmbedComment,
  PickControls,
  PickHint,
  StoryCommentForm,
  useStoryPick,
} from "./StoryPick.tsx";
import { PreviewView } from "./views.ts";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // On narrow screens, the embed takes the page's inset back: the phone's width is the screen's.
  bleed: {
    borderInlineWidth: 0,
    borderRadius: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  embed: {
    backgroundColor: colorVars["--color-background-surface"],
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
    marginInline: 0,
    overflow: "hidden",
  },
  error: {
    backgroundColor: colorVars["--color-background-red"],
  },
  label: {
    marginInlineEnd: "auto",
  },
  state: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-4"],
  },
});

/** "Open in Storybook", at a page of Uraeda's: a named icon on narrow screens. */
function OpenInStorybook({ href, wide }: { href: string; wide: boolean }) {
  const here = useRepoPath();
  return wide ? (
    <Button href={here(href)} label="Open in Storybook" size="sm" />
  ) : (
    <IconButton
      href={here(href)}
      icon={<Icon icon="externalLink" />}
      label="Open in Storybook"
      size="sm"
    />
  );
}

/** The embed's bar: its label, then its controls. */
function Bar({
  children,
  label,
  labelId,
}: {
  children?: ReactNode;
  label: string;
  labelId: string;
}) {
  return (
    <div {...stylex.props(styles.bar)}>
      <Text id={labelId} weight="semibold" xstyle={styles.label}>
        {label}
      </Text>
      {children}
    </div>
  );
}

/** Why the story does not show, or its Storybook: the Storybook page shows it too. */
export function State({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role="status" {...stylex.props(styles.state, error && styles.error)}>
      <Text color={error ? "error" : "secondary"}>{children}</Text>
    </div>
  );
}

/** A story its Storybook's index does not hold. */
export function NoSuchStory({ story }: { story: StoryTarget }) {
  return (
    <State>
      No story “{story.export}” in {story.path} on this branch.
    </State>
  );
}

/** "Try again": restarts the checkout's Storybook, whose updates reach its records. */
export function TryAgain({ folder }: { folder: string }) {
  const fate = useFateClient();
  const [message, setMessage] = useState<string>();
  const restart = async () => {
    setMessage(undefined);
    const result = await fate.mutations.preview.restart({ input: { folder }, view: PreviewView });
    if (result.error) {
      setMessage(refusal(result.error).message);
    }
  };
  return (
    <>
      <Button clickAction={restart} label="Try again" size="sm" />
      {message && <Text color="error">{message}</Text>}
    </>
  );
}

/** The story running: its widths, pick mode and the comment where one can go, and its frames. */
function ReadyStory({
  comment,
  frame,
  label,
  labelId,
  story,
  storybook,
}: {
  comment?: EmbedComment;
  frame: string;
  label: string;
  labelId: string;
  story: StoryTarget;
  storybook: string;
}) {
  const wide = useWidthClass() === "wide";
  const [widths, setWidths] = useState<Widths>("both");
  const pick = useStoryPick();
  return (
    <>
      <Bar label={label} labelId={labelId}>
        {wide && (
          <SegmentedControl
            label="Width"
            onChange={(value: string) => setWidths(value as Widths)}
            size="sm"
            value={widths}
          >
            <SegmentedControlItem label="Both" value="both" />
            <SegmentedControlItem label="Phone" value="phone" />
            <SegmentedControlItem label="Desktop" value="desktop" />
          </SegmentedControl>
        )}
        {comment && <PickControls pick={pick} wide={wide} />}
        <OpenInStorybook href={storybook} wide={wide} />
      </Bar>
      {pick.picking && <PickHint />}
      <StoryFrames label={label} pick={pick.frames} src={frame} wide={wide} widths={widths} />
      {comment && (
        <StoryCommentForm comment={comment} label={label} pick={pick} story={story} wide={wide} />
      )}
    </>
  );
}

/** The story as its record says: starting, failed, missing, without a worktree, or running. */
function LiveStory({
  comment,
  folder,
  label,
  labelId,
  removed,
  story,
}: {
  comment?: EmbedComment;
  folder: string;
  label: string;
  labelId: string;
  removed: boolean;
  story: StoryTarget;
}) {
  const record = useStory(folder, story);
  const wide = useWidthClass() === "wide";
  if (record?.state === "ready" && record.frame && record.storybook) {
    return (
      <ReadyStory
        comment={comment}
        frame={record.frame}
        label={label}
        labelId={labelId}
        story={story}
        storybook={record.storybook}
      />
    );
  }
  if (record?.state === "failed") {
    return (
      <>
        <Bar label={label} labelId={labelId}>
          <TryAgain folder={folder} />
        </Bar>
        <State error>{record.error}</State>
      </>
    );
  }
  if (record?.state === "missing") {
    return (
      <>
        <Bar label={label} labelId={labelId}>
          <OpenInStorybook href={storybookHref(folder)} wide={wide} />
        </Bar>
        {removed ? (
          <State>This variant was removed after your answer.</State>
        ) : (
          <NoSuchStory story={story} />
        )}
      </>
    );
  }
  return (
    <>
      <Bar label={label} labelId={labelId} />
      <State>
        {record?.state === "starting"
          ? "Starting Storybook for this branch…"
          : "This feature has no worktree, so its stories cannot run here."}
      </State>
    </>
  );
}

/**
 * A story link alone in its paragraph, by its checkout's folder, `main` for the main checkout: a
 * figure named by its label, showing the story live once its Storybook runs, or why it does not.
 * `removed`, in a round answered, says a story missing is a variant removed after the answer.
 * `comment` saves a comment on the story, where the page can take one. `id` lets a page scroll to
 * it.
 */
export function StoryEmbed({
  comment,
  folder,
  id,
  removed = false,
  story,
}: {
  comment?: EmbedComment;
  folder: string;
  id?: string;
  removed?: boolean;
  story: StoryTarget & { label: string };
}) {
  const labelId = useId();
  const wide = useWidthClass() === "wide";
  const target = { export: story.export, path: story.path };
  return (
    <figure
      aria-labelledby={labelId}
      id={id}
      {...stylex.props(styles.embed, !wide && styles.bleed)}
    >
      <Suspense fallback={<Bar label={story.label} labelId={labelId} />}>
        <LiveStory
          comment={comment}
          folder={folder}
          label={story.label}
          labelId={labelId}
          removed={removed}
          story={target}
        />
      </Suspense>
    </figure>
  );
}
