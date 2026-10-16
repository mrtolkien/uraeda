// The priorities on the shared list: "Ongoing", the entries whose feature or change runs, in green,
// then Now, Next, Later, and Blocked, in the file's order, each with its colour and its Add row.
// The file keeps the started entries at the top of Now; on screen they show apart.
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { useFateClient } from "react-fate";
import type { PriorityEntry } from "uraeda-server/fate";
import type { usePriorities } from "../data.ts";
import { EditableLine } from "../EditableLine.tsx";
import { stepLabel } from "../labels.ts";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { PrioritiesView } from "../views.ts";
import { type Tone, WorkList, type WorkRow, type WorkSection } from "./WorkList.tsx";

/** The priorities as the page reads them. */
export type Priorities = NonNullable<ReturnType<typeof usePriorities>>;

const TITLES: Record<string, string> = {
  blocked: "Blocked",
  later: "Later",
  next: "Next",
  now: "Now",
};

const TONES: Record<string, Tone> = {
  blocked: "orange",
  later: "gray",
  next: "neutral",
  now: "blue",
};

/** An entry's marks: Running and its step, or Draft, or Backlog. */
function Marks({ entry }: { entry: PriorityEntry }) {
  if (entry.running) {
    return (
      <HStack align="center" gap={2} wrap="wrap">
        <Badge label="Running" variant="green" />
        <Text color="secondary">
          {/* At a human gate, the step is the human's: the feature's page says which. */}
          {entry.running.step.waitsOn === "human"
            ? "Waiting on you"
            : stepLabel(entry.running.step.name)}
        </Text>
      </HStack>
    );
  }
  if (!entry.draft) {
    return null;
  }
  return entry.draft.backlog ? (
    <Badge label="Backlog" variant="neutral" />
  ) : (
    <Badge label="Draft" variant="teal" />
  );
}

/**
 * Where a row dropped at `index` among a section's rows on screen goes in the file: the place of
 * the `index`-th entry that is not running, once the dragged one is taken out, or after the last of
 * them. The running entries show in "Ongoing", so a drop never lands between two of them.
 */
export function fileIndex(entries: ReadonlyArray<PriorityEntry>, key: string, index: number) {
  const rest = entries.filter((entry) => entry.key !== key);
  const places = rest.flatMap((entry, place) => (entry.running ? [] : [place]));
  if (index < places.length) {
    return places[index];
  }
  const last = places.at(-1);
  return last === undefined ? rest.length : last + 1;
}

/**
 * The priorities' sections, with "Ongoing" first, and each section's Add row. `select` is the key
 * of a row to select, for a mockup; otherwise the row open beside the list is. `isFocused` puts the
 * keyboard's focus on it. `run` writes a change and resolves with its refusal, if any; a refused
 * move goes to `onMoveRefused`.
 */
export function PrioritiesList({
  isFocused = false,
  onMoveRefused,
  priorities,
  run,
  select,
}: {
  isFocused?: boolean;
  onMoveRefused?: (message: string | undefined) => void;
  priorities: Priorities;
  run: (call: () => Promise<{ error?: unknown }>) => Promise<string | undefined>;
  select?: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const pathname = useLocalPath();

  const add = (section: string) => (text: string) =>
    run(() =>
      fate.mutations.priorities.add({
        input: { hash: priorities.hash, section, text },
        view: PrioritiesView,
      }),
    );

  const onMove = async (key: string, section: string, index: number) => {
    const entry = priorities.sections
      .flatMap((s) => s.entries)
      .find((candidate) => candidate.key === key);
    const target = priorities.sections.find((s) => s.section === section);
    if (!entry || !target) {
      return;
    }
    // Over the version the drag started from: a list changed meanwhile refuses the move.
    const failed = await run(() =>
      fate.mutations.priorities.move({
        input: {
          entry: entry.id,
          hash: priorities.hash,
          index: fileIndex(target.entries, key, index),
          section,
        },
        view: PrioritiesView,
      }),
    );
    onMoveRefused?.(failed);
  };

  const row = (entry: PriorityEntry): WorkRow => ({
    href: here(`/priorities/${entry.key}`),
    isFixed: entry.running !== undefined,
    key: entry.key,
    lines: entry.nestedSpans.map(plain),
    marks: <Marks entry={entry} />,
    text: plain(entry.spans),
  });

  const ongoing: WorkSection = {
    id: "ongoing",
    isFixed: true,
    rows: priorities.sections.flatMap((section) =>
      section.entries.filter((entry) => entry.running).map(row),
    ),
    title: "Ongoing",
    tone: "green",
  };
  const sections = priorities.sections.map((section): WorkSection => {
    const title = TITLES[section.section] ?? section.section;
    return {
      footer: (
        <EditableLine
          display={
            <>
              <span aria-hidden="true">＋ </span>
              Add to {title}
            </>
          }
          field={`priorities#add:${section.section}`}
          label={`Add to ${title}`}
          onSave={add(section.section)}
          stayOpen
          value=""
        />
      ),
      id: section.section,
      rows: section.entries.filter((entry) => !entry.running).map(row),
      title,
      tone: TONES[section.section] ?? "neutral",
    };
  });
  // "Ongoing" shows only when something runs.
  const all = ongoing.rows.length > 0 ? [ongoing, ...sections] : sections;
  const selected =
    select ??
    all.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)?.key;

  return <WorkList isFocused={isFocused} onMove={onMove} sections={all} selected={selected} />;
}
