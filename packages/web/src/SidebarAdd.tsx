// The sidebar's ＋ buttons, next to Priorities and Inbox, and the forms they open. The forms are
// drawn beside the page, not in the navigation: on the phone, the drawer closes as a ＋ is tapped.
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Spinner } from "@astryxdesign/core/Spinner";
import { createContext, type ReactNode, Suspense, useContext, useState } from "react";
import { useFateClient } from "react-fate";
import type { InboxNote } from "uraeda-binding";
import { AddNote } from "./AddNote.tsx";
import { readInbox, readPriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useUndoToast } from "./layout/useUndoToast.ts";
import { type Added, AddForm, TITLES } from "./QuickAdd.tsx";
import { useRoute } from "./routes.tsx";
import { InboxView, PrioritiesView } from "./views.ts";

/** The form a ＋ opened, if any. */
type Form = "note" | "priority" | undefined;

/** Opens a form, from a ＋ in the navigation. */
const OpenContext = createContext<(form: Form) => void>(() => {});

/**
 * A ＋ of the navigation: it opens its form, once the phone's drawer is closed. The drawer gives
 * the focus back to its menu button as it closes, which the form's field would otherwise lose.
 */
function Plus({ form, label }: { form: Form; label: string }) {
  const open = useContext(OpenContext);
  const { closeMobileNav, isMobileNavOpen, mobileNavId } = useAppShellMobile();
  const tap = () => {
    const drawer = (
      isMobileNavOpen && mobileNavId ? document.getElementById(mobileNavId) : null
    ) as HTMLDialogElement | null;
    if (drawer?.open) {
      drawer.addEventListener("close", () => open(form), { once: true });
      closeMobileNav();
      return;
    }
    open(form);
  };
  return (
    <Button
      icon={<span aria-hidden="true">＋</span>}
      isIconOnly
      label={label}
      onClick={tap}
      variant="ghost"
    />
  );
}

/** ＋ next to Priorities. */
export function AddPriorityButton() {
  return <Plus form="priority" label="Add to the priorities" />;
}

/** ＋ next to Inbox. */
export function AddNoteButton() {
  return <Plus form="note" label="Add a note to the inbox" />;
}

/**
 * The priorities' form: it jots a line down at the end of a section of `PRIORITIES.md`, Next by
 * default, at once. A toast says where it went, with Undo. Closing it with Close, Back, or Escape
 * keeps its text.
 */
function PriorityOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const fate = useFateClient();
  const toast = useUndoToast();

  const added = (section: string, line: Added | undefined) => {
    onClose();
    toast(`Added to ${TITLES.get(section)}, not committed`, async () => {
      // Found again in the file as it is now, by its text: the line it added, wherever it is.
      const now = await readPriorities(fate);
      const same = now.sections.flatMap((s) => s.entries).filter((e) => e.text === line?.text);
      const entry = same.find((e) => e.key === line?.key) ?? (same.length === 1 ? same[0] : null);
      if (!line || !entry) {
        return `Could not undo: "${line?.text ?? ""}" is no longer in PRIORITIES.md.`;
      }
      const result = await fate.mutations.priorities.remove({
        input: { entry: entry.id, hash: now.hash },
        view: PrioritiesView,
      });
      return result.error ? refusal(result.error).message : undefined;
    });
  };

  return (
    <Overlay isOpen={isOpen} label="New priority" onClose={onClose}>
      <Suspense fallback={<Spinner label="Loading the priorities" />}>
        <AddForm onAdded={added} onCancel={onClose} />
      </Suspense>
    </Overlay>
  );
}

/**
 * The inbox's form, "Add a note": a toast says the note was added, with Undo, which removes the
 * note it added, found by its lines wherever it is now. On a feature's or a bug's pages, the note is
 * about it.
 */
function NoteOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const fate = useFateClient();
  const toast = useUndoToast();
  const { route } = useRoute();
  // A feature's or a bug's folder starts with its date: another `/f/<name>` is about nothing.
  const about =
    "folder" in route && /^\d{4}-\d{2}-\d{2}-./.test(route.folder) ? route.folder : undefined;

  const added = (note: InboxNote | undefined) => {
    onClose();
    toast("Added to the inbox, not committed", async () => {
      const now = await readInbox(fate);
      const lines = note?.lines.join("\n");
      const same = now.categories
        .flatMap((category) => category.notes)
        .filter((one) => one.lines.join("\n") === lines);
      const found =
        same.find((one) => one.key === note?.key) ?? (same.length === 1 ? same[0] : null);
      if (!note || !found) {
        return `Could not undo: "${note?.text ?? ""}" is no longer in INBOX.md.`;
      }
      const result = await fate.mutations.inbox.remove({
        input: { hash: now.hash, note: found.id },
        view: InboxView,
      });
      return result.error ? refusal(result.error).message : undefined;
    });
  };

  return (
    <Overlay isOpen={isOpen} label="Add a note" onClose={onClose} sheetHeight="hug">
      <Suspense fallback={<Spinner label="Loading the inbox" />}>
        <AddNote about={about} onAdded={added} onCancel={onClose} />
      </Suspense>
    </Overlay>
  );
}

/**
 * The forms the navigation's ＋ buttons open, drawn beside `children`, the shell. Each is drawn
 * from its first opening on: a dialog's title takes the focus as it is drawn, which a page that
 * places the focus itself, like a round's question, must keep.
 */
export function SidebarAddForms({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Form>();
  const [drawn, setDrawn] = useState<ReadonlyArray<Form>>([]);
  const close = () => setOpen(undefined);
  const openForm = (form: Form) => {
    setDrawn((forms) => (forms.includes(form) ? forms : [...forms, form]));
    setOpen(form);
  };
  return (
    <OpenContext value={openForm}>
      {children}
      {drawn.includes("priority") && (
        <PriorityOverlay isOpen={open === "priority"} onClose={close} />
      )}
      {drawn.includes("note") && <NoteOverlay isOpen={open === "note"} onClose={close} />}
    </OpenContext>
  );
}
