import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { Blocks } from "../Blocks.tsx";
import { MAIN_CHECKOUT, useDraft } from "../data.ts";
import { refusal } from "../errors.ts";
import { useTextField } from "../fields/useTextField.ts";
import { Paragraph } from "../layout/Paragraph.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { SlugField } from "../SlugField.tsx";
import { StoriesProvider } from "../stories.tsx";
import { FeatureView } from "../views.ts";

/**
 * An entry's draft, drawn, with its slug and Start the feature, as `TaskView`'s draft part: its
 * Edit moved to the pane's bar, as Open draft. TEMPORARY: a copy of `TaskView`'s `DraftPart`,
 * which the redesign's implementation shares between the two.
 */
export function PaneDraft({ path }: { path: string }) {
  const fate = useFateClient();
  const draft = useDraft(path);
  const here = useRepoPath();
  const [message, setMessage] = useState<string>();
  const slug = useTextField(`${path}#slug`, draft?.slug ?? "");
  if (!draft) {
    return <Paragraph>No draft {path}.</Paragraph>;
  }
  // The draft's title is the entry's text, shown above it already.
  const ids = draft.document.blocks
    .filter(
      (block) => block.parent === undefined && !(block.kind === "heading" && block.level === 1),
    )
    .map((block) => block.id);
  const start = async () => {
    setMessage(undefined);
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug: slug.text },
      view: FeatureView,
    });
    if (result.error) {
      setMessage(refusal(result.error).message);
    } else if (typeof result.result?.folder === "string") {
      slug.discard();
      navigate(here(`/f/${result.result.folder}`));
    }
  };
  return (
    <VStack gap={3}>
      <Text color="secondary" type="supporting">
        {path.replace(/^specs\//, "")} · {draft.committed ? "committed" : "not committed"}
      </Text>
      <StoriesProvider folder={MAIN_CHECKOUT} stories={draft.stories}>
        <Blocks document={draft.document} ids={ids} />
      </StoriesProvider>
      <SlugField field={slug} />
      <HStack gap={2}>
        <Button clickAction={start} label="Start the feature" variant="primary" />
      </HStack>
      {message && <Banner collapsible={false} status="error" title={message} />}
    </VStack>
  );
}
