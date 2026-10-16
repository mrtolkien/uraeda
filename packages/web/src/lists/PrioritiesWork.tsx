// The priorities page drawn with the shared list: Now, Next, Later, and Blocked, in the file's
// order, each with its colour; in Now, the running entries first, with their feature's step.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useFateClient } from "react-fate";
import type { EntryItem, PriorityView } from "uraeda-binding";
import { CommitBar } from "../CommitBar.tsx";
import { usePriorities, useWorkspace } from "../data.ts";
import { EditableLine } from "../EditableLine.tsx";
import { refusal } from "../errors.ts";
import { stepLabel, waiting } from "../labels.ts";
import { Page } from "../layout/Page.tsx";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { PrioritiesView } from "../views.ts";
import { KeysHint, type Tone, WorkList, type WorkRow, type WorkSection } from "./WorkList.tsx";

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

/** What the list draws of an entry beyond its text: running, with its step; drafted; or backlog. */
type Standing = { backlog: boolean; draft: boolean; step?: string };

/** Whether a link points into `specs/backlog/`. */
function isBacklog(link: string | undefined) {
  return link !== undefined && /(^|\/)specs\/backlog\//.test(link);
}

/** An entry's marks: Running and its step, or Draft, or Backlog. */
function Marks({ standing }: { standing: Standing }) {
  if (standing.step !== undefined) {
    return (
      <HStack align="center" gap={2} wrap="wrap">
        <Badge label="Running" variant="green" />
        <Text color="secondary">{standing.step}</Text>
      </HStack>
    );
  }
  if (standing.draft) {
    return <Badge label="Draft" variant="teal" />;
  }
  return standing.backlog ? <Badge label="Backlog" variant="neutral" /> : null;
}

/**
 * How each entry stands, by its key. TEMPORARY: joins the workspace's priorities to the priorities'
 * entries by `key`, and reads a running entry from its feature's step; the core will send
 * `running`, `draft`, and `backlog` on the entry itself.
 */
function useStandings(): Map<string, Standing> | undefined {
  const workspace = useWorkspace();
  if (!workspace) {
    return undefined;
  }
  const features = new Map(workspace.features.map((f) => [f.folder, f] as const));
  const standing = (priority: PriorityView): Standing => {
    const feature = priority.feature === undefined ? undefined : features.get(priority.feature);
    const isRunning = feature !== undefined && feature.step.name !== "done";
    return {
      backlog: isBacklog(priority.link),
      draft: priority.draft !== undefined,
      // At a human gate, what it waits for, like "Review the spec"; otherwise its step.
      step: !isRunning
        ? undefined
        : feature.step.waitsOn === "human"
          ? waiting(feature).title
          : stepLabel(feature.step.name),
    };
  };
  return new Map(workspace.priorities.map((p) => [p.key, standing(p)] as const));
}

/**
 * The priorities' list: each section's entries, Now's running ones first, and each section's Add
 * row. `select` picks a row of Now by its place, for a mockup of the selection; otherwise the row
 * open beside the list is selected. `isFocused` puts the keyboard's focus on it, and `hasHint`
 * shows the keys once.
 */
export function PrioritiesWork({
  hasHint = false,
  isFocused = false,
  select,
}: {
  hasHint?: boolean;
  isFocused?: boolean;
  select?: number;
}) {
  const fate = useFateClient();
  const priorities = usePriorities();
  const standings = useStandings();
  const here = useRepoPath();
  const pathname = useLocalPath();
  if (!priorities || !standings) {
    return null;
  }

  const add = (section: string) => async (text: string) => {
    const result = await fate.mutations.priorities.add({
      input: { hash: priorities.hash, section, text },
      view: PrioritiesView,
    });
    return result.error ? refusal(result.error).message : undefined;
  };

  const row = (entry: EntryItem): WorkRow => {
    const standing = standings.get(entry.key) ?? { backlog: false, draft: false };
    return {
      href: here(`/priorities/${entry.key}`),
      isFixed: standing.step !== undefined,
      key: entry.key,
      lines: entry.nestedSpans.map(plain),
      marks: <Marks standing={standing} />,
      text: plain(entry.spans),
    };
  };

  const sections = priorities.sections.map((section): WorkSection => {
    const title = TITLES[section.section] ?? section.section;
    const rows = section.entries.map(row);
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
      isLarge: section.section === "now",
      // Running entries first: they cannot be moved, and the file keeps them at the top of Now.
      rows: [...rows.filter((r) => r.isFixed), ...rows.filter((r) => !r.isFixed)],
      title,
      tone: TONES[section.section] ?? "neutral",
    };
  });
  const now = sections.find((section) => section.id === "now");
  const selected =
    select === undefined
      ? sections.flatMap((section) => section.rows).find((r) => pathname === `/priorities/${r.key}`)
          ?.key
      : now?.rows[select]?.key;

  return (
    <Page>
      <VStack gap={2}>
        <Heading level={1}>Priorities</Heading>
        {hasHint && <KeysHint />}
        <WorkList isFocused={isFocused} sections={sections} selected={selected} />
        <CommitBar changes={priorities.changes} />
      </VStack>
    </Page>
  );
}
