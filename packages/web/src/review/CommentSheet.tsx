import * as stylex from "@stylexjs/stylex";
import { Overlay } from "../layout/Overlay.tsx";
import { FormSlot } from "../ReviewCommentForm.tsx";
import type { useCommentDraft } from "../useCommentDraft.ts";

const styles = stylex.create({
  sheetRoom: {
    // Room at the page's end, so the last block can rise above the comment sheet.
    height: "var(--size-viewport-height)",
  },
});

/**
 * On the phone, the comment form's sheet, which leaves the last tapped block in view above it, and
 * room at the page's end, so the last block can rise above it.
 */
export function CommentSheet({
  container,
  draft: { close, draft, sheet },
  isOpen,
}: {
  container: HTMLElement;
  draft: ReturnType<typeof useCommentDraft>;
  isOpen: boolean;
}) {
  return (
    <>
      {draft && <div {...stylex.props(styles.sheetRoom)} />}
      <Overlay
        isModal={false}
        isOpen={isOpen}
        label="Comment"
        onClose={close}
        sheetHeight="capped"
        sheetRef={sheet}
      >
        <FormSlot boxed={false} container={container} />
      </Overlay>
    </>
  );
}
