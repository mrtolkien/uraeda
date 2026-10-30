// The priorities on the shared list, as an outliner (see `useOutline`): "Ongoing", the proposals
// whose feature or change runs, in green, then Now, Next, Later, and Blocked, in the file's order,
// as columns, each with its context, its colour, and its Add row. Blocked shows only when it has
// proposals. Each proposal draws its nested items as rows of their own, at any depth, edited in
// place. The file keeps the started proposals at the top of Now; on screen they show apart.
import { useEffect, useState } from "react";
import { useFateClient } from "react-fate";
import type { Proposal } from "uraeda-server/fate";
import { readPrioritiesHash, type usePriorities } from "../data.ts";
import { stepKindOf } from "../sidebar/cards.ts";
import { STEP_ICONS } from "../sidebar/StepIcon.tsx";
import { titleOf, TITLES } from "../QuickAdd.tsx";
import { refusal } from "../errors.ts";
import { currentEntry, navigate, useHash, useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { ProposalFileView, PrioritiesView } from "../views.ts";
import { fileIndex } from "./cardMoves.ts";
import { type Outline, type OutlineItem, useOutline } from "./useOutline.tsx";
import {
  type Tone,
  type WorkLayout,
  WorkList,
  type WorkRow,
  type WorkSection,
} from "./WorkList.tsx";
import { proposalFilePage } from "../readAhead.ts";

/** The priorities as the page reads them. */
export type Priorities = NonNullable<ReturnType<typeof usePriorities>>;

const TONES: Record<string, Tone> = {
  later: "gray",
  next: "neutral",
  now: "blue",
};

/**
 * What a proposal's row draws of it besides its text: the icon of the step running on it, as the
 * sidebar draws it, or an icon for its file. Either way its text is a hyperlink: a click leads to
 * its feature's page, or its file's.
 */
export function lookOf(proposal: Proposal) {
  if (proposal.running) {
    return { icon: STEP_ICONS[stepKindOf(proposal.running.step)], isLinked: true };
  }
  return proposal.file ? { icon: "uraeda:file-text" as const, isLinked: true } : {};
}

/**
 * The priorities as the lists show them (R10): the running proposals of every section, apart, then
 * each section with its proposals not running. Each keeps the file's order.
 */
export function byRunning(priorities: Pick<Priorities, "sections">) {
  return {
    ongoing: priorities.sections.flatMap((section) =>
      section.proposals.filter((proposal) => proposal.running),
    ),
    sections: priorities.sections.map((section) => ({
      ...section,
      proposals: section.proposals.filter((proposal) => !proposal.running),
    })),
  };
}

/** The priorities as the outliner reads them: a running proposal stays as it is. */
function outlineOf(priorities: Priorities): Outline<Proposal> {
  return {
    hash: priorities.hash,
    sections: priorities.sections.map((section) => ({
      id: section.section,
      items: section.proposals.map((proposal) => ({
        children: proposal.children,
        id: proposal.id,
        isFixed: proposal.running !== undefined,
        key: proposal.key,
        source: proposal,
        spans: proposal.spans,
        // Its file is found by its link, a proposal line's: nested, it would have none.
        staysItem: proposal.file !== undefined,
        text: proposal.text,
      })),
    })),
  };
}

/** How a list writes a change: it resolves with its refusal, if any. */
type Run = (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>;

/**
 * The priorities as an outliner (see `useOutline`): each write goes through `run`, and a refused
 * one to `onMoveRefused`.
 */
function usePrioritiesOutline(
  priorities: Priorities,
  run: Run,
  onMoveRefused: ((message: string | undefined) => void) | undefined,
) {
  const fate = useFateClient();
  return useOutline(
    priorities,
    {
      add: (now, section, text) =>
        run(() =>
          fate.mutations.proposals.add({
            input: { hash: now.hash, section, text },
            view: PrioritiesView,
          }),
        ),
      drop: (now, from, to) => {
        // A proposal among a section's proposals counts them as they show, the running ones apart.
        const target = now.sections.find((s) => "section" in to && s.section === to.section);
        return run(() =>
          fate.mutations.proposals.drop({
            input: {
              ...(from.at === undefined ? {} : { at: from.at }),
              hash: now.hash,
              proposal: from.id,
              ...("under" in to
                ? {
                    index: to.index,
                    under: to.under.id,
                    ...(to.under.at === undefined ? {} : { underAt: to.under.at }),
                  }
                : {
                    index: fileIndex(target?.proposals ?? [], "", to.index),
                    section: to.section,
                  }),
            },
            view: PrioritiesView,
          }),
        );
      },
      edit: (now, id, at, kind, text) =>
        run(() =>
          fate.mutations.proposals.outline({
            input: {
              ...(at === undefined ? {} : { at }),
              hash: now.hash,
              kind,
              proposal: id,
              ...(text === undefined ? {} : { text }),
            },
            view: PrioritiesView,
          }),
        ),
      held: () => readPrioritiesHash(fate, "cache-first"),
      read: outlineOf,
    },
    onMoveRefused,
    { edit: "Edit the proposal", fresh: "New proposal" },
  );
}

/** The priorities' outline, as `useOutline` gives it. */
type PrioritiesOutline = ReturnType<typeof usePrioritiesOutline>;

/** The address's hash that opens a new proposal's row at the top of Now: New's Proposal. */
export const NEW_PROPOSAL_HASH = "#new-proposal";

/**
 * Opens a new row at the top of Now when the address asks for it with `NEW_PROPOSAL_HASH`, as New
 * does, then takes the hash out of the address, so a reload or Back does not open another.
 */
function useNewAtTop(outline: PrioritiesOutline) {
  const hash = useHash();
  const { openAt } = outline;
  useEffect(() => {
    if (hash !== NEW_PROPOSAL_HASH) {
      return;
    }
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", `${pathname}${search}`);
    // After the page placed its focus, on its first row as it opens, which the new row's field
    // would lose, and an empty new row is dropped when it loses the focus. Not cancelled as the
    // hash goes: taking it out draws the page again.
    requestAnimationFrame(() => openAt("now", 0));
  }, [hash, openAt]);
}

/**
 * The sections the list draws, from the `outline`: "Ongoing" first, when something runs, then each
 * section, with its context and its Add row. `here` is the repository's path of a page.
 */
function sectionsOf(
  outline: PrioritiesOutline,
  priorities: Priorities,
  here: (path: string) => string,
): Array<WorkSection> {
  /** A proposal's row, with its nested rows, at `index` of its section in the file. */
  const row = (item: OutlineItem<Proposal>, section: string, index: number): WorkRow => {
    const proposal = item.source;
    const href = here(`/priorities/${item.key}`);
    const { isWritten, ...drawn } = outline.rowOf(item, { index, section }, href);
    return {
      ...drawn,
      // A proposal with a file, or running, opens its page; any other is edited in place.
      editsInPlace: isWritten && !proposal?.running && !proposal?.file,
      href,
      ...(proposal?.file ? { page: proposalFilePage(proposal.file.path) } : {}),
      ...(proposal ? lookOf(proposal) : {}),
      text: plain(item.spans),
    };
  };

  const ongoing: WorkSection = {
    id: "ongoing",
    isFixed: true,
    rows: outline.drawn.sections.flatMap((section) =>
      section.items.flatMap((item, index) =>
        item.source?.running ? [row(item, section.id, index)] : [],
      ),
    ),
    title: "Ongoing",
    tone: "green",
  };
  // A Blocked without proposals is not drawn (R1): the file keeps it, the page does not show it.
  const visible = outline.drawn.sections.filter(
    (section) => section.id !== "blocked" || section.items.some((item) => !item.source?.running),
  );
  const sections = visible.map((section): WorkSection => {
    const title = titleOf(section.id);
    const context = priorities.sections.find((one) => one.section === section.id)?.context;
    return {
      context: context ?? undefined,
      id: section.id,
      rows: [
        ...section.items.flatMap((item, index) =>
          item.source?.running ? [] : [row(item, section.id, index)],
        ),
        // The section's last row adds a proposal: the keyboard's cursor stops on it, and Enter
        // opens a new row at the section's end (the form has no Blocked, R80).
        ...(TITLES.has(section.id)
          ? [
              {
                href: here(`/priorities#add-${section.id}`),
                icon: "uraeda:plus" as const,
                isAdd: true,
                isFixed: true,
                key: `add:${section.id}`,
                lines: [],
                spot: { index: section.items.length, section: section.id },
                text: `Add to ${title}`,
              },
            ]
          : []),
      ],
      title,
      tone: TONES[section.id] ?? "neutral",
    };
  });
  // "Ongoing" shows only when something runs.
  return ongoing.rows.length > 0 ? [ongoing, ...sections] : sections;
}

/**
 * What a proposal's keys open or make: Enter or a click on a row not edited in place, `p`, and `s`.
 * A failed expand goes to `onMoveRefused`.
 */
function useProposalKeys(
  priorities: Priorities,
  outline: PrioritiesOutline,
  onMoveRefused: ((message: string | undefined) => void) | undefined,
) {
  const fate = useFateClient();
  const here = useRepoPath();

  /** The proposal of a row: itself, or the proposal a nested row is in. */
  const proposalOf = (row: WorkRow) =>
    priorities.sections
      .flatMap((section) => section.proposals)
      .find((proposal) => proposal.key === (row.parent ?? row.key));

  /**
   * Enter or a click on a row not edited in place: a proposal that runs opens its feature, one with
   * a file opens the file's page, and an Add row opens a new row at its section's end.
   */
  const open = (href: string) => {
    const adding = /#add-([a-z]+)$/.exec(href)?.[1];
    if (adding !== undefined) {
      outline.openAt(adding);
      return;
    }
    const proposal = priorities.sections
      .flatMap((s) => s.proposals)
      .find((candidate) => here(`/priorities/${candidate.key}`) === href);
    if (proposal?.running) {
      navigate(here(`/f/${proposal.running.folder}`));
    } else if (proposal?.file) {
      navigate(here(`/edit/${proposal.file.path}`));
    }
  };

  /**
   * `p`: the proposal is expanded into a file, its text under "What", and the file's page opens
   * with the focus in its text. A proposal with a file opens it; one that runs or links another
   * file has none to make. A nested row's is its proposal's.
   */
  const onPromote = (row: WorkRow) => {
    const proposal = proposalOf(row);
    if (!proposal || proposal.running || proposal.spans.some((span) => span.link?.path)) {
      return proposal?.file
        ? void navigate(here(`/edit/${proposal.file.path}`), { focus: "text" })
        : false;
    }
    void (async () => {
      const made = await fate.mutations.proposals.expand({
        input: { hash: priorities.hash, proposal: proposal.id },
        view: ProposalFileView,
      });
      const path = made.result?.path;
      if (made.error || typeof path !== "string") {
        onMoveRefused?.(made.error ? refusal(made.error).message : "Nothing was made.");
        return;
      }
      navigate(here(`/edit/${path}`), { focus: "text" });
    })();
    return undefined;
  };

  /**
   * `s`: the New page, its composer holding the proposal, its nested rows, and a link to the file;
   * nothing starts before the human sends it. A proposal with a file starts from its file's page;
   * a running one has started.
   */
  const onStart = (row: WorkRow) => {
    const proposal = proposalOf(row);
    if (!proposal || proposal.running) {
      return;
    }
    if (proposal.file) {
      navigate(here(`/edit/${proposal.file.path}`));
      return;
    }
    navigate(here("/new?kind=feature"), { insert: `line:${proposal.id}` });
  };

  return { onPromote, onStart, open };
}

/**
 * The page opens on the row its arrival names, as a note just moved there, with the keyboard's
 * focus on it, once: `arrival` is that row, if any, and `isArriving` holds for the page's first
 * render.
 */
function useArrival() {
  const [arrival] = useState(() => currentEntry().select);
  // That row in the middle of the screen, once drawn: the page just opened, nothing moves.
  useEffect(() => {
    if (arrival === undefined) {
      return undefined;
    }
    const frame = requestAnimationFrame(() =>
      document
        .querySelector(`[data-row-key="${CSS.escape(arrival)}"]`)
        ?.scrollIntoView({ block: "center" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [arrival]);
  // The first committed render's, and the frame after it: the list's focus is put on the row then,
  // and a later render of the page moves it no more.
  const [isArriving, setArriving] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArriving(false));
    return () => cancelAnimationFrame(frame);
  }, []);
  return { arrival, isArriving };
}

/**
 * The priorities' sections, with "Ongoing" first, and each section's Add row. `select` is the key
 * of a row to select, for a mockup; otherwise the row whose overlay is open is. `isFocused` puts the
 * keyboard's focus on it. `run` writes a change and resolves with its refusal, if any; a refused
 * write goes to `onMoveRefused`.
 */
export function PrioritiesList({
  isFocused = false,
  layout = "columns",
  onMoveRefused,
  priorities,
  run,
  select,
}: {
  isFocused?: boolean;
  /** As the human picked it: columns or the table, at any width. */
  layout?: WorkLayout;
  onMoveRefused?: (message: string | undefined) => void;
  priorities: Priorities;
  run: Run;
  select?: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();
  const outline = usePrioritiesOutline(priorities, run, onMoveRefused);
  useNewAtTop(outline);
  const all = sectionsOf(outline, priorities, here);
  const { onPromote, onStart, open } = useProposalKeys(priorities, outline, onMoveRefused);

  /** A proposal moved by a drop or its keys, in turn with the outline's writes. */
  const onMove = (key: string, section: string, index: number) =>
    outline.write((now) => {
      const proposal = now.sections.flatMap((s) => s.proposals).find((one) => one.key === key);
      const target = now.sections.find((s) => s.section === section);
      if (!proposal || !target) {
        return Promise.resolve("The proposal or its section is no longer in PRIORITIES.md.");
      }
      return run(() =>
        fate.mutations.proposals.move({
          input: {
            hash: now.hash,
            index: fileIndex(target.proposals, key, index),
            proposal: proposal.id,
            section,
          },
          view: PrioritiesView,
        }),
      );
    });

  const { arrival, isArriving } = useArrival();
  // Else on the highest row of Now.
  const firstNow = all.find((section) => section.id === "now")?.rows[0]?.key;
  const selected =
    select ??
    all.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)?.key;

  return (
    <WorkList
      follow={outline.follow}
      initial={arrival ?? firstNow}
      isFocused={isFocused || isArriving}
      isLayoutChosen
      isRoomy
      layout={layout}
      onAddBeside={(_section, row, isAbove) => outline.onAddBeside(row, isAbove)}
      onDelete={outline.onDelete}
      onMove={onMove}
      onNest={outline.onNest}
      onOpen={open}
      onOutline={outline.onOutline}
      onPromote={onPromote}
      onStart={onStart}
      sections={all}
      selected={selected}
    />
  );
}
