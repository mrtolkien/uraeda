// The parts of the web's own that a route and `fetch` need, in an extension's VM: bytes and
// text, `Headers`, `Response`, a route's request, and `fetch`, whose request goes out from the
// server and whose whole answer comes back.

let host;
let ask;

/** A body's bytes: a text's as UTF-8, an array's or a buffer's as they are. */
function bytesOf(body) {
  if (body === undefined || body === null) {
    return new Uint8Array(0);
  }
  if (typeof body === "string") {
    return host.encodeText(body);
  }
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (Object.prototype.toString.call(body) === "[object ArrayBuffer]") {
    return new Uint8Array(body);
  }
  return host.encodeText(String(body));
}

class TextEncoder {
  encode(text = "") {
    return host.encodeText(String(text));
  }
}

class TextDecoder {
  decode(bytes) {
    return host.decodeText(bytesOf(bytes));
  }
}

class Headers {
  #values = new Map();

  constructor(init) {
    // Other headers and a list of pairs are read in order: anything else by its own names.
    const listed = typeof init?.[Symbol.iterator] === "function";
    const pairs = listed ? [...init] : Object.entries(init ?? {});
    for (const [key, value] of pairs) {
      this.append(key, value);
    }
  }

  append(key, value) {
    const held = this.#values.get(String(key).toLowerCase());
    this.set(key, held === undefined ? value : `${held}, ${value}`);
  }

  delete(key) {
    this.#values.delete(String(key).toLowerCase());
  }

  get(key) {
    return this.#values.get(String(key).toLowerCase()) ?? null;
  }

  has(key) {
    return this.#values.has(String(key).toLowerCase());
  }

  set(key, value) {
    this.#values.set(String(key).toLowerCase(), String(value));
  }

  forEach(callback) {
    for (const [key, value] of this.#values) {
      callback(value, key, this);
    }
  }

  entries() {
    return this.#values.entries();
  }

  keys() {
    return this.#values.keys();
  }

  values() {
    return this.#values.values();
  }

  [Symbol.iterator]() {
    return this.#values.entries();
  }
}

/** Each body's bytes, by the response or the request that holds it. */
const bodies = new WeakMap();

/** What reads a body: the same on a response and on a request. */
const reads = {
  arrayBuffer() {
    const bytes = bodies.get(this);
    return Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  },
  bytes() {
    return Promise.resolve(bodies.get(this));
  },
  json() {
    return this.text().then((text) => JSON.parse(text));
  },
  text() {
    return Promise.resolve(host.decodeText(bodies.get(this)));
  },
};

class Response {
  constructor(body, init = {}) {
    this.status = init.status ?? 200;
    this.statusText = init.statusText ?? "";
    this.headers = new Headers(init.headers);
    if (typeof body === "string" && !this.headers.has("content-type")) {
      this.headers.set("content-type", "text/plain;charset=UTF-8");
    }
    bodies.set(this, bytesOf(body));
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  static json(value, init = {}) {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new Response(JSON.stringify(value), { ...init, headers });
  }
}
Object.assign(Response.prototype, reads);

/** A request to a route, as the server hands it over. */
class Request {
  constructor({ body, headers, method, path, query }) {
    this.method = method;
    this.path = path;
    this.query = query;
    this.url = path;
    this.headers = new Headers(headers);
    bodies.set(this, host.fromBase64(body));
  }
}
Object.assign(Request.prototype, reads);

/** The requests sent, each waiting for its answer. */
const fetches = new Map();
let nextFetch = 1;

function fetch(input, init = {}) {
  return new Promise((resolve, reject) => {
    const id = nextFetch++;
    const noBody = init.body === undefined || init.body === null;
    fetches.set(id, { reject, resolve });
    try {
      ask("fetch", {
        body: noBody ? null : host.toBase64(bytesOf(init.body)),
        headers: [...new Headers(init.headers)],
        id,
        method: String(init.method ?? "GET").toUpperCase(),
        url: String(input),
      });
    } catch (error) {
      fetches.delete(id);
      reject(error);
    }
  });
}

/** A request's answer came, or its failure. */
function fetched({ body, error, headers, id, status, statusText }) {
  const waiting = fetches.get(id);
  fetches.delete(id);
  if (!waiting) {
    return;
  }
  if (error === undefined) {
    waiting.resolve(new Response(host.fromBase64(body), { headers, status, statusText }));
  } else {
    waiting.reject(new TypeError(`fetch failed: ${error}`));
  }
}

/** A route's answer as the server sends it: a `Response`, or a text, or a value as JSON. */
function sent(given) {
  let response = given;
  if (typeof given === "string") {
    response = new Response(given);
  } else if (!bodies.has(given)) {
    response = Response.json(given === undefined ? null : given);
  }
  return {
    body: host.toBase64(bodies.get(response)),
    headers: [...response.headers],
    status: response.status,
  };
}

export default function web(given, parts) {
  host = given;
  ({ ask } = parts.guard);
  Object.assign(globalThis, { fetch, Headers, Response, TextDecoder, TextEncoder });
  return { bytesOf, fetched, Request, sent };
}
