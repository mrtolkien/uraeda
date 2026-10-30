// A proposal file's page, or a started proposal's, laid out as a terminal tool would: the title,
// one line of what it is, its research effort, then the text in a pane, and, for a proposal file, a
// Start pane beside it, or under it; on the phone, in a sheet that the bottom bar's Start opens. Every action has a key, which the status line names: `i` edits, Escape
// leaves the field, `r` sets the research effort, `f` and `c` pick a feature or a change, and `s`
// goes to the slug, where Enter starts it, as Ctrl+Enter does in the text. A started proposal's `s`
// saves.
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { useProposalFile } from "./data.ts";
import { ProposalStart, START_SHEETS, StartBar, type StartKind } from "./ProposalStart.tsx";
import { ProposalText } from "./ProposalText.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { useKeys } from "./keys/registry.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Missing } from "./layout/Missing.tsx";
import { Page } from "./layout/Page.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useSheetTab } from "./layout/useSheetTab.ts";
import { ConflictBanner } from "./pane/ProposalEditor.tsx";
import { useProposalEditor } from "./pane/useProposalEditor.ts";
import { currentEntry, useRestoreScroll } from "./routes.tsx";

const styles = stylex.create({
  // The text beside its Start, on a wide screen, where both fit: the text wide enough for a
  // formatted file's 100 columns, which then do not wrap again, and Start the rest; Start under it
  // where they do not. A line longer than that, a paragraph typed without breaks, still wraps.
  columns: {
    // Each pane at the row's start, not centred in its own room: under the text, Start keeps its
    // edges.
    "--pane-centre": "0",
    alignItems: "start",
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-4"],
  },
  stacked: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-4"] },
  start: { flex: "1 1 22rem", minWidth: 0 },
  text: { flex: "0 1 var(--size-code)", minWidth: 0 },
});

const SECTIONS: Record<string, string> = {
  blocked: "Blocked",
  later: "Later",
  next: "Next",
  now: "Now",
};

/** A discovery effort as the control shows it: `medium` is Medium. */
function levelLabel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

type File = NonNullable<ReturnType<typeof useProposalFile>>;

