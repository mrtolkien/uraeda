// Which extensions are on in the current repository, read once for the whole shell: the registries'
// readers list only their contributions (`useContributions`).
import type { ReactNode } from "react";
import { useExtensionsRecord } from "../settings/useExtensionsRecord.ts";
import { useRepository } from "../routes.tsx";
import { type IsOn, IsOnContext } from "./useContributions.ts";

/** An extension's row, as the `Extensions` record lists it. */
type Row = { name: string; on: ReadonlyArray<string>; onAll: boolean };

/**
 * Whether each extension is on in `repository`, by its row: on everywhere, or there by name. One
 * without a row, as Sessions, which is no extension, is always on.
 */
export function isOnIn(rows: ReadonlyArray<Row>, repository: string): IsOn {
  const byName = new Map(rows.map((row) => [row.name, row]));
  return (name) => {
    const row = byName.get(name);
    return !row || row.onAll || row.on.includes(repository);
  };
}

/** Its children, with the extensions on in the current repository. */
export function ExtensionsOn({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const rows = useExtensionsRecord()?.extensions;
  const isOn = isOnIn(rows ?? [], repository);
  return <IsOnContext value={isOn}>{children}</IsOnContext>;
}
