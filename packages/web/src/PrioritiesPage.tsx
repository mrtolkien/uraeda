import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFateClient } from "react-fate";
import { usePriorities } from "./data.ts";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { PrioritiesList } from "./lists/PrioritiesList.tsx";
import type { WorkLayout } from "./lists/WorkList.tsx";
import { useKeys } from "./keys/registry.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { useOpenAddForm } from "./SidebarAdd.tsx";
import { PrioritiesView } from "./views.ts";
import { PageTitle } from "./layout/PageTitle.tsx";

/** Where the page keeps how its list shows. */
const LAYOUT_KEY = "uraeda:priorities:layout";

const isLayout = (value: string | null): value is WorkLayout =>
  value === "columns" || value === "stack";

/** How the list shows, as columns until the human picks the table, kept in the browser. */
function useListLayout(): [WorkLayout, (layout: WorkLayout) => void] {
  const [layout, setLayout] = useState<WorkLayout>(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_KEY);
      return isLayout(stored) ? stored : "columns";
    } catch {
      // No storage, as in a private window: columns.
      return "columns";
    }
  });
  const choose = (next: WorkLayout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // No storage: the choice lasts until the page closes.
    }
  };
  return [layout, choose];
}

/** The switch between the columns and the table, by their icons; `v` switches too. */
function LayoutSwitch({
  layout,
  onChange,
}: {
  layout: WorkLayout;
  onChange: (layout: WorkLayout) => void;
}) {
  return (
    <SegmentedControl
      label="View"
      onChange={(value) => isLayout(value) && onChange(value)}
      size="sm"
      value={layout}
    >
      <SegmentedControlItem
        icon={<Icon icon="uraeda:columns-3" />}
        isLabelHidden
        label="Columns"
        value="columns"
      />
      <SegmentedControlItem
        icon={<Icon icon="uraeda:rows-3" />}
        isLabelHidden
        label="Table"
        value="stack"
      />
    </SegmentedControl>
  );
}

/**
 * Every line of `PRIORITIES.md`, by section, with the running ones apart in "Ongoing": each opens
 * its task view, drags to its place, and each section ends with an Add row; each change is written
 * at once, and a bar commits or discards them. While a line is dragged, and until its move is
 * written, the list stays as the drag found it: a live update waits for the drag's end. `select`
 * and `isFocused` select a row and focus it, for a mockup.
 */
export function PrioritiesPage({ isFocused, select }: { isFocused?: boolean; select?: string }) {
  const fate = useFateClient();
  const priorities = usePriorities();
  const openForm = useOpenAddForm();
  // The ＋ next to Priorities, from the keyboard: the form in its default place. Not named in the
  // status line.
  useKeys([{ icon: "plus", keys: "a", label: "add", run: () => openForm("priority") }]);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const [message, setMessage] = useState<string>();
  const [layout, setLayout] = useListLayout();
  useKeys([
    {
      hint: "v",
      keys: "v",
      label: "view",
      run: () => setLayout(layout === "columns" ? "stack" : "columns"),
    },
  ]);

  /** Writes a change: a refusal shows where it was made, and a conflict reads the list again. */
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    if (!result.error) {
      return undefined;
    }
    const failed = refusal(result.error);
    if (failed.kind === "conflict") {
      void fate.request(
        { priorities: { id: "priorities", view: PrioritiesView } },
        { mode: "network-only" },
      );
    }
    return failed.message;
  };
  if (!priorities) {
    return null;
  }

  return (
    <Page isFull>
      <VStack gap={2}>
        <PageTitle
          around={(heading) => (
            <HStack align="center" gap={3}>
              {heading}
              <LayoutSwitch layout={layout} onChange={setLayout} />
            </HStack>
          )}
        >
          Priorities
        </PageTitle>
        {message && <AnnouncedBanner collapsible={false} status="error" title={message} />}
        <PrioritiesList
          isFocused={isFocused}
          layout={layout}
          onMoveRefused={setMessage}
          priorities={priorities}
          run={run}
          select={select}
        />
      </VStack>
    </Page>
  );
}
