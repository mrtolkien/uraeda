// A draft or a proposal's page, laid out as a terminal tool would: the title, one line of what it
// is, its research effort, then the text in a pane, and, for a draft, a Start pane beside it. Every
// action has a key, which the status line names: `i` edits, Escape leaves the field, `r` sets the
// research effort, `f` and `c` pick a feature or a change, and `s` goes to the slug, where Enter
// starts it, as Ctrl+Enter does in the text. A proposal's `s` saves.
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { useDraft } from "./data.ts";
import { DraftStart, type StartKind } from "./DraftStart.tsx";
import { DraftText } from "./DraftText.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { useKeys } from "./keys/registry.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Missing } from "./layout/Missing.tsx";
import { Page } from "./layout/Page.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { ConflictBanner } from "./pane/DraftEditor.tsx";
import { useDraftEditor } from "./pane/useDraftEditor.ts";
import { currentEntry, useRestoreScroll } from "./routes.tsx";

const styles = stylex.create({
  // The text beside its Start, on a wide screen; the text alone, or stacked, elsewhere.
  columns: {
    alignItems: "start",
    display: "grid",
    gap: spacingVars["--spacing-4"],
    gridTemplateColumns: "minmax(0, 2fr) minmax(22rem, 1fr)",
  },
  stacked: { display: "flex", flexDirection: "column", gap: spacingVars["--spacing-4"] },
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

type Draft = NonNullable<ReturnType<typeof useDraft>>;

/** The title, and under it one line: the file, the priorities' section it is in, and its state. */
function EditorHeading({ draft, path }: { draft: Draft; path: string }) {
  const parts = [
    path.replace(/^specs\//, ""),
    ...(draft.entry ? [SECTIONS[draft.entry.section] ?? draft.entry.section] : []),
    draft.committed ? "committed" : "not committed",
  ];
  return <PageTitle meta={{ text: parts.join(" · ") }}>{draft.title}</PageTitle>;
}

/** "Research effort", and its picker, for a proposal that has one in its frontmatter. */
function ResearchEffort({
  draft,
  onChange,
  value,
}: {
  draft: Draft;
  onChange: (level: string) => void;
  /** The level shown: the one just picked, while its write is on its way. */
  value: string;
}) {
  return (
    <HStack align="center" gap={3} wrap="wrap">
      <Text color="secondary">Research effort</Text>
      <SegmentedControl label="Research effort" onChange={onChange} value={value}>
        {draft.discoveryLevels.map((level) => (
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
 * A draft or a proposal: drawn once written, edited as text, with the template's guidance for each
 * empty section; saved with Save or Ctrl+Enter over the version it was read at, its unsaved text
 * kept until then, committed, and, for a draft, started as a feature or a change.
 */
export function EditorPage({ path }: { path: string }) {
  const draft = useDraft(path);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const slug = useTextField(`${path}#slug`, draft?.slug ?? "");
  const editor = useDraftEditor({ draft, isDrawnFirst: false, path, slug });
  const isWide = useWidthClass() === "wide";
  const box = useRef<HTMLDivElement>(null);
  const slugBox = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<StartKind>("feature");
  const isDraft = draft?.kind === "draft";

  const edit = () => {
    editor.setDrawn(false);
    focusSoon(() => box.current?.querySelector("textarea"));
  };
  // A draft just made opens with the focus in its text, once: Back to it later does not take it.
  const takesFocus = useRef(currentEntry().focus === "text");
  useEffect(() => {
    if (takesFocus.current && draft) {
      takesFocus.current = false;
      window.history.replaceState({ ...currentEntry(), focus: undefined }, "");
      edit();
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, as the draft is read
  }, [draft]);
  // What is drawn is the saved text: unsaved words are saved first.
  const preview = () => {
    editor.saveText();
    editor.setDrawn(true);
  };
  const focusSlug = () => focusSoon(() => slugBox.current?.querySelector("input"));
  // The effort picked shows at once, and the file's follows: it goes back to the file's once the
  // file says the same, or the write was refused.
  const [chosen, setChosen] = useState<string>();
  const failed = editor.conflict !== undefined || editor.actions.message?.ok === false;
  useEffect(() => {
    if (chosen !== undefined && (draft?.discovery === chosen || failed)) {
      setChosen(undefined);
    }
  }, [chosen, draft?.discovery, failed]);
  const level = chosen ?? draft?.discovery ?? undefined;
  const setLevel = (to: string) => {
    setChosen(to);
    void editor.actions.setDiscovery(to);
  };
  // Starts it as the kind picked: the branch and worktree, then its session, saved text first.
  const startNow = () => void editor.actions.start(true, kind);
  const levels = draft?.discoveryLevels ?? [];
  const cycle = () => {
    const next = levels[(levels.indexOf(level ?? "") + 1) % levels.length];
    if (next !== undefined) {
      setLevel(next);
    }
  };
  useKeys(
    draft
      ? [
          { hint: "i", keys: "i", label: "edit", run: edit },
          ...(editor.drawn ? [] : [{ hint: "p", keys: "p", label: "preview", run: preview }]),
          ...(draft.discovery == null
            ? []
            : [{ hint: "r", keys: "r", label: "research", run: cycle }]),
          ...(isDraft
            ? [
                { hint: "f", keys: "f", label: "feature", run: () => setKind("feature") },
                { hint: "c", keys: "c", label: "change", run: () => setKind("change") },
              ]
            : []),
          // Last, in the order of use: a draft's `s` brings the focus to the slug, and Ctrl+Enter
          // starts it, in the text field too, which has its own; a proposal has no slug, and its
          // `s` saves.
          ...(isDraft
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

  if (!draft) {
    return (
      <Page>
        <Missing title={`No draft ${path}.`} />
      </Page>
    );
  }
  const message = editor.actions.message;
  return (
    <Page>
      <VStack gap={4}>
        <EditorHeading draft={draft} path={path} />
        <ConflictBanner editor={editor} />
        {level !== undefined && <ResearchEffort draft={draft} onChange={setLevel} value={level} />}
        <div {...stylex.props(isDraft && isWide ? styles.columns : styles.stacked)}>
          <DraftText
            boxRef={box}
            draft={draft}
            editor={editor}
            onEdit={edit}
            onSubmit={isDraft ? startNow : editor.saveText}
            path={path}
          />
          {isDraft && (
            <DraftStart
              actions={editor.actions}
              kind={kind}
              onKind={setKind}
              slug={slug}
              slugRef={slugBox}
            />
          )}
        </div>
        {message && (
          <AnnouncedBanner
            collapsible={false}
            status={message.ok ? "success" : "error"}
            title={message.text}
          />
        )}
      </VStack>
    </Page>
  );
}
