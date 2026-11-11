// What each extension's page declares, its places, panes, items, and keys, kept on the device by
// the page's version: every part of a page that draws says it again, and only a version never seen
// is read by a page run unseen, once (`ReadDeclarations`, in `ExtensionPlace.tsx`). Before, every
// page ran one unseen view at each start, for its declarations alone.
import type { Declarations } from "./page";
import { device } from "../store/device";

/** The device's name of what an extension's page declared. */
const keyOf = (name: string) => `declared:${name}` as const;

/** What the page of `name`, at `version`, declared, once it is known. */
export function declaredBy(name: string, version: number | null): Declarations | undefined {
  const kept = device.get(keyOf(name));
  return kept !== undefined && kept.version === version ? kept.declarations : undefined;
}

/** Keeps what the page of `name`, at `version`, declared, as a part of it drew. */
export function declared(name: string, version: number, declarations: Declarations) {
  const kept = device.get(keyOf(name));
  if (
    kept?.version === version &&
    JSON.stringify(kept.declarations) === JSON.stringify(declarations)
  )
    return;
  device.set(keyOf(name), { declarations, version });
}
