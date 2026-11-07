// The column's ＋ buttons, next to Priorities and Inbox, and the forms they open, drawn beside the
// page, not in the column: its Note opens the inbox's form too, as the phone's sessions page does,
// and so does the phone's bottom bar of the inbox and the priorities (`AddBar`).
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { createContext, type ReactNode, Suspense, useContext, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { AddNote, type NoteAdded } from "./AddNote.tsx";
import { usePickedImages } from "./NoteImage.tsx";
import { useWorkspace } from "./data.ts";
import { NavTile, NavTiles } from "./layout/NavBar.tsx";
import { Overlay } from "./layout/Overlay.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { type Added, AddForm, titleOf } from "./QuickAdd.tsx";
import { useRoute } from "./routes.tsx";
import { changeEntry } from "./undo/changeEntry.ts";
import { useUndo } from "./undo/useUndo.ts";

/** The form a ＋ opened, if any. */
type Form = "note" | "proposal" | undefined;

/**
 * Where a form opens when a key asks for a place: a priorities section's id, or an inbox category's
 * name, `null` for "No category". Without a place a form opens in its default one. `images`, files
 * dropped on the inbox with no note selected, are added to the note form's picked images.
 */
export type AddPlace = {
  category?: string | null;
  images?: ReadonlyArray<File>;
  section?: string;
};

/** Opens a form, from a ＋ in the navigation or a key, in `place` when given. */
type OpenForm = (form: Form, place?: AddPlace) => void;

const OpenContext = createContext<OpenForm>(() => {});

/**
 * Opens the inbox's form, `"note"`, or the priorities', `"proposal"`, in its default place, or in
 * the `place` given as the second argument: a section, or a category (R40).
 */
export function useOpenAddForm(): OpenForm {
  return useContext(OpenContext);
}

/**
 * A ＋ of the shell: an icon alone beside its row, or, with `text`, a button that says it. None in a
 * repository without `specs/`, which has no inbox nor priorities to add to.
 */
function Plus({ form, label, text }: { form: Form; label: string; text?: string }) {
  const open = useOpenAddForm();
  if (useWorkspace()?.noSpecs) {
    return null;
  }
  return (
    <Button
      // Lucide's plus: the font has no "＋" to draw.
      icon={<Icon icon="uraeda:plus" />}
      isIconOnly={text === undefined}
      label={label}
      onClick={() => open(form)}
      // The ＋ alone says what it adds on hover.
      {...(text === undefined ? { tooltip: label } : {})}
      variant="ghost"
    >
      {text}
    </Button>
  );
}

/** ＋ next to Priorities; "＋ Proposal", with `text`. */
export function AddProposalButton({ text }: { text?: string }) {
  return <Plus form="proposal" label="Add a proposal" {...(text ? { text } : {})} />;
}

/** ＋ next to Inbox; "＋ Note", with `text`. */
export function AddNoteButton({ text }: { text?: string }) {
  return <Plus form="note" label="Add a note to the inbox" {...(text ? { text } : {})} />;
}

/**
 * On the phone, a list's bottom bar: Add alone, in the accent, a single button, which opens `form`,
 * the inbox's or the priorities', as their ＋ does.
 */
export function AddBar({ form }: { form: "note" | "proposal" }) {
  const open = useOpenAddForm();
  if (!isNarrow(useWidthClass())) {
    return null;
  }
  return (
    <TopBarSlot>
      <NavTiles label={form === "note" ? "The inbox's actions" : "The priorities' actions"}>
        <NavTile
          icon="uraeda:plus"
          isTinted
          label={form === "note" ? "Add a note to the inbox" : "Add a proposal"}
          onPress={() => open(form)}
          word="Add"
        />
      </NavTiles>
    </TopBarSlot>
  );
}

/**
 * The overlay of a ＋ button's form, `label` its title: a dialog of the quick add's width on wider
 * screens, a sheet as tall as the form on the phone, `loading` read while its file loads.
 */
function AddOverlay({
  canClose,
  children,
  isOpen,
  label,
  loading,
  onClose,
}: {
  /** Asked before the overlay's own close: `false` keeps it open. */
  canClose?: () => Promise<boolean>;
  children: ReactNode;
  isOpen: boolean;
  label: string;
  loading: string;
  onClose: () => void;
}) {
  return (
    <Overlay
      {...(canClose ? { canClose } : {})}
      isOpen={isOpen}
      label={label}
      onClose={onClose}
      purpose="info"
      sheetHeight="hug"
      size={{ width: "var(--size-quick-add)" }}
    >
      <Suspense fallback={<Spinner label={loading} />}>{children}</Suspense>
    </Overlay>
  );
}

/**
 * The priorities' form: it jots a proposal down at the end of a section of `PRIORITIES.md`, Next by
 * default, at once, uncommitted, for the Git page's Commit. A toast says where it went, with
 * Undo. Closing it with Close, Back, or Escape keeps its text.
 */
function ProposalOverlay({
  isOpen,
  onClose,
  section,
}: {
  isOpen: boolean;
  onClose: () => void;
  section?: string;
}) {
  const fate = useFateClient();
  const record = useUndo();

  // The form closed as it added: one opened again meanwhile stays open.
  const added = (section: string, line: Added | undefined) => {
    if (line?.change) {
      const place = { path: "/priorities", select: line.key };
      record(changeEntry(fate, line.change, `Added to ${titleOf(section)}`, place, line.text));
    }
  };

  return (
    <AddOverlay
      isOpen={isOpen}
      label="New proposal"
      loading="Loading the priorities"
      onClose={onClose}
    >
      <AddForm onAdded={added} onCancel={onClose} section={section} />
    </AddOverlay>
  );
}

/**
 * The inbox's form, "Add a note": a toast says the note was added, with Undo, which takes back the
 * change the add answered, a note added as a file with its note file's folder, and Redo, which
 * writes it again. On a feature's or a change's pages, the note is about it. The
 * images picked for a note, `images`, are held by the forms' host, so that the form gets them back
 * as it opens again, until they are added, removed, or cancelled (ruling R21).
 */
function NoteOverlay({
  category,
  images,
  isOpen,
  onClose,
  picked,
}: {
  category?: string | null;
  images: ReturnType<typeof usePickedImages>[0];
  isOpen: boolean;
  onClose: () => void;
  picked: ReturnType<typeof usePickedImages>[1];
}) {
  const fate = useFateClient();
  const record = useUndo();
  const { route } = useRoute();
  // The page's folder: the core marks the note with its slug when it is a feature's or a change's.
  const about = "folder" in route ? route.folder : undefined;

  const added = ({ change, file, note }: NoteAdded) => {
    onClose();
    if (file !== undefined) {
      picked.clear();
    }
    if (change) {
      const label = file === undefined ? "Added to the inbox" : "Added to the inbox as a file";
      const place = note ? { path: "/inbox", select: note.key } : { path: "/inbox" };
      record(changeEntry(fate, change, label, place, note?.text ?? file ?? ""));
    }
  };

  // Asked before Close, Escape, or a click outside closes the form: it asks while it holds text.
  const closes = useRef<() => Promise<boolean>>(undefined);
  const [register] = useState(() => (ask: () => Promise<boolean>) => {
    closes.current = ask;
  });
  return (
    <AddOverlay
      canClose={() => closes.current?.() ?? Promise.resolve(true)}
      isOpen={isOpen}
      label="Add a note"
      loading="Loading the inbox"
      onClose={onClose}
    >
      <AddNote
        about={about}
        category={category}
        closes={register}
        images={images}
        onAdded={added}
        picked={picked}
      />
    </AddOverlay>
  );
}

/**
 * The forms the navigation's ＋ buttons open, drawn beside `children`, the shell. Each is drawn
 * from its first opening on: a dialog's title takes the focus as it is drawn, which a page that
 * places the focus itself, like a round's question, must keep.
 */
export function SidebarAddForms({ children }: { children: ReactNode }) {
  // A repository without `specs/` has no inbox nor priorities: a key opens no form there.
  const noSpecs = useWorkspace()?.noSpecs;
  const [open, setOpen] = useState<Form>();
  const [place, setPlace] = useState<AddPlace>({});
  const [drawn, setDrawn] = useState<ReadonlyArray<Form>>([]);
  // The note form's picked images, held here so that a drop on the inbox can open the form with them.
  const [images, picked] = usePickedImages();
  const close = () => setOpen(undefined);
  const openForm: OpenForm = (form, { images: dropped, ...where } = {}) => {
    if (noSpecs) {
      return;
    }
    setDrawn((forms) => (forms.includes(form) ? forms : [...forms, form]));
    setPlace(where);
    setOpen(form);
    if (dropped && dropped.length > 0) {
      picked.add(dropped);
    }
  };
  return (
    <OpenContext value={openForm}>
      {children}
      {drawn.includes("proposal") && (
        <ProposalOverlay isOpen={open === "proposal"} onClose={close} section={place.section} />
      )}
      {drawn.includes("note") && (
        <NoteOverlay
          category={place.category}
          images={images}
          isOpen={open === "note"}
          onClose={close}
          picked={picked}
        />
      )}
    </OpenContext>
  );
}
