// The New page's feature part: a composer that starts a feature from the page's draft, its text and
// images. Ctrl+Enter asks for the feature's slug, which the core proposes for the text, and its
// research effort, High first; Enter starts it, and its session opens as soon as the start is
// planned, the discovery's message in its composer, unsent, while the write queue commits it. The
// draft goes once the start landed: a refused start leaves it in the composer.
import type { ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { useStartProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { type NewDraft, nowLine } from "./newDraft.ts";
import { useRepositoryPath } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { StartDialog } from "./StartDialog.tsx";
import { takeOut } from "./takeOut.ts";
import { remember } from "./useStart.ts";
import { StartPlanView } from "./views.ts";

/** The research effort picked first, as a proposal without the field reads. */
const INITIAL_EFFORT = "high";

/** What Ctrl+Enter holds while the dialog asks: the text sent, its images, and the answer. */
type Asking = { images: ReadonlyArray<DraftImage>; resolve: (sent: boolean) => void; text: string };

/**
 * Starts the feature from the text and images sent, under the slug and effort asked: the refusal to
 * show in the dialog, or nothing once planned and its session opened. The first line of Now the
 * draft was filled from is replaced by the feature's link in the start commit; the other entries
 * leave their files, and the draft goes, once it landed.
 */
function useFeatureStart(draft: NewDraft) {
  const fate = useFateClient();
  const repo = useRepositoryPath();
  return async (
    { images, text }: Pick<Asking, "images" | "text">,
    slug: string,
    discovery: string | undefined,
  ): Promise<string | undefined> => {
    const { sources } = draft;
    const line = nowLine(sources);
    const result = await fate.mutations.feature.startText({
      input: {
        ...(discovery === undefined ? {} : { discovery }),
        images: images.flatMap((image) => (image.image ? [image.image] : [])),
        ...(line ? { line: line.text } : {}),
        slug,
        text,
      },
      view: StartPlanView,
    });
    const plan = result.result;
    if (result.error || typeof plan?.folder !== "string") {
      return result.error ? refusal(result.error).message : "The feature did not start.";
    }
    const others = sources.filter((source) => source !== line);
    // Once: a source taken out twice would take out the note that moved into its place.
    let landed = false;
    remember(repo, plan.folder, {
      kind: "feature",
      landed: () => {
        if (landed) {
          return;
        }
        landed = true;
        draft.sent(text);
        void takeOut(fate, others);
      },
      message: plan.message ?? "",
      seen: false,
      title: plan.title ?? text,
    });
    handOver(plan.folder, "start");
    return undefined;
  };
}

/** The dialog, once the core has proposed a slug and the efforts for the text. */
function FeatureQuestion({
  asking,
  onCancel,
  onConfirm,
}: {
  asking: Asking;
  onCancel: () => void;
  onConfirm: (slug: string, level?: string) => Promise<string | undefined>;
}) {
  const { levels, slug } = useStartProposal(asking.text);
  return (
    <StartDialog
      {...(levels.length === 0 ? {} : { effort: { initial: INITIAL_EFFORT, levels } })}
      initial={slug}
      isOpen
      onCancel={onCancel}
      onConfirm={onConfirm}
      question={{
        confirm: "Start the feature",
        description: "Two words at most: it names the folder and the branch.",
        label: "Slug",
        title: "Name the feature",
      }}
    />
  );
}

/** The New page's feature part: the composer, over the page's draft, and the feature's dialog. */
export function FeatureComposer({
  draft,
  inputRef,
}: {
  draft: NewDraft;
  inputRef: RefObject<ChatComposerInputHandle | null>;
}) {
  const start = useFeatureStart(draft);
  const [asking, setAsking] = useState<Asking>();
  const answer = (sent: boolean) => {
    asking?.resolve(sent);
    setAsking(undefined);
  };
  const confirm = async (slug: string, level?: string) => {
    if (!asking) {
      return undefined;
    }
    const refused = await start(asking, slug, level);
    if (refused === undefined) {
      // Started, but the draft and its images stay until the start lands: they are its to clear.
      answer(false);
    }
    return refused;
  };
  return (
    <VStack gap={4}>
      <Composer
        images={draft.images}
        inputRef={inputRef}
        onChange={draft.setText}
        onImagesChange={draft.setImages}
        // The composer waits on the dialog: it started, or the human cancelled it.
        onSend={(sent, images) =>
          new Promise<boolean>((resolve) => setAsking({ images, resolve, text: sent }))
        }
        placeholder="Write Proposal"
        sendLabel="Start the feature"
        value={draft.text}
      />
      {asking && (
        <Suspense fallback={null}>
          <FeatureQuestion asking={asking} onCancel={() => answer(false)} onConfirm={confirm} />
        </Suspense>
      )}
    </VStack>
  );
}
