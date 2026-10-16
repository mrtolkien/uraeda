import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import type { Document, MockupLink, StoryLink } from "uraeda-binding";
import { usePreviewOn } from "./data.ts";
import { type Folds, useRevealBlock } from "./Folds.tsx";
import { navigate, pathLink, useRepoPath, useRepository } from "./routes.tsx";
import { storybookHref, storyEmbedId } from "./stories.tsx";

/**
 * The spec's mockups, at the top of its review: the easiest part of a spec to check, one large
 * button per mockup its Mockups section links, each opening the mockup's page, or scrolling to the
 * embed of a story, opening its fold first, else opening the story in the Storybook page; without a
 * preview decision, a story's opens its file, as its link does. Nothing without mockups.
 */
export function ReviewMockups({
  document,
  folder,
  folds,
  mockups,
  stories,
  wide,
}: {
  document: Document;
  folder: string;
  folds: Folds | undefined;
  mockups: ReadonlyArray<MockupLink> | undefined;
  stories: ReadonlyArray<StoryLink>;
  wide: boolean;
}) {
  const here = useRepoPath();
  const repo = useRepository();
  // Without a preview decision, the file embeds no story.
  const preview = usePreviewOn(folder);
  const reveal = useRevealBlock(document, folds);
  if (!mockups?.length) {
    return undefined;
  }
  const open = ({ path, story }: MockupLink) => {
    const embed =
      preview && stories.find((link) => link.path === story?.path && link.export === story.export);
    if (!story) {
      navigate(here(`/f/${folder}/${path}`));
    } else if (embed) {
      reveal(document.blocks[embed.block], storyEmbedId(embed.block));
    } else if (!preview) {
      const { href, inApp } = pathLink(path, repo);
      if (inApp) {
        navigate(href);
      } else {
        window.open(href, "_blank", "noreferrer");
      }
    } else {
      navigate(here(storybookHref(folder, story)));
    }
  };
  return (
    <HStack aria-label="Mockups" as="section" gap={2} wrap="wrap">
      {mockups.map((mockup) => (
        <Button
          key={`${mockup.path}-${mockup.block}`}
          label={`Open the mockup: ${mockup.label}`}
          onClick={() => open(mockup)}
          size="lg"
          variant="primary"
          width={wide ? undefined : "100%"}
        />
      ))}
    </HStack>
  );
}
