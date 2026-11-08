// Which extensions are on in the current repository, read once for the whole shell: the registries'
// readers list only their contributions (`useContributions`). Once one of your extensions has a
// page, the page runtime loads, in a chunk of its own, and registers it.
import { lazy, type ReactNode, Suspense, useMemo } from "react";
import { useExtensionsRecord } from "../settings/useExtensionsRecord.ts";
import { useRepository } from "../routes.tsx";
import { isBuiltIn } from "./builtins/order.ts";
import { type IsOn, IsOnContext } from "./useContributions.ts";

/** An extension's row, as the `Extensions` record lists it. */
type Row = { name: string; on: ReadonlyArray<string>; onAll: boolean };

/**
 * Whether each extension is on in `repository`, by its row: on everywhere, or there by name. One
 * without a row, as Sessions, which is no extension, is always on; a row named `sessions`, which
 * the core refuses, is never read. Until the rows are read, the built-ins are on and yours off, so
 * that none of yours flashes in a repository it is off in.
 */
export function isOnIn(rows: ReadonlyArray<Row> | undefined, repository: string): IsOn {
  if (!rows) {
    return isBuiltIn;
  }
  const byName = new Map(
    rows.filter((row) => row.name !== "sessions").map((row) => [row.name, row]),
  );
  return (name) => {
    const row = byName.get(name);
    return !row || row.onAll || row.on.includes(repository);
  };
}

/** The page runtime: fetched only once an extension has a page, and never preloaded. */
const PageRuntime = lazy(async () => ({
  default: (await import("./PageRuntime.tsx")).PageRuntime,
}));

/**
 * Whether an extension had a page since the app loaded: the runtime then stays, to undo the last
 * page as it goes. Global, as the registry is.
 */
let hadPages = false;

/** Its children, with the extensions on in the current repository, and your extensions' pages. */
export function ExtensionsOn({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const rows = useExtensionsRecord()?.extensions;
  const isOn = useMemo(() => isOnIn(rows, repository), [rows, repository]);
  hadPages ||= rows?.some((row) => row.pageVersion !== null) ?? false;
  return (
    <IsOnContext value={isOn}>
      {hadPages && rows && (
        <Suspense fallback={null}>
          <PageRuntime rows={rows} />
        </Suspense>
      )}
      {children}
    </IsOnContext>
  );
}
