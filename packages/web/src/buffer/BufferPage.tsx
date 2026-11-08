// A file opened as a buffer (US5), at `/buffer/<path>`: the whole file, frontmatter included, fills
// the center column under its bufferline, the sidebar beside it; the page has no column of its own
// at the right. Its cursor starts at the file's start, in Vim's normal mode with Vim on, as a file
// Vim opens. Outside the text, Enter brings the focus back to it, and `i`, `o`, and `a` too, then
// run as Vim's, in insert mode. `:w` or Ctrl+Enter saves it on its branch, which the status line names, without
// committing: the Git page lists it. `:q`, or `b` outside the text, goes back, the Leave guard
// asking first while the text is not saved. On the phone, the bottom bar holds Back and Save.
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import { Editor, type EditorHandle } from "../fields/editor/Editor.tsx";
import { isMarkdownPath } from "../fields/editor/markdown.ts";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { useVimOn } from "../fields/editor/vim/load.ts";
import { useKeys } from "../keys/registry.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Missing } from "../layout/Missing.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { Page } from "../layout/Page.tsx";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { ConflictBanner } from "../pane/ProposalEditor.tsx";
import { openedInApp } from "../routeHistory.ts";
import { navigateHere, useRestoreScroll } from "../routes.tsx";
import { useStatusBranch } from "../shell/status/branch.ts";
import { Bufferline } from "./Bufferline.tsx";
import { useBuffer } from "./useBuffer.ts";

/** The sentence of the restore notice when the file changed since the text was typed. */
const BUFFER_CHANGED = "The file changed since: saving replaces it.";

const styles = stylex.create({
  line: { paddingBlock: spacingVars["--spacing-1"] },
  // The page's room under the bufferline and its banners, the window's height, which the text
  // fills, its own scroller, as Vim's screen motions measure: the page does not scroll with it.
  room: { display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 },
  // On a short window, the text keeps a few lines, the page scrolling past it.
  text: { flexBasis: 0, flexGrow: 1, minHeight: "var(--size-buffer-min)", position: "relative" },
  // Out of the flow, so the text's length never grows the room: the editor fills it.
  fill: { display: "grid", gridTemplateRows: "minmax(0, 1fr)", inset: 0, position: "absolute" },
});

/**
 * Back to the page of the app the buffer was opened from; home when it was opened first, typed or
 * linked from another site, where the browser's Back would leave the app.
 */
function back() {
  if (openedInApp()) {
    window.history.back();
  } else {
    navigateHere("/");
  }
}

/** The file at `path`, from the top level, as a buffer. */
export function BufferPage({ path }: { path: string }) {
  const buffer = useBuffer(path);
  const narrow = isNarrow(useWidthClass());
  const isVim = useVimOn();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  useStatusBranch(buffer.file?.branch);
  // `:q`, after `:wq`'s save has answered: a refused save keeps the text unsaved, which the Leave
  // guard asks about.
  const quit = () => void buffer.flush().then(back);
  const editor = useRef<EditorHandle>(null);
  // Back in the text, its mode kept; with `key`, Vim's key run there, as typed in it.
  const focus = (key?: string) => () => {
    const view = editor.current?.view();
    if (!view) {
      return false;
    }
    view.focus();
    if (key && isVim) {
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
      );
    }
  };
  useKeys(
    buffer.file
      ? [
          { hint: "⏎", keys: "Enter", label: "edit", run: focus() },
          { hint: "i", keys: "i", label: "insert", run: focus("i") },
          { keys: "o", label: "open a line", run: focus("o") },
          { keys: "a", label: "append", run: focus("a") },
          { hint: isVim ? ":w" : "⌃⏎", keys: "mod+Enter", label: "save", run: buffer.saveText },
          // The shell's `b` goes back; this one, its fallback, only names it, or goes home when
          // there is nothing to go back to.
          { fallback: true, hint: isVim ? ":q" : "b", keys: "b", label: "back", run: back },
        ]
      : [],
  );
  if (!buffer.file) {
    return (
      <Page kind="rows">
        <Missing title={`No Markdown file ${path} in specs/.`} />
      </Page>
    );
  }
  return (
    <Page isFull kind="window">
      <VStack gap={2} xstyle={styles.room}>
        <div {...stylex.props(styles.line)}>
          <Bufferline isDirty={buffer.field.dirty} path={path} />
        </div>
        {buffer.field.restored && (
          <RestoreNotice
            changed={BUFFER_CHANGED}
            onDiscard={buffer.field.discard}
            restored={buffer.field.restored}
          />
        )}
        <ConflictBanner editor={buffer} />
        {buffer.refused !== undefined && (
          <AnnouncedBanner collapsible={false} status="error" title={buffer.refused} />
        )}
        <div {...stylex.props(styles.text)}>
          <div {...stylex.props(styles.fill)}>
            <Editor
              isAutoFocused
              isCode={!isMarkdownPath(path)}
              isReadFirst
              label={path}
              onChange={buffer.field.change}
              onQuit={quit}
              onSubmit={buffer.saveText}
              ref={editor}
              value={buffer.field.text}
              variant="page"
            />
          </div>
        </div>
      </VStack>
      {narrow && (
        <TopBarSlot>
          <NavTiles label="The buffer's actions">
            <NavTile icon="chevronLeft" label="Back" onPress={back} />
            <NavTile icon="uraeda:save" isTinted label="Save" onPress={buffer.saveText} />
          </NavTiles>
        </TopBarSlot>
      )}
    </Page>
  );
}
