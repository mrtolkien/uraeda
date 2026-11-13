// The Mac's menu bar, as every Mac app has one: each command of the frame a person looks for there,
// with the Mac's own shortcuts, beside the keys the app writes out where they act. The app menu
// (About, Settings, Hide, Quit), File (New, the repository's switcher), Edit (the text fields'
// editing, and Find), View (the sidebar, the appearance, full screen), Go (the places of the
// repository shown, and Back), Window, and Help (the key map). It follows the places of the
// repository shown, and the appearance picked. Nothing off the Mac: elsewhere the window has no
// menu bar, or the system draws none for the app.
import { effect } from "nsh";
import { Menu, type MenuItem } from "nsh/desktop";
import { openPicker } from "./pickers";
import { placesIn } from "./places";
import { chooseMode, themeChoice } from "../settings/look";
import { back, navigate } from "../../store";
import { pressKeys } from "../../ui/keys/registry";
import { toggleRail } from "../../ui/layout";
import { mac } from "../../ui/native";

/** The appearances, as the View menu offers them. */
const MODES = [
  { label: "System", mode: "system" },
  { label: "Light", mode: "light" },
  { label: "Dark", mode: "dark" },
] as const;

/** The menu bar's menus, for the repository shown. */
function menus(repo: string | undefined): MenuItem[] {
  // The places but New and Settings, which File and the app menu hold: ⌘1 to ⌘9, in the rail's order.
  const places = placesIn(repo).filter(
    (place) => place.to.page !== "new" && place.to.page !== "settings",
  );
  const mode = themeChoice().mode;
  return [
    {
      label: "Uraeda",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          onSelect: () => navigate({ page: "settings" }),
          shortcut: "mod+,",
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "New Session",
          onSelect: () => navigate({ kind: "session", page: "new" }),
          shortcut: "mod+n",
        },
        {
          label: "New Feature",
          onSelect: () => navigate({ kind: "feature", page: "new" }),
          shortcut: "mod+shift+n",
        },
        {
          label: "New Change",
          onSelect: () => navigate({ kind: "change", page: "new" }),
        },
        { type: "separator" },
        {
          label: "Switch Repository…",
          onSelect: () => openPicker("repositories"),
          shortcut: "mod+o",
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        { label: "Find Anything…", onSelect: () => openPicker("all"), shortcut: "mod+k" },
        {
          label: "Find Features and Changes…",
          onSelect: () => openPicker("features"),
          shortcut: "mod+shift+f",
        },
        { label: "Find Sessions…", onSelect: () => openPicker("sessions") },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Sidebar", onSelect: toggleRail, shortcut: "mod+ctrl+s" },
        { type: "separator" },
        {
          label: "Appearance",
          submenu: MODES.map((one) => ({
            checked: mode === one.mode,
            label: one.label,
            onSelect: () => chooseMode(one.mode),
          })),
        },
        { label: "Theme…", onSelect: () => openPicker("themes") },
        { type: "separator" },
        { role: "toggleFullScreen" },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Back", onSelect: () => void back(), shortcut: "mod+[" },
        { type: "separator" },
        ...places.map((place, at): MenuItem => ({
          label: place.label,
          onSelect: () => navigate(place.to),
          shortcut: at < 9 ? `mod+${at + 1}` : undefined,
        })),
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }],
    },
    {
      label: "Help",
      submenu: [{ label: "Keyboard Shortcuts", onSelect: () => pressKeys("?"), shortcut: "mod+/" }],
    },
  ];
}

/** Sets the Mac's menu bar while the frame is drawn, for the repository shown. */
export function MenuBar(props: { repo: string | undefined }) {
  if (!mac) return null;
  effect(() => Menu.setApplicationMenu(menus(props.repo)));
  return null;
}