/** The title, and under it one line: the file, the priorities' section it is in, and its state. */
function EditorHeading({ file, path }: { file: File; path: string }) {
  const parts = [
    path.replace(/^specs\//, ""),
    ...(file.proposal ? [SECTIONS[file.proposal.section] ?? file.proposal.section] : []),
    file.committed ? "committed" : "not committed",
  ];
  return <PageTitle meta={{ text: parts.join(" · ") }}>{file.title}</PageTitle>;
}

/** "Research effort", and its picker, for a proposal that has one in its frontmatter. */
function ResearchEffort({
  file,
  onChange,
  value,
}: {
  file: File;
  onChange: (level: string) => void;
  /** The level shown: the one just picked, while its write is on its way. */
  value: string;
}) {
  return (
    <HStack align="center" gap={3} wrap="wrap">
      <Text color="secondary">Research effort</Text>
      <SegmentedControl label="Research effort" onChange={onChange} value={value}>
        {file.discoveryLevels.map((level) => (
          <SegmentedControlItem key={level} label={levelLabel(level)} value={level} />
        ))}
      </SegmentedControl>
    </HStack>
  );
}

/** Calls `focus` on the next frames until the element it finds is there: a field that mounts late. */
function focusSoon(find: () => HTMLElement | null | undefined) {
  let tries = 0;
  const attempt = () => {
    const element = find();
    if (element) {
      element.focus();
    } else if (tries++ < 20) {
      requestAnimationFrame(attempt);
    }
  };
  requestAnimationFrame(attempt);
}

/**
 * The page's keys, which the status line names: `i` edits, `p` previews, `r` picks the next
 * research effort, `f` and `c` pick a feature or a change, and a proposal file's `s` goes to the
 * slug, where Ctrl+Enter starts it; a started proposal's `s` saves.
 */
function useEditorKeys(
  file: File | undefined,
  {
    edit,
    editor,
    focusSlug,
    level,
    preview,
    setKind,
    setLevel,
    startNow,
  }: {
    edit: () => void;
    editor: ReturnType<typeof useProposalEditor>;
    focusSlug: () => void;
    level: string | undefined;
    preview: () => void;
    setKind: (kind: StartKind) => void;
    setLevel: (to: string) => void;
    startNow: () => void;
  },
) {
  const isFile = file?.kind === "proposal-file";
  const levels = file?.discoveryLevels ?? [];
  const cycle = () => {
    const next = levels[(levels.indexOf(level ?? "") + 1) % levels.length];
    if (next !== undefined) {
      setLevel(next);
    }
  };
  useKeys(
    file
      ? [
          { hint: "i", keys: "i", label: "edit", run: edit },
          ...(editor.drawn ? [] : [{ hint: "p", keys: "p", label: "preview", run: preview }]),
          ...(file.discovery == null || file.kind === "note-file"
            ? []
            : [{ hint: "r", keys: "r", label: "research", run: cycle }]),
          ...(isFile
            ? [
                { hint: "f", keys: "f", label: "feature", run: () => setKind("feature") },
                { hint: "c", keys: "c", label: "change", run: () => setKind("change") },
              ]
            : []),
          // Last, in the order of use: a proposal file's `s` brings the focus to the slug, and
          // Ctrl+Enter starts it, in the text field too, which has its own; a started proposal has
          // no slug, and its `s` saves.
          ...(isFile
            ? [
                { hint: "s", keys: "s", label: "slug", run: focusSlug },
                { hint: "⌃⏎", keys: "mod+Enter", label: "start", run: startNow },
              ]
            : editor.field.dirty
              ? [{ hint: "s", keys: "s", label: "save", run: editor.saveText }]
              : []),
        ]
      : [],
  );
}

/**
 * The research effort shown, and what sets it: the one picked shows at once, and the file's
 * follows, going back to the file's once the file says the same, or the write was refused, as the
 * page draws. A note file has none: it is not started, it moves to the proposals first.
 */
function useResearchEffort(
  file: File | undefined,
  editor: ReturnType<typeof useProposalEditor>,
): [string | undefined, (to: string) => void] {
  const [chosen, setChosen] = useState<string>();
  const failed = editor.conflict !== undefined || editor.actions.message?.ok === false;
  if (chosen !== undefined && (file?.discovery === chosen || failed)) {
    setChosen(undefined);
  }
  const level = file?.kind === "note-file" ? undefined : (chosen ?? file?.discovery ?? undefined);
  const setLevel = (to: string) => {
    setChosen(to);
    void editor.actions.setDiscovery(to);
  };
  return [level, setLevel];
}

/**
 * A proposal file, a started proposal, or a note file: edited as text, drawn by its preview, with
 * the template's guidance for each empty section; saved with Save or Ctrl+Enter over the version it
 * was read at, its unsaved text kept until then, committed, and, for a proposal file, started as a
 * feature or a change. A note file has no research effort.
 */
export function EditorPage({ path }: { path: string }) {
  const file = useProposalFile(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const slug = useTextField(`${path}#slug`, file?.slug ?? "");
  const editor = useProposalEditor({ file, path, slug });
  const width = useWidthClass();
  const isWide = width === "wide";
  const box = useRef<HTMLDivElement>(null);
  const slugBox = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<StartKind>("feature");
  const isFile = file?.kind === "proposal-file";
  // On the phone, a proposal file's Start is a sheet.
  const inSheet = isFile && isNarrow(width);
  const sheet = useSheetTab(START_SHEETS, inSheet);
  const edit = () => {
    editor.setDrawn(false);
    focusSoon(() => box.current?.querySelector("textarea"));
  };
  // A proposal file just made opens with the focus in its text, once: Back to it later does not
  // take it.
  const takesFocus = useRef(currentEntry().focus === "text");
  useEffect(() => {
    if (takesFocus.current && file) {
      takesFocus.current = false;
      window.history.replaceState({ ...currentEntry(), focus: undefined }, "");
      edit();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, as the file is read
  }, [file]);
  // What is drawn is the saved text: unsaved words are saved first.
  const preview = () => {
    editor.saveText();
    editor.setDrawn(true);
  };
  const focusSlug = () => {
    if (inSheet) {
      sheet[1]("start");
    }
    focusSoon(() => slugBox.current?.querySelector("input"));
  };
  const [level, setLevel] = useResearchEffort(file, editor);
  // Starts it as the kind picked, saved text first: its session opens as the start is planned.
  const startNow = () => void editor.actions.start(kind);
  useEditorKeys(file, { edit, editor, focusSlug, level, preview, setKind, setLevel, startNow });
  if (!file) {
    return (
      <Page kind="rows">
        <Missing title={`No file ${path}.`} />
      </Page>
    );
  }
  const message = editor.actions.message;
  const start = (
    <ProposalStart
      actions={editor.actions}
      kind={kind}
      onKind={setKind}
      slug={slug}
      slugRef={slugBox}
    />
  );
  const banner = message && (
    <AnnouncedBanner
      collapsible={false}
      status={message.ok ? "success" : "error"}
      title={message.text}
    />
  );
  return (
    <Page kind="code">
      <VStack gap={4}>
        <EditorHeading file={file} path={path} />
        <ConflictBanner editor={editor} />
        {level !== undefined && <ResearchEffort file={file} onChange={setLevel} value={level} />}
        <div {...stylex.props(isFile && isWide ? styles.columns : styles.stacked)}>
          <div {...stylex.props(isFile && isWide && styles.text)}>
            <ProposalText
              boxRef={box}
              editor={editor}
              file={file}
              onEdit={edit}
              onSubmit={isFile ? startNow : editor.saveText}
              path={path}
            />
          </div>
          {isFile && !inSheet && <div {...stylex.props(isWide && styles.start)}>{start}</div>}
        </div>
        {banner}
      </VStack>
      {inSheet && <StartBar message={banner} onStart={focusSlug} sheet={sheet} start={start} />}
    </Page>
  );
}
