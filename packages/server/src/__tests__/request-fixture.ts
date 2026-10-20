// A scripted repository endpoint for the UI's focused tests: requests go through fate's own server,
// with the server's data views, source plans and refusal errors, but every answer comes from the
// test's handlers. No binding, git repository, or session manager is loaded.
import { createFateServer, type FateRequestError } from "@nkzw/fate/server";
import {
  agentDataView,
  branchChangesDataView,
  branchDecisionDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  historyDataView,
  inboxDataView,
  ledgerDataView,
  needsYouListDataView,
  previewDataView,
  prioritiesDataView,
  proposalHintsDataView,
  recommendedDataView,
  repositoriesDataView,
  Root,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  settingsDataView,
  slugProposalDataView,
  storyDataView,
  storyHrefDataView,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  workspaceDataView,
} from "../fate.ts";
import { callSiteError } from "../fate/errors.ts";
import { mutations } from "../fate/mutations.ts";
import { withWholeFields } from "../fate/select.ts";
import { createSources, type DataView, fileSource } from "../fate/source.ts";
import type { AgentRecord, SessionRecord } from "../fate/views.ts";
import type { ChatImage } from "../runner/images.ts";

export type { AgentRecord, ChatImage, SessionRecord };

type Mutations = typeof mutations;
/** A production mutation's input, as its resolver types it. */
export type MutationInput<Name extends keyof Mutations> = Parameters<
  Mutations[Name]["resolve"]
>[0]["input"];

/** The answer of a scripted mutation or read: the record fate masks to the client's selection. */
type Answer = Record<string, unknown> & { id: string };

/** A scripted handler per production mutation name: a missing one is an unexpected call. */
export type MutationHandlers = {
  [Name in keyof Mutations]?: (input: MutationInput<Name>) => Answer | Promise<Answer>;
};

/** What a test scripts: the records reads return, the mutations, and chat image uploads. */
export type RequestFixtureOptions = {
  agent: AgentRecord;
  /**
   * Answers `POST /r/<repo>/attach?chat=1&name=<name>` with a saved chat image, or a refusal's
   * message. An upload without `chat=1`, with a `path`, or without a file is unexpected.
   */
  attach?: (file: File) => Promise<ChatImage | { error: string }>;
  /** The chat images saved before the case, which `DELETE /r/<repo>/chat-images/<id>` removes. */
  chatImages?: ReadonlyArray<string>;
  mutations?: MutationHandlers;
  /** The repository's name, `/r/<repo>/` in every path. */
  repo?: string;
  sessions?: ReadonlyArray<SessionRecord>;
};

/** A request that reached a scripted handler, in the order the handlers were called. */
export type FixtureRequest =
  | { input: unknown; kind: "mutation"; name: string }
  | { ids: Array<string>; kind: "read"; type: string }
  | { kind: "attach"; name: string | null }
  | { kind: "delete"; path: string };

/** A refusal as the core words it, sent the way the server's resolvers send one. */
export function refused(message: string): FateRequestError {
  return callSiteError(`refused: ${message}`);
}

/** Every type the server's roots read: a root without its view here fails at once. */
const dataViews = [
  agentDataView,
  branchChangesDataView,
  branchDecisionDataView,
  draftDataView,
  featureDataView,
  fileDataView,
  folderSuggestionsDataView,
  historyDataView,
  inboxDataView,
  ledgerDataView,
  needsYouListDataView,
  previewDataView,
  prioritiesDataView,
  proposalHintsDataView,
  recommendedDataView,
  repositoriesDataView,
  sessionDataView,
  sessionListDataView,
  sessionSearchDataView,
  settingsDataView,
  slugProposalDataView,
  storyDataView,
  storyHrefDataView,
  turnDataView,
  turnLogDataView,
  workflowMessageDataView,
  workspaceDataView,
] as unknown as Array<DataView<Answer>>;
const viewOf = new Map(dataViews.map((view) => [view.typeName, view]));
for (const root of Object.values(Root)) {
  if (!viewOf.has(root.typeName)) {
    throw new Error(`The request fixture has no data view for ${root.typeName}`);
  }
}

/** What the handlers reached, what had none, and the records reads answer, by type and id. */
type Ledger = {
  fail: (what: string) => never;
  records: Map<string, Map<string, Answer>>;
  requests: Array<FixtureRequest>;
};

