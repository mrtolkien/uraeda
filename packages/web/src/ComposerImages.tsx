import { Button } from "@astryxdesign/core/Button";
import { ChatComposerDrawer, type ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, useEffect, useRef } from "react";
import type { DraftImage } from "./attach/chatImages.ts";
import { useRepository } from "./routes.tsx";
import { chatImageSrc } from "./sessions.ts";

/** The image being removed: where it was, and its key. */
export type RemovedImage = { index: number; key: string } | undefined;

/**
 * The thumbnail whose remove button takes the focus once one is removed: the next, else the last;
 * with none left, the text. Set the place and key of the one removed: the focus waits until the
 * images no longer hold it, so an effect still owed to an earlier draw (an image just saved)
 * does not take the focus first, to the button about to go.
 */
export function useFocusAfterRemove(
  box: RefObject<HTMLDivElement | null>,
  input: RefObject<ChatComposerInputHandle | null>,
  images: ReadonlyArray<DraftImage>,
) {
  const focusAt = useRef<RemovedImage>(undefined);
  useEffect(() => {
    const removed = focusAt.current;
    if (removed === undefined || images.some((image) => image.key === removed.key)) {
      return;
    }
    const at = removed.index;
    focusAt.current = undefined;
    const buttons = [
      ...(box.current?.querySelectorAll<HTMLElement>(
        '[role="group"] button[aria-label^="Remove "]',
      ) ?? []),
    ];
    const next = buttons[Math.min(at, buttons.length - 1)];
    if (next) {
      next.focus();
    } else {
      input.current?.focus();
    }
  }, [box, images, input]);
  return focusAt;
}

/**
 * The composer's images, as thumbnails above its text, dimmed while saved, each with Remove under
 * it, tall enough for a finger: Astryx's own, in its corner, is 20 px whatever the pointer (an
 * Astryx gap, see the plan). Several are told apart by their place, as pasted images share their
 * name.
 */
export function ComposerImages({
  focusAt,
  images,
  onRemove,
}: {
  /** Where the focus goes once an image is removed, from `useFocusAfterRemove`. */
  focusAt: RefObject<RemovedImage>;
  images: ReadonlyArray<DraftImage>;
  onRemove: (key: string) => void;
}) {
  const repo = useRepository();
  return (
    <ChatComposerDrawer label="Images">
      <HStack gap={2} wrap="wrap">
        {images.map((image, index, all) => {
          const alt = all.length > 1 ? `image ${index + 1} of ${all.length}` : undefined;
          return (
            <VStack gap={1} hAlign="center" key={image.key} role="group">
              <Thumbnail
                label={image.name}
                src={image.image ? chatImageSrc(repo, image.image) : image.preview}
                {...(alt ? { alt } : {})}
                isLoading={!image.image}
              />
              <Button
                icon={<Icon icon="close" />}
                isIconOnly
                label={`Remove ${image.name}${alt ? ` — ${alt}` : ""}`}
                onClick={() => {
                  focusAt.current = { index, key: image.key };
                  onRemove(image.key);
                }}
                size="sm"
                variant="ghost"
              />
            </VStack>
          );
        })}
      </HStack>
    </ChatComposerDrawer>
  );
}
