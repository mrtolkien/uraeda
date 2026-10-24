// A round waiting for answers beside its column: on wide and semi-wide screens, the document's
// column of Outline, Notes, and, for a feature whose agent can be asked, Session; on the phone, the
// status line's count, Notes, and Next or Submit, the count and Notes each opening a sheet.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type ReactNode, Suspense, useState } from "react";
import type { Document, RoundItems } from "uraeda-binding";
import { ColumnSession } from "./ColumnSession.tsx";
import type { useFile } from "./data.ts";
import { type ColumnTab, DocumentColumn, useColumnTab } from "./layout/DocumentColumn.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import {
  NOTES_FIELD,
  NotesField,
  NotesSheet,
  useNotesDrop,
  type useRoundNotes,
} from "./RoundNotes.tsx";
import { NextOrSubmit, OutlineSheet, RoundOutline, useBlankKeys } from "./RoundOutline.tsx";
import type { NavQuestion } from "./roundJump.ts";
import { askAbout, quoted, withQuote } from "./sessions.ts";
import type { Draft } from "./useDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The phone's sheet open over the round, if any. */
export type RoundSheet = "outline" | "notes" | undefined;

/** The column's tabs, by their keys in the address: Session only where the agent can be asked. */
export function columnKeys(asks: boolean) {
  return asks ? ["outline", "notes", "session"] : ["outline", "notes"];
}

/**
 * What the round's page does from its parts: the phone's open sheet, `sheet`; asking the agent
 * about a question or a point, with `draft`, the session's composer kept by the page, when the
 * agent can be asked; and opening the notes' field. Asking writes the quote into the composer,
 * in place of the one it held, and opens the Session tab; on the phone, it opens the session's
 * page. "Edit notes" opens the Notes tab, or the phone's sheet, its field focused.
 */
export function useRoundActions(file: File, draft: Draft | undefined) {
  const wide = !isNarrow(useWidthClass());
  const [, setTab] = useColumnTab(columnKeys(draft !== undefined));
  const sheet = useState<RoundSheet>();
  const ask = (quote: string) => {
    if (!wide) {
      askAbout(file.folder, quote);
      return;
    }
    draft?.setText((now) => withQuote(now, quote));
    setTab("session");
  };
  const editNotes = () => {
    if (wide) {
      setTab("notes");
    } else {
      sheet[1]("notes");
    }
    requestAnimationFrame(() => document.getElementById(NOTES_FIELD)?.focus());
  };
  const asks = draft && {
    point: (subject: string) => ask(quoted(`About the settled point of ${file.path}:`, [subject])),
    question: (question: { id: string; title: string }) =>
      ask(quoted(`About ${question.id} of ${file.path}:`, [question.title])),
  };
  return { asks, editNotes, sheet };
}

/**
 * The round, `content`, with its column, named "The round's column". `nav` is its questions in the
 * page's order, `notes` its notes, which the Notes tab and the phone's sheet both write, and
 * `draft` the session's composer, kept by the page, with which the column has a Session tab.
 * `onSubmit` takes the page to its end. `actions` are the page's, `useRoundActions`': the phone's
 * open sheet, and how the notes open. `n` and `p` jump between blank questions on wide screens,
 * whatever the open tab. An image dropped with no field focused goes to the notes, opening them.
 */
export function RoundColumn({
  actions,
  content,
  draft,
  file,
  nav,
  notes,
  onSubmit,
}: {
  actions: ReturnType<typeof useRoundActions>;
  content: ReactNode;
  draft: Draft | undefined;
  file: File;
  nav: ReadonlyArray<NavQuestion>;
  notes: ReturnType<typeof useRoundNotes>;
  onSubmit: () => void;
}) {
  const wide = !isNarrow(useWidthClass());
  useBlankKeys(nav, wide);
  const [sheet] = actions.sheet;
  const [tab] = useColumnTab(columnKeys(draft !== undefined));
  const queued = useNotesDrop({
    onOpen: actions.editNotes,
    shown: wide ? tab === "notes" : sheet === "notes",
    takes: file.takesImages,
  });
  const round = file.current.items.clarifications;
  const document = file.current.document;
  if (!round) {
    return content;
  }
  const notesField = (
    <NotesField notes={notes} path={file.path} queued={queued} takes={file.takesImages} />
  );
  const tabs: Array<ColumnTab> = [
    {
      icon: "uraeda:list",
      key: "outline",
      label: "Outline",
      panel: (
        <RoundOutline
          document={document}
          isActive={wide}
          onSubmit={onSubmit}
          questions={nav}
          round={round}
        />
      ),
    },
    { icon: "uraeda:pencil", key: "notes", label: "Notes", panel: notesField },
  ];
  if (draft) {
    tabs.push({
      icon: "uraeda:comment",
      key: "session",
      label: "Session",
      panel: (
        <Suspense fallback={null}>
          <ColumnSession draft={draft} folder={file.folder} />
        </Suspense>
      ),
    });
  }
  return (
    <>
      <DocumentColumn content={content} label="The round's column" tabs={tabs} />
      {!wide && (
        <PhoneParts
          nav={nav}
          notesField={notesField}
          onSubmit={onSubmit}
          round={{ document, round }}
          sheet={actions.sheet}
        />
      )}
    </>
  );
}

/**
 * On the phone, the round's parts outside its page: the status line's count, Notes, and Next or
 * Submit, the count opening the outline's sheet, and Notes the notes' sheet, over `notesField`.
 */
function PhoneParts({
  nav,
  notesField,
  onSubmit,
  round: { document, round },
  sheet: [sheet, setSheet],
}: {
  nav: ReadonlyArray<NavQuestion>;
  notesField: ReactNode;
  onSubmit: () => void;
  round: { document: Document; round: RoundItems };
  sheet: ReturnType<typeof useRoundActions>["sheet"];
}) {
  const close = () => setSheet(undefined);
  const answered = nav.filter((q) => q.answered).length;
  return (
    <>
      <TopBarSlot>
        <HStack align="center" gap={1}>
          <Button
            label={`${answered}/${nav.length}`}
            onClick={() => setSheet("outline")}
            variant="ghost"
          />
          <Button
            icon={<Icon icon="uraeda:pencil" />}
            label="Notes"
            onClick={() => setSheet("notes")}
            variant="ghost"
          />
          <NextOrSubmit onSubmit={onSubmit} questions={nav} />
        </HStack>
      </TopBarSlot>
      <OutlineSheet
        document={document}
        isOpen={sheet === "outline"}
        onClose={close}
        questions={nav}
        round={round}
      />
      <NotesSheet isOpen={sheet === "notes"} onClose={close}>
        {notesField}
      </NotesSheet>
    </>
  );
}
