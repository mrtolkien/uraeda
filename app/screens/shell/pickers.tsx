// The key pickers the shell opens over a kind: the repositories (`Space r`), the features and
// changes (`Space f f`), the sessions (`Space f s`), both (`Space Space`), the themes (`Space u t`),
// and a part's font (`Space u f <key>`). One is open at a time; Enter on a row goes there, or
// picks it.
import { signal } from "nsh";
import { device, navigate, record } from "../../store";
import { KeyPicker, type PickerItem } from "../../ui/keys";
import { chooseFont, chooseTheme } from "../settings/look";
import { FONTS, type FontRole } from "../../ui/tokens";

export type PickerKind =
  | "repositories"
  | "features"
  | "sessions"
  | "all"
  | "themes"
  | { font: FontRole; label: string };

const open = signal<PickerKind | undefined>(undefined);

/** Opens the picker of `kind`, in place of the one open. */
export const openPicker = (kind: PickerKind) => open.set(kind);

type Row = PickerItem & { go: () => void };

/** The rows of the picker open, from the records it reads while it is open. */
function rows(kind: PickerKind, repo: string | undefined): Row[] {
  if (typeof kind === "object") {
    const picked = device.get("fonts") ?? {};
    return FONTS.map((font) => ({
      aside: picked[kind.font] === font.id ? "in use" : undefined,
      go: () => chooseFont(kind.font, font.id),
      id: font.id,
      title: font.label,
    }));
  }
  switch (kind) {
    case "repositories":
      return (record("Repositories", null)()?.rows ?? []).map((row) => ({
        aside: row.missing ? "folder gone" : undefined,
        go: () => navigate({ page: "home", repo: row.name }),
        id: row.name,
        summary: row.home,
        title: row.name,
      }));
    case "themes":
      return (record("Themes", null)()?.themes ?? []).map((theme) => ({
        aside: theme.mode,
        go: () => chooseTheme(theme, true),
        id: `${theme.mode} ${theme.id}`,
        title: theme.name,
      }));
    default:
      return repo === undefined ? [] : work(kind, repo);
  }
}

/** The features, changes, and sessions of the repository `repo`. */
function work(kind: "features" | "sessions" | "all", repo: string): Row[] {
  const features =
    kind === "sessions"
      ? []
      : (record("Workspace", { repo })()?.features ?? []).map((feature) => ({
          // Two features may share a title: the day each started tells them apart.
          aside: `${feature.status.label} · ${feature.folder.slice(0, 10)}`,
          go: () => navigate({ folder: feature.id, page: "feature" }),
          id: `feature ${feature.id}`,
          summary: feature.kind === "change" ? "Change" : "Feature",
          title: feature.label ?? feature.title,
        }));
  const sessions =
    kind === "features"
      ? []
      : (record("SessionList", { repo })()?.rows ?? [])
          .filter((row) => !row.archived)
          .map((row) => ({
            go: () => navigate({ id: row.id, page: "session-id" }),
            id: `session ${row.id}`,
            summary: row.agent,
            title: row.title,
          }));
  return [...features, ...sessions];
}

const TITLES: Record<Exclude<PickerKind, object>, string> = {
  all: "Find anything",
  features: "Features and changes",
  repositories: "Switch repository",
  sessions: "Sessions",
  // Each row says its mode, the one a pick sets the theme of.
  themes: "Theme",
};

/** The picker open, if any. */
export function Pickers(props: { repo?: string }) {
  return (
    <If when={open()}>
      {(kind) => {
        const items = () => rows(kind(), props.repo);
        return (
          <KeyPicker
            items={items()}
            onClose={() => open.set(undefined)}
            onPick={(item) =>
              items()
                .find((row) => row.id === item.id)
                ?.go()
            }
            start={kind() === "repositories" ? props.repo : undefined}
            title={
              typeof kind() === "object"
                ? `Font: ${(kind() as { label: string }).label}`
                : TITLES[kind() as Exclude<PickerKind, object>]
            }
          />
        );
      }}
    </If>
  );
}
