// The names the human gave a repository's features and changes in the sidebar, joined
// to their records from the repository's entry in the list (R2): no workflow rule reads them.
import type { RepoContext } from "./context.ts";

/** What the sidebar shows of an item besides its slug: its name, or null. */
export type ItemLook = { label: string | null };

/** The looks of the context's repository's items, by folder, as the hosts last read its entry. */
export function itemLooks(ctx: RepoContext): (folder: string) => ItemLook {
  const row = ctx.hosts.rows().find((candidate) => candidate.path === ctx.repo);
  const items = new Map((row?.items ?? []).map((item) => [item.folder, item]));
  return (folder) => {
    const item = items.get(folder);
    return { label: item?.label ?? null };
  };
}
