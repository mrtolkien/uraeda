// Home's panes of the built-ins, each read by a component of its own and handed to the overview's
// list as a section (`HomePane.section`): the inbox's three latest notes, and the first five
// entries of Now that are not running, which the core above already shows, as the inbox and the
// priorities pages draw them. A note shows its category in its border, none for one without; a
// proposal, its file marked so. A card opens its note or its proposal's pane, and each pane ends
// with its way to its page.
import type { ReactNode } from "react";
import { useInbox, usePriorities } from "../data.ts";
import { byRunning, lookOf } from "../lists/PrioritiesList.tsx";
import type { WorkSection } from "../lists/workSection.ts";
import { useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { plural } from "../labels.ts";
import { proposalFilePage } from "../readAhead.ts";
import { PaneLink } from "./parts.tsx";
import { inboxSummary, NOT_SORTED } from "./summary.ts";

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const PRIORITIES_SHOWN = 5;

type Read = { children: (section: WorkSection) => ReactNode };

/** The inbox's pane: its three latest notes, and the count of all. */
export function InboxHomeSection({ children }: Read) {
  const here = useRepoPath();
  const { count, latest } = inboxSummary(useInbox());
  return children({
    ...(count === 0 ? { context: "The inbox is empty." } : {}),
    // Of all its notes, though three are listed.
    count,
    footer: (
      <PaneLink
        href={here("/inbox")}
        label={count === 0 ? "Open the inbox" : `${plural(count, "note")} to organize`}
      />
    ),
    icon: "uraeda:inbox",
    id: "inbox",
    isFixed: true,
    rows: latest.map((note) => ({
      href: here(`/inbox/${note.key}`),
      ...(note.file === undefined ? {} : { page: proposalFilePage(note.file) }),
      isFixed: true,
      key: note.key,
      lines: note.nestedSpans.map(plain),
      ...(note.category === NOT_SORTED ? {} : { marks: note.category }),
      text: plain(note.spans),
    })),
    title: "Inbox",
    tone: "neutral",
  });
}

/** Priorities now: the first five entries of Now that are not running. */
export function PrioritiesHomeSection({ children }: Read) {
  const here = useRepoPath();
  const priorities = usePriorities();
  const proposals = (
    priorities
      ? (byRunning(priorities).sections.find((s) => s.section === "now")?.proposals ?? [])
      : []
  ).slice(0, PRIORITIES_SHOWN);
  return children({
    ...(proposals.length === 0 ? { context: "Nothing in Now." } : {}),
    footer: <PaneLink href={here("/priorities")} label="Open priorities" />,
    icon: "uraeda:list",
    id: "now",
    isFixed: true,
    rows: proposals.map((proposal) => ({
      href: here(`/priorities/${proposal.key}`),
      ...(proposal.file ? { page: proposalFilePage(proposal.file.path) } : {}),
      ...lookOf(proposal),
      isFixed: true,
      key: proposal.key,
      lines: proposal.nestedSpans.map(plain),
      text: plain(proposal.spans),
    })),
    title: "Priorities now",
    tone: "now",
  });
}
