// The title of the Git page's detail on one line, as a terminal's pane title: a path keeps its
// file's name, its folders cut by an ellipsis at their start ("…/level/name.md"), and a commit's
// subject is cut at its end. The whole text shows in a tooltip, and the address names it.
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

const styles = stylex.create({
  // One line no wider than the title's room: the head gives up its room first.
  line: {
    display: "flex",
    maxWidth: "100%",
    minWidth: 0,
    whiteSpace: "nowrap",
  },
  // A subject: cut at its end.
  head: {
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  // The folders: cut at their start, the ellipsis first, so the nearest folders stay by the name,
  // down to the ellipsis and three characters, the least it is drawn whole in. Right to left only
  // for where the cut goes: the words inside read left to right.
  folders: {
    direction: "rtl",
    // About four characters of the title: the ellipsis and three.
    minWidth: spacingVars["--spacing-8"],
  },
  words: {
    direction: "ltr",
    unicodeBidi: "embed",
  },
  // A file's name: whole while the room holds it, cut at its end past it, beside the folders' least.
  tail: {
    flexShrink: 0,
    maxWidth: `calc(100% - ${spacingVars["--spacing-8"]})`,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
});

/** Whether a title's parts are cut on screen: only then has its tooltip more to show. */
const cutIn = (element: HTMLElement) =>
  [...element.children].some((child) => child.scrollWidth > child.clientWidth);

/**
 * `text` on one line, a path's folders cut before its file's name (`isPath`), or its end cut, with
 * the whole of it in a tooltip while it is cut.
 */
export function DetailTitle({ isPath = false, text }: { isPath?: boolean; text: string }) {
  // The name keeps its slash, so a path cut to its ellipsis reads "…/name".
  const at = isPath ? Math.max(text.lastIndexOf("/"), 0) : text.length;
  const head = text.slice(0, at);
  const tail = text.slice(at);
  // Read as the pointer comes, before the tooltip's delay ends: the room changes with the window.
  const [isCut, setCut] = useState(false);
  return (
    <Tooltip content={text} isEnabled={isCut}>
      <span
        data-detail-title=""
        onPointerEnter={(event) => setCut(cutIn(event.currentTarget))}
        {...stylex.props(styles.line)}
      >
        {head && (
          <span {...stylex.props(styles.head, isPath && styles.folders)}>
            {isPath ? <span {...stylex.props(styles.words)}>{head}</span> : head}
          </span>
        )}
        {tail && <span {...stylex.props(styles.tail)}>{tail}</span>}
      </span>
    </Tooltip>
  );
}
