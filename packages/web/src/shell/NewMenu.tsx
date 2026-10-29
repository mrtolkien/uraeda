// The ＋ that starts something, the sidebar's New and the phone's tab: a small menu asks what, a
// session or a proposal, on the New page, or a note, in its form.
import { DropdownMenu, type DropdownMenuTriggerProps } from "@astryxdesign/core/DropdownMenu";
import type { ReactNode } from "react";
import { navigate, useRepoPath } from "../routes.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";

/** The New menu hanging off `trigger`, the control drawn with the props it is given. */
export function NewMenu({ trigger }: { trigger: (props: DropdownMenuTriggerProps) => ReactNode }) {
  const here = useRepoPath();
  const open = useOpenAddForm();
  return (
    <DropdownMenu
      alignment="start"
      items={[
        // The New page's cards' icons, and the Note button's pencil, the kinds as drawn elsewhere.
        { icon: "uraeda:bot", label: "Session", onClick: () => navigate(here("/new")) },
        {
          icon: "uraeda:file-text",
          label: "Proposal",
          onClick: () => navigate(here("/new?kind=feature")),
        },
        { icon: "uraeda:pencil", label: "Note", onClick: () => open("note") },
      ]}
      presentation="popover"
      renderTrigger={trigger}
    />
  );
}
