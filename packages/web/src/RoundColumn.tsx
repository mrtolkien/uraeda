// A round waiting for answers beside its column: on wide and semi-wide screens, the document's
// column of Outline, Notes, and, for a feature whose agent can be asked, Session; on the phone, the
// same parts in the bottom bar, each opening a sheet, then Next or Submit.
import type { ReactNode } from "react";
import { useFateClient } from "react-fate";
import type { Document, RoundItems } from "uraeda-binding";
import { focusOnceDrawn, sessionTab, useColumnAsk } from "./ColumnSession.tsx";
import { type useFile, useAgent } from "./data.ts";
import { ColumnStatusLine } from "./layout/ColumnStatusLine.tsx";
import { NavTile, NavTiles } from "./layout/NavBar.tsx";
import { type ColumnPanel, DocumentColumn, useColumnTab } from "./layout/DocumentColumn.tsx";
import { useDocumentColumnWidth } from "./layout/documentColumnWidth.ts";
import { type SheetState, useSheetTab } from "./layout/useSheetTab.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { NOTES_FIELD, NotesField, useNotesDrop, type useRoundNotes } from "./RoundNotes.tsx";
import { NextTile, OutlineSheetPanel, RoundOutline, useBlankKeys } from "./RoundOutline.tsx";
import type { NavQuestion } from "./roundJump.ts";
import { quoted, sendMessage } from "./sessions.ts";
import type { Draft } from "./useDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The phone's sheets' names, by their keys in the address: `?tab=notes`, `?tab=outline`. */
const SHEETS = { notes: "Notes", outline: "Outline" } as const;

/** The phone's sheets where the agent can be asked: Session's too, `?tab=session`. */
const SESSION_SHEETS = { ...SHEETS, session: "Session" } as const;

/** The column's tabs, by their keys in the address: Session only where the agent can be asked. */
function columnKeys(asks: boolean) {
  return asks ? ["outline", "notes", "session"] : ["outline", "notes"];
}

/**
 * What the round's page does from its parts: the phone's open sheet, `sheet`; asking the agent
 * about a question, with `draft`, the feature's session draft, when the agent can be asked, or about
 * a point, with a comment's text; and opening the notes' field. Asking about a question writes the
 * quote into the composer, in place of the one it held, and opens the Session tab, its composer
 * focused; on the phone, it opens the session's page. Asking about a point sends its quote and the
 * text to the feature's session at once, then opens the Session tab on wide screens. "Edit notes" opens the Notes tab, or the phone's sheet, its field
 * focused. Both unfold the column the human folded (R23): `column` is its width and fold, which
 * the page holds. `notesShown` says whether the notes' field is drawn, and `sessionShown` the
 * session's composer.
 */
export function useRoundActions(file: File, draft: Draft | undefined) {
  const wide = !isNarrow(useWidthClass());
  const column = useDocumentColumnWidth();
  const [tab, setTab] = useColumnTab(columnKeys(draft !== undefined));
  const sheet = useSheetTab(draft ? SESSION_SHEETS : SHEETS, !wide);
  const openTab = (key: string) => {
    column.setShown(true);
    setTab(key);
  };
  const ask = useColumnAsk(file.folder, draft);
  const fate = useFateClient();
  const editNotes = () => {
    if (wide) {
      openTab("notes");
    } else {
      sheet[1]("notes");
    }
    focusOnceDrawn(() => document.getElementById(NOTES_FIELD));
  };
  const asks = draft && {
    point: async (subject: string, text: string) => {
      const header = quoted(`About the settled point of ${file.path}:`, [subject]);
      const sent = await sendMessage(fate, { folder: file.folder, text: `${header}\n\n${text}` });
      if (!sent.ok) {
        return sent.message;
      }
      if (wide) {
        openTab("session");
      }
      return undefined;
    },
    question: (question: { id: string; title: string }) =>
      ask(quoted(`About ${question.id} of ${file.path}:`, [question.title])),
  };
  const open = (key: string) => (wide ? column.isShown && tab === key : sheet[0] === key);
  return {
    asks,
    column,
    editNotes,
    notesShown: open("notes"),
    sessionShown: wide && open("session"),
    sheet,
  };
}

