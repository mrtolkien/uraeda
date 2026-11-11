// The inbox's list, the place's subject: the add first, with the inbox's rare actions as icons
// beside it, then the triage's banner and the last action's, then the notes by category, the notes
// without one first, and last the row that adds a category, where no thumb lands by mistake.
import { Clipboard, computed, effect, signal, untracked, View } from "nsh";
import { call, entry, navigate, record, redirect, route } from "../../store";
import type { Inbox } from "../../store/protocol";
import { Banner, Heading, Icon, IconButton, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { focus, layoutOf, PaneScroll, placeOf, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, type LineProps, List } from "../../ui/lists";
import type { TextFieldRef } from "../../ui/text";
import { TriageBanner } from "../triage/TriageBanner";
import { ORGANIZE_INBOX, startChat } from "../triage/chat";
import { deleteNote, remember } from "./actions";
import { AddNote, heldFor, holdImages } from "./AddNote";
import { CategoryDialog } from "./CategoryDialog";
import { droppedImages, pastedImage, pickImages } from "./images";
import { LastAction } from "./LastAction";
import { categoryAt, type InboxRow, marksOf, plain, plural, rowsOf } from "./model";
import { NotePicker, type Picking } from "./Pickers";

/** The dialog open over the list: a new category, or a category renamed. */
type Naming = { kind: "new" } | { kind: "rename"; name: string };

/** What a row of the list says, by its kind: one `Line`, whose words change as its row does. */
function lineOf(row: InboxRow | undefined): LineProps {
  switch (row?.kind) {
    case "note":
      return {
        icon: row.note.file === null ? undefined : "file-text",
        label: plain(row.note.spans) || row.note.text,
        meta: marksOf(row.note),
      };
    case "category":
      return {
        count: row.count,
        icon: "folder",
        label: row.name,
        meta: row.count === 0 ? "empty" : undefined,
      };
    default:
      return { icon: "folder-plus", label: "New category", quiet: true };
  }
}

function RowView(props: { row: InboxRow | undefined }) {
  const line = () => lineOf(props.row);
  return (
    <If
      when={props.row?.kind === "category"}
      else={
        <Line icon={line().icon} label={line().label} meta={line().meta} quiet={line().quiet} />
      }
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingTop: 10 }}>
        <Icon name="folder" />
        <Heading level={3} style={{ flex: 1, minWidth: 0 }}>
          {line().label}
        </Heading>
        <Text tone="faint">{line().count === 0 ? "empty" : plural(line().count ?? 0, "note")}</Text>
      </View>
    </If>
  );
}

/** Opens a note's pane beside the list, with the focus: in place of the one open, on its page. */
export function openNote(repo: string, key: string) {
  const to = { key, page: "note" as const, repo };
  if (route().page === "note") {
    redirect(to);
    return;
  }
  const place = placeOf(to);
  const note = place.side[0] ?? place.main[0];
  navigate(to, note === undefined ? {} : { layout: focus(layoutOf(place), note.key) });
}

