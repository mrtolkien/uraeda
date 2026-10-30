// The New page's change part: a composer that starts a change from a typed text and its images,
// then sends its first run. Ctrl+Enter asks for the change's slug, which the core proposes for the
// text: the page has no field for it.
import { VStack } from "@astryxdesign/core/VStack";
import type { ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { type RefObject, Suspense, startTransition, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { useSlugProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { type NewDraft, nowLine } from "./newDraft.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver, sessionPath } from "./sessions.ts";
import { StartDialog } from "./StartDialog.tsx";
import { takeOut } from "./takeOut.ts";
import { FeatureView } from "./views.ts";

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
 * A start's end: it went, and whether the draft went with it, or the refusal to show under the
 * dialog's field.
 */
type Started = { cleared: boolean; ok: true } | { message: string; ok: false };

/**
 * Starts the change from the composer's text and images, under the slug asked: its session opens,
 * where its agent works, or, when no run was sent, with the workflow's message unsent (R12). A
 * refusal is shown in the dialog, and the text stays. The first line of Now the composer was
 * filled from is replaced by the change's link in the start commit; the other entries
 * leave their files once it started. A change started once the human left the page opens nothing: its
 * text still goes, since it started, but only while it is the one sent: a newer text, typed while it
 * started, stays (R19).
 */
function useStart({ sent: clear, sources }: NewDraft) {
  const fate = useFateClient();
  const here = useRepoPath();
  const shown = useRef(true);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  return async (
    sent: string,
    images: ReadonlyArray<DraftImage>,
    slug: string,
  ): Promise<Started> => {
    const line = nowLine(sources);
    const result = await fate.mutations.change.start({
      input: {
        images: images.flatMap((image) => (image.image ? [image.image] : [])),
        ...(line ? { line: line.text } : {}),
        // Never empty: the dialog starts nothing while its field is.
        slug,
        text: sent,
      },
      view: FeatureView,
    });
    const folder = result.result?.folder;
    if (result.error || typeof folder !== "string") {
      return {
        message: result.error ? refusal(result.error).message : "The change did not start.",
        ok: false,
      };
    }
    // The store's text now, not this page's: the human may have come back and typed another.
    const cleared = clear(sent);
    void takeOut(
      fate,
      sources.filter((source) => source !== line),
    );
    if (shown.current) {
      if (result.result?.session === null) {
        handOver(folder, "start");
      } else {
        navigate(here(sessionPath(folder)));
      }
    }
    return { cleared, ok: true };
  };
}

/** What Ctrl+Enter holds while the slug is asked: the text sent, its images, and the answer. */
type Asking = { images: ReadonlyArray<DraftImage>; resolve: (sent: boolean) => void; text: string };

/** The slug's question, once the core has proposed one for the text. */
function SlugQuestion({
  asking,
  onCancel,
  onConfirm,
}: {
  asking: Asking;
  onCancel: () => void;
  onConfirm: (slug: string) => Promise<string | undefined>;
}) {
  const proposed = useSlugProposal(asking.text);
  return (
    <StartDialog
      initial={proposed}
      isOpen
      onCancel={onCancel}
      onConfirm={onConfirm}
      question={{
        confirm: "Start the change",
        description: "Two words at most: it names the folder and the branch.",
        label: "Slug",
        title: "Name the change",
      }}
    />
  );
}

/**
 * The New page's change part: the composer, over the page's draft, kept in the browser until the
 * change starts (R2), and a question for its slug once Ctrl+Enter sends it.
 */
export function ChangeComposer({
  draft,
  inputRef,
}: {
  draft: NewDraft;
  inputRef: RefObject<ChatComposerInputHandle | null>;
}) {
  const { images, setImages } = draft;
  const start = useStart(draft);
  const [asking, setAsking] = useState<Asking>();
  const answer = (sent: boolean) => {
    asking?.resolve(sent);
    setAsking(undefined);
  };
  const confirm = async (slug: string) => {
    if (!asking) {
      return undefined;
    }
    const result = await start(asking.text, asking.images, slug);
    if (!result.ok) {
      return result.message;
    }
    // Only a draft that went is the composer's to clear: a newer one keeps its images.
    answer(result.cleared);
    return undefined;
  };
  return (
    <VStack gap={4}>
      <Composer
        images={images}
        inputRef={inputRef}
        onChange={draft.setText}
        onImagesChange={setImages}
        // The composer waits on the dialog: it sent, or the human cancelled it.
        onSend={(sent, sentImages) =>
          new Promise<boolean>((resolve) => setAsking({ images: sentImages, resolve, text: sent }))
        }
        sendLabel="Start the change"
        value={draft.text}
      />
      {asking && (
        <Suspense fallback={null}>
          <SlugQuestion asking={asking} onCancel={() => answer(false)} onConfirm={confirm} />
        </Suspense>
      )}
    </VStack>
  );
}

/** The refusal of a start, as a banner: for the parts that show it under the composer. */
export function StartError({ message }: { message: string | undefined }) {
  return message ? <AnnouncedBanner collapsible={false} status="error" title={message} /> : null;
}
