// The History pane, lazygit's commits panel: the main checkout's branch, newest first, each commit
// a line of its subject and when, `↓` on one only `origin` has, `↑` on one only the branch has.
// Moving onto a commit shows it in the Diff pane, its message and every file's change; the last
// row reads the next page. The pages read are kept in the visit, so Back finds them.
import { computed, effect, untracked, View } from "nsh";
import { gitPage } from "./Sync";
import { pick } from "./picked";
import { ago } from "./when";
import { record } from "../../store";
import type { GitCommitRow } from "../../store/protocol";
import { tokens } from "../../ui/tokens";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { PaneScroll, usePane } from "../../ui/layout";

/** The id of the row that reads the next page. */
const MORE = "more";

export function History(props: { narrow: boolean; onOpen: () => void; repo: string }) {
  const pane = usePane();
  const page = gitPage(props.repo);
  const pages = pane.remember<number>("pages", 0);

  // The commits: the page's first ones, then each page read after them, in order.
  const commits = computed(() => {
    const first = page();
    if (first === undefined || first === null) return { hasMore: false, rows: [] };
    const rows: Array<GitCommitRow> = [...first.history];
    let hasMore = first.hasMoreHistory;
    for (let read = 0; read < pages() && hasMore && rows.length > 0; read += 1) {
      const next = record("GitHistoryPage", { after: rows.at(-1)!.id, repo: props.repo })();
      if (next === undefined || next === null) break;
      rows.push(...next.commits);
      hasMore = next.hasMore;
    }
    return { hasMore, rows };
  });
  const byId = computed(() => new Map(commits().rows.map((row) => [row.id, row])));
  const items = computed(() => [
    ...commits().rows.map((row) => ({ id: row.id })),
    ...(commits().hasMore ? [{ id: MORE }] : []),
  ]);
  const at = pane.remember<string | null>("cursor", null);
  const cursor = createCursor(items, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  // The Diff pane shows the commit under the cursor.
  effect(() => {
    const id = cursor.at();
    if (id !== undefined && id !== MORE) untracked(() => pick({ id, kind: "commit" }));
  });

  // The pane opens on its first commit, or on the one it was left on.
  effect(() => {
    const first = items()[0];
    if (untracked(cursor.at) === undefined && first !== undefined)
      untracked(() => cursor.set(first.id));
  });

  const open = (id: string) => {
    if (id === MORE) pages.set(pages() + 1);
    else props.onOpen();
  };
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ paddingBottom: 16 }}>
        <List
          cursor={cursor}
          empty={<Empty icon="history" title="No commits yet" words="The branch has no commit." />}
          onOpen={open}
          openLabel="open"
          row={(id) => (
            <If
              when={byId().get(id())}
              else={<Line icon="chevrons-down" label="Show older commits" />}
            >
              {(row) => (
                <Line
                  hue={
                    row().mark === "pull"
                      ? tokens.role.needsYou
                      : row().mark === "push"
                        ? tokens.role.action
                        : undefined
                  }
                  icon={
                    row().mark === "pull"
                      ? "arrow-down"
                      : row().mark === "push"
                        ? "arrow-up"
                        : "git-commit-horizontal"
                  }
                  label={row().subject}
                  meta={
                    // A narrow stack gives the subject the room: the arrow says pull or push.
                    props.narrow || row().mark === ""
                      ? ago(row().authored)
                      : `to ${row().mark} · ${ago(row().authored)}`
                  }
                />
              )}
            </If>
          )}
          testID="git-history"
        />
      </View>
    </PaneScroll>
  );
}
