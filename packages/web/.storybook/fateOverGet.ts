// fate's requests in Uraeda's own Storybook, as GETs (R4): Uraeda forwards only a Storybook's GET and
// HEAD requests and WebSocket upgrades, and fate's queries, mutations, and live controls are POSTs.
// The preview's fate client sends each as `GET …/fate?request=<JSON>` or `GET …/fate/live?…`, with
// no header that needs a preflight, and its live stream without credentials, which the proxy's
// `Access-Control-Allow-Origin: *` refuses. This Storybook's middleware turns each GET back into the
// POST Uraeda's server in Storybook expects. That server is the fixture's: nothing of the user's
// repository is reachable through it.
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite-plus";

/** The query parameter holding a POST's body. */
const REQUEST = "request";

/** fate's endpoints: a repository's or the global one, and their live streams. */
const ENDPOINT = /\/fate(\/live)?$/;

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
 * A Vite plugin of Uraeda's Storybook: its middleware, before the server's, turns a GET of fate's
 * with `?request=` back into a POST of that body, and removes the `Origin` and `Sec-Fetch-Site` of
 * the frame that sent any GET of fate's, as the server's guard would refuse them.
 */
export function fateOverGet(): Plugin {
  return {
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        asPost(request);
        next();
      });
    },
    name: "uraeda-fate-over-get",
  };
}

/**
 * Makes a GET of fate's with `?request=` the POST it stands for, in place. Every request of fate's
 * loses the `Origin` and `Sec-Fetch-Site` of the sandboxed frame that sent it, its live stream's
 * too: the server's guard refuses `Origin: null` outside a preview's path.
 */
function asPost(request: IncomingMessage) {
  const url = new URL(request.url ?? "/", "http://storybook");
  if (request.method !== "GET" || !ENDPOINT.test(url.pathname)) {
    return;
  }
  delete request.headers.origin;
  delete request.headers["sec-fetch-site"];
  const body = url.searchParams.get(REQUEST);
  if (body === null) {
    return;
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
}
