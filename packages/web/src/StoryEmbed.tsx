// A story embedded where a workflow file links it: the story running in the checkout's Storybook,
// through Uraeda's own address, at the desktop's width on wide screens, or the phone's when chosen,
// and at the phone's alone on narrow ones, in Uraeda's colour mode. On a wide screen, it grows past
// its page's column into the space beside it, and goes full screen. Its frames are sandboxed without
// `allow-same-origin`: the embed takes messages from their windows only, and sends them nothing
// but the colour mode and pick mode. Where a comment can go, it offers pick mode and a comment.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense, useContext, useEffect, useId, useState } from "react";
import { useFateClient } from "react-fate";
import type { StoryTarget } from "uraeda-binding";
import { useStory } from "./data.ts";
import { refusal } from "./errors.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Bar, type FullScreen, LiveWindow, useLiveWindow } from "./LiveWindow.tsx";
import { useRepoPath } from "./routes.tsx";
import { PreviewBase, storybookHref } from "./stories.tsx";
import { StoryFrames, type Width } from "./StoryFrames.tsx";
import {
  type EmbedComment,
  type StoryPick,
  PickControls,
  PickHint,
  StoryCommentForm,
  useStoryPick,
} from "./StoryPick.tsx";
import { PreviewView } from "./views.ts";

const styles = stylex.create({
  error: {
    backgroundColor: colorVars["--color-background-red"],
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

/** The story running: its width, full screen, pick mode where a comment can go, and its frame. */
function ReadyStory({
  comment,
  frame,
  label,
  labelId,
  pick,
  screen,
  storybook,
}: {
  comment?: EmbedComment;
  frame: string;
  label: string;
  labelId: string;
  pick: StoryPick;
  screen: FullScreen;
  storybook: string;
}) {
  const wide = !isNarrow(useWidthClass());
  // The desktop's width on a wide screen, the phone's on a narrow one, until the human picks one.
  const [width, setWidth] = useState<Width>("desktop");
  const { full, toggle } = screen;
  const base = useContext(PreviewBase);
  // Pick mode ends with the frames: a story stopped picks nothing.
  const { setPicking } = pick;
  useEffect(() => () => setPicking(false), [setPicking]);
  return (
    <>
      <Bar label={label} labelId={labelId}>
        {wide && (
          <SegmentedControl
            label="Width"
            onChange={(value: string) => setWidth(value as Width)}
            size="sm"
            value={width}
          >
            <SegmentedControlItem label="Phone" value="phone" />
            <SegmentedControlItem label="Desktop" value="desktop" />
          </SegmentedControl>
        )}
        {comment && <PickControls pick={pick} wide={wide} />}
        {wide && toggle && (
          <Button
            clickAction={toggle}
            label={full ? "Leave full screen" : "Full screen"}
            size="sm"
          />
        )}
        {!full && <OpenInStorybook href={storybook} wide={wide} />}
      </Bar>
      {comment && <PickHint picking={pick.picking} />}
      <StoryFrames
        full={full}
        label={label}
        pick={pick.frames}
        src={`${base}${frame}`}
        wide={wide}
        width={width}
      />
    </>
  );
}

/** The story as its record says: starting, failed, missing, without a worktree, or running. */
function LiveStory({
  comment,
  folder,
  label,
  labelId,
  pick,
  removed,
  screen,
  story,
}: {
  comment?: EmbedComment;
  folder: string;
  label: string;
  labelId: string;
  pick: StoryPick;
  removed: boolean;
  screen: FullScreen;
  story: StoryTarget;
}) {
  const record = useStory(folder, story);
  const wide = !isNarrow(useWidthClass());
  if (record?.state === "ready" && record.frame && record.storybook) {
    return (
      <ReadyStory
        comment={comment}
        frame={record.frame}
        label={label}
        labelId={labelId}
        pick={pick}
        screen={screen}
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
  const wide = !isNarrow(useWidthClass());
  const target = { export: story.export, path: story.path };
  // Pick mode and the comment form outlive the story's state: a form holding text stays while
  // its Storybook stops and starts again.
  const pick = useStoryPick(comment?.field);
  const live = useLiveWindow(wide);
  return (
    <LiveWindow id={id} labelId={labelId} live={live} wide={wide}>
      <Suspense fallback={<Bar label={story.label} labelId={labelId} />}>
        <LiveStory
          comment={comment}
          folder={folder}
          label={story.label}
          labelId={labelId}
          pick={pick}
          removed={removed}
          screen={live.screen}
          story={target}
        />
      </Suspense>
      {comment && (
        <StoryCommentForm
          comment={comment}
          label={story.label}
          pick={pick}
          story={target}
          wide={wide}
        />
      )}
    </LiveWindow>
  );
}
