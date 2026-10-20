// The agent's offer as a card: a session made a change, with its proposal and slug to edit, or a
// change made a feature, with the agent's reason. The server starts or moves it, and refuses what
// it cannot do; the card shows the refusal under it.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { useSlugProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { useSettled } from "./NewChangePage.tsx";
import { addNote, type OfferKind, proposalTitle } from "./offers.ts";
import { FeatureView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

/** The session an offer moves: its ID, its change's folder for a feature's offer, and whether its agent works. */
export type OfferSession = { folder?: string; id: string; working: boolean };

/** Why a card's button waits while the session's agent works: a move sends the next run in it. */
const WORKING = "The agent is working";

/** The card's frame: its heading, named for the region, then its parts. */
function Frame({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section aria-label={title}>
      <Card padding={4}>
        <VStack gap={3}>
          <Heading level={3}>{title}</Heading>
          {children}
        </VStack>
      </Card>
    </section>
  );
}

/** The card's buttons, and why the main one waits, or why the server refused it, under them. */
function Actions({
  action,
  close,
  error,
  latest,
  session,
}: {
  action: { label: string; onClick: () => Promise<void> };
  close: { label: string; onClick: () => void };
  error: string | undefined;
  latest: boolean;
  session: OfferSession;
}) {
  if (!latest) {
    return null;
  }
  return (
    <>
      <HStack align="center" gap={2} wrap="wrap">
        <Button
          clickAction={action.onClick}
          isDisabled={session.working}
          label={action.label}
          variant="primary"
        />
        <Button label={close.label} onClick={close.onClick} variant="ghost" />
        {session.working && (
          <Text color="secondary" type="supporting">
            {WORKING}
          </Text>
        )}
      </HStack>
      {error && (
        <Text color="error" role="alert" type="supporting">
          {error}
        </Text>
      )}
    </>
  );
}

/** The slug field: the slug proposed for the proposal, until the human types one. */
function Slug({ onChange, proposal, typed }: SlugProps) {
  const proposed = useSlugProposal(useSettled(proposal));
  const slug = typed ?? proposed;
  return (
    <>
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={onChange}
        value={slug}
      />
      <Text color="secondary" type="supporting">
        This session goes on in the change’s worktree, on its own branch. The files it edited move
        there too.
      </Text>
    </>
  );
}

type SlugProps = { onChange: (slug: string) => void; proposal: string; typed: string | undefined };

/** "Start a change": the proposal and its slug, then "Start the change", which moves the session. */
function ChangeCard({ latest, onClose, proposal: given, session }: CardProps) {
  const fate = useFateClient();
  const [proposal, setProposal] = useState(given);
  const [typed, setTyped] = useState<string>();
  const [error, setError] = useState<string>();
  const start = async () => {
    setError(undefined);
    const text = proposal.trim();
    const slug = typed?.trim();
    const result = await runWrite({ label: "Starting the change…" }, () =>
      fate.mutations.session.toChange({
        input: { session: session.id, text, ...(slug ? { slug } : {}) },
        view: FeatureView,
      }),
    );
    if (result.error) {
      setError(refusal(result.error).message);
      return;
    }
    const started = result.result as { branch?: string | null; title?: string } | undefined;
    const title = started?.title || proposalTitle(text);
    addNote(session.id, {
      status: "info",
      title: `Started as the change ${title}, on ${started?.branch ?? "its branch"}`,
    });
    onClose();
  };
  return (
    <Frame title="Start a change">
      <TextArea label="Proposal" onChange={setProposal} rows={5} value={proposal} />
      <Suspense fallback={null}>
        <Slug onChange={setTyped} proposal={proposal} typed={typed} />
      </Suspense>
      <Actions
        action={{ label: "Start the change", onClick: start }}
        close={{ label: "Not now", onClick: onClose }}
        error={error}
        latest={latest}
        session={session}
      />
    </Frame>
  );
}

/** "Make this change a feature": the agent's reason, then "Make it a feature", in place. */
function FeatureCard({ latest, onClose, reason, session }: CardProps) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const promote = async () => {
    setError(undefined);
    const folder = session.folder ?? "";
    const result = await runWrite({ folder, label: "Making it a feature…" }, () =>
      fate.mutations.feature.promote({ input: { folder }, view: FeatureView }),
    );
    if (result.error) {
      setError(refusal(result.error).message);
      return;
    }
    const moved = result.result as { branch?: string | null; title?: string } | undefined;
    addNote(session.id, {
      status: "info",
      title: `Made the feature ${moved?.title ?? folder}, on ${moved?.branch ?? folder}`,
    });
    onClose();
  };
  return (
    <Frame title="Make this change a feature">
      {reason && <Text>{reason}</Text>}
      <Text color="secondary" type="supporting">
        Same branch and session, without change/, and its discovery starts next.
      </Text>
      <Actions
        action={{ label: "Make it a feature", onClick: promote }}
        close={{ label: "Keep it a change", onClick: onClose }}
        error={error}
        latest={latest}
        session={session}
      />
    </Frame>
  );
}

type CardProps = {
  latest: boolean;
  onClose: () => void;
  proposal: string;
  reason: string;
  session: OfferSession;
};

/**
 * The agent's offer, or the one the session's "…" opened: for a change, the proposal, `# Title`
 * first, and its slug; for a feature, the reason. Only the latest offer of a session has buttons,
 * which wait while the agent works; "Not now" closes it, and writes nothing.
 */
export function OfferCard({
  isLatest,
  kind,
  onClose,
  proposal = "",
  reason = "",
  session,
}: {
  isLatest: boolean;
  kind: OfferKind;
  onClose: () => void;
  proposal?: string;
  reason?: string;
  session: OfferSession;
}) {
  const props = { latest: isLatest, onClose, proposal, reason, session };
  return kind === "change" ? <ChangeCard {...props} /> : <FeatureCard {...props} />;
}
