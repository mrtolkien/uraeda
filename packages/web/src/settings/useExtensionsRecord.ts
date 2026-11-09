// The `Extensions` record, as the settings' Extensions section reads it, apart from `data.ts`, which
// is at its size limit.
import { useLiveView, useRequest } from "react-fate";
import { useRefreshOnShow } from "../data.ts";
import { ExtensionsRecordView } from "./settingsViews.ts";

/** The id of the one `Extensions` record, as the server names it. */
const EXTENSIONS_ID = "extensions";

/**
 * Every extension: the same from every endpoint, read on the client the caller is under, kept up to
 * date as one loads, breaks, or is turned on or off, as `useSettings` is.
 */
export function useExtensionsRecord() {
  const request = { extensions: { id: EXTENSIONS_ID, view: ExtensionsRecordView } };
  const { extensions } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(ExtensionsRecordView, extensions);
}
