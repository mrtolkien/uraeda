// The page runtime in the app: keeps the registered pages of your extensions in line with the
// `Extensions` record, and reports what a page met to the settings page. Loaded in a chunk of its
// own, only once an extension has a page (`ExtensionsOn`), with React's, StyleX's, and Astryx's
// shared modules, so the main chunk does not grow by them.
import { useEffect, useMemo } from "react";
import { useFateClient } from "react-fate";
import { useServerFetch } from "../attach/ServerFetch.tsx";
import { ExtensionsRecordView } from "../settings/settingsViews.ts";
import { type PageRow, syncPages } from "./runtime.ts";
import { registry } from "./useContributions.ts";

export function PageRuntime({ rows }: { rows: ReadonlyArray<PageRow> }) {
  const fetch = useServerFetch();
  const fate = useFateClient();
  // The rows' pages, as a key: the record is read anew at each change of any extension.
  const key = JSON.stringify(
    rows.map(({ name, pageVersion, title }) => [name, pageVersion, title]),
  );
  const pages = useMemo(
    () =>
      (JSON.parse(key) as Array<[string, number | null, string]>).map(
        ([name, pageVersion, title]) => ({ name, pageVersion, title }),
      ),
    [key],
  );
  useEffect(() => {
    syncPages(pages, {
      fetch,
      registry,
      report: (name, version, message) =>
        void fate.mutations.extensions
          .reportPageProblem({ input: { message, name, version }, view: ExtensionsRecordView })
          .catch(() => {}),
    });
  }, [fate, fetch, pages]);
  return null;
}
