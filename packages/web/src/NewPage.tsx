// The New page, behind the sidebar's "＋ New": a selector, in the URL, picks a session, a change,
// or a feature, each with its sentence and the steps that wait on the human. A session starts with
// its first message; a change from a typed text, an inbox note, or a priority line; a feature from
// a new title, a note, or a line, as a draft opened in the editor.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNavItem } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Composer } from "./Composer.tsx";
import { useInbox, usePriorities } from "./data.ts";
import { useTextField } from "./fields/useTextField.ts";
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

const styles = stylex.create({
  list: {
    listStyle: "none",
    margin: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: 0,
  },
});

/** What each kind is, and the steps that wait on the human, in order. */
const ABOUT: Record<NewKind, { steps: Array<{ icon: string; label: string }>; text: string }> = {
  change: {
    steps: [
      { icon: "uraeda:step-proposal", label: "Prompt" },
      { icon: "uraeda:step-questions", label: "Questions, if any" },
      { icon: "uraeda:step-pull-request", label: "Pull request" },
    ],
    text: "A bug fix or a small change, on its own branch. The agent asks only what it must, then opens a pull request.",
  },
  feature: {
    steps: [
      { icon: "uraeda:step-proposal", label: "Prompt" },
      { icon: "uraeda:step-questions", label: "Questions" },
      { icon: "uraeda:step-spec", label: "Spec" },
      { icon: "uraeda:step-pull-request", label: "Pull request" },
    ],
    text: "A larger piece of work, on its own branch. You answer its questions and approve its spec before any code.",
  },
  session: {
    steps: [],
    text: "A conversation with the agent, in the main checkout, like plain Claude Code. It offers a change when the work grows.",
  },
};

/** The kind's explanation, and its steps as a line of icons and arrows. */
function About({ kind }: { kind: NewKind }) {
  const { steps, text } = ABOUT[kind];
  return (
    <VStack gap={2}>
      <Text color="secondary">{text}</Text>
      {steps.length > 0 && (
        <HStack align="center" gap={2} wrap="wrap">
          {steps.map((step, index) => (
            <HStack align="center" gap={1} key={step.label}>
              {index > 0 && (
                <Text aria-hidden color="secondary">
                  →
                </Text>
              )}
              <Icon color="secondary" icon={step.icon} size="sm" />
              <Text type="supporting">{step.label}</Text>
            </HStack>
          ))}
        </HStack>
      )}
    </VStack>
  );
}

/** A note or a priority line to start from: its row opens it, and its button starts from it. */
type Line = { href: string; label: string; start: () => Promise<void>; text: string };

/**
 * The notes and the priority lines a change or a feature can start from: the notes that are not
 * a draft already, and the lines that have not started and link no other file than a draft.
 */
function useLines(starts: {
  fromLine: (entry: StartLine) => Promise<void>;
  fromNote: (note: StartNote) => Promise<void>;
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
          <li key={line.href}>
            <SideNavItem
              actions={
                // Its name says which line: the buttons share their visible text.
                <Button
                  clickAction={line.start}
                  label={`${action}: ${line.text}`}
                  size="sm"
                  variant="secondary"
                >
                  {action}
                </Button>
              }
              href={line.href}
              label={line.label}
            />
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
      {starts.error && <Banner collapsible={false} status="error" title={starts.error} />}
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
  const write = async () => {
    const text = title.text.trim();
    await starts.feature.fromTitle(text);
    if (title.unsavedNow()?.text.trim() === text) {
      title.discard();
    }
  };
  return (
    <>
      <HStack align="end" gap={2}>
        <TextInput label="Title" onChange={title.change} value={title.text} />
        <Button clickAction={write} isDisabled={!title.text.trim()} label="Write the proposal" />
      </HStack>
      {starts.error && <Banner collapsible={false} status="error" title={starts.error} />}
      <Lines action="Open the draft" lines={lines} />
    </>
  );
}

/** The New page: the selector, then what the kind picked asks for. */
export function NewPage({ kind }: { kind: NewKind }) {
  useRestoreScroll(true);
  const here = useRepoPath();
  return (
    <Page>
      <VStack gap={4}>
        <Heading level={1}>New</Heading>
        <SegmentedControl
          label="What to start"
          // The kind is the address's: Back leaves the page, not the kind.
          onChange={(value: string) =>
            redirect(here(value === "session" ? "/new" : `/new?kind=${value}`))
          }
          value={kind}
        >
          <SegmentedControlItem label="Session" value="session" />
          <SegmentedControlItem label="Change" value="change" />
          <SegmentedControlItem label="Feature" value="feature" />
        </SegmentedControl>
        <About kind={kind} />
        {kind === "session" && <NewSession />}
        {kind === "change" && <ChangePart />}
        {kind === "feature" && <FeaturePart />}
      </VStack>
    </Page>
  );
}
