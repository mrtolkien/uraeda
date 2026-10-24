// A round waiting for answers beside its column: on wide and semi-wide screens, the document's
// column of Outline, Notes, and, for a feature whose agent can be asked, Session; on the phone, the
// status line's count, Notes, and Next or Submit, the count and Notes each opening a sheet.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type ReactNode, Suspense } from "react";
import type { Document, RoundItems } from "uraeda-binding";
import { ColumnSession } from "./ColumnSession.tsx";
import type { useFile } from "./data.ts";
import {
  type ColumnTab,
  DocumentColumn,
  tabAddress,
  useAskedTab,
  useColumnTab,
} from "./layout/DocumentColumn.tsx";
import { useDocumentColumnWidth } from "./layout/documentColumnWidth.ts";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { openOverlayAt, overlayOf } from "./layout/useBackCloses.ts";
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
import { redirect } from "./routes.tsx";
import { askAbout, quoted, withQuote } from "./sessions.ts";
import type { Draft } from "./useDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** The phone's sheet open over the round, if any. */
export type RoundSheet = "outline" | "notes" | undefined;

/** The phone's sheets' names, by their keys in the address. */
const SHEETS = { notes: "Notes", outline: "Outline" } as const;

/**
 * The phone's open sheet, and what opens or closes one: on narrow screens, `?tab=notes` opens the
 * Notes sheet and `?tab=outline` the Outline sheet, so a reload, Back, or a width change keeps it,
 * and the column's tab of the same key opens as the window widens. Opening a sheet adds a history
 * entry of the page's, so Back closes it; closing it goes back over that entry, or, opened by the
 * address, takes the tab out of it.
 */
function useRoundSheet(wide: boolean) {
  const asked = useAskedTab();
  const sheet: RoundSheet = !wide && (asked === "notes" || asked === "outline") ? asked : undefined;
  const setSheet = (key: RoundSheet) => {
    if (key !== undefined) {
      openOverlayAt(tabAddress(key), SHEETS[key]);
      return;
    }
    // Read now: called once Back landed, the sheet's entry gone.
    const open = new URLSearchParams(window.location.search).get("tab");
    if (open !== "notes" && open !== "outline") {
      return;
    }
    if (overlayOf(window.history.state) === SHEETS[open]) {
      window.history.back();
    } else {
      redirect(tabAddress(undefined));
    }
  };
  return [sheet, setSheet] as const;
}

/** The column's tabs, by their keys in the address: Session only where the agent can be asked. */
export function columnKeys(asks: boolean) {
  return asks ? ["outline", "notes", "session"] : ["outline", "notes"];
}

/** The id of the Session tab's panel, whose composer asking focuses once it is drawn. */
const SESSION_PANEL = "round-session";

/** Focuses what `find` finds once it is drawn, within two seconds, without scrolling the page. */
function focusOnceDrawn(find: () => HTMLElement | null | undefined) {
  const start = performance.now();
  const tick = () => {
    const found = find();
    if (found) {
      found.focus({ preventScroll: true });
    } else if (performance.now() - start < 2000) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

/**
 * What the round's page does from its parts: the phone's open sheet, `sheet`; asking the agent
 * about a question or a point, with `draft`, the session's composer kept by the page, when the
 * agent can be asked; and opening the notes' field. Asking writes the quote into the composer,
 * in place of the one it held, and opens the Session tab, its composer focused; on the phone, it
 * opens the session's page. "Edit notes" opens the Notes tab, or the phone's sheet, its field
 * focused. Both unfold the column the human folded (R23): `column` is its width and fold, which
 * the page holds. `notesShown` says whether the notes' field is drawn, and `sessionShown` the
 * session's composer.
 */
export function useRoundActions(file: File, draft: Draft | undefined) {
  const wide = !isNarrow(useWidthClass());
  const column = useDocumentColumnWidth();
  const [tab, setTab] = useColumnTab(columnKeys(draft !== undefined));
  const sheet = useRoundSheet(wide);
  const openTab = (key: string) => {
    column.setShown(true);
    setTab(key);
  };
  const ask = (quote: string) => {
    if (!wide) {
      askAbout(file.folder, quote);
      return;
    }
    draft?.setText((now) => withQuote(now, quote));
    openTab("session");
    focusOnceDrawn(() =>
      document.getElementById(SESSION_PANEL)?.querySelector<HTMLElement>('[role="textbox"]'),
    );
  };
  const editNotes = () => {
    if (wide) {
      openTab("notes");
    } else {
      sheet[1]("notes");
    }
    focusOnceDrawn(() => document.getElementById(NOTES_FIELD));
  };
  const asks = draft && {
    point: (subject: string) => ask(quoted(`About the settled point of ${file.path}:`, [subject])),
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
 * `draft` the session's composer, kept by the page, with which the column has a Session tab.
 * `onSubmit` takes the page to its end. `actions` are the page's, `useRoundActions`': the phone's
 * open sheet, and how the notes open. `n` and `p` jump between blank questions on wide screens,
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
  useBlankKeys(nav, wide);
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
        <div id={SESSION_PANEL}>
          <Suspense fallback={null}>
            <ColumnSession draft={draft} folder={file.folder} />
          </Suspense>
        </div>
      ),
    });
  }
  return (
    <>
      <DocumentColumn
        column={actions.column}
        content={content}
        label="The round's column"
        tabs={tabs}
      />
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
            label={`${answered}/${nav.length} answered, outline`}
            onClick={() => setSheet("outline")}
            variant="ghost"
          >
            {`${answered}/${nav.length}`}
          </Button>
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
