// The agent's offer as a card: a session made a change, with its proposal and slug to edit, or a
// change made a feature, with the agent's reason. The server starts or moves it, and refuses what
// it cannot do; the card shows the refusal under it.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, Suspense, useCallback, useId, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { useSlugProposal } from "./data.ts";
import { refusal } from "./errors.ts";
import { keepsEnd } from "./following.ts";
import { useSettled } from "./NewChangePage.tsx";
import { addNote, type OfferKind, proposalTitle, returnFocus, useAsks } from "./offers.ts";
import { FeatureView } from "./views.ts";
import { Pane } from "./layout/Pane.tsx";
import { TextField } from "./fields/TextField.tsx";
import { StatusText } from "./fields/StatusText.tsx";

/** The session an offer moves: its ID, its change's folder for a feature's offer, and whether its agent works. */
export type OfferSession = { folder?: string; id: string; working: boolean };

/** Why a card's button waits while the session's agent works: a move sends the next run in it. */
const WORKING = "The agent is working";

/**
 * The card's pane's id, whose heading is focused each time the session's "…" asks for the card: at
 * once for the card it opened, `isOpened`, and at a later ask for the agent's.
 */
function useTakesFocus(session: string, isOpened: boolean): string {
  const asks = useAsks(session);
  const id = `offer-${useId().replaceAll(":", "")}`;
  const seen = useRef(isOpened ? -1 : asks);
  useEffect(() => {
    if (seen.current !== asks) {
      seen.current = asks;
      document.getElementById(`${id}-title`)?.focus();
    }
  }, [asks, id]);
  return id;
}

/** The card's frame: a pane titled by what it offers, named for the region, then its parts. */
function Frame({
  children,
  heading,
  title,
}: {
  children: ReactNode;
  heading: string;
  title: string;
}) {
  // Once, as it first draws: a card drawn at the session's end keeps the end in view.
  const frame = useCallback((element: HTMLElement | null) => {
    if (element) {
      keepsEnd(element);
    }
  }, []);
  return (
    <div ref={frame}>
      <Pane id={heading} level={3} title={title}>
        <VStack gap={3}>{children}</VStack>
      </Pane>
    </div>
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
        <StatusText role="alert" tone="error" type="supporting">
          {error}
        </StatusText>
      )}
    </>
  );
}

/** Reads the slug proposed for the proposal, and gives it to `onProposed`; draws nothing. */
function ProposedSlug({
  onProposed,
  proposal,
}: {
  onProposed: (slug: string) => void;
  proposal: string;
}) {
  const proposed = useSlugProposal(useSettled(proposal));
  useEffect(() => onProposed(proposed), [onProposed, proposed]);
  return null;
}

/**
 * The slug field and the line under it: the slug proposed for the proposal, until the human types
 * one. Drawn empty while the proposal's slug loads, so the card keeps its height and the session
 * opened at its end still shows the card's buttons.
 */
function SlugField({ onChange, value }: { onChange: (slug: string) => void; value: string }) {
  return (
    <>
      <TextInput
        description="Two words at most: it names the folder and the branch."
        label="Slug"
        onChange={onChange}
        value={value}
      />
      <Text color="secondary" type="supporting">
        This session goes on in the change’s worktree, on its own branch. The files it edited move
        there too.
      </Text>
    </>
  );
}

/** "Start a change": the proposal and its slug, then "Start the change", which moves the session. */
function ChangeCard({ heading, latest, onClose, proposal: given, session }: CardProps) {
  const fate = useFateClient();
  const [proposal, setProposal] = useState(given);
  const [typed, setTyped] = useState<string>();
  const [proposed, setProposed] = useState("");
  const [error, setError] = useState<string>();
  // One start at a time, from the button or Ctrl+Enter: a git write blocks the next (UI behaviour).
  const starting = useRef(false);
  const start = async () => {
    if (starting.current) {
      return;
    }
    starting.current = true;
    try {
      await startChange();
    } finally {
      starting.current = false;
    }
  };
  const startChange = async () => {
    setError(undefined);
    const text = proposal.trim();
    const slug = typed?.trim();
    const result = await fate.mutations.session.toChange({
      input: { session: session.id, text, ...(slug ? { slug } : {}) },
      view: FeatureView,
    });
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
    <Frame heading={heading} title="Start a change">
      <TextField
        kind="comment"
        label="Proposal"
        onChange={setProposal}
        onSubmit={latest && !session.working ? () => void start() : undefined}
        value={proposal}
      />
      <Suspense fallback={null}>
        <ProposedSlug onProposed={setProposed} proposal={proposal} />
      </Suspense>
      <SlugField onChange={setTyped} value={typed ?? proposed} />
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
function FeatureCard({ heading, latest, onClose, reason, session }: CardProps) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const promote = async () => {
    setError(undefined);
    const folder = session.folder ?? "";
    const result = await fate.mutations.feature.promote({ input: { folder }, view: FeatureView });
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
    <Frame heading={heading} title="Make this change a feature">
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
  heading: string;
  latest: boolean;
  onClose: () => void;
  proposal: string;
  reason: string;
  session: OfferSession;
};

/**
 * The agent's offer, or the one the session's "…" opened: for a change, the proposal, `# Title`
 * first, and its slug; for a feature, the reason. Only the latest offer of a session has buttons,
 * which wait while the agent works; "Not now" closes it, and writes nothing. Closed, or once its
 * move is made, it gives the focus back to the session's "…".
 */
export function OfferCard({
  isLatest,
  isOpened = false,
  kind,
  onClose,
  proposal = "",
  reason = "",
  session,
}: {
  isLatest: boolean;
  /** Whether the session's "…" opened it: it takes the focus as it draws. */
  isOpened?: boolean;
  kind: OfferKind;
  onClose: () => void;
  proposal?: string;
  reason?: string;
  session: OfferSession;
}) {
  const heading = useTakesFocus(session.id, isOpened);
  const close = () => {
    onClose();
    returnFocus(session.id);
  };
  const props = { heading, latest: isLatest, onClose: close, proposal, reason, session };
  return kind === "change" ? <ChangeCard {...props} /> : <FeatureCard {...props} />;
}
