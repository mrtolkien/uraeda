// Pick mode and the comment form of a story embedded where a comment on it can go: "Pick an
// element", shown once a frame says its Storybook loads the pick script, sends pick mode to the
// frames, whose element picked opens the form naming it; "Comment" opens the form on the story
// alone. Escape, in the page or inside a frame, ends pick mode without a form. The form is in place
// under the frames on wide screens, and a sheet on narrow ones.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { StoryTarget } from "uraeda-binding";
import { CommentForm } from "./CommentForm.tsx";
import { Overlay } from "./layout/Overlay.tsx";
import { type Picked, storyAnchor, storyComment } from "./storyComment.ts";
import type { PickMode } from "./StoryFrames.tsx";

const styles = stylex.create({
  form: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    padding: spacingVars["--spacing-3"],
  },
  hint: {
    backgroundColor: colorVars["--color-background-blue"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/**
 * Where a comment on an embedded story goes: `field` keys its unsaved text, and `save` writes it,
 * resolving with why it was refused, or nothing.
 */
export type EmbedComment = { field: string; save: (text: string) => Promise<string | undefined> };

/** Pick mode's state, and the form's: open on an element picked, or on the story alone. */
export type StoryPick = ReturnType<typeof useStoryPick>;

/**
 * Whether the frames said they have the pick script, whether pick mode is on, and the form when
 * open; Escape in the page ends pick mode.
 */
export function useStoryPick() {
  const [pickable, setPickable] = useState(false);
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState<{ picked?: Picked }>();
  useEffect(() => {
    if (!picking) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPicking(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picking]);
  const frames: Omit<PickMode, "onPicked"> & { onPicked: (picked: Picked) => void } = {
    onPicked: (picked) => {
      setPicking(false);
      setForm({ picked });
    },
    onPickStopped: () => setPicking(false),
    onReady: () => setPickable(true),
    picking,
  };
  return {
    close: () => setForm(undefined),
    comment: () => {
      setPicking(false);
      setForm({});
    },
    form,
    frames,
    pickable,
    picking,
    setPicking,
  };
}

/** "Pick an element", once a frame has the pick script, and "Comment": named icons when narrow. */
export function PickControls({ pick, wide }: { pick: StoryPick; wide: boolean }) {
  return (
    <>
      {pick.pickable && (
        <ToggleButton
          icon={wide ? undefined : <Icon icon="uraeda:pick" />}
          isIconOnly={!wide}
          isPressed={pick.picking}
          label="Pick an element"
          onPressedChange={pick.setPicking}
          size="sm"
        />
      )}
      {wide ? (
        <Button label="Comment" onClick={pick.comment} size="sm" />
      ) : (
        <IconButton
          icon={<Icon icon="uraeda:comment" />}
          label="Comment"
          onClick={pick.comment}
          size="sm"
        />
      )}
    </>
  );
}

const COARSE = "(pointer: coarse)";

/** Whether the pointer is coarse, as a finger: a tap, not a click. */
function useCoarsePointer() {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(COARSE);
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    },
    () => window.matchMedia(COARSE).matches,
  );
}

/** What pick mode asks for: a click, or a tap under a coarse pointer, where Escape is no key. */
export function PickHint() {
  const coarse = useCoarsePointer();
  return (
    <div role="status" {...stylex.props(styles.hint)}>
      <Text>
        {coarse
          ? "Tap an element to comment on it."
          : "Click an element to comment on it. Escape to stop."}
      </Text>
    </div>
  );
}

/**
 * The comment on the story, and on the element picked, if any: in place under the frames on wide
 * screens, a sheet on narrow ones. Saved, it closes; refused, it keeps its text with the error.
 */
export function StoryCommentForm({
  comment,
  label,
  pick,
  story,
  wide,
}: {
  comment: EmbedComment;
  label: string;
  pick: StoryPick;
  story: StoryTarget;
  wide: boolean;
}) {
  const { close, form } = pick;
  const anchor = storyAnchor(label, form?.picked);
  const send = async (text: string) => {
    const error = await comment.save(storyComment(story, form?.picked, text));
    if (error === undefined) {
      close();
    }
    return error;
  };
  // Drawn again for each element picked, so its field takes the focus.
  const fields = form && (
    <CommentForm
      anchor={anchor}
      field={comment.field}
      hasAutoFocus
      key={anchor}
      onCancel={close}
      onSubmit={send}
    />
  );
  if (wide) {
    return fields && <div {...stylex.props(styles.form)}>{fields}</div>;
  }
  return (
    <Overlay isOpen={form !== undefined} label="Comment" onClose={close}>
      {fields}
    </Overlay>
  );
}
