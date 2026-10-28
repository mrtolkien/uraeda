// The New page, behind the sidebar's "＋ New": three cards, in the URL, pick a session, a change, or
// a feature, each drawn as what it starts. Under them, the kind's composer, and under it the same
// list for all three: the inbox's notes and the priorities' lines, which a card inserts into the
// composer, with a link to its file, or, with a draft, opens. A session starts with its first
// message; a change with Ctrl+Enter, which asks for its slug; a feature with Ctrl+Enter too, which
// writes the proposal as a draft and opens it. The entries a start was filled from leave their
// files. `/` searches the entries.
import type { ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { DraftImage } from "./attach/chatImages.ts";
import { Composer } from "./Composer.tsx";
import { usePriorities } from "./data.ts";
import { useTextField } from "./fields/useTextField.ts";
import { useKeys } from "./keys/registry.tsx";
import { KindCards } from "./KindCards.tsx";
import { Page } from "./layout/Page.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { ChangeComposer, StartError } from "./NewChangePage.tsx";
import {
  type Entry,
  EntryLists,
  insertion,
  lineEntry,
  type Source,
  withAdded,
} from "./NewEntries.tsx";
import { currentEntry } from "./routeHistory.ts";
import {
  type NewKind,
  navigate,
  redirect,
  sessionIdPath,
  useRepoPath,
  useRestoreScroll,
  useSearch,
} from "./routes.tsx";
import { StartDialog } from "./StartDialog.tsx";
import { composerDraft, useDraft } from "./useDraft.ts";
import { takeOut, useStartFrom } from "./useStartFrom.ts";

/** The kinds, to go through them. */
const KINDS: ReadonlyArray<NewKind> = ["session", "change", "feature"];

/** A text's first line as a title: without a heading mark or the link an entry's insertion adds. */
function titleOfText(text: string): string {
  const first =
    text
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find(Boolean) ?? "";
  // Without the link an entry's insertion adds, and cut at its first sentence.
  const clean = first
    .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)\s*$/, "")
    .replace(/([.!?])(\s.*)?$/, "$1")
    .replace(/[.!?]$/, "");
  return clean.length <= 70 ? clean : clean.slice(0, 70).replace(/\s+\S*$/, "");
}

/** What Ctrl+Enter holds in a feature's composer while its title is asked. */
type Asking = { resolve: (started: boolean) => void; text: string };

/**
 * Feature: the same composer as the others, "Write Proposal", for a text that is freeform: no shape
 * is put in it, and it takes no image. Ctrl+Enter writes it as a draft and opens the draft's page; a
 * proposal not filled from an entry asks for its title first, as a change asks for its slug.
 */
function FeatureComposer({
  inputRef,
  sources,
  text,
}: {
  inputRef: React.RefObject<ChatComposerInputHandle | null>;
  sources: ReadonlyArray<Source>;
  text: ReturnType<typeof useTextField>;
}) {
  const starts = useStartFrom();
  const [asking, setAsking] = useState<Asking>();
  const [images, setImages] = useState<ReadonlyArray<DraftImage>>([]);
  const write = async (body: string, title: string) => {
    const opened = await starts.feature.fromText({ body, sources, title });
    if (opened && text.unsavedNow()?.text.trim() === body) {
      text.discard();
    }
    return opened;
  };
  const answer = (started: boolean) => {
    asking?.resolve(started);
    setAsking(undefined);
  };
  return (
    <VStack gap={4}>
      <Composer
        hasAttach={false}
        images={images}
        inputRef={inputRef}
        onChange={text.change}
        onImagesChange={setImages}
        // Filled from an entry, its own title is the proposal's; else the title is asked.
        onSend={(sent) =>
          sources.length > 0
            ? write(sent, "")
            : new Promise<boolean>((resolve) => setAsking({ resolve, text: sent }))
        }
        placeholder="Write Proposal"
        sendLabel="Write the proposal"
        value={text.text}
      />
      <StartError message={starts.error} />
      <StartDialog
        initial={asking ? titleOfText(asking.text) : ""}
        isOpen={asking !== undefined}
        onCancel={() => answer(false)}
        onConfirm={async (title) => {
          // A refusal shows under the composer, as the dialog closes: the text stays.
          answer(await write(asking?.text ?? "", title));
          return undefined;
        }}
        question={{
          confirm: "Write the proposal",
          description: "It names the proposal's file and its line in Now.",
          label: "Title",
          title: "Title the proposal",
        }}
      />
    </VStack>
  );
}

/** The search of the entries, at the title's end: `/` brings the focus to it, Escape leaves it. */
function Search({
  field,
  isNarrow: narrow,
  onChange,
  text,
}: {
  field: React.RefObject<HTMLInputElement | null>;
  isNarrow: boolean;
  onChange: (text: string) => void;
  text: string;
}) {
  return (
    <TextInput
      isLabelHidden
      label="Search the notes and priorities"
      onChange={onChange}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder="Search"
      ref={field}
      startIcon="search"
      value={text}
      // On the title's line at every width, as a desktop's: narrower on the phone, beside "New".
      width={narrow ? "11rem" : "var(--size-settings-search)"}
    />
  );
}

