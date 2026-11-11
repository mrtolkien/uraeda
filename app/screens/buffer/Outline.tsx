// A Markdown file's outline, drawn by the library's `Outline`: its headings, indented by level, as
// the text typed has them now, so it follows the edit. `Enter` or a press puts the editor's caret on the heading, and focuses it.
import { computed } from "nsh";
import { outline } from "uraeda/native";
import { askLine } from "../editor/jump";
import { bufferKey } from "../editor/FileEditor";
import { record } from "../../store";
import { focusPane, PaneScroll, type PaneRef, usePane } from "../../ui/layout";
import { createCursor, Outline as OutlineList } from "../../ui/lists";
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
      <OutlineList
        cursor={cursor}
        emptyWords="A line that starts with # is one."
        heading={(id) => {
          const heading = headings()[Number(id)];
          return heading === undefined
            ? undefined
            : { id, level: heading.level, title: heading.title };
        }}
        onOpen={open}
        top={Math.min(...headings().map((heading) => heading.level), 6)}
        testID="buffer-outline"
      />
    </PaneScroll>
  );
}
