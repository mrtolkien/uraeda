// The New page, behind the sidebar's "＋ New": three cards, in the URL, pick a session, a change, or
// a feature, each drawn as what it starts. Under them, the kind's composer, over the one draft the
// three share, and under it the same list for all three: the inbox's notes and the priorities'
// proposals, which a card inserts into the composer, with a link to its file, or, with a file of
// its own, opens. A session starts with its first message; a change with Ctrl+Enter, which asks
// for its slug; a feature with Ctrl+Enter too, which asks for its slug and research effort, then
// opens its session. The entries a start was filled from leave their files. `/` searches the
// entries.
import type { ChatComposerInputHandle } from "@astryxdesign/core/Chat";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { SET_UP_PROJECT } from "uraeda-server/round-messages";
import { Composer } from "./Composer.tsx";
import { usePriorities, useWorkspace } from "./data.ts";
import { useKeys } from "./keys/registry.tsx";
import { KindCards } from "./KindCards.tsx";
import { Page } from "./layout/Page.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { ChangeComposer } from "./NewChangePage.tsx";
import { type Entry, EntryLists, lineEntry } from "./NewEntries.tsx";
import { FeatureComposer } from "./NewFeatureComposer.tsx";
import { type NewDraft, useNewDraft } from "./newDraft.ts";
import { withInserted } from "./RecommendedMessage.tsx";
import { currentEntry } from "./routeHistory.ts";
import {
  type NewKind,
  navigate,
  redirect,
  sessionIdPath,
  useRepoPath,
  useRestoreScroll,
  useEntryId,
  useSearch,
} from "./routes.tsx";
import { composerDraft } from "./useDraft.ts";
import { takeOut } from "./takeOut.ts";

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
 * The composer's focus: `input` is its field, `box` what holds it, and `focusComposer` gives it the
 * focus; `focusOnDraw` asks for it once the kind picked draws its composer.
 */
function useComposerFocus(kind: NewKind | undefined) {
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
  const focusOnDraw = () => {
    wantsFocus.current = true;
  };
  return { box, focusComposer, focusOnDraw, input };
}

/**
 * A proposal's Start opens the page with its line to put in the composer, in place of what it
 * held: once, as soon as the priorities and the composer are there, and not again on a reload.
 */
function LineInsert({ kind, start }: { kind: NewKind | undefined; start: (entry: Entry) => void }) {
  const here = useRepoPath();
  const priorities = usePriorities();
  useEffect(() => {
    const wanted = currentEntry().insert?.replace(/^line:/, "");
    const section = priorities?.sections.find((each) =>
      each.proposals.some((proposal) => proposal.id === wanted),
    );
    const line = section?.proposals.find((proposal) => proposal.id === wanted);
    if (section === undefined || line === undefined || kind === undefined) {
      return;
    }
    const { insert: _, ...rest } = currentEntry();
    window.history.replaceState(rest, "");
    start(lineEntry(line, section.section, here));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, when the line and the composer are there
  }, [priorities, kind]);
  return null;
}

/**
 * Home's "Set up with the agent" opens a session with the setup's message, focused as an inserted
 * entry is, unsent. The history entry keeps asking for it, so a reload, which keeps the draft,
 * leaves the message it holds already. A composer that holds text keeps it, after the message, as a
 * recommended message is inserted; each visit inserts it once, though the cards switch.
 */
function useSetupMessage({
  draft,
  input,
  kind,
}: {
  draft: NewDraft;
  input: React.RefObject<ChatComposerInputHandle | null>;
  kind: NewKind | undefined;
}) {
  const visit = useEntryId();
  const inserted = useRef(new Set<string | undefined>());
  useEffect(() => {
    if (currentEntry().insert !== "setup" || kind !== "session" || inserted.current.has(visit)) {
      return;
    }
    inserted.current.add(visit);
    // A reload keeps the draft: a message it holds already is not inserted twice.
    draft.setText((typed) =>
      typed.startsWith(SET_UP_PROJECT.trimEnd()) ? typed : withInserted(SET_UP_PROJECT, typed),
    );
    requestAnimationFrame(() => input.current?.focus());
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once a visit, when the session's composer is there
  }, [kind, visit]);
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
  // Without specs/, the setup's session alone: no priorities nor inbox to start from.
  const hasSpecs = !useWorkspace()?.noSpecs;
  const { box, focusComposer, focusOnDraw, input } = useComposerFocus(kind);
  // Kept as a new chat's text is: leaving the page does not ask.
  const draft = useNewDraft();
  // The field takes the focus once an entry's text is in: `Escape` goes back to the list's keys.
  const focusSoon = () => requestAnimationFrame(() => input.current?.focus());
  const insert = (entry: Entry) => {
    if (kind !== undefined) {
      draft.insert(entry);
      focusSoon();
    }
  };
  const start = (entry: Entry) => {
    draft.start(entry);
    focusSoon();
  };
  useSetupMessage({ draft, input, kind });
  return (
    <Page kind="panes">
      <VStack gap={4}>
        <PageTitle
          // Beside the title at every width, as on a desktop.
          actions={
            <Search field={searchField} isNarrow={narrow} onChange={setSearch} text={search} />
          }
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
                focusOnDraw();
              }
            }
            redirect(here(`/new?kind=${picked}`));
          }}
        />
        <div ref={box}>
          {kind === "session" && (
            <Composer
              {...composerDraft(draft.kept)}
              inputRef={input}
              onChange={draft.setText}
              onSent={(id) => {
                void takeOut(fate, draft.sources);
                navigate(here(sessionIdPath(id)), { created: true });
              }}
              value={draft.text}
            />
          )}
          {kind === "change" && <ChangeComposer draft={draft} inputRef={input} />}
          {kind === "feature" && <FeatureComposer draft={draft} inputRef={input} />}
        </div>
        {hasSpecs && <LineInsert kind={kind} start={start} />}
        {hasSpecs && kind !== undefined && <EntryLists onInsert={insert} search={search} />}
      </VStack>
    </Page>
  );
}
