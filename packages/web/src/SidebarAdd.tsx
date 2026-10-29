// The column's ＋ buttons, next to Priorities and Inbox, and the forms they open, drawn beside the
// page, not in the column: its Note opens the inbox's form too, as the phone's sessions page does.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { createContext, type ReactNode, Suspense, useContext, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AddNote, type NoteAdded } from "./AddNote.tsx";
import { undoAsFile, usePickedImages } from "./NoteImage.tsx";
import { readPriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { type Added, AddForm, titleOf } from "./QuickAdd.tsx";
import { useRoute } from "./routes.tsx";
import { InboxView, PrioritiesView } from "./views.ts";

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

/** A ＋ of the shell: an icon alone beside its row, or, with `text`, a button that says it. */
function Plus({ form, label, text }: { form: Form; label: string; text?: string }) {
  const open = useOpenAddForm();
  return (
    <Button
      // Lucide's plus: the font has no "＋" to draw.
      icon={<Icon icon="uraeda:plus" />}
      isIconOnly={text === undefined}
      label={label}
      onClick={() => open(form)}
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
 * Undo of a committed add: the core removes the proposal by its lines and commits the removal
 * alone, refusing once the file changed since the add's commit, `hash`.
 */
async function undoCommitted(
  fate: ReturnType<typeof useFateClient>,
  line: Added,
  hash: string,
): Promise<string | undefined> {
  const result = await fate.mutations.proposals.undoCommitted({
    input: { hash, lines: [...line.lines] },
    view: PrioritiesView,
  });
  return result.error ? refusal(result.error).message : undefined;
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
 * default, at once, uncommitted, for the commit page's Commit. A toast says where it went, with
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
  const toast = useUndoToast();

  // The form closed as it added: one opened again meanwhile stays open.
  const added = (section: string, line: Added | undefined) => {
    const title = titleOf(section);
    if (line?.committed) {
      const { hash } = line.committed;
      toast(`Added to ${title} and committed`, () => undoCommitted(fate, line, hash), true);
      return;
    }
    toast(`Added to ${title}, not committed`, async () => {
      // Found again in the file as it is now, by its text: the proposal it added, wherever it is.
      const now = await readPriorities(fate);
      const same = now.sections.flatMap((s) => s.proposals).filter((p) => p.text === line?.text);
      const found = same.find((p) => p.key === line?.key) ?? (same.length === 1 ? same[0] : null);
      if (!line || !found) {
        return `Could not undo: "${line?.text ?? ""}" is no longer in PRIORITIES.md.`;
      }
      const result = await fate.mutations.proposals.remove({
        input: { hash: now.hash, proposal: found.id },
        view: PrioritiesView,
      });
      return result.error ? refusal(result.error).message : undefined;
    });
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
 * Undo of the note just added: the core takes it out, found by its lines wherever it is now, and
 * refuses once it changed or left, or when two notes hold its lines. A committed note's removal
 * is committed too, refused once the inbox changed since the add's commit, `committed.hash`.
 */
async function undoAdd(
  fate: ReturnType<typeof useFateClient>,
  note: InboxNote | undefined,
  committed?: { hash: string },
) {
  if (!note) {
    return "Could not undo: the note is no longer in INBOX.md.";
  }
  const lines = [...note.lines];
  const result = committed
    ? await fate.mutations.inbox.undoCommitted({
        input: { hash: committed.hash, lines },
        view: InboxView,
      })
    : await fate.mutations.inbox.undoAdd({ input: { lines }, view: InboxView });
  return result.error ? refusal(result.error).message : undefined;
}

/**
 * The inbox's form, "Add a note": a toast says the note was added, with Undo, which removes the
 * note it added, found by its lines wherever it is now; a note added as a file goes with its note
 * file, unless the human typed in it. On a feature's or a change's pages, the note is about it. The
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
  const toast = useUndoToast();
  const { route } = useRoute();
  // The page's folder: the core marks the note with its slug when it is a feature's or a change's.
  const about = "folder" in route ? route.folder : undefined;

  const added = ({ committed, file, note }: NoteAdded) => {
    onClose();
    if (file === undefined) {
      toast(
        committed ? "Added to the inbox and committed" : "Added to the inbox, not committed",
        () => undoAdd(fate, note, committed),
        committed !== undefined,
      );
      return;
    }
    picked.clear();
    // By the lines the add wrote, as `undoAdd` finds its note: the core refuses once it changed.
    toast("Added to the inbox as a file, not committed", async () =>
      note
        ? undoAsFile(fate, note)
        : `Could not undo: the note linking ${file} is no longer in INBOX.md.`,
    );
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
  const [open, setOpen] = useState<Form>();
  const [place, setPlace] = useState<AddPlace>({});
  const [drawn, setDrawn] = useState<ReadonlyArray<Form>>([]);
  // The note form's picked images, held here so that a drop on the inbox can open the form with them.
  const [images, picked] = usePickedImages();
  const close = () => setOpen(undefined);
  const openForm: OpenForm = (form, { images: dropped, ...where } = {}) => {
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