/**
 * The round, `content`, with its column, named "The round's column". `nav` is its questions in the
 * page's order, `notes` its notes, which the Notes tab and the phone's sheet both write, and
 * `draft` the feature's session draft, with which the column has a Session tab.
 * `onSubmit` takes the page to its end. `actions` are the page's, `useRoundActions`': the phone's
 * open sheet, and how the notes open. `n` and `p` jump between blank questions at every width,
 * whatever the open tab. An image dropped with no field focused goes to the notes, opening them,
 * unless the Session tab shows its composer, which takes it.
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
  const agent = useAgent();
  useBlankKeys(nav);
  // With Session shown, an image dropped goes to its composer, never to the notes.
  const queued = useNotesDrop({
    onOpen: actions.editNotes,
    shown: actions.notesShown,
    takes: file.takesImages && !actions.sessionShown,
  });
  const round = file.current.items.clarifications;
  const document = file.current.document;
  if (!round) {
    return content;
  }
  const notesField = (
    <NotesField notes={notes} path={file.path} queued={queued} takes={file.takesImages} />
  );
  const panels: Array<ColumnPanel> = [
    {
      content: (
        <RoundOutline
          document={document}
          isActive={wide}
          onSubmit={onSubmit}
          questions={nav}
          round={round}
        />
      ),
      icon: "uraeda:list",
      key: "outline",
      label: "Outline",
    },
    { content: notesField, icon: "uraeda:pencil", key: "notes", label: "Notes" },
  ];
  const session = draft && sessionTab(draft, file.folder, agent?.kind);
  if (session) {
    panels.push(session);
  }
  return (
    <>
      <DocumentColumn
        column={actions.column}
        content={content}
        label="The round's column"
        panels={panels}
      />
      {!wide && (
        <PhoneParts
          nav={nav}
          notesField={notesField}
          onSubmit={onSubmit}
          round={{ document, round }}
          session={session}
          sheet={actions.sheet}
        />
      )}
    </>
  );
}

/**
 * On the phone, the round's parts outside its page, in the bottom bar as in the column, by their
 * icons: Outline, named with how many questions are answered, Notes over `notesField`, and Session, `session`, where the
 * agent can be asked, each opening its sheet, the open one kept in the address (`useSheetTab`);
 * then Next or Submit.
 */
function PhoneParts({
  nav,
  notesField,
  onSubmit,
  round: { document, round },
  session,
  sheet,
}: {
  nav: ReadonlyArray<NavQuestion>;
  notesField: ReactNode;
  onSubmit: () => void;
  round: { document: Document; round: RoundItems };
  session: ColumnPanel | undefined;
  sheet: SheetState;
}) {
  const [open, setSheet] = sheet;
  const answered = nav.filter((q) => q.answered).length;
  const count = `${answered}/${nav.length}`;
  const buttons = (
    <NavTiles label="The round's parts">
      <NavTile
        icon="uraeda:list"
        isOpen={open === "outline"}
        label={`Outline, ${count} answered`}
        onPress={() => setSheet("outline")}
      />
      <NavTile
        icon="uraeda:pencil"
        isOpen={open === "notes"}
        label="Notes"
        onPress={() => setSheet("notes")}
      />
      {session && (
        <NavTile
          icon={session.icon}
          isOpen={open === "session"}
          label="Session"
          onPress={() => setSheet("session")}
        />
      )}
      <NextTile onSubmit={onSubmit} questions={nav} />
    </NavTiles>
  );
  return (
    <ColumnStatusLine
      buttons={buttons}
      sheet={sheet}
      sheets={[
        {
          // No field to type in: the sheet needs no room for a keyboard, and the round shows above.
          height: "capped",
          key: "outline",
          label: SHEETS.outline,
          panel: (
            <OutlineSheetPanel
              document={document}
              label={SHEETS.outline}
              onClose={() => setSheet()}
              questions={nav}
              round={round}
            />
          ),
        },
        // The round stays where it was read under the notes' field.
        { key: "notes", label: SHEETS.notes, panel: notesField },
        ...(session
          ? [{ key: "session", label: SESSION_SHEETS.session, panel: session.content }]
          : []),
      ]}
    />
  );
}
