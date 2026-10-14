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

/**
 * The thumbnail whose remove button takes the focus once one is removed: the next, else the last;
 * with none left, the text. Set the index of the one removed.
 */
export function useFocusAfterRemove(
  box: RefObject<HTMLDivElement | null>,
  input: RefObject<ChatComposerInputHandle | null>,
  images: ReadonlyArray<DraftImage>,
) {
  const focusAt = useRef<number>(undefined);
  useEffect(() => {
    const at = focusAt.current;
    if (at === undefined) {
      return;
    }
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
  focusAt: RefObject<number | undefined>;
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
                  onRemove(image.key);
                  focusAt.current = index;
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
