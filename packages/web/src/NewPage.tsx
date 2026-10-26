// The New page, behind the sidebar's "＋ New": three cards, in the URL, pick a session, a change, or
// a feature, each saying what it ends with and what waits on the human. A session starts with
// its first message; a change from a typed text, an inbox note, or a priority line; a feature from
// a new title, a note, or a line, as a draft opened in the editor.
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import { Composer } from "./Composer.tsx";
import { useInbox, usePriorities } from "./data.ts";
import { useTextField } from "./fields/useTextField.ts";
import { useKeys } from "./keys/registry.tsx";
import { KindCards } from "./KindCards.tsx";
import { Page } from "./layout/Page.tsx";
import { NewChange } from "./NewChangePage.tsx";
import {
  type NewKind,
  navigate,
  redirect,
  sessionIdPath,
  useRepoPath,
  useRestoreScroll,
} from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { composerDraft, useDraft } from "./useDraft.ts";
import { type StartLine, type StartNote, useStartFrom } from "./useStartFrom.ts";
import { PageTitle } from "./layout/PageTitle.tsx";

const styles = stylex.create({
  // The button keeps its text whole; the line's text wraps beside it.
  action: { flexShrink: 0 },
  // As tall as its button: a finger's 44 px under a coarse pointer.
  line: { paddingBlock: spacingVars["--spacing-1"] },
  link: { alignItems: "center", display: "flex", minHeight: sizeVars["--size-element-sm"] },
  list: {
    listStyle: "none",
    margin: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: 0,
  },
});

/** A note or a priority line to start from: its row opens it, and its button starts from it. */
type Line = { href: string; label: string; start: () => Promise<unknown>; text: string };

/**
 * The notes and the priority lines a change or a feature can start from: the notes that are not
 * a draft already, and the lines that have not started and link no other file than a draft.
 */
function useLines(starts: {
  fromLine: (entry: StartLine) => Promise<unknown>;
  fromNote: (note: StartNote) => Promise<unknown>;
}): Array<Line> {
  const here = useRepoPath();
  const inbox = useInbox();
  const priorities = usePriorities();
  const notes = (inbox?.categories ?? [])
    .flatMap((category) => category.notes)
    .filter((note) => note.draft === undefined)
    .map((note) => ({
      href: here(`/inbox/${note.key}`),
      label: `Inbox · ${plain(note.spans)}`,
      start: () => starts.fromNote(note),
      text: plain(note.spans),
    }));
  const lines = (priorities?.sections ?? [])
    .flatMap((section) => section.entries)
    .filter((entry) => !entry.running && (entry.draft || !entry.spans.some((span) => span.link)))
    .map((entry) => ({
      href: here(`/priorities/${entry.key}`),
      label: `Priorities · ${plain(entry.spans)}`,
      start: () => starts.fromLine(entry),
      text: plain(entry.spans),
    }));
  return [...notes, ...lines];
}

/** The notes and lines to start from, each with its button, `action`. */
function Lines({ action, lines }: { action: string; lines: Array<Line> }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <VStack gap={1}>
      <Text id="new-lines" type="label">
        Or start from a note or a priority
      </Text>
      <ul aria-labelledby="new-lines" {...stylex.props(styles.list)}>
        {lines.map((line) => (
          <li key={line.href} {...stylex.props(styles.line)}>
            {/* The whole text, wrapped on a phone rather than cut. */}
            <HStack align="center" gap={2} justify="between">
              <Link href={line.href} xstyle={styles.link}>
                {line.label}
              </Link>
              {/* Its name says which line: the buttons share their visible text. */}
              <span {...stylex.props(styles.action)}>
                <Button
                  clickAction={line.start}
                  label={`${action}: ${line.text}`}
                  size="sm"
                  variant="secondary"
                >
                  {action}
                </Button>
              </span>
            </HStack>
          </li>
        ))}
      </ul>
    </VStack>
  );
}

/** Session: the composer, whose first message starts the session and opens it. */
function NewSession() {
  const here = useRepoPath();
  const draft = useDraft();
  return (
    <Composer
      {...composerDraft(draft)}
      onSent={(id) => navigate(here(sessionIdPath(id)), { created: true })}
    />
  );
}

/** Change: the composer and its slug, then the notes and lines. */
function ChangePart() {
  const starts = useStartFrom();
  const lines = useLines(starts.change);
  return (
    <>
      <NewChange />
      {starts.error && <AnnouncedBanner collapsible={false} status="error" title={starts.error} />}
      <Lines action="Start the change" lines={lines} />
    </>
  );
}

/** Feature: a title for a new proposal, then the notes and lines to draft. */
function FeaturePart() {
  const starts = useStartFrom();
  const lines = useLines(starts.feature);
  // Kept as a new change's text is: leaving the page does not ask.
  const title = useTextField("new-feature", "", { drawn: false });
  // `i` brings the focus to the title, as the composer's `i` does for the other kinds.
  const field = useRef<HTMLInputElement>(null);
  useKeys([{ keys: "i", label: "Write the title", run: () => field.current?.focus() }]);
  const write = async () => {
    const text = title.text.trim();
    // A refused title stays, to change and write again.
    if ((await starts.feature.fromTitle(text)) && title.unsavedNow()?.text.trim() === text) {
      title.discard();
    }
  };
  return (
    <>
      {/* On the phone, the button goes under the field rather than squeezing its text. */}
      <HStack align="end" gap={2} wrap="wrap">
        <TextInput label="Title" onChange={title.change} ref={field} value={title.text} />
        <Button clickAction={write} isDisabled={!title.text.trim()} label="Write the proposal" />
      </HStack>
      {starts.error && <AnnouncedBanner collapsible={false} status="error" title={starts.error} />}
      <Lines action="Open the draft" lines={lines} />
    </>
  );
}

/** The New page: the cards, then what the kind picked asks for. */
export function NewPage({ kind }: { kind: NewKind }) {
  useRestoreScroll(true);
  const here = useRepoPath();
  return (
    <Page>
      <VStack gap={4}>
        <PageTitle>New</PageTitle>
        <KindCards
          kind={kind}
          // The kind is the address's: Back leaves the page, not the kind.
          onPick={(picked) => redirect(here(picked === "session" ? "/new" : `/new?kind=${picked}`))}
        />
        {kind === "session" && <NewSession />}
        {kind === "change" && <ChangePart />}
        {kind === "feature" && <FeaturePart />}
      </VStack>
    </Page>
  );
}