function Notes(props: { inbox: Inbox; repo: string }) {
  const pane = usePane();
  const at = pane.remember<string | null>(
    "at",
    route().page === "note" ? (route() as { key: string }).key : null,
  );
  const addTo = pane.remember<string | null>("addTo", null);
  const rows = computed<ReadonlyArray<InboxRow>>((before) => rowsOf(props.inbox, before ?? []));
  const cursor = createCursor(rows, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  const refusal = signal<string | null>(null);
  const picking = signal<Picking | null>(null);
  const naming = signal<Naming | null>(null);
  const typing = signal(false);
  let field: TextFieldRef | undefined;

  // `Space n i` opens the inbox to add a note: its field takes the focus, in a visit made for it.
  effect(() => {
    if (entry().kept.focus === "text") untracked(() => field?.focus());
  });
  const said = (run: () => Promise<unknown>) => {
    refusal.set(null);
    run().catch((error: Error) => refusal.set(error.message));
  };
  const row = () => rows().find((one) => one.id === cursor.at());
  const noteRow = () => {
    const one = row();
    return one?.kind === "note" ? one : undefined;
  };
  const open = (id: string) => {
    const one = rows().find((each) => each.id === id);
    if (one?.kind === "note") openNote(props.repo, one.note.key);
    if (one?.kind === "category") startAdding(one.name);
    if (one?.kind === "new-category") naming.set({ kind: "new" });
  };
  const startAdding = (category: string | null) => {
    addTo.set(category);
    field?.focus();
  };
  const paste = async () => {
    const image = await pastedImage();
    if (image !== undefined) {
      holdImages(props.repo, [image]);
      return;
    }
    if (typing()) {
      field?.insert(await Clipboard.readText());
    }
  };

  registerKey([
    {
      hint: "a",
      hintLabel: "add",
      icon: "plus",
      keys: "a",
      label: "Add a note",
      run: () => startAdding(categoryAt(rows(), cursor.at())),
    },
    {
      hint: "d",
      hintLabel: "delete",
      icon: "trash-2",
      keys: "d",
      label: "Delete the note, or the empty category",
      run: () => {
        const one = row();
        if (one?.kind === "note") {
          return said(() => deleteNote(props.repo, props.inbox, one.note));
        }
        if (one?.kind !== "category") return false;
        const name = one.name;
        return said(async () => {
          const written = await call("inbox.removeCategory", {
            hash: props.inbox.hash,
            keepNotes: true,
            name,
            repo: props.repo,
          });
          const label = `Deleted the category ${name}${one.count > 0 ? ": its notes stay, without a category" : ""}.`;
          remember({ change: written.change, label, repo: props.repo, subject: name });
        });
      },
    },
    {
      hint: "c",
      hintLabel: "category",
      icon: "folder",
      keys: "c",
      label: "Move the note to a category…",
      run: () => {
        const one = noteRow();
        if (one === undefined) return false;
        picking.set({ category: one.category, kind: "move", note: one.note });
        return undefined;
      },
    },
    {
      hint: "p",
      hintLabel: "proposal",
      icon: "flag",
      keys: "p",
      label: "Make the note a proposal…",
      run: () => {
        const one = noteRow();
        if (one === undefined) return false;
        picking.set({ category: one.category, kind: "promote", note: one.note });
        return undefined;
      },
    },
    {
      icon: "folder-plus",
      keys: "C",
      label: "New category…",
      run: () => naming.set({ kind: "new" }),
    },
    {
      icon: "pencil",
      keys: "R",
      label: "Rename the category…",
      run: () => {
        const name = categoryAt(rows(), cursor.at());
        if (name === null) return false;
        naming.set({ kind: "rename", name });
        return undefined;
      },
    },
    {
      inField: true,
      keys: "mod+v",
      label: "Paste, an image for the new note",
      run: () => void paste(),
    },
  ]);

  return (
    <View
      onFileDrop={(event) =>
        said(async () => holdImages(props.repo, await droppedImages(event.uris)))
      }
      style={{ flex: 1 }}
    >
      <PaneScroll style={{ flex: 1 }}>
        <View style={{ gap: 12, paddingBottom: 24 }}>
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 4 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AddNote
                category={addTo()}
                focus={entry().kept.focus === "text"}
                inbox={props.inbox}
                onCategory={(name) => addTo.set(name)}
                onFocused={(on) => typing.set(on)}
                ref={(made) => {
                  field = made;
                }}
                repo={props.repo}
              />
            </View>
            <IconButton
              icon="image-plus"
              label="Add images to the new note"
              onPress={() => said(async () => holdImages(props.repo, await pickImages()))}
            />
            <If when={props.inbox.triage === null}>
              <IconButton
                icon="sparkles"
                label="Organize with AI"
                onPress={() => said(() => startChat(props.repo, ORGANIZE_INBOX))}
              />
            </If>
            <IconButton
              icon="folder-plus"
              label="New category"
              onPress={() => naming.set({ kind: "new" })}
            />
          </View>
          <If when={refusal()}>
            {(words) => <Banner icon="circle-alert" title={words()} tone="danger" />}
          </If>
          {/* Beside the triage itself, its banner would lead where the human is. */}
          <If when={route().page === "triage" ? null : props.inbox.triage}>
            {(status) => <TriageBanner repo={props.repo} status={status()} />}
          </If>
          <LastAction repo={props.repo} />
          <If when={props.inbox.count === 0 && heldFor(props.repo).length === 0}>
            <Empty
              icon="inbox"
              title="The inbox is empty"
              words="A note you add above lands here: something noticed while doing something else, kept until you decide what it becomes."
            />
          </If>
          <List
            cursor={cursor}
            rules
            onOpen={open}
            row={(id) => <RowView row={rows().find((one) => one.id === id())} />}
          />
        </View>
      </PaneScroll>
      <If when={picking()}>
        {(shown) => (
          <NotePicker
            inbox={props.inbox}
            onClose={() => picking.set(null)}
            onRefused={(words) => refusal.set(words)}
            picking={shown()}
            repo={props.repo}
          />
        )}
      </If>
      <If when={naming()}>
        {(shown) => (
          <CategoryDialog
            initial={shown().kind === "rename" ? (shown() as { name: string }).name : ""}
            onClose={() => naming.set(null)}
            onSave={async (name) => {
              const now = shown();
              if (now.kind === "rename") {
                await call("inbox.renameCategory", {
                  from: now.name,
                  hash: props.inbox.hash,
                  repo: props.repo,
                  to: name,
                });
              } else {
                await call("inbox.addCategory", { hash: props.inbox.hash, name, repo: props.repo });
              }
            }}
            title={shown().kind === "rename" ? "Rename the category" : "New category"}
          />
        )}
      </If>
    </View>
  );
}

/** The list's pane: the inbox once read, or why it is not. */
export function InboxList(props: { repo: string }) {
  const inbox = record("Inbox", { repo: props.repo });
  return (
    <If
      when={inbox.error()}
      else={
        <If when={inbox()} else={<Spinner label="Reading the inbox" />}>
          {(shown) => <Notes inbox={shown()} repo={props.repo} />}
        </If>
      }
    >
      {(error) => (
        <Banner icon="circle-alert" title="The inbox could not be read" tone="danger">
          <Text>{error().message}</Text>
        </Banner>
      )}
    </If>
  );
}
