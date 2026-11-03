// The commit page, the one place the inbox's, the priorities', the proposal and note files', and the
// buffers' edits are committed: every form, list, and buffer only edits and saves a file, and this
// page shows a pane per branch with changes, the default branch's first, each with what its commit
// would hold, as the core lists it, its message, and its own Commit, and Discard, which asks first.
// With one pane, on the phone, both sit in the bottom bar's two corners. `j` and `k` pick a pane
// among several, which Enter and `d` act on. The sidebar's Commit button, the phone's tab, and
// `g c` lead here while something waits.
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useRef, useState } from "react";
import { BranchPane } from "./commit/BranchPane.tsx";
import { useCommitPanes } from "./commit/useCommitPanes.ts";
import { usePaneWrites } from "./commit/usePaneWrites.ts";
import { useKeys } from "./keys/registry.tsx";
import { plural } from "./labels.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Page } from "./layout/Page.tsx";
import { NavTile, NavTiles } from "./layout/NavBar.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useLocalPath, useRestoreScroll } from "./routes.tsx";
import { RefusedHere } from "./writes/RefusedHere.tsx";
import { useRefusal } from "./writes/useWriteQueue.ts";

/**
 * On the phone, the bottom bar: Discard in its left corner, and Commit, in the accent, in its
 * right one. Like the Commit button, it blocks nothing: a second press while the commit has not
 * answered yet does nothing, so one press makes one write.
 */
function CommitBar({
  onCommit,
  onDiscard,
}: {
  onCommit: () => Promise<unknown>;
  onDiscard: () => void;
}) {
  const answering = useRef(false);
  const commit = () => {
    if (answering.current) {
      return;
    }
    answering.current = true;
    void onCommit().finally(() => {
      answering.current = false;
    });
  };
  return (
    <TopBarSlot>
      <NavTiles label="The commit's actions">
        <NavTile icon="uraeda:trash" label="Discard" onPress={onDiscard} />
        <NavTile icon="uraeda:save" isTinted label="Commit" onPress={commit} />
      </NavTiles>
    </TopBarSlot>
  );
}

/**
 * What waits for a commit, a pane per branch, and what each pane's commit and discard do. A
 * feature's pane writes on its branch, refused while its agent works; a hook's refusal shows here,
 * and the changes stay. The commit lands behind the page, in the toast: its refusal, once it comes,
 * replaces the page's "Committed.".
 */
export function CommitPage() {
  const panes = useCommitPanes()?.panes;
  const [picked, setPicked] = useState(0);
  const narrow = isNarrow(useWidthClass());
  const here = { href: useLocalPath() };
  const refused = useRefusal(here) !== undefined;
  const { commit, discard, messageOf, outcome, setMessage } = usePaneWrites(here, panes);
  useRestoreScroll(true);
  const all = panes ?? [];
  const at = Math.min(picked, Math.max(all.length - 1, 0));
  const count = all.reduce((sum, pane) => sum + pane.count, 0);
  const current = all[at];
  const step = (by: 1 | -1) => () => setPicked(Math.min(Math.max(at + by, 0), all.length - 1));
  useKeys([
    ...(current
      ? [
          {
            hint: "⏎",
            keys: "Enter",
            label: "commit",
            run: () => void commit(current),
            // A focused button's own Enter presses it: only the page's Enter commits.
            when: (target: EventTarget | null) =>
              target === document.body || target === document.documentElement,
          },
          { keys: "mod+Enter", label: "commit", run: () => void commit(current) },
          { hint: "d", keys: "d", label: "discard", run: () => void discard(current) },
        ]
      : []),
    ...(all.length > 1
      ? [
          { hint: "j k", keys: "j", label: "move", run: step(1) },
          { keys: "k", label: "previous branch", run: step(-1) },
        ]
      : []),
  ]);
  if (!panes) {
    return null;
  }
  const meta =
    count === 0
      ? "Nothing waits"
      : `${plural(count, "change")}${all.length > 1 ? `, on ${all.length} branches` : ""}`;
  // On the phone, one pane's Commit and Discard sit in the bottom bar; several keep their own.
  const barred = narrow && all.length === 1;
  return (
    <Page kind="rows">
      <VStack gap={4}>
        <PageTitle meta={{ text: meta }}>Commit</PageTitle>
        <RefusedHere what="the changes wait, not committed." where={here} />
        {outcome?.ok && !refused && (
          <AnnouncedBanner collapsible={false} status="success" title={outcome.text} />
        )}
        {all.map((pane, index) => (
          <VStack gap={2} key={pane.branch}>
            {outcome && !outcome.ok && outcome.branch === pane.branch && (
              <AnnouncedBanner collapsible={false} status="error" title={outcome.text} />
            )}
            <BranchPane
              hasButtons={!barred}
              isPicked={all.length > 1 && index === at}
              message={messageOf(pane)}
              onCommit={() => commit(pane)}
              onDiscard={() => void discard(pane)}
              onMessage={(message) => setMessage(pane.branch, message)}
              pane={pane}
            />
          </VStack>
        ))}
        {count === 0 && (
          <Text color="secondary">
            The inbox, the priorities, and the proposal and note files are all committed.
          </Text>
        )}
        {barred && current && (
          <CommitBar onCommit={() => commit(current)} onDiscard={() => void discard(current)} />
        )}
      </VStack>
    </Page>
  );
}
