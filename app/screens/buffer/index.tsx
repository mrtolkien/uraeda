// The pages of a file edited whole: `/buffer/<path>`, any text file of the repository as a buffer,
// read or edited, and `/edit/<path>`, a workflow file's Markdown source, opened from its page
// when the rendered page is not enough. Both are the file's editor in the main stack, and for a
// Markdown file its outline in the side stack, whose headings move the caret. A buffer stays open
// after a save, as Vim's does, and `:q`, Escape, or `b` go back; a source goes back to its page as
// it is saved too.
import { Outline } from "./Outline";
import { FileEditor } from "../editor/FileEditor";
import { back, navigate, route } from "../../store";
import { definePane, definePlace } from "../../ui/layout";

type Args = { path: string; repo: string; source: boolean };

/** Back to the page the editor was opened from, or home when it was the first one opened. */
function leave() {
  if (!back()) navigate({ page: "home" });
}

const nameOf = (path: string) => path.split("/").pop() ?? path;

export const bufferPane = definePane<Args>({
  icon: "file-pen-line",
  kind: "buffer",
  stack: "main",
  title: (args) => nameOf(args.path),
  view: (props) => (
    <FileEditor
      leavesOnSave={props.args.source}
      onLeave={leave}
      path={props.args.path}
      repo={props.args.repo}
    />
  ),
});

export const outlinePane = definePane<{ path: string; repo: string; source: boolean }>({
  icon: "list",
  kind: "buffer-outline",
  stack: "side",
  title: "Outline",
  view: (props) => (
    <Outline editor={bufferPane(props.args)} path={props.args.path} repo={props.args.repo} />
  ),
});

/** The panes of a file's page: its editor, and for Markdown its outline. */
function panes(shown: { path: string; repo?: string }, source: boolean) {
  const repo = shown.repo ?? route().repo ?? "";
  const editor = bufferPane({ path: shown.path, repo, source });
  return shown.path.endsWith(".md")
    ? [editor, outlinePane({ path: shown.path, repo, source })]
    : [editor];
}

definePlace("buffer", (shown) => panes(shown, false));
definePlace("edit", (shown) => panes(shown, true));
