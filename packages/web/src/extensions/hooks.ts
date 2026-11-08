// The hooks an extension's page imports from `uraeda/page`: its records, read live through fate,
// its actions, its settings in the current repository, and the repository's name. Each knows its
// extension from the boundary every contribution of a page is drawn in (`ExtensionBoundary`).
import { createContext, use, useCallback, useMemo } from "react";
import { useFateClient, useLiveView, useRequest } from "react-fate";
import { useRefreshOnShow } from "../data.ts";
import { refusal } from "../errors.ts";
import { useRepository } from "../routes.tsx";
import { useExtensionsRecord } from "../settings/useExtensionsRecord.ts";
import { ExtensionActionView, ExtensionRecordView } from "../views.ts";

/** The extension whose contribution is drawn: null outside every extension's. */
export const ExtensionContext = createContext<string | null>(null);

/** The name of the extension the caller is drawn for: `hook` names the hook that needs it. */
function useExtensionName(hook: string): string {
  const name = use(ExtensionContext);
  if (name === null) {
    throw new Error(`${hook} is called outside an extension's page`);
  }
  return name;
}

/** The error a record read with, thrown by `useRecord`: its boundary watches the record. */
export class RecordError extends Error {
  /** The record's id, `<extension>/<name>`. */
  readonly id: string;

  constructor(id: string, message: string) {
    super(message);
    this.id = id;
  }
}

/** The record `id` read live through fate, read again as the page shows. */
export function useRecordRow(id: string) {
  const request = useMemo(() => ({ extensionRecord: { id, view: ExtensionRecordView } }), [id]);
  const { extensionRecord } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(ExtensionRecordView, extensionRecord);
}

/**
 * The value of the extension's record `name` in the current repository, as its server code reads
 * it, redrawn as it changes. Throws the record's error, which the extension's boundary shows until
 * the record reads again.
 */
export function useRecord<T = unknown>(name: string): T {
  const id = `${useExtensionName("useRecord")}/${name}`;
  const record = useRecordRow(id);
  const value = record?.value;
  const parsed = useMemo(() => (value === undefined ? null : (JSON.parse(value) as T)), [value]);
  if (!record) {
    throw new Error(`No record ${id}`);
  }
  if (record.error !== null) {
    throw new RecordError(id, record.error);
  }
  return parsed as T;
}

/**
 * Runs the extension's action `name` in the current repository with an input: gives its output,
 * or throws why it was refused. Its answer is not kept in fate's store.
 */
export function useAction<I = unknown, O = unknown>(name: string): (input?: I) => Promise<O> {
  const extension = useExtensionName("useAction");
  const fate = useFateClient();
  return useCallback(
    async (input?: I) => {
      const inputJson = JSON.stringify(input ?? null);
      const result = await fate.mutations.extensions.act({
        input: { extension, inputJson, name },
        view: ExtensionActionView,
      });
      if (result.error) {
        throw new Error(refusal(result.error).message);
      }
      const answer = result.result;
      const output = JSON.parse(answer?.outputJson ?? "null") as O;
      // Read once: fate's store keeps no answer, which would grow by one at each call.
      if (answer) {
        fate.deleteRecord("ExtensionAction", answer.id);
      }
      return output;
    },
    [extension, fate, name],
  );
}

/** The extension's settings in the current repository, its defaults filled in. */
export function useExtensionSettings<T = Record<string, unknown>>(): T {
  const extension = useExtensionName("useExtensionSettings");
  const json = useExtensionsRecord()?.extensions.find((row) => row.name === extension)?.valuesHere;
  return useMemo(() => JSON.parse(json ?? "{}") as T, [json]);
}

export { useRepository };

/** What a page's entry is called with: types only, for the extensions that import it. */
export type { PageApi } from "./pageApi.ts";
