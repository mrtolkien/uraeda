// The New page's change part: a composer that starts a change from a typed text and its images,
// then sends its first run, under a slug the core proposes for the text.
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { VStack } from "@astryxdesign/core/VStack";
import { startTransition, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { useSlugProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { useTextField } from "./fields/useTextField.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver, sessionPath } from "./sessions.ts";
import { SlugField } from "./SlugField.tsx";
import { useDraft } from "./useDraft.ts";
import { FeatureView } from "./views.ts";
import { runWrite, useWrites } from "./writes/store.ts";

/** How long typing must stop before the slug is proposed again, as the sidebar's search waits. */
const PROPOSAL_DELAY = 200;

/** The text, as typed 200 ms ago: what the slug is proposed for. */
export function useSettled(text: string) {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => startTransition(() => setSettled(text)), PROPOSAL_DELAY);
    return () => clearTimeout(timer);
  }, [text]);
  return settled;
}

/**
 * Starts the change from the composer's text and images, under the slug typed: its session opens,
 * where its agent works, or, when no run was sent, with the workflow's message unsent (R12). A refusal is shown
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
      navigate(here(sessionPath(folder)));
    }
    return true;
  };
  return { error, start };
}

/**
 * The New page's change part: the composer, its text kept in the browser until the change starts
 * (R2), the slug proposed for its text until edited, and "Start the change".
 */
export function NewChange() {
  // Kept as a new chat's text is: leaving the page does not ask.
  const text = useTextField("new-change", "", { drawn: false });
  const { images, setImages } = useDraft();
  const proposed = useSlugProposal(useSettled(text.text));
  const slug = useTextField("new-change#slug", proposed, { drawn: false });
  const { error, start } = useStart(text, slug);
  // Another page's write still running blocks this one, as every writing button is blocked.
  const { running } = useWrites();
  const [starting, setStarting] = useState(false);
  return (
    <VStack gap={4}>
      <Paragraph color="secondary">
        Describe the bug or the change. The first line is its title.
      </Paragraph>
      <Composer
        images={images}
        onChange={text.change}
        onImagesChange={setImages}
        // Its branch and worktree are written: the other writes wait, as for a commit.
        onSend={(sent, images) => {
          setStarting(true);
          return runWrite({ label: "Starting the change…" }, () => start(sent, images)).finally(
            () => setStarting(false),
          );
        }}
        sendLabel="Start the change"
        sendWaits={running && !starting ? "Another change is being saved to git" : undefined}
        value={text.text}
      />
      <SlugField field={slug} restoreNotice={false} />
      {error && <AnnouncedBanner collapsible={false} status="error" title={error} />}
    </VStack>
  );
}
