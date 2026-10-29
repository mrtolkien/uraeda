import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useEffect, useSyncExternalStore } from "react";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";

const styles = stylex.create({
  jump: {
    // Above the composer, over the transcript's end, without moving it.
    bottom: "100%",
    display: "flex",
    insetInline: 0,
    justifyContent: "center",
    paddingBlockEnd: spacingVars["--spacing-2"],
    pointerEvents: "none",
    position: "absolute",
  },
  jumpButton: {
    // The secondary button's fill is translucent: the page's surface under it keeps the transcript's
    // text from showing through.
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-element"],
    display: "inline-flex",
    pointerEvents: "auto",
  },
});

/** The jump to the latest of the session page drawn, for the phone's bottom bar. */
let published: (() => void) | undefined;
const listeners = new Set<() => void>();

function publish(jump: (() => void) | undefined) {
  published = jump;
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Gives the phone's bottom bar `jump`, the session's jump to the latest, while it is drawn. */
export function usePublishJump(jump: (() => void) | undefined) {
  useEffect(() => {
    publish(jump);
    return () => publish(undefined);
  }, [jump]);
}

/** The session's jump to the latest while the page does not follow its end, else `undefined`. */
export function usePublishedJump() {
  return useSyncExternalStore(subscribe, () => published);
}

/**
 * "Jump to the latest", above the composer, while the page does not follow the transcript's end.
 * Pressed, it goes to the latest reply (`onJump`): the focus moves first to the composer's text
 * field, in `composer`, rather than falling to the page.
 */
export function JumpToLatest({
  composer,
  isBoxed,
  onJump,
}: {
  composer: RefObject<HTMLElement | null>;
  /** Whether the session is in a page's box, a sheet on the phone, where no bottom bar jumps. */
  isBoxed: boolean;
  onJump: () => void;
}) {
  // On the session's page on the phone, the bottom bar's arrow jumps: nothing floats over the text.
  const wide = !isNarrow(useWidthClass()) || isBoxed;
  const jump = () => {
    composer.current
      ?.querySelector<HTMLElement>('[role="textbox"]')
      ?.focus({ preventScroll: true });
    onJump();
  };
  if (!wide) {
    return null;
  }
  return (
    <div {...stylex.props(styles.jump)}>
      <span {...stylex.props(styles.jumpButton)}>
        <Button
          clickAction={jump}
          elevation="low"
          icon={<Icon icon="arrowDown" />}
          // Its arrow alone, named for a screen reader and in its tooltip: it hides the text less.
          isIconOnly
          label="Jump to the latest"
          size="sm"
          tooltip="Jump to the latest"
          variant="secondary"
        />
      </span>
    </div>
  );
}
