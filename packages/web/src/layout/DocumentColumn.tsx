// A document's column of tabs, at the window's right edge on wide and semi-wide screens: a labelled
// list of tabs at its top, WAI-ARIA's tabs pattern, the arrows moving between them, and the open
// one's panel under it. Its width is one for every tab and every document, a third of the window
// until dragged (`documentColumnWidth.ts`), so switching tabs moves nothing on the page. The open
// tab is in the address, `?tab=<key>`, so reload, Back, and a width change keep it; switching
// replaces the history entry. `]` folds it to a rail of the tabs' icons. On narrow screens, the
// page alone, kept in its place in the tree as the window crosses 768 px, so its typed text stays.
import { Icon } from "@astryxdesign/core/Icon";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { VStack } from "@astryxdesign/core/VStack";
import { type ComponentProps, type ReactNode, useId } from "react";
import { redirect, useSearch } from "../routes.tsx";
import { useDocumentColumnWidth } from "./documentColumnWidth.ts";
import { SideColumn } from "./SideColumn.tsx";

/** A tab of the column: its key in the address, its name and icon, a badge after it, its panel. */
export type ColumnTab = {
  badge?: ReactNode;
  icon: ComponentProps<typeof Icon>["icon"];
  key: string;
  label: string;
  panel: ReactNode;
};

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
  const set = (key: string) => {
    const search = new URLSearchParams(window.location.search);
    search.set(PARAMETER, key);
    redirect(`${window.location.pathname}?${search.toString()}${window.location.hash}`);
  };
  return [open, set];
}

/** The folded column's rail: each tab's icon, named by its tab. */
function Rail({ tabs }: { tabs: ReadonlyArray<ColumnTab> }) {
  return (
    <VStack align="center" gap={3}>
      {tabs.map((tab) => (
        <Icon icon={tab.icon} key={tab.key} label={tab.label} />
      ))}
    </VStack>
  );
}

/**
 * `content`, the document, with its column of `tabs` beside it on wide and semi-wide screens, named
 * `label`; on narrow screens, the document alone.
 */
export function DocumentColumn({
  content,
  label,
  tabs,
}: {
  content: ReactNode;
  label: string;
  tabs: ReadonlyArray<ColumnTab>;
}) {
  const { isShown, resizable, setShown } = useDocumentColumnWidth();
  const [open, setOpen] = useColumnTab(tabs.map((tab) => tab.key));
  const ids = useId();
  const tabId = (key: string) => `${ids}-tab-${key}`;
  const panelId = (key: string) => `${ids}-panel-${key}`;
  const shown = tabs.find((tab) => tab.key === open);
  return (
    <SideColumn
      content={content}
      header={
        <TabList aria-label={label} onChange={setOpen} role="tablist" size="sm" value={open}>
          {tabs.map((tab) => (
            <Tab
              endContent={tab.badge}
              icon={<Icon icon={tab.icon} size="sm" />}
              id={tabId(tab.key)}
              key={tab.key}
              label={tab.label}
              panelId={panelId(tab.key)}
              value={tab.key}
            />
          ))}
        </TabList>
      }
      isShown={isShown}
      label={label}
      onShownChange={setShown}
      rail={<Rail tabs={tabs} />}
      width={resizable}
    >
      {shown && (
        <div
          aria-labelledby={tabId(shown.key)}
          id={panelId(shown.key)}
          role="tabpanel"
          tabIndex={0}
        >
          {shown.panel}
        </div>
      )}
    </SideColumn>
  );
}
