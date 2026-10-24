// A story embedded where a workflow file links it, in a live window: the story running in the
// checkout's Storybook, through Uraeda's own address, at the desktop's width on wide screens and the
// phone's on narrow ones until the human picks the other, in Uraeda's colour mode. On a wide screen,
// it grows past its page's column into the space beside it; it goes full screen, at 100%. Its frames are sandboxed without
// `allow-same-origin`: the embed takes messages from their windows only, and sends them nothing
// but the colour mode and pick mode. Where a comment can go, it offers pick mode and a comment.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFateClient } from "react-fate";
import type { StoryTarget } from "uraeda-binding";
import { useStory } from "./data.ts";
import { refusal } from "./errors.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import type { Fit } from "./LiveFrame.tsx";
import { FullScreenButton, type Live, LiveWindow, useLiveWindow } from "./LiveWindow.tsx";
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
  // The states' controls, drawn into the window's top border, laid out as its own.
  slot: {
    alignItems: "center",
    display: "contents",
  },
  state: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-4"],
  },
});

/** "Open in Storybook", at a page of Uraeda's: a named icon. */
function OpenInStorybook({ href }: { href: string }) {
  const here = useRepoPath();
  return (
    <IconButton
      href={here(href)}
      icon={<Icon icon="externalLink" />}
      label="Open in Storybook"
      size="sm"
      variant="ghost"
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

/** Phone and Desktop: the widths a story shows at, named icons on narrow screens. */
function WidthSwitch({
  onChange,
  wide,
  width,
}: {
  onChange: (width: Width) => void;
  wide: boolean;
  width: Width;
}) {
  return (
    <SegmentedControl
      label="Width"
      onChange={(value: string) => onChange(value as Width)}
      size="sm"
      value={width}
    >
      <SegmentedControlItem
        icon={wide ? undefined : <Icon icon="uraeda:smartphone" />}
        isLabelHidden={!wide}
        label="Phone"
        value="phone"
      />
      <SegmentedControlItem
        icon={wide ? undefined : <Icon icon="uraeda:monitor" />}
        isLabelHidden={!wide}
        label="Desktop"
        value="desktop"
      />
    </SegmentedControl>
  );
}

/**
 * Where a state of the story puts what the window shows: its controls, in the window's top border,
 * and the frame's width and scale, for its title. The window stays one element through the
 * story's states, so a page holding it, or its comment form, keeps it.
 */
type Shell = {
  live: Live;
  setFit: (fit: Fit | undefined) => void;
  slot: HTMLElement | null;
  wide: boolean;
};

/** A state's controls, in the window's top border. */
function Actions({ children, shell }: { children: ReactNode; shell: Shell }) {
  return shell.slot && createPortal(children, shell.slot);
}

/**
 * The story running: its width, pick mode where a comment can go, full screen, and its frame. The
 * desktop's width on a wide screen, the phone's on a narrow one, until the human picks one.
 */
function ReadyStory({
  comment,
  frame,
  label,
  pick,
  shell,
  storybook,
}: {
  comment?: EmbedComment;
  frame: string;
  label: string;
  pick: StoryPick;
  shell: Shell;
  storybook: string;
}) {
  const { live, setFit, wide } = shell;
  const [width, setWidth] = useState<Width>(wide ? "desktop" : "phone");
  const { full } = live.screen;
  const base = useContext(PreviewBase);
  // Pick mode ends with the frames: a story stopped picks nothing; nor has it a width or a scale.
  const { setPicking } = pick;
  useEffect(
    () => () => {
      setPicking(false);
      setFit(undefined);
    },
    [setFit, setPicking],
  );
  return (
    <>
      <Actions shell={shell}>
        <WidthSwitch onChange={setWidth} wide={wide} width={width} />
        {comment && <PickControls pick={pick} wide={wide} />}
        <FullScreenButton screen={live.screen} />
        {!full && <OpenInStorybook href={storybook} />}
      </Actions>
      {comment && <PickHint picking={pick.picking} />}
      <StoryFrames
        full={full}
        label={label}
        onFit={setFit}
        pick={pick.frames}
        src={`${base}${frame}`}
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
  pick,
  removed,
  shell,
  story,
}: {
  comment?: EmbedComment;
  folder: string;
  label: string;
  pick: StoryPick;
  removed: boolean;
  shell: Shell;
  story: StoryTarget;
}) {
  const record = useStory(folder, story);
  if (record?.state === "ready" && record.frame && record.storybook) {
    return (
      <ReadyStory
        comment={comment}
        frame={record.frame}
        label={label}
        pick={pick}
        shell={shell}
        storybook={record.storybook}
      />
    );
  }
  if (record?.state === "failed") {
    return (
      <>
        <Actions shell={shell}>
          <TryAgain folder={folder} />
        </Actions>
        <State error>{record.error}</State>
      </>
    );
  }
  if (record?.state === "missing") {
    return (
      <>
        <Actions shell={shell}>
          <OpenInStorybook href={storybookHref(folder)} />
        </Actions>
        {removed ? (
          <State>This variant was removed after your answer.</State>
        ) : (
          <NoSuchStory story={story} />
        )}
      </>
    );
  }
  return (
    <State>
      {record?.state === "starting"
        ? "Starting Storybook for this branch…"
        : "This feature has no worktree, so its stories cannot run here."}
    </State>
  );
}

/**
 * A story link alone in its paragraph, by its checkout's folder, `main` for the main checkout: a
 * live window named by its label, showing the story once its Storybook runs, or why it does not.
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
  const wide = !isNarrow(useWidthClass());
  const target = { export: story.export, path: story.path };
  // Pick mode and the comment form outlive the story's state: a form holding text stays while
  // its Storybook stops and starts again.
  const pick = useStoryPick(comment?.field);
  const live = useLiveWindow(wide);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [fit, setFit] = useState<Fit>();
  const shell: Shell = { live, setFit, slot, wide };
  return (
    <LiveWindow
      actions={<span ref={setSlot} {...stylex.props(styles.slot)} />}
      after={
        comment && (
          <StoryCommentForm
            comment={comment}
            label={story.label}
            pick={pick}
            story={target}
            wide={wide}
          />
        )
      }
      fit={fit}
      id={id}
      label={story.label}
      live={live}
      wide={wide}
    >
      <Suspense fallback={null}>
        <LiveStory
          comment={comment}
          folder={folder}
          label={story.label}
          pick={pick}
          removed={removed}
          shell={shell}
          story={target}
        />
      </Suspense>
    </LiveWindow>
  );
}
