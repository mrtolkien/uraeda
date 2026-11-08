// The server API: the only object an extension's server code receives, one per loaded version.
// Each method checks that the version is still loaded, registers through the registry, and keeps
// the undo on the version's scope, so unloading it removes everything it added.
import type { Context as HonoContext } from "hono";
import type { ApiRepository, EventName, Events, ServerApi } from "../extension-api.ts";
import type { Adapter } from "../runner/adapter.ts";
import type { Scope } from "./scope.ts";

/** A record's reader, as an extension registers it. */
export type RecordReader = (repository: string) => unknown;

/** An action, as an extension registers it. */
export type ActionRunner = (input: unknown, repository: string) => unknown;

/** A route, as an extension registers it. */
export type RouteEntry = {
  handler: (c: HonoContext, repository: string | null) => Response | Promise<Response>;
  method?: "GET" | "POST";
  path: string;
};

/**
 * What the server API registers into, the extensions host: each `add…` gives its undo. A name
 * taken twice by the same extension throws.
 */
export type Registry = {
  addAction(extension: string, name: string, run: ActionRunner): () => void;
  addRecord(extension: string, name: string, read: RecordReader): () => void;
  addRoute(extension: string, route: RouteEntry): () => void;
  addRuntime(extension: string, runtime: Adapter): () => void;
  /** Sends the record's live update, to one repository's pages or every one's. */
  changed(extension: string, name: string, repository?: string): void;
  on<E extends EventName>(
    extension: string,
    event: E,
    handler: (payload: Events[E]) => unknown,
  ): () => void;
  /** The repositories the extension is on in. */
  repositories(extension: string): ReadonlyArray<ApiRepository>;
  settings(extension: string, repository: string | null): Record<string, unknown>;
};

/** The names of records and actions: a path segment, so their ids stay `<extension>/<name>`. */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function checkName(extension: string, what: string, name: string): void {
  if (!NAME.test(name)) {
    throw new Error(
      `${extension}: ${what} name ${JSON.stringify(name)} must be letters, digits, ., _, or -`,
    );
  }
}

/** The server API of one loaded version, its scope `scope`, registering into `registry`. */
export function serverApi(scope: Scope, registry: Registry): ServerApi {
  const { name } = scope;
  /** Checks the version, registers, and keeps the undo on its scope. */
  const keep = (register: () => () => void) => {
    scope.check();
    scope.add(register());
  };
  return {
    action(action, run) {
      checkName(name, "an action's", action);
      keep(() => registry.addAction(name, action, run as ActionRunner));
    },
    log(message) {
      scope.check();
      process.stdout.write(`${name}: ${message}\n`);
    },
    on(event, handler) {
      keep(() => registry.on(name, event, handler));
    },
    record(record, read) {
      checkName(name, "a record's", record);
      keep(() => registry.addRecord(name, record, read));
      return {
        changed(repository) {
          scope.check();
          registry.changed(name, record, repository);
        },
      };
    },
    repositories() {
      scope.check();
      return registry.repositories(name);
    },
    route(path, handler, method) {
      scope.check();
      if (!path.startsWith(`/x/${name}/`)) {
        throw new Error(`${name}: routes must be under /x/${name}/`);
      }
      keep(() => registry.addRoute(name, { handler, path, ...(method && { method }) }));
    },
    runtime(runtime) {
      keep(() => registry.addRuntime(name, runtime));
    },
    settings(repository) {
      scope.check();
      return registry.settings(name, repository);
    },
  };
}
