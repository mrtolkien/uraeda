// An image about to be sent, as a thumbnail with its Remove under it: the composer's images and a
// note's picked images draw it alike (UI coherence).
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VStack } from "@astryxdesign/core/VStack";

/**
 * The thumbnail of `src`, named `name`, `alt` telling apart several of the same name, dimmed while
 * `isLoading`, and under it Remove, tall enough for a finger: Astryx's own, in its corner, is 20 px
 * whatever the pointer (an Astryx gap). A group, so a removal can find the next one's button.
 */
export function RemovableThumbnail({
  alt,
  isLoading = false,
  name,
  onRemove,
  src,
}: {
  alt?: string;
  isLoading?: boolean;
  name: string;
  onRemove: () => void;
  src: string | undefined;
}) {
  return (
    <VStack gap={1} hAlign="center" role="group">
      <Thumbnail label={name} src={src} {...(alt ? { alt } : {})} isLoading={isLoading} />
      <Button
        icon={<Icon icon="close" />}
        isIconOnly
        label={`Remove ${name}${alt ? ` — ${alt}` : ""}`}
        onClick={onRemove}
        size="sm"
        variant="ghost"
      />
    </VStack>
  );
}
