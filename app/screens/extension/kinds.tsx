// The kinds of pane of the owner's extensions' parts: one kind per extension and part (ruling R209),
// `e:<name>:<id>` for a place, `e:<name>:home:<id>` for a pane of Home, `e:<name>:new:<id>` for a
// section of the New page, each declared the first time it is asked for, since what an extension
// declares is known only once its page ran. Each draws `PagePart`, the page's part in its view,
// framed and padded by the app as every pane: a page never draws its own frame.
import { PagePart } from "./PagePart";
import { declaredBy } from "../../extensions/declared";
import type { Declarations, PartKind } from "../../extensions/page";
import { record, route } from "../../store";
import { iconNamed } from "../../ui/controls";
import { definePane, type PaneKind, type StackName } from "../../ui/layout";

/** What a pane of an extension's part takes: the repository it is drawn for. */
export type PartArgs = { repo: string };

/** What the New page starts, as its address says: a session unless it names another. */
function newKind() {
  const now = route();
  return now.page === "new" ? (now.kind ?? "session") : "session";
}

const kinds = new Map<string, PaneKind<PartArgs>>();

/** The parts of a kind, as a page declares them. */
const LISTS = {
  homePane: "homePanes",
  newSection: "newSections",
  place: "places",
} as const satisfies Partial<Record<PartKind, keyof Declarations>>;

type Shown = keyof typeof LISTS;

/** The part `id` of `name`, as its page declared it, and its extension's title. */
function partOf(name: string, kind: Shown, id: string, repo: string) {
  const row = record("Extensions", { repo })()?.extensions.find((one) => one.name === name);
  const declared = row === undefined ? undefined : declaredBy(name, row.pageVersion);
  const list = declared?.[LISTS[kind]] as ReadonlyArray<{
    icon?: string;
    id: string;
    title: string;
  }>;
  return { part: list?.find((one) => one.id === id), row };
}

/** The kind of pane of an extension's part, declared once. */
export function partKind(name: string, kind: Shown, id: string, stack: StackName, icon?: string) {
  const named = kind === "place" ? `e:${name}:${id}` : `e:${name}:${kind}:${id}`;
  let made = kinds.get(named);
  if (made === undefined) {
    made = definePane<PartArgs>({
      // The icon the page declared, when it is known as the kind is first asked for.
      icon: iconNamed(icon, "plug"),
      kind: named,
      stack,
      title: ({ repo }) => {
        const { part, row } = partOf(name, kind, id, repo);
        return part?.title ?? row?.title ?? name;
      },
      view: (props) => (
        <PagePart
          id={id}
          kind={kind}
          name={name}
          props={kind === "newSection" ? () => ({ kind: newKind() }) : undefined}
          repo={props.args.repo}
        />
      ),
    });
    kinds.set(named, made);
  }
  return made;
}
