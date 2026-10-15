// fate's requests in Uraeda's own Storybook, as GETs (R4): Uraeda forwards only a Storybook's GET and
// HEAD requests and WebSocket upgrades, and fate's queries, mutations, and live controls are POSTs.
// The preview's fate client sends each as `GET …/fate?request=<JSON>` or `GET …/fate/live?…`, with
// no header that needs a preflight, and its live stream without credentials, which the proxy's
// `Access-Control-Allow-Origin: *` refuses. This Storybook's middleware turns each GET of the
// fixture's endpoint back into the POST Uraeda's server in Storybook expects, and refuses any other
// GET carrying a request. Any web page can send such a GET, without a preflight, and through Uraeda's
// proxy, so the server in Storybook locks its list (R47): it serves the fixture alone, and reaches
// no other folder.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite-plus";

/** The query parameter holding a POST's body. */
const REQUEST = "request";

/**
 * The fixture's fate endpoint and its live stream, the only paths the middleware changes: the
 * preview's fate client reaches the fixture's repository and the global list, which needs no GET.
 */
const FIXTURE_ENDPOINTS = new Set(["/r/fixture/fate", "/r/fixture/fate/live"]);

/**
 * The preview's `fetch` for fate: a POST is sent as a GET to the same address, its body in
 * `?request=`, without headers; any other request is sent as it is.
 */
export const fetchOverGet: typeof fetch = (input, init) => {
  if (init?.method !== "POST" || typeof init.body !== "string") {
    return fetch(input, init);
  }
  // fate gives its endpoint as a string.
  const url = new URL(String(input), window.location.href);
  url.searchParams.set(REQUEST, init.body);
  return fetch(url, { method: "GET", ...(init.signal ? { signal: init.signal } : {}) });
};

/**
 * Opens fate's live streams without credentials: a credentialed request from a sandboxed frame, whose
 * origin is opaque, is refused under `Access-Control-Allow-Origin: *`. The preview calls it before
 * its clients are made; Storybook's own pages are left alone.
 */
export function liveWithoutCredentials() {
  const Native = window.EventSource;
  window.EventSource = class extends Native {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, { ...init, withCredentials: false });
    }
  };
}

/**
 * A Vite plugin of Uraeda's Storybook: its middleware, before the server's, turns a GET of the
 * fixture's fate endpoint with `?request=` back into a POST of that body, and removes the `Origin`
 * and `Sec-Fetch-Site` of the frame that sent a GET of that endpoint or its live stream, as the
 * server's guard would refuse them. It answers 403 to any other GET carrying `?request=`, and
 * leaves every other request as it is.
 */
export function fateOverGet(): Plugin {
  return {
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (asPost(request, response)) {
          next();
        }
      });
    },
    name: "uraeda-fate-over-get",
  };
}

/**
 * Makes a GET of the fixture's fate endpoint with `?request=` the POST it stands for, in place. A
 * GET of that endpoint or its live stream loses the `Origin` and `Sec-Fetch-Site` of the sandboxed
 * frame that sent it: the server's guard refuses `Origin: null` outside a preview's path. Any other
 * GET carrying `?request=` is answered 403, and false returned; true otherwise.
 */
function asPost(request: IncomingMessage, response: ServerResponse): boolean {
  if (request.method !== "GET") {
    return true;
  }
  const url = new URL(request.url ?? "/", "http://storybook");
  const body = url.searchParams.get(REQUEST);
  if (!FIXTURE_ENDPOINTS.has(url.pathname)) {
    if (body === null) {
      return true;
    }
    response.statusCode = 403;
    response.end("Forbidden: only the fixture's fate endpoint takes a request in a GET");
    return false;
  }
  delete request.headers.origin;
  delete request.headers["sec-fetch-site"];
  if (body === null) {
    return true;
  }
  url.searchParams.delete(REQUEST);
  const bytes = Buffer.from(body);
  request.method = "POST";
  request.url = `${url.pathname}${url.search}`;
  request.headers["content-type"] = "application/json";
  request.headers["content-length"] = String(bytes.length);
  // The server's Node adapter reads a request's body from `rawBody` when it is set: this GET's
  // stream has none.
  (request as IncomingMessage & { rawBody?: Buffer }).rawBody = bytes;
  return true;
}
