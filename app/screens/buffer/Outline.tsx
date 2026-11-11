// A Markdown file's outline: its headings, indented by level, as the text typed has them now, so
// it follows the edit. `Enter` or a press puts the editor's caret on the heading, and focuses it.
import { computed, View } from "nsh";
import { outline } from "uraeda/native";
import { askLine } from "../editor/jump";
import { bufferKey } from "../editor/FileEditor";
import { record } from "../../store";
import { focusPane, PaneScroll, type PaneRef, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { readUnsaved } from "../../ui/text";

export function Outline(props: { editor: PaneRef; path: string; repo: string }) {
  const pane = usePane();
  const buffer = record("Buffer", { path: props.path, repo: props.repo });
  const key = bufferKey(props.repo, props.path);
  // The text the editor shows: the one typed, else the file's.
  const text = () => readUnsaved(key)?.text ?? buffer()?.text ?? "";
  const headings = computed(() => outline(text()));
  const items = computed(() => headings().map((_, index) => ({ id: String(index) })));
  const picked = pane.remember<string | null>("picked", null);
  const open = (id: string) => {
    const heading = headings()[Number(id)];
    if (heading === undefined) return;
    askLine(key, heading.line);
    focusPane(props.editor);
  };
  const cursor = createCursor(items, {
    initial: picked() ?? undefined,
    onChange: (id) => picked.set(id ?? null),
  });
  return (
    <PaneScroll style={{ flex: 1 }}>
      <List
        cursor={cursor}
        empty={<Empty icon="list" title="No headings" words="A line that starts with # is one." />}
        onOpen={open}
        openLabel="go to"
        row={(id) => {
          const heading = () => headings()[Number(id())];
          return (
            <>
              <View style={{ width: 12 * ((heading()?.level ?? 1) - 1) }} />
              <Line label={heading()?.title ?? ""} />
            </>
          );
        }}
        testID="buffer-outline"
      />
    </PaneScroll>
  );
}
