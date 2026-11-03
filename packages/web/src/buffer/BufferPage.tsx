// A file opened as a buffer (US5), at `/buffer/<path>`: the whole file, frontmatter included, fills
// the center column under its bufferline, the sidebar beside it; the page has no column of its own
// at the right. Its cursor starts at the file's start, in Vim's normal mode with Vim on, as a file
// Vim opens. `:w` or Ctrl+Enter saves it on its branch, which the status line names, without
// committing: the Commit page lists it. `:q`, or `b` outside the text, goes back, the Leave guard
// asking first while the text is not saved. On the phone, the bottom bar holds Back and Save.
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Editor } from "../fields/editor/Editor.tsx";
import { useVimOn } from "../fields/editor/vim/load.ts";
import { useKeys } from "../keys/registry.tsx";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Missing } from "../layout/Missing.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { Page } from "../layout/Page.tsx";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { ConflictBanner } from "../pane/ProposalEditor.tsx";
import { navigateHere, useRestoreScroll } from "../routes.tsx";
import { useStatusBranch } from "../shell/status/branch.ts";
import { Bufferline } from "./Bufferline.tsx";
import { useBuffer } from "./useBuffer.ts";

const styles = stylex.create({
  // The bufferline stays in view as the page scrolls the text, under the phone's tabs there.
  line: {
    backgroundColor: colorVars["--color-background-surface"],
    paddingBlock: spacingVars["--spacing-1"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  lineNarrow: { top: spacingVars["--spacing-12"] },
  // The page's room under the bufferline, which the editor fills, growing past it with its text.
  room: { display: "flex", flexDirection: "column", flexGrow: 1 },
  text: { display: "grid", flexGrow: 1 },
});

/** Back to the page the buffer was opened from; home when the buffer was the first page opened. */
function back() {
  if (window.history.length > 1) {
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
  useKeys(
    buffer.file
      ? [
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
        <div {...stylex.props(styles.line, narrow && styles.lineNarrow)}>
          <Bufferline isDirty={buffer.field.dirty} path={path} />
        </div>
        <ConflictBanner editor={buffer} />
        {buffer.refused !== undefined && (
          <AnnouncedBanner collapsible={false} status="error" title={buffer.refused} />
        )}
        <div {...stylex.props(styles.text)}>
          <Editor
            isAutoFocused
            isReadFirst
            label={path}
            onChange={buffer.field.change}
            onQuit={quit}
            onSubmit={buffer.saveText}
            value={buffer.field.text}
            variant="page"
          />
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
