// "New change": a composer that starts a change from a typed text and its images, then sends its
// first run, under a slug the core proposes for the text. Shaped like a new chat's page, in one
// column at both widths.
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { startTransition, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { useSlugProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { useTextField } from "./fields/useTextField.ts";
import { Page } from "./layout/Page.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { navigate, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { SlugField } from "./SlugField.tsx";
import { useDraft } from "./useDraft.ts";
import { FeatureView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

/** How long typing must stop before the slug is proposed again, as the sidebar's search waits. */
const PROPOSAL_DELAY = 200;

/** The text, as typed 200 ms ago: what the slug is proposed for. */
function useSettled(text: string) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => startTransition(() => setSettled(text)), PROPOSAL_DELAY);
    return () => clearTimeout(timer);
  }, [text]);
  return settled;
}

/**
 * Starts the change from the composer's text and images, under the slug typed: its page opens, or,
 * when no run was sent, its session with the workflow's message unsent (R12). A refusal is shown
 * under the slug field, and the text stays. A change started once the human left the page opens
 * nothing: its text and slug still go, since it started, but only while they are the ones sent: a
 * newer text or slug, typed while it started, stays (R19).
 */
function useStart(text: ReturnType<typeof useTextField>, slug: ReturnType<typeof useTextField>) {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  const start = async (sent: string, images: ReadonlyArray<DraftImage>) => {
    setError(undefined);
    const sentSlug = slug.text.trim();
    const result = await fate.mutations.change.start({
      input: {
        images: images.flatMap((image) => (image.image ? [image.image] : [])),
        // Before a slug is proposed, or once it is cleared, the core proposes its own.
        ...(sentSlug ? { slug: sentSlug } : {}),
        text: sent,
      },
      view: FeatureView,
    });
    const folder = result.result?.folder;
    if (result.error || typeof folder !== "string") {
      setError(result.error ? refusal(result.error).message : "The change did not start.");
      return false;
    }
    // The store's text now, not this page's: the human may have come back and typed another.
    if (text.unsavedNow()?.text.trim() === sent) {
      text.discard();
    }
    const slugNow = slug.unsavedNow();
    if (!slugNow || slugNow.text.trim() === sentSlug) {
      slug.discard();
    }
    if (!shown.current) {
      return true;
    }
    if (result.result?.session === null) {
      handOver(folder, "start");
    } else {
      navigate(here(`/f/${folder}`));
    }
    return true;
  };
  return { error, start };
}

/**
 * The "New change" page: the composer, its text kept in the browser until the change starts (R2),
 * the slug proposed for its text until edited, and "Start the change".
 */
export function NewChangePage() {
  useRestoreScroll(true);
  // Kept as a new chat's text is: leaving the page does not ask.
  const text = useTextField("new-change", "", { drawn: false });
  const { images, setImages } = useDraft();
  const proposed = useSlugProposal(useSettled(text.text));
  const slug = useTextField("new-change#slug", proposed, { drawn: false });
  const { error, start } = useStart(text, slug);
  return (
    <Page>
      <VStack gap={4}>
        <VStack gap={2}>
          <Heading level={1}>New change</Heading>
          <Paragraph color="secondary">
            Describe the bug or the change. The first line is its title.
          </Paragraph>
        </VStack>
        <Composer
          images={images}
          onChange={text.change}
          onImagesChange={setImages}
          // Its branch and worktree are written: the other writes wait, as for a commit.
          onSend={(sent, images) =>
            runWrite({ label: "Starting the change…" }, () => start(sent, images))
          }
          sendLabel="Start the change"
          value={text.text}
        />
        <SlugField field={slug} restoreNotice={false} />
        {error && <Banner collapsible={false} status="error" title={error} />}
        <Text color="secondary" type="supporting">
          Creates its branch and worktree, and adds it to Now. The agent asks only what it must,
          then opens a pull request.
        </Text>
      </VStack>
    </Page>
  );
}
