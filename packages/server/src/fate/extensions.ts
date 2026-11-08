// The extensions in fate: the `Extensions` record the settings page and the page runtime read, on
// every endpoint; each extension's named records, `ExtensionRecord` `<extension>/<name>`, on a
// repository's endpoint, read through the extensions host at each request; and their mutations.
import { dataView } from "@nkzw/fate/server";
import type { Extension, SettingSpec, Source } from "uraeda-binding";
import type { ExtensionState } from "../extensions/server.ts";
import { type Context, inRepository } from "./context.ts";
import { fileSource } from "./source.ts";

/** The id of the one `Extensions` record. */
export const EXTENSIONS_ID = "extensions";

/** A problem of an extension, its line null for the whole file. */
export type ExtensionProblemRow = { file: string; line: number | null; message: string };

/** An extension, as the settings page and the page runtime read it. */
export type ExtensionRow = {
  api: number;
  description: string;
  icon: string;
  isBuiltIn: boolean;
  isLinked: boolean;
  /** The keys of its page another extension took first: filled in by the page, none here. */
  keys: Array<{ keys: string; takenBy: string }>;
  name: string;
  on: Array<string>;
  onAll: boolean;
  /** The version of its running page, which the page runtime fetches again as it changes. */
  pageVersion: number | null;
  problems: Array<ExtensionProblemRow>;
  settings: Array<SettingSpec>;
  source: Source | null;
  /** `on`, `off`, `broken`, or `waiting`, while a reload waits for a turn. */
  state: string;
  title: string;
  /** Its settings for every repository, as a JSON object. */
  values: string;
  /**
   * Its settings in the repository of the endpoint, as a JSON object, `{}` where it is off; every
   * repository's on the global endpoint. What the extension's page reads.
   */
  valuesHere: string;
  version: string;
  waitingFor: string | null;
};

/** Every extension: your extensions folder, the API's documentation, and the API version. */
export type ExtensionsRecord = {
  api: number;
  docs: string;
  extensions: Array<ExtensionRow>;
  folder: string;
  id: string;
};

/** A record of an extension's, its value as JSON, or why it could not be read. */
export type ExtensionRecordRecord = { error: string | null; id: string; value: string };

/** An action's answer, read once, from its mutation. */
export type ExtensionActionRecord = { id: string; outputJson: string };

export const extensionsDataView = dataView<ExtensionsRecord>("Extensions")({
  api: true,
  docs: true,
  extensions: true,
  folder: true,
  id: true,
});

export const extensionRecordDataView = dataView<ExtensionRecordRecord>("ExtensionRecord")({
  error: true,
  id: true,
  value: true,
});

export const extensionActionDataView = dataView<ExtensionActionRecord>("ExtensionAction")({
  id: true,
  outputJson: true,
});

function row({ extension, ...state }: ExtensionState, here = state.values): ExtensionRow {
  const { api, description, icon, isBuiltIn, isLinked, name, on, onAll, settings } = extension;
  return {
    api,
    description,
    icon,
    isBuiltIn,
    isLinked,
    keys: [],
    name,
    on,
    onAll,
    pageVersion: state.pageVersion,
    problems: state.problems.map(({ file, line, message }) => ({
      file,
      line: line ?? null,
      message,
    })),
    settings,
    source: extension.source ?? null,
    state: state.state,
    title: extension.title,
    values: JSON.stringify(state.values),
    valuesHere: JSON.stringify(here),
    version: extension.version,
    waitingFor: state.waitingFor,
  };
}

/** An extension as the core reads it, on or off by its `on`, without an extensions host. */
const readState = (extension: Extension): ExtensionState => ({
  extension,
  pageVersion: null,
  problems: extension.problems,
  state: extension.onAll || extension.on.length > 0 ? "on" : "off",
  values: {},
  waitingFor: null,
});
/** Without an extensions host, as some tests' apps: the extensions as the core reads them. */
async function readOnly(ctx: Context): Promise<ExtensionsRecord> {
  const { extensions, folder } = await ctx.binding.readExtensions(ctx.settings.dir);
  return {
    api: ctx.binding.extensionApi(),
    docs: "",
    extensions: extensions.map((extension) => row(readState(extension))),
    folder,
    id: EXTENSIONS_ID,
  };
}

/** The `Extensions` record now. */
export async function extensionsRecord(ctx: Context): Promise<ExtensionsRecord> {
  if (!ctx.extensions) {
    return readOnly(ctx);
  }
  const host = ctx.extensions;
  const { extensions, ...rest } = host.states();
  const repository = ctx.repo === null ? null : (ctx.hosts.byPath(ctx.repo)?.name ?? null);
  const here = (state: ExtensionState) =>
    row(
      state,
      repository === null ? state.values : host.settings(state.extension.name, repository),
    );
  return { ...rest, extensions: extensions.map(here), id: EXTENSIONS_ID };
}

/** The extensions' sources: their records are read on a repository's endpoint only. */
export const extensionSources = [
  fileSource(extensionsDataView, {
    byIds: async (ctx: Context, ids) =>
      ids.includes(EXTENSIONS_ID) ? [await extensionsRecord(ctx)] : [],
  }),
  fileSource(extensionRecordDataView, {
    byIds: async (ctx: Context, ids) => {
      const { extensions, repo } = inRepository(ctx);
      if (!extensions) {
        return [];
      }
      return Promise.all(ids.map((id) => extensions.readRecord(id, repo)));
    },
  }),
  // An action's answer, read once, from its mutation: nothing to read again.
  fileSource(extensionActionDataView, { byIds: async () => [] }),
];
