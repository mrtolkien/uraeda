// A document's column of panels, at the window's right edge on wide and semi-wide screens: each
// panel a tab in a labelled list at its top, WAI-ARIA's tabs pattern, the arrows moving between
// them, and the open one under it, then the column's foot (approval comment C1 of the session's
// spec: a panel shows as a tab, and a split, `SplitPanel.tsx`, is a panel of two). Its width is
// one for every tab and every document, a third of the window until dragged
// (`documentColumnWidth.ts`), so switching tabs moves nothing on the page. The open
// tab is in the address, `?tab=<key>`, so reload, Back, and a width change keep it; switching
// replaces the history entry. `]` folds it to a rail of the panels' icons. On narrow screens, the
// page alone, kept in its place in the tree as the window crosses 768 px, so its typed text stays.
import { Icon } from "@astryxdesign/core/Icon";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, type ReactNode, useId } from "react";
import { redirect, useSearch } from "../routes.tsx";
import { useDocumentColumnWidth } from "./documentColumnWidth.ts";
import { SideColumn } from "./SideColumn.tsx";

/**
 * A panel of the column, shown as its tab: its key in the address, its name and icon, a badge after
 * them, and its content. One that `fills` takes the column's height, scrolling its own parts, as a
 * split does, rather than the column scrolling as a whole: those parts take the focus that scrolls
 * them, and its tab's panel does not.
 */
export type ColumnPanel = {
  badge?: ReactNode;
  content: ReactNode;
  fills?: boolean;
  icon: ComponentProps<typeof Icon>["icon"];
  key: string;
  label: string;
};

const styles = stylex.create({
  // The foot keeps its height under a panel that fills the column.
  foot: {
    flexShrink: 0,
  },
  // A panel that fills: the column's height under its tabs and above its foot, its content a
  // column of its own parts.
  fills: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
});

/** The address's parameter that names the open tab. */
const PARAMETER = "tab";

/**
 * The open tab, among `keys`, and the function that opens another: the address's `?tab=`, the first
 * key without it or with one not among them. Opening a tab replaces the history entry's address, so
 * Back leaves the page rather than stepping through its tabs.
 */
export function useColumnTab(keys: ReadonlyArray<string>): [string, (key: string) => void] {
  const asked = new URLSearchParams(useSearch()).get(PARAMETER);
  const open = asked !== null && keys.includes(asked) ? asked : (keys[0] ?? "");
  return [open, openTab];
}

/** Opens the tab `key`, in place of the address's. */
function openTab(key: string) {
  redirect(tabAddress(key));
}

/** The tab the address asks for, `?tab=`, whatever the tabs drawn, or `null` without one. */
export function useAskedTab(): string | null {
  return new URLSearchParams(useSearch()).get(PARAMETER);
}

/** The tab the window's address asks for now, as `useAskedTab` reads it, outside a render. */
export function askedTabNow(): string | null {
  return new URLSearchParams(window.location.search).get(PARAMETER);
}

/** The current address with the tab `key` asked for, or none when `key` is `undefined`. */
export function tabAddress(key: string | undefined): string {
  const search = new URLSearchParams(window.location.search);
  if (key === undefined) {
    search.delete(PARAMETER);
  } else {
    search.set(PARAMETER, key);
  }
  const query = search.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

/** The folded column's rail: each panel's icon, named by its tab. */
function Rail({ panels }: { panels: ReadonlyArray<ColumnPanel> }) {
  return (
    <VStack align="center" gap={3}>
      {panels.map((panel) => (
        <Icon icon={panel.icon} key={panel.key} label={panel.label} />
      ))}
    </VStack>
  );
}

/** The column's width and fold, kept for every document: `useDocumentColumnWidth`'s. */
type DocumentColumnState = ReturnType<typeof useDocumentColumnWidth>;

/** What `DocumentColumn` draws. */
type ColumnProps = {
  content: ReactNode;
  /**
   * The column's foot, under the open panel: at the column's bottom edge only under a panel that
   * `fills`; under another, right after the panel's content, scrolling with it.
   */
  footer?: ReactNode;
  label: string;
  panels: ReadonlyArray<ColumnPanel>;
};

/**
 * `content`, the document, with its column of `panels` beside it on wide and semi-wide screens,
 * named `label`, and `footer` at its foot, under the open panel; on narrow screens, the document
 * alone. `column` is its width and fold, when the page
 * holds them to unfold the column itself, as asking the agent does; else the column holds its own.
 */
export function DocumentColumn({
  column,
  ...props
}: ColumnProps & { column?: DocumentColumnState }) {
  return column ? <Drawn {...props} column={column} /> : <OwnWidth {...props} />;
}

/** The column, holding its own width and fold. */
function OwnWidth(props: ColumnProps) {
  return <Drawn {...props} column={useDocumentColumnWidth()} />;
}

/** The column at `column`'s width and fold. */
function Drawn({
  column: { isShown, resizable, setShown },
  content,
  footer,
  label,
  panels,
}: ColumnProps & { column: DocumentColumnState }) {
  const [open, setOpen] = useColumnTab(panels.map((panel) => panel.key));
  const ids = useId();
  const tabId = (key: string) => `${ids}-tab-${key}`;
  const panelId = (key: string) => `${ids}-panel-${key}`;
  const shown = panels.find((panel) => panel.key === open);
  const fills = shown?.fills === true;
  return (
    <SideColumn
      content={content}
      header={
        <TabList aria-label={label} onChange={setOpen} role="tablist" size="sm" value={open}>
          {panels.map((panel) => (
            <Tab
              endContent={panel.badge}
              icon={<Icon icon={panel.icon} size="sm" />}
              id={tabId(panel.key)}
              key={panel.key}
              label={panel.label}
              panelId={panelId(panel.key)}
              value={panel.key}
            />
          ))}
        </TabList>
      }
      isFilled={fills}
      isShown={isShown}
      label={label}
      onShownChange={setShown}
      rail={<Rail panels={panels} />}
      width={resizable}
    >
      {shown && (
        <div
          aria-labelledby={tabId(shown.key)}
          id={panelId(shown.key)}
          role="tabpanel"
          // The panel scrolls with the column, so it takes the focus that scrolls it, unless it
          // fills the column: then its own parts scroll, and take it.
          tabIndex={fills ? undefined : 0}
          {...stylex.props(fills && styles.fills)}
        >
          {shown.content}
        </div>
      )}
      {footer !== undefined && <div {...stylex.props(styles.foot)}>{footer}</div>}
    </SideColumn>
  );
}