/**
 * The New page: the cards, the kind's composer, then the entries to start from. On the phone no
 * card is picked until one is, the address naming a kind: the flow there is New, pick, composer,
 * and the pick moves the focus to the composer.
 */
export function NewPage({ kind: addressed }: { kind: NewKind }) {
  useRestoreScroll(true);
  const here = useRepoPath();
  const fate = useFateClient();
  const narrow = isNarrow(useWidthClass());
  const named = new URLSearchParams(useSearch()).has("kind");
  const kind = narrow && !named ? undefined : addressed;
  const [search, setSearch] = useState("");
  const searchField = useRef<HTMLInputElement>(null);
  useKeys([
    {
      hint: "/",
      icon: "search",
      keys: "/",
      label: "search",
      run: () => searchField.current?.focus(),
    },
  ]);
  const input = useRef<ChatComposerInputHandle>(null);
  // A pick by a click moves the focus to the composer, which the pick may draw: once it is there.
  const wantsFocus = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // The composer may not be drawn yet, and on the phone it is below the cards: wait for it, focus
  // it, and scroll it into view, its send button with it.
  const focusComposer = () => {
    let tries = 0;
    const attempt = () => {
      if (input.current) {
        input.current.focus();
        box.current?.scrollIntoView({ block: "nearest" });
      } else if (tries++ < 30) {
        requestAnimationFrame(attempt);
      }
    };
    requestAnimationFrame(attempt);
  };
  useEffect(() => {
    if (wantsFocus.current && kind !== undefined) {
      wantsFocus.current = false;
      focusComposer();
    }
  }, [kind]);
  const session = useDraft();
  // Kept as a new chat's text is: leaving the page does not ask.
  const change = useTextField("new-change", "", { drawn: false });
  const feature = useTextField("new-feature-proposal", "", { drawn: false });
  const [sources, setSources] = useState<Record<NewKind, ReadonlyArray<Source>>>({
    change: [],
    feature: [],
    session: [],
  });
  const texts: Record<NewKind, string> = {
    change: change.text,
    feature: feature.text,
    session: session.text,
  };
  // A composer emptied no longer holds what it was filled from.
  useEffect(() => {
    setSources((all) => {
      const emptied = KINDS.filter((of) => texts[of].trim() === "" && all[of].length > 0);
      return emptied.length === 0
        ? all
        : { ...all, ...Object.fromEntries(emptied.map((of) => [of, []])) };
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `texts` is these three
  }, [change.text, feature.text, session.text]);
  const insert = (entry: Entry) => {
    if (kind === undefined) {
      return;
    }
    const added = insertion(entry);
    if (kind === "session") {
      session.setText((text) => withAdded(text, added));
    } else if (kind === "change") {
      change.change(withAdded(change.text, added));
    } else {
      feature.change(withAdded(feature.text, added));
    }
    const source: Source = {
      ...(entry.draft === undefined ? {} : { draft: entry.draft }),
      id: entry.id,
      inserted: added,
      kind: entry.kind,
    };
    setSources((all) => ({
      ...all,
      [kind]: [...all[kind].filter((s) => !(s.kind === source.kind && s.id === source.id)), source],
    }));
    // The field takes the focus once the text is in: `Escape` goes back to the list's keys.
    requestAnimationFrame(() => input.current?.focus());
  };
  // A priority's Start opens the page with its line to insert: once, as soon as the priorities and
  // the composer are there, and not again on a reload.
  const priorities = usePriorities();
  useEffect(() => {
    const wanted = currentEntry().insert?.replace(/^line:/, "");
    const line = priorities?.sections
      .flatMap((section) => section.entries)
      .find((entry) => entry.id === wanted);
    if (line === undefined || kind === undefined) {
      return;
    }
    const { insert: _, ...rest } = currentEntry();
    window.history.replaceState(rest, "");
    insert(lineEntry(line, here));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, when the line and the composer are there
  }, [priorities, kind]);
  return (
    <Page>
      <VStack gap={4}>
        <PageTitle
          // Beside the title at every width, as on a desktop.
          actions={<Search field={searchField} isNarrow={narrow} onChange={setSearch} text={search} />}
        >
          New
        </PageTitle>
        <KindCards
          kind={kind}
          // The kind is the address's: Back leaves the page, not the kind. A session names it too,
          // so that the phone knows a card was picked.
          onPick={(picked, options) => {
            if (options?.focus) {
              if (picked === kind) {
                focusComposer();
              } else {
                wantsFocus.current = true;
              }
            }
            redirect(here(`/new?kind=${picked}`));
          }}
        />
        <div ref={box}>
          {kind === "session" && (
            <Composer
              {...composerDraft(session)}
              inputRef={input}
              onSent={(id) => {
                void takeOut(fate, sources.session);
                navigate(here(sessionIdPath(id)), { created: true });
              }}
            />
          )}
          {kind === "change" && (
            <ChangeComposer inputRef={input} sources={sources.change} text={change} />
          )}
          {kind === "feature" && (
            <FeatureComposer inputRef={input} sources={sources.feature} text={feature} />
          )}
        </div>
        {kind !== undefined && <EntryLists onInsert={insert} search={search} />}
      </VStack>
    </Page>
  );
}