/** The server's mutations by name and type, each answered by the test's handler, or failing. */
function scriptedServer({ fail, records, requests }: Ledger, handlers: MutationHandlers = {}) {
  const sources = createSources<unknown>(
    dataViews.map((view) =>
      fileSource(view, {
        byIds: async (_ctx, ids) => {
          requests.push({ ids, kind: "read", type: view.typeName });
          const known = records.get(view.typeName);
          return ids.map(
            (id) => known?.get(id) ?? fail(`read of ${view.typeName} ${JSON.stringify(id)}`),
          );
        },
      }),
    ),
  );
  const scripted = Object.fromEntries(
    Object.entries(mutations).map(([name, { type }]) => [
      name,
      {
        resolve: async ({ input, select }: { input: unknown; select: Array<string> }) => {
          const handler = handlers[name as keyof Mutations] as
            | ((input: unknown) => Answer | Promise<Answer>)
            | undefined;
          if (!handler) {
            return fail(`mutation ${name} ${JSON.stringify(input)}`);
          }
          requests.push({ input, kind: "mutation", name });
          const answer = await handler(input);
          records.get(type)?.set(answer.id, answer);
          return sources.masked(viewOf.get(type)!, undefined, answer, select);
        },
        type,
      },
    ]),
  );
  return createFateServer({
    context: () => undefined,
    live: false,
    mutations: scripted,
    roots: Root,
    sources,
  });
}

/** The page's multipart form: a DOM emulator's body need not round-trip through `Request`. */
async function formOf(request: Request, body: unknown): Promise<FormData> {
  return body && typeof body === "object" && "getAll" in body
    ? (body as FormData)
    : request.formData();
}

/**
 * A repository's endpoint whose answers the test scripts. `fetch` takes the UI's fate, upload, and
 * image-deletion requests to `/r/<repo>/`; `requests` lists what reached a handler; `close` refuses
 * later requests and throws when any request had no handler. A request without a handler fails at
 * once, so a test never passes on a refusal it did not script.
 */
export function createRequestFixture(options: RequestFixtureOptions) {
  const base = `/r/${encodeURIComponent(options.repo ?? "test")}`;
  const unexpected: Array<string> = [];
  let closed = false;
  const ledger: Ledger = {
    fail: (what) => {
      unexpected.push(what);
      throw new Error(`Unexpected request: ${what}`);
    },
    records: new Map<string, Map<string, Answer>>([
      ["Agent", new Map([[options.agent.id, options.agent]])],
      [
        "Session",
        new Map((options.sessions ?? []).map((session): [string, Answer] => [session.id, session])),
      ],
    ]),
    requests: [],
  };
  const { fail, requests } = ledger;
  /** The chat images saved and not deleted: deleting another one answers 404, as the server does. */
  const saved = new Set(options.chatImages);
  const server = scriptedServer(ledger, options.mutations);

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === "object" && "url" in input ? input.url : String(input);
    const request = new Request(url, init);
    const { pathname } = new URL(request.url, "http://127.0.0.1");
    if (closed) {
      return fail(`${request.method} ${pathname} after the test`);
    }
    if (request.method === "POST" && pathname === `${base}/fate`) {
      return server.handleRequest(
        new Request(request.url, {
          body: JSON.stringify(withWholeFields(await request.json())),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
    }
    if (request.method === "POST" && pathname === `${base}/attach` && options.attach) {
      // The server reads the target and the name from the query, before the body.
      const query = new URL(request.url, "http://127.0.0.1").searchParams;
      const file = (await formOf(request, init?.body)).get("file");
      // A field's text is a string; a file part is a `File`.
      if (query.get("chat") !== "1" || query.has("path") || typeof file !== "object" || !file) {
        return fail(`POST ${pathname}?${query} is not a chat image upload with its file`);
      }
      requests.push({ kind: "attach", name: query.get("name") });
      const answer = await options.attach(file);
      if (!("error" in answer)) {
        saved.add(answer.id);
      }
      return Response.json(answer, { status: "error" in answer ? 400 : 200 });
    }
    if (request.method === "DELETE" && pathname.startsWith(`${base}/chat-images/`)) {
      requests.push({ kind: "delete", path: pathname });
      const id = decodeURIComponent(pathname.slice(`${base}/chat-images/`.length));
      return new Response(null, { status: saved.delete(id) ? 204 : 404 });
    }
    return fail(`${request.method} ${pathname}`);
  };

  return {
    /** Refuses later requests, and throws when a request had no handler. */
    close() {
      closed = true;
      if (unexpected.length > 0) {
        throw new Error(`Unexpected requests:\n${unexpected.join("\n")}`);
      }
    },
    fetch,
    requests,
    /** The inputs of the mutation `name` that reached its handler, in order. */
    sent<Name extends keyof Mutations>(name: Name): Array<MutationInput<Name>> {
      return requests.flatMap((request) =>
        request.kind === "mutation" && request.name === name
          ? [request.input as MutationInput<Name>]
          : [],
      );
    },
  };
}

export type RequestFixture = ReturnType<typeof createRequestFixture>;
